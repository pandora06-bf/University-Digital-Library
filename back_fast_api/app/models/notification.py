"""Durable log of successfully dispatched messages."""
from datetime import datetime
from sqlalchemy import String, Integer, TIMESTAMP, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class EmailNotice(Base):
    __tablename__ = "email_notices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_key: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=False), server_default=func.now(), nullable=False)
