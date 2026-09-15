from datetime import date

from pydantic import BaseModel, ConfigDict


class LoanCreate(BaseModel):
    user_id: int
    book_id: int


class LoanResponse(BaseModel):
    id: int
    user_id: int
    book_id: int
    borrow_date: date | None = None
    due_date: date | None = None
    status: str

    model_config = ConfigDict(from_attributes=True)
