from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_account
from app.models.user import Account
from app.services.loan_service import lookup_fines_service

router = APIRouter(prefix="/api/fines", tags=["Fines"])


@router.get("/my-fines", summary="Biên lai nợ phạt của bản thân (3-08)")
def get_my_fines(
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    if not account.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài khoản chưa được liên kết với hồ sơ người dùng",
        )
    return lookup_fines_service(db, account.user.user_code)
