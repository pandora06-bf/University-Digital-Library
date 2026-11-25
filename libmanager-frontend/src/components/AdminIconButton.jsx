import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Nút thao tác chỉ icon trong bảng Admin.
 * Tooltip xám (portal + fixed) để không bị cắt bởi overflow của table.
 */
export function AdminIconButton({
  title,
  className = '',
  children,
  onClick,
  disabled = false,
  type = 'button',
  ...rest
}) {
  const label = String(title || '').trim();
  const btnRef = useRef(null);
  const showTimer = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Giữ tooltip trong viewport — nút sát mép phải (vd. Xóa) vẫn hiện đủ chữ
    const pad = 8;
    const approxHalf = Math.max(48, label.length * 3.6);
    const rawLeft = rect.left + rect.width / 2;
    const minLeft = pad + approxHalf;
    const maxLeft = window.innerWidth - pad - approxHalf;
    setCoords({
      top: rect.top - 8,
      left: Math.min(maxLeft, Math.max(minLeft, rawLeft)),
    });
  };

  const show = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
      return;
    }
    if (!label || disabled) return;
    window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => {
      place();
      setOpen(true);
    }, 120);
  };

  const hide = () => {
    window.clearTimeout(showTimer.current);
    setOpen(false);
  };

  useEffect(() => () => window.clearTimeout(showTimer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type={type}
        aria-label={label || undefined}
        disabled={disabled}
        className={`btn-action relative inline-flex items-center justify-center ${className}`}
        {...rest}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(event) => {
          hide();
          onClick?.(event);
        }}
      >
        {children}
      </button>
      {open && label
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-[200] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-600 px-2 py-1 text-xs font-medium text-white shadow-sm"
              style={{ top: coords.top, left: coords.left }}
            >
              {label}
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-600"
              />
            </span>,
            document.body
          )
        : null}
    </>
  );
}

export default AdminIconButton;
