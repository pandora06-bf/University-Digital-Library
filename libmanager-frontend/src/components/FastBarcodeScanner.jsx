import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ScanLine, X, Loader2, Sparkles } from 'lucide-react';

/** Ghi chuỗi ASCII vào DataView (header WAV). */
function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Fallback chắc chắn: tạo file WAV ngắn rồi phát bằng HTMLAudioElement
 * trong cùng user gesture (click / Enter).
 */
function playWavBeepFallback() {
  const sampleRate = 22050;
  const durationSec = 0.14;
  const freq = 1350;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 14);
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.65;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  }

  const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  const audio = new Audio(url);
  audio.volume = 1;
  const cleanup = () => {
    URL.revokeObjectURL(url);
  };
  audio.addEventListener('ended', cleanup, { once: true });
  audio.addEventListener('error', cleanup, { once: true });
  return audio.play().catch(() => {
    cleanup();
  });
}

/**
 * Beep trong gesture click/Enter.
 * Ưu tiên AudioContext MỚI mỗi lần (tránh context cũ bị suspended lúc auto-focus).
 * Lỗi → fallback WAV + Audio().
 */
function playScannerBeep() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    void playWavBeepFallback();
    return;
  }

  try {
    // Tạo mới trong gesture hiện tại → thường vào thẳng "running"
    const ctx = new AudioContextClass();
    const startTone = () => {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, t0);
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.45, t0 + 0.01);
      gain.gain.linearRampToValueAtTime(0.001, t0 + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.14);
      osc.onended = () => {
        try {
          void ctx.close();
        } catch {
          /* ignore */
        }
      };
    };

    if (ctx.state === 'suspended') {
      void ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') {
            startTone();
          } else {
            void playWavBeepFallback();
            void ctx.close();
          }
        })
        .catch(() => {
          void playWavBeepFallback();
          try {
            void ctx.close();
          } catch {
            /* ignore */
          }
        });
      return;
    }

    startTone();
  } catch {
    void playWavBeepFallback();
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
        <label className="text-[12px] leading-[16px] font-medium tracking-[0.3px] text-[#5B6B82] uppercase flex items-center gap-1.5">
          <ScanLine className="w-3.5 h-3.5 text-indigo-600" />
          {label}
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
