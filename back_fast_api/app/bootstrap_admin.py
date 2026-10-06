import os

from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import Account


def ensure_admin_account() -> None:
    """Tạo/cập nhật tài khoản ADMIN phát triển theo biến môi trường, idempotent."""
    username = os.getenv("ADMIN_USERNAME", "admin").strip()
    password = os.getenv("ADMIN_PASSWORD", "Admin@123")

    if not username:
        raise RuntimeError("ADMIN_USERNAME không được để trống")
    if not password:
        raise RuntimeError("ADMIN_PASSWORD không được để trống")
    if len(password.encode("utf-8")) > 72:
        raise RuntimeError("ADMIN_PASSWORD vượt quá giới hạn 72 byte của bcrypt")

    db = SessionLocal()
    try:
        account = (
            db.query(Account)
            .filter(func.lower(Account.username) == username.lower())
            .first()
        )

        if account is None:
            account = Account(
                username=username,
                password=hash_password(password),
                role="ADMIN",
                is_active=True,
            )
            db.add(account)
            db.commit()
            print(f"[bootstrap] Created ADMIN account: {username}")
            return

        changed = False
        if account.role.strip().upper() != "ADMIN":
            account.role = "ADMIN"
            changed = True
        if not account.is_active:
            account.is_active = True
            changed = True

        # Chỉ reset password khi được yêu cầu rõ ràng.
        if os.getenv("RESET_ADMIN_PASSWORD", "false").lower() in {"1", "true", "yes"}:
            account.password = hash_password(password)
            changed = True

        if changed:
            db.commit()
            print(f"[bootstrap] Updated ADMIN account: {username}")
        else:
            print(f"[bootstrap] ADMIN account ready: {username}")
    except SQLAlchemyError:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    ensure_admin_account()
