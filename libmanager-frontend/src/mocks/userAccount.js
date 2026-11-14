import { http, HttpResponse } from 'msw';

// Mock MSW cho 3-13 (Đặt trước) và 4-13 (Tài khoản dịch vụ) — chỉ chạy khi VITE_USE_MOCK=true.
// Đăng ký trước `handlers` (mocks/browser.js) nên các route trùng ở đây được ưu tiên.
// Hợp đồng theo backend thật: wallet_router.py, webhook_router.py, fine_wallet_router.py, waitlist_router.py.

const USER_CODE = 'SV-DEMO-001';
const iso = (date) => date.toISOString().replace('Z', ''); // backend trả giờ UTC không kèm múi giờ
const state = {
  balance: 150_000,
  fines: [{ fine_id: 9001, loan_id: 3, overdue_days: 5, fine_rate: 5000, total_amount: 25_000, created_at: '2026-11-01T02:00:00' }],
  txns: [
    { id: 2, txn_type: 'BOOKING_PAYMENT', amount: -50_000, balance_before: 200_000, balance_after: 150_000, description: 'Thanh toán đặt phòng', created_at: '2026-10-12T07:00:00' },
    { id: 1, txn_type: 'TOPUP', amount: 200_000, balance_before: 0, balance_after: 200_000, description: 'Nạp tiền mẫu', created_at: '2026-10-10T01:30:00' },
  ],
  topups: new Map(),
  waitlists: [
    { id: 501, book_id: 'b4', queue_position: 2, queue_size: 4, status: 'WAITING', hold_expires_at: null, created_at: '2026-11-10T03:00:00' },
  ],
  nextId: 1000,
};

const totalFines = () => state.fines.reduce((sum, fine) => sum + fine.total_amount, 0);
const addTxn = (txn_type, amount, description) => {
  const before = state.balance;
  state.balance += amount;
  state.txns.unshift({ id: ++state.nextId, txn_type, amount, balance_before: before, balance_after: state.balance, description, created_at: iso(new Date()) });
};
const error = (status, message) => HttpResponse.json({ error_code: `HTTP_${status}`, message, detail: message }, { status });
const topupView = (t) => ({
  pay_code: t.pay_code, amount: t.amount, status: t.status, expired_at: t.expired_at, created_at: t.created_at,
  // Ảnh QR minh họa (SVG nội tuyến) để chạy mock không cần mạng.
  qr_url: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' fill='#fff'/><rect x='10' y='10' width='30' height='30' fill='#111'/><rect x='80' y='10' width='30' height='30' fill='#111'/><rect x='10' y='80' width='30' height='30' fill='#111'/><text x='60' y='66' font-size='9' text-anchor='middle' font-family='monospace'>${t.pay_code}</text></svg>`)}`,
  bank: { bin: '970422', account_no: 'VQRDEMO0001', account_name: 'THU VIEN DEMO', content: t.pay_code },
});

export const userAccountHandlers = [
  http.get('*/api/wallet', () => HttpResponse.json({ user_code: USER_CODE, balance: state.balance, service_balance: state.balance, currency: 'VND' })),
  http.get('*/api/wallet/transactions', ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const size = Math.max(1, Number(url.searchParams.get('size') || 20));
    return HttpResponse.json({ data: state.txns.slice((page - 1) * size, page * size), total: state.txns.length, page, size });
  }),
  http.post('*/api/wallet/topups', async ({ request }) => {
    const { amount } = await request.json();
    if (!(amount >= 10_000 && amount <= 500_000)) return error(422, 'Số tiền nạp phải từ 10,000 đến 500,000 VNĐ');
    const now = new Date();
    const topup = { pay_code: `TV${String(++state.nextId).padStart(8, '0')}`, amount, status: 'PENDING', created_at: iso(now), expired_at: iso(new Date(now.getTime() + 15 * 60_000)) };
    state.topups.set(topup.pay_code, topup);
    return HttpResponse.json(topupView(topup), { status: 201 });
  }),
  http.get('*/api/wallet/topups/:payCode', ({ params }) => {
    const topup = state.topups.get(params.payCode);
    if (!topup) return error(404, 'Không tìm thấy yêu cầu nạp tiền');
    if (topup.status === 'PENDING' && new Date(`${topup.expired_at}Z`) <= new Date()) topup.status = 'EXPIRED';
    return HttpResponse.json(topupView(topup));
  }),
  http.post('*/api/dev/topups/:payCode/simulate', ({ params }) => {
    const topup = state.topups.get(params.payCode);
    if (!topup) return error(404, 'Không tìm thấy yêu cầu nạp tiền');
    if (topup.status !== 'PENDING') return HttpResponse.json({ success: true, result: 'IGNORED' });
    topup.status = 'PAID';
    addTxn('TOPUP', topup.amount, `Nạp tiền ${topup.pay_code}`);
    return HttpResponse.json({ success: true, result: 'MATCHED', pay_code: topup.pay_code, amount: topup.amount, balance_after: state.balance });
  }),
  http.get('*/api/fines/my-fines', () => HttpResponse.json({
    user_code: USER_CODE, total_fines: totalFines(), is_borrowing_blocked: totalFines() > 0, unpaid_count: state.fines.length, fines: state.fines,
  })),
  http.post('*/api/fines/pay-by-wallet', () => {
    const due = totalFines();
    if (due <= 0) return error(409, 'Không còn khoản phạt chưa thanh toán');
    if (state.balance < due) return error(402, 'Yêu cầu không thể thực hiện'); // backend thật cũng mất số tiền thiếu
    addTxn('FINE_PAYMENT', -due, 'Thanh toán toàn bộ tiền phạt');
    state.fines = [];
    return HttpResponse.json({ payment_id: ++state.nextId, amount_paid: due, balance_after: state.balance, total_fines: 0, is_borrowing_blocked: false });
  }),
  http.get('*/api/waitlists/my-waitlists', () => HttpResponse.json({ data: state.waitlists, total: state.waitlists.length })),
  http.post('*/api/waitlists', async ({ request }) => {
    const { book_id } = await request.json();
    if (state.waitlists.some((w) => String(w.book_id) === String(book_id))) return error(409, 'Bạn đã đặt trước sách này');
    const entry = { id: ++state.nextId, book_id, user_code: USER_CODE, queue_position: 1, queue_size: 1, status: 'WAITING', hold_expires_at: null, created_at: iso(new Date()) };
    state.waitlists.push(entry);
    return HttpResponse.json(entry, { status: 201 });
  }),
  http.delete('*/api/waitlists/:waitlistId', ({ params }) => {
    const before = state.waitlists.length;
    state.waitlists = state.waitlists.filter((w) => String(w.id) !== String(params.waitlistId));
    return before === state.waitlists.length ? error(404, 'Mục đặt trước không còn hiệu lực') : HttpResponse.json({ message: 'Đã hủy đặt trước' });
  }),
];
