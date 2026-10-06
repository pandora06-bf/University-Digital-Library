from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    DECIMAL,
    ForeignKey,
    Integer,
    String,
    Text,
    TIMESTAMP,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from loan import Loan
    from user import User
"""Quản lý phạt vi phạm (Fine) và thanh toán phạt (FinePayment)"""

class Fine(Base):
    __tablename__ = "fines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    loan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("loans.id", ondelete="RESTRICT"), unique=True, nullable=False
    )
    user_code: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.user_code", ondelete="RESTRICT"), nullable=False, index=True
    )
    overdue_days: Mapped[int] = mapped_column(Integer, nullable=False)
    fine_rate: Mapped[Decimal] = mapped_column(
        DECIMAL(10, 2), server_default="5000.00", nullable=False
    )
    total_amount: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    payment_status: Mapped[str] = mapped_column(
        String(20), server_default="UNPAID", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), nullable=False
    )

    loan: Mapped["Loan"] = relationship("Loan", back_populates="fine")
    user: Mapped["User"] = relationship("User", back_populates="fines")


class FinePayment(Base):
    __tablename__ = "fine_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_code: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.user_code", ondelete="RESTRICT"), nullable=False, index=True
    )
    admin_collector_code: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("users.user_code", ondelete="SET NULL"), nullable=True
    )
    amount_paid: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)  # CASH, BANK_TRANSFER
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payment_time: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), nullable=False
    )

    payer: Mapped["User"] = relationship(
        "User", foreign_keys=[user_code], back_populates="payments_made"
    )
    collector: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[admin_collector_code], back_populates="payments_collected"
    )