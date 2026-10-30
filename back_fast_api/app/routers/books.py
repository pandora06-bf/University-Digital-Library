from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.schemas.book_search import BookSearchItemResponse, PaginatedResponse
from app.services.search_crud import search_books_advanced
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
    q: Optional[str] = Query(None, description="Tìm toàn văn trên nhan đề, tác giả, NXB, mô tả, từ khóa"),
    author: Optional[str] = Query(None, description="Tìm theo tên tác giả"),
    publisher: Optional[str] = Query(None, description="Tìm theo nhà xuất bản"),
    publication_year: Optional[int] = Query(None, description="Tìm theo năm xuất bản"),
    category_id: Optional[int] = Query(None, description="Lọc theo mã danh mục"),
    book_type: Optional[str] = Query(None, description="Định dạng: PRINTED, EBOOK, BOTH"),
    subject_code: Optional[str] = Query(None, description="Mã môn học: IT, ECO, ENG"),
    keyword: Optional[str] = Query(None, description="Từ khóa cụ thể"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    return search_books_advanced(
        db=db,
        query_text=q,
        author=author,
        publisher=publisher,
        publication_year=publication_year,
        category_id=category_id,
        book_type=book_type,
        subject_code=subject_code,
        keyword=keyword,
        page=page,
        page_size=page_size,
    )
