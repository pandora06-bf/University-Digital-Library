"""2B-22 (Nhất): đặt/hủy/check-in phòng đọc.
3-10 (phần trừ phí/hoàn tiền/NO_SHOW): trừ phí ví khi đặt, hoàn tiền khi hủy
(hủy chỉ được phép khi còn >=1 giờ nên luôn hoàn 100%), và JOB-06 tự động
chuyển NO_SHOW/COMPLETED."""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.room import Room, RoomBooking
from app.models.user import Account, User
from app.services import wallet_service as ws

log = logging.getLogger(__name__)

ACTIVE = ("CONFIRMED", "CHECKED_IN")
TXN_BOOKING_PAYMENT = "BOOKING_PAYMENT"
TXN_REFUND = "REFUND"
NO_SHOW_GRACE = timedelta(minutes=15)


def local_now():
    return datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).replace(tzinfo=None)


def booking_data(booking):
    return {'id': booking.id, 'room_id': booking.room_id, 'user_code': booking.user_code,
            'booking_date': booking.booking_date, 'attendee_count': booking.attendee_count, 'slot_start': booking.slot_start,
            'slot_end': booking.slot_end, 'status': booking.status, 'checkin_time': booking.checkin_time}


def reserve(db: Session, user_code: str, room_id: int, booking_date, slot_start, slot_end, attendee_count: int = 1):
    now = local_now()
    start = datetime.combine(booking_date, slot_start)
    end = datetime.combine(booking_date, slot_end)
    if slot_start.tzinfo is not None or slot_end.tzinfo is not None:
        raise HTTPException(422, 'Khung giờ phải dùng giờ địa phương không có timezone')
    if start <= now or end <= start or end - start != timedelta(hours=2):
        raise HTTPException(422, 'Phải chọn khung 2 giờ trong tương lai')
    # Lock phòng tuần tự hóa đặt chỗ cạnh tranh cho cùng phòng.
    room = db.scalar(select(Room).where(Room.id == room_id).with_for_update())
    if not room or not room.is_active:
        raise HTTPException(404, 'Phòng không tồn tại hoặc ngừng hoạt động')
    if attendee_count < 1 or attendee_count > room.capacity:
        raise HTTPException(422, f'Số người tham dự phải từ 1 đến {room.capacity}')
    user = db.scalar(select(User).where(User.user_code == user_code).with_for_update())
    if user is None:
        raise HTTPException(404, 'Không tìm thấy hồ sơ người dùng')
    account = db.get(Account, user.account_id)
    if user.is_borrowing_blocked or (account is not None and not account.is_active):
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

    # 3-10: trừ phí trước khi tạo lượt đặt - số dư không đủ thì không tạo (HTTPException.detail
    # phải là string vì core/exception_handlers.py chỉ giữ nguyên detail dạng string).
    fee = room.price_per_slot
    balance = int(user.service_balance or 0)
    if balance < fee:
        missing = fee - balance
        raise HTTPException(402, f'Số dư tài khoản dịch vụ không đủ để đặt phòng, cần nạp thêm {missing:,}đ')

    booking = RoomBooking(room_id=room_id, user_code=user_code, booking_date=booking_date,
                          slot_start=slot_start, slot_end=slot_end, attendee_count=attendee_count, status='CONFIRMED')
    db.add(booking)
    try:
        db.flush()
    except IntegrityError as exc:
        raise HTTPException(409, 'Khung giờ đã được đặt') from exc

    ws.debit(db, user_code, fee, TXN_BOOKING_PAYMENT, reference_id=str(booking.id),
             description=f"Đặt phòng {room.room_name} ngày {booking_date}")
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
    # Hủy chỉ được phép khi còn >=1 giờ (chốt chặn ở trên) nên luôn hoàn 100%.
    room = db.get(Room, booking.room_id)
    ws.credit(db, user_code, room.price_per_slot, TXN_REFUND, reference_id=str(booking.id),
              description=f"Hoàn tiền hủy đặt phòng {room.room_name} ngày {booking.booking_date}")
    return booking


def checkin(db: Session, booking_id: int):
    booking = db.scalar(select(RoomBooking).where(RoomBooking.id == booking_id).with_for_update())
    if not booking:
        raise HTTPException(404, 'Không tìm thấy lượt đặt')
    if booking.status != 'CONFIRMED':
        raise HTTPException(409, 'Chỉ xác nhận vào phòng với lượt đặt đã được xác nhận')
    now = local_now()
    start = datetime.combine(booking.booking_date, booking.slot_start)
    if not start <= now <= start + timedelta(minutes=15):
        raise HTTPException(409, 'Chỉ xác nhận vào phòng trong 15 phút đầu khung giờ')
    booking.status, booking.checkin_time = 'CHECKED_IN', now
    db.flush()
    return booking


def list_bookings_by_date(db: Session, booking_date, room_id: Optional[int] = None) -> List[RoomBooking]:
    """GET /api/admin/room-bookings: liệt kê lượt đặt phòng trong một ngày (cho thủ thư)."""
    stmt = select(RoomBooking).where(RoomBooking.booking_date == booking_date)
    if room_id is not None:
        stmt = stmt.where(RoomBooking.room_id == room_id)
    return list(db.scalars(stmt.order_by(RoomBooking.slot_start)).all())


# ---------------------------------------------------------------- JOB-06
def apply_noshow_and_completed(db: Session, now: datetime) -> Dict[str, int]:
    """Không commit/close: caller (job hoặc test) quyết định transaction."""
    no_show = completed = 0
    candidates = db.query(RoomBooking).filter(RoomBooking.status.in_(ACTIVE)).all()
    for b in candidates:
        start_dt = datetime.combine(b.booking_date, b.slot_start)
        end_dt = datetime.combine(b.booking_date, b.slot_end)
        if b.status == 'CONFIRMED' and b.checkin_time is None and now >= start_dt + NO_SHOW_GRACE:
            b.status = 'NO_SHOW'
            no_show += 1
        elif b.status == 'CHECKED_IN' and now >= end_dt:
            b.status = 'COMPLETED'
            completed += 1
    return {"no_show": no_show, "completed": completed}


def run_room_noshow_job(session_factory=SessionLocal, now: Optional[datetime] = None) -> Dict[str, int]:
    """JOB-06: quá 15 phút chưa check-in -> NO_SHOW; hết khung giờ (đã check-in) -> COMPLETED."""
    now = now or local_now()
    db = session_factory()
    try:
        result = apply_noshow_and_completed(db, now)
        db.commit()
    except Exception:
        db.rollback()
        log.exception("JOB-06 failed")
        raise
    finally:
        db.close()
    log.info("JOB-06 no_show=%s completed=%s", result["no_show"], result["completed"])
    return result
