from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.book import Book, Category
from app.models.user import Account
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate


router = APIRouter(
    prefix="/api/admin/categories",
    tags=["Admin - Categories"],
)


def _get_category_or_404(db: Session, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy danh mục",
        )
    return category


def _ensure_unique_name(
    db: Session,
    category_name: str,
    *,
    exclude_id: int | None = None,
) -> None:
    query = db.query(Category).filter(
        func.lower(Category.category_name) == category_name.lower()
    )
    if exclude_id is not None:
        query = query.filter(Category.id != exclude_id)

    if query.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tên danh mục đã tồn tại",
        )


@router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo danh mục",
)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> Category:
    _ensure_unique_name(db, payload.category_name)

    category = Category(category_name=payload.category_name)
    db.add(category)
    try:
        db.commit()
        db.refresh(category)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tên danh mục đã tồn tại",
        ) from exc

    return category


@router.get(
    "",
    response_model=list[CategoryResponse],
    summary="Xem danh sách danh mục",
)
def list_categories(
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> list[Category]:
    return db.query(Category).order_by(Category.id.asc()).all()


@router.get(
    "/{category_id}",
    response_model=CategoryResponse,
    summary="Xem chi tiết danh mục",
)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> Category:
    return _get_category_or_404(db, category_id)


@router.put(
    "/{category_id}",
    response_model=CategoryResponse,
    summary="Cập nhật danh mục",
)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> Category:
    category = _get_category_or_404(db, category_id)
    _ensure_unique_name(
        db,
        payload.category_name,
        exclude_id=category_id,
    )

    category.category_name = payload.category_name
    try:
        db.commit()
        db.refresh(category)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tên danh mục đã tồn tại",
        ) from exc

    return category


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa danh mục",
)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: Account = Depends(require_roles("ADMIN")),
) -> None:
    category = _get_category_or_404(db, category_id)

    # Chỉ chặn khi còn đầu sách đang hoạt động. Sách đã vô hiệu hóa không giữ thể loại.
    book_in_use = (
        db.query(Book.id)
        .filter(Book.category_id == category_id, Book.is_active.is_(True))
        .first()
    )
    if book_in_use is not None:
        # Book.category_id đang dùng ON DELETE SET NULL ở DB, nhưng nghiệp vụ
        # quản trị yêu cầu không cho xóa danh mục khi vẫn còn sách sử dụng.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Không thể xóa danh mục vì đang được sách sử dụng (vd. đầu sách #{book_in_use[0]})",
        )

    db.delete(category)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Không thể xóa danh mục vì đang có dữ liệu liên quan",
        ) from exc
