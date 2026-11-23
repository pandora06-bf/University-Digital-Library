"""2B-06 regression coverage for the real Admin Users API."""
from app.core.security import create_access_token, hash_password
from app.models.user import Account, User


def headers(account):
    token = create_access_token({"sub": str(account.id), "role": account.role})
    return {"Authorization": f"Bearer {token}"}


def make_account(db, username, code, role="ADMIN", fines=0):
    account = Account(username=username, password=hash_password("Password123@"), role=role, is_active=True)
    db.add(account)
    db.flush()
    user = User(account_id=account.id, user_code=code, full_name="Demo Tester", email=f"{code}@example.test",
                department="CNTT", user_type=role, total_fines=fines)
    db.add(user)
    db.commit()
    return account


def test_admin_crud_lifecycle(client, db_session):
    admin = make_account(db_session, "admin_crud", "ADMIN_CRUD", role="ADMIN")
    h = headers(admin)
    data = {"user_code": "SV_CRUD_1", "full_name": "Nguyen Van Demo", "email": "crud1@example.test", "department": "CNTT", "role": "STUDENT"}
    created = client.post("/api/admin/users", json=data, headers=h)
    assert created.status_code == 201, created.text
    assert created.json()["account_id"]
    assert created.json()["temporary_password"]
    second = client.post("/api/admin/users", json=data, headers=h)
    assert second.status_code == 409
    listed = client.get("/api/admin/users", params={"q": "SV_CRUD_1"}, headers=h)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    updated = client.put("/api/admin/users/SV_CRUD_1", json={"full_name": "Nguyen Van Updated"}, headers=h)
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Nguyen Van Updated"
    missing_reason = client.patch("/api/admin/users/SV_CRUD_1/lock", json={"is_locked": True}, headers=h)
    assert missing_reason.status_code == 422
    locked = client.patch(
        "/api/admin/users/SV_CRUD_1/lock",
        json={"is_locked": True, "reason": "Vi phạm quy định mượn sách"},
        headers=h,
    )
    assert locked.status_code == 200
    assert locked.json()["is_locked"] is True
    assert locked.json()["lock_reason"] == "Vi phạm quy định mượn sách"
    unlocked = client.patch("/api/admin/users/SV_CRUD_1/lock", json={"is_locked": False}, headers=h)
    assert unlocked.status_code == 200
    assert unlocked.json()["is_locked"] is False
    assert unlocked.json().get("lock_reason") in (None, "")
    self_lock = client.patch(
        "/api/admin/users/ADMIN_CRUD/lock",
        json={"is_locked": True, "reason": "Không được khóa ADMIN"},
        headers=h,
    )
    assert self_lock.status_code == 409


def test_debt_and_authorization(client, db_session):
    admin = make_account(db_session, "admin_crud2", "ADMIN_CRUD2")
    student = make_account(db_session, "student_crud", "STUDENT_CRUD", role="STUDENT", fines=5000)
    assert client.get("/api/admin/users", headers=headers(student)).status_code == 403
    h = headers(admin)
    assert client.patch(
        "/api/admin/users/STUDENT_CRUD/lock",
        json={"is_locked": True, "reason": "Nợ phạt quá hạn"},
        headers=h,
    ).status_code == 200
    assert client.patch("/api/admin/users/STUDENT_CRUD/lock", json={"is_locked": False}, headers=h).status_code == 409
    assert client.put("/api/admin/users/UNKNOWN", json={"full_name": "Nobody Here"}, headers=h).status_code == 404
