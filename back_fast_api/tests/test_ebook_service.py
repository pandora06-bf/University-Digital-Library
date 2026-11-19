"""3-03: Mượn/đọc eBook có bảo vệ bản quyền — ebook_service.py."""
from datetime import timedelta

import pytest
from fastapi import HTTPException
from jose import jwt
from pypdf import PdfReader

from app.core.config import settings
from app.core.security import hash_password
from app.models.book import Book, Ebook
from app.models.loan import Loan
from app.models.user import Account, User
from app.services import ebook_service as svc

REAL_PDF = "private:ebooks/ebook-001.pdf"


def _make_reader(db_session, *, user_code, max_borrow_limit=3, is_borrowing_blocked=False, total_fines=0):
    account = Account(username=f"eb_{user_code.lower()}", password=hash_password("Password123@"),
                      role="STUDENT", is_active=True)
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    user = User(account_id=account.id, user_code=user_code, full_name="Ebook Tester",
                email=f"{user_code.lower()}@library.local", department="CNTT", user_type="STUDENT",
                max_borrow_limit=max_borrow_limit, max_borrow_days=14,
                is_borrowing_blocked=is_borrowing_blocked, total_fines=total_fines)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _make_ebook_book(db_session, *, is_free=False, preview_pages=5, borrow_days=14,
                     file_path=REAL_PDF, book_type="EBOOK"):
    book = Book(title="Ebook Test", author="Tester", publisher="QA", publication_year=2026,
                book_type=book_type, available_stock=0)
    db_session.add(book)
    db_session.commit()
    db_session.refresh(book)
    ebook = Ebook(id=book.id, file_path=file_path, is_free=is_free,
                  preview_pages=preview_pages, borrow_days=borrow_days)
    db_session.add(ebook)
    db_session.commit()
    db_session.refresh(book)
    return book


# ---------------------------------------------------------------- get_ebook

def test_get_ebook_not_found(db_session):
    with pytest.raises(HTTPException) as e:
        svc.get_ebook(db_session, 999999)
    assert e.value.status_code == 404


def test_get_ebook_rejects_physical_only_book(db_session):
    book = Book(title="Physical only", author="A", publisher="B", publication_year=2026,
                book_type="PRINTED", available_stock=1)
    db_session.add(book)
    db_session.commit()
    db_session.refresh(book)
    with pytest.raises(HTTPException) as e:
        svc.get_ebook(db_session, book.id)
    assert e.value.status_code == 404


def test_get_ebook_success(db_session):
    book = _make_ebook_book(db_session)
    result = svc.get_ebook(db_session, book.id)
    assert result.id == book.id


# ---------------------------------------------------------------- pdf_preview

def test_pdf_preview_free_book_returns_full_file(db_session):
    book = _make_ebook_book(db_session, is_free=True)
    data = svc.pdf_preview(book)
    full_path = svc.resolve_private_pdf(REAL_PDF)
    assert data == full_path.read_bytes()


def test_pdf_preview_paid_book_truncates_pages(db_session):
    book = _make_ebook_book(db_session, is_free=False, preview_pages=1)
    data = svc.pdf_preview(book)
    reader = PdfReader(__import__("io").BytesIO(data))
    assert len(reader.pages) == 1


# ---------------------------------------------------------------- make_read_token

def test_make_read_token_roundtrip(db_session):
    user = _make_reader(db_session, user_code="EB0001")
    book = _make_ebook_book(db_session)
    loan = Loan(user_code=user.user_code, book_id=book.id, loan_type="EBOOK", loan_status="BORROWED",
                borrow_date=svc.utcnow(), due_date=svc.utcnow() + timedelta(days=5))
    db_session.add(loan)
    db_session.commit()
    db_session.refresh(loan)

    token = svc.make_read_token(loan, user.user_code)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == user.user_code and payload["book_id"] == book.id and payload["scope"] == "ebook_read"


# ---------------------------------------------------------------- borrow

def test_borrow_user_not_found(db_session):
    book = _make_ebook_book(db_session)
    with pytest.raises(HTTPException) as e:
        svc.borrow(db_session, "NO-SUCH-USER", book.id)
    assert e.value.status_code == 404


def test_borrow_returns_existing_active_loan_without_duplicating(db_session):
    user = _make_reader(db_session, user_code="EB0002")
    book = _make_ebook_book(db_session)
    first = svc.borrow(db_session, user.user_code, book.id)
    second = svc.borrow(db_session, user.user_code, book.id)
    assert first.id == second.id
    assert db_session.query(Loan).filter_by(user_code=user.user_code, book_id=book.id).count() == 1


def test_borrow_rejects_blocked_account(db_session):
    user = _make_reader(db_session, user_code="EB0003", is_borrowing_blocked=True)
    book = _make_ebook_book(db_session)
    with pytest.raises(HTTPException) as e:
        svc.borrow(db_session, user.user_code, book.id)
    assert e.value.status_code == 403


def test_borrow_rejects_when_over_limit(db_session):
    user = _make_reader(db_session, user_code="EB0004", max_borrow_limit=1)
    book1 = _make_ebook_book(db_session)
    svc.borrow(db_session, user.user_code, book1.id)
    book2 = _make_ebook_book(db_session)
    with pytest.raises(HTTPException) as e:
        svc.borrow(db_session, user.user_code, book2.id)
    assert e.value.status_code == 409


def test_borrow_success_sets_due_date_and_token(db_session):
    user = _make_reader(db_session, user_code="EB0005")
    book = _make_ebook_book(db_session, borrow_days=7)
    loan = svc.borrow(db_session, user.user_code, book.id)
    assert loan.loan_status == "BORROWED"
    assert loan.ebook_access_token is not None
    assert (loan.due_date - loan.borrow_date) == timedelta(days=7)


# ---------------------------------------------------------------- authorized_file

def test_authorized_file_rejects_invalid_token(db_session):
    with pytest.raises(HTTPException) as e:
        svc.authorized_file(db_session, "EB0006", 1, "not-a-real-jwt")
    assert e.value.status_code == 403


def test_authorized_file_rejects_token_for_other_user(db_session):
    user = _make_reader(db_session, user_code="EB0007")
    book = _make_ebook_book(db_session)
    loan = svc.borrow(db_session, user.user_code, book.id)
    token = svc.make_read_token(loan, user.user_code)
    with pytest.raises(HTTPException) as e:
        svc.authorized_file(db_session, "SOMEONE-ELSE", book.id, token)
    assert e.value.status_code == 403


def test_authorized_file_rejects_returned_loan(db_session):
    user = _make_reader(db_session, user_code="EB0008")
    book = _make_ebook_book(db_session)
    loan = svc.borrow(db_session, user.user_code, book.id)
    token = svc.make_read_token(loan, user.user_code)
    svc.return_ebook(db_session, user.user_code, loan.id)
    with pytest.raises(HTTPException) as e:
        svc.authorized_file(db_session, user.user_code, book.id, token)
    assert e.value.status_code == 403


def test_authorized_file_success_resolves_path(db_session):
    user = _make_reader(db_session, user_code="EB0009")
    book = _make_ebook_book(db_session)
    loan = svc.borrow(db_session, user.user_code, book.id)
    token = svc.make_read_token(loan, user.user_code)
    path = svc.authorized_file(db_session, user.user_code, book.id, token)
    assert path.name == "ebook-001.pdf"


# ---------------------------------------------------------------- return_ebook

def test_return_ebook_not_found(db_session):
    with pytest.raises(HTTPException) as e:
        svc.return_ebook(db_session, "EB0010", 999999)
    assert e.value.status_code == 404


def test_return_ebook_rejects_already_closed(db_session):
    user = _make_reader(db_session, user_code="EB0011")
    book = _make_ebook_book(db_session)
    loan = svc.borrow(db_session, user.user_code, book.id)
    svc.return_ebook(db_session, user.user_code, loan.id)
    with pytest.raises(HTTPException) as e:
        svc.return_ebook(db_session, user.user_code, loan.id)
    assert e.value.status_code == 409


def test_return_ebook_success_clears_token(db_session):
    user = _make_reader(db_session, user_code="EB0012")
    book = _make_ebook_book(db_session)
    loan = svc.borrow(db_session, user.user_code, book.id)
    result = svc.return_ebook(db_session, user.user_code, loan.id)
    assert result.loan_status == "RETURNED"
    assert result.ebook_access_token is None
