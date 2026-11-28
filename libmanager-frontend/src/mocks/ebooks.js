import { getStoredBooks, getStoredLoans, setStoredLoans } from './loans';
import { createSamplePdf } from './sampleEbook';
import { getCurrentUser } from './auth';

const error = (message, status = 404) => { throw Object.assign(new Error(message), { status }); };
const dueTimestamp = (loan) => {
  if (loan.expiresAt) return loan.expiresAt;
  const [day, month, year] = (loan.dueDate ?? '').split('/');
  return `${year}-${month}-${day}T23:59:59+07:00`;
};
const getBook = (id) => {
  const book = getStoredBooks().find((item) => String(item.id) === String(id));
  if (!book?.pdfAvailable) error('Không tìm thấy bản eBook của tài liệu này.');
  return book;
};

export function getMockPreview(bookId) {
  const book = getBook(bookId);
  const free = book.ebookIsFree === true;
  return { bookId: book.id, title: book.title, access: free ? 'free' : 'preview', previewPages: 5,
    file: { data: createSamplePdf(free ? 12 : 5) }, isSample: true };
}

export function getMockLoanSession(loanId) {
  const loan = getStoredLoans().find((item) => String(item.id) === String(loanId));
  if (!loan?.pdfAvailable) error('Không tìm thấy phiếu mượn eBook.');
  getBook(loan.bookId);
  const expiresAt = dueTimestamp(loan);
  const valid = loan.status === 'Đang mượn' && loan.loanType === 'EBOOK' && new Date(expiresAt).getTime() > Date.now();
  return { bookId: loan.bookId, loanId: loan.id, title: loan.bookTitle, access: valid ? 'borrowed' : 'locked',
    expiresAt, readToken: valid ? loan.readToken : undefined, file: valid ? { data: createSamplePdf() } : null, isSample: true };
}

export function borrowMockEbook(bookId) {
  const book = getBook(bookId);
  const user = getCurrentUser();
  if (user?.is_locked || user?.total_fines > 0) error('Tài khoản đang bị khóa hoặc còn nợ phạt. Vui lòng liên hệ thủ thư.', 403);
  const loans = getStoredLoans();
  for (const loan of loans) {
    if (loan.loanType === 'EBOOK' && loan.status === 'Đang mượn' && new Date(dueTimestamp(loan)).getTime() <= Date.now()) {
      loan.status = 'Hết hạn'; loan.statusType = 'warning'; delete loan.readToken;
    }
  }
  setStoredLoans(loans);
  const existing = loans.find((loan) => loan.bookId === book.id && loan.loanType === 'EBOOK' && loan.status === 'Đang mượn' && new Date(dueTimestamp(loan)).getTime() > Date.now());
  if (existing) return existing;
  const active = loans.filter((loan) => loan.status === 'Đang mượn').length;
  const limit = user?.apiRole === 'LECTURER' ? 5 : 3;
  if (active >= limit) error(`Đã đạt hạn mức mượn: đang mượn ${active}/tối đa ${limit} cuốn`, 403);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 14 * 86400000).toISOString();
  const dateLabel = (value) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  const loan = { id: `ebook_${crypto.randomUUID()}`, loanCode: `EB-${Date.now()}`, loanType: 'EBOOK', bookId: book.id,
    bookTitle: book.title, author: book.author, isbn: book.isbn, borrowDate: dateLabel(now), dueDate: dateLabel(expiresAt),
    expiresAt, readToken: `mock_${crypto.randomUUID()}`, status: 'Đang mượn', statusType: 'warning', pdfAvailable: true };
  // Mượn eBook không giảm số lượng bản sao vật lý.
  setStoredLoans([loan, ...loans]);
  return loan;
}

export function returnMockEbook(loanId) {
  const loans = getStoredLoans();
  const loan = loans.find((item) => item.id === loanId);
  if (!loan || loan.loanType !== 'EBOOK') error('Không tìm thấy phiếu mượn eBook.');
  loan.status = 'Đã trả'; loan.statusType = 'success'; delete loan.readToken;
  setStoredLoans(loans);
}
