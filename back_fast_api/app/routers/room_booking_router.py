from datetime import date, time
from fastapi import APIRouter, Depends, Query, status, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.room import RoomBooking
from app.services import room_booking_service as svc
from app.models.room import Room
from app.services.email_notifier import send_room_booking

router = APIRouter(tags=['Room Bookings'])

class RoomBookingCreate(BaseModel):
    room_id: int
    booking_date: date
    slot_start: time
    slot_end: time
    attendee_count: int = Field(default=1, ge=1)

class CheckinBody(BaseModel):
    booking_id: int

@router.post('/api/room-bookings', status_code=status.HTTP_201_CREATED)
def book(data: RoomBookingCreate, tasks: BackgroundTasks, user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        result = svc.reserve(db, user.user_code, data.room_id, data.booking_date, data.slot_start, data.slot_end, data.attendee_count)
        payload = svc.booking_data(result)
        room = db.get(Room, data.room_id)
        name = room.room_name if room else str(data.room_id)
        db.commit()
        tasks.add_task(send_room_booking, user.email, user.full_name, payload["id"], name, data.booking_date, f"{data.slot_start}-{data.slot_end}")
        return payload
    except Exception:
        db.rollback()
        raise

@router.get('/api/room-bookings/my')
def mine(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
         user=Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(RoomBooking).where(RoomBooking.user_code == user.user_code)
    rows = db.scalars(query.order_by(RoomBooking.id.desc()).offset((page-1)*size).limit(size)).all()
    return {'data': [svc.booking_data(r) for r in rows], 'page': page, 'size': size}

@router.delete('/api/room-bookings/{booking_id}')
def delete_booking(booking_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        result = svc.cancel(db, user.user_code, booking_id)
        data = svc.booking_data(result)
        db.commit()
        return data
    except Exception:
        db.rollback()
        raise

@router.post('/api/admin/room-bookings/checkin')
def admin_checkin(body: CheckinBody, _=Depends(require_roles('ADMIN', 'LIBRARIAN')),
                  db: Session = Depends(get_db)):
    try:
        result = svc.checkin(db, body.booking_id)
        data = svc.booking_data(result)
        db.commit()
        return data
    except Exception:
        db.rollback()
        raise
