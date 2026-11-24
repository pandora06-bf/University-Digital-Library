from datetime import datetime
from typing import Optional, Union

from fastapi import APIRouter, Depends, Header, HTTPException, status, BackgroundTasks
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services import wallet_service as ws
from app.services.email_notifier import send_topup_confirmed

router = APIRouter(tags=["Webhooks"])


class BankEvent(BaseModel):
    """Payload webhook SePay (VA). Vẫn chấp nhận vài tên trường kiểu Casso."""
    model_config = ConfigDict(extra="ignore")
    id: Union[int, str] = Field(validation_alias=AliasChoices("id", "bank_tx_id", "tid"))
    gateway: Optional[str] = None
    amount: int = Field(validation_alias=AliasChoices("transferAmount", "amount"))
    content: Optional[str] = Field("", validation_alias=AliasChoices("content"))
    description: Optional[str] = None
    code: Optional[str] = None
    account_number: Optional[str] = Field(None, validation_alias=AliasChoices("accountNumber", "account_number"))
    sub_account: Optional[str] = Field(None, validation_alias=AliasChoices("subAccount", "sub_account"))
    transfer_type: str = Field("in", validation_alias=AliasChoices("transferType", "transfer_type"))
    reference_code: Optional[str] = Field(None, validation_alias=AliasChoices("referenceCode", "reference_code"))
    received_at: Optional[datetime] = Field(None, validation_alias=AliasChoices("transactionDate", "when"))

    @field_validator("id", mode="after")
    @classmethod
    def _id_to_str(cls, v):
        return str(v)

    @field_validator("account_number", "sub_account", mode="before")
    @classmethod
    def _num_to_str(cls, v):
        return None if v is None else str(v)


@router.post("/api/webhooks/bank")
def bank_webhook(event: BankEvent, tasks: BackgroundTasks, db: Session = Depends(get_db),
                 authorization: Optional[str] = Header(None),
                 x_api_key: Optional[str] = Header(None)):
    ws.verify_webhook_key(ws.extract_webhook_key(authorization, x_api_key))
    # Mọi kết quả hợp lệ đều trả 200 + success=true để SePay không retry vô ích.
    if event.transfer_type.lower() != "in":
        return {"success": True, "result": "IGNORED", "reason": "NOT_INCOMING"}
    if not ws.is_own_account(event.account_number, event.sub_account):
        return {"success": True, "result": "IGNORED", "reason": "OTHER_ACCOUNT"}
    content = event.content or event.description or ""
    result = ws.handle_bank_event_committed(
        db, bank_tx_id=event.id, amount=event.amount, content=content,
        code=event.code, description=event.description,
        account_number=event.sub_account or event.account_number,
        received_at=event.received_at.replace(tzinfo=None) if event.received_at else None)
    if result.get('result') == 'MATCHED':
        credited = db.get(User, result['user_code'])
        if credited:
            tasks.add_task(
                send_topup_confirmed,
                credited.email,
                credited.full_name,
                transaction_id=event.id,
                pay_code=result['pay_code'],
                amount=result['amount'],
                paid_at=ws.utcnow(),
                balance_after=result['balance_after'],
            )
    return {"success": True, **result}


@router.post("/api/dev/topups/{pay_code}/simulate")
def simulate_topup(pay_code: str, tasks: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Giả lập ngân hàng báo có (chỉ khi ENABLE_DEV_SIMULATE=True). Dùng đúng luồng webhook."""
    if not settings.ENABLE_DEV_SIMULATE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not Found")
    topup = ws.get_topup(db, user.user_code, pay_code)
    result = ws.handle_bank_event_committed(
        db, bank_tx_id=f"SIM-{topup.pay_code}", amount=topup.amount,
        content=f"CHUYEN TIEN {topup.pay_code}")
    if result.get('result') == 'MATCHED':
        tasks.add_task(
            send_topup_confirmed,
            user.email,
            user.full_name,
            transaction_id=f"SIM-{topup.pay_code}",
            pay_code=result['pay_code'],
            amount=result['amount'],
            paid_at=ws.utcnow(),
            balance_after=result['balance_after'],
        )
    return {"success": True, **result}
