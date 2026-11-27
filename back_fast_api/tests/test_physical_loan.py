"""3-01.a: Loan Engine — mượn sách vật lý và chốt chặn hạn mức (POST /api/loans/physical/request)."""
from datetime import datetime, timedelta
from decimal import Decimal

from app.core.security import create_access_token, hash_password
from app.models.book import Book
from app.models.loan import Loan
from app.models.user import Account, User
from app.services.loan_service import run_pickup_expiry_job


def _make_reader(db_session, *, user_code, max_borrow_limit=3, is_borrowing_blocked=False, total_fines=0):
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
        full_name="Physical Loan Tester",
        email=f"{user_code.lower()}@library.local",
        department="Khoa Công nghệ thông tin",
        user_type="STUDENT",
        max_borrow_limit=max_borrow_limit,
        max_borrow_days=14,
        is_borrowing_blocked=is_borrowing_blocked,
        total_fines=Decimal(str(total_fines)),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token({"sub": str(account.id), "role": "STUDENT"})
    return user, {"Authorization": f"Bearer {token}"}


def _make_book(db_session, *, available_stock=1, book_type="PRINTED", title="Physical Loan Test Book"):
    book = Book(
        title=title,
        author="Tester",
        publisher="QA",
        publication_year=2026,
        book_type=book_type,
        available_stock=available_stock,
    )
    db_session.add(book)
    db_session.commit()
    db_session.refresh(book)
    return book


def test_request_physical_loan_success_decrements_stock(client, db_session):
    _, headers = _make_reader(db_session, user_code="PL0001")
    book = _make_book(db_session, available_stock=2)

    response = client.post(
        "/api/loans/physical/request", json={"book_id": book.id}, headers=headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["loan_status"] == "PENDING_PICKUP"
    assert data["loan_code"].startswith("PM-")
    assert data["pickup_deadline"] is not None

    db_session.refresh(book)
    assert book.available_stock == 1


def test_request_physical_loan_blocked_account_returns_403(client, db_session):
    _, headers = _make_reader(db_session, user_code="PL0002", is_borrowing_blocked=True)
    book = _make_book(db_session, available_stock=1)

    response = client.post(
        "/api/loans/physical/request", json={"book_id": book.id}, headers=headers
    )
    assert response.status_code == 403


def test_request_physical_loan_with_unpaid_fine_returns_403(client, db_session):
    _, headers = _make_reader(db_session, user_code="PL0003", total_fines=5000)
    book = _make_book(db_session, available_stock=1)

    response = client.post(
        "/api/loans/physical/request", json={"book_id": book.id}, headers=headers
    )
    assert response.status_code == 403


def test_request_physical_loan_out_of_stock_returns_409(client, db_session):
    _, headers = _make_reader(db_session, user_code="PL0004")
    book = _make_book(db_session, available_stock=0)

    response = client.post(
        "/api/loans/physical/request", json={"book_id": book.id}, headers=headers
    )
    assert response.status_code == 409


def test_request_physical_loan_over_limit_returns_403(client, db_session):
    user, headers = _make_reader(db_session, user_code="PL0005", max_borrow_limit=1)
    book_a = _make_book(db_session, available_stock=1, title="Book A")
    book_b = _make_book(db_session, available_stock=1, title="Book B")

    first = client.post(
        "/api/loans/physical/request", json={"book_id": book_a.id}, headers=headers
    )
    assert first.status_code == 201

    second = client.post(
        "/api/loans/physical/request", json={"book_id": book_b.id}, headers=headers
    )
    assert second.status_code == 403  # SRS UC05 E2
    assert "đang mượn 1/tối đa 1" in second.json()["detail"]


def test_request_physical_loan_duplicate_same_book_returns_409(client, db_session):
    _, headers = _make_reader(db_session, user_code="PL0006", max_borrow_limit=3)
    book = _make_book(db_session, available_stock=5)

    first = client.post(
        "/api/loans/physical/request", json={"book_id": book.id}, headers=headers
    )
    assert first.status_code == 201

    second = client.post(
        "/api/loans/physical/request", json={"book_id": book.id}, headers=headers
    )
    assert second.status_code == 409


def test_request_physical_loan_rejects_ebook(client, db_session):
    _, headers = _make_reader(db_session, user_code="PL0007")
    book = _make_book(db_session, available_stock=1, book_type="EBOOK")

    response = client.post(
        "/api/loans/physical/request", json={"book_id": book.id}, headers=headers
    )
    assert response.status_code == 409


def test_request_physical_loan_unknown_book_returns_404(client, auth_headers):
    response = client.post(
        "/api/loans/physical/request", json={"book_id": 999999}, headers=auth_headers
    )
    assert response.status_code == 404


def test_pickup_expiry_job_cancels_and_restores_stock(db_session):
    user, _ = _make_reader(db_session, user_code="PL0008")
    book = _make_book(db_session, available_stock=1)

    past = datetime.now() - timedelta(hours=1)
    loan = Loan(
        user_code=user.user_code,
        book_id=book.id,
        loan_type="PHYSICAL",
        loan_status="PENDING_PICKUP",
        loan_code="PM-TEST-EXPIRED",
        borrow_date=past - timedelta(hours=24),
        due_date=past + timedelta(days=14),
        pickup_deadline=past,
    )
    db_session.add(loan)
    book.available_stock = 0
    db_session.commit()
    db_session.refresh(loan)
    loan_id, book_id = loan.id, book.id

    result = run_pickup_expiry_job(session_factory=lambda: db_session, now=datetime.now())
    assert result["cancelled"] == 1
    assert result["errors"] == []

    # run_pickup_expiry_job closes/reopens its own session scope per record, which
    # detaches every object db_session was tracking (not just `loan`/`book`) — use
    # the ids captured above instead of touching attributes on those instances.
    reloaded_loan = db_session.get(Loan, loan_id)
    reloaded_book = db_session.get(Book, book_id)
    assert reloaded_loan.loan_status == "CANCELLED"
    assert reloaded_book.available_stock == 1
