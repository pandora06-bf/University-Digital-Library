"""Nghiệp vụ phiếu hỗ trợ. Caller quyết định gửi email sau khi hàm đã commit."""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.support import SupportTicket
from app.models.user import User

DAILY_TICKET_LIMIT = 3
OPEN, ANSWERED = "OPEN", "ANSWERED"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def serialize(ticket: SupportTicket, with_reader: bool = False) -> dict:
    data = {"id": ticket.id, "summary": ticket.summary, "reply": ticket.reply, "status": ticket.status,
            "created_at": ticket.created_at, "replied_at": ticket.replied_at}
    if with_reader:
        data["user_code"] = ticket.user_code
        data["full_name"] = ticket.user.full_name if ticket.user else None
    return data


def create_ticket(db: Session, user_code: str, summary: str) -> SupportTicket:
    # Khóa dòng người dùng để hai lần gửi song song không vượt hạn mức
    db.execute(select(User.user_code).where(User.user_code == user_code).with_for_update())
    now = _utcnow()
    recent = db.scalar(select(func.count(SupportTicket.id)).where(
        SupportTicket.user_code == user_code, SupportTicket.created_at > now - timedelta(days=1))) or 0
    if recent >= DAILY_TICKET_LIMIT:
        raise HTTPException(429, f"Mỗi ngày chỉ gửi được {DAILY_TICKET_LIMIT} yêu cầu hỗ trợ")
    ticket = SupportTicket(user_code=user_code, summary=summary, status=OPEN, created_at=now)
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def my_tickets(db: Session, user_code: str, page: int, size: int) -> dict:
    rows = db.scalars(select(SupportTicket).where(SupportTicket.user_code == user_code)
                      .order_by(SupportTicket.id.desc()).offset((page - 1) * size).limit(size)).all()
    return {"data": [serialize(row) for row in rows], "page": page, "size": size}


def all_tickets(db: Session, status: str, page: int, size: int) -> dict:
    query = select(SupportTicket)
    if status != "all":
        query = query.where(SupportTicket.status == status.upper())
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.options(joinedload(SupportTicket.user)).order_by(SupportTicket.id.desc())
                      .offset((page - 1) * size).limit(size)).all()
    return {"data": [serialize(row, with_reader=True) for row in rows],
            "total": total, "page": page, "size": size}


def reply_ticket(db: Session, ticket_id: int, reply: str, librarian_code: str | None) -> SupportTicket:
    ticket = db.scalar(select(SupportTicket).where(SupportTicket.id == ticket_id).with_for_update())
    if ticket is None:
        raise HTTPException(404, "Không tìm thấy yêu cầu hỗ trợ")
    if ticket.status != OPEN:
        raise HTTPException(409, "Yêu cầu này đã được trả lời")
    ticket.reply = reply
    ticket.status = ANSWERED
    ticket.replied_by = librarian_code
    ticket.replied_at = _utcnow()
    db.commit()
    db.refresh(ticket)
    return ticket
