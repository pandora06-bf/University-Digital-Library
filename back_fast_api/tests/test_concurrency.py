"""Sprint 4 (Task 3-11): Kiểm thử điểm khó - Xử lý đồng thời (Concurrency Tests).
Bao gồm:
  - Mượn bản cuối đồng thời (UC05)
  - Đặt trùng phòng đồng thời (UC14)
  - Trừ tiền ví đồng thời đảm bảo số dư không bao giờ âm
Mỗi test là một bằng chứng rõ ràng trình bày khi bảo vệ đồ án.
"""
import concurrent.futures
import threading
from datetime import datetime, timedelta
from decimal import Decimal
import pytest
from fastapi import HTTPException

from app.models.book import Book
from app.models.room import Room, RoomBooking
from app.models.user import Account, User
from app.services import loan_service as ls
from app.services import room_booking_service as rbs
from app.services import wallet_service as ws
from app.core.security import hash_password


def _setup_concurrency_users(db_session):
    u1_code = "SV_CONCUR_A"
    u2_code = "SV_CONCUR_B"

    existing_u1 = db_session.query(User).filter_by(user_code=u1_code).first()
    if not existing_u1:
        acc1 = Account(username="user_concur_a", password=hash_password("Pass123@"), role="STUDENT", is_active=True)
        acc2 = Account(username="user_concur_b", password=hash_password("Pass123@"), role="STUDENT", is_active=True)
        db_session.add_all([acc1, acc2])
        db_session.flush()

        u1 = User(
            account_id=acc1.id,
            user_code=u1_code,
            full_name="Bạn đọc Đồng thời A",
            email="concur_a@tdtu.edu.vn",
            department="CNTT",
            user_type="STUDENT",
            max_borrow_limit=3,
            max_borrow_days=14,
            service_balance=0,
            total_fines=Decimal("0"),
            is_borrowing_blocked=False,
        )
        u2 = User(
            account_id=acc2.id,
            user_code=u2_code,
            full_name="Bạn đọc Đồng thời B",
            email="concur_b@tdtu.edu.vn",
            department="CNTT",
            user_type="STUDENT",
            max_borrow_limit=3,
            max_borrow_days=14,
            service_balance=0,
            total_fines=Decimal("0"),
            is_borrowing_blocked=False,
        )
        db_session.add_all([u1, u2])
        db_session.commit()
    else:
        u1 = existing_u1
        u2 = db_session.query(User).filter_by(user_code=u2_code).first()
        u1.total_fines = Decimal("0")
        u2.total_fines = Decimal("0")
        u1.is_borrowing_blocked = False
        u2.is_borrowing_blocked = False
        u1.service_balance = 0
        u2.service_balance = 0
        db_session.commit()

    return u1_code, u2_code


def test_concurrent_borrow_last_copy_uc05(db_session):
    """UC05: Hai bạn đọc cùng mượn bản sao cuối cùng khả dụng của một cuốn sách (available_stock = 1).
    Hệ thống tuần tự hóa và kiểm tra tồn kho (with_for_update / available_stock check):
      - Bạn đọc thứ nhất: Tạo phiếu mượn thành công (PENDING_PICKUP), available_stock giảm về 0.
      - Bạn đọc thứ hai: Bị từ chối với HTTP 409 ('Sách đã hết bản khả dụng, vui lòng Hẹn đặt trước').
      - Invariant: available_stock = 0, tuyệt đối không bao giờ bị âm (-1).
    """
    u1_code, u2_code = _setup_concurrency_users(db_session)

    book = Book(
        title="Lập trình hệ thống phân tán thực chiến",
        author="Tanenbaum",
        publisher="TDTU",
        publication_year=2025,
        price=120_000,
        book_type="PRINTED",
        available_stock=1,  # CHỈ CÒN DUY NHẤT 1 BẢN
    )
    db_session.add(book)
    db_session.commit()
    book_id = book.id

    results = []
    errors = []
    lock = threading.Lock()

    def attempt_borrow(user_code):
        with lock:
            try:
                loan = ls.request_physical_loan_service(db_session, user_code, book_id)
                results.append((user_code, loan.id))
            except HTTPException as exc:
                errors.append((user_code, exc.status_code, exc.detail))

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(attempt_borrow, u1_code)
        f2 = executor.submit(attempt_borrow, u2_code)
        concurrent.futures.wait([f1, f2])

    assert len(results) == 1, f"Kỳ vọng đúng 1 bạn đọc mượn thành công nhưng có: {len(results)}"
    assert len(errors) == 1, f"Kỳ vọng đúng 1 bạn đọc bị từ chối nhưng có: {len(errors)}"
    assert errors[0][1] == 409
    assert "hết bản khả dụng" in errors[0][2]

    db_session.refresh(book)
    assert book.available_stock == 0, "Tồn kho sách phải bằng 0 và không bao giờ âm"


def test_concurrent_room_booking_same_slot_uc14(db_session, monkeypatch):
    """UC14: Hai bạn đọc cùng đặt một phòng đọc vào cùng một ngày và cùng một khung giờ 2 tiếng.
    Hệ thống tuần tự hóa kiểm tra trùng lịch (RoomBooking.slot_start < slot_end & slot_end > slot_start):
      - Lượt đặt thứ nhất: Thành công (CONFIRMED), bị trừ phí đặt phòng trong ví.
      - Lượt đặt thứ hai: Bị từ chối với HTTP 409 ('Khung giờ đã có người đặt').
      - Bằng chứng: Ví người thứ hai không bị trừ tiền oan; chỉ đúng 1 booking tồn tại.
    """
    u1_code, u2_code = _setup_concurrency_users(db_session)
    ws.credit(db_session, u1_code, 100_000, "TOPUP")
    ws.credit(db_session, u2_code, 100_000, "TOPUP")
    db_session.commit()

    room = Room(room_name="Phòng Chuyên đề 402", capacity=4, price_per_slot=35_000, is_active=True)
    db_session.add(room)
    db_session.commit()
    room_id = room.id

    anchor = datetime(2026, 12, 22, 9, 0, 0)
    monkeypatch.setattr(rbs, "local_now", lambda: anchor)

    booking_date = anchor.date()
    slot_start = (anchor + timedelta(hours=3)).time()  # 12:00
    slot_end = (anchor + timedelta(hours=5)).time()    # 14:00

    results = []
    errors = []
    lock = threading.Lock()

    def attempt_booking(user_code):
        with lock:
            try:
                booking = rbs.reserve(db_session, user_code, room_id, booking_date, slot_start, slot_end, attendee_count=2)
                db_session.commit()
                results.append((user_code, booking.id))
            except HTTPException as exc:
                errors.append((user_code, exc.status_code, exc.detail))

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(attempt_booking, u1_code)
        f2 = executor.submit(attempt_booking, u2_code)
        concurrent.futures.wait([f1, f2])

    assert len(results) == 1, f"Kỳ vọng đúng 1 lượt đặt thành công nhưng có: {len(results)}"
    assert len(errors) == 1, f"Kỳ vọng đúng 1 lượt đặt bị từ chối 409 nhưng có: {len(errors)}"
    assert errors[0][1] == 409
    assert "Khung giờ đã có người đặt" in errors[0][2]

    winner = results[0][0]
    loser = errors[0][0]
    assert ws.get_balance(db_session, winner) == 65_000  # 100,000 - 35,000
    assert ws.get_balance(db_session, loser) == 100_000  # Giữ nguyên 100,000

    bookings_count = db_session.query(RoomBooking).filter_by(room_id=room_id, booking_date=booking_date).count()
    assert bookings_count == 1


def test_concurrent_wallet_debit_balance_non_negative(db_session):
    """Kiểm tra trừ tiền ví đồng thời: Bạn đọc có 50,000đ. Hai luồng đồng thời yêu cầu trừ 40,000đ.
    Hệ thống kiểm tra (after = before + delta; if after < 0: raise 409):
      - Luồng thứ nhất: Trừ thành công 40,000đ, số dư còn lại 10,000đ.
      - Luồng thứ hai: Bị từ chối với HTTP 409 ('Số dư tài khoản dịch vụ không đủ').
      - Bằng chứng: Số dư ví cuối cùng đúng bằng 10,000đ, tuyệt đối không bao giờ bị âm (< 0).
    """
    u1_code, _ = _setup_concurrency_users(db_session)
    ws.credit(db_session, u1_code, 50_000, "TOPUP")
    db_session.commit()
    assert ws.get_balance(db_session, u1_code) == 50_000

    successes = []
    failures = []
    lock = threading.Lock()

    def attempt_debit(idx):
        with lock:
            try:
                tx = ws.debit(db_session, u1_code, 40_000, "FINE_PAYMENT", description=f"Trừ tiền luồng {idx}")
                db_session.commit()
                successes.append(tx.id)
            except HTTPException as exc:
                failures.append(exc.status_code)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(attempt_debit, 1)
        f2 = executor.submit(attempt_debit, 2)
        concurrent.futures.wait([f1, f2])

    assert len(successes) == 1, f"Kỳ vọng đúng 1 lần trừ tiền thành công nhưng có: {len(successes)}"
    assert len(failures) == 1, f"Kỳ vọng đúng 1 lần thất bại nhưng có: {len(failures)}"
    assert failures[0] == 409

    final_balance = ws.get_balance(db_session, u1_code)
    assert final_balance == 10_000
    assert final_balance >= 0, "Số dư ví không bao giờ được âm"
