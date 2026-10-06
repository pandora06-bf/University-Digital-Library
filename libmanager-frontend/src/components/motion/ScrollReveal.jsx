import { motion, useReducedMotion } from 'motion/react';
import { MOTION_CONSTANTS } from './constants';

/**
 * Hiệu ứng Scroll Reveal chuẩn Figma trang 06
 * Khi 15% phần tử vào tầm nhìn: y 24 -> 0px, opacity 0 -> 1, 480ms ease-out
 */
export const ScrollReveal = ({
  children,
  delay = 0,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: MOTION_CONSTANTS.REVEAL.Y_OFFSET,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
        amount: MOTION_CONSTANTS.REVEAL.VIEWPORT_AMOUNT,
      }}
      transition={{
        duration: MOTION_CONSTANTS.REVEAL.DURATION,
        delay,
        ease: MOTION_CONSTANTS.REVEAL.EASING,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default ScrollReveal;
