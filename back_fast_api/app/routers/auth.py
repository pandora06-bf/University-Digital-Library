from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_account
from app.core.security import create_access_token, verify_password
from app.models.user import Account
from app.schemas.auth import AuthenticatedUser, LoginRequest, TokenResponse

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


@router.get("/test")
def test_auth():
    return {"message": "Auth router is working"}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if len(payload.password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must not exceed 72 UTF-8 bytes",
        )

    try:
        account = db.query(Account).filter(Account.username == payload.username).first()
    except SQLAlchemyError as exc:
        # Không để lỗi DB bị biến thành 500 khó hiểu trên Swagger.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not ready. Please check migrations and database connection.",
        ) from exc

    if account is None or not verify_password(payload.password, account.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    token = create_access_token(
        {"sub": str(account.id), "role": account.role.strip().upper()}
    )
    return TokenResponse(
        access_token=token,
        user=AuthenticatedUser.model_validate(account),
    )


@router.get("/me", response_model=AuthenticatedUser)
def get_me(account: Account = Depends(get_current_account)) -> Account:
    return account
