import { INITIAL_BOOKS } from './books';

/**
 * Quản lý kho sách và phiếu mượn tương tác trong phiên làm việc (Mock Store)
 * Lưu trữ trong sessionStorage để đồng bộ giữa các trang khi thao tác
 */

const STORAGE_KEYS = {
  BOOKS: 'libmanager_books_data',
  LOANS: 'libmanager_user_loans',
};

// Khởi tạo sách mẫu
export const getStoredBooks = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.BOOKS);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  sessionStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(INITIAL_BOOKS));
  return INITIAL_BOOKS;
};

// Cập nhật danh sách sách
export const setStoredBooks = (books) => {
  sessionStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));
};

// Khởi tạo phiếu mượn ban đầu của sinh viên
const INITIAL_LOANS = [
  {
    id: 'loan_01',
    loanCode: 'PM-2026-0098',
    bookId: 'b1',
    bookTitle: 'Lập trình Web hiện đại với React 19 & Vite',
    author: 'Dan Abramov, TS. Nguyễn Thanh Nhật',
    isbn: '978-604-2-8921',
    borrowDate: '10/09/2026',
    dueDate: '24/09/2026',
    status: 'Đang mượn',
    statusType: 'warning',
    pdfAvailable: true,
  },
  {
    id: 'loan_02',
    loanCode: 'PM-2026-0072',
    bookId: 'b2',
    bookTitle: 'Cấu trúc dữ liệu & Giải thuật thực chiến',
    author: 'Đỗ Xuân Lôi, Lê Minh Hoàng',
    isbn: '978-604-5-8910',
    borrowDate: '01/09/2026',
    dueDate: '15/09/2026',
    status: 'Đang mượn',
    statusType: 'warning',
    pdfAvailable: true,
  },
  {
    id: 'loan_03',
    loanCode: 'PM-2026-0044',
    bookId: 'b5',
    bookTitle: 'Thiết kế Hệ thống Phân tán (Designing Data-Intensive Apps)',
    author: 'Martin Kleppmann',
    isbn: '978-604-1-7723',
    borrowDate: '15/08/2026',
    dueDate: '29/08/2026',
    status: 'Đã trả',
    statusType: 'success',
    pdfAvailable: true,
  },
];

// Lấy danh sách phiếu mượn
export const getStoredLoans = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.LOANS);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  sessionStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(INITIAL_LOANS));
  return INITIAL_LOANS;
};

// Cập nhật danh sách phiếu mượn
export const setStoredLoans = (loans) => {
  sessionStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
};

// Nghiệp vụ mượn sách
export const borrowBookAction = (bookId) => {
  const books = getStoredBooks();
  const loans = getStoredLoans();

  const bookIndex = books.findIndex((b) => b.id === bookId);
  if (bookIndex === -1) {
    return { success: false, message: 'Không tìm thấy tài liệu trong hệ thống' };
  }

  const book = books[bookIndex];

  // Kiểm tra còn sách khả dụng không
  if (book.availableCopies <= 0) {
    return { success: false, message: 'Tài liệu này hiện đã hết bản sao trên kệ' };
  }

  // Kiểm tra xem độc giả đã mượn và đang giữ sách này chưa
  const existingActiveLoan = loans.find(
    (l) => l.bookId === bookId && l.status === 'Đang mượn'
  );
  if (existingActiveLoan) {
    return { success: false, message: 'Bạn đang mượn cuốn sách này, vui lòng hoàn trả trước khi mượn lại' };
  }

  // Giảm số lượng khả dụng đi 1
  book.availableCopies -= 1;
  books[bookIndex] = book;
  setStoredBooks(books);

  // Tạo phiếu mượn mới
  const now = new Date();
  const dueDate = new Date();
  dueDate.setDate(now.getDate() + 14); // Hạn 14 ngày

  const formatDate = (d) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const newLoan = {
    id: `loan_${Date.now()}`,
    loanCode: `PM-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    bookId: book.id,
    bookTitle: book.title,
    author: book.author,
    isbn: book.isbn,
    borrowDate: formatDate(now),
    dueDate: formatDate(dueDate),
    status: 'Đang mượn',
    statusType: 'warning',
    pdfAvailable: book.pdfAvailable,
  };

  const updatedLoans = [newLoan, ...loans];
  setStoredLoans(updatedLoans);

  return { success: true, message: 'Mượn tài liệu thành công!', loan: newLoan };
};

// Nghiệp vụ trả sách
export const returnBookAction = (loanId) => {
  const loans = getStoredLoans();
  const books = getStoredBooks();

  const loanIndex = loans.findIndex((l) => l.id === loanId);
  if (loanIndex === -1) return { success: false, message: 'Không tìm thấy phiếu mượn' };

  const loan = loans[loanIndex];
  if (loan.status === 'Đã trả') {
    return { success: false, message: 'Tài liệu này đã được trả trước đó' };
  }

  loan.status = 'Đã trả';
  loan.statusType = 'success';
  loans[loanIndex] = loan;
  setStoredLoans(loans);

  // Tăng lại số lượng sách
  const bookIndex = books.findIndex((b) => b.id === loan.bookId);
  if (bookIndex !== -1) {
    books[bookIndex].availableCopies += 1;
    setStoredBooks(books);
  }

  return { success: true, message: 'Trả tài liệu thành công!' };
};
