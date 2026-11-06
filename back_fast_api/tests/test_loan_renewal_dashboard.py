"""3-02 (gia hạn UC06) và 3-08 (my-loans / my-history / my-fines)."""
from datetime import datetime, timedelta
from decimal import Decimal

from app.core.security import create_access_token, hash_password
from app.models.book import Book
from app.models.fine import Fine
from app.models.loan import Loan, Waitlist
from app.models.user import Account, User


def _make_reader(db_session, *, user_code, total_fines=0):
    account = Account(
        username=f"reader_{user_code.lower()}",
        password=hash_password("Password123@"),
        role="STUDENT",
        is_active=True,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    user = User(
        account_id=account.id,
        user_code=user_code,
        full_name="Renewal Tester",
        email=f"{user_code.lower()}@library.local",
        department="Khoa Công nghệ thông tin",
        user_type="STUDENT",
        max_borrow_limit=3,
        max_borrow_days=14,
        total_fines=Decimal(str(total_fines)),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token({"sub": str(account.id), "role": "STUDENT"})
    return user, {"Authorization": f"Bearer {token}"}


def _make_book(db_session, *, title="Renewal Test Book"):
    book = Book(
        title=title, author="Tester", publisher="QA", publication_year=2026,
        book_type="PRINTED", available_stock=1,
    )
    db_session.add(book)
    db_session.commit()
    db_session.refresh(book)
    return book


def _make_loan(db_session, user, book, *, hours_until_due=48, renewal_count=0,
               loan_status="BORROWED"):
    now = datetime.now()
    loan = Loan(
        user_code=user.user_code, book_id=book.id, loan_type="PHYSICAL",
        loan_status=loan_status, borrow_date=now - timedelta(days=1),
        due_date=now + timedelta(hours=hours_until_due), renewal_count=renewal_count,
    )
    db_session.add(loan)
    db_session.commit()
    db_session.refresh(loan)
    return loan


def test_renew_success_extends_due_date(client, db_session):
    user, headers = _make_reader(db_session, user_code="RN0001")
    book = _make_book(db_session)
    loan = _make_loan(db_session, user, book)
    old_due = loan.due_date

    response = client.post(f"/api/loans/{loan.id}/renew", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["renewal_count"] == 1

    db_session.refresh(loan)
    assert loan.due_date == old_due + timedelta(days=3)


def test_renew_twice_returns_409(client, db_session):
    user, headers = _make_reader(db_session, user_code="RN0002")
    book = _make_book(db_session)
    loan = _make_loan(db_session, user, book, renewal_count=1)

    response = client.post(f"/api/loans/{loan.id}/renew", headers=headers)
    assert response.status_code == 409


def test_renew_with_unpaid_fine_returns_403(client, db_session):
    user, headers = _make_reader(db_session, user_code="RN0003", total_fines=5000)
    book = _make_book(db_session)
    loan = _make_loan(db_session, user, book)

    response = client.post(f"/api/loans/{loan.id}/renew", headers=headers)
    assert response.status_code == 403


def test_renew_within_6_hours_of_due_returns_409(client, db_session):
    user, headers = _make_reader(db_session, user_code="RN0004")
    book = _make_book(db_session)
    loan = _make_loan(db_session, user, book, hours_until_due=5)

    response = client.post(f"/api/loans/{loan.id}/renew", headers=headers)
    assert response.status_code == 409


def test_renew_with_active_waitlist_returns_409(client, db_session):
    user, headers = _make_reader(db_session, user_code="RN0005")
    book = _make_book(db_session)
    loan = _make_loan(db_session, user, book)

    other, _ = _make_reader(db_session, user_code="RN0005W")
    db_session.add(Waitlist(user_code=other.user_code, book_id=book.id,
                            queue_position=1, status="WAITING"))
    db_session.commit()

    response = client.post(f"/api/loans/{loan.id}/renew", headers=headers)
    assert response.status_code == 409


def test_renew_other_users_loan_returns_403(client, db_session):
    owner, _ = _make_reader(db_session, user_code="RN0006")
    _, intruder_headers = _make_reader(db_session, user_code="RN0006X")
    book = _make_book(db_session)
    loan = _make_loan(db_session, owner, book)

    response = client.post(f"/api/loans/{loan.id}/renew", headers=intruder_headers)
    assert response.status_code == 403


def test_my_loans_only_lists_open_loans(client, db_session):
    user, headers = _make_reader(db_session, user_code="RN0007")
    book_a = _make_book(db_session, title="Open Loan Book")
    book_b = _make_book(db_session, title="Returned Book")
    _make_loan(db_session, user, book_a, loan_status="BORROWED")
    _make_loan(db_session, user, book_b, loan_status="RETURNED")

    response = client.get("/api/loans/my-loans", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["data"][0]["book_title"] == "Open Loan Book"


def test_my_history_only_lists_closed_loans(client, db_session):
    user, headers = _make_reader(db_session, user_code="RN0008")
    book_a = _make_book(db_session, title="Open Loan Book 2")
    book_b = _make_book(db_session, title="Returned Book 2")
    _make_loan(db_session, user, book_a, loan_status="BORROWED")
    _make_loan(db_session, user, book_b, loan_status="RETURNED")

    response = client.get("/api/loans/my-history", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["data"][0]["book_title"] == "Returned Book 2"


def test_my_fines_matches_total_fines(client, db_session):
    user, headers = _make_reader(db_session, user_code="RN0009", total_fines=15000)
    book = _make_book(db_session, title="Overdue Book")
    loan = _make_loan(db_session, user, book, loan_status="OVERDUE")
    db_session.add(Fine(loan_id=loan.id, user_code=user.user_code, overdue_days=3,
                        fine_rate=Decimal("5000"), total_amount=Decimal("15000"),
                        payment_status="UNPAID"))
    db_session.commit()

    response = client.get("/api/fines/my-fines", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert Decimal(str(data["total_fines"])) == Decimal("15000")
    assert data["unpaid_count"] == 1
