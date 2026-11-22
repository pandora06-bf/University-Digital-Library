"""3-04.a/JOB-04: Đặt trước (Waitlist) và giữ chỗ 24 giờ — waitlist_logic.py."""
from datetime import timedelta

import pytest
from fastapi import HTTPException

from app.core.security import hash_password
from app.models.book import Book
from app.models.loan import Loan, Waitlist
from app.models.user import Account, User
from app.services import waitlist_logic as svc


def _make_reader(db_session, *, user_code, max_borrow_limit=3, is_borrowing_blocked=False,
                 total_fines=0, account_active=True):
    account = Account(username=f"wl_{user_code.lower()}", password=hash_password("Password123@"),
                      role="STUDENT", is_active=account_active)
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    user = User(account_id=account.id, user_code=user_code, full_name="Waitlist Tester",
                email=f"{user_code.lower()}@library.local", department="CNTT", user_type="STUDENT",
                max_borrow_limit=max_borrow_limit, max_borrow_days=14,
                is_borrowing_blocked=is_borrowing_blocked, total_fines=total_fines)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _make_book(db_session, *, available_stock=0, title="Waitlist Book"):
    book = Book(title=title, author="Tester", publisher="QA", publication_year=2026,
                book_type="PRINTED", available_stock=available_stock)
    db_session.add(book)
    db_session.commit()
    db_session.refresh(book)
    return book


# ---------------------------------------------------------------- lock_book

def test_lock_book_not_found(db_session):
    with pytest.raises(HTTPException) as e:
        svc.lock_book(db_session, 999999)
    assert e.value.status_code == 404


def test_lock_book_success(db_session):
    book = _make_book(db_session)
    assert svc.lock_book(db_session, book.id).id == book.id


# ---------------------------------------------------------------- check_eligible

def test_check_eligible_rejects_blocked_account(db_session):
    user = _make_reader(db_session, user_code="WL0001", is_borrowing_blocked=True)
    book = _make_book(db_session)
    with pytest.raises(HTTPException) as e:
        svc.check_eligible(db_session, user, book.id)
    assert e.value.status_code == 403


def test_check_eligible_rejects_inactive_account(db_session):
    user = _make_reader(db_session, user_code="WL0002", account_active=False)
    book = _make_book(db_session)
    with pytest.raises(HTTPException) as e:
        svc.check_eligible(db_session, user, book.id)
    assert e.value.status_code == 403


def test_check_eligible_rejects_over_limit(db_session):
    user = _make_reader(db_session, user_code="WL0003", max_borrow_limit=1)
    book1 = _make_book(db_session, available_stock=1, title="Other Book")
    db_session.add(Loan(user_code=user.user_code, book_id=book1.id, loan_type="PHYSICAL",
                        loan_status="BORROWED", borrow_date=svc.utc_now(),
                        due_date=svc.utc_now() + timedelta(days=14)))
    db_session.commit()
    book2 = _make_book(db_session)
    with pytest.raises(HTTPException) as e:
        svc.check_eligible(db_session, user, book2.id)
    assert e.value.status_code == 409


def test_check_eligible_rejects_already_borrowing_same_book(db_session):
    user = _make_reader(db_session, user_code="WL0004")
    book = _make_book(db_session)
    db_session.add(Loan(user_code=user.user_code, book_id=book.id, loan_type="PHYSICAL",
                        loan_status="BORROWED", borrow_date=svc.utc_now(),
                        due_date=svc.utc_now() + timedelta(days=14)))
    db_session.commit()
    with pytest.raises(HTTPException) as e:
        svc.check_eligible(db_session, user, book.id)
    assert e.value.status_code == 409


def test_check_eligible_rejects_duplicate_waitlist_entry(db_session):
    user = _make_reader(db_session, user_code="WL0005")
    book = _make_book(db_session)
    db_session.add(Waitlist(user_code=user.user_code, book_id=book.id, status="WAITING", queue_position=1))
    db_session.commit()
    with pytest.raises(HTTPException) as e:
        svc.check_eligible(db_session, user, book.id)
    assert e.value.status_code == 409


def test_check_eligible_exclude_waitlist_id_allows_self(db_session):
    user = _make_reader(db_session, user_code="WL0006")
    book = _make_book(db_session)
    item = Waitlist(user_code=user.user_code, book_id=book.id, status="WAITING", queue_position=1)
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    svc.check_eligible(db_session, user, book.id, exclude_waitlist_id=item.id)  # không raise


# ---------------------------------------------------------------- enqueue / remove / compact_queue

def test_enqueue_rejects_when_stock_available(db_session):
    user = _make_reader(db_session, user_code="WL0007")
    book = _make_book(db_session, available_stock=1)
    with pytest.raises(HTTPException) as e:
        svc.enqueue(db_session, book.id, user)
    assert e.value.status_code == 409


def test_enqueue_assigns_next_queue_position(db_session):
    user1 = _make_reader(db_session, user_code="WL0008")
    user2 = _make_reader(db_session, user_code="WL0009")
    book = _make_book(db_session, available_stock=0)
    item1 = svc.enqueue(db_session, book.id, user1)
    item2 = svc.enqueue(db_session, book.id, user2)
    assert item1.queue_position == 1 and item2.queue_position == 2


def test_remove_compacts_queue_positions(db_session):
    user1 = _make_reader(db_session, user_code="WL0010")
    user2 = _make_reader(db_session, user_code="WL0011")
    book = _make_book(db_session, available_stock=0)
    item1 = svc.enqueue(db_session, book.id, user1)
    item2 = svc.enqueue(db_session, book.id, user2)
    svc.remove(db_session, item1)
    db_session.refresh(item2)
    assert item2.queue_position == 1
    assert db_session.query(Waitlist).filter_by(book_id=book.id).count() == 1


# ---------------------------------------------------------------- promote_waitlist

def test_promote_waitlist_none_when_no_stock_free(db_session):
    user = _make_reader(db_session, user_code="WL0012")
    book = _make_book(db_session, available_stock=0)
    svc.enqueue(db_session, book.id, user)
    assert svc.promote_waitlist(db_session, book.id) is None


def test_promote_waitlist_promotes_first_eligible(db_session):
    user1 = _make_reader(db_session, user_code="WL0013")
    user2 = _make_reader(db_session, user_code="WL0014")
    book = _make_book(db_session, available_stock=0)
    svc.enqueue(db_session, book.id, user1)
    svc.enqueue(db_session, book.id, user2)
    book.available_stock = 1
    db_session.commit()

    promoted = svc.promote_waitlist(db_session, book.id)
    assert promoted.user_code == user1.user_code
    assert promoted.status == "HELD"
    assert promoted.hold_expires_at is not None


def test_promote_waitlist_skips_ineligible_and_promotes_next(db_session):
    # Đặt trước lúc còn đủ điều kiện, rồi mới bị khóa tài khoản sau đó — promote_waitlist
    # phải loại người này khỏi hàng đợi và chuyển cho người kế tiếp (không chỉ bỏ qua).
    blocked_user = _make_reader(db_session, user_code="WL0015")
    eligible_user = _make_reader(db_session, user_code="WL0016")
    book = _make_book(db_session, available_stock=0)
    svc.enqueue(db_session, book.id, blocked_user)
    svc.enqueue(db_session, book.id, eligible_user)
    blocked_user.is_borrowing_blocked = True
    book.available_stock = 1
    db_session.commit()

    promoted = svc.promote_waitlist(db_session, book.id)
    assert promoted.user_code == eligible_user.user_code
    # Người bị khóa đã bị loại khỏi hàng đợi, không chỉ bị bỏ qua.
    assert db_session.query(Waitlist).filter_by(user_code=blocked_user.user_code).count() == 0


def test_promote_waitlist_none_when_queue_empty(db_session):
    book = _make_book(db_session, available_stock=1)
    assert svc.promote_waitlist(db_session, book.id) is None


# ---------------------------------------------------------------- expire_holds (JOB-04)

def test_expire_holds_removes_expired_and_promotes_next(db_session):
    user1 = _make_reader(db_session, user_code="WL0017")
    user2 = _make_reader(db_session, user_code="WL0018")
    book = _make_book(db_session, available_stock=1)
    held = Waitlist(user_code=user1.user_code, book_id=book.id, status="HELD", queue_position=1,
                    hold_expires_at=svc.utc_now() - timedelta(hours=1))
    waiting = Waitlist(user_code=user2.user_code, book_id=book.id, status="WAITING", queue_position=2)
    db_session.add_all([held, waiting])
    db_session.commit()

    result = svc.expire_holds(db_session)
    assert result["expired"] == 1
    assert len(result["promoted"]) == 1
    assert result["promoted"][0][1] == user2.user_code
    assert db_session.query(Waitlist).filter_by(user_code=user1.user_code).count() == 0
    promoted_row = db_session.query(Waitlist).filter_by(user_code=user2.user_code).one()
    assert promoted_row.status == "HELD"


def test_expire_holds_keeps_unexpired_hold(db_session):
    user = _make_reader(db_session, user_code="WL0019")
    book = _make_book(db_session, available_stock=0)
    db_session.add(Waitlist(user_code=user.user_code, book_id=book.id, status="HELD", queue_position=1,
                            hold_expires_at=svc.utc_now() + timedelta(hours=1)))
    db_session.commit()

    result = svc.expire_holds(db_session)
    assert result["expired"] == 0
    assert db_session.query(Waitlist).filter_by(user_code=user.user_code, status="HELD").count() == 1


def test_expire_holds_no_held_rows_is_noop(db_session):
    result = svc.expire_holds(db_session)
    assert result == {"expired": 0, "promoted": []}
