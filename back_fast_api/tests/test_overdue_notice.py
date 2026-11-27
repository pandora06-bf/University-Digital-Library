"""SRS UC12 / JOB-09: email cảnh báo một lần khi phiếu sách in chuyển sang quá hạn."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models.book import Book
from app.models.fine import Fine
from app.models.loan import Loan
from app.models.notification import EmailNotice
from app.models.user import User
from app.scheduler_worker import configure_scheduler, run_overdue_notice_job
from app.services import email_notifier


class _NonClosing:
    def __init__(self, session):
        self._s = session

    def __getattr__(self, name):
        return getattr(self._s, name)

    def close(self):
        pass


def _overdue_loan(db, user_code, days=1):
    book = Book(title="Mạng máy tính", author="A", publisher="B", publication_year=2024, price=0,
                book_type="PRINTED", available_stock=1)
    db.add(book)
    db.flush()
    due = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    loan = Loan(user_code=user_code, book_id=book.id, loan_type="PHYSICAL", loan_status="OVERDUE",
                borrow_date=due - timedelta(days=14), due_date=due)
    db.add(loan)
    db.flush()
    db.add(Fine(loan_id=loan.id, user_code=user_code, overdue_days=days, fine_rate=Decimal("5000"),
                total_amount=Decimal("5000") * days, payment_status="UNPAID"))
    db.commit()
    return loan


def test_overdue_notice_sent_once_with_fine(db_session, test_account, monkeypatch):
    user = db_session.query(User).filter_by(account_id=test_account.id).first()
    loan = _overdue_loan(db_session, user.user_code)
    calls = []
    monkeypatch.setattr(email_notifier, "send_overdue_notice", lambda *args: calls.append(args) or True)

    factory = lambda: _NonClosing(db_session)  # noqa: E731
    assert run_overdue_notice_job(session_factory=factory) == 1
    assert run_overdue_notice_job(session_factory=factory) == 0  # không gửi lặp mỗi ngày
    assert len(calls) == 1
    recipient, _name, title, loan_id, _due, days, amount, rate = calls[0]
    assert (recipient, title, loan_id, days, amount, rate) == (
        "testuser@library.local", "Mạng máy tính", loan.id, 1, Decimal("5000"), Decimal("5000"))
    assert db_session.query(EmailNotice).filter(EmailNotice.event_key.like(f"overdue:{loan.id}:%")).count() == 1


def test_overdue_notice_failed_send_is_retried(db_session, test_account, monkeypatch):
    user = db_session.query(User).filter_by(account_id=test_account.id).first()
    _overdue_loan(db_session, user.user_code, days=2)
    monkeypatch.setattr(email_notifier, "send_overdue_notice", lambda *args: False)
    factory = lambda: _NonClosing(db_session)  # noqa: E731
    assert run_overdue_notice_job(session_factory=factory) == 0
    monkeypatch.setattr(email_notifier, "send_overdue_notice", lambda *args: True)
    assert run_overdue_notice_job(session_factory=factory) == 1


def test_overdue_template_renders_fine(monkeypatch):
    monkeypatch.setenv("LIBRARY_URL", "https://library.example.edu.vn")
    html = email_notifier.render_template(
        "overdue_notice.html", **email_notifier.context_base("Nguyễn Văn A"), book_title="Sách", loan_code="PM-1",
        due_date="11/11/2026, 09:00", overdue_days=1, fine_amount="5.000 VNĐ", fine_rate="5.000 VNĐ")
    assert "CẢNH BÁO QUÁ HẠN" in html and "5.000 VNĐ" in html and "1 ngày" in html


def test_scheduler_registers_overdue_job():
    assert "JOB-09" in {job.id for job in configure_scheduler().get_jobs()}


def test_background_scheduler_for_free_cloud(monkeypatch):
    """Render gói Free: RUN_SCHEDULER=true chạy cùng bộ job trong tiến trình API."""
    import app.scheduler_worker as worker
    monkeypatch.setattr(worker, "run_startup_catch_up", lambda: None)
    scheduler = worker.start_background_scheduler()
    try:
        ids = {job.id for job in scheduler.get_jobs()}
        assert {"JOB-01", "JOB-02", "JOB-05", "JOB-09"} <= ids
        assert scheduler.running
    finally:
        scheduler.shutdown(wait=False)


def test_due_reminder_covers_one_to_two_days(db_session, test_account, monkeypatch):
    """SRS UC12: nhắc khi phiếu còn 1–2 ngày tới hạn; còn 3 ngày thì chưa nhắc."""
    from app.scheduler_worker import run_due_reminder_job
    user = db_session.query(User).filter_by(account_id=test_account.id).first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    titles = []
    for title, hours in (("Còn 36 giờ", 36), ("Còn 3 ngày", 72)):
        book = Book(title=title, author="A", publisher="B", publication_year=2024, price=0,
                    book_type="PRINTED", available_stock=1)
        db_session.add(book)
        db_session.flush()
        db_session.add(Loan(user_code=user.user_code, book_id=book.id, loan_type="PHYSICAL", loan_status="BORROWED",
                            borrow_date=now - timedelta(days=10), due_date=now + timedelta(hours=hours)))
    db_session.commit()
    monkeypatch.setattr(email_notifier, "send_reminder", lambda _to, _name, title, *rest: titles.append(title) or True)
    assert run_due_reminder_job(session_factory=lambda: _NonClosing(db_session), now=now) == 1
    assert titles == ["Còn 36 giờ"]
