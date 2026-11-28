"""API chatbot: dùng được cả khi chưa đăng nhập."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import bearer_scheme, get_current_account
from app.services.chat import rate_limit, service
from app.services.chat.llm_client import LLMUnavailable

router = APIRouter(prefix="/api/chat", tags=["Chatbot"])

MAX_QUESTION = 1000


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=12)
    share_personal: bool = False

    @model_validator(mode="after")
    def check_turns(self):
        if self.messages[0].role != "user" or self.messages[-1].role != "user":
            raise ValueError("Hội thoại phải bắt đầu và kết thúc bằng tin của người dùng")
        if not self.messages[-1].content.strip() or len(self.messages[-1].content) > MAX_QUESTION:
            raise ValueError("Câu hỏi trống hoặc quá dài")
        return self


def get_optional_account(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """Không gửi token = khách. Token sai hoặc hết hạn vẫn trả 401 như các API khác."""
    return None if credentials is None else get_current_account(credentials, db)


@router.get("/status")
def chat_status():
    return {"enabled": settings.CHATBOT_ENABLED}


@router.post("")
def chat(payload: ChatRequest, request: Request, account=Depends(get_optional_account),
         db: Session = Depends(get_db)):
    if not settings.CHATBOT_ENABLED:
        raise HTTPException(404, "Trợ lý ảo chưa được bật")
    user_code = account.user.user_code if account is not None and account.user else None
    host = request.client.host if request.client else "unknown"
    rate_limit.check(f"user:{user_code}" if user_code else f"ip:{host}", signed_in=user_code is not None)
    try:
        return service.answer(db, [m.model_dump() for m in payload.messages],
                              user_code=user_code, share_personal=payload.share_personal)
    except LLMUnavailable as exc:
        raise HTTPException(503, "Trợ lý ảo đang tạm nghỉ, vui lòng thử lại sau") from exc
