"""Bổ sung coverage cho loan_service.py: tra cứu, gia hạn (UC06), check-in tại quầy
(BR-04/BR-13/BR-21), thu phạt tại quầy (UC10/BR-34), và mượn trực tiếp tại quầy
(TRƯỜNG HỢP B — không đăng ký trước). Đọc kỹ docstring + rule trong loan_service.py
trước khi viết, không đoán nghiệp vụ."""
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import BackgroundTasks, HTTPException

from app.core.security import create_access_token, hash_password
from app.models.book import Book, BookCopy
from app.models.fine import Fine, FinePayment
from app.models.loan import Loan, Waitlist
from app.models.user import Account, User
from app.services import loan_service as svc


def _make_reader(db_session, *, user_code, max_borrow_limit=3, max_borrow_days=14,
                 is_borrowing_blocked=False, total_fines=0, user_type="STUDENT"):
    account = Account(username=f"reader_{user_code.lower()}", password=hash_password("Password123@"),
                      role="STUDENT", is_active=True)
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    user = User(account_id=account.id, user_code=user_code, full_name="Loan Counter Tester",
                email=f"{user_code.lower()}@library.local", department="CNTT", user_type=user_type,
                max_borrow_limit=max_borrow_limit, max_borrow_days=max_borrow_days,
                is_borrowing_blocked=is_borrowing_blocked, total_fines=Decimal(str(total_fines)))
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _make_book(db_session, *, available_stock=1, price=100_000, title="Counter Test Book"):
    book = Book(title=title, author="Tester", publisher="QA", publication_year=2026,
                price=price, book_type="PRINTED", available_stock=available_stock)
    db_session.add(book)
    db_session.commit()
    db_session.refresh(book)
    return book


def _make_copy(db_session, book, barcode="BC-CT-0001", status="AVAILABLE"):
    copy = BookCopy(copy_barcode=barcode, book_id=book.id, zone="A", floor="1", shelf="1", status=status)
    db_session.add(copy)
    db_session.commit()
    db_session.refresh(copy)
    return copy


def _make_loan(db_session, *, user_code, book_id, copy_barcode=None, loan_status="BORROWED",
               due_date=None, renewal_count=0, loan_code=None):
    now = datetime.now()
    loan = Loan(user_code=user_code, book_id=book_id, copy_barcode=copy_barcode,
                loan_type="PHYSICAL", loan_status=loan_status, loan_code=loan_code,
                borrow_date=now, due_date=due_date or now + timedelta(days=14),
                renewal_count=renewal_count)
    db_session.add(loan)
    db_session.commit()
    db_session.refresh(loan)
    return loan


def _tasks():
    return BackgroundTasks()


# ---------------------------------------------------------------- lookup_loans_service

def test_lookup_loans_by_numeric_loan_id(db_session):
    user = _make_reader(db_session, user_code="CT0001")
    book = _make_book(db_session)
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id)
    results = svc.lookup_loans_service(db_session, str(loan.id))
    assert len(results) == 1 and results[0].id == loan.id


def test_lookup_loans_by_partial_user_code(db_session):
    user = _make_reader(db_session, user_code="CTABC1")
    book = _make_book(db_session)
    _make_loan(db_session, user_code=user.user_code, book_id=book.id)
    results = svc.lookup_loans_service(db_session, "CTABC")
    assert len(results) == 1 and results[0].user_code == "CTABC1"


def test_lookup_loans_by_copy_barcode(db_session):
    user = _make_reader(db_session, user_code="CTBAR1")
    book = _make_book(db_session, title="Sách barcode lookup")
    copy = _make_copy(db_session, book, barcode="BC-CT-LOOKUP-1", status="BORROWED")
    loan = _make_loan(
        db_session,
        user_code=user.user_code,
        book_id=book.id,
        copy_barcode=copy.copy_barcode,
        loan_status="OVERDUE",
    )
    results = svc.lookup_loans_service(db_session, "bc-ct-lookup-1")
    assert len(results) == 1
    assert results[0].id == loan.id
    assert results[0].copy_barcode == "BC-CT-LOOKUP-1"


def test_lookup_loans_by_loan_code(db_session):
    user = _make_reader(db_session, user_code="CTCODE1")
    book = _make_book(db_session)
    loan = _make_loan(
        db_session,
        user_code=user.user_code,
        book_id=book.id,
        loan_status="BORROWED",
        loan_code="PM-2026-LOOKUP1",
    )
    results = svc.lookup_loans_service(db_session, "pm-2026-lookup1")
    assert len(results) == 1 and results[0].id == loan.id
    reader = svc.lookup_reader_service(db_session, "PM-2026-LOOKUP1")
    assert reader is not None and reader.user_code == "CTCODE1"


def test_lookup_reader_by_user_code_ignores_case(db_session):
    user = _make_reader(db_session, user_code="CTABC2", total_fines=25_000, is_borrowing_blocked=True)
    found = svc.lookup_reader_service(db_session, "ctabc2")
    assert found is not None
    assert found.user_code == user.user_code
    assert found.is_borrowing_blocked is True
    assert svc.lookup_reader_service(db_session, "KHONG-CO") is None


def test_checkout_copy_by_barcode(db_session):
    book = _make_book(db_session, title="Sách xuất quầy")
    copy = _make_copy(db_session, book, barcode="BC-CT-OUT-1", status="AVAILABLE")
    found = svc.get_checkout_copy_service(db_session, "bc-ct-out-1")
    assert found["copy_barcode"] == copy.copy_barcode
    assert found["book_id"] == book.id
    assert found["status"] == "AVAILABLE"
    assert found["book_title"] == "Sách xuất quầy"


def test_checkout_copy_loan_id_names_available_barcode(db_session):
    user = _make_reader(db_session, user_code="CTOUT2")
    book = _make_book(db_session, available_stock=1)
    _make_copy(db_session, book, barcode="BC-CT-OUT-READY", status="AVAILABLE")
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id,
                      loan_status="REQUESTED", copy_barcode=None)
    with pytest.raises(HTTPException) as raised:
        svc.get_checkout_copy_service(db_session, str(loan.id))
    assert raised.value.status_code == 409
    assert "BC-CT-OUT-READY" in raised.value.detail
    assert "mã phiếu" in raised.value.detail


def test_checkout_copy_missing_barcode(db_session):
    with pytest.raises(HTTPException) as raised:
        svc.get_checkout_copy_service(db_session, "BC-CT-OUT-NONE")
    assert raised.value.status_code == 404
    assert "BC-CT-OUT-NONE" in raised.value.detail


def test_active_return_by_barcode(db_session):
    user = _make_reader(db_session, user_code="CTRET1")
    book = _make_book(db_session, title="Sách đang mượn")
    copy = _make_copy(db_session, book, barcode="BC-CT-RET-1", status="BORROWED")
    loan = _make_loan(
        db_session,
        user_code=user.user_code,
        book_id=book.id,
        copy_barcode=copy.copy_barcode,
        due_date=datetime.now() + timedelta(days=3),
    )
    slip = svc.get_active_return_service(db_session, "BC-CT-RET-1")
    assert slip["loan_id"] == loan.id
    assert slip["full_name"] == "Loan Counter Tester"
    assert slip["book_title"] == "Sách đang mượn"
    assert slip["overdue"] is False
    with pytest.raises(HTTPException) as missing:
        svc.get_active_return_service(db_session, "BC-KHONG-CO")
    assert missing.value.status_code == 404


def test_lookup_reader_by_loan_id(db_session):
    user = _make_reader(db_session, user_code="CTABC3")
    book = _make_book(db_session)
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id)
    found = svc.lookup_reader_service(db_session, str(loan.id))
    assert found is not None and found.user_code == "CTABC3"


# ---------------------------------------------------------------- lookup_fines_service

def test_lookup_fines_not_found(db_session):
    with pytest.raises(HTTPException) as e:
        svc.lookup_fines_service(db_session, "NO-SUCH-USER")
    assert e.value.status_code == 404


def test_lookup_fines_lists_unpaid(db_session):
    user = _make_reader(db_session, user_code="CT0002", total_fines=15_000, is_borrowing_blocked=True)
    book = _make_book(db_session)
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id)
    db_session.add(Fine(loan_id=loan.id, user_code=user.user_code, overdue_days=3,
                        fine_rate=Decimal(5000), total_amount=Decimal(15000), payment_status="UNPAID"))
    db_session.commit()
    result = svc.lookup_fines_service(db_session, user.user_code)
    assert result["unpaid_count"] == 1
    assert result["is_borrowing_blocked"] is True
    assert result["fines"][0]["payment_status"] == "UNPAID"


def test_lookup_fines_include_paid_keeps_reader_default_unpaid(db_session):
    user = _make_reader(db_session, user_code="CTPAID1", total_fines=0)
    book = _make_book(db_session)
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id)
    db_session.add(Fine(loan_id=loan.id, user_code=user.user_code, overdue_days=10,
                        fine_rate=Decimal(5000), total_amount=Decimal(50000), payment_status="PAID"))
    db_session.commit()
    hidden = svc.lookup_fines_service(db_session, "ctpaid1")
    assert hidden["unpaid_count"] == 0
    assert hidden["fines"] == []
    shown = svc.lookup_fines_service(db_session, "ctpaid1", include_paid=True)
    assert shown["user_code"] == "CTPAID1"
    assert len(shown["fines"]) == 1
    assert shown["fines"][0]["payment_status"] == "PAID"
    assert shown["fines"][0]["total_amount"] == Decimal(50000)


# ---------------------------------------------------------------- renew_loan_service

def test_renew_not_found(db_session):
    _make_reader(db_session, user_code="CT0003")
    with pytest.raises(HTTPException) as e:
        svc.renew_loan_service(db_session, "CT0003", 999999)
    assert e.value.status_code == 404


def test_renew_wrong_owner(db_session):
    owner = _make_reader(db_session, user_code="CT0004")
    other = _make_reader(db_session, user_code="CT0005")
    book = _make_book(db_session)
    loan = _make_loan(db_session, user_code=owner.user_code, book_id=book.id)
    with pytest.raises(HTTPException) as e:
        svc.renew_loan_service(db_session, other.user_code, loan.id)
    assert e.value.status_code == 403


def test_renew_rejects_ebook_loan(db_session):
    user = _make_reader(db_session, user_code="CT0006")
    book = _make_book(db_session)
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id)
    loan.loan_type = "EBOOK"
    db_session.commit()
    with pytest.raises(HTTPException) as e:
        svc.renew_loan_service(db_session, user.user_code, loan.id)
    assert e.value.status_code == 409


def test_renew_rejects_wrong_status(db_session):
    user = _make_reader(db_session, user_code="CT0007")
    book = _make_book(db_session)
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id, loan_status="RETURNED")
    with pytest.raises(HTTPException) as e:
        svc.renew_loan_service(db_session, user.user_code, loan.id)
    assert e.value.status_code == 409


def test_renew_rejects_when_has_fines(db_session):
    user = _make_reader(db_session, user_code="CT0008", total_fines=5_000)
    book = _make_book(db_session)
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id)
    with pytest.raises(HTTPException) as e:
        svc.renew_loan_service(db_session, user.user_code, loan.id)
    assert e.value.status_code == 403


def test_renew_rejects_second_renewal(db_session):
    user = _make_reader(db_session, user_code="CT0009")
    book = _make_book(db_session)
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id, renewal_count=1)
    with pytest.raises(HTTPException) as e:
        svc.renew_loan_service(db_session, user.user_code, loan.id)
    assert e.value.status_code == 409


def test_renew_rejects_less_than_6h_before_due(db_session):
    user = _make_reader(db_session, user_code="CT0010")
    book = _make_book(db_session)
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id,
                      due_date=datetime.now() + timedelta(hours=2))
    with pytest.raises(HTTPException) as e:
        svc.renew_loan_service(db_session, user.user_code, loan.id)
    assert e.value.status_code == 409


def test_renew_rejects_when_someone_waiting(db_session):
    user = _make_reader(db_session, user_code="CT0011")
    waiter = _make_reader(db_session, user_code="CT0012")
    book = _make_book(db_session)
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id)
    db_session.add(Waitlist(user_code=waiter.user_code, book_id=book.id, status="WAITING", queue_position=1))
    db_session.commit()
    with pytest.raises(HTTPException) as e:
        svc.renew_loan_service(db_session, user.user_code, loan.id)
    assert e.value.status_code == 409


def test_renew_success_extends_due_date(db_session):
    user = _make_reader(db_session, user_code="CT0013")
    book = _make_book(db_session)
    original_due = datetime.now() + timedelta(days=1)
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id, due_date=original_due)
    result = svc.renew_loan_service(db_session, user.user_code, loan.id)
    assert result.renewal_count == 1
    assert (result.due_date - original_due) == timedelta(days=3)


# ---------------------------------------------------------------- checkin_at_counter_service

def test_checkin_not_found(db_session):
    with pytest.raises(HTTPException) as e:
        svc.checkin_at_counter_service(db_session, copy_barcode="NO-SUCH-BARCODE")
    assert e.value.status_code == 404


def test_checkin_normal_return_no_fine_restocks(db_session):
    user = _make_reader(db_session, user_code="CT0014")
    book = _make_book(db_session, available_stock=0)
    copy = _make_copy(db_session, book, barcode="BC-CT-0014", status="BORROWED")
    _make_loan(db_session, user_code=user.user_code, book_id=book.id, copy_barcode=copy.copy_barcode,
              due_date=datetime.now() + timedelta(days=2))

    result = svc.checkin_at_counter_service(db_session, copy_barcode=copy.copy_barcode)
    assert result["loan_status"] == "RETURNED"
    assert result["overdue_fine"] == Decimal(0)
    db_session.refresh(book)
    db_session.refresh(copy)
    assert book.available_stock == 1
    assert copy.status == "AVAILABLE"


def test_checkin_overdue_creates_fine_and_locks_account(db_session):
    user = _make_reader(db_session, user_code="CT0015")
    book = _make_book(db_session, available_stock=0)
    copy = _make_copy(db_session, book, barcode="BC-CT-0015", status="BORROWED")
    _make_loan(db_session, user_code=user.user_code, book_id=book.id, copy_barcode=copy.copy_barcode,
              loan_status="OVERDUE", due_date=datetime.utcnow() - timedelta(days=3))

    result = svc.checkin_at_counter_service(db_session, copy_barcode=copy.copy_barcode)
    assert result["overdue_fine"] == Decimal(15000)  # 3 ngày x 5.000đ (BR-13)
    db_session.refresh(user)
    assert user.total_fines == Decimal(15000)
    assert user.is_borrowing_blocked is True
    assert db_session.query(Fine).filter_by(user_code=user.user_code).count() == 1


def test_checkin_lost_delegates_to_incident_service(db_session):
    user = _make_reader(db_session, user_code="CT0016")
    book = _make_book(db_session, available_stock=0, price=80_000)
    copy = _make_copy(db_session, book, barcode="BC-CT-0016", status="BORROWED")
    _make_loan(db_session, user_code=user.user_code, book_id=book.id, copy_barcode=copy.copy_barcode)

    result = svc.checkin_at_counter_service(db_session, copy_barcode=copy.copy_barcode, is_lost=True)
    assert result["incident"] == "INCIDENT_RECORDED"
    assert result["penalty_amount"] == Decimal(80000)
    db_session.refresh(user)
    assert user.total_fines == Decimal(80000)


# ---------------------------------------------------------------- collect_counter_fines_service

def test_collect_fines_not_found(db_session):
    with pytest.raises(HTTPException) as e:
        svc.collect_counter_fines_service(db_session, "NO-SUCH-USER", Decimal(10000), "ADMIN1")
    assert e.value.status_code == 404


def test_collect_fines_rejects_when_no_debt(db_session):
    user = _make_reader(db_session, user_code="CT0017", total_fines=0)
    with pytest.raises(HTTPException) as e:
        svc.collect_counter_fines_service(db_session, user.user_code, Decimal(10000), "ADMIN1")
    assert e.value.status_code == 409


def test_collect_fines_rejects_partial_amount(db_session):
    user = _make_reader(db_session, user_code="CT0018", total_fines=20_000, is_borrowing_blocked=True)
    with pytest.raises(HTTPException) as e:
        svc.collect_counter_fines_service(db_session, user.user_code, Decimal(10000), "ADMIN1")
    assert e.value.status_code == 400


def test_collect_fines_success_unlocks_and_marks_paid(db_session):
    user = _make_reader(db_session, user_code="CT0019", total_fines=20_000, is_borrowing_blocked=True)
    book = _make_book(db_session)
    loan = _make_loan(db_session, user_code=user.user_code, book_id=book.id, loan_status="RETURNED")
    db_session.add(Fine(loan_id=loan.id, user_code=user.user_code, overdue_days=4,
                        fine_rate=Decimal(5000), total_amount=Decimal(20000), payment_status="UNPAID"))
    db_session.commit()

    result = svc.collect_counter_fines_service(db_session, user.user_code, Decimal(20000), "ADMIN1")
    assert result["warning"] is None
    db_session.refresh(user)
    assert user.total_fines == Decimal("0.00")
    assert user.is_borrowing_blocked is False
    assert db_session.query(Fine).filter_by(user_code=user.user_code, payment_status="PAID").count() == 1
    assert db_session.query(FinePayment).filter_by(user_code=user.user_code, payment_method="CASH").count() == 1


def test_collect_fines_warns_when_still_has_overdue_loan(db_session):
    user = _make_reader(db_session, user_code="CT0020", total_fines=20_000, is_borrowing_blocked=True)
    book = _make_book(db_session)
    _make_loan(db_session, user_code=user.user_code, book_id=book.id, loan_status="BORROWED",
              due_date=datetime.utcnow() - timedelta(days=1))

    result = svc.collect_counter_fines_service(db_session, user.user_code, Decimal(20000), "ADMIN1")
    assert result["warning"] is not None


# ---------------------------------------------------------------- checkout_at_counter_service: walk-in (TH B)

def test_checkout_walkin_rejects_over_limit(db_session):
    # get_user_max_borrow_limit() chốt cứng STUDENT = 3 cuốn (BR-01), bỏ qua max_borrow_limit
    # truyền tay, nên phải tạo đủ 3 phiếu đang hiệu lực mới chạm hạn mức thật.
    user = _make_reader(db_session, user_code="CT0021")
    for i in range(3):
        b = _make_book(db_session, available_stock=1, title=f"Limit Book {i}")
        _make_loan(db_session, user_code=user.user_code, book_id=b.id, loan_status="BORROWED")
    book2 = _make_book(db_session, available_stock=1, title="Second Book")
    copy2 = _make_copy(db_session, book2, barcode="BC-CT-0021")

    with pytest.raises(HTTPException) as e:
        svc.checkout_at_counter_service(db_session, _tasks(), copy_barcode=copy2.copy_barcode,
                                        user_code=user.user_code)
    assert e.value.status_code == 403


def test_checkout_walkin_rejects_duplicate_same_book(db_session):
    user = _make_reader(db_session, user_code="CT0022")
    book = _make_book(db_session, available_stock=2)
    existing_copy = _make_copy(db_session, book, barcode="BC-CT-0022A", status="BORROWED")
    _make_loan(db_session, user_code=user.user_code, book_id=book.id,
              copy_barcode=existing_copy.copy_barcode, loan_status="BORROWED")
    other_copy = _make_copy(db_session, book, barcode="BC-CT-0022B")

    with pytest.raises(HTTPException) as e:
        svc.checkout_at_counter_service(db_session, _tasks(), copy_barcode=other_copy.copy_barcode,
                                        user_code=user.user_code)
    assert e.value.status_code == 409


def test_checkout_walkin_rejects_no_stock(db_session):
    user = _make_reader(db_session, user_code="CT0023")
    book = _make_book(db_session, available_stock=0)
    copy = _make_copy(db_session, book, barcode="BC-CT-0023")

    with pytest.raises(HTTPException) as e:
        svc.checkout_at_counter_service(db_session, _tasks(), copy_barcode=copy.copy_barcode,
                                        user_code=user.user_code)
    assert e.value.status_code == 409


def test_checkout_walkin_success_creates_loan_and_removes_waitlist(db_session):
    user = _make_reader(db_session, user_code="CT0024")
    book = _make_book(db_session, available_stock=1)
    copy = _make_copy(db_session, book, barcode="BC-CT-0024")
    db_session.add(Waitlist(user_code=user.user_code, book_id=book.id, status="WAITING", queue_position=1))
    db_session.commit()

    loan = svc.checkout_at_counter_service(db_session, _tasks(), copy_barcode=copy.copy_barcode,
                                           user_code=user.user_code, condition_notes="Sách mới")
    assert loan.loan_status == "BORROWED"
    assert loan.copy_barcode == copy.copy_barcode
    db_session.refresh(book)
    db_session.refresh(copy)
    assert book.available_stock == 0
    assert copy.status == "BORROWED"
    assert db_session.query(Waitlist).filter_by(user_code=user.user_code, book_id=book.id).count() == 0


# ---------------------------------------------------------------- get_user_max_borrow_limit

def test_max_borrow_limit_lecturer_is_5(db_session):
    user = _make_reader(db_session, user_code="CT0025", user_type="LECTURER")
    assert svc.get_user_max_borrow_limit(user) == 5


def test_max_borrow_limit_student_is_3(db_session):
    user = _make_reader(db_session, user_code="CT0026", user_type="STUDENT")
    assert svc.get_user_max_borrow_limit(user) == 3
