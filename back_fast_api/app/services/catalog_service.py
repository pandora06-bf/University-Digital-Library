from typing import Dict, Any
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.book import Book, BookCopy, Category, Subject
from app.models.book_attributes import BOOK_ATTRIBUTES

# Bản sao ở các trạng thái này coi như ngừng lưu hành
INACTIVE_COPY_STATUSES = {"LOST", "DAMAGED", "RETIRED"}


def is_book_disabled(book: Book, copies) -> bool:
    """Sách bị coi là vô hiệu hóa khi có bản sao vật lý nhưng TẤT CẢ đều ngừng lưu hành,
    trừ khi sách vẫn còn đọc được dưới dạng ebook. Sách chưa có bản sao nào thì vẫn hiển thị."""
    if book.book_type in ("EBOOK", "BOTH") and book.ebook is not None:
        return False
    if not copies:
        return False
    return all((cp.status or "").upper() in INACTIVE_COPY_STATUSES for cp in copies)


def get_catalog_tree_service(db: Session) -> Dict[str, Any]:
    subjects = db.scalars(select(Subject).order_by(Subject.subject_code)).all()
    categories = db.scalars(select(Category).order_by(Category.id.asc())).all()
    books = db.scalars(select(Book).where(Book.is_active.is_(True))).all()

    subject_tree = []
    for subj in subjects:
        subj_books = [b for b in books if b.subject_code == subj.subject_code]
        book_types = sorted(list({b.book_type for b in subj_books if b.book_type}))
        cat_ids = {b.category_id for b in subj_books if b.category_id is not None}

        # Khớp theo category_name đã có trong DB
        related_categories = [
            {"id": c.id, "category_name": c.category_name}
            for c in categories
            if c.id in cat_ids
        ]

        subject_tree.append({
            "subject_code": subj.subject_code,
            "name": getattr(subj, "subject_name", getattr(subj, "name", subj.subject_code)),
            "book_types": book_types if book_types else ["PRINTED"],
            "categories": related_categories,
        })

    return {
        "subjects": subject_tree,
        "available_book_types": ["PRINTED", "EBOOK"],
        "attributes": [
            {"code": code, "label": label, "count": sum(1 for b in books if b.book_attribute == code)}
            for code, label in BOOK_ATTRIBUTES.items()
        ],
    }


def get_book_detail_service(db: Session, book_id: int) -> Dict[str, Any]:
    book = db.scalar(select(Book).where(Book.id == book_id))

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sách với mã {book_id}",
        )

    if not book.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sách hiện đã bị vô hiệu hóa hoặc ngừng lưu hành",
        )

    copies = db.scalars(
        select(BookCopy)
        .where(BookCopy.book_id == book_id)
        .order_by(BookCopy.zone, BookCopy.floor, BookCopy.shelf)
    ).all()

    if is_book_disabled(book, copies):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sách hiện đã bị vô hiệu hóa hoặc ngừng lưu hành",
        )

    # Lấy tên thể loại nếu có
    cat_name = None
    if book.category_id:
        category = db.get(Category, book.category_id)
        if category:
            cat_name = category.category_name

    # Danh sách vị trí bản sao trên kệ (bỏ các bản đã ngừng lưu hành)
    locations = [
        {
            "copy_barcode": cp.copy_barcode,
            "zone": cp.zone,
            "floor": cp.floor,
            "shelf": cp.shelf,
            "status": cp.status,
        }
        for cp in copies
        if (cp.status or "").upper() not in INACTIVE_COPY_STATUSES
    ]

    return {
        "id": book.id,
        "title": book.title,
        "author": book.author,
        "publisher": book.publisher,
        "publication_year": book.publication_year,
        "description": book.description,
        "book_type": book.book_type,
        "price": float(book.price) if book.price is not None else None,
        "cover_image_url": book.cover_image_path,
        "available_stock": book.available_stock,
        "subject_code": book.subject_code,
        "category_id": book.category_id,
        "category_name": cat_name,
        "alternative_title": book.alternative_title,
        "book_attribute": book.book_attribute,
        "book_attribute_label": BOOK_ATTRIBUTES.get(book.book_attribute or ""),
        "keywords": book.keywords,
        "num_chapters": book.num_chapters,
        "num_pages": book.num_pages,
        "locations": locations,
    }