from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    TIMESTAMP,
    func,
)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from loan import Loan, Waitlist

"""
Quản lý thông tin sách (Book), 
sách điện tử (Ebook) và bản sao sách (BookCopy)
"""
class Subject(Base):
    __tablename__ = "subjects"

    subject_code: Mapped[str] = mapped_column(String(50), primary_key=True)
    subject_name: Mapped[str] = mapped_column(String(150), nullable=False)
    department_name: Mapped[str] = mapped_column(String(100), nullable=False)

    books: Mapped[List["Book"]] = relationship("Book", back_populates="subject")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    books: Mapped[List["Book"]] = relationship("Book", back_populates="category")


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (
        CheckConstraint("available_stock >= 0", name="chk_book_available_stock_positive"),
        Index("idx_books_search_vector", "search_vector", postgresql_using="gin"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    author: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    publisher: Mapped[str] = mapped_column(String(150), nullable=False)
    publication_year: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cover_image_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    keywords: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    num_pages: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    book_type: Mapped[str] = mapped_column(String(50), nullable=False)
    available_stock: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    search_vector: Mapped[Optional[str]] = mapped_column(TSVECTOR, nullable=True)

    category_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    subject_code: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("subjects.subject_code", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False), server_default=func.now(), nullable=False
    )

    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="books")
    subject: Mapped[Optional["Subject"]] = relationship("Subject", back_populates="books")
    ebook: Mapped[Optional["Ebook"]] = relationship(
        "Ebook", back_populates="book", uselist=False, cascade="all, delete-orphan"
    )
    copies: Mapped[List["BookCopy"]] = relationship(
        "BookCopy", back_populates="book", cascade="all, delete-orphan"
    )
    loans: Mapped[List["Loan"]] = relationship("Loan", back_populates="book")
    waitlists: Mapped[List["Waitlist"]] = relationship("Waitlist", back_populates="book")


class Ebook(Base):
    __tablename__ = "ebooks"

    id: Mapped[int] = mapped_column(
        Integer, ForeignKey("books.id", ondelete="CASCADE"), primary_key=True
    )
    file_path: Mapped[str] = mapped_column(String(255), nullable=False)
    is_free: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)

    book: Mapped["Book"] = relationship("Book", back_populates="ebook")


class BookCopy(Base):
    __tablename__ = "book_copies"

    copy_barcode: Mapped[str] = mapped_column(String(100), primary_key=True)
    book_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("books.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    zone: Mapped[str] = mapped_column(String(50), nullable=False)
    floor: Mapped[str] = mapped_column(String(50), nullable=False)
    shelf: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), server_default="AVAILABLE", nullable=False
    )
    damage_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    book: Mapped["Book"] = relationship("Book", back_populates="copies")
    loans: Mapped[List["Loan"]] = relationship("Loan", back_populates="copy")
