"""Regression: a logical hold must block checkout by a different reader."""
from datetime import datetime, timedelta
from fastapi import BackgroundTasks, HTTPException
import pytest
from app.models.book import Book, BookCopy
from app.models.loan import Loan, Waitlist
from app.services.loan_service import checkout_at_counter_service


def setup_case(db_session, test_account):
    from app.models.user import Account, User
    other = Account(username="hold_owner_3010", password="unused", role="STUDENT", is_active=True)
    db_session.add(other)
    db_session.flush()
    holder = User(
    user_code="HOLDER-3010",
    account_id=other.id,
    full_name="Hold Owner",
    email="hold3010@library.local",
    department="Library",
    user_type="STUDENT",
    is_borrowing_blocked=False,
    total_fines=0,
    max_borrow_limit=3,
    max_borrow_days=14
)
    book = Book(title="Checkout reservation test", author="Author", publisher="Publisher",
                publication_year=2026, book_type="PHYSICAL", available_stock=1)
    db_session.add_all([holder, book]); db_session.flush()
    copy = BookCopy(copy_barcode="HOLD-BARCODE-3010", book_id=book.id, zone="A", floor="1", shelf="1", status="AVAILABLE")
    loan = Loan(user_code="SV2026001", book_id=book.id, loan_type="PHYSICAL", loan_status="REQUESTED",
                borrow_date=datetime.utcnow(), due_date=datetime.utcnow()+timedelta(days=14))
    hold = Waitlist(user_code=holder.user_code, book_id=book.id, queue_position=1, status="HELD",
                    hold_expires_at=datetime.utcnow()+timedelta(hours=24))
    db_session.add_all([copy,loan,hold]); db_session.flush()
    return book, copy, loan, hold


def test_checkout_cannot_take_someone_elses_hold(db_session, test_account):
    book, copy, loan, hold = setup_case(db_session, test_account)
    with pytest.raises(HTTPException) as exc:
        checkout_at_counter_service(db_session, BackgroundTasks(), copy.copy_barcode, loan_id=loan.id)
    assert exc.value.status_code == 409
    db_session.refresh(loan); db_session.refresh(copy); db_session.refresh(book)
    assert loan.loan_status == "REQUESTED"
    assert copy.status == "AVAILABLE"
    assert book.available_stock == 1
    assert db_session.get(Waitlist, hold.id) is not None


def test_checkout_hold_owner_consumes_reservation(db_session, test_account):
    book, copy, loan, hold = setup_case(db_session, test_account)
    loan.user_code = hold.user_code
    db_session.flush()
    hold_id = hold.id
    result = checkout_at_counter_service(db_session, BackgroundTasks(), copy.copy_barcode, loan_id=loan.id)
    assert result.loan_status == "BORROWED"
    db_session.refresh(book); db_session.refresh(copy)
    assert book.available_stock == 0
    assert copy.status == "BORROWED"
    assert db_session.get(Waitlist, hold_id) is None
