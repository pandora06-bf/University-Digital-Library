"""2B-05.a: unit tests cho luồng đăng nhập và phân quyền (require_roles / get_current_account)."""
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from app.core.config import settings
from app.core.security import hash_password, create_access_token
from app.models.user import Account, User


def _make_account(db_session, *, username, role, is_active=True, password="Password123@"):
    account = Account(
        username=username,
        password=hash_password(password),
        role=role,
        is_active=is_active,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


def _make_user(db_session, account, *, user_code, is_borrowing_blocked=False):
    user = User(
        account_id=account.id,
        user_code=user_code,
        full_name="Test User",
        email=f"{user_code.lower()}@library.local",
        department="Khoa Công nghệ thông tin",
        user_type="STUDENT",
        max_borrow_limit=3,
        max_borrow_days=14,
        is_borrowing_blocked=is_borrowing_blocked,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _expired_token(account_id: int) -> str:
    payload = {
        "sub": str(account_id),
        "role": "STUDENT",
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# --- Đăng nhập (UC01) ---

def test_login_locked_for_borrowing_account_still_succeeds(client, db_session):
    """UC01 E4: tài khoản bị khóa mượn (is_borrowing_blocked) vẫn đăng nhập được bình thường."""
    account = _make_account(db_session, username="locked_reader", role="STUDENT")
    _make_user(db_session, account, user_code="SV2026LOCKED", is_borrowing_blocked=True)

    response = client.post(
        "/api/auth/login",
        json={"username": "locked_reader", "password": "Password123@"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_inactive_account_returns_403(client, db_session):
    _make_account(db_session, username="inactive_reader", role="STUDENT", is_active=False)

    response = client.post(
        "/api/auth/login",
        json={"username": "inactive_reader", "password": "Password123@"},
    )
    assert response.status_code == 403


def test_login_unknown_username_returns_401(client):
    response = client.post(
        "/api/auth/login",
        json={"username": "no_such_user", "password": "Password123@"},
    )
    assert response.status_code == 401


# --- JWT hết hạn / thiếu / sai định dạng ---

def test_expired_token_returns_401(client, db_session):
    account = _make_account(db_session, username="expiry_user", role="STUDENT")
    token = _expired_token(account.id)

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_missing_token_returns_401(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_malformed_token_returns_401(client):
    response = client.get(
        "/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401


def test_token_for_deleted_account_returns_401(client, db_session):
    account = _make_account(db_session, username="to_delete", role="STUDENT")
    token = create_access_token({"sub": str(account.id), "role": "STUDENT"})
    db_session.delete(account)
    db_session.commit()

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


# --- Phân quyền (require_roles) ---

def test_wrong_role_on_admin_route_returns_403(client, auth_headers):
    """auth_headers (fixture conftest) là tài khoản STUDENT; route quản trị phải từ chối."""
    response = client.get("/api/admin/categories", headers=auth_headers)
    assert response.status_code == 403


def test_admin_role_can_access_admin_route(client, admin_headers):
    response = client.get("/api/admin/categories", headers=admin_headers)
    assert response.status_code == 200


def test_admin_route_without_token_returns_401(client):
    response = client.get("/api/admin/categories")
    assert response.status_code == 401
