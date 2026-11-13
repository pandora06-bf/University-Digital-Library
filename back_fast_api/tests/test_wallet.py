from datetime import timedelta

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.models.wallet import TopUp, UnmatchedTx, WalletTxn
from app.services import wallet_service as ws

KEY = "test-webhook-key"
VA = "SEP123456789"
USER = "SV2026001"


@pytest.fixture(autouse=True)
def sepay_settings(monkeypatch):
    """Cấu hình SePay cố định cho test, độc lập với file .env thật."""
    monkeypatch.setattr(settings, "BANK_WEBHOOK_KEY", KEY)
    monkeypatch.setattr(settings, "BANK_ACCOUNT_NO", VA)
    monkeypatch.setattr(settings, "BANK_ACCOUNT_NAME", "THU VIEN DAI HOC")
    monkeypatch.setattr(settings, "BANK_BIN", "970422")
    monkeypatch.setattr(settings, "ENABLE_DEV_SIMULATE", True)


def _sepay(tx_id, amount, content, **extra):
    """Payload đúng định dạng SePay gửi thật (id kiểu int, có subAccount, code null...)."""
    payload = {"id": tx_id, "gateway": "MBBank", "transactionDate": "2026-11-13 00:57:00",
               "accountNumber": "0123456789", "subAccount": VA, "code": None,
               "content": content, "transferType": "in", "description": f"BankAPINotify {content}",
               "transferAmount": amount, "referenceCode": f"FT{tx_id}", "accumulated": 150000}
    payload.update(extra)
    return payload


def _hook(client, payload, key=KEY):
    return client.post("/api/webhooks/bank", json=payload, headers={"Authorization": f"Apikey {key}"})


def _create(client, auth_headers, amount=50_000):
    r = client.post("/api/wallet/topups", json={"amount": amount}, headers=auth_headers)
    assert r.status_code == 201, r.text
    return r.json()


def _balance(client, auth_headers):
    return client.get("/api/wallet", headers=auth_headers).json()["balance"]


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
    assert f"970422-{VA}-compact2.png" in data["qr_url"]
    r = client.get(f"/api/wallet/topups/{data['pay_code']}", headers=auth_headers)
    assert r.status_code == 200 and r.json()["status"] == "PENDING"


# ---------------------------------------------------------------- xác thực header
def test_webhook_rejects_bad_or_missing_key(client):
    payload = _sepay(1, 10_000, "x")
    assert _hook(client, payload, key="wrong").status_code == 401
    assert client.post("/api/webhooks/bank", json=payload).status_code == 401
    assert client.post("/api/webhooks/bank", json=payload,
                       headers={"Authorization": KEY}).status_code == 401


def test_webhook_accepts_x_api_key_header(client):
    r = client.post("/api/webhooks/bank", json=_sepay(2, 20_000, "khong ma"), headers={"x-api-key": KEY})
    assert r.status_code == 200 and r.json()["result"] == "UNMATCHED"


# ---------------------------------------------------------------- payload SePay thật
def test_sepay_payload_matches_and_is_idempotent(client, auth_headers):
    code = _create(client, auth_headers, 50_000)["pay_code"]
    payload = _sepay(92704, 50_000, f"Chuyen tien {code}")
    r = _hook(client, payload)
    assert r.status_code == 200 and r.json() == {**r.json(), "success": True, "result": "MATCHED"}
    r2 = _hook(client, payload)
    assert r2.status_code == 200 and r2.json()["result"] == "DUPLICATE"
    assert _balance(client, auth_headers) == 50_000
    txns = client.get("/api/wallet/transactions", headers=auth_headers).json()
    assert txns["total"] == 1 and txns["data"][0]["balance_after"] == 50_000
    assert client.get(f"/api/wallet/topups/{code}", headers=auth_headers).json()["status"] == "PAID"


def test_sepay_code_field_takes_priority(client, auth_headers):
    code = _create(client, auth_headers, 20_000)["pay_code"]
    r = _hook(client, _sepay(1001, 20_000, "noi dung bi ngan hang cat", code=code))
    assert r.json()["result"] == "MATCHED"


def test_pay_code_from_description_fallback(client, auth_headers):
    code = _create(client, auth_headers, 20_000)["pay_code"]
    r = _hook(client, _sepay(1002, 20_000, "", description=f"BankAPINotify {code.lower()}"))
    assert r.json()["result"] == "MATCHED"


@pytest.mark.parametrize("paid", [30_000, 70_000])
def test_amount_mismatch_credits_actual_amount(client, auth_headers, db_session, paid):
    code = _create(client, auth_headers, 50_000)["pay_code"]
    assert _hook(client, _sepay(2000 + paid, paid, code)).json()["result"] == "MATCHED"
    assert _balance(client, auth_headers) == paid
    topup = db_session.query(TopUp).filter_by(pay_code=code).one()
    assert (topup.amount, topup.status) == (paid, "PAID")


def test_expired_topup_still_credited(client, auth_headers, db_session):
    code = _create(client, auth_headers, 50_000)["pay_code"]
    topup = db_session.query(TopUp).filter_by(pay_code=code).one()
    ws.expire_topups(db_session, topup.expired_at + timedelta(seconds=1))
    db_session.refresh(topup)
    assert topup.status == "EXPIRED"
    assert _hook(client, _sepay(3001, 50_000, code)).json()["result"] == "MATCHED"
    db_session.refresh(topup)
    assert topup.status == "PAID" and _balance(client, auth_headers) == 50_000


def test_other_account_ignored_without_saving(client, auth_headers, db_session):
    code = _create(client, auth_headers)["pay_code"]
    r = _hook(client, _sepay(4001, 50_000, code, subAccount="SEPOTHER", accountNumber="999"))
    assert r.status_code == 200 and r.json()["success"] is True and r.json()["result"] == "IGNORED"
    assert db_session.query(UnmatchedTx).filter_by(bank_tx_id="4001").count() == 0
    assert _balance(client, auth_headers) == 0


def test_outgoing_transfer_ignored(client, auth_headers):
    code = _create(client, auth_headers)["pay_code"]
    r = _hook(client, _sepay(4002, 50_000, code, transferType="out"))
    assert r.status_code == 200 and r.json()["result"] == "IGNORED"
    assert _balance(client, auth_headers) == 0


def test_webhook_unmatched_saved(client, db_session):
    r = _hook(client, _sepay("BANK-X", 20_000, "chuyen tien khong ma"))
    assert r.json()["result"] == "UNMATCHED"
    assert db_session.query(UnmatchedTx).filter_by(bank_tx_id="BANK-X").count() == 1
    assert _hook(client, _sepay("BANK-X", 20_000, "x")).json()["result"] == "DUPLICATE"


def test_second_payment_for_paid_code_is_unmatched(client, auth_headers):
    code = _create(client, auth_headers)["pay_code"]
    _hook(client, _sepay(5001, 50_000, code))
    r = _hook(client, _sepay(5002, 50_000, code))
    assert r.json()["result"] == "UNMATCHED"
    assert _balance(client, auth_headers) == 50_000


# ---------------------------------------------------------------- simulate
def test_simulate_gated_by_flag(client, auth_headers, monkeypatch):
    code = _create(client, auth_headers, 100_000)["pay_code"]
    monkeypatch.setattr(settings, "ENABLE_DEV_SIMULATE", False)
    assert client.post(f"/api/dev/topups/{code}/simulate", headers=auth_headers).status_code == 404
    monkeypatch.setattr(settings, "ENABLE_DEV_SIMULATE", True)
    r = client.post(f"/api/dev/topups/{code}/simulate", headers=auth_headers)
    assert r.json()["result"] == "MATCHED"
    assert client.post(f"/api/dev/topups/{code}/simulate", headers=auth_headers).json()["result"] == "DUPLICATE"
    assert _balance(client, auth_headers) == 100_000


# ---------------------------------------------------------------- admin unmatched (E4)
def test_admin_list_and_assign_unmatched(client, auth_headers, admin_headers, db_session):
    _hook(client, _sepay(6001, 30_000, "sv quen ghi ma"))
    uid = db_session.query(UnmatchedTx).filter_by(bank_tx_id="6001").one().id

    lst = client.get("/api/admin/wallet/unmatched", headers=admin_headers)
    assert lst.status_code == 200 and lst.json()["total"] == 1
    assert client.get("/api/admin/wallet/unmatched?size=51", headers=admin_headers).status_code == 422

    r = client.post(f"/api/admin/wallet/unmatched/{uid}/assign", json={"user_code": USER},
                    headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["unmatched"]["assigned_user_code"] == USER
    assert r.json()["transaction"]["txn_type"] == "TOPUP"
    assert _balance(client, auth_headers) == 30_000

    again = client.post(f"/api/admin/wallet/unmatched/{uid}/assign", json={"user_code": USER},
                        headers=admin_headers)
    assert again.status_code == 409 and _balance(client, auth_headers) == 30_000
    assert client.get("/api/admin/wallet/unmatched", headers=admin_headers).json()["total"] == 0


def test_admin_assign_requires_admin_and_valid_user(client, auth_headers, admin_headers, db_session):
    _hook(client, _sepay(6002, 30_000, "khong ma"))
    uid = db_session.query(UnmatchedTx).filter_by(bank_tx_id="6002").one().id
    assert client.get("/api/admin/wallet/unmatched", headers=auth_headers).status_code == 403
    r = client.post(f"/api/admin/wallet/unmatched/{uid}/assign", json={"user_code": "NOPE"},
                    headers=admin_headers)
    assert r.status_code == 404
    assert db_session.query(UnmatchedTx).filter_by(id=uid).one().assigned_user_code is None
    assert client.post("/api/admin/wallet/unmatched/999999/assign", json={"user_code": USER},
                       headers=admin_headers).status_code == 404


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
