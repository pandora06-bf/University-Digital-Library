// Logic thuần của Tài khoản dịch vụ (4-13): không gọi API, không React, để kiểm thử bằng Node.
import { libraryTimestamp } from './ebookAccess';
import { formatMoney } from './libraryDate';

// Trùng TOPUP_MIN_AMOUNT / TOPUP_MAX_AMOUNT / TOPUP_EXPIRE_MINUTES trong back_fast_api/app/core/config.py
export const TOPUP_MIN = 10_000;
export const TOPUP_MAX = 500_000;
export const TOPUP_EXPIRE_MINUTES = 15;
export const TOPUP_POLL_MS = 3_000;
export const TOPUP_PRESETS = [20_000, 50_000, 100_000, 200_000];

// Ô nhập cho phép gõ "50.000" hoặc "50,000": chỉ giữ chữ số.
export function parseAmount(text) {
  const digits = String(text ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

// Trả về câu lỗi tiếng Việt, hoặc null nếu số tiền hợp lệ.
export function validateTopUpAmount(amount) {
  if (amount == null || !Number.isFinite(amount)) return 'Vui lòng nhập số tiền cần nạp.';
  if (!Number.isInteger(amount)) return 'Số tiền phải là số nguyên (VNĐ).';
  if (amount < TOPUP_MIN || amount > TOPUP_MAX) {
    return `Số tiền nạp phải từ ${formatMoney(TOPUP_MIN)} đến ${formatMoney(TOPUP_MAX)}.`;
  }
  return null;
}

// Số giây còn lại tới hạn mã QR (không âm).
export function secondsLeft(expiresAt, now = Date.now()) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}

export function formatCountdown(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// Chuẩn hóa yêu cầu nạp tiền từ POST/GET /api/wallet/topups (giờ UTC không kèm múi giờ).
export function toTopUp(data) {
  return {
    payCode: data.pay_code,
    amount: Number(data.amount),
    status: String(data.status ?? '').toUpperCase(),
    expiresAt: libraryTimestamp(data.expired_at),
    createdAt: libraryTimestamp(data.created_at),
    qrUrl: data.qr_url ?? null,
    bankBin: data.bank?.bin ?? null,
    accountNo: data.bank?.account_no ?? null,
    accountName: data.bank?.account_name ?? null,
    content: data.bank?.content ?? data.pay_code,
  };
}

// Mã giao dịch ví (wallet_txns.txn_type) → nhãn hiển thị.
const TXN_LABELS = {
  TOPUP: 'Nạp tiền',
  BOOKING_PAYMENT: 'Thanh toán đặt phòng',
  REFUND: 'Hoàn tiền đặt phòng',
  FINE_PAYMENT: 'Trả phí phạt',
  ADJUSTMENT: 'Điều chỉnh',
};

export function toTxn(data) {
  const amount = Number(data.amount);
  return {
    id: data.id,
    type: data.txn_type,
    label: TXN_LABELS[data.txn_type] ?? data.txn_type ?? 'Giao dịch',
    amount,
    credit: amount > 0,
    balanceAfter: data.balance_after == null ? null : Number(data.balance_after),
    description: data.description ?? '',
    createdAt: libraryTimestamp(data.created_at),
  };
}

// Kiểm tra trước khi trả phạt bằng ví (4-02): backend trả 402 nhưng bộ xử lý lỗi chung
// làm mất số tiền thiếu, nên giao diện tự tính để hiện đúng con số.
export function finePaymentPlan(balance, totalFines) {
  const due = Math.max(0, Math.round(Number(totalFines) || 0));
  const have = Math.max(0, Math.round(Number(balance) || 0));
  if (due === 0) return { status: 'NO_DEBT', due, balance: have, missing: 0 };
  if (have < due) return { status: 'INSUFFICIENT', due, balance: have, missing: due - have };
  return { status: 'OK', due, balance: have, missing: 0 };
}

// Số tiền gợi ý nạp để đủ trả phạt: làm tròn lên bội 10.000đ, không dưới mức nạp tối thiểu.
export function suggestedTopUp(missing) {
  if (!missing || missing <= 0) return TOPUP_MIN;
  return Math.min(TOPUP_MAX, Math.max(TOPUP_MIN, Math.ceil(missing / 10_000) * 10_000));
}
