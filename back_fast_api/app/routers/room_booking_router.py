from datetime import date, time

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User
from app.services import room_booking_service as rbs

router = APIRouter(tags=["Room Booking"])


class RoomBookingCreate(BaseModel):
    room_id: int
    booking_date: date
    slot_start: time
    slot_end: time


@router.post("/api/room-bookings", status_code=status.HTTP_201_CREATED)
def create_room_booking(data: RoomBookingCreate, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    try:
        booking = rbs.create_booking(db, user.user_code, data.room_id, data.booking_date,
                                     data.slot_start, data.slot_end)
        response = rbs.serialize_booking(booking)
        db.commit()
        return response
    except Exception:
        db.rollback()
        raise


@router.delete("/api/room-bookings/{booking_id}")
def cancel_room_booking(booking_id: int, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    try:
        booking = rbs.cancel_booking(db, user.user_code, booking_id)
        response = rbs.serialize_booking(booking)
        db.commit()
        return response
    except Exception:
        db.rollback()
        raise


@router.get("/api/admin/room-bookings", dependencies=[Depends(require_roles("ADMIN", "LIBRARIAN"))])
def list_room_bookings(booking_date: date = Query(...), room_id: int | None = Query(None),
                       db: Session = Depends(get_db)):
    bookings = rbs.list_bookings_by_date(db, booking_date, room_id)
    return {"data": [rbs.serialize_booking(b) for b in bookings], "total": len(bookings)}
