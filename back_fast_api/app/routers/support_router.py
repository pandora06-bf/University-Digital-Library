"""API phiếu hỗ trợ: bạn đọc gửi và xem phiếu của mình, thủ thư trả lời."""
from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User
from app.services import support_service as svc
from app.services.email_notifier import send_support_reply

router = APIRouter(tags=["Support"])


class TicketCreate(BaseModel):
    summary: str = Field(min_length=10, max_length=1000)

    @field_validator("summary", mode="before")
    @classmethod
    def strip(cls, value):
        return value.strip() if isinstance(value, str) else value


class TicketReply(BaseModel):
    reply: str = Field(min_length=1, max_length=2000)

    @field_validator("reply", mode="before")
    @classmethod
    def strip(cls, value):
        return value.strip() if isinstance(value, str) else value


@router.post("/api/support/tickets", status_code=status.HTTP_201_CREATED)
def create(body: TicketCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.serialize(svc.create_ticket(db, user.user_code, body.summary))


@router.get("/api/support/tickets/my")
def mine(page: int = Query(1, ge=1), size: int = Query(10, ge=1, le=50),
         user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.my_tickets(db, user.user_code, page, size)


@router.get("/api/admin/support/tickets", dependencies=[Depends(require_roles("ADMIN", "LIBRARIAN"))])
def admin_list(status: str = Query("open", pattern="^(open|answered|all)$"),
               page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
               db: Session = Depends(get_db)):
    return svc.all_tickets(db, status, page, size)


@router.post("/api/admin/support/tickets/{ticket_id}/reply")
def admin_reply(ticket_id: int, body: TicketReply, tasks: BackgroundTasks,
                admin=Depends(require_roles("ADMIN", "LIBRARIAN")), db: Session = Depends(get_db)):
    librarian = admin.user.user_code if admin.user else None
    ticket = svc.reply_ticket(db, ticket_id, body.reply, librarian)
    reader = ticket.user
    if reader and reader.email:
        tasks.add_task(send_support_reply, reader.email, reader.full_name, ticket.id,
                       ticket.summary, ticket.reply)
    return svc.serialize(ticket, with_reader=True)
