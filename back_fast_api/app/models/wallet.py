from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import (
    CheckConstraint,
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
    from app.models.user import User


class TopUp(Base):
    __tablename__ = "top_ups"
    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_topup_amount_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_code: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.user_code", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    pay_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    bank_tx_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    status: Mapped[str] = mapped_column(String(20), server_default="PENDING", nullable=False)
    expired_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="top_ups")


class WalletTxn(Base):
    __tablename__ = "wallet_txns"
    __table_args__ = (
        CheckConstraint("balance_before >= 0", name="chk_wallet_txns_before_non_negative"),
        CheckConstraint("balance_after >= 0", name="chk_wallet_txns_after_non_negative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_code: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.user_code", ondelete="RESTRICT"), nullable=False, index=True
    )
    txn_type: Mapped[str] = mapped_column(String(30), nullable=False)  # TOPUP, FINE_PAYMENT, REFUND
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_before: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="wallet_txns")


class UnmatchedTx(Base):
    __tablename__ = "unmatched_tx"
    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_unmatched_tx_amount_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bank_tx_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    bank_account_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    transfer_content: Mapped[str] = mapped_column(Text, nullable=False)
    received_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False)
    status: Mapped[str] = mapped_column(String(30), server_default="UNRESOLVED", nullable=False)
    resolved_by: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("users.user_code", ondelete="SET NULL"), nullable=True
    )
    assigned_user_code: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("users.user_code", ondelete="RESTRICT"), nullable=True, index=True
    )
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), nullable=False
    )

    resolver: Mapped[Optional["User"]] = relationship("User", foreign_keys=[resolved_by])