from pydantic import BaseModel, ConfigDict
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field

class LoanCreate(BaseModel):
    user_id: int
    book_id: int


class LoanResponse(BaseModel):
    id: int
    user_id: int
    book_id: int
    borrow_date: datetime| None = None
    due_date: datetime | None = None
    status: str

    model_config = ConfigDict(from_attributes=True)

class LoanCheckoutRequest(BaseModel):
    # Tra cứu theo mã mượn (loan_id) hoặc MSSV (user_code) kết hợp mã vạch cuốn sách
    loan_id: Optional[int] = Field(None, description="Mã phiếu mượn (nếu tra cứu theo mã phiếu)")
    user_code: Optional[str] = Field(None, description="Mã bạn đọc/MSSV (nếu tra cứu theo MSSV)")
    copy_barcode: str = Field(..., description="Mã vạch bản sao sách vật lý xuất kho")
    condition_notes: Optional[str] = Field(None, description="Ghi chú tình trạng sách khi giao (BR-03)")


class LoanCheckinRequest(BaseModel):
    copy_barcode: str = Field(..., description="Mã vạch cuốn sách trả về quét tại quầy")
    condition_notes: Optional[str] = Field(None, description="Tình trạng nhận lại sách")
    is_lost: bool = Field(False, description="Đánh dấu nếu bạn đọc báo mất sách (UC15)")
    is_damaged: bool = Field(False, description="Đánh dấu nếu sách hỏng nặng (UC15)")
    damage_penalty: Optional[Decimal] = Field(None, ge=0, description="Tiền bồi thường hỏng sách (nếu có)")


# --- Fine Collect Schema ---
class FineCollectRequest(BaseModel):
    user_code: str = Field(..., description="MSSV/Mã bạn đọc cần thu tiền phạt")
    amount: Decimal = Field(..., gt=0, description="Số tiền thu (bắt buộc thu đủ toàn bộ Total_Fines, không thu một phần)")
    notes: Optional[str] = Field(None, description="Ghi chú thu tiền mặt tại quầy")
