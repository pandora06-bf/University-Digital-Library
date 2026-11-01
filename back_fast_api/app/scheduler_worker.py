"""Run separately (python -m app.scheduler_worker), never once per uvicorn worker."""
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from apscheduler.schedulers.blocking import BlockingScheduler
from sqlalchemy import func

from app.core.database import SessionLocal
from app.models.fine import Fine
from app.models.loan import Loan
from app.models.user import User
from app.services.ebook_service import utcnow

log = logging.getLogger(__name__)
VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
RATE = Decimal("5000")

def run_fine_job(session_factory=SessionLocal, now=None):
    "JOB-01: idempotent differential adjustment, independent transaction per user."
    now = now or utcnow()
    if now.tzinfo is not None:
        now = now.astimezone(__import__("datetime").timezone.utc).replace(tzinfo=None)
    today = now.replace(tzinfo=__import__("datetime").timezone.utc).astimezone(VN_TZ).date()
    db = session_factory()
    try:
        codes = [v for (v,) in db.query(Loan.user_code).filter(
            Loan.loan_type != "EBOOK", Loan.loan_status.in_(["BORROWED", "OVERDUE"]),
            Loan.due_date < now).distinct().all()]
    finally:
        db.close()
    errors = []
    for code in codes:
        db = session_factory()
        try:
            user = db.query(User).filter(User.user_code == code).with_for_update().one()
            loans = db.query(Loan).filter(Loan.user_code == code,
                Loan.loan_type != "EBOOK", Loan.loan_status.in_(["BORROWED", "OVERDUE"]),
                Loan.due_date < now).all()
            delta = Decimal("0")
            for loan in loans:
                overdue_days = max(0, (today - loan.due_date.replace(tzinfo=__import__("datetime").timezone.utc).astimezone(VN_TZ).date()).days)
                wanted = RATE * overdue_days
                fine = db.query(Fine).filter(Fine.loan_id == loan.id).first()
                if fine is None:
                    fine = Fine(loan_id=loan.id, user_code=code, overdue_days=overdue_days,
                                fine_rate=RATE, total_amount=wanted, payment_status="UNPAID")
                    db.add(fine)
                    delta += wanted
                elif fine.payment_status == "UNPAID":
                    delta += max(Decimal("0"), wanted - fine.total_amount)
                    fine.overdue_days = max(fine.overdue_days, overdue_days)
                    fine.total_amount = max(fine.total_amount, wanted)
                loan.loan_status = "OVERDUE"
            user.total_fines = Decimal(user.total_fines) + delta
            if user.total_fines > 0:
                user.is_borrowing_blocked = True
            db.commit()
        except Exception:
            db.rollback()
            errors.append(code)
            log.exception("JOB-01 failed for user %s", code)
        finally:
            db.close()
    return {"processed": len(codes), "errors": errors}

def run_ebook_expiry_job(session_factory=SessionLocal, now=None):
    "JOB-05: revoke all eBook access on expiry (also checked on stream)."
    now = now or utcnow()
    if now.tzinfo is not None:
        now = now.astimezone(__import__("datetime").timezone.utc).replace(tzinfo=None)
    db = session_factory()
    try:
        loans = db.query(Loan).filter(Loan.loan_type == "EBOOK",
            Loan.loan_status.in_(["BORROWED", "OVERDUE"]), Loan.due_date <= now).all()
        for loan in loans:
            loan.loan_status = "EXPIRED"
            loan.ebook_access_token = None
        db.commit()
        return len(loans)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def run_due_reminder_job(session_factory=SessionLocal, now=None):
    """JOB-02: next-day reminders, keyed per loan/due date; failure retried next run."""
    from app.services.email_notifier import send_reminder
    from app.models.notification import EmailNotice
    from sqlalchemy.orm import joinedload
    now = now or utcnow()
    if now.tzinfo is not None:
        now = now.astimezone(__import__("datetime").timezone.utc).replace(tzinfo=None)
    db = session_factory()
    sent = 0
    try:
        loans = db.query(Loan).options(joinedload(Loan.book), joinedload(Loan.user)).filter(
            Loan.loan_type != "EBOOK", Loan.loan_status == "BORROWED",
            Loan.due_date > now, Loan.due_date <= now + timedelta(days=1)).all()
        for loan in loans:
            key = f"due:{loan.id}:{loan.due_date.isoformat()}"
            if db.query(EmailNotice.id).filter(EmailNotice.event_key == key).first():
                continue
            user = loan.user
            if not user or not user.email:
                log.info("JOB-02 skipped missing email loan=%s", loan.id)
                continue
            try:
                if send_reminder(user.email, user.full_name, loan.book.title, loan.id, loan.due_date):
                    db.add(EmailNotice(event_key=key, recipient=user.email))
                    db.commit()
                    sent += 1
                else:
                    log.warning("JOB-02 email failed loan=%s; will retry", loan.id)
            except Exception:
                db.rollback()
                log.exception("JOB-02 failed loan=%s", loan.id)
        return sent
    finally:
        db.close()

def _optional_job(module, function):
    "Load team-owned jobs only if implementations have been merged."
    try:
        from importlib import import_module
        return getattr(import_module(module), function)
    except (ModuleNotFoundError, AttributeError):
        log.warning("Pending integration: %s.%s", module, function)
        return None

def configure_scheduler():
    scheduler = BlockingScheduler(timezone=VN_TZ, job_defaults={"coalesce": True, "max_instances": 1})
    scheduler.add_job(run_fine_job, "cron", hour=0, minute=0, id="JOB-01", replace_existing=True, misfire_grace_time=None)
    scheduler.add_job(run_due_reminder_job, "cron", hour=8, id="JOB-02", replace_existing=True, misfire_grace_time=None)
    scheduler.add_job(run_ebook_expiry_job, "interval", minutes=5, id="JOB-05", replace_existing=True)
    for job_id, module, func in [
        ("JOB-04", "app.services.job_hold_expiry", "job_hold_expiry"),
        ("JOB-06", "app.services.qr_service", "run_qr_expiry_job"),
        ("JOB-07", "app.services.wallet_service", "run_topup_expiry_job"),
        # SRS gọi đây là JOB-03, nhưng id đó đã dùng cho run_due_reminder_job ở
        # trên nên hủy phiếu PENDING_PICKUP quá hạn nhận sách (3-01.a / UC05)
        # được đăng ký dưới JOB-08.
        ("JOB-08", "app.services.loan_service", "run_pickup_expiry_job")]:
        job = _optional_job(module, func)
        if job:
            scheduler.add_job(job, "interval", minutes=5, id=job_id, replace_existing=True)
    return scheduler

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # Catch up on missed calendar days after an outage.
    log.info("Startup fine catch-up: %s", run_fine_job())
    log.info("Startup ebook expiry: %s", run_ebook_expiry_job())
    log.info("Startup due reminders: %s", run_due_reminder_job())
    configure_scheduler().start()
