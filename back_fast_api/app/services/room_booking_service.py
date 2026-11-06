"""2B-22: đặt/hủy/check-in phòng đọc, không thu phí (3-10 phụ trách)."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

def local_now():
    return datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).replace(tzinfo=None)
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.models.room import Room, RoomBooking
from app.models.user import User

ACTIVE = ('CONFIRMED', 'CHECKED_IN')

def booking_data(booking):
    return {'id': booking.id, 'room_id': booking.room_id, 'user_code': booking.user_code,
            'booking_date': booking.booking_date, 'slot_start': booking.slot_start,
            'slot_end': booking.slot_end, 'status': booking.status, 'checkin_time': booking.checkin_time}

def reserve(db: Session, user_code: str, room_id: int, booking_date, slot_start, slot_end):
    now = local_now()
    start = datetime.combine(booking_date, slot_start)
    end = datetime.combine(booking_date, slot_end)
    if start <= now or end <= start or end - start != timedelta(hours=2):
        raise HTTPException(422, 'Phải chọn khung 2 giờ trong tương lai')
    # Lock phòng tuần tự hóa đặt chỗ cạnh tranh cho cùng phòng.
    room = db.scalar(select(Room).where(Room.id == room_id).with_for_update())
    if not room or not room.is_active:
        raise HTTPException(404, 'Phòng không tồn tại hoặc ngừng hoạt động')
    user = db.scalar(select(User).where(User.user_code == user_code).with_for_update())
    if user.is_borrowing_blocked:
        raise HTTPException(403, 'Tài khoản đang bị khóa')
    today_existing = db.scalar(select(RoomBooking.id).where(RoomBooking.user_code == user_code,
        RoomBooking.booking_date == booking_date, RoomBooking.status.in_(ACTIVE)))
    if today_existing:
        raise HTTPException(409, 'Mỗi người chỉ được một lượt đặt còn hiệu lực trong ngày')
    conflicting = db.scalar(select(RoomBooking.id).where(RoomBooking.room_id == room_id,
        RoomBooking.booking_date == booking_date, RoomBooking.status.in_(ACTIVE),
        RoomBooking.slot_start < slot_end, RoomBooking.slot_end > slot_start))
    if conflicting:
        raise HTTPException(409, 'Khung giờ đã có người đặt')
    booking = RoomBooking(room_id=room_id, user_code=user_code, booking_date=booking_date,
                          slot_start=slot_start, slot_end=slot_end, status='CONFIRMED')
    db.add(booking)
    try:
        db.flush()
    except IntegrityError as exc:
        raise HTTPException(409, 'Khung giờ đã được đặt') from exc
    return booking

def cancel(db: Session, user_code: str, booking_id: int):
    booking = db.scalar(select(RoomBooking).where(RoomBooking.id == booking_id).with_for_update())
    if booking is None or booking.user_code != user_code:
        raise HTTPException(404, 'Không tìm thấy lượt đặt')
    if booking.status != 'CONFIRMED':
        raise HTTPException(409, 'Lượt đặt không thể hủy')
    if datetime.combine(booking.booking_date, booking.slot_start) - local_now() < timedelta(hours=1):
        raise HTTPException(409, 'Phải hủy trước giờ bắt đầu ít nhất một giờ')
    booking.status = 'CANCELLED'
    db.flush()
    return booking

def checkin(db: Session, booking_id: int):
    booking = db.scalar(select(RoomBooking).where(RoomBooking.id == booking_id).with_for_update())
    if not booking:
        raise HTTPException(404, 'Không tìm thấy lượt đặt')
    if booking.status != 'CONFIRMED':
        raise HTTPException(409, 'Chỉ check-in lượt đã xác nhận')
    now = local_now()
    start = datetime.combine(booking.booking_date, booking.slot_start)
    if not start <= now <= start + timedelta(minutes=15):
        raise HTTPException(409, 'Chỉ check-in trong 15 phút đầu khung giờ')
    booking.status, booking.checkin_time = 'CHECKED_IN', now
    db.flush()
    return booking
