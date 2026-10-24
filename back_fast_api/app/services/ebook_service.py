"""Private PDF access and eBook loan lifecycle. Dates stored as naive UTC, matching legacy columns."""
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from secrets import token_urlsafe

from fastapi import HTTPException
from jose import JWTError, jwt
from pypdf import PdfReader, PdfWriter
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.book import Book
from app.models.loan import Loan
from app.models.user import User
from app.services.upload_service import resolve_private_pdf

ACTIVE = ("PENDING_PICKUP", "BORROWED", "OVERDUE")

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def get_ebook(db: Session, book_id: int) -> Book:
    book = db.get(Book, book_id)
    if book is None or book.book_type != "EBOOK" or book.ebook is None:
        raise HTTPException(404, "Không tìm thấy eBook")
    return book

def pdf_preview(book: Book) -> bytes:
    path = resolve_private_pdf(book.ebook.file_path)
    reader = PdfReader(path)
    if book.ebook.is_free:
        return path.read_bytes()
    writer = PdfWriter()
    for page in reader.pages[:min(book.ebook.preview_pages, 10, len(reader.pages))]:
        writer.add_page(page)
    out = BytesIO()
    writer.write(out)
    return out.getvalue()

def make_read_token(loan: Loan, user_code: str) -> str:
    # exp equals persisted due_date (never grant access beyond the loan's due_date).
    expires = loan.due_date.replace(tzinfo=timezone.utc)
    return jwt.encode({"sub": user_code, "loan_id": loan.id, "book_id": loan.book_id,
                       "scope": "ebook_read", "exp": expires},
                      settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def borrow(db: Session, user_code: str, book_id: int) -> Loan:
    user = db.query(User).filter(User.user_code == user_code).with_for_update().first()
    if user is None:
        raise HTTPException(404, "Không tìm thấy bạn đọc")
    book = get_ebook(db, book_id)
    now = utcnow()
    current = (db.query(Loan).filter(Loan.user_code == user_code, Loan.book_id == book_id,
        Loan.loan_type == "EBOOK", Loan.loan_status.in_(ACTIVE), Loan.due_date > now)
        .order_by(Loan.id.desc()).first())
    if current:
        return current
    if user.is_borrowing_blocked or user.total_fines > 0:
        raise HTTPException(403, "Bạn đọc đang bị khóa hoặc còn nợ phạt")
    active_count = db.query(func.count(Loan.id)).filter(Loan.user_code == user_code,
        Loan.loan_status.in_(ACTIVE)).scalar() or 0
    if active_count >= user.max_borrow_limit:
        raise HTTPException(409, "Đã đạt hạn mức mượn")
    loan = Loan(user_code=user_code, book_id=book_id, loan_type="EBOOK",
        loan_status="BORROWED", borrow_date=now,
        due_date=now + timedelta(days=book.ebook.borrow_days),
        ebook_access_token=token_urlsafe(32))
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return loan

def authorized_file(db: Session, user_code: str, book_id: int, read_token: str) -> Path:
    try:
        payload = jwt.decode(read_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise HTTPException(403, "read_token không hợp lệ hoặc đã hết hạn") from exc
    if payload.get("scope") != "ebook_read" or payload.get("sub") != user_code or payload.get("book_id") != book_id:
        raise HTTPException(403, "read_token không cấp quyền cho sách này")
    loan = db.get(Loan, payload.get("loan_id")) if isinstance(payload.get("loan_id"), int) else None
    if not loan or loan.loan_type != "EBOOK" or loan.user_code != user_code or loan.book_id != book_id:
        raise HTTPException(403, "Không có quyền đọc")
    if loan.loan_status not in ACTIVE or loan.due_date <= utcnow():
        raise HTTPException(403, "Phiếu mượn hết hiệu lực")
    return resolve_private_pdf(get_ebook(db, book_id).ebook.file_path)

def return_ebook(db: Session, user_code: str, loan_id: int) -> Loan:
    loan = (db.query(Loan).filter(Loan.id == loan_id, Loan.user_code == user_code).with_for_update().first())
    if not loan or loan.loan_type != "EBOOK":
        raise HTTPException(404, "Không tìm thấy phiếu mượn eBook")
    if loan.loan_status not in ACTIVE:
        raise HTTPException(409, "Phiếu mượn đã đóng")
    loan.loan_status = "RETURNED"
    loan.return_date = utcnow()
    loan.ebook_access_token = None
    db.commit()
    db.refresh(loan)
    return loan
