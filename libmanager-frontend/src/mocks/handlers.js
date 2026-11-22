import { http, HttpResponse } from 'msw';
import { INITIAL_BOOKS } from './books';

const API_BOOKS = INITIAL_BOOKS.map((book, index) => ({
  id: index + 1,
  title: book.title,
  author: book.author,
  isbn: book.isbn,
  publisher: book.publisher,
  price: [285000, 195000, 240000, 145000, 320000, 125000][index],
  publication_year: book.publishYear,
  published_year: book.publishYear,
  description: book.description,
  keywords: book.category,
  num_pages: 240 + index * 32,
  book_type: index % 3 === 0 ? 'BOTH' : index % 3 === 1 ? 'PRINTED' : 'EBOOK',
  available_stock: Math.max(0, book.availableCopies),
  category_id: index + 1,
  // subject_code khop SUBJECTS trong database_seeder.py: IT, MATH, PHYS, ECON, ENG
  subject_code: ['IT', 'IT', 'IT', 'ECON', 'IT', 'ENG'][index],
  barcode: book.barcode,
  copy_barcode: book.barcode,
  cover_image_path: null,
  ebook: index % 3 === 2 ? { file_path: 'demo/ebook-' + (index + 1) + '.pdf', is_free: false } : null,
}));

const PROFILE = {
  user_code: 'SV-DEMO-001',
  username: 'demo_student_001',
  full_name: 'Nguyen Van Dat',
  email: 'demo.user.001@library.local',
  phone_number: '0900000001',
  department: 'Khoa Cong nghe thong tin',
  academic_title: null,
  user_type: 'STUDENT',
  role: 'STUDENT',
  max_borrow_limit: 3,
  max_borrow_days: 14,
  current_borrow_count: 1,
  is_borrowing_blocked: false,
  is_active: true,
  total_fines: 0,
  service_balance: 150000,
};

const ROOMS = [
  { id: 1, room_name: 'Phong hoc nhom 01', capacity: 6, room_type: 'STUDY', floor: '1', is_active: true },
  { id: 2, room_name: 'Phong hoc nhom 02', capacity: 8, room_type: 'STUDY', floor: '2', is_active: true },
  { id: 3, room_name: 'Phong hoc nhom 03', capacity: 10, room_type: 'STUDY', floor: '3', is_active: true },
  { id: 4, room_name: 'Phong hoc nhom 04', capacity: 12, room_type: 'STUDY', floor: '4', is_active: true },
];

const WALLET_TRANSACTIONS = [
  { id: 1, user_code: PROFILE.user_code, txn_type: 'TOPUP', amount: 200000, balance_before: 0, balance_after: 200000, description: 'Nap tien mau', created_at: '2026-10-10T08:30:00' },
  { id: 2, user_code: PROFILE.user_code, txn_type: 'BOOKING_PAYMENT', amount: -50000, balance_before: 200000, balance_after: 150000, description: 'Thanh toan dat phong', created_at: '2026-10-12T14:00:00' },
];

const DEMO_LOANS = [
  {
    id: 1,
    loan_code: 'PM-2026-0098',
    user_code: PROFILE.user_code,
    book_id: 1,
    book_title: 'Lap trinh Web hien dai voi React 19',
    copy_barcode: 'BC-2026-00101',
    loan_type: 'PHYSICAL',
    loan_status: 'BORROWED',
    borrow_date: '2026-10-01T09:00:00Z',
    due_date: '2026-10-15T17:00:00Z',
    return_date: null,
    renewal_count: 0,
  },
];

const categories = () => [
  { id: 1, category_name: 'Cong nghe thong tin' },
  { id: 2, category_name: 'Giao trinh DH' },
  { id: 3, category_name: 'Khoa hoc Cong nghe' },
  { id: 4, category_name: 'Kinh te va Quan tri' },
  { id: 5, category_name: 'Ngoai ngu' },
];

export const handlers = [
  http.post('*/api/auth/login', async ({ request }) => {
    const { username = '', password = '' } = await request.json();
    if (password === 'WrongPassword@999' || password === 'wrong_password') {
      return HttpResponse.json({ detail: 'Sai tên đăng nhập hoặc mật khẩu' }, { status: 401 });
    }
    const isAdmin = /admin|thuthu/i.test(username);
    return HttpResponse.json({
      access_token: 'mock-jwt-demo-token',
      token_type: 'bearer',
      user: { id: isAdmin ? 101 : 1, username, role: isAdmin ? 'ADMIN' : 'STUDENT' },
    });
  }),
  http.get('*/api/auth/me', () => HttpResponse.json({ id: 1, username: PROFILE.username, role: 'STUDENT' })),
  http.get('*/api/auth/test', () => HttpResponse.json({ message: 'Auth router is working' })),
  http.get('*/api/users/me', () => HttpResponse.json(PROFILE)),
  http.get('*/api/users/me/dashboard', () => HttpResponse.json({
    total_borrowing: DEMO_LOANS.filter(l => l.loan_status === 'BORROWED').length,
    total_overdue: 0,
    total_fines: PROFILE.total_fines,
    service_balance: PROFILE.service_balance,
    current_loans: DEMO_LOANS.filter(l => l.loan_status === 'BORROWED'),
    recent_history: [],
  })),
  http.get('*/api/books/search', ({ request }) => {
    const url = new URL(request.url);
    const query = (url.searchParams.get('q') || '').toLowerCase();
    const subject = url.searchParams.get('subject_code');
    const categoryId = url.searchParams.get('category_id');
    const author = (url.searchParams.get('author') || '').toLowerCase();
    const publisher = (url.searchParams.get('publisher') || '').toLowerCase();
    const keyword = (url.searchParams.get('keyword') || '').toLowerCase();
    const bookType = url.searchParams.get('book_type');
    const publicationYear = url.searchParams.get('publication_year');
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('page_size') || 10)));
    const filtered = API_BOOKS.filter((book) =>
      (!query || (book.title + book.author + book.publisher + book.keywords).toLowerCase().includes(query)) &&
      (!subject || book.subject_code === subject) &&
      (!categoryId || book.category_id === Number(categoryId)) &&
      (!author || book.author.toLowerCase().includes(author)) &&
      (!publisher || book.publisher.toLowerCase().includes(publisher)) &&
      (!keyword || book.keywords.toLowerCase().includes(keyword)) &&
      (!bookType || book.book_type === bookType) &&
      (!publicationYear || book.publication_year === Number(publicationYear))
    );
    const items = filtered.slice((page - 1) * pageSize, page * pageSize);
    return HttpResponse.json({ items, total: filtered.length, page, page_size: pageSize, total_pages: Math.ceil(filtered.length / pageSize) });
  }),
  http.get('*/api/books/categories', () => HttpResponse.json(categories())),
  http.get('*/api/admin/categories', () => HttpResponse.json(categories())),
  http.get('*/api/books/:id', ({ params }) => {
    const rawId = String(params.id);
    const numId = rawId.replace(/^b/i, '');
    const book = API_BOOKS.find((item) => String(item.id) === rawId || String(item.id) === numId);
    return book ? HttpResponse.json(book) : HttpResponse.json({ detail: 'Khong tim thay sach' }, { status: 404 });
  }),
  http.get('*/api/admin/books/:id/copies', ({ params }) => {
    const book = API_BOOKS.find((item) => String(item.id) === String(params.id));
    return HttpResponse.json(book ? [{ copy_barcode: book.barcode, book_id: book.id, status: 'AVAILABLE', zone: 'A', floor: '1', shelf: '101' }] : []);
  }),
  http.post('*/api/loans/physical/request', async ({ request }) => {
    const body = await request.json();
    const book = API_BOOKS.find(b => b.id === Number(body.book_id));
    if (!book) return HttpResponse.json({ detail: 'Khong tim thay sach', error_code: 'NOT_FOUND' }, { status: 404 });
    if (book.available_stock <= 0) return HttpResponse.json({ detail: 'Sach da het ban sao', error_code: 'OUT_OF_STOCK' }, { status: 409 });
    const now = new Date();
    const due = new Date(now.getTime() + 14 * 86400 * 1000);
    return HttpResponse.json({ id: Date.now(), loan_code: 'PM-2026-' + Math.floor(1000 + Math.random() * 9000), book_id: book.id, book_title: book.title, loan_type: 'PHYSICAL', loan_status: 'PENDING_PICKUP', borrow_date: now.toISOString(), due_date: due.toISOString(), pickup_deadline: new Date(now.getTime() + 86400000).toISOString() }, { status: 201 });
  }),
  http.get('*/api/loans/my-loans', () => {
    const rows = DEMO_LOANS.filter((l) => ['BORROWED', 'PENDING_PICKUP', 'OVERDUE', 'REQUESTED'].includes(l.loan_status));
    return HttpResponse.json({ data: rows, items: rows, total: rows.length });
  }),
  http.get('*/api/loans/my-history', () => {
    const rows = DEMO_LOANS.filter((l) => !['BORROWED', 'PENDING_PICKUP', 'OVERDUE', 'REQUESTED'].includes(l.loan_status));
    return HttpResponse.json({ data: rows, items: rows, total: rows.length });
  }),
  http.post('*/api/loans/:loanId/renew', ({ params }) => {
    const loan = DEMO_LOANS.find((item) => String(item.id) === String(params.loanId));
    if (!loan) return HttpResponse.json({ detail: 'Không tìm thấy phiếu mượn' }, { status: 404 });
    const due = new Date(Date.now() + 17 * 86400000).toISOString();
    return HttpResponse.json({ ...loan, due_date: due, renewal_count: Number(loan.renewal_count || 0) + 1, loan_status: 'BORROWED' });
  }),
  http.post('*/api/loans/:loanId/return', ({ params }) => HttpResponse.json({ message: 'Tra sach thanh cong', loan_id: Number(params.loanId) })),
  http.get('*/api/waitlists/my-waitlists', () => HttpResponse.json({ items: [], total: 0 })),
  http.post('*/api/waitlists', async ({ request }) => {
    const { book_id } = await request.json();
    return HttpResponse.json({ id: Date.now(), book_id, user_code: PROFILE.user_code, queue_position: 1, status: 'WAITING', created_at: new Date().toISOString() }, { status: 201 });
  }),
  http.delete('*/api/waitlists/:waitlistId', () => HttpResponse.json({ message: 'Da huy dat truoc' })),
  http.get('*/api/rooms', () => HttpResponse.json(ROOMS)),
  http.get('*/api/rooms/:roomId/availability', ({ params, request }) => {
    const room = ROOMS.find((item) => String(item.id) === String(params.roomId));
    if (!room) return HttpResponse.json({ detail: 'Khong tim thay phong' }, { status: 404 });
    const date = new URL(request.url).searchParams.get('date') || new Date().toISOString().slice(0, 10);
    return HttpResponse.json({ room_id: room.id, booking_date: date, slots: ['08:00','10:00','12:00','14:00','16:00'].map((slot) => ({ slot_start: slot, slot_end: String(Number(slot.slice(0,2))+2).padStart(2,'0')+':00', available: true })) });
  }),
  http.get('*/api/wallet', () => HttpResponse.json({ user_code: PROFILE.user_code, service_balance: PROFILE.service_balance, currency: 'VND' })),
  http.get('*/api/wallet/balance', () => HttpResponse.json({ user_code: PROFILE.user_code, service_balance: PROFILE.service_balance, currency: 'VND' })),
  http.get('*/api/wallet/transactions', ({ request }) => {
    const url = new URL(request.url);
    const skip = Number(url.searchParams.get('skip') || 0);
    const limit = Number(url.searchParams.get('limit') || 20);
    return HttpResponse.json({ total: WALLET_TRANSACTIONS.length, skip, limit, data: WALLET_TRANSACTIONS.slice(skip, skip + limit) });
  }),
  http.get('*/api/wallet/transactions/*', () => HttpResponse.json({ total: WALLET_TRANSACTIONS.length, data: WALLET_TRANSACTIONS })),
  http.get('*/api/admin/loans/lookup', ({ request }) => {
    const q = new URL(request.url).searchParams.get('q') || 'SV-DEMO-001';
    return HttpResponse.json({
      user_code: q,
      data: [
        {
          id: 101,
          loan_code: 'PM-2026-0101',
          user_code: q,
          book_id: 1,
          book_title: 'Lap trinh Web hien dai voi React 19',
          copy_barcode: 'DEMO-BC-001-01',
          loan_type: 'PHYSICAL',
          loan_status: 'PENDING_PICKUP',
          borrow_date: '2026-10-28T09:00:00Z',
          due_date: '2026-11-11T17:00:00Z',
        },
      ],
    });
  }),
  http.post('*/api/admin/loans/checkin', () => HttpResponse.json({ message: 'Da nhan tra sach thanh cong' })),
  http.post('*/api/admin/loans/checkout', () => HttpResponse.json({ message: 'Da xuat phieu muon thanh cong' })),
  http.get('*/api/admin/fines/lookup', ({ request }) => {
    const userCode = new URL(request.url).searchParams.get('user_code') || 'SV-DEMO-001';
    return HttpResponse.json({
      user_code: userCode,
      full_name: 'Nguyen Van Dat',
      total_fines: 50000,
      fines: [
        {
          fine_id: 1,
          loan_id: 101,
          overdue_days: 5,
          total_amount: 50000,
          created_at: '2026-10-25T08:00:00Z',
        },
      ],
    });
  }),
  http.post('*/api/admin/fines/collect', () => HttpResponse.json({ message: 'Da thu du tien phat' })),
];
