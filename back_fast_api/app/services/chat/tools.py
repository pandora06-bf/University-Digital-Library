"""Công cụ CHỈ ĐỌC cho chatbot.

Người dùng luôn lấy từ phiên đăng nhập (ChatContext.user_code), mô hình không truyền được mã người dùng.
Dữ liệu trả cho mô hình không bao giờ chứa tên, MSSV, email của bất kỳ ai.
"""
from collections import Counter
from datetime import timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.book import Book, BookCopy
from app.models.loan import Loan, Waitlist
from app.models.room import RoomBooking
from app.models.user import User
from app.services.catalog_service import is_book_disabled
from app.services.loan_states import ACTIVE_LOAN_STATUSES
from app.services.room_booking_service import ACTIVE as ACTIVE_BOOKINGS
from app.services.room_booking_service import local_now
from app.services.waitlist_logic import ACTIVE as ACTIVE_QUEUE
from app.services.waitlist_logic import active_holds, utc_now

MAX_CARDS = 5
POPULAR_MIN_LOANS = 10  # ít hơn thì không được nói là "nhiều người đọc"
# Phiếu đã đặt nhưng không nhận được sách thì không tính là đã mượn
NOT_BORROWED = ("CANCELLED", "EXPIRED", "REQUESTED", "PENDING_PICKUP")
VN = ZoneInfo("Asia/Ho_Chi_Minh")

LOAN_LABELS = {"PENDING_PICKUP": "chờ nhận tại quầy", "REQUESTED": "đã đăng ký",
               "BORROWED": "đang mượn", "OVERDUE": "quá hạn"}

PAGES = {
    "login": ("/login", "Đăng nhập", "Log in"),
    "account": ("/account", "Trang Tài khoản", "Account"),
    "catalog": ("/catalog", "Danh mục sách", "Catalog"),
    "my_books": ("/my-books", "Sách của tôi", "My books"),
    "waitlist": ("/my-books?tab=waitlist", "Sách đặt trước", "My reservations"),
    "fines": ("/my-books?tab=fines", "Công nợ", "Fines"),
    "rooms": ("/rooms", "Đặt phòng", "Book a room"),
    "topup": ("/account?topup=1", "Nạp tiền", "Top up"),
}


def _tool(name: str, description: str, properties: dict) -> dict:
    return {
        "name": name,
        "description": description,
        "strict": True,
        "input_schema": {"type": "object", "properties": properties,
                         "required": list(properties), "additionalProperties": False},
    }


TOOLS = [
    _tool("check_availability",
          "Live availability of books in the catalog. Call it for EVERY book you recommend or discuss: "
          "the app shows a book card only for ids passed here. Pass at most 5 ids, best match first. "
          "It never reveals who borrowed a book.",
          {"book_ids": {"type": "array", "items": {"type": "integer"}}}),
    _tool("report_no_match",
          "Call this (and nothing else) when the reader wants a kind of book and NO catalog book fits. "
          "The app then shows the official apology sentence.",
          {"language": {"type": "string", "enum": ["vi", "en"]}}),
    _tool("popular_books",
          "Books of one subject ordered by how often they were borrowed. Use for questions such as "
          "'what do IT students usually read'. subject_code is one of the subject codes in the catalog, "
          "or ALL for the whole library.",
          {"subject_code": {"type": "string"}}),
    _tool("reading_recommendations",
          "The signed-in reader's borrowing history and candidate books they have not borrowed. "
          "Use for personal suggestions such as 'what should I read today'.", {}),
    _tool("get_my_info",
          "The signed-in reader's own loans, reservations, wallet balance, fines and room bookings.", {}),
    _tool("suggest_librarian",
          "Offer to send the question to a librarian: payment problems, fine disputes, locked accounts, "
          "anything the guide cannot solve, or when the reader asks for a person. "
          "summary is a short draft in the reader's language that they can edit before sending.",
          {"summary": {"type": "string"}}),
    _tool("open_page", "Show a button that opens a page of the library web app.",
          {"page": {"type": "string", "enum": list(PAGES)}}),
]


def _vn_time(value):
    """Cột thời gian lưu UTC không múi giờ."""
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc).astimezone(VN).strftime("%d/%m/%Y %H:%M")


def _visible_books(db: Session, ids: list) -> list:
    """Sách còn lưu hành, giữ đúng thứ tự mã được hỏi."""
    if not ids:
        return []
    books = db.scalars(select(Book).options(joinedload(Book.ebook))
                       .where(Book.id.in_(ids), Book.is_active.is_(True))).unique().all()
    copies = db.scalars(select(BookCopy).where(BookCopy.book_id.in_(ids))).all()
    by_book = {}
    for copy in copies:
        by_book.setdefault(copy.book_id, []).append(copy)
    found = {b.id: b for b in books if not is_book_disabled(b, by_book.get(b.id, []))}
    return [found[i] for i in ids if i in found]


def book_status(db: Session, book: Book) -> dict:
    has_print = book.book_type in ("PRINTED", "BOTH")
    free = 0
    borrowed = False
    if has_print:
        free = max(0, int(book.available_stock or 0) - len(active_holds(db, book.id, utc_now())))
        borrowed = db.scalar(select(Loan.id).where(
            Loan.book_id == book.id, Loan.loan_type != "EBOOK",
            Loan.loan_status.in_(("BORROWED", "OVERDUE"))).limit(1)) is not None
    return {"has_print": has_print, "is_borrowed_by_someone": borrowed, "copies_available": free,
            "has_ebook": book.book_type in ("EBOOK", "BOTH") and book.ebook is not None}


def book_card(db: Session, book: Book) -> dict:
    return {"id": book.id, "title": book.title, "author": book.author,
            "cover_image_path": book.cover_image_path, **book_status(db, book)}


def check_availability(db: Session, book_ids: list):
    ids = list(dict.fromkeys(i for i in book_ids if isinstance(i, int)))[:MAX_CARDS]
    cards = [book_card(db, book) for book in _visible_books(db, ids)]
    found = {card["id"] for card in cards}
    result = {"books": [{k: v for k, v in card.items() if k != "cover_image_path"} for card in cards],
              "not_in_library": [i for i in ids if i not in found]}
    return result, cards


def popular_books(db: Session, subject_code: str) -> dict:
    code = (subject_code or "").strip().upper()
    query = (select(Book.id, Book.title, func.count(Loan.id))
             .outerjoin(Loan, (Loan.book_id == Book.id) & Loan.loan_status.notin_(NOT_BORROWED))
             .where(Book.is_active.is_(True)))
    if code and code != "ALL":
        query = query.where(func.upper(Book.subject_code) == code)
    rows = db.execute(query.group_by(Book.id, Book.title)
                      .order_by(func.count(Loan.id).desc(), Book.id)).all()
    enough = sum(row[2] for row in rows) >= POPULAR_MIN_LOANS
    # Chỉ trả thứ tự, không trả số lượt hay người mượn
    return {"books": [{"id": row[0], "title": row[1]} for row in rows[:MAX_CARDS]],
            "enough_borrowing_data_to_call_them_popular": enough}


def reading_recommendations(db: Session, user_code: str) -> dict:
    history = db.scalars(select(Loan).options(joinedload(Loan.book)).where(
        Loan.user_code == user_code, Loan.loan_status.notin_(NOT_BORROWED))
        .order_by(Loan.borrow_date.desc())).all()
    if not history:
        return {"has_history": False, "popular": popular_books(db, "ALL")}
    seen = {loan.book_id for loan in db.scalars(select(Loan).where(
        Loan.user_code == user_code, Loan.loan_status.notin_(("CANCELLED", "EXPIRED"))))}
    read = list({loan.book_id: loan.book for loan in history if loan.book}.values())
    subjects = Counter(b.subject_code for b in read if b.subject_code)
    categories = Counter(b.category_id for b in read if b.category_id)
    authors = {b.author for b in read}

    def score(book):
        return (3 * subjects[book.subject_code] + 2 * categories[book.category_id]
                + (4 if book.author in authors else 0))

    pool = db.scalars(select(Book).options(joinedload(Book.ebook)).where(
        Book.is_active.is_(True), Book.id.notin_(seen))).unique().all()
    ranked = sorted((b for b in pool if score(b) > 0), key=lambda b: (-score(b), b.id))[:25]
    candidates = []
    for book in ranked:
        status = book_status(db, book)
        candidates.append({"id": book.id, "title": book.title, "author": book.author,
                           "subject_code": book.subject_code,
                           "readable_now": status["copies_available"] > 0 or status["has_ebook"]})
    candidates.sort(key=lambda c: not c["readable_now"])  # sắp xếp ổn định: đọc được ngay lên trước
    return {"has_history": True,
            "previously_borrowed": [{"title": b.title, "subject_code": b.subject_code} for b in read[:10]],
            "candidates": candidates[:8]}


def get_my_info(db: Session, user_code: str) -> dict:
    user = db.get(User, user_code)
    loans = db.scalars(select(Loan).options(joinedload(Loan.book)).where(
        Loan.user_code == user_code, Loan.loan_status.in_(ACTIVE_LOAN_STATUSES))
        .order_by(Loan.due_date)).all()
    queue = db.scalars(select(Waitlist).options(joinedload(Waitlist.book)).where(
        Waitlist.user_code == user_code, Waitlist.status.in_(ACTIVE_QUEUE))).all()
    now = local_now()
    bookings = db.scalars(select(RoomBooking).options(joinedload(RoomBooking.room)).where(
        RoomBooking.user_code == user_code, RoomBooking.status.in_(ACTIVE_BOOKINGS),
        RoomBooking.booking_date >= now.date())
        .order_by(RoomBooking.booking_date, RoomBooking.slot_start)).all()
    return {
        "loans": [{
            "title": loan.book.title,
            "format": "eBook" if loan.loan_type == "EBOOK" else "print",
            "status": LOAN_LABELS.get(loan.loan_status, loan.loan_status),
            # Phiếu chưa nhận sách thì chưa có hạn trả thật
            "due": _vn_time(loan.due_date) if loan.loan_status in ("BORROWED", "OVERDUE") else None,
            "pickup_before": _vn_time(loan.pickup_deadline) if loan.loan_status == "PENDING_PICKUP" else None,
            "renewals_used": loan.renewal_count,
        } for loan in loans],
        "reservations": [{"title": item.book.title, "position": item.queue_position, "status": item.status,
                          "held_until": _vn_time(item.hold_expires_at)} for item in queue],
        "wallet_balance_vnd": int(user.service_balance or 0),
        "unpaid_fines_vnd": int(user.total_fines or 0),
        "borrowing_blocked": bool(user.is_borrowing_blocked),
        "room_bookings": [{"room": b.room.room_name, "date": b.booking_date.strftime("%d/%m/%Y"),
                           "from": b.slot_start.strftime("%H:%M"), "to": b.slot_end.strftime("%H:%M"),
                           "status": b.status} for b in bookings],
    }
