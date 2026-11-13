"""Sprint 4 (Task 3-11): Kiểm thử điểm khó - Tính bất biến (Idempotent Tests).
Bao gồm:
  - Tính phạt tự động (JOB-01 / UC11) chạy 2 lần không bị nhân đôi tiền phạt
  - Webhook ngân hàng (UC16) gửi lặp lại nhiều lần không bị cộng trùng tiền
  - Giao dịch không khớp (UnmatchedTx) nhận diện DUPLICATE khi gửi lặp
"""
from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
import pytest

from app.core.config import settings
from app.models.book import Book
from app.models.fine import Fine
from app.models.loan import Loan
from app.models.user import User
from app.models.wallet import TopUp, UnmatchedTx
from app.scheduler_worker import run_fine_job
from app.services import wallet_service as ws

KEY = settings.BANK_WEBHOOK_KEY
USER = "SV2026001"
VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def _send_webhook(client, payload, key=KEY):
    return client.post(
        "/api/webhooks/bank",
        json=payload,
        headers={"Authorization": f"Apikey {key}"},
    )


def test_fine_calculation_job01_is_idempotent_uc11(db_session, test_account):
    """UC11 / JOB-01: Tiến trình tính phạt quá hạn chạy 2 lần liên tiếp.
    Yêu cầu: Không tạo bản ghi Fine mới trùng lặp, không nhân đôi tiền phạt của bạn đọc,
    tổng tiền phạt duy trì đúng giá trị vi phạm thực tế (idempotent differential adjustment).
    """
    user = db_session.query(User).filter_by(account_id=test_account.id).first()
    user.total_fines = Decimal("0")
    db_session.commit()

    book = Book(
        title="Giáo trình Kiến trúc máy tính",
        author="TS. Tran Van B",
        publisher="TDTU",
        publication_year=2024,
        price=90_000,
        book_type="PRINTED",
        available_stock=5,
    )
    db_session.add(book)
    db_session.commit()

    now = datetime(2026, 12, 10, 10, 0, 0, tzinfo=VN_TZ)
    # Phiếu mượn quá hạn 4 ngày (hạn trả là ngày 6)
    due_date = now - timedelta(days=4)

    loan = Loan(
        user_code=user.user_code,
        book_id=book.id,
        loan_type="PHYSICAL",
        loan_status="OVERDUE",
        loan_code="PM-OVERDUE-001",
        borrow_date=due_date - timedelta(days=14),
        due_date=due_date.astimezone(__import__("datetime").timezone.utc).replace(tzinfo=None),
    )
    db_session.add(loan)
    db_session.commit()
    db_session.refresh(loan)

    class NonClosingSession:
        def __init__(self, s):
            self._s = s

        def __getattr__(self, name):
            return getattr(self._s, name)

        def close(self):
            # Không đóng db_session fixture dùng chung trong test
            pass

    # CHẠY LẦN 1
    run_fine_job(session_factory=lambda: NonClosingSession(db_session), now=now)

    user_after_1 = db_session.query(User).filter_by(account_id=test_account.id).first()
    fine_first = db_session.query(Fine).filter_by(loan_id=loan.id).all()
    assert len(fine_first) == 1, "Kỳ vọng chỉ có đúng 1 bản ghi Fine được tạo"
    expected_fine = Decimal("5000") * 4  # 4 ngày quá hạn = 20,000đ
    assert fine_first[0].total_amount == expected_fine
    assert fine_first[0].overdue_days == 4
    assert user_after_1.total_fines == expected_fine

    # CHẠY LẦN 2 (ngay sau đó, cùng mốc thời gian)
    run_fine_job(session_factory=lambda: NonClosingSession(db_session), now=now)

    user_after_2 = db_session.query(User).filter_by(account_id=test_account.id).first()
    fine_second = db_session.query(Fine).filter_by(loan_id=loan.id).all()
    assert len(fine_second) == 1, "Lần chạy thứ 2 tuyệt đối không được sinh thêm dòng Fine trùng lặp"
    assert fine_second[0].total_amount == expected_fine, "Tiền phạt không được tăng thêm"
    assert user_after_2.total_fines == expected_fine, "Tổng tiền phạt của bạn đọc không bị nhân đôi"


def test_webhook_duplicate_transmission_is_idempotent_uc16(client, auth_headers, db_session):
    """UC16: Webhook nạp tiền gửi lặp lại nhiều lần (do mạng thử lại hoặc đối tác gửi trùng).
    Hệ thống phải đảm bảo:
      - Lần 1: Trả về MATCHED, cập nhật trạng thái PAID, cộng đúng số tiền vào ví.
      - Lần 2, 3: Trả về DUPLICATE với HTTP 200, số dư ví không bị cộng thêm lần nào nữa.
    """
    # 1. Bạn đọc tạo lệnh nạp 50,000đ
    res = client.post("/api/wallet/topups", json={"amount": 50_000}, headers=auth_headers)
    assert res.status_code == 201
    pay_code = res.json()["pay_code"]

    payload = {
        "id": "BANK_RETRY_ID_8888",
        "transferAmount": 50_000,
        "content": f"Chuyen tien hoc phi {pay_code}",
    }

    # LẦN GỬI 1: Thành công
    r1 = _send_webhook(client, payload)
    assert r1.status_code == 200
    assert r1.json()["result"] == "MATCHED"

    wallet_after_1 = client.get("/api/wallet", headers=auth_headers).json()["balance"]
    assert wallet_after_1 == 50_000

    # LẦN GỬI 2 (Lặp lại do retry)
    r2 = _send_webhook(client, payload)
    assert r2.status_code == 200
    assert r2.json()["result"] == "DUPLICATE"

    # LẦN GỬI 3 (Lặp lại lần nữa)
    r3 = _send_webhook(client, payload)
    assert r3.status_code == 200
    assert r3.json()["result"] == "DUPLICATE"

    # Kiểm tra số dư ví cuối cùng: vẫn là 50,000đ, không bị nhân đôi hay nhân ba
    wallet_final = client.get("/api/wallet", headers=auth_headers).json()["balance"]
    assert wallet_final == 50_000

    # Kiểm tra số lượng giao dịch trong ví: đúng 1 giao dịch
    txns = client.get("/api/wallet/transactions", headers=auth_headers).json()
    assert txns["total"] == 1
    assert txns["data"][0]["amount"] == 50_000


def test_unmatched_webhook_retry_is_idempotent(client, db_session):
    """Webhook nạp tiền không nhận diện được mã thanh toán (UnmatchedTx) khi gửi lặp
    phải trả về DUPLICATE và không tạo nhiều bản ghi mồ côi trong bảng unmatched_tx.
    """
    bank_tx_id = "BANK_UNKNOWN_TX_9999"
    payload = {
        "id": bank_tx_id,
        "transferAmount": 100_000,
        "content": "Chuyen tien khong ghi ro noi dung gi ca",
    }

    # Lần 1: Lưu vào bảng unmatched_tx
    r1 = _send_webhook(client, payload)
    assert r1.status_code == 200
    assert r1.json()["result"] == "UNMATCHED"

    unmatched_count_1 = db_session.query(UnmatchedTx).filter_by(bank_tx_id=bank_tx_id).count()
    assert unmatched_count_1 == 1

    # Lần 2: Gửi lặp lại cùng bank_tx_id
    r2 = _send_webhook(client, payload)
    assert r2.status_code == 200
    assert r2.json()["result"] == "DUPLICATE"

    # Số lượng bản ghi vẫn là 1, không tạo thêm bản ghi rác
    unmatched_count_2 = db_session.query(UnmatchedTx).filter_by(bank_tx_id=bank_tx_id).count()
    assert unmatched_count_2 == 1
