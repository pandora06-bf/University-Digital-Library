"""Plain-text SMTP email; failure never rolls back a loan."""
from datetime import datetime, timezone
from email.message import EmailMessage
import os
import smtplib
import ssl
from zoneinfo import ZoneInfo


def send_due_email(recipient: str, name: str, title: str, due_date: datetime) -> None:
    host = os.getenv("SMTP_HOST", "")
    sender = os.getenv("SMTP_FROM", "")
    if not host or not sender:
        raise RuntimeError("SMTP_HOST and SMTP_FROM are required for reminders")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    local = due_date.replace(tzinfo=timezone.utc).astimezone(ZoneInfo("Asia/Ho_Chi_Minh"))
    msg = EmailMessage()
    msg["Subject"] = "Thư viện - Nhắc hạn trả sách"
    msg["From"] = sender
    msg["To"] = recipient
    msg.set_content(f"Xin chào {name},\n\nSách: {title}\nHạn trả: {local:%d/%m/%Y %H:%M} (giờ Việt Nam).\nVui lòng trả sách đúng hạn hoặc gia hạn trên hệ thống.\n\nThư viện đại học")
    for attempt in range(3):
        try:
            if os.getenv("SMTP_SSL", "false").lower() == "true":
                with smtplib.SMTP_SSL(host, port, timeout=10, context=ssl.create_default_context()) as smtp:
                    if user: smtp.login(user, password)
                    smtp.send_message(msg)
            else:
                with smtplib.SMTP(host, port, timeout=10) as smtp:
                    smtp.starttls(context=ssl.create_default_context())
                    if user: smtp.login(user, password)
                    smtp.send_message(msg)
            return
        except (smtplib.SMTPException, OSError):
            if attempt == 2: raise
