"""Sprint 4 (Task 4-22): Kiểm thử pytest cho báo mất/hỏng và bồi thường (Incident Service & API)."""
from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
import pytest
from fastapi import HTTPException

from app.models.book import Book, BookCopy
from app.models.fine import Fine
from app.models.loan import Incident, Loan
from app.models.user import Account, User
from app.services import incident_service as svc
from app.core.security import create_access_token, hash_password


def _make_admin_headers(db_session):
    account = Account(
        username="admin_incident",
        password=hash_password("AdminPass123@"),
        role="ADMIN",
        is_active=True,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    user = User(
        account_id=account.id,
        user_code="ADMIN_INC",
        full_name="Thủ thư Test Sự Cố",
        email="admin_inc@library.local",
        department="Thư viện",
        user_type="ADMIN",
        max_borrow_limit=0,
        max_borrow_days=0,
    )
    db_session.add(user)
    db_session.commit()

    token = create_access_token({"sub": str(account.id), "role": "ADMIN"})
    return {"Authorization": f"Bearer {token}"}


def _make_book_with_copy(db_session, price=120_000, barcode="BC-INC-001"):
    book = Book(
        title="Giáo trình An toàn thông tin",
        author="TS. Nguyen Van A",
        publisher="NXB TDTU",
        publication_year=2025,
        price=price,
        book_type="PRINTED",
        available_stock=3,
    )
    db_session.add(book)
    db_session.commit()
    db_session.refresh(book)

    copy = BookCopy(
        copy_barcode=barcode,
        book_id=book.id,
        zone="A",
        floor="2",
        shelf="K1",
        status="AVAILABLE",
    )
    db_session.add(copy)
    db_session.commit()
    db_session.refresh(copy)
    return book, copy


def _make_active_loan(db_session, user_code, book_id, copy_barcode, overdue_days=0):
    now = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).replace(tzinfo=None)
    borrow_date = now - timedelta(days=14 + overdue_days)
    due_date = now - timedelta(days=overdue_days)

    status = "OVERDUE" if overdue_days > 0 else "BORROWED"
    loan = Loan(
        user_code=user_code,
        book_id=book_id,
        copy_barcode=copy_barcode,
        loan_type="PHYSICAL",
        loan_status=status,
        loan_code=f"PM-INC-{copy_barcode}",
        borrow_date=borrow_date,
        due_date=due_date,
    )
    db_session.add(loan)
    db_session.commit()
    db_session.refresh(loan)
    return loan


def test_record_incident_book_lost_with_overdue(db_session, test_account):
    user = db_session.query(User).filter_by(account_id=test_account.id).first()
    book, copy = _make_book_with_copy(db_session, price=100_000, barcode="BC-LOST-01")
    loan = _make_active_loan(db_session, user.user_code, book.id, copy.copy_barcode, overdue_days=3)

    # 3 ngày quá hạn = 3 * 5,000 = 15,000đ; giá sách = 100,000đ -> tổng phạt = 115,000đ
    result = svc.record_incident(db_session, loan.id, "BOOK_LOST", "Bị mất sách trong giờ thực hành")
    db_session.commit()

    assert result["type"] == "BOOK_LOST"
    assert Decimal(result["penalty_amount"]) == Decimal("115000")
    assert result["loan_status"] == "LOST"

    db_session.refresh(loan)
    db_session.refresh(copy)
    db_session.refresh(user)

    assert loan.loan_status == "LOST"
    assert loan.return_date is not None
    assert copy.status == "RETIRED"
    assert user.is_borrowing_blocked is True
    assert Decimal(user.total_fines) == Decimal("115000")

    fine = db_session.query(Fine).filter_by(loan_id=loan.id).first()
    assert fine is not None
    assert fine.payment_status == "UNPAID"
    assert Decimal(fine.total_amount) == Decimal("115000")


def test_record_incident_book_damaged_in_time(db_session, test_account):
    user = db_session.query(User).filter_by(account_id=test_account.id).first()
    book, copy = _make_book_with_copy(db_session, price=80_000, barcode="BC-DMG-01")
    loan = _make_active_loan(db_session, user.user_code, book.id, copy.copy_barcode, overdue_days=0)

    result = svc.record_incident(db_session, loan.id, "BOOK_DAMAGED", "Rách 5 trang và ướt bìa")
    db_session.commit()

    assert result["type"] == "BOOK_DAMAGED"
    assert Decimal(result["penalty_amount"]) == Decimal("80000")
    assert result["loan_status"] == "RETURNED"

    db_session.refresh(copy)
    assert copy.status == "RETIRED"
    assert copy.damage_notes == "Rách 5 trang và ướt bìa"


def test_record_incident_book_zero_price_requires_manual_penalty(db_session, test_account):
    user = db_session.query(User).filter_by(account_id=test_account.id).first()
    book, copy = _make_book_with_copy(db_session, price=0, barcode="BC-ZERO-01")
    loan = _make_active_loan(db_session, user.user_code, book.id, copy.copy_barcode, overdue_days=0)

    # Thiếu manual penalty -> 422
    with pytest.raises(HTTPException) as exc:
        svc.record_incident(db_session, loan.id, "BOOK_LOST", "Mất sách không giá bìa")
    assert exc.value.status_code == 422
    assert "Sách thiếu giá bìa" in exc.value.detail

    # Nhập manual penalty hợp lệ -> thành công
    res = svc.record_incident(
        db_session,
        loan.id,
        "BOOK_LOST",
        "Mất sách không giá bìa",
        manual_penalty=Decimal("95000"),
        manual_reason="Bồi thường theo thỏa thuận hội đồng thư viện",
    )
    db_session.commit()
    assert Decimal(res["penalty_amount"]) == Decimal("95000")


def test_record_incident_invalid_state_and_duplicates(db_session, test_account):
    user = db_session.query(User).filter_by(account_id=test_account.id).first()
    book, copy = _make_book_with_copy(db_session, price=50_000, barcode="BC-ERR-01")
    loan = _make_active_loan(db_session, user.user_code, book.id, copy.copy_barcode, overdue_days=0)

    # Sai loại sự cố -> 422
    with pytest.raises(HTTPException) as exc:
        svc.record_incident(db_session, loan.id, "INVALID_TYPE", "Không hợp lệ")
    assert exc.value.status_code == 422

    # Lập sự cố lần đầu thành công
    svc.record_incident(db_session, loan.id, "BOOK_LOST", "Mất sách")
    db_session.commit()

    # Lập trùng sự cố cho cùng phiếu mượn -> 409
    with pytest.raises(HTTPException) as exc2:
        svc.record_incident(db_session, loan.id, "BOOK_LOST", "Mất lại lần 2")
    assert exc2.value.status_code == 409


def test_admin_incident_router_endpoints(client, db_session, test_account):
    user = db_session.query(User).filter_by(account_id=test_account.id).first()
    book, copy = _make_book_with_copy(db_session, price=150_000, barcode="BC-ROUTER-01")
    loan = _make_active_loan(db_session, user.user_code, book.id, copy.copy_barcode, overdue_days=1)
    admin_headers = _make_admin_headers(db_session)

    # Gọi POST /api/admin/loans/incident
    payload = {
        "loan_id": loan.id,
        "incident_type": "BOOK_LOST",
        "description": "Bạn đọc báo mất sách tại quầy",
    }
    r = client.post("/api/admin/loans/incident", json=payload, headers=admin_headers)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["type"] == "BOOK_LOST"
    # 1 ngày quá hạn (5k) + 150k giá bìa = 155k
    assert Decimal(data["penalty_amount"]) == Decimal("155000")

    # Gọi GET /api/admin/incidents
    r_list = client.get("/api/admin/incidents", headers=admin_headers)
    assert r_list.status_code == 200
    res_json = r_list.json()
    assert len(res_json["data"]) >= 1
    assert res_json["data"][0]["user_code"] == user.user_code

