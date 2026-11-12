from datetime import date, datetime, time, timedelta

import pytest
from fastapi import HTTPException

from app.models.room import Room, RoomBooking
from app.services import room_booking_service as rbs
from app.services import wallet_service as ws

USER = "SV2026001"


def _make_room(db_session, price=20_000, is_active=True):
    room = Room(room_name="Room A", capacity=4, price_per_slot=price, is_active=is_active)
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)
    return room


def test_create_booking_debits_wallet(db_session, test_account):
    room = _make_room(db_session)
    ws.credit(db_session, USER, 50_000, "TOPUP")
    booking = rbs.create_booking(db_session, USER, room.id, date(2026, 12, 1), time(9, 0), time(11, 0))
    db_session.commit()
    assert booking.status == rbs.CONFIRMED
    assert ws.get_balance(db_session, USER) == 30_000


def test_create_booking_insufficient_balance_returns_402_and_no_row(db_session, test_account):
    room = _make_room(db_session, price=20_000)
    with pytest.raises(HTTPException) as e:
        rbs.create_booking(db_session, USER, room.id, date(2026, 12, 1), time(9, 0), time(11, 0))
    assert e.value.status_code == 402
    assert "20.000" in e.value.detail or "20,000" in e.value.detail
    assert db_session.query(RoomBooking).count() == 0
    assert ws.get_balance(db_session, USER) == 0


def test_create_booking_rejects_inactive_room(db_session, test_account):
    room = _make_room(db_session, is_active=False)
    ws.credit(db_session, USER, 50_000, "TOPUP")
    with pytest.raises(HTTPException) as e:
        rbs.create_booking(db_session, USER, room.id, date(2026, 12, 1), time(9, 0), time(11, 0))
    assert e.value.status_code == 404


ANCHOR_NOON = datetime(2026, 12, 1, 12, 0, 0)  # giữa trưa: cộng/trừ vài giờ không lệch sang ngày khác


def _fix_now(monkeypatch, when):
    monkeypatch.setattr(rbs, "now_vn", lambda: when)


def test_cancel_at_least_1h_before_refunds_full(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch, ANCHOR_NOON)
    room = _make_room(db_session, price=20_000)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    start = ANCHOR_NOON + timedelta(hours=3)
    booking = rbs.create_booking(db_session, USER, room.id, start.date(), start.time(),
                                 (start + timedelta(hours=2)).time())
    db_session.commit()
    assert ws.get_balance(db_session, USER) == 0

    cancelled = rbs.cancel_booking(db_session, USER, booking.id)
    db_session.commit()
    assert cancelled.status == rbs.CANCELLED
    assert ws.get_balance(db_session, USER) == 20_000


def test_cancel_less_than_1h_before_no_refund(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch, ANCHOR_NOON)
    room = _make_room(db_session, price=20_000)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    start = ANCHOR_NOON + timedelta(minutes=30)
    booking = rbs.create_booking(db_session, USER, room.id, start.date(), start.time(),
                                 (start + timedelta(hours=2)).time())
    db_session.commit()

    cancelled = rbs.cancel_booking(db_session, USER, booking.id)
    db_session.commit()
    assert cancelled.status == rbs.CANCELLED
    assert ws.get_balance(db_session, USER) == 0


def test_job06_marks_no_show_after_grace_period(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch, ANCHOR_NOON)
    room = _make_room(db_session)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    start = ANCHOR_NOON - timedelta(minutes=20)
    booking = rbs.create_booking(db_session, USER, room.id, start.date(), start.time(),
                                 (start + timedelta(hours=2)).time())
    db_session.commit()

    result = rbs.apply_noshow_and_completed(db_session, ANCHOR_NOON)
    db_session.commit()
    assert result["no_show"] == 1
    db_session.refresh(booking)
    assert booking.status == rbs.NO_SHOW


def test_job06_marks_completed_after_slot_end_when_checked_in(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch, ANCHOR_NOON)
    room = _make_room(db_session)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    start = ANCHOR_NOON - timedelta(hours=3)
    booking = rbs.create_booking(db_session, USER, room.id, start.date(), start.time(),
                                 (start + timedelta(hours=2)).time())
    booking.status = rbs.CHECKED_IN
    booking.checkin_time = start
    db_session.commit()

    result = rbs.apply_noshow_and_completed(db_session, ANCHOR_NOON)
    db_session.commit()
    assert result["completed"] == 1
    db_session.refresh(booking)
    assert booking.status == rbs.COMPLETED


def test_list_bookings_by_date(client, admin_headers, auth_headers, db_session, test_account):
    room = _make_room(db_session)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    db_session.commit()
    r = client.post("/api/room-bookings", json={
        "room_id": room.id, "booking_date": "2026-12-01",
        "slot_start": "09:00:00", "slot_end": "11:00:00",
    }, headers=auth_headers)
    assert r.status_code == 201

    r = client.get("/api/admin/room-bookings", params={"booking_date": "2026-12-01"},
                   headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert data["data"][0]["user_code"] == USER

    r_other_day = client.get("/api/admin/room-bookings", params={"booking_date": "2026-12-02"},
                             headers=admin_headers)
    assert r_other_day.json()["total"] == 0

    r_forbidden = client.get("/api/admin/room-bookings", params={"booking_date": "2026-12-01"},
                             headers=auth_headers)
    assert r_forbidden.status_code == 403
