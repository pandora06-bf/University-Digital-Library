import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { MOTION_CONSTANTS } from './constants';

/**
 * Hiệu ứng Cursor Ripple chuẩn Figma trang 06 & Video tham chiếu (2.5-7.5s, 23-25.5s)
 * 
 * Đặc tả:
 * - scale 0.4 -> 1, opacity 0.18 -> 0, 420ms, ease-out
 * - Tọa độ tương đối theo container
 * - Throttle: di chuyển tối thiểu 20px, cách nhau tối thiểu 60ms, tối đa 12 ripple
 * - Tự động tắt khi dùng prefers-reduced-motion hoặc thiết bị touch
 * - pointer-events: none và aria-hidden="true"
 */
export const CursorRipple = ({ className = '' }) => {
  const shouldReduceMotion = useReducedMotion();
  const [ripples, setRipples] = useState([]);
  const lastPos = useRef({ x: 0, y: 0, time: 0 });
  const containerRef = useRef(null);
  const isTouchDevice = useRef(false);

  useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  const addRipple = useCallback((clientX, clientY) => {
    if (shouldReduceMotion || isTouchDevice.current) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const now = Date.now();

    const dx = x - lastPos.current.x;
    const dy = y - lastPos.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < MOTION_CONSTANTS.RIPPLE.DISTANCE_THRESHOLD && now - lastPos.current.time < MOTION_CONSTANTS.RIPPLE.TIME_THRESHOLD) {
      return;
    }

    lastPos.current = { x, y, time: now };

    const newRipple = {
      id: `ripple_${now}_${Math.random()}`,
      x,
      y,
    };

    setRipples((prev) => {
      const updated = [...prev, newRipple];
      if (updated.length > MOTION_CONSTANTS.RIPPLE.MAX_RIPPLES) {
        return updated.slice(updated.length - MOTION_CONSTANTS.RIPPLE.MAX_RIPPLES);
      }
      return updated;
    });

    // Xóa ripple sau khi animation kết thúc
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, MOTION_CONSTANTS.RIPPLE.DURATION * 1000 + 50);
  }, [shouldReduceMotion]);

  const handlePointerMove = (e) => {
    addRipple(e.clientX, e.clientY);
  };

  if (shouldReduceMotion) return null;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      className={`absolute inset-0 overflow-hidden pointer-events-none z-0 ${className}`}
      aria-hidden="true"
    >
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{
              scale: MOTION_CONSTANTS.RIPPLE.SCALE_START,
              opacity: MOTION_CONSTANTS.RIPPLE.OPACITY_START,
            }}
            animate={{
              scale: MOTION_CONSTANTS.RIPPLE.SCALE_END,
              opacity: MOTION_CONSTANTS.RIPPLE.OPACITY_END,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: MOTION_CONSTANTS.RIPPLE.DURATION,
              ease: MOTION_CONSTANTS.RIPPLE.EASING,
            }}
            style={{
              position: 'absolute',
              left: ripple.x,
              top: ripple.y,
              width: 140,
              height: 140,
              marginLeft: -70,
              marginTop: -70,
              borderRadius: '50%',
              border: '2px solid rgba(255, 255, 255, 0.45)',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 70%)',
              pointerEvents: 'none',
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default CursorRipple;
