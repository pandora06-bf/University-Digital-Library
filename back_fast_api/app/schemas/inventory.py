from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


InventoryStatus = Literal["AVAILABLE", "BORROWED", "DAMAGED", "LOST", "RETIRED"]


class InventoryCreate(BaseModel):
    copy_barcode: str = Field(min_length=1, max_length=100)
    zone: str = Field(min_length=1, max_length=50)
    floor: str = Field(min_length=1, max_length=50)
    shelf: str = Field(min_length=1, max_length=50)
    status: InventoryStatus = "AVAILABLE"
    damage_notes: str | None = None

    @field_validator("copy_barcode", "zone", "floor", "shelf", mode="before")
    @classmethod
    def strip_required_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class InventoryUpdate(BaseModel):
    zone: str | None = Field(default=None, min_length=1, max_length=50)
    floor: str | None = Field(default=None, min_length=1, max_length=50)
    shelf: str | None = Field(default=None, min_length=1, max_length=50)
    status: InventoryStatus | None = None
    damage_notes: str | None = None

    @field_validator("zone", "floor", "shelf", mode="before")
    @classmethod
    def strip_location_text(cls, value):
        if value is None:
            raise ValueError("Vị trí không được để trống")
        return value.strip() if isinstance(value, str) else value

    @field_validator("status", mode="before")
    @classmethod
    def require_status_when_provided(cls, value):
        if value is None:
            raise ValueError("Trạng thái không được để trống")
        return value


class InventoryResponse(BaseModel):
    copy_barcode: str
    book_id: int
    zone: str
    floor: str
    shelf: str
    status: InventoryStatus
    damage_notes: str | None = None

    model_config = ConfigDict(from_attributes=True)
