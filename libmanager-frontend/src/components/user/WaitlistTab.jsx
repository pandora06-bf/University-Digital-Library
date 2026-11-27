import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Hourglass, PackageCheck, AlertTriangle, X } from 'lucide-react';
import { Button } from '../Button';
import ConfirmDialog from '../ConfirmDialog';
import ToastAlertComponent from '../ToastAlertComponent';
import { waitlistService } from '../../services/waitlistService';
import { positionLabel, holdRemaining } from '../../utils/waitlist';

/**
 * WaitlistTab (3-13): tab "Đặt trước" trong trang Sách của tôi.
 * - Mỗi mục: vị trí x/y trong hàng chờ, trạng thái Đang chờ / Đang giữ chỗ (kèm hạn giữ), nút Hủy.
 * - Đăng ký đặt trước làm ở trang chi tiết sách (nút "Hẹn đặt trước" khi hết bản, 3-12.a).
 * - Dữ liệu: GET /api/waitlists/my-waitlists; hủy: DELETE /api/waitlists/{id}.
 */

const timeFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hourCycle: 'h23',
});

function StatusPill({ entry }) {
  return entry.held ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      <PackageCheck className="w-3.5 h-3.5" /> Đang giữ chỗ
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      <Hourglass className="w-3.5 h-3.5" /> Đang chờ
    </span>
  );
}

function WaitlistCard({ entry, now, onCancel }) {
  const remaining = entry.held ? holdRemaining(entry.holdExpiresAt, now) : null;
  return (
    <li className={`rounded-2xl border bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${entry.held ? 'border-emerald-300 shadow-sm shadow-emerald-100' : 'border-[#D9E2EE]'}`}>
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 ${entry.held ? 'bg-emerald-600 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}
          aria-label={`Vị trí ${positionLabel(entry)} trong hàng chờ`}>
          <span className="text-[10px] font-medium leading-none opacity-80">Vị trí</span>
          <strong className="text-base leading-tight">{positionLabel(entry)}</strong>
        </div>
        <div className="min-w-0 space-y-1">
          <Link to={`/books/${entry.bookId}`} className="block font-semibold text-slate-900 hover:text-indigo-600 line-clamp-2 break-words">
            {entry.bookTitle}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill entry={entry} />
            {entry.author && <span className="text-xs text-slate-500 truncate">{entry.author}</span>}
          </div>
          {entry.held ? (
            <p className="text-sm text-emerald-800">
              Sách đã về và đang giữ cho bạn
              {entry.holdExpiresAt && <> đến <strong>{timeFormat.format(new Date(entry.holdExpiresAt))}</strong></>}
              {remaining && <> (còn {remaining})</>}. Hãy tới quầy để nhận sách.
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              {entry.position === 1
                ? 'Bạn đứng đầu hàng chờ: khi có bản trả về, thư viện giữ sách cho bạn 48 giờ và gửi email báo.'
                : `Còn ${Math.max(0, (entry.position ?? 1) - 1)} người trước bạn. Thư viện sẽ gửi email khi tới lượt.`}
            </p>
          )}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => onCancel(entry)} icon={<X className="w-4 h-4" />}
        className="w-full sm:w-auto min-h-10 shrink-0">
        {entry.held ? 'Không nhận nữa' : 'Hủy đặt trước'}
      </Button>
    </li>
  );
}

export default function WaitlistTab({ onCountChange }) {
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const [result, setResult] = useState({ key: -1, entries: null, error: null });
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [failure, setFailure] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const closeToast = useCallback(() => { setNotice(null); setFailure(null); }, []);

  useEffect(() => {
    let cancelled = false;
    waitlistService.getMine()
      .then((entries) => {
        if (cancelled) return;
        setResult({ key: revision, entries, error: null });
        setNow(Date.now());
        onCountChange?.(entries.length);
      })
      .catch((error) => !cancelled && setResult({ key: revision, entries: null, error }));
    return () => { cancelled = true; };
  }, [revision, onCountChange]);

  // Cập nhật "còn ... phút" của mục đang giữ chỗ mỗi phút.
  const hasHeld = result.entries?.some((entry) => entry.held);
  useEffect(() => {
    if (!hasHeld) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [hasHeld]);

  const cancel = async () => {
    const entry = confirming;
    setBusy(true);
    try {
      await waitlistService.cancel(entry.id);
      setNotice({ type: 'success', message: `Đã hủy đặt trước "${entry.bookTitle}".` });
      reload();
    } catch (error) {
      setFailure(error);
      reload(); // mục có thể đã hết hiệu lực: tải lại để danh sách khớp máy chủ
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const loading = result.key !== revision && !result.entries;
  const entries = result.entries ?? [];

  return (
    <section aria-labelledby="waitlist-heading" className="space-y-4">
      <ToastAlertComponent error={failure} notice={notice} onClose={closeToast} />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h2 id="waitlist-heading" className="text-lg font-semibold text-slate-900">Sách đang hẹn đặt trước</h2>
          <p className="text-sm text-slate-500">Khi tới lượt, sách được giữ cho bạn 48 giờ. Quá hạn, chỗ chuyển cho người kế tiếp.</p>
        </div>
      </div>

      {loading && (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 2 }, (_, i) => <div key={i} className="h-24 rounded-2xl border border-[#D9E2EE] bg-white animate-pulse" />)}
        </div>
      )}

      {!loading && result.error && (
        <div role="alert" className="py-8 bg-white rounded-2xl border border-rose-200 text-center space-y-3 px-6">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="font-semibold text-slate-800">Không tải được danh sách đặt trước</p>
          <Button variant="outline" onClick={reload}>Thử lại</Button>
        </div>
      )}

      {result.entries && entries.length === 0 && (
        <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center p-6 space-y-3">
          <BellRing className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-800">Bạn chưa hẹn đặt trước cuốn nào</p>
          <p className="text-xs text-slate-500">Khi một cuốn sách hết bản, bấm "Hẹn đặt trước" ở trang chi tiết sách để xếp hàng chờ.</p>
          <Link to="/catalog" className="inline-block"><Button size="sm">Khám phá Danh mục</Button></Link>
        </div>
      )}

      {entries.length > 0 && (
        <ul className="space-y-3">
          {entries.map((entry) => <WaitlistCard key={entry.id} entry={entry} now={now} onCancel={setConfirming} />)}
        </ul>
      )}

      {confirming && (
        <ConfirmDialog
          title={confirming.held ? 'Bỏ lượt giữ chỗ?' : 'Hủy đặt trước?'}
          confirmLabel={confirming.held ? 'Bỏ lượt giữ' : 'Hủy đặt trước'}
          danger loading={busy}
          onClose={() => !busy && setConfirming(null)}
          onConfirm={cancel}
        >
          {confirming.held
            ? <p>Sách <strong>{confirming.bookTitle}</strong> đang được giữ cho bạn. Nếu bỏ, sách chuyển ngay cho người kế tiếp và bạn phải xếp hàng lại từ đầu.</p>
            : <p>Bạn sẽ rời hàng chờ của <strong>{confirming.bookTitle}</strong> (vị trí {positionLabel(confirming)}). Đặt lại sau sẽ xếp cuối hàng.</p>}
        </ConfirmDialog>
      )}
    </section>
  );
}
