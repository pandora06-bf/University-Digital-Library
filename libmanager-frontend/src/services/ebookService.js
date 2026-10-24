import axiosInstance, { getToken } from './axios_instance';
import { getMockPreview, getMockLoanSession, borrowMockEbook, returnMockEbook } from '../mocks/ebooks';
import { previewLimit, libraryTimestamp } from '../utils/ebookAccess';

const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
function toSession(loan) {
  const loanId = loan.loan_id ?? loan.id;
  const readToken = loan.read_token ?? loan.ebook_access_token;
  const expiresAt = libraryTimestamp(loan.read_token_expires_at ?? loan.due_date);
  const valid = loan.loan_type === 'EBOOK' && loan.loan_status === 'BORROWED' && readToken && expiresAt;
  const url = new URL(`/api/ebooks/${encodeURIComponent(loan.book_id)}/stream`, axiosInstance.defaults.baseURL);
  if (readToken) url.searchParams.set('read_token', readToken);
  return { loanId, bookId: loan.book_id, title: loan.book_title ?? 'eBook thư viện', readToken, expiresAt,
    loanExpiresAt: libraryTimestamp(loan.due_date), access: valid ? 'borrowed' : 'locked',
    file: valid ? { url: url.toString(), httpHeaders: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} } : null };
}

export const ebookService = {
  mode: useMock ? 'mock' : 'api',
  async getPreview(bookId) {
    if (useMock) return getMockPreview(bookId);
    const { data: book } = await axiosInstance.get(`/api/books/${encodeURIComponent(bookId)}`);
    // Endpoint preview phải trả PDF đã cắt, không được trả toàn bộ sách bản quyền.
    const { data } = await axiosInstance.get(`/api/ebooks/${encodeURIComponent(bookId)}/preview`, { responseType: 'arraybuffer' });
    return { bookId, title: book.title, access: book.ebook?.is_free ? 'free' : 'preview', previewPages: previewLimit(book.ebook?.preview_pages), file: { data: new Uint8Array(data) } };
  },
  async getLoanSession(loanId) {
    if (useMock) return getMockLoanSession(loanId);
    // API lịch sử hiện có phân trang, không giả định phiếu luôn nằm trong trang đầu.
    for (let skip = 0; ; skip += 50) {
      const { data } = await axiosInstance.get('/api/loans/me', { params: { skip, limit: 50 } });
      const loan = data.data.find((item) => String(item.id) === String(loanId));
      if (loan) return toSession(loan);
      if (data.data.length < 50) throw new Error('Không tìm thấy phiếu mượn eBook.');
    }
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
