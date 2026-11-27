from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _normalize_category_name(value: str) -> str:
    """Chuẩn hóa khoảng trắng và không cho phép tên danh mục rỗng."""
    normalized = " ".join(value.split())
    if not normalized:
        raise ValueError("Tên danh mục không được để trống")
    return normalized


class CategoryCreate(BaseModel):
    category_name: str = Field(min_length=1, max_length=100)

    @field_validator("category_name", mode="before")
    @classmethod
    def normalize_name(cls, value):
        if not isinstance(value, str):
            return value
        return _normalize_category_name(value)


class CategoryUpdate(BaseModel):
    category_name: str = Field(min_length=1, max_length=100)

    @field_validator("category_name", mode="before")
    @classmethod
    def normalize_name(cls, value):
        if not isinstance(value, str):
            return value
        return _normalize_category_name(value)


class CategoryResponse(BaseModel):
    id: int
    category_name: str

    model_config = ConfigDict(from_attributes=True)

class SubjectTreeOut(BaseModel):
    subject_code: str = Field(..., description="Mã môn học")
    name: str = Field(..., description="Tên bộ môn / môn học")
    book_types: List[str] = Field(default_factory=list, description="Thuộc tính sách (PRINTED, EBOOK)")
    categories: List[CategoryResponse] = Field(default_factory=list, description="Danh sách thể loại liên quan")

    class Config:
        from_attributes = True


class BookAttributeOut(BaseModel):
    code: str = Field(..., description="TEXTBOOK | REFERENCE | WORKBOOK")
    label: str = Field(..., description="Giáo trình / Tài liệu tham khảo / Sách bài tập")
    count: int = Field(0, description="Số đầu sách đang hoạt động")


class CatalogTreeResponse(BaseModel):
    subjects: List[SubjectTreeOut]
    available_book_types: List[str] = Field(default=["PRINTED", "EBOOK"])
    attributes: List[BookAttributeOut] = Field(default_factory=list, description="Thuộc tính sách (SRS UC02)")


class BookShelfLocation(BaseModel):
    copy_barcode: str
    zone: Optional[str] = Field(None, description="Khu")
    floor: Optional[str] = Field(None, description="Tầng")
    shelf: Optional[str] = Field(None, description="Dãy / Kệ")
    status: str = Field(..., description="Trạng thái bản sao")

    class Config:
        from_attributes = True


class BookDetailResponse(BaseModel):
    id: int
    title: str
    author: str
    publisher: Optional[str] = None
    publication_year: Optional[int] = None
    description: Optional[str] = None
    book_type: str
    price: Optional[float] = None
    cover_image_url: Optional[str] = None
    available_stock: int
    subject_code: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    # SRS UC02 Output: tên khác, thuộc tính, từ khóa, số chương, số trang
    alternative_title: Optional[str] = None
    book_attribute: Optional[str] = None
    book_attribute_label: Optional[str] = None
    keywords: Optional[str] = None
    num_chapters: Optional[int] = None
    num_pages: Optional[int] = None
    locations: List[BookShelfLocation] = Field(default_factory=list)

    class Config:
        from_attributes = True
