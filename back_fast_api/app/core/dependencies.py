from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import Account

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
