from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_account
from app.models.user import Account
from app.schemas.loan import (
    FineCollectRequest,
    LoanCheckinRequest,
    LoanCheckoutRequest,
)
from app.services.loan_service import (
    checkin_at_counter_service,
    checkout_at_counter_service,
    collect_counter_fines_service,
    lookup_fines_service,
    lookup_loans_service,
)

router = APIRouter(prefix="/api/admin", tags=["check-in/check-out"])


def verify_librarian(account: Account = Depends(get_current_account)) -> Account:
    """Chốt chặn phân quyền: Chỉ Admin / Thủ thư được gọi các API này (NFR-SE-03)"""
    if account.role not in ["ADMIN", "LIBRARIAN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ thủ thư mới có quyền thực hiện thao tác tại quầy"
        )
    return account


# ----------------------------------------------------------------------
# 1. GET /api/admin/loans/lookup: Tra cứu phiếu mượn theo mã mượn / MSSV
# ----------------------------------------------------------------------
@router.get("/loans/lookup", summary="Tra cứu phiếu mượn theo mã mượn hoặc MSSV")
def api_lookup_loans(
    q: str = Query(..., description="Nhập mã mượn (ID) hoặc MSSV (user_code)"),
    db: Session = Depends(get_db),
    admin: Account = Depends(verify_librarian),
):
    loans = lookup_loans_service(db=db, q=q)
    return {
        "total": len(loans),
        "data": [
            {
                "id": loan.id,
                "user_code": loan.user_code,
                "book_id": loan.book_id,
                "book_title": loan.book.title if loan.book else None,
                "copy_barcode": loan.copy_barcode,
                "loan_status": loan.loan_status,
                "borrow_date": loan.borrow_date,
                "due_date": loan.due_date,
            }
            for loan in loans
        ]
    }


# ----------------------------------------------------------------------
# 2. POST /api/admin/loans/checkout: Check-out xuất mượn sách tại quầy
# ----------------------------------------------------------------------
@router.post("/loans/checkout", summary="Xác nhận giao sách cho bạn đọc (Check-out)")
def api_checkout_loan(
    payload: LoanCheckoutRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: Account = Depends(verify_librarian),
):
    loan = checkout_at_counter_service(
        db=db,
        background_tasks=background_tasks,
        copy_barcode=payload.copy_barcode,
        loan_id=payload.loan_id,
        user_code=payload.user_code,
        condition_notes=payload.condition_notes,
    )
    return {
        "message": "Check-out thành công",
        "data": {
            "loan_id": loan.id,
            "user_code": loan.user_code,
            "book_id": loan.book_id,
            "copy_barcode": loan.copy_barcode,
            "loan_status": loan.loan_status,
            "due_date": loan.due_date,
            "checkout_condition": loan.checkout_condition,
        }
    }


# ----------------------------------------------------------------------
# 3. POST /api/admin/loans/checkin: Check-in nhận trả sách tại quầy
# ----------------------------------------------------------------------
@router.post("/loans/checkin", summary="Nhận sách trả lại, tính phạt quá hạn hoặc báo sự cố")
def api_checkin_loan(
    payload: LoanCheckinRequest,
    db: Session = Depends(get_db),
    admin: Account = Depends(verify_librarian),
):
    result = checkin_at_counter_service(
        db=db,
        copy_barcode=payload.copy_barcode,
        condition_notes=payload.condition_notes,
        is_lost=payload.is_lost,
        is_damaged=payload.is_damaged,
        damage_penalty=payload.damage_penalty,
    )
    return result


# ----------------------------------------------------------------------
# 4. GET /api/admin/fines/lookup: Tra cứu nợ phạt theo MSSV
# ----------------------------------------------------------------------
@router.get("/fines/lookup", summary="Tra cứu công nợ phạt của bạn đọc theo MSSV")
def api_lookup_fines(
    user_code: str = Query(..., description="MSSV/Mã bạn đọc cần tra cứu"),
    db: Session = Depends(get_db),
    admin: Account = Depends(verify_librarian),
):
    return lookup_fines_service(db=db, user_code=user_code)


# ----------------------------------------------------------------------
# 5. POST /api/admin/fines/collect: Thu tiền phạt mặt trực tiếp tại quầy
# ----------------------------------------------------------------------
@router.post("/fines/collect", summary="Xác nhận đã thu đủ tiền phạt bằng tiền mặt tại quầy")
def api_collect_fines(
    payload: FineCollectRequest,
    db: Session = Depends(get_db),
    admin: Account = Depends(verify_librarian),
):
    admin_code = admin.user.user_code if admin.user else "ADMIN"
    payment = collect_counter_fines_service(
        db=db,
        user_code=payload.user_code,
        amount=payload.amount,
        admin_collector_code=admin_code,
        notes=payload.notes,
    )
    return {
        "message": "Xác nhận thu phạt thành công",
        "receipt": {
            "payment_id": payment.id,
            "user_code": payment.user_code,
            "amount_paid": payment.amount_paid,
            "payment_method": payment.payment_method,
            "payment_date": payment.payment_date,
            "admin_collector_code": payment.admin_collector_code,
        }
    }