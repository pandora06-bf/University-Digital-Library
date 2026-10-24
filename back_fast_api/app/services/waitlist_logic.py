"""Waitlist 3-04.a: serialize queue operations by locking the book row.

The caller owns the transaction. All queue mutations occur in this transaction;
notification delivery is intentionally deferred until after commit.
"""
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.book import Book
from app.models.loan import Loan, Waitlist
from app.models.user import User

WAITING = "WAITING"
HELD = "HELD"
ACTIVE = (WAITING, HELD)
HOLD_PERIOD = timedelta(hours=24)


def utc_now():
    # DB schema currently uses TIMESTAMP WITHOUT TIME ZONE, always store UTC-naive.
    return datetime.utcnow()


def lock_book(db: Session, book_id: int) -> Book:
    book = db.execute(select(Book).where(Book.id == book_id).with_for_update()).scalar_one_or_none()
    if book is None:
        raise HTTPException(404, "Không tìm thấy sách")
    return book


def check_eligible(db: Session, user: User, book_id: int, exclude_waitlist_id=None):
    if user.is_borrowing_blocked or Decimal(user.total_fines or 0) > 0 or not user.account.is_active:
        raise HTTPException(403, "Tài khoản bị khóa hoặc còn nợ phạt")
    active_loans = db.scalar(select(func.count(Loan.id)).where(
        Loan.user_code == user.user_code,
        Loan.loan_status.in_(["REQUESTED", "BORROWED", "OVERDUE"]),
    )) or 0
    if active_loans >= user.max_borrow_limit:
        raise HTTPException(409, "Đã đạt hạn mức mượn sách")
    if db.scalar(select(Loan.id).where(Loan.user_code == user.user_code,
                      Loan.book_id == book_id, Loan.loan_status.in_(["REQUESTED", "BORROWED", "OVERDUE"])).limit(1)):
        raise HTTPException(409, "Bạn đang có phiếu mượn sách này")
    stmt = select(Waitlist.id).where(Waitlist.user_code == user.user_code,
                                  Waitlist.book_id == book_id, Waitlist.status.in_(ACTIVE))
    if exclude_waitlist_id is not None:
        stmt = stmt.where(Waitlist.id != exclude_waitlist_id)
    if db.scalar(stmt.limit(1)):
        raise HTTPException(409, "Bạn đã đặt trước sách này")


def compact_queue(db: Session, book_id: int):
    rows = db.scalars(select(Waitlist).where(Waitlist.book_id == book_id,
                         Waitlist.status.in_(ACTIVE)).order_by(Waitlist.queue_position, Waitlist.created_at, Waitlist.id)).all()
    for index, item in enumerate(rows, start=1):
        item.queue_position = index
    db.flush()
    return rows


def enqueue(db: Session, book_id: int, user: User) -> Waitlist:
    book = lock_book(db, book_id)
    if book.available_stock != 0:
        raise HTTPException(409, "Sách vẫn còn bản có thể mượn, không thể đặt trước")
    check_eligible(db, user, book_id)
    rows = compact_queue(db, book_id)
    item = Waitlist(user_code=user.user_code, book_id=book_id,
                    queue_position=len(rows) + 1, status=WAITING)
    db.add(item)
    db.flush()
    return item


def remove(db: Session, item: Waitlist):
    book_id = item.book_id
    db.delete(item)
    db.flush()
    compact_queue(db, book_id)


def promote_waitlist(db: Session, book_id: int, now=None):
    """Call after a returned copy has become AVAILABLE, within caller transaction.

    Return the newly HELD record for post-commit notification. A held copy is
    reserved logically by subtracting existing HELD count from available_stock.
    """
    now = now or utc_now()
    book = lock_book(db, book_id)
    rows = compact_queue(db, book_id)
    held = [r for r in rows if r.status == HELD]
    if len(held) >= book.available_stock:
        return None
    for item in rows:
        if item.status != WAITING:
            continue
        user = db.get(User, item.user_code)
        try:
            if user is None:
                raise HTTPException(404, "Người dùng không tồn tại")
            check_eligible(db, user, book_id, exclude_waitlist_id=item.id)
        except HTTPException:
            db.delete(item)
            db.flush()
            compact_queue(db, book_id)
            continue
        item.status = HELD
        item.hold_expires_at = now + HOLD_PERIOD
        db.flush()
        return item
    return None


def expire_holds(db: Session, now=None):
    """JOB-04 core: expire held rows and promote next eligible entries.

    Called by scheduler in a DB session; commits per book to isolate failures.
    """
    now = now or utc_now()
    ids = db.scalars(select(Waitlist.book_id).where(Waitlist.status == HELD).distinct()).all()
    promoted = []
    expired = 0
    for book_id in ids:
        try:
            lock_book(db, book_id)
            candidates = db.scalars(select(Waitlist).where(Waitlist.book_id == book_id, Waitlist.status == HELD)).all()
            for item in candidates:
                user = db.get(User, item.user_code)
                invalid = user is None
                if not invalid:
                    try:
                        check_eligible(db, user, book_id, exclude_waitlist_id=item.id)
                    except HTTPException:
                        invalid = True
                if invalid or (item.hold_expires_at is not None and item.hold_expires_at <= now):
                    db.delete(item)
                    expired += 1
            db.flush()
            compact_queue(db, book_id)
            while True:
                item = promote_waitlist(db, book_id, now)
                if item is None:
                    break
                promoted.append((item.id, item.user_code, item.book_id, item.hold_expires_at))
            db.commit()
        except Exception:
            db.rollback()
            raise
    return {"expired": expired, "promoted": promoted}
