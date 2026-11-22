import axiosInstance from './axios_instance';
import { libraryTimestamp } from '../utils/ebookAccess';

// Chế độ mock (VITE_USE_MOCK=true) do MSW chặn request, nên service luôn gọi API như thật.
const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
const PAGE_LIMIT = 50; // GET /api/loans/me cho tối đa 50 phiếu mỗi lần

// Trạng thái phiếu trong bảng loans (chk_loan_status_valid) → nhãn và màu StatusBadge.
const STATUS = {
  PENDING_PICKUP: { label: 'Chờ nhận', tone: 'neutral' },
  REQUESTED: { label: 'Chờ nhận', tone: 'neutral' },
  BORROWED: { label: 'Đang mượn', tone: 'warning' },
  OVERDUE: { label: 'Quá hạn', tone: 'danger' },
  RETURNED: { label: 'Đã trả', tone: 'success' },
  LOST: { label: 'Báo mất', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
  EXPIRED: { label: 'Quá hạn nhận', tone: 'neutral' },
};
// Phiếu còn hiệu lực: tính vào hạn mức mượn (trùng ACTIVE_LOAN_STATUSES của loan_service.py).
export const ACTIVE_LOAN_STATES = ['PENDING_PICKUP', 'REQUESTED', 'BORROWED', 'OVERDUE'];
export const WAITING_PICKUP_STATES = ['PENDING_PICKUP', 'REQUESTED'];

// Chuẩn hóa phiếu từ backend (snake_case, giờ UTC không kèm múi giờ) sang dạng trang dùng.
const toLoan = (data) => {
  const state = String(data.loan_status ?? '').toUpperCase();
  const status = STATUS[state] ?? { label: state || 'Không rõ', tone: 'neutral' };
  return {
    id: data.id,
    loanCode: data.loan_code || `#${data.id}`,
    bookId: data.book_id,
    bookTitle: data.book_title ?? `Sách #${data.book_id}`,
    author: data.book_author ?? null,
    copyBarcode: data.copy_barcode ?? null,
    loanType: data.loan_type,
    isEbook: data.loan_type === 'EBOOK',
    state,
    status: status.label,
    statusType: status.tone,
    borrowDate: libraryTimestamp(data.borrow_date),
    dueDate: libraryTimestamp(data.due_date),
    pickupDeadline: libraryTimestamp(data.pickup_deadline),
    returnDate: libraryTimestamp(data.return_date),
    renewalCount: Number(data.renewal_count ?? 0),
  };
};

// 3-14 / UC06: nút Gia hạn chỉ hiện khi sắp đến hạn (≤ 3 ngày) và BE còn cho phép (≥ 6 giờ).
const SOON_DUE_MS = 3 * 24 * 60 * 60 * 1000;
const MIN_RENEW_MS = 6 * 60 * 60 * 1000;
const MAX_RENEWALS = 1;

export function isSoonDue(loan, now = Date.now()) {
  if (!loan?.dueDate || !['BORROWED', 'OVERDUE'].includes(loan.state)) return false;
  const left = new Date(loan.dueDate).getTime() - now;
  return left > 0 && left <= SOON_DUE_MS;
}

export function canRenewLoan(loan, now = Date.now()) {
  if (!loan || loan.isEbook) return false;
  if (loan.state !== 'BORROWED') return false;
  if ((loan.renewalCount ?? 0) >= MAX_RENEWALS) return false;
  if (!loan.dueDate) return false;
  const left = new Date(loan.dueDate).getTime() - now;
  return left >= MIN_RENEW_MS && left <= SOON_DUE_MS;
}

export const loanService = {
  // Lỗi giữ nguyên dạng Axios để trang đổi bằng mapBorrowError (403/409).
  async requestPhysical(bookId) {
    const { data } = await axiosInstance.post('/api/loans/physical/request', { book_id: Number(bookId) });
    return toLoan(data);
  },

  async joinWaitlist(bookId) {
    const { data } = await axiosInstance.post('/api/waitlists', { book_id: Number(bookId) });
    return { id: data.id, bookId: data.book_id, queuePosition: data.queue_position, status: data.status };
  },

  // 3-14 / 3-02: gia hạn sách vật lý → Due_Date + 3 ngày.
  async renewLoan(loanId) {
    const { data } = await axiosInstance.post(`/api/loans/${encodeURIComponent(loanId)}/renew`);
    return toLoan(data);
  },

  // Phiếu đang mở (3-14 tab Đang mượn).
  async getMyActiveLoans() {
    const { data } = await axiosInstance.get('/api/loans/my-loans');
    const rows = data.data ?? data.items ?? [];
    return rows.map(toLoan);
  },

  // Phiếu đã đóng (3-14 tab Lịch sử).
  async getMyHistory(skip = 0, limit = 50) {
    const { data } = await axiosInstance.get('/api/loans/my-history', { params: { skip, limit } });
    const rows = data.data ?? data.items ?? [];
    return rows.map(toLoan);
  },

  // Toàn bộ phiếu của người đang đăng nhập, mới nhất trước. API có phân trang skip/limit
  // nên đọc lần lượt từng trang tới khi hết, không giả định mọi phiếu nằm ở trang đầu.
  async getMyLoans() {
    if (useMock) {
      const { data } = await axiosInstance.get('/api/loans/my-loans');
      return (data.data ?? data.items ?? []).map(toLoan);
    }
    const loans = [];
    for (let skip = 0; ; skip += PAGE_LIMIT) {
      const { data } = await axiosInstance.get('/api/loans/me', { params: { skip, limit: PAGE_LIMIT } });
      loans.push(...data.data.map(toLoan));
      if (data.data.length < PAGE_LIMIT) return loans;
    }
  },
};
