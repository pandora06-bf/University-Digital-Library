from datetime import date, datetime, time
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    TIMESTAMP,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (
        CheckConstraint("capacity > 0", name="chk_room_capacity_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    room_type: Mapped[str] = mapped_column(String(50), server_default="STUDY", nullable=False)
    floor: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), nullable=False
    )

    bookings: Mapped[List["RoomBooking"]] = relationship("RoomBooking", back_populates="room")


class RoomBooking(Base):
    __tablename__ = "room_bookings"
    __table_args__ = (
        CheckConstraint("attendee_count > 0", name="chk_room_booking_attendees_positive"),
        # Partial Index: UNIQUE room_id + booking_date + slot_start khi CONFIRMED hoặc CHECKED_IN
        Index(
            "uq_room_booking_active_slot",
            "room_id",
            "booking_date",
            "slot_start",
            unique=True,
            postgresql_where=text("status IN ('CONFIRMED', 'CHECKED_IN')"),
            sqlite_where=text("status IN ('CONFIRMED', 'CHECKED_IN')"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_code: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.user_code", ondelete="RESTRICT"), nullable=False, index=True
    )
    booking_date: Mapped[date] = mapped_column(Date, nullable=False)
    slot_start: Mapped[time] = mapped_column(Time, nullable=False)
    slot_end: Mapped[time] = mapped_column(Time, nullable=False)
    attendee_count: Mapped[int] = mapped_column(Integer, server_default="1", nullable=False)
    status: Mapped[str] = mapped_column(String(30), server_default="CONFIRMED", nullable=False)
    checkin_time: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=False), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), nullable=False
    )

    room: Mapped["Room"] = relationship("Room", back_populates="bookings")
    user: Mapped["User"] = relationship("User", back_populates="room_bookings")