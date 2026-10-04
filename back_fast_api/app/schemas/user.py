from pydantic import BaseModel, ConfigDict
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


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
    user_code: str
    username: str
    full_name: str
    email: str
    phone_number: Optional[str] = None
    department: str
    academic_title: Optional[str] = None
    user_type: str
    role: str
    max_borrow_limit: int
    max_borrow_days: int
    current_borrow_count: int
    is_borrowing_blocked: bool
    is_active: bool
    total_fines: Decimal

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
