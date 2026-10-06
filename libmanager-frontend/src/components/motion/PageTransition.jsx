import { motion, useReducedMotion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { MOTION_CONSTANTS } from './constants';

/**
 * Hiệu ứng chuyển trang (Route Transition)
 * Desktop 250ms, Mobile 220ms, fade + dịch nhẹ 6px
 */
export const PageTransition = ({ children }) => {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <>{children}</>;
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const duration = isMobile
    ? MOTION_CONSTANTS.ROUTE_TRANSITION.MOBILE_DURATION
    : MOTION_CONSTANTS.ROUTE_TRANSITION.DESKTOP_DURATION;

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
