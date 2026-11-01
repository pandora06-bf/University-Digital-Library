from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.book import Book
from app.models.fine import Fine
from app.models.loan import Loan
from app.models.user import User


def get_user_profile(db: Session, current_user: User) -> Dict[str, Any]:
    # Đếm số sách đang mượn (chưa có ngày trả hoặc trạng thái chưa kết thúc)
    current_borrow_count = (
        db.scalar(
            select(func.count(Loan.id)).where(
                Loan.user_code == current_user.user_code,
                Loan.return_date.is_(None),
            )
        )
        or 0
    )

    return {
        "full_name": current_user.full_name,
        "user_code": current_user.user_code,
        "phone_number": current_user.phone_number,
        "email": current_user.email,
        "department": current_user.department,
        "role": current_user.account.role if current_user.account else "STUDENT",
        "is_locked": current_user.is_borrowing_blocked if current_user.account else False,
        "total_fines": current_user.total_fines,
        "service_balance": getattr(current_user, "service_balance", 0),
        "borrow_limit": f"{current_borrow_count}/{current_user.max_borrow_limit}",  # <--- Hạn mức hiển thị dạng 1/3 hoặc 0/5
    }


def _format_loan_item(loan: Loan, now: datetime) -> Dict[str, Any]:
    is_overdue = (
        loan.return_date is None and loan.due_date < now
    ) or loan.loan_status == "OVERDUE"

    fine_amount = loan.fine.total_amount if loan.fine else None
    fine_status = loan.fine.payment_status if loan.fine else None

    return {
        "id": loan.id,
        "book_id": loan.book_id,
        "book_title": loan.book.title if loan.book else "",
        "book_author": loan.book.author if loan.book else "",
        "copy_barcode": loan.copy_barcode,
        "loan_type": loan.loan_type,
        "loan_status": loan.loan_status,
        "borrow_date": loan.borrow_date,
        "due_date": loan.due_date,
        "return_date": loan.return_date,
        "renewal_count": loan.renewal_count,
        "is_overdue": is_overdue,
        "fine_amount": fine_amount,
        "fine_status": fine_status,
    }


def get_user_dashboard(db: Session, current_user: User) -> Dict[str, Any]:
    now = datetime.now()

    # 1. Danh sách đang mượn (return_date IS NULL)
    active_stmt = (
        select(Loan)
        .options(joinedload(Loan.book), joinedload(Loan.fine))
        .where(
            Loan.user_code == current_user.user_code,
            Loan.return_date.is_(None),
        )
        .order_by(Loan.due_date.asc())
    )
    active_loans = db.scalars(active_stmt).all()

    current_loans_data: List[Dict[str, Any]] = []
    total_overdue = 0

    for loan in active_loans:
        item = _format_loan_item(loan, now)
        if item["is_overdue"]:
            total_overdue += 1
        current_loans_data.append(item)

    # 2. Lịch sử mượn gần đây (10 bản ghi mới nhất)
    history_stmt = (
        select(Loan)
        .options(joinedload(Loan.book), joinedload(Loan.fine))
        .where(Loan.user_code == current_user.user_code)
        .order_by(Loan.borrow_date.desc())
        .limit(10)
    )
    history_loans = db.scalars(history_stmt).all()
    recent_history_data = [_format_loan_item(loan, now) for loan in history_loans]

    return {
        "total_borrowing": len(current_loans_data),
        "total_overdue": total_overdue,
        "total_fines": current_user.total_fines,
        "current_loans": current_loans_data,
        "recent_history": recent_history_data,
    }