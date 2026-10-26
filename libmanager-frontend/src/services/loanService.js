import axiosInstance from './axios_instance';
import { requestPhysicalLoan, joinWaitlist } from '../mocks/loans';

// POST /api/loans/physical/request (3-01.a, Đức) chưa có trên backend nên mặc định dùng mock.
// Đặt VITE_PHYSICAL_LOAN_API=true khi backend xong; API đặt trước (3-04.a, Nhất) đã có.
const useApi = import.meta.env.VITE_PHYSICAL_LOAN_API === 'true';

// Chuẩn hóa phiếu từ backend: { loan_id|id, loan_code, pickup_deadline, ... }
const toLoan = (data) => ({
  id: data.loan_id ?? data.id,
  loanCode: data.loan_code ?? data.loanCode,
  pickupDeadline: data.pickup_deadline ?? data.pickupDeadline,
  status: data.loan_status ?? data.status,
});

export const loanService = {
  mode: useApi ? 'api' : 'mock',
  // Lỗi giữ nguyên dạng Axios để trang đổi bằng mapBorrowError (403/409).
  async requestPhysical(bookId) {
    if (!useApi) return requestPhysicalLoan(bookId);
    const { data } = await axiosInstance.post('/api/loans/physical/request', { book_id: bookId });
    return toLoan(data);
  },
  async joinWaitlist(bookId) {
    if (!useApi) return joinWaitlist(bookId);
    const { data } = await axiosInstance.post('/api/waitlists', { book_id: bookId });
    return { id: data.id, bookId: data.book_id, queuePosition: data.queue_position, status: data.status };
  },
};
