from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.book import Book, Category, Ebook, Subject
from app.models.user import Account
from app.schemas.book import BookCreate, BookResponse, BookUpdate, UploadResponse
from app.services.upload_service import delete_static_file, save_cover_image, save_ebook_pdf


router = APIRouter(
    prefix="/api/admin/books",
    tags=["Admin - Books"],
)


def _get_book_or_404(db: Session, book_id: int) -> Book:
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy sách",
        )
    return book


def _validate_relations(
    db: Session,
    *,
    category_id: int | None,
    subject_code: str | None,
) -> None:
    if category_id is not None and db.get(Category, category_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="category_id không tồn tại",
        )
    if subject_code is not None and db.get(Subject, subject_code) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="subject_code không tồn tại",
        )


@router.post(
    "",
    response_model=BookResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Thêm mới đầu sách",
)
def create_book(
    payload: BookCreate,
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> Book:
    _validate_relations(
        db,
        category_id=payload.category_id,
        subject_code=payload.subject_code,
    )

    book = Book(**payload.model_dump())
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


@router.put(
    "/{book_id}",
    response_model=BookResponse,
    summary="Cập nhật thông tin đầu sách",
)
def update_book(
    book_id: int,
    payload: BookUpdate,
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> Book:
    book = _get_book_or_404(db, book_id)
    changes = payload.model_dump(exclude_unset=True)

    category_id = changes.get("category_id", book.category_id)
    subject_code = changes.get("subject_code", book.subject_code)
    _validate_relations(
        db,
        category_id=category_id,
        subject_code=subject_code,
    )

    for field, value in changes.items():
        setattr(book, field, value)

    db.commit()
    db.refresh(book)
    return book


@router.delete(
    "/{book_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Vô hiệu hóa đầu sách",
)
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> None:
    book = _get_book_or_404(db, book_id)
    if not book.is_active:
        return
    book.is_active = False
    book.available_stock = 0
    db.commit()


@router.post(
    "/{book_id}/upload-cover",
    response_model=UploadResponse,
    summary="Upload ảnh bìa sách",
)
async def upload_cover(
    book_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> UploadResponse:
    book = _get_book_or_404(db, book_id)
    old_path = book.cover_image_path

    new_path = await save_cover_image(file)
    book.cover_image_path = new_path

    try:
        db.commit()
        db.refresh(book)
    except Exception:
        db.rollback()
        delete_static_file(new_path)
        raise

    delete_static_file(old_path)
    return UploadResponse(
        book_id=book.id,
        file_path=new_path,
        message="Upload ảnh bìa thành công",
    )


@router.post(
    "/{book_id}/upload-pdf",
    response_model=UploadResponse,
    summary="Upload file PDF eBook",
)
async def upload_pdf(
    book_id: int,
    file: UploadFile = File(...),
    is_free: bool = False,
    preview_pages: int = 10,
    borrow_days: int = 14,
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> UploadResponse:
    book = _get_book_or_404(db, book_id)
    if book.book_type not in ("EBOOK", "BOTH"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chỉ sách có book_type=EBOOK hoặc BOTH mới được upload PDF",
        )

    if not 5 <= preview_pages <= 10 or not 1 <= borrow_days <= 365:
        raise HTTPException(
            status_code=422,
            detail="preview_pages phải 5-10; borrow_days phải 1-365",
        )

    old_path = book.ebook.file_path if book.ebook else None
    new_path = await save_ebook_pdf(file)

    if book.ebook is None:
        book.ebook = Ebook(
            file_path=new_path,
            is_free=is_free,
            preview_pages=preview_pages,
            borrow_days=borrow_days,
        )
    else:
        book.ebook.file_path = new_path
        book.ebook.is_free = is_free
        book.ebook.preview_pages = preview_pages
        book.ebook.borrow_days = borrow_days

    try:
        db.commit()
        db.refresh(book)
    except Exception:
        db.rollback()
        delete_static_file(new_path)
        raise

    delete_static_file(old_path)
    return UploadResponse(
        book_id=book.id,
        file_path=new_path,
        message="Upload PDF eBook thành công",
    )
