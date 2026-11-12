"""2B-22 (Nhất) + 3-10 (trừ phí/hoàn tiền/NO_SHOW). API thực: reserve/cancel/checkin/
list_bookings_by_date trong app/services/room_booking_service.py (đã merge PR #34/#35)."""
from datetime import date, datetime, time, timedelta

import pytest
from fastapi import HTTPException

from app.models.room import Room, RoomBooking
from app.services import room_booking_service as svc
from app.services import wallet_service as ws

USER = "SV2026001"
ANCHOR = datetime(2026, 12, 1, 12, 0, 0)  # giữa trưa: cộng/trừ vài giờ không lệch sang ngày khác


def _fix_now(monkeypatch, when=ANCHOR):
    monkeypatch.setattr(svc, "local_now", lambda: when)


def _make_room(db_session, price=20_000, capacity=4, is_active=True):
    room = Room(room_name="Room A", capacity=capacity, price_per_slot=price, is_active=is_active)
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)
    return room


def test_reserve_debits_wallet(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session, price=20_000)
    ws.credit(db_session, USER, 50_000, "TOPUP")
    booking = svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                          (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    db_session.commit()
    assert booking.status == "CONFIRMED"
    assert ws.get_balance(db_session, USER) == 30_000


def test_reserve_insufficient_balance_402_and_no_row(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session, price=20_000)
    with pytest.raises(HTTPException) as e:
        svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                   (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    assert e.value.status_code == 402
    assert "20.000" in e.value.detail or "20,000" in e.value.detail
    assert db_session.query(RoomBooking).count() == 0
    assert ws.get_balance(db_session, USER) == 0


def test_cancel_at_least_1h_before_refunds_full(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session, price=20_000)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    booking = svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                          (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    db_session.commit()
    assert ws.get_balance(db_session, USER) == 0

    cancelled = svc.cancel(db_session, USER, booking.id)
    db_session.commit()
    assert cancelled.status == "CANCELLED"
    assert ws.get_balance(db_session, USER) == 20_000


def test_cancel_less_than_1h_before_is_blocked_no_refund(db_session, test_account, monkeypatch):
    room = _make_room(db_session, price=20_000)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    _fix_now(monkeypatch, ANCHOR)
    booking = svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                          (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    db_session.commit()

    # Còn 30 phút trước giờ bắt đầu -> cancel() phải chặn (409), không hoàn tiền.
    _fix_now(monkeypatch, ANCHOR + timedelta(hours=2, minutes=30))
    with pytest.raises(HTTPException) as e:
        svc.cancel(db_session, USER, booking.id)
    assert e.value.status_code == 409
    assert ws.get_balance(db_session, USER) == 0
    db_session.refresh(booking)
    assert booking.status == "CONFIRMED"


def test_job06_marks_no_show_after_grace_period(db_session, test_account, monkeypatch):
    room = _make_room(db_session)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    _fix_now(monkeypatch, ANCHOR)
    booking = svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                          (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    db_session.commit()

    check_at = ANCHOR + timedelta(hours=3, minutes=20)  # 20 phút sau giờ bắt đầu, chưa check-in
    result = svc.apply_noshow_and_completed(db_session, check_at)
    db_session.commit()
    assert result["no_show"] == 1
    db_session.refresh(booking)
    assert booking.status == "NO_SHOW"


def test_job06_marks_completed_after_slot_end_when_checked_in(db_session, test_account, monkeypatch):
    room = _make_room(db_session)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    _fix_now(monkeypatch, ANCHOR)
    booking = svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                          (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    db_session.commit()

    _fix_now(monkeypatch, ANCHOR + timedelta(hours=3, minutes=5))
    svc.checkin(db_session, booking.id)
    db_session.commit()

    check_at = ANCHOR + timedelta(hours=5, minutes=1)  # sau giờ kết thúc khung
    result = svc.apply_noshow_and_completed(db_session, check_at)
    db_session.commit()
    assert result["completed"] == 1
    db_session.refresh(booking)
    assert booking.status == "COMPLETED"


def test_list_bookings_by_date_admin_only(client, admin_headers, auth_headers, db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    db_session.commit()
    r = client.post("/api/room-bookings", json={
        "room_id": room.id, "booking_date": (ANCHOR + timedelta(days=1)).date().isoformat(),
        "slot_start": "09:00:00", "slot_end": "11:00:00",
    }, headers=auth_headers)
    assert r.status_code == 201, r.text

    booking_day = (ANCHOR + timedelta(days=1)).date().isoformat()
    r = client.get("/api/admin/room-bookings", params={"booking_date": booking_day}, headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert data["data"][0]["user_code"] == USER

    r_forbidden = client.get("/api/admin/room-bookings", params={"booking_date": booking_day}, headers=auth_headers)
    assert r_forbidden.status_code == 403
