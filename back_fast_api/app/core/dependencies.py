from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import Account, User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_account(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Account:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    payload = decode_access_token(credentials.credentials)
    subject = payload.get("sub") if payload else None
    if not isinstance(subject, str) or not subject.isdecimal():
        raise unauthorized

    account = db.get(Account, int(subject))
    if account is None or not account.is_active:
        raise unauthorized

    return account


def require_roles(*allowed_roles: str) -> Callable:
    normalized_roles = {role.strip().upper() for role in allowed_roles}

    def check_role(account: Account = Depends(get_current_account)) -> Account:
        if account.role.strip().upper() not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return account

    return check_role

def get_current_user(
    account: Account = Depends(get_current_account),
    db: Session = Depends(get_db),
) -> User:
    # Truy xuất User từ relationship của Account
    user = account.user
    if user is None:
        user = db.query(User).filter(User.account_id == account.id).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài khoản chưa được liên kết với thông tin người dùng",
        )
    return user