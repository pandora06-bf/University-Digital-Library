from enum import Enum
from typing import Optional
from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from app.schemas.book_search import BookSearchItemResponse, PaginatedResponse
from app.schemas.category import BookDetailResponse, CatalogTreeResponse
from app.services.catalog_service import get_book_detail_service, get_catalog_tree_service
from app.services.search_crud import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    search_books_advanced,
)
from app.core.database import get_db

router = APIRouter(
    prefix="/api/books",
    tags=["Books"],
)


class BookFormat(str, Enum):
    PRINTED = "PRINTED"
    EBOOK = "EBOOK"
    BOTH = "BOTH"


@router.get(
    "/search",
    response_model=PaginatedResponse[BookSearchItemResponse],
    summary="Tìm kiếm sách Full-Text Search và phân trang",
)
def search_books(
    q: Optional[str] = Query(None, max_length=200, description="Tìm toàn văn trên nhan đề, tác giả, NXB, mô tả, từ khóa"),
    author: Optional[str] = Query(None, max_length=150, description="Tìm theo tên tác giả"),
    publisher: Optional[str] = Query(None, max_length=150, description="Tìm theo nhà xuất bản"),
    year: Optional[int] = Query(None, ge=0, le=9999, description="Năm xuất bản"),
    subject_code: Optional[str] = Query(None, max_length=50, description="Mã môn học: IT, ECO, ENG"),
    category: Optional[str] = Query(None, max_length=100, description="ID hoặc tên danh mục"),
    attribute: Optional[str] = Query(None, max_length=200, description="Thuộc tính / từ khóa của sách"),
    format: Optional[BookFormat] = Query(None, description="Định dạng: PRINTED, EBOOK, BOTH"),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    # Tham số cũ – giữ để tương thích ngược
    publication_year: Optional[int] = Query(None, include_in_schema=False),
    category_id: Optional[int] = Query(None, include_in_schema=False),
    book_type: Optional[BookFormat] = Query(None, include_in_schema=False),
    keyword: Optional[str] = Query(None, max_length=200, include_in_schema=False),
    exact_format: bool = Query(False, description="True = khớp đúng loại sách, không gộp BOTH"),
    exact_publisher: bool = Query(False, description="True = khớp đúng tên nhà xuất bản"),
    db: Session = Depends(get_db),
):
    fmt = format or book_type
    return search_books_advanced(
        db=db,
        query_text=q,
        author=author,
        publisher=publisher,
        year=year if year is not None else publication_year,
        subject_code=subject_code,
        category=category or (str(category_id) if category_id is not None else None),
        attribute=attribute or keyword,
        format=fmt.value if fmt else None,
        exact_format=exact_format,
        exact_publisher=exact_publisher,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/categories",
    response_model=CatalogTreeResponse,
    summary="Cây phân loại: Môn học/Bộ môn, Thuộc tính sách, Thể loại",
)
def get_catalog_tree(db: Session = Depends(get_db)):
    return get_catalog_tree_service(db)


@router.get(
    "",
    response_model=PaginatedResponse[BookSearchItemResponse],
    summary="Duyệt / lọc danh mục theo SRS UC02–UC03 (cùng bộ lọc với /search; tối đa 50 bản ghi)",
)
def list_books(
    q: Optional[str] = Query(None, max_length=200),
    author: Optional[str] = Query(None, max_length=150),
    publisher: Optional[str] = Query(None, max_length=150),
    year: Optional[int] = Query(None, ge=0, le=9999),
    subject_code: Optional[str] = Query(None, max_length=50),
    category: Optional[str] = Query(None, max_length=100),
    attribute: Optional[str] = Query(None, max_length=200, description="TEXTBOOK | REFERENCE | WORKBOOK"),
    format: Optional[BookFormat] = Query(None),
    page: int = Query(1, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=MAX_PAGE_SIZE),
    limit: Optional[int] = Query(None, ge=1, le=MAX_PAGE_SIZE, description="Tên khác của page_size (SRS: page, limit)"),
    offset: Optional[int] = Query(None, ge=0, description="Tương thích bản cũ: offset → trang"),
    db: Session = Depends(get_db),
):
    size = page_size or limit or DEFAULT_PAGE_SIZE
    if offset is not None:
        page = offset // size + 1
    return search_books_advanced(
        db=db, query_text=q, author=author, publisher=publisher, year=year, subject_code=subject_code,
        category=category, attribute=attribute, format=format.value if format else None,
        exact_format=False, exact_publisher=False, page=page, page_size=size,
    )


# Phải khai báo SAU các route tĩnh (/search, /categories)
@router.get(
    "/{book_id}",
    response_model=BookDetailResponse,
    summary="Chi tiết sách (404 nếu không tồn tại hoặc bị vô hiệu hóa)",
    responses={404: {"description": "Không tìm thấy sách"}},
)
def get_book_detail(
    book_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
):
    return get_book_detail_service(db, book_id)
