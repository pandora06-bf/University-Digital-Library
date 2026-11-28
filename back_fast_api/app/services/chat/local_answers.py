"""Câu trả lời cá nhân do server tự viết, dùng khi không được gửi dữ liệu cá nhân cho dịch vụ AI."""
from sqlalchemy.orm import Session

from app.services.chat import tools

STATUS_EN = {"chờ nhận tại quầy": "waiting for pickup", "đã đăng ký": "registered",
             "đang mượn": "borrowed", "quá hạn": "overdue"}


def _money(value: int) -> str:
    return f"{value:,}".replace(",", ".") + " đ"


def my_info(db: Session, user_code: str, language: str) -> str:
    info = tools.get_my_info(db, user_code)
    en = language == "en"
    lines = ["Your loans:" if en else "Sách đang mượn/đăng ký:"]
    for loan in info["loans"]:
        status = STATUS_EN.get(loan["status"], loan["status"]) if en else loan["status"]
        line = f"- {loan['title']} ({status})"
        if loan["due"]:
            line += f", {'due' if en else 'hạn trả'} {loan['due']}"
        if loan["pickup_before"]:
            line += f", {'pick up before' if en else 'nhận trước'} {loan['pickup_before']}"
        lines.append(line)
    if not info["loans"]:
        lines.append("- None" if en else "- Không có")
    if info["reservations"]:
        lines.append("Reservations:" if en else "Sách đặt trước:")
        for item in info["reservations"]:
            line = f"- {item['title']}, {'position' if en else 'thứ tự'} {item['position']}"
            if item["held_until"]:
                line += f", {'held until' if en else 'giữ đến'} {item['held_until']}"
            lines.append(line)
    lines.append(f"{'Wallet balance' if en else 'Số dư ví'}: {_money(info['wallet_balance_vnd'])}")
    lines.append(f"{'Unpaid fines' if en else 'Nợ phạt'}: {_money(info['unpaid_fines_vnd'])}")
    if info["borrowing_blocked"]:
        lines.append("Borrowing is blocked." if en else "Tài khoản đang bị khóa mượn.")
    if info["room_bookings"]:
        lines.append("Room bookings:" if en else "Lịch đặt phòng:")
        lines += [f"- {b['room']}, {b['date']} {b['from']}-{b['to']}" for b in info["room_bookings"]]
    return "\n".join(lines)


def recommendations(db: Session, user_code: str, language: str):
    """Trả (câu trả lời, thẻ sách). Ưu tiên sách đọc được ngay."""
    result = tools.reading_recommendations(db, user_code)
    en = language == "en"
    if result["has_history"] and result["candidates"]:
        books = result["candidates"][:3]
        text = ("Based on what you borrowed, you could read:" if en
                else "Dựa trên sách bạn đã mượn, bạn có thể đọc:")
    else:
        books = (result.get("popular") or tools.popular_books(db, "ALL"))["books"][:3]
        text = ("Here are some books from the library you could start with:" if en
                else "Bạn có thể bắt đầu với một số sách trong thư viện:")
    _, cards = tools.check_availability(db, [book["id"] for book in books])
    return text, cards
