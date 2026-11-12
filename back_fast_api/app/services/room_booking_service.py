"""Phòng đọc: trừ phí, hoàn tiền và tiến trình NO_SHOW/COMPLETED (3-10)."""
import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.room import Room, RoomBooking
from app.models.user import User
from app.services import wallet_service as ws

log = logging.getLogger(__name__)

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED, NO_SHOW = (
    "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW",
)
TXN_BOOKING_PAYMENT = "BOOKING_PAYMENT"
TXN_REFUND = "REFUND"
CANCEL_REFUND_WINDOW = timedelta(hours=1)
NO_SHOW_GRACE = timedelta(minutes=15)


def now_vn() -> datetime:
    return datetime.now(timezone.utc).astimezone(VN_TZ).replace(tzinfo=None)


def _slot_start_dt(booking: RoomBooking) -> datetime:
    return datetime.combine(booking.booking_date, booking.slot_start)


def _slot_end_dt(booking: RoomBooking) -> datetime:
    return datetime.combine(booking.booking_date, booking.slot_end)


def serialize_booking(b: RoomBooking) -> Dict[str, Any]:
    return {
        "id": b.id, "room_id": b.room_id,
        "room_name": b.room.room_name if b.room else None,
        "user_code": b.user_code, "booking_date": b.booking_date,
        "slot_start": b.slot_start, "slot_end": b.slot_end,
        "status": b.status, "checkin_time": b.checkin_time,
    }


def create_booking(db: Session, user_code: str, room_id: int,
                    booking_date: date, slot_start: time, slot_end: time) -> RoomBooking:
    """Trong một transaction: tạo lượt đặt rồi trừ phí qua wallet_service.
    Số dư không đủ: HTTPException 402 kèm missing_amount, không tạo lượt đặt."""
    if slot_end <= slot_start:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Khung giờ không hợp lệ")

    room = db.get(Room, room_id)
    if not room or not room.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy phòng hoặc phòng đã ngừng sử dụng")

    fee = room.price_per_slot
    user = db.scalar(select(User).where(User.user_code == user_code).with_for_update())
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy người dùng")

    balance = int(user.service_balance or 0)
    if balance < fee:
        # HTTPException.detail phải là string: handler toàn cục (core/exception_handlers.py)
        # chỉ giữ nguyên detail dạng string, dict sẽ bị thay bằng message chung.
        missing = fee - balance
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"Số dư tài khoản dịch vụ không đủ để đặt phòng, cần nạp thêm {missing:,}đ",
        )

    booking = RoomBooking(room_id=room_id, user_code=user_code, booking_date=booking_date,
                          slot_start=slot_start, slot_end=slot_end, status=CONFIRMED)
    db.add(booking)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Khung giờ này đã có người đặt")

    ws.debit(db, user_code, fee, TXN_BOOKING_PAYMENT, reference_id=str(booking.id),
             description=f"Đặt phòng {room.room_name} ngày {booking_date}")
    return booking


def cancel_booking(db: Session, user_code: str, booking_id: int) -> RoomBooking:
    """Hủy trước giờ bắt đầu từ 1 giờ: hoàn 100%. Hủy muộn: không hoàn."""
    booking = db.scalar(
        select(RoomBooking)
        .where(RoomBooking.id == booking_id, RoomBooking.user_code == user_code)
        .with_for_update()
    )
    if not booking:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy lượt đặt phòng")
    if booking.status != CONFIRMED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Lượt đặt không ở trạng thái có thể hủy")

    refund_eligible = _slot_start_dt(booking) - now_vn() >= CANCEL_REFUND_WINDOW
    booking.status = CANCELLED
    if refund_eligible:
        room = db.get(Room, booking.room_id)
        ws.credit(db, user_code, room.price_per_slot, TXN_REFUND, reference_id=str(booking.id),
                  description=f"Hoàn tiền hủy đặt phòng {room.room_name} ngày {booking.booking_date}")
    return booking


def list_bookings_by_date(db: Session, booking_date: date,
                          room_id: Optional[int] = None) -> List[RoomBooking]:
    """GET /api/admin/room-bookings: liệt kê lượt đặt phòng trong một ngày (cho thủ thư)."""
    stmt = select(RoomBooking).where(RoomBooking.booking_date == booking_date)
    if room_id is not None:
        stmt = stmt.where(RoomBooking.room_id == room_id)
    return list(db.scalars(stmt.order_by(RoomBooking.slot_start)).all())


# ---------------------------------------------------------------- JOB-06
def apply_noshow_and_completed(db: Session, now: datetime) -> Dict[str, int]:
    """Không commit/close: caller (job hoặc test) quyết định transaction."""
    no_show = completed = 0
    candidates = db.query(RoomBooking).filter(RoomBooking.status.in_([CONFIRMED, CHECKED_IN])).all()
    for b in candidates:
        if b.status == CONFIRMED and b.checkin_time is None and now >= _slot_start_dt(b) + NO_SHOW_GRACE:
            b.status = NO_SHOW
            no_show += 1
        elif b.status == CHECKED_IN and now >= _slot_end_dt(b):
            b.status = COMPLETED
            completed += 1
    return {"no_show": no_show, "completed": completed}


def run_room_noshow_job(session_factory=SessionLocal, now: Optional[datetime] = None) -> Dict[str, int]:
    """JOB-06: quá 15 phút chưa check-in -> NO_SHOW; hết khung giờ (đã check-in) -> COMPLETED."""
    now = now or now_vn()
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
