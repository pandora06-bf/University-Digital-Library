"""Script backfill dữ liệu cũ về schema mới (Task 2B-28).

Mục đích:
  - Sau migration 2B-01, bổ sung các trường mới cho dữ liệu cũ:
      + Books: price mặc định bằng 0 nếu NULL (không ghi đè giá 0 hợp lệ)
      + Books: subject_code theo danh mục nếu chưa có
      + Users: service_balance = 0 nếu chưa có (trường mới từ 2B-01)
  - Idempotent: chạy lại nhiều lần vẫn cho kết quả đúng
  - Ghi log số dòng trước và sau khi backfill
  - subject_code luôn tham chiếu mã môn học thực sự tồn tại

Chạy sau khi đã chạy: alembic upgrade head

Cách dùng:
  cd back_fast_api
  python -m scripts.backfill_new_schema
  # hoặc
  python scripts/backfill_new_schema.py
"""

import logging
import sys
import os

# Đảm bảo có thể import từ back_fast_api/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import SessionLocal
from app.models import Book, User

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────────
# Ánh xạ theo tên danh mục (bao gồm cả tên cũ trong các mock của Sprint 2)
# → subject_code. Mã cuối cùng luôn được kiểm tra có thật trong subjects trước
# khi gán để không vi phạm khóa ngoại.
# ────────────────────────────────────────────────────────────────────────────
CATEGORY_TO_SUBJECT: dict[str, str] = {
    "Công nghệ thông tin": "IT",
    "Giáo trình - Công nghệ": "IT",
    "Công nghệ": "IT",
    "Khoa học tự nhiên": "PHYS",
    "Khoa học": "MATH",
    "Văn học": "LIT",
    "Kinh tế": "ECO",
    "Kinh tế - Xã hội": "ECO",
    "Ngoại ngữ": "ENG",
    "Báo cáo - Khóa luận": "IT",
}

DEFAULT_SUBJECTS = {
    "IT": ("Công nghệ thông tin", "Khoa Công nghệ thông tin"),
    "MATH": ("Toán học", "Khoa Khoa học cơ bản"),
    "PHYS": ("Vật lý", "Khoa Khoa học cơ bản"),
    "ECO": ("Kinh tế", "Khoa Kinh tế"),
    "LIT": ("Văn học", "Khoa Ngữ văn"),
    "ENG": ("Tiếng Anh", "Khoa Ngoại ngữ"),
}


def _subject_for_category(category_name: str | None, valid_codes: set[str]) -> str | None:
    """Chọn môn học theo danh mục và chỉ trả về mã có trong bảng subjects."""
    if not valid_codes:
        return None
    normalized = (category_name or "").strip().casefold()
    for category, code in CATEGORY_TO_SUBJECT.items():
        if category.casefold() in normalized and code in valid_codes:
            return code
    # Fallback theo từ khóa để vẫn khớp danh mục cũ/biến thể tên.
    keyword_map = (
        (("kinh tế", "kinh te"), "ECO"),
        (("ngoại ngữ", "ngoai ngu", "tiếng anh", "tieng anh"), "ENG"),
        (("khoa học tự nhiên", "khoa hoc tu nhien", "vật lý", "vat ly"), "PHYS"),
        (("văn học", "van hoc"), "LIT"),
        (("khoa học", "khoa hoc", "toán", "toan"), "MATH"),
        (("công nghệ", "cong nghe", "tin học", "tin hoc", "khóa luận", "khoa luan"), "IT"),
    )
    for keywords, code in keyword_map:
        if any(keyword in normalized for keyword in keywords) and code in valid_codes:
            return code
    return None


def backfill_books(db) -> dict[str, int]:
    """
    Backfill trường Books.price và Books.subject_code cho các sách cũ.

    Trả về dict thống kê: {price_updated, subject_updated}
    """
    from app.models import Subject

    # Những DB cũ có thể chưa có danh mục môn học. Tạo mã tham chiếu cố định
    # trước khi cập nhật sách để subject_code luôn trỏ tới một dòng hợp lệ.
    for code in set(CATEGORY_TO_SUBJECT.values()):
        if db.query(Subject).filter_by(subject_code=code).one_or_none() is None:
            name, department = DEFAULT_SUBJECTS[code]
            db.add(Subject(subject_code=code, subject_name=name, department_name=department))
    db.flush()

    books = db.query(Book).all()
    valid_subject_codes = {row[0] for row in db.query(Subject.subject_code).all()}
    total = len(books)
    price_updated = 0
    subject_updated = 0

    log.info("--- [BOOKS] Bắt đầu backfill %d sách ---", total)

    for book in books:
        changed = False

        # ── 1. Backfill price ──────────────────────────────────────────────
        # Schema mới dùng DEFAULT 0. Giá 0 hợp lệ (sách miễn phí/chưa định giá),
        # vì vậy chỉ chuyển NULL về default thay vì tự bịa giá.
        if book.price is None:
            book.price = 0
            price_updated += 1
            changed = True

        # ── 2. Backfill subject_code ───────────────────────────────────────
        if not book.subject_code:
            category_name = book.category.category_name if book.category else None
            subject_code = _subject_for_category(category_name, valid_subject_codes)
            if subject_code:
                book.subject_code = subject_code
                subject_updated += 1
                changed = True
            else:
                log.warning(
                    "Không backfill subject_code cho book id=%s (không có subjects hợp lệ)",
                    book.id,
                )

        if changed:
            db.add(book)

    log.info(
        "[BOOKS] Đã cập nhật: price=%d/%d, subject_code=%d/%d",
        price_updated, total, subject_updated, total,
    )
    return {"price_updated": price_updated, "subject_updated": subject_updated, "total": total}


def backfill_users(db) -> dict[str, int]:
    """
    Backfill trường Users.service_balance = 0 cho người dùng cũ chưa có.

    Trả về dict thống kê: {balance_set, total}
    """
    users = db.query(User).all()
    total = len(users)
    balance_set = 0

    log.info("--- [USERS] Bắt đầu backfill %d người dùng ---", total)

    for user in users:
        # service_balance là trường INT mới, có thể là NULL trong DB cũ
        if user.service_balance is None:
            user.service_balance = 0
            balance_set += 1
            db.add(user)

    log.info(
        "[USERS] Đã đặt service_balance=0 cho %d/%d người dùng", balance_set, total
    )
    return {"balance_set": balance_set, "total": total}


def run_backfill() -> None:
    """Điểm vào chính của script backfill."""
    log.info("=" * 60)
    log.info("BẮT ĐẦU BACKFILL SCHEMA MỚI (2B-28)")
    log.info("=" * 60)

    db = SessionLocal()
    try:
        # ── Đếm trước ────────────────────────────────────────────────────────
        books_before = db.query(Book).count()
        books_no_price = db.query(Book).filter(Book.price == None).count()  # noqa: E711
        books_no_subject = db.query(Book).filter(Book.subject_code == None).count()  # noqa: E711

        users_before = db.query(User).count()
        users_no_balance = db.query(User).filter(User.service_balance == None).count()  # noqa: E711

        log.info("TRƯỚC BACKFILL:")
        log.info("  Books tổng: %d | thiếu price: %d | thiếu subject_code: %d",
                 books_before, books_no_price, books_no_subject)
        log.info("  Users tổng: %d | chưa có service_balance: %d",
                 users_before, users_no_balance)

        # ── Thực hiện backfill ───────────────────────────────────────────────
        book_stats = backfill_books(db)
        user_stats = backfill_users(db)
        db.commit()

        # ── Đếm sau ──────────────────────────────────────────────────────────
        books_after = db.query(Book).count()
        users_after = db.query(User).count()
        books_still_no_price = db.query(Book).filter(Book.price == None).count()  # noqa: E711
        books_still_no_subject = db.query(Book).filter(Book.subject_code == None).count()  # noqa: E711
        users_still_no_balance = db.query(User).filter(User.service_balance == None).count()  # noqa: E711

        log.info("SAU BACKFILL:")
        log.info("  Books tổng: %d (trước: %d) | đã cập nhật price=%d | subject_code=%d",
                 books_after, books_before,
                 book_stats["price_updated"], book_stats["subject_updated"])
        log.info("  Books còn thiếu (sau): price=%d | subject_code=%d",
                 books_still_no_price, books_still_no_subject)
        log.info("  Users tổng: %d (trước: %d) | đã đặt service_balance=%d | còn thiếu=%d",
                 users_after, users_before,
                 user_stats["balance_set"], users_still_no_balance)
        log.info("=" * 60)
        log.info("BACKFILL HOÀN TẤT THÀNH CÔNG")
        log.info("=" * 60)

    except Exception as exc:
        db.rollback()
        log.error("LỖI trong quá trình backfill: %s", exc, exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_backfill()
