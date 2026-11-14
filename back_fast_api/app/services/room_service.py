"""2B-21: danh mục phòng đọc và lịch trống theo ngày (khung 2 giờ)."""
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.room import Room, RoomBooking
from app.services.room_booking_service import ACTIVE, local_now

# Giờ mở cửa phòng đọc: 07:00 - 21:00, chia khung 2 giờ.
OPEN_HOUR = 7
CLOSE_HOUR = 21
SLOT_HOURS = 2


def daily_slots() -> List[tuple]:
    return [(time(h), time(h + SLOT_HOURS)) for h in range(OPEN_HOUR, CLOSE_HOUR, SLOT_HOURS)]


def room_data(room: Room) -> Dict[str, Any]:
    return {
        "id": room.id,
        "room_name": room.room_name,
        "capacity": room.capacity,
        "price_per_slot": room.price_per_slot,
        "room_type": room.room_type,
        "floor": room.floor,
        "is_active": room.is_active,
        "created_at": room.created_at,
    }


def list_rooms(db: Session, include_inactive: bool = False) -> List[Room]:
    stmt = select(Room)
    if not include_inactive:
        stmt = stmt.where(Room.is_active.is_(True))
    return list(db.scalars(stmt.order_by(Room.id)).all())


def get_room_or_404(db: Session, room_id: int, for_update: bool = False) -> Room:
    stmt = select(Room).where(Room.id == room_id)
    if for_update:
        stmt = stmt.with_for_update()
    room = db.scalar(stmt)
    if room is None:
        raise HTTPException(404, "Không tìm thấy phòng")
    return room


def availability(db: Session, room_id: int, day: date) -> Dict[str, Any]:
    room = get_room_or_404(db, room_id)
    bookings = db.scalars(select(RoomBooking).where(
        RoomBooking.room_id == room_id,
        RoomBooking.booking_date == day,
        RoomBooking.status.in_(ACTIVE),
    )).all()
    now = local_now()
    slots = []
    for start, end in daily_slots():
        booked = any(b.slot_start < end and b.slot_end > start for b in bookings)
        past = datetime.combine(day, start) <= now
        slots.append({
            "slot_start": start,
            "slot_end": end,
            "is_booked": booked,
            "is_past": past,
            "available": room.is_active and not booked and not past,
        })
    return {"room": room_data(room), "date": day, "slots": slots}


def has_future_bookings(db: Session, room_id: int) -> bool:
    now = local_now()
    stmt = select(RoomBooking.id).where(
        RoomBooking.room_id == room_id,
        RoomBooking.status.in_(ACTIVE),
        or_(
            RoomBooking.booking_date > now.date(),
            and_(RoomBooking.booking_date == now.date(), RoomBooking.slot_end > now.time()),
        ),
    ).limit(1)
    return db.scalar(stmt) is not None


def _flush(db: Session):
    try:
        db.flush()
    except IntegrityError as exc:
        original = exc.orig
        constraint_name = getattr(getattr(original, "diag", None), "constraint_name", None)
        message = str(original).lower()
        is_room_name_conflict = (
            constraint_name == "rooms_room_name_key"
            or "unique constraint failed: rooms.room_name" in message
        )
        if is_room_name_conflict:
            raise HTTPException(409, "Tên phòng đã tồn tại") from exc
        raise


def create_room(db: Session, data: Dict[str, Any]) -> Room:
    if db.scalar(select(Room.id).where(Room.room_name == data["room_name"])):
        raise HTTPException(409, "Tên phòng đã tồn tại")
    room = Room(**{k: v for k, v in data.items() if v is not None})
    db.add(room)
    _flush(db)
    db.refresh(room)
    return room


def update_room(db: Session, room_id: int, data: Dict[str, Any]) -> Room:
    room = get_room_or_404(db, room_id, for_update=True)
    name = data.get("room_name")
    if name and name != room.room_name and db.scalar(
        select(Room.id).where(Room.room_name == name, Room.id != room_id)
    ):
        raise HTTPException(409, "Tên phòng đã tồn tại")
    if data.get("is_active") is False and room.is_active and has_future_bookings(db, room_id):
        raise HTTPException(409, "Không thể ngừng sử dụng phòng đang có lượt đặt trong tương lai")
    for key, value in data.items():
        setattr(room, key, value)
    _flush(db)
    return room
