from app.core.security import hash_password, verify_password, create_access_token, decode_access_token


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Library Management Backend API is running"
    assert data["docs"] == "/docs"


def test_health_check_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_password_hashing():
    raw_password = "SecurePassword123!"
    hashed = hash_password(raw_password)
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_flow():
    payload = {"sub": "123", "role": "STUDENT"}
    token = create_access_token(payload)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "123"
    assert decoded["role"] == "STUDENT"


def test_auth_test_endpoint(client):
    response = client.get("/api/auth/test")
    assert response.status_code == 200
    assert response.json() == {"message": "Auth router is working"}


def test_login_success(client, test_account):
    response = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "Password123@"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["username"] == "testuser"


def test_login_invalid_credentials(client, test_account):
    response = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "WrongPassword"},
    )
    assert response.status_code == 401


def test_get_current_user_me(client, auth_headers):
    response = client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
