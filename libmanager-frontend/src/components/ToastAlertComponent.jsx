import Toast from './Toast';
import { mapBorrowError } from '../utils/borrowErrors';

/**
 * ToastAlertComponent (3-12.a): Toast cho cổng Người dùng, dùng lại Toast chung của Vân.
 * - `error`: lỗi Axios (403/409...) -> Toast đỏ nêu lý do (nợ phạt, vượt hạn mức, hết sách).
 * - `notice`: thông báo thường { message, type?, action? }.
 * `onClose` nên ổn định (useCallback) vì Toast tự đóng sau vài giây.
 */
export default function ToastAlertComponent({ error, notice, action, onClose }) {
  const toast = error
    ? { type: 'error', message: mapBorrowError(error).message, action }
    : notice ?? null;
  return <Toast toast={toast} onClose={onClose} placement="bottom" />;
}
