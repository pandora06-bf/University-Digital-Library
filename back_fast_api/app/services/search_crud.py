import math
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.book import Book, Category, Subject


def search_books_advanced(
    db: Session,
    query_text: Optional[str] = None,       # Tìm kiếm toàn văn trên siêu dữ liệu
    author: Optional[str] = None,           # Tìm theo tác giả
    publisher: Optional[str] = None,        # Tìm theo nhà xuất bản
    publication_year: Optional[int] = None, # Tìm theo năm xuất bản
    category_id: Optional[int] = None,      # Lọc theo danh mục
    book_type: Optional[str] = None,        # Lọc theo định dạng (PRINTED, EBOOK, BOTH)
    subject_code: Optional[str] = None,     # Lọc theo mã môn học
    keyword: Optional[str] = None,          # Lọc theo từ khóa (keywords)
    page: int = 1,
    page_size: int = 10,
) -> Dict[str, Any]:
    page = max(1, page)
    page_size = max(1, min(page_size, 50))
    offset = (page - 1) * page_size

    stmt = select(Book).options(joinedload(Book.category), joinedload(Book.subject))

    # 1. Tìm kiếm toàn văn (FTS) trên toàn bộ siêu dữ liệu (Metadata):
    # Bao gồm: Nhan đề, Tác giả, Nhà xuất bản, Mô tả, Từ khóa
    if query_text and query_text.strip():
        search_terms = query_text.strip()
        ts_query = func.plainto_tsquery("simple", search_terms)

        # Gom toàn bộ siêu dữ liệu vào một tsvector
        metadata_vector = func.to_tsvector(
            "simple",
            func.coalesce(Book.title, "")
            + " "
            + func.coalesce(Book.author, "")
            + " "
            + func.coalesce(Book.publisher, "")
            + " "
            + func.coalesce(Book.description, "")
            + " "
            + func.coalesce(Book.keywords, ""),
        )

        fts_filter = metadata_vector.op("@@")(ts_query)
        rank_expr = func.ts_rank_cd(metadata_vector, ts_query)

        stmt = stmt.where(fts_filter).order_by(rank_expr.desc(), Book.id.desc())
    else:
        stmt = stmt.order_by(Book.id.desc())

    # 2. Tìm theo Tác giả (không phân biệt hoa thường)
    if author and author.strip():
        stmt = stmt.where(Book.author.ilike(f"%{author.strip()}%"))

    # 3. Tìm theo Nhà xuất bản
    if publisher and publisher.strip():
        stmt = stmt.where(Book.publisher.ilike(f"%{publisher.strip()}%"))

    # 4. Tìm theo Năm xuất bản
    if publication_year:
        stmt = stmt.where(Book.publication_year == publication_year)

    # 5. Lọc chéo theo Danh mục
    if category_id:
        stmt = stmt.where(Book.category_id == category_id)

    # 6. Lọc chéo theo Định dạng sách (Vật lý: PRINTED, Điện tử: EBOOK)
    if book_type and book_type.strip():
        target_type = book_type.strip().upper()
        if target_type in ["PRINTED", "EBOOK"]:
            # Khớp định dạng đích hoặc các sách hỗ trợ cả hai (BOTH)
            stmt = stmt.where(Book.book_type.in_([target_type, "BOTH"]))
        else:
            stmt = stmt.where(Book.book_type == target_type)

    # 7. Tìm theo Từ khóa (Keywords)
    if keyword and keyword.strip():
        stmt = stmt.where(Book.keywords.ilike(f"%{keyword.strip()}%"))

    # 8. Lọc theo Mã môn học
    if subject_code and subject_code.strip():
        stmt = stmt.where(Book.subject_code == subject_code.strip().upper())

    # 9. Tính tổng số bản ghi (Count an toàn và tối ưu)
    count_stmt = stmt.with_only_columns(func.count(Book.id)).order_by(None)
    total_records = db.scalar(count_stmt) or 0

    # 10. Phân trang và Eager Loading tránh N+1
    paginated_stmt = (
        stmt.options(
            joinedload(Book.category),
            joinedload(Book.subject),
        )
        .limit(page_size)
        .offset(offset)
    )
    books: List[Book] = db.scalars(paginated_stmt).unique().all()

    total_pages = math.ceil(total_records / page_size) if total_records > 0 else 1

    return {
        "items": books,
        "total": total_records,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }