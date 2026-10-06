import { useRef, useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { MOTION_CONSTANTS } from './constants';

/**
 * Hiệu ứng Parallax cho cụm hình minh họa Hero
 * Dịch chuyển nhẹ 6–10px với spring physics mượt mà (~240ms)
 */
export const HeroParallax = ({ children, className = '' }) => {
  const shouldReduceMotion = useReducedMotion();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isTouchDevice = useRef(false);

  useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  const handleMouseMove = (e) => {
    if (shouldReduceMotion || isTouchDevice.current) return;
    const { currentTarget, clientX, clientY } = e;
    const rect = currentTarget.getBoundingClientRect();
    
    // Tính toán tỷ lệ vị trí con trỏ [-1, 1]
    const relativeX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const relativeY = ((clientY - rect.top) / rect.height) * 2 - 1;

    setOffset({
      x: relativeX * MOTION_CONSTANTS.PARALLAX.MAX_OFFSET_X,
      y: relativeY * MOTION_CONSTANTS.PARALLAX.MAX_OFFSET_Y,
    });
  };

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative ${className}`}
    >
      <motion.div
        animate={{ x: offset.x, y: offset.y }}
        transition={MOTION_CONSTANTS.PARALLAX.SPRING}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default HeroParallax;
