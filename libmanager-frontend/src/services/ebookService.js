import axiosInstance, { getToken } from './axios_instance';
import { getMockPreview, getMockLoanSession, borrowMockEbook, returnMockEbook } from '../mocks/ebooks';
import { previewLimit, libraryTimestamp } from '../utils/ebookAccess';

const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
// Trùng với ACTIVE trong back_fast_api/app/services/ebook_service.py
const ACTIVE_STATUSES = ['PENDING_PICKUP', 'BORROWED', 'OVERDUE'];

function isActiveEbookLoan(loan) {
  const due = new Date(libraryTimestamp(loan.due_date)).getTime();
  return loan.loan_type === 'EBOOK' && ACTIVE_STATUSES.includes(loan.loan_status) && due > Date.now();
}

// loan: bản ghi từ /api/loans/me; grant: phản hồi của /api/loans/ebook/borrow (có read_token JWT)
function toSession(loan, grant) {
  const readToken = grant?.read_token;
  const expiresAt = libraryTimestamp(grant?.due_date ?? loan.due_date);
  const valid = Boolean(grant && readToken && expiresAt);
  const url = new URL(`/api/ebooks/${encodeURIComponent(loan.book_id)}/stream`, axiosInstance.defaults.baseURL);
  if (readToken) url.searchParams.set('read_token', readToken);
  return { loanId: loan.id, bookId: loan.book_id, title: loan.book_title ?? 'eBook thư viện', readToken, expiresAt,
    loanExpiresAt: expiresAt, access: valid ? 'borrowed' : 'locked',
    // /stream yêu cầu cả token đăng nhập (header) lẫn read_token (query)
    file: valid ? { url: url.toString(), httpHeaders: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} } : null };
}

async function findMyLoan(loanId) {
  // API lịch sử có phân trang, không giả định phiếu luôn nằm trong trang đầu.
  for (let skip = 0; ; skip += 50) {
    const { data } = await axiosInstance.get('/api/loans/me', { params: { skip, limit: 50 } });
    const loan = data.data.find((item) => String(item.id) === String(loanId));
    if (loan) return loan;
    if (data.data.length < 50) throw Object.assign(new Error('Không tìm thấy phiếu mượn eBook.'), { status: 404 });
  }
}

async function getBookInfo(bookId) {
  // Backend chưa có GET /api/books/{id}; thiếu thì vẫn mở được bản xem trước với tiêu đề mặc định.
  try {
    const { data } = await axiosInstance.get(`/api/books/${encodeURIComponent(bookId)}`);
    return data;
  } catch {
    return null;
  }
}

export const ebookService = {
  mode: useMock ? 'mock' : 'api',
  async getPreview(bookId) {
    if (useMock) return getMockPreview(bookId);
    // Endpoint preview đã cắt PDF theo preview_pages (tối đa 10) phía backend.
    const [{ data }, book] = await Promise.all([
      axiosInstance.get(`/api/ebooks/${encodeURIComponent(bookId)}/preview`, { responseType: 'arraybuffer' }),
      getBookInfo(bookId),
    ]);
    return { bookId, title: book?.title ?? 'eBook thư viện', access: book?.ebook?.is_free ? 'free' : 'preview',
      previewPages: previewLimit(book?.ebook?.preview_pages ?? 10), file: { data: new Uint8Array(data) } };
  },
  async getLoanSession(loanId) {
    if (useMock) return getMockLoanSession(loanId);
    const loan = await findMyLoan(loanId);
    if (!isActiveEbookLoan(loan)) return toSession(loan, null);
    // /api/loans/me không trả read_token; borrow trả lại đúng phiếu đang hiệu lực kèm read_token mới.
    const { data: grant } = await axiosInstance.post('/api/loans/ebook/borrow', { book_id: loan.book_id });
    return toSession(loan, String(grant.loan_id) === String(loan.id) ? grant : null);
  },
  async borrow(bookId) {
    if (useMock) return borrowMockEbook(bookId);
    const { data } = await axiosInstance.post('/api/loans/ebook/borrow', { book_id: bookId });
    return { id: data.loan_id ?? data.id };
  },
  async returnBook(loanId) {
    if (useMock) return returnMockEbook(loanId);
    await axiosInstance.post(`/api/loans/${encodeURIComponent(loanId)}/return-ebook`);
  },
};
