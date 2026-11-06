from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status, BackgroundTasks
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services import wallet_service as ws
from app.services.email_notifier import send_topup_confirmed

router = APIRouter(tags=["Webhooks"])


class BankEvent(BaseModel):
    """Payload kiểu SePay/Casso; chấp nhận vài tên trường phổ biến."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(validation_alias=AliasChoices("id", "bank_tx_id", "referenceCode", "tid"))
    amount: int = Field(validation_alias=AliasChoices("transferAmount", "amount"))
    content: str = Field("", validation_alias=AliasChoices("content", "description"))
    account_number: Optional[str] = Field(None, validation_alias=AliasChoices("accountNumber", "account_number"))
    transfer_type: str = Field("in", validation_alias=AliasChoices("transferType", "transfer_type"))
    received_at: Optional[datetime] = Field(None, validation_alias=AliasChoices("transactionDate", "when"))


def _extract_key(authorization: Optional[str], x_api_key: Optional[str]) -> Optional[str]:
    if x_api_key:
        return x_api_key
    if authorization:
        parts = authorization.split(" ", 1)  # "Apikey <key>" hoặc "Bearer <key>"
        return parts[1].strip() if len(parts) == 2 else authorization.strip()
    return None


@router.post("/api/webhooks/bank")
def bank_webhook(event: BankEvent, tasks: BackgroundTasks, db: Session = Depends(get_db),
                 authorization: Optional[str] = Header(None),
                 x_api_key: Optional[str] = Header(None)):
    ws.verify_webhook_key(_extract_key(authorization, x_api_key))
    if event.transfer_type.lower() != "in":
        return {"success": True, "result": "IGNORED"}
    result = ws.handle_bank_event_committed(
        db, bank_tx_id=event.id, amount=event.amount, content=event.content,
        account_number=event.account_number,
        received_at=event.received_at.replace(tzinfo=None) if event.received_at else None)
    if result.get('result') == 'MATCHED':
        credited = db.get(User, result['user_code'])
        if credited:
            tasks.add_task(send_topup_confirmed, credited.email, credited.full_name,
                           result['amount'], result['balance_after'])
    return {"success": True, **result}


@router.post("/api/dev/topups/{pay_code}/simulate")
def simulate_topup(pay_code: str, tasks: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Giả lập ngân hàng báo có (chỉ khi APP_ENV=dev). Dùng đúng luồng webhook."""
    if settings.APP_ENV.lower() != "dev":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not Found")
    topup = ws.get_topup(db, user.user_code, pay_code)
    result = ws.handle_bank_event_committed(
        db, bank_tx_id=f"SIM-{topup.pay_code}", amount=topup.amount,
        content=f"CHUYEN TIEN {topup.pay_code}")
    if result.get('result') == 'MATCHED':
        tasks.add_task(send_topup_confirmed, user.email, user.full_name,
                       result['amount'], result['balance_after'])
    return {"success": True, **result}
