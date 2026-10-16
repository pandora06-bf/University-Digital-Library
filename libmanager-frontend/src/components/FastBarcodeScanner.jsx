import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ScanLine, X, Loader2, Sparkles } from 'lucide-react';

/**
 * Phát âm thanh beep ngắn (880Hz, 70ms) mô phỏng máy tít mã vạch chuyên dụng tại quầy thư viện
 */
function playScannerBeep() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // Nốt A5 chuẩn máy POS
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {
    // Trình duyệt có thể chặn autoplay audio nếu chưa có tương tác người dùng, bỏ qua an toàn
  }
}

/**
 * FastBarcodeScanner - Component quét mã vạch tốc độ cao cho Thủ thư (Sprint 3)
 *
 * Tính năng chính:
 * 1. Lắng nghe sự kiện phím Enter từ máy tít mã vạch USB / Bluetooth.
 * 2. Tự động xóa sạch ô nhập sau khi quét (autoClear = true) để quét liên tục không cần thao tác chuột.
 * 3. Hiệu ứng phản hồi thị giác (Pulse xanh lá) và âm thanh beep mô phỏng máy POS thực tế.
 * 4. Hỗ trợ cả nhập tay và bấm nút "Quét / Kiểm tra" phụ trợ.
 * 5. Tự động lấy lại tiêu điểm (autoRefocus = true) sau mỗi lần quét thành công.
 */
export const FastBarcodeScanner = forwardRef(function FastBarcodeScanner(
  {
    onScan,
    placeholder = 'Quét mã vạch barcode (BC-...) hoặc nhập rồi nhấn Enter...',
    label,
    helperText = 'Hỗ trợ máy quét tự động gửi phím Enter sau khi tít mã.',
    error,
    autoFocus = false,
    autoClear = true,
    autoRefocus = true,
    playSound = true,
    disabled = false,
    loading = false,
    showButton = true,
    buttonText = 'Kiểm tra',
    className = '',
    value: controlledValue,
    onChange: controlledOnChange,
    ...props
  },
  ref
) {
  const [internalValue, setInternalValue] = useState('');
  const [isSuccessFlash, setIsSuccessFlash] = useState(false);
  const inputRef = useRef(null);

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      if (isControlled) {
        controlledOnChange?.({ target: { value: '' } });
      } else {
        setInternalValue('');
      }
    },
    getValue: () => currentValue,
  }));

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e) => {
    if (isControlled) {
      controlledOnChange?.(e);
    } else {
      setInternalValue(e.target.value);
    }
  };

  const handleClear = () => {
    if (isControlled) {
      controlledOnChange?.({ target: { value: '' } });
    } else {
      setInternalValue('');
    }
    inputRef.current?.focus();
  };

  const triggerScan = (codeToScan) => {
    const trimmed = (codeToScan !== undefined ? codeToScan : currentValue).trim();
    if (!trimmed || disabled || loading) return;

    // Phản hồi âm thanh
    if (playSound) {
      playScannerBeep();
    }

    // Phản hồi thị giác (nháy xanh lá 350ms)
    setIsSuccessFlash(true);
    setTimeout(() => setIsSuccessFlash(false), 350);

    // Bắn callback ra ngoài
    onScan?.(trimmed);

    // Tự động xóa nội dung để tít cuốn tiếp theo liên tục
    if (autoClear) {
      if (isControlled) {
        controlledOnChange?.({ target: { value: '' } });
      } else {
        setInternalValue('');
      }
    }

    // Tự động giữ tiêu điểm cho máy quét
    if (autoRefocus) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerScan();
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-[12px] leading-[16px] font-medium tracking-[0.3px] text-[#5B6B82] uppercase flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5 text-indigo-600" />
            {label}
          </span>
          <span className="text-[10px] text-indigo-600 lowercase font-mono">
            [chế độ tít liên tục: {autoClear ? 'bật' : 'tắt'}]
          </span>
        </label>
      )}

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors">
            <ScanLine
              className={`w-5 h-5 transition-transform duration-200 ${
                isSuccessFlash ? 'text-emerald-600 scale-110' : 'text-slate-400'
              }`}
            />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={currentValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || loading}
            placeholder={placeholder}
            className={`w-full h-11 pl-11 pr-10 bg-white rounded-xl text-sm font-mono text-slate-800 border transition-all duration-200 focus:outline-none ${
              isSuccessFlash
                ? '!border-emerald-500 !ring-4 !ring-emerald-500/20 bg-emerald-50/30'
                : error
                ? 'border-rose-400 ring-2 ring-rose-500/10'
                : 'border-[#D9E2EE] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300'
            } ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
            {...props}
          />

          {/* Nút xóa nhanh / Spinner */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {loading ? (
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
            ) : currentValue ? (
              <button
                type="button"
                onClick={handleClear}
                tabIndex={-1}
                aria-label="Xóa mã vạch"
                className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            ) : null}
          </div>
        </div>

        {showButton && (
          <button
            type="button"
            onClick={() => triggerScan()}
            disabled={disabled || loading || !currentValue}
            className={`h-11 px-5 rounded-xl font-semibold text-sm transition-all duration-200 shrink-0 flex items-center gap-1.5 select-none ${
              currentValue && !disabled && !loading
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm hover:from-indigo-700 hover:to-indigo-800 active:scale-95'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{buttonText}</span>
          </button>
        )}
      </div>

      {/* Helper text hoặc Error text */}
      {error ? (
        <p className="text-[12px] leading-[16px] text-rose-500 font-medium">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-[12px] leading-[16px] text-[#667085] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"></span>
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default FastBarcodeScanner;
