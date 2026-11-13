"""Sprint 4 (Task 4-22): Kiểm thử pytest cho đặt phòng, hoàn tiền, NO_SHOW và check-in (Room Booking)."""
from datetime import date, datetime, time, timedelta
from decimal import Decimal
import pytest
from fastapi import HTTPException

from app.models.room import Room, RoomBooking
from app.models.user import User
from app.services import room_booking_service as svc
from app.services import wallet_service as ws

USER = "SV2026001"
ANCHOR = datetime(2026, 12, 15, 10, 0, 0)


def _fix_now(monkeypatch, when=ANCHOR):
    monkeypatch.setattr(svc, "local_now", lambda: when)


def _make_room(db_session, price=25_000, capacity=6, is_active=True):
    room = Room(
        room_name="Phòng Hội thảo 201",
        capacity=capacity,
        price_per_slot=price,
        is_active=is_active,
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)
    return room


def test_booking_refund_full_when_cancelled_in_advance(db_session, test_account, monkeypatch):
    """Hoàn tiền đặt phòng 100% khi hủy trước giờ bắt đầu ít nhất 1 giờ."""
    _fix_now(monkeypatch, ANCHOR)
    room = _make_room(db_session, price=30_000)
    ws.credit(db_session, USER, 50_000, "TOPUP")
    assert ws.get_balance(db_session, USER) == 50_000

    # Đặt slot 14:00 - 16:00 (cách thời điểm hiện tại 4 giờ)
    booking = svc.reserve(
        db_session,
        USER,
        room.id,
        ANCHOR.date(),
        (ANCHOR + timedelta(hours=4)).time(),
        (ANCHOR + timedelta(hours=6)).time(),
        attendee_count=3,
    )
    db_session.commit()

    assert booking.status == "CONFIRMED"
    assert ws.get_balance(db_session, USER) == 20_000

    # Hủy phòng lúc ANCHOR (còn 4 giờ trước bắt đầu) -> được hoàn 100% tiền (30,000đ)
    cancelled = svc.cancel(db_session, USER, booking.id)
    db_session.commit()

    assert cancelled.status == "CANCELLED"
    assert ws.get_balance(db_session, USER) == 50_000

    # Kiểm tra giao dịch hoàn tiền trong sổ cái ví
    txns = ws.list_transactions(db_session, USER, page=1, size=10)["data"]
    refund_tx = [t for t in txns if t["txn_type"] == "REFUND"]
    assert len(refund_tx) == 1
    assert refund_tx[0]["amount"] == 30_000
    assert refund_tx[0]["balance_after"] == 50_000


def test_booking_cancel_blocked_less_than_1h_no_refund(db_session, test_account, monkeypatch):
    """Hủy phòng sát giờ (< 1 giờ trước bắt đầu) bị chặn 409 và KHÔNG hoàn tiền."""
    room = _make_room(db_session, price=20_000)
    ws.credit(db_session, USER, 40_000, "TOPUP")
    _fix_now(monkeypatch, ANCHOR)

    booking = svc.reserve(
        db_session,
        USER,
        room.id,
        ANCHOR.date(),
        (ANCHOR + timedelta(hours=2)).time(),
        (ANCHOR + timedelta(hours=4)).time(),
        attendee_count=2,
    )
    db_session.commit()
    assert ws.get_balance(db_session, USER) == 20_000

    # Chuyển thời gian đến sát giờ: còn 30 phút trước khi slot bắt đầu
    _fix_now(monkeypatch, ANCHOR + timedelta(hours=1, minutes=30))

    with pytest.raises(HTTPException) as exc:
        svc.cancel(db_session, USER, booking.id)
    assert exc.value.status_code == 409
    assert "trước giờ bắt đầu ít nhất một giờ" in exc.value.detail

    # Số dư ví vẫn nguyên, không hoàn tiền
    assert ws.get_balance(db_session, USER) == 20_000
    db_session.refresh(booking)
    assert booking.status == "CONFIRMED"


def test_booking_no_show_after_grace_period(db_session, test_account, monkeypatch):
    """Quá thời gian ân hạn 15 phút không check-in -> Tự động chuyển NO_SHOW, không hoàn phí."""
    room = _make_room(db_session, price=20_000)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    _fix_now(monkeypatch, ANCHOR)

    booking = svc.reserve(
        db_session,
        USER,
        room.id,
        ANCHOR.date(),
        (ANCHOR + timedelta(hours=2)).time(),
        (ANCHOR + timedelta(hours=4)).time(),
        attendee_count=2,
    )
    db_session.commit()

    # Kiểm tra tại thời điểm 20 phút sau giờ bắt đầu (vượt quá ân hạn 15 phút)
    after_grace = ANCHOR + timedelta(hours=2, minutes=20)
    res = svc.apply_noshow_and_completed(db_session, after_grace)
    db_session.commit()

    assert res["no_show"] == 1
    db_session.refresh(booking)
    assert booking.status == "NO_SHOW"
    # Tiền phí phòng không hoàn lại khi NO_SHOW
    assert ws.get_balance(db_session, USER) == 0


def test_booking_checkin_and_completed_flow(db_session, test_account, monkeypatch):
    """Check-in thành công và hoàn thành slot sau khi hết giờ."""
    room = _make_room(db_session, price=15_000)
    ws.credit(db_session, USER, 30_000, "TOPUP")
    _fix_now(monkeypatch, ANCHOR)

    booking = svc.reserve(
        db_session,
        USER,
        room.id,
        ANCHOR.date(),
        (ANCHOR + timedelta(hours=1)).time(),
        (ANCHOR + timedelta(hours=3)).time(),
        attendee_count=1,
    )
    db_session.commit()

    # Bạn đọc đến quầy check-in đúng giờ
    checkin_time = ANCHOR + timedelta(hours=1, minutes=5)
    _fix_now(monkeypatch, checkin_time)
    checked = svc.checkin(db_session, booking.id)
    db_session.commit()

    assert checked.status == "CHECKED_IN"
    assert checked.checkin_time == checkin_time

    # Hết slot (sau 3 giờ)
    after_slot = ANCHOR + timedelta(hours=3, minutes=1)
    res = svc.apply_noshow_and_completed(db_session, after_slot)
    db_session.commit()

    assert res["completed"] == 1
    db_session.refresh(booking)
    assert booking.status == "COMPLETED"


def test_booking_insufficient_balance_rejected(db_session, test_account, monkeypatch):
    """Không đủ tiền ví thì từ chối đặt phòng và không tạo bản ghi rác."""
    _fix_now(monkeypatch, ANCHOR)
    room = _make_room(db_session, price=50_000)
    ws.credit(db_session, USER, 20_000, "TOPUP")

    with pytest.raises(HTTPException) as exc:
        svc.reserve(
            db_session,
            USER,
            room.id,
            ANCHOR.date(),
            (ANCHOR + timedelta(hours=3)).time(),
            (ANCHOR + timedelta(hours=5)).time(),
            attendee_count=2,
        )
    assert exc.value.status_code == 402
    assert "Số dư tài khoản dịch vụ không đủ" in exc.value.detail
    assert db_session.query(RoomBooking).count() == 0
    assert ws.get_balance(db_session, USER) == 20_000
