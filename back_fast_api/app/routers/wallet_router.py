from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services import wallet_service as ws

router = APIRouter(prefix="/api/wallet", tags=["Wallet"])


class TopUpCreate(BaseModel):
    amount: int


@router.get("")
def get_wallet(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"user_code": user.user_code, "balance": ws.get_balance(db, user.user_code), "currency": "VND"}


@router.get("/transactions")
def get_transactions(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ws.list_transactions(db, user.user_code, page, size)


@router.post("/topups", status_code=status.HTTP_201_CREATED)
def create_topup(data: TopUpCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        topup = ws.create_topup(db, user.user_code, data.amount)
        response = ws.serialize_topup(topup)
        db.commit()
        return response
    except Exception:
        db.rollback()
        raise


@router.get("/topups/{pay_code}")
def get_topup(pay_code: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    topup = ws.get_topup(db, user.user_code, pay_code)
    # Hiển thị EXPIRED ngay cả khi JOB-07 chưa chạy tới.
    if topup.status == ws.PENDING and topup.expired_at <= ws.utcnow():
        topup.status = ws.EXPIRED
        db.commit()
    return ws.serialize_topup(topup)
