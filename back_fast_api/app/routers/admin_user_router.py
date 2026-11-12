"""2B-06: Administration of library users. All routes require ADMIN."""
import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.security import hash_password
from app.models.user import Account, User
from app.services.email_notifier import send_temporary_password
from app.services.import_service import _temporary_password

router = APIRouter(prefix="/api/admin/users", tags=["Admin - Users"])
ROLES = {"STUDENT", "LECTURER", "ADMIN", "LIBRARIAN"}


class UserInput(BaseModel):
    user_code: str = Field(min_length=3, max_length=50)
    full_name: str = Field(min_length=2, max_length=100)
    email: str = Field(max_length=100)
    phone_number: str | None = Field(default=None, max_length=20)
    department: str = Field(min_length=2, max_length=100)
    role: str = "STUDENT"
    username: str | None = Field(default=None, max_length=50)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    email: str | None = Field(default=None, max_length=100)
    phone_number: str | None = Field(default=None, max_length=20)
    department: str | None = Field(default=None, min_length=2, max_length=100)
    role: str | None = None


class LockBody(BaseModel):
    is_locked: bool


def _role(value: str) -> str:
    result = value.strip().upper()
    if result not in ROLES:
        raise HTTPException(422, "Vai trò không hợp lệ")
    return result


def _email(value: str) -> str:
    value = value.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
        raise HTTPException(422, "Email không hợp lệ")
    return value


def _present(u: User):
    a = u.account
    return {
        "account_id": u.account_id, "username": a.username, "user_code": u.user_code,
        "full_name": u.full_name, "email": u.email, "phone_number": u.phone_number,
        "department": u.department, "role": a.role,
        "is_locked": not a.is_active or u.is_borrowing_blocked,
        "total_fines": str(u.total_fines), "max_borrow_limit": u.max_borrow_limit,
    }


@router.get("")
def list_users(
    q: str | None = None, role: str | None = None,
    page: int = Query(1, ge=1), page_size: int = Query(8, ge=1, le=100),
    db: Session = Depends(get_db), _admin: Account = Depends(require_roles("ADMIN")),
):
    stmt = select(User).join(Account, User.account_id == Account.id)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.user_code.ilike(pattern), User.full_name.ilike(pattern),
                              User.email.ilike(pattern), Account.username.ilike(pattern)))
    if role and role.upper() != "ALL":
        stmt = stmt.where(Account.role == _role(role))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(User.user_code).offset((page-1)*page_size).limit(page_size)).all()
    return {"items": [_present(u) for u in rows], "total": total, "page": page,
            "page_size": page_size, "total_pages": (total + page_size - 1)//page_size}


@router.post("", status_code=201)
def create_user(body: UserInput, tasks: BackgroundTasks, db: Session = Depends(get_db),
                _admin: Account = Depends(require_roles("ADMIN"))):
    code = body.user_code.strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{3,50}", code):
        raise HTTPException(422, "Mã người dùng không hợp lệ")
    username = (body.username or f"sv{code}").strip()
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", username):
        raise HTTPException(422, "Username không hợp lệ")
    role = _role(body.role)
    email = _email(body.email)
    if db.get(User, code) or db.scalar(select(Account.id).where(Account.username == username)) or db.scalar(select(User.user_code).where(User.email == email)):
        raise HTTPException(409, "Mã, username hoặc email đã tồn tại")
    password = _temporary_password()
    try:
        account = Account(username=username, password=hash_password(password), role=role, is_active=True)
        db.add(account)
        db.flush()
        user = User(user_code=code, account_id=account.id, full_name=body.full_name.strip(),
                    email=email, phone_number=body.phone_number, department=body.department.strip(),
                    user_type=role, max_borrow_limit=5 if role == "LECTURER" else 3)
        db.add(user)
        db.flush()
        data = _present(user)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Mã, username hoặc email đã tồn tại") from exc
    except Exception:
        db.rollback()
        raise
    tasks.add_task(send_temporary_password, email, body.full_name, username, password)
    return {**data, "temporary_password": password}


@router.put("/{user_code}")
def update_user(user_code: str, body: UserUpdate, db: Session = Depends(get_db),
                admin: Account = Depends(require_roles("ADMIN"))):
    user = db.get(User, user_code)
    if not user:
        raise HTTPException(404, "Không tìm thấy người dùng")
    changes = body.model_dump(exclude_unset=True)
    if "role" in changes and changes["role"] is not None:
        role = _role(changes["role"])
        if user.account_id == admin.id and role != "ADMIN":
            raise HTTPException(409, "Không thể hạ quyền tài khoản Admin đang đăng nhập")
        user.account.role = role
        user.user_type = role
        user.max_borrow_limit = 5 if role == "LECTURER" else 3
    if "email" in changes and changes["email"] is not None:
        user.email = _email(changes["email"])
    for field in ("full_name", "phone_number", "department"):
        if field in changes:
            if changes[field] is None and field != "phone_number":
                raise HTTPException(422, f"{field} không được để trống")
            setattr(user, field, changes[field].strip() if isinstance(changes[field], str) else None)
    try:
        db.flush()
        data = _present(user)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Email đã tồn tại") from exc
    return data


@router.patch("/{user_code}/lock")
def lock_user(user_code: str, body: LockBody, db: Session = Depends(get_db),
              admin: Account = Depends(require_roles("ADMIN"))):
    user = db.get(User, user_code)
    if not user:
        raise HTTPException(404, "Không tìm thấy người dùng")
    if body.is_locked and user.account.role == "ADMIN":
        raise HTTPException(409, "Không thể khóa tài khoản ADMIN")
    if not body.is_locked and user.total_fines > 0:
        raise HTTPException(409, "Không thể mở khóa khi còn công nợ")
    user.account.is_active = not body.is_locked
    user.is_borrowing_blocked = body.is_locked
    db.flush()
    data = _present(user)
    db.commit()
    return data
