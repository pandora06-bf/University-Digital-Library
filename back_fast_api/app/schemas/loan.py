from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from pydantic import BaseModel, Field, model_validator

class LoanResponse(BaseModel):
    id: int
    user_code: str
    book_id: int
    copy_barcode: Optional[str] = None
    loan_code: Optional[str] = None
    borrow_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    pickup_deadline: Optional[datetime] = None
    loan_status: str
    checkout_condition: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PhysicalLoanRequest(BaseModel):
    """Input: Đặt mượn sách vật lý, giữ chỗ tới quầy nhận trong 24 giờ (UC05 / 3-01.a)."""

    book_id: int = Field(..., gt=0, description="Mã đầu sách vật lý cần mượn")


class LoanCheckoutRequest(BaseModel):
    """
    Input Check-out: Quét mã mượn hoặc MSSV kết hợp mã vạch bản sao và ghi chú tình trạng (UC10)
    """
    loan_id: Optional[int] = Field(None, description="Mã phiếu mượn (nếu đã đặt trước trên Web)")
    user_code: Optional[str] = Field(None, description="MSSV/Mã bạn đọc (nếu mượn trực tiếp tại quầy)")
    copy_barcode: str = Field(..., description="Mã vạch bản sao sách vật lý xuất kho")
    condition_notes: Optional[str] = Field(None, description="Ghi chú đồng kiểm tình trạng sách (BR-03)")

    @model_validator(mode="after")
    def validate_identification(self):
        if not self.loan_id and not self.user_code:
            raise ValueError("Phải cung cấp ít nhất loan_id (đặt trước) hoặc user_code (mượn trực tiếp)")
        return self

class LoanCheckinRequest(BaseModel):
    """
    Input Check-in: Quét mã vạch bản sao sách trả về tại quầy (UC10)
    """
    copy_barcode: str = Field(..., description="Mã vạch cuốn sách trả về quét tại quầy")
    condition_notes: Optional[str] = Field(None, description="Tình trạng nhận lại sách")
    is_lost: bool = Field(False, description="Đánh dấu nếu bạn đọc báo mất sách (UC15)")
    is_damaged: bool = Field(False, description="Đánh dấu nếu sách hỏng nặng (UC15)")
    damage_penalty: Optional[Decimal] = Field(None, ge=0, description="Tiền bồi thường hỏng sách (nếu có)")


class FineCollectRequest(BaseModel):
    """
    Input Thu phạt: MSSV, số tiền thu đủ (không thu một phần) và ghi chú (UC10 / BR-34)
    """
    user_code: str = Field(..., description="MSSV/Mã bạn đọc cần thu tiền phạt")
    amount: Decimal = Field(..., gt=0, description="Số tiền thu (phải bằng đúng Total_Fines)")
    notes: Optional[str] = Field(None, description="Ghi chú thu tiền mặt tại quầy")