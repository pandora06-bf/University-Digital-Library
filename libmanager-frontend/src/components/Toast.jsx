import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, AlertCircle, X } from 'lucide-react';

/**
 * Toast dùng chung Admin (Vân) + User (Đạt).
 *
 * Props:
 * - toast: { message, type?: 'success'|'error'|'warning'|'info', action?: { to, label } }
 * - onClose: () => void
 * - placement: 'top' | 'bottom' — Admin mặc định top; User portal dùng bottom
 * - autoCloseMs: số ms tự đóng (mặc định: bottom + không có action → 5000; có action → không tự đóng;
 *                top → không tự đóng vì Admin dùng useToast)
 *
 * Tương thích ngược: API Admin cũ `{ toast, onClose }` vẫn hoạt động.
 * Đạt từng đổi tên file thành UserToast.jsx để tránh đè Toast.jsx của Vân — đã gộp về đây.
 */
export function Toast({ toast, onClose, placement = 'top', autoCloseMs }) {
  const hasAction = Boolean(toast?.action?.to && toast?.action?.label);
  const resolvedAutoClose =
    autoCloseMs !== undefined
      ? autoCloseMs
      : placement === 'bottom' && !hasAction
        ? 5000
        : 0;

  useEffect(() => {
    if (!toast || !onClose || !resolvedAutoClose) return undefined;
    const timer = window.setTimeout(onClose, resolvedAutoClose);
    return () => window.clearTimeout(timer);
  }, [toast, onClose, resolvedAutoClose]);

  if (!toast || !toast.message) return null;

  const type = toast.type || 'success';
  const failed = type === 'error';
  const isBottom = placement === 'bottom';

  // Soft style (User portal — giữ UX Đạt): nền nhạt, góc dưới
  if (isBottom) {
    const Icon = failed ? AlertCircle : CheckCircle2;
    return (
      <div
        role={failed ? 'alert' : 'status'}
        className={`fixed bottom-28 lg:bottom-6 right-4 left-4 sm:left-auto sm:max-w-md z-[9999] rounded-2xl border p-4 shadow-xl ${
          failed
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}
      >
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p>{toast.message}</p>
            {hasAction && (
              <Link
                className="mt-2 inline-block font-semibold underline"
                to={toast.action.to}
                onClick={onClose}
              >
                {toast.action.label}
              </Link>
            )}
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Đóng thông báo" className="p-1">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Banner style (Admin — Vân): giữa phía trên, nền đậm
  let config = {
    bg: 'bg-emerald-600 border-emerald-500',
    icon: <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />,
  };

  if (type === 'error') {
    config = {
      bg: 'bg-rose-600 border-rose-500',
      icon: <AlertOctagon className="w-5 h-5 shrink-0 text-white" />,
    };
  } else if (type === 'warning') {
    config = {
      bg: 'bg-amber-600 border-amber-500',
      icon: <AlertTriangle className="w-5 h-5 shrink-0 text-white" />,
    };
  } else if (type === 'info') {
    config = {
      bg: 'bg-indigo-600 border-indigo-500',
      icon: <Info className="w-5 h-5 shrink-0 text-white" />,
    };
  }

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] max-w-lg w-[90vw] sm:w-auto pointer-events-auto transition-all duration-300">
      <div className={`flex items-start gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white border ${config.bg}`}>
        {config.icon}
        <div className="flex-1 text-sm font-medium leading-relaxed pr-2 break-words">
          <p>{toast.message}</p>
          {hasAction && (
            <Link
              className="mt-2 inline-block font-semibold underline text-white"
              to={toast.action.to}
              onClick={onClose}
            >
              {toast.action.label}
            </Link>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-0.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 -mr-1 cursor-pointer"
            title="Đóng thông báo"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default Toast;
