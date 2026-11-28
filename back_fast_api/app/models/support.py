"""Phiếu hỗ trợ bạn đọc gửi cho thủ thư."""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text, TIMESTAMP, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    __table_args__ = (
        CheckConstraint("status IN ('OPEN', 'ANSWERED')", name="chk_support_ticket_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_code: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.user_code", ondelete="RESTRICT"), nullable=False, index=True
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    reply: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), server_default="OPEN", nullable=False, index=True)
    replied_by: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("users.user_code", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), nullable=False
    )
    replied_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=False), nullable=True)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_code])
