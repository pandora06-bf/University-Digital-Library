from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
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
    from book import Book, BookCopy
    from fine import Fine
    from user import User

"""Quản lý mượn trả sách (Loan) và danh sách chờ mượn (Waitlist)"""
class Loan(Base):
    __tablename__ = "loans"

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
    loan_status: Mapped[str] = mapped_column(String(30), nullable=False)
    borrow_date: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False)
    due_date: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), nullable=False)
    return_date: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=False), nullable=True)
    renewal_count: Mapped[int] = mapped_column(SmallInteger, server_default="0", nullable=False)
    checkout_condition: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checkin_condition: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ebook_access_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="loans")
    book: Mapped["Book"] = relationship("Book", back_populates="loans")
    copy: Mapped[Optional["BookCopy"]] = relationship("BookCopy", back_populates="loans")
    fine: Mapped[Optional["Fine"]] = relationship("Fine", back_populates="loan", uselist=False)


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
    status: Mapped[str] = mapped_column(
        String(30), server_default="WAITING", nullable=False
    )
    hold_expires_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=False), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="waitlists")
    book: Mapped["Book"] = relationship("Book", back_populates="waitlists")