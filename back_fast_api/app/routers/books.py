from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.schemas.book_search import BookSearchItemResponse, PaginatedResponse
from app.services.search_crud import search_books_fts
from app.core.database import get_db

router = APIRouter(
    prefix="/api/books",
    tags=["Books"],
)


@router.get("")
def get_books(
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
):
    return {
        "message": "Get books API",
        "limit": limit,
        "offset": offset,
        "data": [],
    }

@router.get(
    "/search",
    response_model=PaginatedResponse[BookSearchItemResponse],
    summary="Tìm kiếm sách Full-Text Search và phân trang",
)
def search_books(
    q: Optional[str] = Query(None, description="Từ khóa tìm kiếm (nhan đề, tác giả, mô tả)"),
    category_id: Optional[int] = Query(None, description="Lọc theo mã danh mục"),
    subject_code: Optional[str] = Query(None, description="Lọc theo mã môn học"),
    page: int = Query(1, ge=1, description="Số trang hiển thị"),
    page_size: int = Query(10, ge=1, le=100, description="Số lượng mục mỗi trang"),
    db: Session = Depends(get_db),
):
    """
    Thực hiện tìm kiếm sách bằng cấu trúc chỉ mục toàn văn PostgreSQL:
    - **q**: Từ khóa tra cứu tự do (plain text query).
    - **category_id** & **subject_code**: Bộ lọc phân loại.
    - **page** & **page_size**: Điều khiển phân trang.
    """
    result = search_books_fts(
        db=db,
        query_text=q,
        category_id=category_id,
        subject_code=subject_code,
        page=page,
        page_size=page_size,
    )
    return result
