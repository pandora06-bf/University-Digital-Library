from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_account
from app.models.loan import Loan
from app.models.user import Account
from app.schemas.loan import LoanResponse, PhysicalLoanRequest
from app.services.loan_service import request_physical_loan_service

router = APIRouter(
    prefix="/api/loans",
    tags=["Loans"],
)


def format_loan_response(loan: Loan):
    """Hàm định dạng dữ liệu trả về kèm thông tin cơ bản của cuốn sách."""
    return {
        "id": loan.id,
        "user_code": loan.user_code,
        "book_id": loan.book_id,
        "book_title": loan.book.title if loan.book else None,
        "book_author": loan.book.author if loan.book else None,
        "copy_barcode": loan.copy_barcode,
        "loan_code": loan.loan_code,
        "loan_type": loan.loan_type,
        "loan_status": loan.loan_status,
        "borrow_date": loan.borrow_date,
        "due_date": loan.due_date,
        "pickup_deadline": loan.pickup_deadline,
        "return_date": loan.return_date,
        "renewal_count": loan.renewal_count,
        "checkout_condition": loan.checkout_condition,
        "checkin_condition": loan.checkin_condition,
        "ebook_access_token": loan.ebook_access_token,
    }


# ----------------------------------------------------------------------
# Đặt mượn sách vật lý — giữ chỗ 24h tới quầy nhận (3-01.a)
# ----------------------------------------------------------------------
@router.post(
    "/physical/request",
    response_model=LoanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Đặt mượn sách vật lý (giữ chỗ tới quầy nhận trong 24 giờ)",
)
def request_physical_loan(
    payload: PhysicalLoanRequest,
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> Loan:
    if not account.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài khoản chưa được liên kết với hồ sơ người dùng",
        )
    return request_physical_loan_service(db, account.user.user_code, payload.book_id)


@router.get("/me")
def get_my_loans(
    loan_status: Optional[str] = Query(None, description="Lọc theo trạng thái: BORROWED, RETURNED, OVERDUE, LOST"),
    skip: int = Query(0, ge=0, description="Số bản ghi bỏ qua (phân trang)"),
    limit: int = Query(10, ge=1, le=50, description="Số lượng bản ghi lấy ra"),
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    """Lấy toàn bộ lịch sử mượn trả của người dùng đang đăng nhập."""
    if not account.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài khoản chưa được liên kết với hồ sơ người dùng",
        )

    current_code = account.user.user_code

    query = select(Loan).where(Loan.user_code == current_code)

    if loan_status:
        query = query.where(Loan.loan_status == loan_status.upper())

    # Sắp xếp các lượt mượn mới nhất lên đầu
    query = query.order_by(desc(Loan.borrow_date)).offset(skip).limit(limit)
    loans = db.scalars(query).all()

    return {
        "total": len(loans),
        "skip": skip,
        "limit": limit,
        "data": [format_loan_response(loan) for loan in loans],
    }


@router.get("")
def get_all_loans(
    user_code: Optional[str] = Query(None, description="Tìm theo mã bạn đọc (SV/GV)"),
    loan_status: Optional[str] = Query(None, description="Lọc trạng thái: REQUESTED, BORROWED, RETURNED, OVERDUE, LOST"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    """Dành cho Thủ thư / Admin tra cứu và quản lý danh sách phiếu mượn."""
    if account.role not in ["ADMIN", "LIBRARIAN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện tra cứu này",
        )

    query = select(Loan)

    if user_code:
        query = query.where(Loan.user_code == user_code)
    if loan_status:
        query = query.where(Loan.loan_status == loan_status.upper())

    query = query.order_by(desc(Loan.borrow_date)).offset(skip).limit(limit)
    loans = db.scalars(query).all()

    return {
        "total": len(loans),
        "skip": skip,
        "limit": limit,
        "data": [format_loan_response(loan) for loan in loans],
    }
