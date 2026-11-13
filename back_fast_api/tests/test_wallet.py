from datetime import timedelta

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.models.wallet import TopUp, UnmatchedTx, WalletTxn
from app.services import wallet_service as ws

KEY = settings.BANK_WEBHOOK_KEY
USER = "SV2026001"


def _hook(client, payload, key=KEY):
    return client.post("/api/webhooks/bank", json=payload, headers={"Authorization": f"Apikey {key}"})


def _create(client, auth_headers, amount=50_000):
    r = client.post("/api/wallet/topups", json={"amount": amount}, headers=auth_headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_credit_debit_records_balance_after(db_session, test_account):
    t1 = ws.credit(db_session, USER, 30_000, "TOPUP")
    t2 = ws.debit(db_session, USER, 10_000, "FINE_PAYMENT")
    assert (t1.balance_before, t1.balance_after) == (0, 30_000)
    assert (t2.balance_before, t2.balance_after, t2.amount) == (30_000, 20_000, -10_000)
    assert ws.get_balance(db_session, USER) == 20_000


def test_debit_cannot_go_negative(db_session, test_account):
    with pytest.raises(HTTPException) as e:
        ws.debit(db_session, USER, 1, "FINE_PAYMENT")
    assert e.value.status_code == 409
    assert ws.get_balance(db_session, USER) == 0


@pytest.mark.parametrize("amount", [9_999, 500_001])
def test_topup_amount_range(client, auth_headers, amount):
    r = client.post("/api/wallet/topups", json={"amount": amount}, headers=auth_headers)
    assert r.status_code == 422


def test_create_topup_returns_qr(client, auth_headers):
    data = _create(client, auth_headers)
    assert data["status"] == "PENDING" and data["pay_code"].startswith("TV")
    assert data["pay_code"] in data["qr_url"] and "amount=50000" in data["qr_url"]
    assert settings.BANK_ACCOUNT_NO in data["qr_url"]
    r = client.get(f"/api/wallet/topups/{data['pay_code']}", headers=auth_headers)
    assert r.status_code == 200 and r.json()["status"] == "PENDING"


def test_webhook_rejects_bad_key(client, auth_headers):
    r = _hook(client, {"id": "1", "transferAmount": 10_000, "content": "x"}, key="wrong")
    assert r.status_code == 401
    r = client.post("/api/webhooks/bank", json={"id": "1", "transferAmount": 10_000, "content": "x"})
    assert r.status_code == 401


def test_webhook_credits_actual_amount_and_is_idempotent(client, auth_headers, db_session):
    code = _create(client, auth_headers, 50_000)["pay_code"]
    payload = {"id": "BANK-1", "transferAmount": 45_000, "content": f"MBVCB.123 {code.lower()} FT"}
    r = _hook(client, payload)
    assert r.json()["result"] == "MATCHED"
    r2 = _hook(client, payload)
    assert r2.status_code == 200 and r2.json()["result"] == "DUPLICATE"

    w = client.get("/api/wallet", headers=auth_headers).json()
    assert w["balance"] == 45_000
    txns = client.get("/api/wallet/transactions", headers=auth_headers).json()
    assert txns["total"] == 1 and txns["data"][0]["balance_after"] == 45_000
    assert client.get(f"/api/wallet/topups/{code}", headers=auth_headers).json()["status"] == "PAID"


def test_webhook_unmatched_saved(client, db_session):
    r = _hook(client, {"id": "BANK-X", "transferAmount": 20_000, "content": "chuyen tien khong ma"})
    assert r.json()["result"] == "UNMATCHED"
    assert db_session.query(UnmatchedTx).filter_by(bank_tx_id="BANK-X").count() == 1
    assert _hook(client, {"id": "BANK-X", "transferAmount": 20_000, "content": "x"}).json()["result"] == "DUPLICATE"


def test_second_payment_for_paid_code_is_unmatched(client, auth_headers, db_session):
    code = _create(client, auth_headers)["pay_code"]
    _hook(client, {"id": "B1", "transferAmount": 50_000, "content": code})
    r = _hook(client, {"id": "B2", "transferAmount": 50_000, "content": code})
    assert r.json()["result"] == "UNMATCHED"
    assert client.get("/api/wallet", headers=auth_headers).json()["balance"] == 50_000


def test_simulate_dev_only(client, auth_headers, monkeypatch):
    code = _create(client, auth_headers, 100_000)["pay_code"]
    monkeypatch.setattr(settings, "APP_ENV", "production")
    assert client.post(f"/api/dev/topups/{code}/simulate", headers=auth_headers).status_code == 404
    monkeypatch.setattr(settings, "APP_ENV", "dev")
    r = client.post(f"/api/dev/topups/{code}/simulate", headers=auth_headers)
    assert r.json()["result"] == "MATCHED"
    assert client.post(f"/api/dev/topups/{code}/simulate", headers=auth_headers).json()["result"] == "DUPLICATE"
    assert client.get("/api/wallet", headers=auth_headers).json()["balance"] == 100_000


def test_job07_expires_pending(db_session, test_account):
    topup = ws.create_topup(db_session, USER, 20_000)
    assert ws.expire_topups(db_session, topup.created_at + timedelta(minutes=14)) == 0
    assert ws.expire_topups(db_session, topup.created_at + timedelta(minutes=16)) == 1
    db_session.refresh(topup)
    assert topup.status == "EXPIRED"


def test_webhook_different_amount_credited_accurately(client, auth_headers, db_session):
    """Khi nạp tiền khác số tiền đã đăng ký (ví dụ tạo 50,000đ nhưng chuyển 70,000đ),
    hệ thống ghi nhận nạp thành công và cộng đúng số tiền thực chuyển vào ví."""
    topup_data = _create(client, auth_headers, 50_000)
    code = topup_data["pay_code"]

    payload = {
        "id": "BANK-DIFF-001",
        "transferAmount": 70_000,
        "content": f"Chuyen khoan {code} thanh toan",
    }
    r = _hook(client, payload)
    assert r.status_code == 200
    assert r.json()["result"] == "MATCHED"

    wallet = client.get("/api/wallet", headers=auth_headers).json()
    assert wallet["balance"] == 70_000

    topup_detail = client.get(f"/api/wallet/topups/{code}", headers=auth_headers).json()
    assert topup_detail["status"] == "PAID"
    assert topup_detail["amount"] == 70_000


def test_webhook_duplicate_bank_tx_id_preserves_single_credit(client, auth_headers, db_session):
    """Gửi lặp cùng một bank_tx_id nhiều lần phải trả về DUPLICATE và chỉ cộng tiền đúng một lần."""
    code = _create(client, auth_headers, 20_000)["pay_code"]
    payload = {
        "id": "BANK-DUP-UNIQUE-999",
        "transferAmount": 20_000,
        "content": f"Thanh toan ma {code}",
    }

    # Lần 1: Thành công
    r1 = _hook(client, payload)
    assert r1.status_code == 200
    assert r1.json()["result"] == "MATCHED"

    # Lần 2 và 3: Trả về DUPLICATE
    r2 = _hook(client, payload)
    assert r2.status_code == 200
    assert r2.json()["result"] == "DUPLICATE"

    r3 = _hook(client, payload)
    assert r3.status_code == 200
    assert r3.json()["result"] == "DUPLICATE"

    # Số dư ví chỉ cộng đúng 20,000đ, không nhân đôi hay nhân ba
    wallet = client.get("/api/wallet", headers=auth_headers).json()
    assert wallet["balance"] == 20_000
