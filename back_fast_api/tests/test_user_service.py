"""3-08: API hồ sơ cá nhân & bảng điều khiển/lịch sử — user_service.py."""
from datetime import datetime, timedelta
from decimal import Decimal

from app.core.security import hash_password
from app.models.book import Book
from app.models.fine import Fine
from app.models.loan import Loan
from app.models.user import Account, User
from app.services import user_service as svc


def _make_reader(db_session, *, user_code, max_borrow_limit=3, total_fines=0, role="STUDENT"):
    account = Account(username=f"us_{user_code.lower()}", password=hash_password("Password123@"),
                      role=role, is_active=True)
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    user = User(account_id=account.id, user_code=user_code, full_name="User Service Tester",
                email=f"{user_code.lower()}@library.local", department="CNTT", user_type="STUDENT",
                max_borrow_limit=max_borrow_limit, max_borrow_days=14, total_fines=Decimal(str(total_fines)))
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _make_book(db_session, title="Dashboard Book"):
    book = Book(title=title, author="Tester", publisher="QA", publication_year=2026,
                book_type="PRINTED", available_stock=1)
    db_session.add(book)
    db_session.commit()
    db_session.refresh(book)
    return book


def _make_loan(db_session, *, user_code, book_id, loan_status="BORROWED", due_date=None,
               return_date=None, borrow_date=None):
    loan = Loan(user_code=user_code, book_id=book_id, loan_type="PHYSICAL", loan_status=loan_status,
                borrow_date=borrow_date or datetime.now(), due_date=due_date or datetime.now() + timedelta(days=14),
                return_date=return_date)
    db_session.add(loan)
    db_session.commit()
    db_session.refresh(loan)
    return loan


# ---------------------------------------------------------------- get_user_profile

def test_get_user_profile_formats_borrow_limit_and_role(db_session):
    user = _make_reader(db_session, user_code="US0001", max_borrow_limit=3, total_fines=15000, role="LECTURER")
    book = _make_book(db_session)
    _make_loan(db_session, user_code=user.user_code, book_id=book.id)  # đang mượn, chưa trả

    profile = svc.get_user_profile(db_session, user)
    assert profile["borrow_limit"] == "1/3"
    assert profile["role"] == "LECTURER"
    assert profile["total_fines"] == Decimal(15000)
    assert profile["user_code"] == "US0001"


def test_get_user_profile_zero_borrowing(db_session):
    user = _make_reader(db_session, user_code="US0002")
    profile = svc.get_user_profile(db_session, user)
    assert profile["borrow_limit"] == "0/3"


# ---------------------------------------------------------------- get_user_dashboard

def test_dashboard_empty_when_no_loans(db_session):
    user = _make_reader(db_session, user_code="US0003")
    result = svc.get_user_dashboard(db_session, user)
    assert result == {"total_borrowing": 0, "total_overdue": 0, "total_fines": Decimal(0),
                      "current_loans": [], "recent_history": []}


def test_dashboard_counts_overdue_by_due_date(db_session):
    user = _make_reader(db_session, user_code="US0004")
    book = _make_book(db_session)
    _make_loan(db_session, user_code=user.user_code, book_id=book.id,
              due_date=datetime.now() - timedelta(days=2))
    result = svc.get_user_dashboard(db_session, user)
    assert result["total_borrowing"] == 1
    assert result["total_overdue"] == 1
    assert result["current_loans"][0]["is_overdue"] is True


def test_dashboard_counts_overdue_by_status_even_before_due(db_session):
    user = _make_reader(db_session, user_code="US0005")
    book = _make_book(db_session)
    _make_loan(db_session, user_code=user.user_code, book_id=book.id, loan_status="OVERDUE",
              due_date=datetime.now() + timedelta(days=1))
    result = svc.get_user_dashboard(db_session, user)
    assert result["total_overdue"] == 1


def test_dashboard_excludes_returned_loans_from_current(db_session):
    user = _make_reader(db_session, user_code="US0006")
    book = _make_book(db_session)
    _make_loan(db_session, user_code=user.user_code, book_id=book.id, loan_status="RETURNED",
              return_date=datetime.now())
    result = svc.get_user_dashboard(db_session, user)
    assert result["total_borrowing"] == 0
    assert len(result["recent_history"]) == 1


def test_dashboard_includes_fine_info_when_present(db_session):
    user = _make_reader(db_session, user_code="US0007")
    book = _make_book(db_session)
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id, loan_status="RETURNED",
                      return_date=datetime.now())
    db_session.add(Fine(loan_id=loan.id, user_code=user.user_code, overdue_days=2,
                        fine_rate=Decimal(5000), total_amount=Decimal(10000), payment_status="UNPAID"))
    db_session.commit()

    result = svc.get_user_dashboard(db_session, user)
    item = result["recent_history"][0]
    assert item["fine_amount"] == Decimal(10000)
    assert item["fine_status"] == "UNPAID"


def test_dashboard_history_limited_to_10_most_recent(db_session):
    user = _make_reader(db_session, user_code="US0008")
    book = _make_book(db_session)
    for i in range(12):
        _make_loan(db_session, user_code=user.user_code, book_id=book.id, loan_status="RETURNED",
                  return_date=datetime.now(), borrow_date=datetime.now() - timedelta(days=i))
    result = svc.get_user_dashboard(db_session, user)
    assert len(result["recent_history"]) == 10
