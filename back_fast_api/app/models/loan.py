from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    CheckConstraint,
    DECIMAL,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    TIMESTAMP,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.book import Book, BookCopy
    from app.models.fine import Fine
    from app.models.user import User


class Loan(Base):
    __tablename__ = "loans"
    __table_args__ = (
        CheckConstraint(
            "loan_status IN ('PENDING_PICKUP', 'REQUESTED', 'BORROWED', 'RETURNED', 'OVERDUE', 'CANCELLED', 'LOST', 'EXPIRED')",
            name="chk_loan_status_valid",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_code: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.user_code", ondelete="RESTRICT"), nullable=False, index=True
    )
    book_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("books.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    copy_barcode: Mapped[Optional[str]] = mapped_column(
        String(100), ForeignKey("book_copies.copy_barcode", ondelete="SET NULL"), nullable=True
    )
    loan_type: Mapped[str] = mapped_column(String(20), nullable=False)
    loan_status: Mapped[str] = mapped_column(String(30), nullable=False, default="BORROWED")
    loan_code: Mapped[Optional[str]] = mapped_column(String(30), unique=True, nullable=True)

    # Naive timestamps in this table represent UTC; clients convert them for display.
    borrow_date: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False)
    due_date: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False)
    pickup_deadline: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=False), nullable=True)
    return_date: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=False), nullable=True)
    renewal_count: Mapped[int] = mapped_column(SmallInteger, server_default="0", nullable=False)
    checkout_condition: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checkin_condition: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ebook_access_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="loans")
    book: Mapped["Book"] = relationship("Book", back_populates="loans")
    copy: Mapped[Optional["BookCopy"]] = relationship("BookCopy", back_populates="loans")
    fine: Mapped[Optional["Fine"]] = relationship("Fine", back_populates="loan", uselist=False)
    incidents: Mapped[List["Incident"]] = relationship("Incident", back_populates="loan")


class Waitlist(Base):
    __tablename__ = "waitlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_code: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.user_code", ondelete="CASCADE"), nullable=False, index=True
    )
    book_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True
    )
    queue_position: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(30), server_default="WAITING", nullable=False)
    hold_expires_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=False), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="waitlists")
    book: Mapped["Book"] = relationship("Book", back_populates="waitlists")


class Incident(Base):
    __tablename__ = "incidents"
    __table_args__ = (
        CheckConstraint("penalty_amount >= 0", name="chk_incident_penalty_amount_non_negative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    loan_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("loans.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_code: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.user_code", ondelete="RESTRICT"), nullable=False, index=True
    )
    incident_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), server_default="NORMAL", nullable=False)
    penalty_amount: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), server_default="0.00", nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), server_default="PENDING", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), nullable=False
    )

    loan: Mapped[Optional["Loan"]] = relationship("Loan", back_populates="incidents")
    user: Mapped["User"] = relationship("User", back_populates="incidents")