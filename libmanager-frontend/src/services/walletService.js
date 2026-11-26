import axiosInstance from './axios_instance';
import { toTopUp, toTxn } from '../utils/wallet';

// 4-13: Tài khoản dịch vụ của người đang đăng nhập (wallet_router.py, fine_wallet_router.py,
// fines_router.py, webhook_router.py). Lỗi giữ nguyên dạng Axios để ToastAlertComponent đổi lời.
export const TXN_PAGE_SIZE = 10;

// Hệ thống chạy tiền thật (VietQR + webhook SePay). Nút giả lập chỉ hiện khi bật cờ rõ ràng
// VITE_ENABLE_TOPUP_SIMULATE=true (kiểm thử nội bộ); container web chạy `npm run dev` nên không dựa vào DEV.
export const canSimulateTopUp = import.meta.env.VITE_ENABLE_TOPUP_SIMULATE === 'true';

export const walletService = {
  async getBalance() {
    const { data } = await axiosInstance.get('/api/wallet');
    // API thật trả `balance`; mock MSW cũ trả `service_balance`.
    return Number(data.balance ?? data.service_balance ?? 0);
  },

  async getTransactions(page = 1, size = TXN_PAGE_SIZE) {
    const { data } = await axiosInstance.get('/api/wallet/transactions', { params: { page, size } });
    const total = Number(data.total ?? 0);
    return { items: (data.data ?? data.items ?? []).map(toTxn), total, page, size, pages: Math.max(1, Math.ceil(total / size)) };
  },

  async createTopUp(amount) {
    const { data } = await axiosInstance.post('/api/wallet/topups', { amount });
    return toTopUp(data);
  },

  async getTopUp(payCode) {
    const { data } = await axiosInstance.get(`/api/wallet/topups/${encodeURIComponent(payCode)}`);
    return toTopUp(data);
  },

  // Chỉ chạy khi backend bật ENABLE_DEV_SIMULATE; nếu tắt, backend trả 404.
  async simulateTopUp(payCode) {
    const { data } = await axiosInstance.post(`/api/dev/topups/${encodeURIComponent(payCode)}/simulate`);
    return data;
  },

  // Tổng nợ phạt chưa trả + từng khoản (3-08).
  async getMyFines() {
    const { data } = await axiosInstance.get('/api/fines/my-fines');
    return {
      total: Number(data.total_fines ?? 0),
      blocked: Boolean(data.is_borrowing_blocked),
      fines: (data.fines ?? []).map((fine) => ({
        id: fine.fine_id,
        loanId: fine.loan_id,
        overdueDays: fine.overdue_days,
        amount: Number(fine.total_amount ?? 0),
        createdAt: fine.created_at,
      })),
    };
  },

  // 4-02: trả toàn bộ nợ phạt bằng số dư ví.
  async payFines() {
    const { data } = await axiosInstance.post('/api/fines/pay-by-wallet');
    return { amountPaid: Number(data.amount_paid ?? 0), balanceAfter: Number(data.balance_after ?? 0) };
  },

  // 4-07 / UC16 Admin: list giao dịch chưa gán (assigned_user_code IS NULL).
  async listUnmatched(page = 1, size = 50, status = 'unresolved') {
    const { data } = await axiosInstance.get('/api/admin/wallet/unmatched', {
      params: { page, size, status },
    });
    return {
      items: data?.data ?? data?.items ?? [],
      total: Number(data?.total ?? 0),
      page: Number(data?.page ?? page),
      size: Number(data?.size ?? size),
    };
  },

  // Gán unmatched → cộng ví thật; body { user_code, notes? }.
  async assignUnmatched(unmatchedId, userCode, notes = '') {
    const { data } = await axiosInstance.post(
      `/api/admin/wallet/unmatched/${encodeURIComponent(unmatchedId)}/assign`,
      {
        user_code: String(userCode || '').trim(),
        notes: notes?.trim() ? notes.trim() : null,
      }
    );
    return data;
  },
};
