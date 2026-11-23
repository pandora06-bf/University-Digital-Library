from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.book import Book, BookCopy
from app.models.loan import Loan
from app.models.user import Account
from app.schemas.inventory import (
    InventoryCreate,
    InventoryResponse,
    InventoryStatus,
    InventoryUpdate,
)


router = APIRouter(
    prefix="/api/admin",
    tags=["Admin - Inventory"],
)


def _get_copy_or_404(db: Session, barcode: str) -> BookCopy:
    copy = db.get(BookCopy, barcode)
    if copy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy bản sao sách",
        )
    return copy


def _get_physical_book_for_update(db: Session, book_id: int) -> Book:
    book = db.scalar(select(Book).where(Book.id == book_id).with_for_update())
    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy đầu sách",
        )
    if book.book_type == "EBOOK":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Không thể quản lý bản sao vật lý cho sách điện tử",
        )
    return book


def _is_available(copy: BookCopy) -> bool:
    return copy.status == "AVAILABLE"


@router.post(
    "/books/{book_id}/copies",
    response_model=InventoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Thêm bản sao sách vào kho",
)
def create_inventory_copy(
    book_id: int,
    payload: InventoryCreate,
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> BookCopy:
    book = _get_physical_book_for_update(db, book_id)
    copy = BookCopy(book_id=book_id, **payload.model_dump())
    db.add(copy)
    if _is_available(copy):
        book.available_stock += 1

    try:
        db.commit()
        db.refresh(copy)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mã barcode đã tồn tại hoặc dữ liệu kho không hợp lệ",
        ) from exc
    return copy


@router.get(
    "/books/{book_id}/copies",
    response_model=list[InventoryResponse],
    summary="Danh sách bản sao sách trong kho",
)
def list_inventory(
    book_id: int,
    copy_status: InventoryStatus | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> list[BookCopy]:
    query = select(BookCopy).order_by(BookCopy.copy_barcode.asc())
    query = query.where(BookCopy.book_id == book_id)
    if copy_status is not None:
        query = query.where(BookCopy.status == copy_status)
    return list(db.scalars(query.offset(skip).limit(limit)).all())


@router.get(
    "/copies/{copy_id}",
    response_model=InventoryResponse,
    summary="Chi tiết một bản sao sách",
)
def get_inventory_copy(
    copy_id: str,
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> BookCopy:
    return _get_copy_or_404(db, copy_id)


@router.patch(
    "/copies/{copy_id}/condition",
    response_model=InventoryResponse,
    summary="Cập nhật vị trí hoặc trạng thái bản sao sách",
)
def update_inventory_copy(
    copy_id: str,
    payload: InventoryUpdate,
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> BookCopy:
    copy = _get_copy_or_404(db, copy_id)
    book = _get_physical_book_for_update(db, copy.book_id)
    old_available = _is_available(copy)
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(copy, field, value)
    new_available = _is_available(copy)
    if old_available and not new_available:
        # Tránh âm available_stock (chk_book_available_stock_positive) khi dữ liệu lệch.
        book.available_stock = max(0, int(book.available_stock or 0) - 1)
    elif not old_available and new_available:
        book.available_stock = int(book.available_stock or 0) + 1

    db.commit()
    db.refresh(copy)
    return copy


@router.delete(
    "/copies/{copy_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa bản sao sách khỏi kho",
)
def delete_inventory_copy(
    copy_id: str,
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> None:
    copy = _get_copy_or_404(db, copy_id)
    book = _get_physical_book_for_update(db, copy.book_id)
    has_loan_history = db.scalar(
        select(Loan.id).where(Loan.copy_barcode == copy_id).limit(1)
    )
    if has_loan_history is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Không thể xóa bản sao đã có lịch sử mượn; hãy đánh dấu mất hoặc hư hỏng thay vì xóa",
        )

    if _is_available(copy):
        book.available_stock -= 1
    db.delete(copy)
    db.commit()
