import pytest
from sqlalchemy.exc import IntegrityError

from app.models.room import Room
from app.services.room_service import create_room


def test_admin_room_list_includes_inactive_rooms(client, db_session, admin_headers, auth_headers):
    db_session.add_all([
        Room(room_name="Active room", capacity=4, price_per_slot=20_000, is_active=True),
        Room(room_name="Inactive room", capacity=6, price_per_slot=30_000, is_active=False),
    ])
    db_session.commit()

    assert client.get("/api/admin/rooms").status_code == 401
    assert client.get("/api/admin/rooms", headers=auth_headers).status_code == 403

    response = client.get("/api/admin/rooms", headers=admin_headers)
    assert response.status_code == 200
    assert {room["room_name"] for room in response.json()["data"]} == {
        "Active room",
        "Inactive room",
    }


def test_room_integrity_error_is_not_reported_as_duplicate_name(db_session):
    with pytest.raises(IntegrityError):
        create_room(
            db_session,
            {
                "room_name": "Invalid room",
                "capacity": 0,
                "price_per_slot": 20_000,
            },
        )

    db_session.rollback()


def test_duplicate_room_name_returns_conflict(client, admin_headers):
    payload = {
        "room_name": "Room A",
        "capacity": 4,
        "price_per_slot": 20_000,
        "is_active": True,
    }
    assert client.post("/api/admin/rooms", json=payload, headers=admin_headers).status_code == 201

    response = client.post("/api/admin/rooms", json=payload, headers=admin_headers)
    assert response.status_code == 409
    assert response.json()["detail"] == "Tên phòng đã tồn tại"
