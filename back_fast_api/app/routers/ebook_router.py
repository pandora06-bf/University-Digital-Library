from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services import ebook_service as service

router = APIRouter(tags=["eBook"] )

class EbookBorrowRequest(BaseModel):
    book_id: int = Field(gt=0)

@router.get("/api/ebooks/{book_id}/preview")
def preview(book_id: int, db: Session = Depends(get_db)):
    book = service.get_ebook(db, book_id)
    return Response(service.pdf_preview(book), media_type="application/pdf",
                    headers={"Cache-Control": "no-store", "Content-Disposition": "inline"})

@router.post("/api/loans/ebook/borrow")
def borrow_ebook(payload: EbookBorrowRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    loan = service.borrow(db, user.user_code, payload.book_id)
    return {"loan_id": loan.id, "book_id": loan.book_id, "loan_status": loan.loan_status,
            "due_date": loan.due_date, "read_token": service.make_read_token(loan, user.user_code),
            "stream_url": f"/api/ebooks/{loan.book_id}/stream"}

@router.get("/api/ebooks/{book_id}/stream")
def stream(book_id: int, read_token: str = Query(...),
           user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Backend tự trả nội dung (đĩa hoặc Cloudflare R2) sau khi kiểm tra read_token: không lộ link gốc.
    data = service.authorized_pdf(db, user.user_code, book_id, read_token)
    return Response(data, media_type="application/pdf",
                    headers={"Cache-Control": "private, no-store", "Content-Disposition": "inline"})

@router.post("/api/loans/{loan_id}/return-ebook")
def return_ebook(loan_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    loan = service.return_ebook(db, user.user_code, loan_id)
    return {"loan_id": loan.id, "loan_status": loan.loan_status, "return_date": loan.return_date}
