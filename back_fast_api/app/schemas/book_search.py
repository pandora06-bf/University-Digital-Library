
from typing import Any, Generic, List, Optional, TypeVar
from pydantic import AliasPath, BaseModel, ConfigDict, Field, model_validator

T = TypeVar("T")


class BookSearchItemResponse(BaseModel):
    id: int
    title: str
    author: Optional[str] = None
    isbn: Optional[str] = None
    publisher: Optional[str] = None
    price: int
    available_stock: int
    total_copies: int = 0
    available_copies: int = 0
    cover_image_path: Optional[str] = None
    category_name: Optional[str] = Field(
        default=None,
        validation_alias=AliasPath("category", "category_name"),
    )
    book_type: str
    published_year: Optional[int] = Field(
        default=None,
        validation_alias="publication_year"
    )
    category_id: Optional[int] = None
    subject_id: Optional[int] = None
    # Admin eBook list: biết sách đã có PDF và quy tắc xem trước
    has_pdf: bool = False
    preview_pages: Optional[int] = None
    is_free: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def hydrate_ebook_flags(cls, data: Any):
        if not hasattr(data, "id"):
            return data
        ebook = getattr(data, "ebook", None)
        category = getattr(data, "category", None)
        return {
            "id": data.id,
            "title": data.title,
            "author": getattr(data, "author", None),
            "isbn": getattr(data, "isbn", None),
            "publisher": getattr(data, "publisher", None),
            "price": data.price,
            "available_stock": data.available_stock,
            "total_copies": int(getattr(data, "total_copies", 0) or 0),
            "available_copies": int(getattr(data, "available_copies", 0) or 0),
            "cover_image_path": getattr(data, "cover_image_path", None),
            "category_name": getattr(category, "category_name", None) if category else None,
            "book_type": data.book_type,
            "published_year": getattr(data, "publication_year", None),
            "category_id": getattr(data, "category_id", None),
            "subject_id": getattr(data, "subject_id", None),
            "has_pdf": ebook is not None,
            "preview_pages": getattr(ebook, "preview_pages", None) if ebook else None,
            "is_free": getattr(ebook, "is_free", None) if ebook else None,
        }


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
