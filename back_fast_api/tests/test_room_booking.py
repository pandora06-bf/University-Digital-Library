"""2B-22 (Nhất) + 3-10 (trừ phí/hoàn tiền/NO_SHOW). API thực: reserve/cancel/checkin/
list_bookings_by_date trong app/services/room_booking_service.py (đã merge PR #34/#35)."""
from datetime import date, datetime, time, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.room import Room, RoomBooking
from app.services import room_booking_service as svc
from app.services import wallet_service as ws

USER = "SV2026001"
ANCHOR = datetime(2026, 12, 1, 12, 0, 0)  # giữa trưa: cộng/trừ vài giờ không lệch sang ngày khác


def _fix_now(monkeypatch, when=ANCHOR):
    monkeypatch.setattr(svc, "local_now", lambda: when)


_room_counter = [0]


def _make_room(db_session, price=20_000, capacity=4, is_active=True, name=None):
    _room_counter[0] += 1
    room = Room(room_name=name or f"Room {_room_counter[0]}", capacity=capacity,
               price_per_slot=price, is_active=is_active)
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


# ---------------------------------------------------------------- reserve(): validation branches

def test_reserve_rejects_tz_aware_slot(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session)
    with pytest.raises(HTTPException) as e:
        svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                   time(15, 0, tzinfo=timezone.utc), time(17, 0))
    assert e.value.status_code == 422


def test_reserve_rejects_slot_not_exactly_2_hours(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session)
    with pytest.raises(HTTPException) as e:
        svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                   (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=4)).time())
    assert e.value.status_code == 422


def test_reserve_rejects_slot_in_the_past(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session)
    with pytest.raises(HTTPException) as e:
        svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                   (ANCHOR - timedelta(hours=3)).time(), (ANCHOR - timedelta(hours=1)).time())
    assert e.value.status_code == 422


def test_reserve_rejects_inactive_room(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session, is_active=False)
    with pytest.raises(HTTPException) as e:
        svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                   (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    assert e.value.status_code == 404


def test_reserve_rejects_attendee_count_over_capacity(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session, capacity=2)
    with pytest.raises(HTTPException) as e:
        svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                   (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time(),
                   attendee_count=3)
    assert e.value.status_code == 422


def test_reserve_rejects_locked_account(db_session, test_account, monkeypatch):
    from app.models.user import User
    _fix_now(monkeypatch)
    room = _make_room(db_session)
    user = db_session.query(User).filter_by(user_code=USER).one()
    user.is_borrowing_blocked = True
    db_session.commit()
    with pytest.raises(HTTPException) as e:
        svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                   (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    assert e.value.status_code == 403


def test_reserve_rejects_unknown_user(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session)
    with pytest.raises(HTTPException) as e:
        svc.reserve(db_session, "NO-SUCH-USER", room.id, ANCHOR.date(),
                   (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    assert e.value.status_code == 404


def _make_second_user(db_session, user_code="SV2026002"):
    from app.core.security import hash_password
    from app.models.user import Account, User
    account = Account(username=user_code.lower(), password=hash_password("Password123@"),
                      role="STUDENT", is_active=True)
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    user = User(account_id=account.id, user_code=user_code, full_name="User hai",
                email=f"{user_code.lower()}@library.local", department="CNTT",
                user_type="STUDENT", max_borrow_limit=3, max_borrow_days=14,
                is_borrowing_blocked=False)
    db_session.add(user)
    db_session.commit()
    return user


def test_reserve_rejects_overlapping_slot_from_another_user(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session)
    other = _make_second_user(db_session)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    ws.credit(db_session, other.user_code, 20_000, "TOPUP")
    svc.reserve(db_session, USER, room.id, ANCHOR.date(),
               (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    db_session.commit()
    with pytest.raises(HTTPException) as e:
        svc.reserve(db_session, other.user_code, room.id, ANCHOR.date(),
                   (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    assert e.value.status_code == 409


def test_reserve_rejects_second_active_booking_same_day(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session)
    ws.credit(db_session, USER, 40_000, "TOPUP")
    svc.reserve(db_session, USER, room.id, ANCHOR.date(),
               (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    db_session.commit()
    with pytest.raises(HTTPException) as e:
        svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                   (ANCHOR + timedelta(hours=6)).time(), (ANCHOR + timedelta(hours=8)).time())
    assert e.value.status_code == 409


# ---------------------------------------------------------------- cancel() / checkin() branches

def test_cancel_not_found(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    with pytest.raises(HTTPException) as e:
        svc.cancel(db_session, USER, 999999)
    assert e.value.status_code == 404


def test_cancel_already_cancelled(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    booking = svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                          (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    db_session.commit()
    svc.cancel(db_session, USER, booking.id)
    db_session.commit()
    with pytest.raises(HTTPException) as e:
        svc.cancel(db_session, USER, booking.id)
    assert e.value.status_code == 409


def test_checkin_not_found(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    with pytest.raises(HTTPException) as e:
        svc.checkin(db_session, 999999)
    assert e.value.status_code == 404


def test_checkin_wrong_status(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    booking = svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                          (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    db_session.commit()
    svc.cancel(db_session, USER, booking.id)
    db_session.commit()
    with pytest.raises(HTTPException) as e:
        svc.checkin(db_session, booking.id)
    assert e.value.status_code == 409


def test_checkin_outside_window(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch, ANCHOR)
    room = _make_room(db_session)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    booking = svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                          (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    db_session.commit()
    _fix_now(monkeypatch, ANCHOR + timedelta(hours=3, minutes=16))  # quá 15 phút đầu khung giờ
    with pytest.raises(HTTPException) as e:
        svc.checkin(db_session, booking.id)
    assert e.value.status_code == 409


# ---------------------------------------------------------------- list_bookings_by_date() filter

def test_list_bookings_by_date_filters_by_room_id(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room1 = _make_room(db_session)
    room2 = _make_room(db_session, price=30_000)
    ws.credit(db_session, USER, 60_000, "TOPUP")
    svc.reserve(db_session, USER, room1.id, ANCHOR.date(),
               (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    db_session.commit()

    rows = svc.list_bookings_by_date(db_session, ANCHOR.date(), room_id=room2.id)
    assert rows == []
    rows = svc.list_bookings_by_date(db_session, ANCHOR.date(), room_id=room1.id)
    assert len(rows) == 1


# ---------------------------------------------------------------- misc / job wrapper

def test_local_now_returns_naive_datetime():
    now = svc.local_now()
    assert now.tzinfo is None


def test_run_room_noshow_job_commits_through_session_factory(db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    booking = svc.reserve(db_session, USER, room.id, ANCHOR.date(),
                          (ANCHOR + timedelta(hours=3)).time(), (ANCHOR + timedelta(hours=5)).time())
    db_session.commit()

    class NonClosingSession:
        def __init__(self, s):
            self._s = s

        def __getattr__(self, name):
            return getattr(self._s, name)

        def close(self):
            pass  # giữ db_session fixture dùng chung trong test

    check_at = ANCHOR + timedelta(hours=3, minutes=20)
    result = svc.run_room_noshow_job(session_factory=lambda: NonClosingSession(db_session), now=check_at)
    assert result["no_show"] == 1
    db_session.refresh(booking)
    assert booking.status == "NO_SHOW"


def test_run_room_noshow_job_rolls_back_and_reraises_on_error(db_session, monkeypatch):
    def boom(db, now):
        raise RuntimeError("boom")

    monkeypatch.setattr(svc, "apply_noshow_and_completed", boom)
    with pytest.raises(RuntimeError):
        svc.run_room_noshow_job(session_factory=lambda: db_session, now=svc.local_now())


# ---------------------------------------------------------------- router (HTTP)

def test_mine_endpoint_lists_own_bookings(client, auth_headers, db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    db_session.commit()
    booking_day = (ANCHOR + timedelta(days=1)).date().isoformat()
    r = client.post("/api/room-bookings", json={
        "room_id": room.id, "booking_date": booking_day,
        "slot_start": "09:00:00", "slot_end": "11:00:00",
    }, headers=auth_headers)
    assert r.status_code == 201, r.text

    r = client.get("/api/room-bookings/my", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["page"] == 1 and len(data["data"]) == 1
    assert data["data"][0]["user_code"] == USER


def test_book_endpoint_propagates_insufficient_balance(client, auth_headers, db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session, price=20_000)
    booking_day = (ANCHOR + timedelta(days=1)).date().isoformat()
    r = client.post("/api/room-bookings", json={
        "room_id": room.id, "booking_date": booking_day,
        "slot_start": "09:00:00", "slot_end": "11:00:00",
    }, headers=auth_headers)
    assert r.status_code == 402
    assert db_session.query(RoomBooking).count() == 0


def test_delete_booking_endpoint_not_found(client, auth_headers, test_account):
    r = client.delete("/api/room-bookings/999999", headers=auth_headers)
    assert r.status_code == 404


def test_delete_booking_endpoint_success_refunds(client, auth_headers, db_session, test_account, monkeypatch):
    _fix_now(monkeypatch)
    room = _make_room(db_session, price=20_000)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    db_session.commit()
    booking_day = (ANCHOR + timedelta(days=1)).date().isoformat()
    r = client.post("/api/room-bookings", json={
        "room_id": room.id, "booking_date": booking_day,
        "slot_start": "09:00:00", "slot_end": "11:00:00",
    }, headers=auth_headers)
    assert r.status_code == 201, r.text
    booking_id = r.json()["id"]

    r = client.delete(f"/api/room-bookings/{booking_id}", headers=auth_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "CANCELLED"
    assert ws.get_balance(db_session, USER) == 20_000


def test_admin_checkin_endpoint_not_found(client, admin_headers):
    r = client.post("/api/admin/room-bookings/checkin", json={"booking_id": 999999}, headers=admin_headers)
    assert r.status_code == 404


def test_admin_checkin_endpoint(client, auth_headers, admin_headers, db_session, test_account, monkeypatch):
    _fix_now(monkeypatch, ANCHOR)
    room = _make_room(db_session)
    ws.credit(db_session, USER, 20_000, "TOPUP")
    db_session.commit()
    booking_day = ANCHOR.date().isoformat()
    r = client.post("/api/room-bookings", json={
        "room_id": room.id, "booking_date": booking_day,
        "slot_start": (ANCHOR + timedelta(hours=3)).time().isoformat(),
        "slot_end": (ANCHOR + timedelta(hours=5)).time().isoformat(),
    }, headers=auth_headers)
    assert r.status_code == 201, r.text
    booking_id = r.json()["id"]

    _fix_now(monkeypatch, ANCHOR + timedelta(hours=3, minutes=5))
    r = client.post("/api/admin/room-bookings/checkin", json={"booking_id": booking_id}, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "CHECKED_IN"
