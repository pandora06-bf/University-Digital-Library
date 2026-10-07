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
