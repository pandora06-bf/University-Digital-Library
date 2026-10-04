from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_account
from app.models.user import Account
from app.schemas.user import UserDashboardResponse, UserProfileResponse
from app.services.user_service import get_user_dashboard, get_user_profile

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me", response_model=UserProfileResponse)
def get_my_profile(
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    if not account.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài khoản chưa được liên kết với hồ sơ người dùng",
        )
    return get_user_profile(db, account.user)


@router.get("/me/dashboard", response_model=UserDashboardResponse)
def get_my_dashboard(
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
):
    if not account.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài khoản chưa được liên kết với hồ sơ người dùng",
        )
    return get_user_dashboard(db, account.user)