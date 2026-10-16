import { useState, useCallback, useRef } from 'react';

/**
 * Custom Hook quản lý hiển thị Toast không trùng lặp và tự động tắt
 * @returns {{ toast: object | null, showToast: Function, hideToast: Function }}
 */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback((message, type = 'success', duration = 4000) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setToast({
      id: Date.now(),
      message,
      type
    });

    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, duration);
    }
  }, []);

  return {
    toast,
    showToast,
    hideToast
  };
}

export default useToast;
