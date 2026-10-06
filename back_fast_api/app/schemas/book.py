from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


BookType = Literal["PRINTED", "EBOOK"]


class BookBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    author: str = Field(min_length=1, max_length=150)
    publisher: str = Field(min_length=1, max_length=150)
    publication_year: int = Field(ge=1000, le=2100)
    description: str | None = None
    keywords: str | None = None
    num_pages: int | None = Field(default=None, ge=1)
    book_type: BookType
    category_id: int | None = Field(default=None, ge=1)
    subject_code: str | None = Field(default=None, max_length=50)

    @field_validator("title", "author", "publisher", "subject_code", mode="before")
    @classmethod
    def strip_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
        return value


class BookCreate(BookBase):
    available_stock: int = Field(default=0, ge=0)


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    author: str | None = Field(default=None, min_length=1, max_length=150)
    publisher: str | None = Field(default=None, min_length=1, max_length=150)
    publication_year: int | None = Field(default=None, ge=1000, le=2100)
    description: str | None = None
    keywords: str | None = None
    num_pages: int | None = Field(default=None, ge=1)
    book_type: BookType | None = None
    available_stock: int | None = Field(default=None, ge=0)
    category_id: int | None = Field(default=None, ge=1)
    subject_code: str | None = Field(default=None, max_length=50)

    @field_validator("title", "author", "publisher", "subject_code", mode="before")
    @classmethod
    def strip_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
        return value


class EbookResponse(BaseModel):
    file_path: str
    is_free: bool

    model_config = ConfigDict(from_attributes=True)


class BookResponse(BookBase):
    id: int
    available_stock: int
    cover_image_path: str | None = None
    created_at: datetime
    ebook: EbookResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class UploadResponse(BaseModel):
    book_id: int
    file_path: str
    message: str
