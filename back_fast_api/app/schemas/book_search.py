
from typing import Generic, List, Optional, TypeVar
from pydantic import AliasPath, BaseModel, ConfigDict, Field

T = TypeVar("T")


class BookSearchItemResponse(BaseModel):
    id: int
    title: str
    author: Optional[str] = None
    isbn: Optional[str] = None
    publisher: Optional[str] = None
    price: int
    available_stock: int
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

    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
