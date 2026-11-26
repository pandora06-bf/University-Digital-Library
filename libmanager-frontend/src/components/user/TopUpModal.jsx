import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, Check, TimerReset, Zap, AlertTriangle } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { walletService, canSimulateTopUp } from '../../services/walletService';
import { mapBorrowError } from '../../utils/borrowErrors';
import { formatMoney } from '../../utils/libraryDate';
import {
  TOPUP_MIN, TOPUP_MAX, TOPUP_PRESETS, TOPUP_POLL_MS, TOPUP_EXPIRE_MINUTES,
  parseAmount, validateTopUpAmount, secondsLeft, formatCountdown,
} from '../../utils/wallet';

/**
 * TopUpModal (4-13): nạp tiền vào tài khoản dịch vụ bằng chuyển khoản VietQR.
 * 1. Nhập số tiền 10.000–500.000đ → POST /api/wallet/topups trả mã QR + nội dung chuyển khoản (pay_code).
 * 2. Đếm ngược 15 phút; cứ 3 giây hỏi GET /api/wallet/topups/{pay_code}.
 * 3. Ngân hàng báo có qua webhook → trạng thái PAID → báo thành công và gọi onPaid để cập nhật số dư.
 * Nút "Giả lập chuyển khoản" mặc định ẩn; chỉ hiện khi VITE_ENABLE_TOPUP_SIMULATE=true (canSimulateTopUp).
 */

// Đọc đồng hồ ngoài thân component (quy tắc react-hooks/purity của nhóm).
const clockNow = () => Date.now();

function CopyField({ label, value, mono = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* trình duyệt chặn clipboard: người dùng vẫn đọc được giá trị */ }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className={`font-semibold text-slate-900 break-all ${mono ? 'font-mono tracking-wide' : ''}`}>{value}</div>
      </div>
      <button type="button" onClick={copy} aria-label={`Sao chép ${label.toLowerCase()}`}
        className="shrink-0 w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-300">
        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function TopUpModal({ isOpen = true, onClose, onPaid, initialAmount = 50_000 }) {
  const [text, setText] = useState(String(initialAmount));
  const [topUp, setTopUp] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(clockNow);
  const [pollIssue, setPollIssue] = useState(false);
  const paidReported = useRef(false);
  // Trang cha chỉ gắn modal khi mở ({open && <TopUpModal …/>}), nên mỗi lần mở là một phiên mới.

  const amount = parseAmount(text);
  const validation = validateTopUpAmount(amount);
  // Báo ngay khi đã gõ số tiền sai (ô trống thì chỉ hiện gợi ý); lỗi từ máy chủ ưu tiên hơn.
  const shownError = error ?? (text.trim() ? validation : null);
  const remaining = topUp ? secondsLeft(topUp.expiresAt, now) : 0;
  const status = topUp?.status === 'PENDING' && remaining === 0 ? 'EXPIRED' : topUp?.status;
  const waiting = status === 'PENDING';

  const markPaid = useCallback((next) => {
    setTopUp(next);
    if (!paidReported.current) {
      paidReported.current = true;
      onPaid?.(next);
    }
  }, [onPaid]);

  // Đồng hồ đếm ngược (mỗi giây) và hỏi trạng thái (mỗi 3 giây) chỉ chạy khi đang chờ chuyển khoản.
  useEffect(() => {
    if (!waiting) return undefined;
    const tick = window.setInterval(() => setNow(clockNow()), 1000);
    return () => window.clearInterval(tick);
  }, [waiting]);

  const payCode = topUp?.payCode;
  useEffect(() => {
    if (!waiting || !payCode) return undefined;
    let stopped = false;
    const poll = async () => {
      try {
        const next = await walletService.getTopUp(payCode);
        if (stopped) return;
        setPollIssue(false);
        if (next.status === 'PAID') markPaid(next);
        else if (next.status !== 'PENDING') setTopUp(next);
      } catch {
        if (!stopped) setPollIssue(true); // mất mạng tạm thời: giữ mã QR, thử lại ở lượt sau
      }
    };
    const timer = window.setInterval(poll, TOPUP_POLL_MS);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [waiting, payCode, markPaid]);

  const create = async (event) => {
    event?.preventDefault();
    if (validation) { setError(validation); return; }
    setBusy(true); setError(null);
    try {
      const created = await walletService.createTopUp(amount);
      setNow(clockNow());
      setTopUp(created);
    } catch (failure) {
      setError(mapBorrowError(failure).message);
    } finally {
      setBusy(false);
    }
  };

  const simulate = async () => {
    setBusy(true); setError(null);
    try {
      await walletService.simulateTopUp(payCode);
      const next = await walletService.getTopUp(payCode);
      if (next.status === 'PAID') markPaid(next); else setTopUp(next);
    } catch (failure) {
      setError(failure?.response?.status === 404
        ? 'Máy chủ chưa bật chế độ giả lập (ENABLE_DEV_SIMULATE). Hãy chuyển khoản thật hoặc bật cờ này khi chạy thử.'
        : mapBorrowError(failure).message);
    } finally {
      setBusy(false);
    }
  };

  const restart = () => { setTopUp(null); setError(null); setPollIssue(false); paidReported.current = false; };

  const title = status === 'PAID' ? 'Nạp tiền thành công' : topUp ? 'Quét mã để chuyển khoản' : 'Nạp tiền tài khoản dịch vụ';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-lg">
      {!topUp && (
        <form onSubmit={create} className="space-y-5" noValidate>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-700 mb-2">Chọn nhanh</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TOPUP_PRESETS.map((value) => (
                <button key={value} type="button" aria-pressed={amount === value} onClick={() => { setText(String(value)); setError(null); }}
                  className={`min-h-11 rounded-xl border text-sm font-semibold ${amount === value ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                  {formatMoney(value)}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="topup-amount" className="text-sm font-semibold text-slate-700">Hoặc nhập số tiền (VNĐ)</label>
            <input id="topup-amount" inputMode="numeric" autoComplete="off" value={amount ? amount.toLocaleString('vi-VN') : text}
              onChange={(event) => { setText(event.target.value); setError(null); }}
              aria-invalid={Boolean(shownError)} aria-describedby="topup-hint"
              className="mt-1.5 w-full h-12 rounded-xl border border-slate-300 px-4 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <p id="topup-hint" aria-live="polite" className={`mt-1.5 text-xs ${shownError ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
              {shownError ?? `Từ ${formatMoney(TOPUP_MIN)} đến ${formatMoney(TOPUP_MAX)}. Mã QR có hiệu lực ${TOPUP_EXPIRE_MINUTES} phút.`}
            </p>
          </div>
          <Button type="submit" fullWidth size="lg" loading={busy} disabled={Boolean(validation)}>
            Tạo mã QR {amount && !validation ? `· ${formatMoney(amount)}` : ''}
          </Button>
        </form>
      )}

      {topUp && status === 'PAID' && (
        <div className="text-center space-y-4 py-2" role="status">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
          <p className="text-lg font-semibold text-slate-900">Đã nhận {formatMoney(topUp.amount)}</p>
          <p className="text-sm text-slate-500">Số dư tài khoản dịch vụ đã được cập nhật. Bạn có thể dùng để đặt phòng hoặc trả phí phạt.</p>
          <Button fullWidth onClick={onClose}>Xong</Button>
        </div>
      )}

      {topUp && status === 'EXPIRED' && (
        <div className="text-center space-y-4 py-2" role="alert">
          <TimerReset className="w-12 h-12 text-amber-500 mx-auto" />
          <p className="font-semibold text-slate-900">Mã QR đã hết hạn</p>
          <p className="text-sm text-slate-500">Nếu bạn đã chuyển khoản nhưng chưa được cộng tiền, hãy liên hệ thủ thư kèm mã <strong className="font-mono">{topUp.payCode}</strong>.</p>
          <Button fullWidth onClick={restart}>Tạo mã mới</Button>
        </div>
      )}

      {topUp && waiting && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-2.5">
            <span className="text-sm text-indigo-900">Mã hết hạn sau</span>
            <strong className={`font-mono text-lg tabular-nums ${remaining <= 60 ? 'text-rose-600' : 'text-indigo-700'}`} aria-live="off">
              {formatCountdown(remaining)}
            </strong>
          </div>
          {topUp.qrUrl && (
            <img src={topUp.qrUrl} alt={`Mã VietQR chuyển ${formatMoney(topUp.amount)}, nội dung ${topUp.content}`}
              className="w-56 h-56 sm:w-64 sm:h-64 mx-auto rounded-2xl border border-slate-200 bg-white object-contain" />
          )}
          <div className="rounded-2xl border border-slate-200 px-4">
            <CopyField label="Số tiền" value={formatMoney(topUp.amount)} />
            <CopyField label="Nội dung chuyển khoản" value={topUp.content} mono />
            {topUp.accountNo && <CopyField label="Số tài khoản" value={topUp.accountNo} mono />}
            {topUp.accountName && <CopyField label="Chủ tài khoản" value={topUp.accountName} />}
          </div>
          <p className="text-xs text-slate-500">
            Ghi <strong>đúng nội dung</strong> để hệ thống tự cộng tiền. Trang tự kiểm tra mỗi 3 giây, không cần tải lại.
          </p>
          <p className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            {pollIssue ? 'Mất kết nối tạm thời, đang thử lại…' : 'Đang chờ ngân hàng xác nhận…'}
          </p>
          {error && <p role="alert" className="flex items-start gap-2 text-sm text-rose-600"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{error}</p>}
          {canSimulateTopUp && (
            <Button variant="outline" fullWidth loading={busy} onClick={simulate} icon={<Zap className="w-4 h-4" />}>
              Giả lập chuyển khoản (chỉ môi trường chạy thử)
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
