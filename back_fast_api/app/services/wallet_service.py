"""Tài khoản dịch vụ (3-09.a): cộng/trừ số dư, nạp tiền QR VietQR, xử lý webhook ngân hàng, JOB-07."""
import logging
import re
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.parse import quote

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User
from app.models.wallet import TopUp, UnmatchedTx, WalletTxn

log = logging.getLogger(__name__)

PENDING, PAID, EXPIRED = "PENDING", "PAID", "EXPIRED"
TXN_TOPUP = "TOPUP"
PAY_CODE_PREFIX = "TV"
PAY_CODE_RE = re.compile(rf"{PAY_CODE_PREFIX}[A-Z0-9]{{8}}")
_ALPHABET = string.ascii_uppercase + string.digits


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------------------------------------------------------------- số dư
def _lock_user(db: Session, user_code: str) -> User:
    user = db.scalar(select(User).where(User.user_code == user_code).with_for_update())
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy người dùng")
    return user


def change_balance(db: Session, user_code: str, delta: int, txn_type: str,
                   reference_id: Optional[str] = None, description: Optional[str] = None) -> WalletTxn:
    """Cộng (delta>0) hoặc trừ (delta<0) số dư. Khóa dòng người dùng (SELECT ... FOR UPDATE),
    ghi WalletTxn kèm balance_before/after. Không commit: caller quyết định transaction."""
    if delta == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Số tiền phải khác 0")
    user = _lock_user(db, user_code)
    before = int(user.service_balance or 0)
    after = before + delta
    if after < 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "Số dư tài khoản dịch vụ không đủ")
    user.service_balance = after
    txn = WalletTxn(user_code=user_code, txn_type=txn_type, amount=delta,
                    balance_before=before, balance_after=after,
                    reference_id=reference_id, description=description)
    db.add(txn)
    db.flush()
    return txn


def credit(db: Session, user_code: str, amount: int, txn_type: str, **kw) -> WalletTxn:
    if amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Số tiền cộng phải dương")
    return change_balance(db, user_code, amount, txn_type, **kw)


def debit(db: Session, user_code: str, amount: int, txn_type: str, **kw) -> WalletTxn:
    if amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Số tiền trừ phải dương")
    return change_balance(db, user_code, -amount, txn_type, **kw)


def get_balance(db: Session, user_code: str) -> int:
    return int(db.scalar(select(User.service_balance).where(User.user_code == user_code)) or 0)


def list_transactions(db: Session, user_code: str, page: int = 1, size: int = 20) -> Dict[str, Any]:
    base = select(WalletTxn).where(WalletTxn.user_code == user_code)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    items = db.scalars(base.order_by(WalletTxn.created_at.desc(), WalletTxn.id.desc())
                       .offset((page - 1) * size).limit(size)).all()
    return {"data": [serialize_txn(t) for t in items], "total": total, "page": page, "size": size}


def serialize_txn(t: WalletTxn) -> Dict[str, Any]:
    return {"id": t.id, "txn_type": t.txn_type, "amount": t.amount,
            "balance_before": t.balance_before, "balance_after": t.balance_after,
            "reference_id": t.reference_id, "description": t.description, "created_at": t.created_at}


# ---------------------------------------------------------------- nạp tiền
def build_qr_url(amount: int, pay_code: str) -> str:
    return (f"https://img.vietqr.io/image/{settings.BANK_BIN}-{settings.BANK_ACCOUNT_NO}-"
            f"{settings.VIETQR_TEMPLATE}.png?amount={amount}&addInfo={quote(pay_code)}"
            f"&accountName={quote(settings.BANK_ACCOUNT_NAME)}")


def _new_pay_code(db: Session) -> str:
    for _ in range(10):
        code = PAY_CODE_PREFIX + "".join(secrets.choice(_ALPHABET) for _ in range(8))
        if not db.scalar(select(TopUp.id).where(TopUp.pay_code == code)):
            return code
    raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Không sinh được mã thanh toán")


def serialize_topup(t: TopUp) -> Dict[str, Any]:
    return {"pay_code": t.pay_code, "amount": t.amount, "status": t.status,
            "expired_at": t.expired_at, "created_at": t.created_at,
            "qr_url": build_qr_url(t.amount, t.pay_code),
            "bank": {"bin": settings.BANK_BIN, "account_no": settings.BANK_ACCOUNT_NO,
                     "account_name": settings.BANK_ACCOUNT_NAME, "content": t.pay_code}}


def create_topup(db: Session, user_code: str, amount: int) -> TopUp:
    if not settings.TOPUP_MIN_AMOUNT <= amount <= settings.TOPUP_MAX_AMOUNT:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"Số tiền nạp phải từ {settings.TOPUP_MIN_AMOUNT:,} "
                            f"đến {settings.TOPUP_MAX_AMOUNT:,} VNĐ")
    now = utcnow()
    topup = TopUp(user_code=user_code, amount=amount, pay_code=_new_pay_code(db), status=PENDING,
                  created_at=now, expired_at=now + timedelta(minutes=settings.TOPUP_EXPIRE_MINUTES))
    db.add(topup)
    db.flush()
    return topup


def get_topup(db: Session, user_code: str, pay_code: str) -> TopUp:
    topup = db.scalar(select(TopUp).where(TopUp.pay_code == pay_code.upper(),
                                          TopUp.user_code == user_code))
    if not topup:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy yêu cầu nạp tiền")
    return topup


# ---------------------------------------------------------------- webhook
def verify_webhook_key(provided: Optional[str]) -> None:
    """So sánh thời gian hằng số để tránh timing attack."""
    if not provided or not secrets.compare_digest(provided.encode(), settings.BANK_WEBHOOK_KEY.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Khóa webhook không hợp lệ")


def extract_webhook_key(authorization: Optional[str], x_api_key: Optional[str]) -> Optional[str]:
    """Hỗ trợ `x-api-key: <KEY>` và `Authorization: Apikey <KEY>` (mặc định SePay)."""
    if x_api_key and x_api_key.strip():
        return x_api_key.strip()
    if authorization:
        parts = authorization.strip().split(None, 1)
        if len(parts) == 2 and parts[0].lower() in ("apikey", "bearer"):
            return parts[1].strip()
    return None


def is_own_account(account_number: Optional[str], sub_account: Optional[str]) -> bool:
    """Giao dịch thuộc VA cấu hình nếu subAccount hoặc accountNumber khớp BANK_ACCOUNT_NO."""
    expected = (settings.BANK_ACCOUNT_NO or "").strip().upper()
    return bool(expected) and expected in {(v or "").strip().upper() for v in (sub_account, account_number)}


def extract_pay_code(*texts: Optional[str]) -> Optional[str]:
    """Lấy pay_code từ nguồn đầu tiên khớp (thứ tự ưu tiên: code, content, description)."""
    for text in texts:
        match = PAY_CODE_RE.search((text or "").upper())
        if match:
            return match.group(0)
    return None


def _already_processed(db: Session, bank_tx_id: str) -> bool:
    return bool(db.scalar(select(TopUp.id).where(TopUp.bank_tx_id == bank_tx_id)) or
                db.scalar(select(UnmatchedTx.id).where(UnmatchedTx.bank_tx_id == bank_tx_id)))


def process_bank_event(db: Session, bank_tx_id: str, amount: int, content: str,
                       account_number: Optional[str] = None,
                       received_at: Optional[datetime] = None,
                       code: Optional[str] = None,
                       description: Optional[str] = None) -> Dict[str, Any]:
    """Xử lý một giao dịch chuyển khoản đến. Idempotent theo bank_tx_id. Không commit.
    Số tiền chênh lệch / QR đã hết hạn (E2, E3): vẫn cộng đúng số tiền thực nhận."""
    bank_tx_id = str(bank_tx_id)
    if _already_processed(db, bank_tx_id):
        return {"result": "DUPLICATE", "bank_tx_id": bank_tx_id}

    pay_code = extract_pay_code(code, content, description)
    topup = None
    if pay_code and amount > 0:
        topup = db.scalar(select(TopUp).where(TopUp.pay_code == pay_code).with_for_update())
    # Chỉ ghi nhận cho yêu cầu chưa được thanh toán (kể cả đã EXPIRED: tiền đã thực nhận).
    if topup and topup.status in (PENDING, EXPIRED) and topup.bank_tx_id is None:
        # Cập nhật có điều kiện để chống hai webhook song song cùng pay_code.
        updated = db.execute(update(TopUp).where(TopUp.id == topup.id, TopUp.bank_tx_id.is_(None))
                             .values(status=PAID, bank_tx_id=bank_tx_id, amount=amount)
                             .execution_options(synchronize_session="fetch")).rowcount
        if updated == 1:
            txn = credit(db, topup.user_code, amount, TXN_TOPUP, reference_id=pay_code,
                         description=f"Nạp tiền qua chuyển khoản ({bank_tx_id})")
            return {"result": "MATCHED", "pay_code": pay_code, "user_code": topup.user_code,
                    "amount": amount, "balance_after": txn.balance_after}

    if amount <= 0:
        return {"result": "IGNORED", "bank_tx_id": bank_tx_id}
    db.add(UnmatchedTx(bank_tx_id=bank_tx_id, amount=amount, bank_account_number=account_number,
                       transfer_content=content or "", received_at=received_at or utcnow()))
    db.flush()
    return {"result": "UNMATCHED", "bank_tx_id": bank_tx_id}


def handle_bank_event_committed(db: Session, **kwargs) -> Dict[str, Any]:
    """Chạy process_bank_event và commit; trùng UNIQUE do gửi lặp song song → DUPLICATE."""
    try:
        result = process_bank_event(db, **kwargs)
        db.commit()
        return result
    except IntegrityError:
        db.rollback()
        return {"result": "DUPLICATE", "bank_tx_id": str(kwargs.get("bank_tx_id"))}
    except Exception:
        db.rollback()
        raise


# ---------------------------------------------------------------- admin: giao dịch chưa khớp (E4)
UNRESOLVED, ASSIGNED = "UNRESOLVED", "ASSIGNED"


def serialize_unmatched(u: UnmatchedTx) -> Dict[str, Any]:
    return {"id": u.id, "bank_tx_id": u.bank_tx_id, "amount": u.amount,
            "bank_account_number": u.bank_account_number, "transfer_content": u.transfer_content,
            "received_at": u.received_at, "status": u.status,
            "assigned_user_code": u.assigned_user_code, "resolved_by": u.resolved_by,
            "resolution_notes": u.resolution_notes, "created_at": u.created_at}


def list_unmatched(db: Session, page: int = 1, size: int = 20, status_filter: str = "unresolved") -> Dict[str, Any]:
    """Mặc định chỉ giao dịch chưa gán. status_filter: unresolved | assigned | all.
    Đã khớp = đã có mã bạn đọc (ví đã được cộng), không dựa vào cột status."""
    base = select(UnmatchedTx)
    if status_filter == "assigned":
        base = base.where(UnmatchedTx.assigned_user_code.is_not(None))
    elif status_filter != "all":
        base = base.where(UnmatchedTx.assigned_user_code.is_(None))
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    items = db.scalars(base.order_by(UnmatchedTx.received_at.desc(), UnmatchedTx.id.desc())
                       .offset((page - 1) * size).limit(size)).all()
    return {"data": [serialize_unmatched(u) for u in items], "total": total, "page": page, "size": size}


def assign_unmatched(db: Session, unmatched_id: int, user_code: str, admin_code: Optional[str] = None,
                     notes: Optional[str] = None) -> Dict[str, Any]:
    """Gán giao dịch chưa khớp cho người dùng và cộng số dư trong một transaction.
    Kiểm tra mọi điều kiện (404/409) TRƯỚC khi ghi để lỗi nghiệp vụ không cần rollback."""
    tx = db.scalar(select(UnmatchedTx).where(UnmatchedTx.id == unmatched_id).with_for_update())
    if not tx:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy giao dịch chưa khớp")
    if tx.assigned_user_code is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Giao dịch đã được gán")
    _lock_user(db, user_code)  # 404 nếu user không tồn tại; khóa dòng trước khi cộng tiền
    try:
        # Cập nhật có điều kiện: chống hai admin gán song song.
        updated = db.execute(update(UnmatchedTx)
                             .where(UnmatchedTx.id == tx.id, UnmatchedTx.assigned_user_code.is_(None))
                             .values(assigned_user_code=user_code, status=ASSIGNED,
                                     resolved_by=admin_code, resolution_notes=notes)
                             .execution_options(synchronize_session="fetch")).rowcount
        if updated != 1:
            db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "Giao dịch đã được gán")
        txn = credit(db, user_code, tx.amount, TXN_TOPUP, reference_id=tx.bank_tx_id,
                     description=f"Admin gán giao dịch chưa khớp ({tx.bank_tx_id})")
        db.commit()
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise
    db.refresh(tx)
    return {"unmatched": serialize_unmatched(tx), "transaction": serialize_txn(txn)}


# ---------------------------------------------------------------- JOB-07
def expire_topups(db: Session, now: Optional[datetime] = None) -> int:
    now = now or utcnow()
    return db.execute(update(TopUp).where(TopUp.status == PENDING, TopUp.expired_at <= now)
                      .values(status=EXPIRED).execution_options(synchronize_session=False)).rowcount


def run_topup_expiry_job(session_factory=SessionLocal, now: Optional[datetime] = None) -> Dict[str, Any]:
    with session_factory() as db:
        try:
            count = expire_topups(db, now)
            db.commit()
        except Exception:
            db.rollback()
            log.exception("JOB-07 failed")
            raise
    log.info("JOB-07 expired %s top-ups", count)
    return {"expired": count}
