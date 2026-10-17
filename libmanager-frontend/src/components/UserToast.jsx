import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast || toast.action) return;
    const timer = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  const failed = toast.type === 'error';
  const Icon = failed ? AlertCircle : CheckCircle2;
  return (
    <div role={failed ? 'alert' : 'status'} className={`fixed bottom-28 lg:bottom-6 right-4 left-4 sm:left-auto sm:max-w-md z-50 rounded-2xl border p-4 shadow-xl ${failed ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p>{toast.message}</p>
          {toast.action && <Link className="mt-2 inline-block font-semibold underline" to={toast.action.to}>{toast.action.label}</Link>}
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng thông báo" className="p-1"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
