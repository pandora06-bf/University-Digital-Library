"""Email templates for 3-06. Dispatch only after the business transaction commits."""
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo
from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

log = logging.getLogger(__name__)
VN = ZoneInfo("Asia/Ho_Chi_Minh")
TEMPLATE_DIR = Path(__file__).resolve().parents[2] / "templates" / "email"
environment = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=select_autoescape(["html", "xml"]), undefined=StrictUndefined)

def local_date(value):
    if value is None:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(VN).strftime("%d/%m/%Y, %H:%M")

def site_url(path=""):
    base = os.getenv("LIBRARY_URL", "http://localhost:5173").rstrip("/")
    parsed = urlparse(base)
    if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1")):
        raise ValueError("LIBRARY_URL phải dùng HTTPS hoặc HTTP localhost")
    if not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("LIBRARY_URL không hợp lệ")
    return base + "/" + path.lstrip("/")

def context_base(user_name):
    return {"user_name": user_name or "Bạn đọc", "library_name": os.getenv("LIBRARY_NAME", "Thư viện Số TDTU"),
            "support_email": os.getenv("SUPPORT_EMAIL", "library@example.edu.vn"),
            "library_url": site_url(), "my_books_url": site_url("my-books"),
            "pickup_url": site_url("my-books?tab=waitlist"), "wallet_url": site_url("wallet")}

def render_template(template, **context):
    allowed = {"receipt.html", "due_reminder.html", "hold_24h.html", "top_up.html", "room_booking.html", "incident.html", "topup_confirmed.html", "fine_paid.html", "temporary_password.html"}
    if template not in allowed:
        raise ValueError("Mẫu email không được hỗ trợ")
    return environment.get_template(template).render(**context)

async def send_html(recipient, subject, template, context):
    if not recipient or not recipient.strip():
        log.info("Skip %s: user has no email", template)
        return False
    sender = os.getenv("SMTP_FROM") or os.getenv("MAIL_FROM")
    host = os.getenv("SMTP_HOST") or os.getenv("MAIL_SERVER")
    if not host or not sender:
        log.warning("Email not sent: SMTP_HOST/SMTP_FROM not configured (%s)", template)
        return False
    html = render_template(template, **context)
    port = int(os.getenv("SMTP_PORT", "587"))
    ssl = os.getenv("SMTP_SSL", "false").lower() == "true"
    user = os.getenv("SMTP_USER", "")
    from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
    cfg = ConnectionConfig(
         MAIL_USERNAME=user,
         MAIL_PASSWORD=os.getenv("SMTP_PASSWORD", ""),
         MAIL_FROM=sender,
         MAIL_PORT=port,
         MAIL_SERVER=host,
         MAIL_STARTTLS=os.getenv("SMTP_STARTTLS", "true").lower() == "true",
         MAIL_SSL_TLS=os.getenv("SMTP_SSL", "false").lower() == "true",
         USE_CREDENTIALS=bool(user),
         VALIDATE_CERTS=True
    )
    message = MessageSchema(subject=subject, recipients=[recipient], body=html, subtype=MessageType.html)
    for attempt in range(1, 4):
        try:
            await FastMail(cfg).send_message(message)
            return True
        except Exception:
            log.exception("SMTP failed attempt %d/3 template=%s", attempt, template)
    return False

def send_sync(recipient, subject, template, context):
    import asyncio
    try:
        return asyncio.run(send_html(recipient, subject, template, context))
    except Exception:
        log.exception("Email preparation failed: %s", template)
        return False

def send_receipt(recipient, user_name, loan_id, book_title, author, borrow_date, due_date):
    context = context_base(user_name)
    context.update(receipt_id=f"BL-{loan_id}", borrow_date=local_date(borrow_date), due_date=local_date(due_date),
        books=[{"title": book_title, "author": author or "", "loan_code": f"PM-{loan_id}"}])
    return send_sync(recipient, "Thư viện - Biên lai mượn sách", "receipt.html", context)

def send_reminder(recipient, user_name, book_title, loan_id, due_date):
    context = context_base(user_name)
    context.update(book_title=book_title, loan_code=f"PM-{loan_id}", due_date=local_date(due_date))
    return send_sync(recipient, "Thư viện - Nhắc hạn trả sách", "due_reminder.html", context)

def send_hold(recipient, user_name, book_title, hold_id, expires_at):
    context = context_base(user_name)
    context.update(book_title=book_title, hold_code=f"GC-{hold_id}", pickup_deadline=local_date(expires_at),
                   pickup_location=os.getenv("PICKUP_LOCATION", "Quầy mượn trả thư viện"))
    return send_sync(recipient, "Thư viện - Sách đã được giữ trong 24 giờ", "hold_24h.html", context)


def send_room_booking(recipient, user_name, booking_id, room_name, date, slot):
    context = context_base(user_name)
    context.update(booking_id=booking_id, room_name=room_name, booking_date=str(date), slot=str(slot))
    return send_sync(recipient, 'Thư viện - Xác nhận đặt phòng', 'room_booking.html', context)

def send_incident_notice(recipient, user_name, incident_id, incident_type, amount):
    context = context_base(user_name)
    context.update(incident_id=incident_id, incident_type=incident_type, amount=amount)
    return send_sync(recipient, 'Thư viện - Biên bản mất/hỏng sách', 'incident.html', context)

def send_topup_confirmed(recipient, user_name, amount, balance):
    context = context_base(user_name)
    context.update(amount=amount, balance=balance)
    return send_sync(recipient, 'Thư viện - Xác nhận nạp tiền', 'topup_confirmed.html', context)

def send_fine_paid(recipient, user_name, amount, balance):
    context = context_base(user_name)
    context.update(amount=amount, balance=balance)
    return send_sync(recipient, 'Thư viện - Xác nhận trả phạt', 'fine_paid.html', context)

def send_temporary_password(recipient, user_name, username, temp_password):
    context = context_base(user_name)
    context.update(username=username, temp_password=temp_password)
    return send_sync(recipient, 'Thư viện - Thông tin tài khoản tạm thời', 'temporary_password.html', context)
