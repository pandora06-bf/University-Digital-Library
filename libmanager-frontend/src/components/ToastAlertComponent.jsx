import Toast from './Toast';
import { errorToast } from '../utils/borrowErrors';

/**
 * ToastAlertComponent (3-12.a, 4-14.a): Toast duy nhất của cổng Người dùng, dùng lại Toast chung của Vân.
 * - `error`: lỗi Axios hoặc lỗi service đã đổi → Toast đỏ nêu lý do (nợ phạt, hạn mức, thiếu số dư...),
 *   tự thêm nút sang trang nạp tiền khi lỗi liên quan tới tiền (errorToast).
 * - `notice`: thông báo thường { message, type?, action? }.
 * - `action`: ghi đè nút kèm Toast lỗi.
 * `onClose` nên ổn định (useCallback) vì Toast tự đóng sau vài giây.
 */
export default function ToastAlertComponent({ error, notice, action, onClose }) {
  const toast = error ? errorToast(error, action) : notice ?? null;
  return <Toast toast={toast} onClose={onClose} placement="bottom" />;
}
