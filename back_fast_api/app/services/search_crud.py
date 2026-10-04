import math
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.book import Book, Category, Subject


def search_books_fts(
    db: Session,
    query_text: Optional[str] = None,
    category_id: Optional[int] = None,
    subject_code: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
) -> Dict[str, Any]:
    """
    Tìm kiếm sách bằng PostgreSQL Full-Text Search kết hợp bộ lọc và phân trang.
    Tối ưu hóa:
      - Sử dụng plainto_tsquery trên cấu hình 'simple' (hoặc 'english')
      - Rank kết quả khớp theo trọng số bằng ts_rank_cd
      - Áp dụng LIMIT / OFFSET phân trang chuẩn xác
    """
    page = max(1, page)
    page_size = max(1, min(page_size, 100))  # Giới hạn tối đa 100 kết quả/trang
    offset = (page - 1) * page_size

    # Khởi tạo câu truy vấn cơ sở
    stmt = (
        select(Book)
        .outerjoin(Category, Book.category_id == Category.id)
        .outerjoin(Subject, Book.subject_code == Subject.subject_code)
    )

    # 1. Áp dụng Full-Text Search nếu có từ khóa
    # if query_text and query_text.strip():
    #     search_terms = query_text.strip()
    #     # Chuyển đổi text thành tsquery an toàn (tránh lỗi cú pháp của to_tsquery)
    #     ts_query = func.plainto_tsquery("simple", search_terms)

    #     # Toán tử PostgreSQL: Book.search_vector @@ plainto_tsquery('simple', :query)
    #     fts_filter = Book.search_vector.bool_op("@@")(ts_query)
    #     stmt = stmt.where(fts_filter)

    #     # Sắp xếp theo độ phù hợp (Rank score giảm dần)
    #     rank_score = func.ts_rank_cd(Book.search_vector, ts_query).desc()
    #     stmt = stmt.order_by(rank_score, Book.id.desc())
    # else:
    #     # Nếu không có từ khóa, sắp xếp theo ID sách mới nhất
    #     stmt = stmt.order_by(Book.id.desc())
    if query_text and query_text.strip():
        search_terms = query_text.strip()
        ts_vector = func.to_tsvector(
            "simple",
            func.coalesce(Book.title, "") + " " + func.coalesce(Book.author, ""),
        )
        ts_query = func.plainto_tsquery("simple", search_terms)

        stmt = stmt.where(ts_vector.bool_op("@@")(ts_query))
        stmt = stmt.order_by(
            func.ts_rank_cd(ts_vector, ts_query).desc(),
            Book.id.desc(),
        )
    else:
        stmt = stmt.order_by(Book.id.desc())

    # 2. Bộ lọc danh mục & chủ đề
    if category_id:
        stmt = stmt.where(Book.category_id == category_id)
    if subject_code:
        stmt = stmt.where(Book.subject_code == subject_code)

    # 3. Tính tổng số bản ghi (Total Count)
    count_subquery = stmt.with_only_columns(func.count(Book.id)).order_by(None).subquery()
    total_records = db.scalar(select(func.count()).select_from(count_subquery)) or 0

    # 4. Áp dụng Pagination (Limit / Offset)
    paginated_stmt = stmt.limit(page_size).offset(offset)
    books: List[Book] = db.scalars(paginated_stmt).all()

    total_pages = math.ceil(total_records / page_size) if total_records > 0 else 1

    return {
        "items": books,
        "total": total_records,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }