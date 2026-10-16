from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DECIMAL,
    ForeignKey,
    Integer,
    String,
    TIMESTAMP,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.fine import Fine, FinePayment
    from app.models.loan import Loan, Waitlist, Incident
    from app.models.room import RoomBooking
    from app.models.wallet import TopUp, WalletTxn
    
"""
Quản lý thông tin người dùng (User) và tài khoản (Account)"""

class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # STUDENT, LECTURER, ADMIN
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), nullable=False
    )

    # Quan hệ 1-1 với User
    user: Mapped[Optional["User"]] = relationship(
        "User", back_populates="account", uselist=False
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("total_fines >= 0", name="chk_user_total_fines_positive"),
        CheckConstraint("service_balance >= 0", name="chk_user_service_balance_non_negative"),
    )

    user_code: Mapped[str] = mapped_column(String(50), primary_key=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    academic_title: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    user_type: Mapped[str] = mapped_column(String(20), server_default="STUDENT", nullable=False)
    max_borrow_limit: Mapped[int] = mapped_column(Integer, server_default="3", nullable=False)
    max_borrow_days: Mapped[int] = mapped_column(Integer, server_default="14", nullable=False)

    is_borrowing_blocked: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    total_fines: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), server_default="0.00", nullable=False)
    service_balance: Mapped[int] = mapped_column(
        Integer, server_default="0", default=0, nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    account: Mapped["Account"] = relationship("Account", back_populates="user")
    loans: Mapped[List["Loan"]] = relationship("Loan", back_populates="user")
    waitlists: Mapped[List["Waitlist"]] = relationship("Waitlist", back_populates="user")
    fines: Mapped[List["Fine"]] = relationship("Fine", back_populates="user")
    payments_made: Mapped[List["FinePayment"]] = relationship(
        "FinePayment", foreign_keys="FinePayment.user_code", back_populates="payer"
    )
    payments_collected: Mapped[List["FinePayment"]] = relationship(
        "FinePayment", foreign_keys="FinePayment.admin_collector_code", back_populates="collector"
    )
    incidents: Mapped[List["Incident"]] = relationship("Incident", back_populates="user")
    room_bookings: Mapped[List["RoomBooking"]] = relationship("RoomBooking", back_populates="user")
    top_ups: Mapped[List["TopUp"]] = relationship("TopUp", back_populates="user")
    wallet_txns: Mapped[List["WalletTxn"]] = relationship("WalletTxn", back_populates="user")