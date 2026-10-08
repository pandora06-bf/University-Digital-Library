# from fastapi import APIRouter

# router = APIRouter(
#     prefix="/api/loans",
#     tags=["Loans"],
# )


# @router.get("")
# def get_loans():
#     return {
#         "message": "Get loans API",
#         "data": [],
#     }
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import get_current_account
from app.models.book import Book
from app.models.user import Account

# Import model Loan tương ứng trong project
try:
    from app.models.loan import Loan
except ImportError:
    try:
        from app.models.loan import Loan
    except ImportError:
        from app.models.book import Loan

router = APIRouter(
    prefix="/api/loans",
    tags=["Loans"],
)


def format_loan_response(loan: Loan):
    """Hàm định dạng dữ liệu trả về kèm thông tin cơ bản của cuốn sách."""
    return {
        "id": loan.id,
        "user_code": getattr(loan, "user_code", getattr(loan, "student_code", None)),
        "book_id": loan.book_id,
        "book_title": loan.book.title if hasattr(loan, "book") and loan.book else None,
        "book_author": loan.book.author if hasattr(loan, "book") and loan.book else None,
        "copy_barcode": loan.copy_barcode,
        "loan_type": loan.loan_type,
        "loan_status": loan.loan_status,
        "borrow_date": loan.borrow_date,
        "due_date": loan.due_date,
        "return_date": loan.return_date,
        "renewal_count": loan.renewal_count,
        "checkout_condition": loan.checkout_condition,
        "checkin_condition": loan.checkin_condition,
        "ebook_access_token": loan.ebook_access_token,
    }


@router.get("/me")
def get_my_loans(
    loan_status: Optional[str] = Query(None, description="Lọc theo trạng thái: BORROWED, RETURNED, OVERDUE"),
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

    # Xác định tên thuộc tính trong model (user_code hoặc student_code)
    code_attr = getattr(Loan, "user_code", getattr(Loan, "student_code", None))
    query = select(Loan).where(code_attr == current_code)

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
    loan_status: Optional[str] = Query(None, description="Lọc trạng thái: REQUESTED, BORROWED, RETURNED, OVERDUE"),
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

    code_attr = getattr(Loan, "user_code", getattr(Loan, "student_code", None))
    query = select(Loan)

    if user_code:
        query = query.where(code_attr == user_code)
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