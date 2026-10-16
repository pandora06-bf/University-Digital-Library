import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Toast Component dùng chung cho các màn hình Admin và User.
 * Hỗ trợ các kiểu thông báo: 'success' | 'error' | 'warning' | 'info'
 */
export function Toast({ toast, onClose }) {
  if (!toast || !toast.message) return null;

  const type = toast.type || 'success';

  let config = {
    bg: 'bg-emerald-600 border-emerald-500',
    icon: <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />
  };

  if (type === 'error') {
    config = {
      bg: 'bg-rose-600 border-rose-500',
      icon: <AlertOctagon className="w-5 h-5 shrink-0 text-white" />
    };
  } else if (type === 'warning') {
    config = {
      bg: 'bg-amber-600 border-amber-500',
      icon: <AlertTriangle className="w-5 h-5 shrink-0 text-white" />
    };
  } else if (type === 'info') {
    config = {
      bg: 'bg-indigo-600 border-indigo-500',
      icon: <Info className="w-5 h-5 shrink-0 text-white" />
    };
  }

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] max-w-lg w-[90vw] sm:w-auto pointer-events-auto transition-all duration-300">
      <div className={`flex items-start gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white border ${config.bg}`}>
        {config.icon}
        <div className="flex-1 text-sm font-medium leading-relaxed pr-2 break-words">
          {toast.message}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-0.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 -mr-1 cursor-pointer"
            title="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default Toast;
