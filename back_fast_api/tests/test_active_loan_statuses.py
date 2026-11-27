"""Hồi quy: phiếu REQUESTED / PENDING_PICKUP phải tính vào hạn mức và chặn mượn trùng ở MỌI luồng.

Lỗi cũ: loan_service bỏ sót REQUESTED (sinh viên mượn được 4/3 cuốn qua web và mượn trùng cuốn đang
giữ), waitlist_logic bỏ sót PENDING_PICKUP, còn hồ sơ hiển thị "x/3" đếm cả phiếu đã hủy.
"""
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.core.security import create_access_token, hash_password
from app.models.book import Book, Ebook
from app.models.loan import Loan
from app.models.user import Account, User
from app.services import ebook_service, waitlist_logic
from app.services.loan_states import ACTIVE_LOAN_STATUSES
from app.services.user_service import get_user_profile


def _reader(db, code, limit=3):
    account = Account(username=f"st_{code.lower()}", password=hash_password("Password123@"), role="STUDENT", is_active=True)
    db.add(account)
    db.flush()
    user = User(account_id=account.id, user_code=code, full_name="Status Tester", email=f"{code.lower()}@library.local",
                department="CNTT", user_type="STUDENT", max_borrow_limit=limit, max_borrow_days=14,
                is_borrowing_blocked=False, total_fines=Decimal("0"))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, {"Authorization": f"Bearer {create_access_token({'sub': str(account.id), 'role': 'STUDENT'})}"}


def _book(db, title, stock=2, book_type="PRINTED"):
    book = Book(title=title, author="T", publisher="QA", publication_year=2026, book_type=book_type, available_stock=stock)
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


def _loan(db, code, book, status, return_date=None):
    now = datetime.utcnow()
    db.add(Loan(user_code=code, book_id=book.id, loan_type="PHYSICAL", loan_status=status,
                borrow_date=now, due_date=now + timedelta(days=14), return_date=return_date))
    db.commit()


def test_single_source_covers_all_open_states():
    assert set(ACTIVE_LOAN_STATUSES) == {"PENDING_PICKUP", "REQUESTED", "BORROWED", "OVERDUE"}


def test_requested_loan_counts_toward_limit_on_web_request(client, db_session):
    user, headers = _reader(db_session, "ST0001")
    _loan(db_session, user.user_code, _book(db_session, "Requested A"), "REQUESTED")
    _loan(db_session, user.user_code, _book(db_session, "Borrowed B"), "BORROWED")
    _loan(db_session, user.user_code, _book(db_session, "Pending C"), "PENDING_PICKUP")
    fourth = _book(db_session, "Fourth D")
    res = client.post("/api/loans/physical/request", json={"book_id": fourth.id}, headers=headers)
    assert res.status_code == 403, res.text  # SRS UC05 E2
    assert "đang mượn 3/tối đa 3" in res.json()["detail"]


def test_requested_loan_blocks_duplicate_request(client, db_session):
    user, headers = _reader(db_session, "ST0002")
    book = _book(db_session, "Held book")
    _loan(db_session, user.user_code, book, "REQUESTED")
    res = client.post("/api/loans/physical/request", json={"book_id": book.id}, headers=headers)
    assert res.status_code == 409, res.text
    assert "đang có phiếu" in res.json()["detail"]


def test_pending_pickup_counts_for_waitlist_eligibility(db_session):
    user, _ = _reader(db_session, "ST0003", limit=1)
    _loan(db_session, user.user_code, _book(db_session, "Pending E"), "PENDING_PICKUP")
    sold_out = _book(db_session, "Sold out F", stock=0)
    with pytest.raises(HTTPException) as e:
        waitlist_logic.check_eligible(db_session, user, sold_out.id)
    assert e.value.status_code == 403  # SRS UC07 E2


def test_pending_pickup_of_same_book_blocks_waitlist(db_session):
    user, _ = _reader(db_session, "ST0004")
    book = _book(db_session, "Same book G", stock=0)
    _loan(db_session, user.user_code, book, "PENDING_PICKUP")
    with pytest.raises(HTTPException) as e:
        waitlist_logic.check_eligible(db_session, user, book.id)
    assert e.value.status_code == 409


def test_requested_loan_counts_toward_ebook_limit(db_session):
    user, _ = _reader(db_session, "ST0005", limit=1)
    _loan(db_session, user.user_code, _book(db_session, "Requested H"), "REQUESTED")
    ebook = _book(db_session, "Ebook I", stock=0, book_type="EBOOK")
    db_session.add(Ebook(id=ebook.id, file_path="private:ebooks/ebook-001.pdf", is_free=False, preview_pages=2, borrow_days=14))
    db_session.commit()
    with pytest.raises(HTTPException) as e:
        ebook_service.borrow(db_session, user.user_code, ebook.id)
    assert e.value.status_code == 403  # SRS UC04 E1


def test_profile_counts_only_open_loans(db_session):
    user, _ = _reader(db_session, "ST0006")
    _loan(db_session, user.user_code, _book(db_session, "Open J"), "REQUESTED")
    _loan(db_session, user.user_code, _book(db_session, "Open K"), "BORROWED")
    _loan(db_session, user.user_code, _book(db_session, "Cancelled L"), "CANCELLED")
    _loan(db_session, user.user_code, _book(db_session, "Expired M"), "EXPIRED")
    _loan(db_session, user.user_code, _book(db_session, "Returned N"), "RETURNED", return_date=datetime.utcnow())
    assert get_user_profile(db_session, user)["borrow_limit"] == "2/3"
