import math
import re
import unicodedata
from typing import Any, Dict, List, Optional

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.book import Book, BookCopy, Category

DEFAULT_PAGE_SIZE = 20   # NFR-PE-02
MAX_PAGE_SIZE = 50       # NFR-PE-02
MAX_QUERY_LENGTH = 200

# Ký tự điều khiển (bao gồm NUL \x00 khiến PostgreSQL báo lỗi)
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
# Ký tự có ý nghĩa đặc biệt trong cú pháp tsquery
_TSQUERY_SPECIAL = re.compile(r"[&|!():*<>\\'\"]")
_MULTI_SPACE = re.compile(r"\s+")


def normalize_text(value: Optional[str], max_length: int = MAX_QUERY_LENGTH) -> Optional[str]:
    """Chuẩn hóa chuỗi người dùng nhập: NFC, bỏ ký tự điều khiển, gộp khoảng trắng,
    giới hạn độ dài. Trả về None nếu chuỗi rỗng sau khi chuẩn hóa."""
    if value is None:
        return None
    text = unicodedata.normalize("NFC", value)
    text = _CONTROL_CHARS.sub(" ", text)
    text = _MULTI_SPACE.sub(" ", text).strip()[:max_length].strip()
    return text or None


def normalize_tsquery_text(value: Optional[str]) -> Optional[str]:
    """Chuẩn hóa chuỗi trước khi đưa vào plainto_tsquery: loại các toán tử tsquery.
    Trả về None nếu không còn ký tự chữ/số nào (vd: '!!!')."""
    text = normalize_text(value)
    if not text:
        return None
    text = _MULTI_SPACE.sub(" ", _TSQUERY_SPECIAL.sub(" ", text)).strip()
    if not any(ch.isalnum() for ch in text):
        return None
    return text


def _escape_like(value: str) -> str:
    """Escape ký tự đại diện của LIKE để tìm đúng nghĩa đen."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _ilike(column, value: str):
    return column.ilike(f"%{_escape_like(value)}%", escape="\\")


def _attach_copy_counts(db: Session, books: List[Book]) -> None:
    """Gắn tổng bản in và số bản đang AVAILABLE. available_stock có thể lệch bản sao thật."""
    for book in books:
        book.total_copies = 0
        book.available_copies = 0
    if not books:
        return
    rows = db.execute(
        select(
            BookCopy.book_id,
            func.count().label("total"),
            func.coalesce(
                func.sum(case((BookCopy.status == "AVAILABLE", 1), else_=0)),
                0,
            ).label("available"),
        )
        .where(BookCopy.book_id.in_([book.id for book in books]))
        .group_by(BookCopy.book_id)
    ).all()
    by_id = {
        book_id: (int(total or 0), int(available or 0))
        for book_id, total, available in rows
    }
    for book in books:
        total, available = by_id.get(book.id, (0, 0))
        book.total_copies = total
        book.available_copies = available


def search_books_advanced(
    db: Session,
    query_text: Optional[str] = None,       # q: tìm toàn văn trên siêu dữ liệu
    author: Optional[str] = None,
    publisher: Optional[str] = None,
    year: Optional[int] = None,
    subject_code: Optional[str] = None,
    category: Optional[str] = None,         # id hoặc tên danh mục
    attribute: Optional[str] = None,        # thuộc tính / từ khóa (keywords)
    format: Optional[str] = None,           # PRINTED | EBOOK | BOTH
    exact_format: bool = False,            # True = khớp đúng loại, không gộp BOTH
    exact_publisher: bool = False,         # True = khớp đúng tên nhà xuất bản
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> Dict[str, Any]:
    if page < 1:
        raise ValueError("page phải >= 1")
    if page_size < 1 or page_size > MAX_PAGE_SIZE:
        raise ValueError(f"page_size phải trong khoảng 1..{MAX_PAGE_SIZE}")
    offset = (page - 1) * page_size

    stmt = select(Book).where(Book.is_active.is_(True))

    # 1. Full-text search trên nhan đề, tác giả, NXB, mô tả, từ khóa
    search_terms = normalize_tsquery_text(query_text)
    # Khớp theo tiền tố để tìm ngay khi đang gõ: "app" → app:* khớp "app", "apps", "application".
    # Chỉ giữ từ gồm chữ/số nên chuỗi đưa vào to_tsquery luôn đúng cú pháp (vd: "c++" → c:*).
    prefix_terms = re.findall(r"\w+", search_terms or "")
    if prefix_terms:
        ts_query = func.to_tsquery("simple", " & ".join(f"{term}:*" for term in prefix_terms))
        metadata_vector = func.to_tsvector(
            "simple",
            func.concat_ws(
                " ",
                Book.title,
                Book.author,
                Book.publisher,
                Book.description,
                Book.keywords,
            ),
        )
        stmt = stmt.where(metadata_vector.op("@@")(ts_query)).order_by(
            func.ts_rank_cd(metadata_vector, ts_query).desc(), Book.id.desc()
        )
    else:
        stmt = stmt.order_by(Book.id.desc())

    # 2. Các bộ lọc (kết hợp AND)
    author = normalize_text(author)
    if author:
        stmt = stmt.where(_ilike(Book.author, author))

    publisher = normalize_text(publisher)
    if publisher:
        if exact_publisher:
            stmt = stmt.where(func.lower(Book.publisher) == publisher.lower())
        else:
            stmt = stmt.where(_ilike(Book.publisher, publisher))

    if year is not None:
        stmt = stmt.where(Book.publication_year == year)

    subject_code = normalize_text(subject_code, 50)
    if subject_code:
        stmt = stmt.where(func.upper(Book.subject_code) == subject_code.upper())

    category = normalize_text(category, 100)
    if category:
        if category.isdigit():
            stmt = stmt.where(Book.category_id == int(category))
        else:
            stmt = stmt.join(Category, Book.category_id == Category.id).where(
                func.lower(Category.category_name) == category.lower()
            )

    attribute = normalize_text(attribute)
    if attribute:
        stmt = stmt.where(_ilike(Book.keywords, attribute))

    if format:
        target = format.upper()
        if target in ("PRINTED", "EBOOK") and not exact_format:
            # Sách BOTH đáp ứng cả hai định dạng. exact_format dùng khi lọc đúng một loại.
            stmt = stmt.where(or_(Book.book_type == target, Book.book_type == "BOTH"))
        else:
            stmt = stmt.where(Book.book_type == target)

    # 3. Tổng số kết quả
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total_records = db.scalar(count_stmt) or 0

    # 4. Phân trang + eager loading
    paginated_stmt = (
        stmt.options(
            joinedload(Book.category),
            joinedload(Book.subject),
            joinedload(Book.ebook),
        )
        .limit(page_size)
        .offset(offset)
    )
    books: List[Book] = db.scalars(paginated_stmt).unique().all()
    _attach_copy_counts(db, books)

    total_pages = math.ceil(total_records / page_size) if total_records > 0 else 1

    return {
        "items": books,
        "total": total_records,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }