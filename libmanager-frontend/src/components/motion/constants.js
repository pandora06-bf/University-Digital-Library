/**
 * Các thông số Motion chuẩn hóa theo Trang 06 Figma & Video tham chiếu
 */

export const MOTION_CONSTANTS = {
  // Cursor ripple: scale 0.4 -> 1; opacity 0.18 -> 0; 420ms; ease-out
  RIPPLE: {
    SCALE_START: 0.4,
    SCALE_END: 1,
    OPACITY_START: 0.18,
    OPACITY_END: 0,
    DURATION: 0.42, // giây
    EASING: [0.16, 1, 0.3, 1], // ease-out
    MAX_RIPPLES: 12,
    DISTANCE_THRESHOLD: 20, // px
    TIME_THRESHOLD: 60, // ms
  },

  // Hero parallax: dịch hình 6–12px; phản hồi ~240ms; spring nhẹ
  PARALLAX: {
    MAX_OFFSET_X: 10,
    MAX_OFFSET_Y: 8,
    SPRING: {
      type: 'spring',
      stiffness: 150,
      damping: 20,
      mass: 0.5,
    },
  },

  // Scroll reveal: y 24 -> 0px; opacity 0 -> 1; 480ms; ease-out
  REVEAL: {
    Y_OFFSET: 24,
    DURATION: 0.48,
    VIEWPORT_AMOUNT: 0.15,
    EASING: [0.25, 1, 0.5, 1],
  },

  // Stagger BookCard: delay giữa các thẻ 60ms
  STAGGER: {
    CHILD_DELAY: 0.06,
  },

  // Route transition
  ROUTE_TRANSITION: {
    DESKTOP_DURATION: 0.25,
    MOBILE_DURATION: 0.22,
  },
};
