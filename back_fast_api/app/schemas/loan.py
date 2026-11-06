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
    renewal_count: int = 0
    checkout_condition: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PhysicalLoanRequest(BaseModel):
    """Input: Đặt mượn sách vật lý, giữ chỗ tới quầy nhận trong 24 giờ (UC05 / 3-01.a)."""

    book_id: int = Field(..., gt=0, description="Mã đầu sách vật lý cần mượn")


class LoanCheckoutRequest(BaseModel):
    """
    Input Check-out tại quầy (UC10). Hiển thị đủ các cột của bảng loans để test trên Swagger.

    - Đã đặt trước trên Web: gửi `loan_id` hoặc `loan_code` (+ `copy_barcode`, `condition_notes`).
    - Mượn trực tiếp tại quầy: gửi `user_code` + `copy_barcode` (+ `condition_notes`).

    Các trường do hệ thống tự quản lý (loan_status, borrow_date, due_date, return_date,
    renewal_count, checkin_condition, ebook_access_token, pickup_deadline) được chấp nhận
    nhưng BỎ QUA — có thể xóa khỏi body hoặc để null.
    """
    # --- Trường được dùng để xử lý ---
    loan_id: Optional[int] = Field(None, description="Mã phiếu mượn (id) nếu đã đặt trước trên Web")
    loan_code: Optional[str] = Field(None, description="Mã phiếu mượn dạng PM-YYYY-XXXXXXXX (đặt trước trên Web)")
    user_code: Optional[str] = Field(None, description="MSSV/Mã bạn đọc (bắt buộc khi mượn trực tiếp)")
    copy_barcode: str = Field(..., description="Mã vạch bản sao sách vật lý xuất kho")
    book_id: Optional[int] = Field(None, description="(Tùy chọn) Mã đầu sách — nếu gửi phải khớp với bản sao")
    loan_type: Optional[str] = Field("PHYSICAL", description="Chỉ hỗ trợ PHYSICAL tại quầy")
    condition_notes: Optional[str] = Field(None, description="Ghi chú đồng kiểm tình trạng sách, lưu vào checkout_condition (BR-03)")

    # --- Trường hệ thống tự tính, bị bỏ qua ---
    loan_status: Optional[str] = Field(None, description="Bỏ qua — hệ thống đặt BORROWED")
    borrow_date: Optional[datetime] = Field(None, description="Bỏ qua — hệ thống lấy thời điểm hiện tại")
    due_date: Optional[datetime] = Field(None, description="Bỏ qua — hệ thống tính theo max_borrow_days")
    return_date: Optional[datetime] = Field(None, description="Bỏ qua")
    renewal_count: Optional[int] = Field(None, description="Bỏ qua — mặc định 0")
    checkin_condition: Optional[str] = Field(None, description="Bỏ qua — chỉ dùng khi Check-in")
    ebook_access_token: Optional[str] = Field(None, description="Bỏ qua — chỉ dùng cho eBook")
    pickup_deadline: Optional[datetime] = Field(None, description="Bỏ qua — chỉ dùng cho phiếu đặt trước")

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "loan_id": None,
            "loan_code": None,
            "user_code": "SV-DEMO-001",
            "book_id": None,
            "copy_barcode": "DEMO-BC-001-01",
            "loan_type": "PHYSICAL",
            "loan_status": None,
            "borrow_date": None,
            "due_date": None,
            "return_date": None,
            "renewal_count": None,
            "condition_notes": "Sách nguyên vẹn",
            "checkin_condition": None,
            "ebook_access_token": None,
            "pickup_deadline": None,
        }
    })

    @model_validator(mode="after")
    def validate_identification(self):
        if not self.loan_id and not self.loan_code and not self.user_code:
            raise ValueError("Phải cung cấp loan_id/loan_code (đặt trước) hoặc user_code (mượn trực tiếp)")
        if self.loan_type and self.loan_type.upper() != "PHYSICAL":
            raise ValueError("Check-out tại quầy chỉ hỗ trợ loan_type = PHYSICAL")
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