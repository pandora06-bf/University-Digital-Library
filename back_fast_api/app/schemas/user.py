from pydantic import BaseModel, ConfigDict
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from pydantic import Field

class UserBase(BaseModel):
    username: str
    full_name: str
    role: str


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class UserProfileResponse(BaseModel):
    full_name: str
    user_code: str
    phone_number: Optional[str] = None
    email: str
    department: str
    role: str
    is_locked: bool
    total_fines: Decimal
    service_balance: int = Field(
        default=0, description="Số dư ví dịch vụ (VNĐ)"
    )

    # Dạng chuỗi hiển thị theo yêu cầu "đã dùng / tối đa"
    borrow_limit: str = Field(
        ...,
        example="1/3",
        description="Hạn mức mượn (Số sách đã mượn / Hạn mức tối đa)",
    )

    model_config = ConfigDict(from_attributes=True)


class UserLoanItemResponse(BaseModel):
    id: int
    book_id: int
    book_title: str
    book_author: str
    copy_barcode: Optional[str] = None
    loan_type: str
    loan_status: str
    borrow_date: datetime
    due_date: datetime
    return_date: Optional[datetime] = None
    renewal_count: int
    is_overdue: bool
    fine_amount: Optional[Decimal] = None
    fine_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UserDashboardResponse(BaseModel):
    total_borrowing: int
    total_overdue: int
    total_fines: Decimal
    current_loans: List[UserLoanItemResponse]
    recent_history: List[UserLoanItemResponse]

    model_config = ConfigDict(from_attributes=True)
