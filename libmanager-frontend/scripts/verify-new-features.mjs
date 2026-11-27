import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Chỉ dùng cho kiểm tra Node: các module Vite của dự án bỏ đuôi .js.
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !specifier.endsWith('.js')) return nextResolve(`${specifier}.js`, context);
    throw error;
  }
} });

const storage = new Map();
globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
// Token và user lưu localStorage (2B-13); dùng chung kho giả với sessionStorage.
Object.defineProperty(globalThis, 'localStorage', { value: globalThis.sessionStorage, configurable: true });
const RealDate = Date;
let clock = RealDate.parse('2026-10-13T08:00:00+07:00');
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [clock])); }
  static now() { return clock; }
};

const rooms = await import('../src/mocks/roomBookings.js');
const ebooks = await import('../src/mocks/ebooks.js');
const loans = await import('../src/mocks/loans.js');
const { accessDeadline, previewLimit, isForbidden, libraryTimestamp } = await import('../src/utils/ebookAccess.js');
const { libraryToday } = await import('../src/utils/libraryDate.js');
const { getDocument } = await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs');
let checks = 0;
const check = async (label, run) => { await run(); checks++; console.log(`PASS ${label}`); };
try {
  await check('Đặt thành công trừ đúng số dư; đặt lặp không trừ thêm', () => {
    const booking = rooms.createRoomBooking({ roomId: 'room-01', date: '2026-10-14', slotId: '8' });
    assert.equal(rooms.getRoomSnapshot('2026-10-14').balance, 30000);
    assert.throws(() => rooms.createRoomBooking({ roomId: 'room-01', date: '2026-10-14', slotId: '8' }), { code: 'SLOT_UNAVAILABLE' });
    assert.equal(rooms.getRoomSnapshot('2026-10-14').balance, 30000);
    assert.throws(() => rooms.createRoomBooking({ roomId: 'room-02', date: '2026-10-14', slotId: '16' }), { code: 'DAILY_LIMIT' });
    rooms.cancelRoomBooking(booking.id);
    assert.equal(rooms.getRoomSnapshot('2026-10-14').balance, 50000);
    assert.throws(() => rooms.cancelRoomBooking(booking.id), { code: 'NOT_CANCELLABLE' });
    assert.equal(rooms.getRoomSnapshot('2026-10-14').balance, 50000);
  });
  await check('Thiếu số dư không tạo lượt đặt; nạp thử rồi đặt được', () => {
    assert.throws(() => rooms.createRoomBooking({ roomId: 'room-03', date: '2026-10-14', slotId: '16' }), { code: 'INSUFFICIENT_BALANCE' });
    assert.equal(rooms.getRoomSnapshot('2026-10-14').bookings.filter((item) => item.status === 'CONFIRMED').length, 0);
    rooms.topUpDemoWallet(50000);
    rooms.createRoomBooking({ roomId: 'room-03', date: '2026-10-14', slotId: '16' });
    assert.equal(rooms.getRoomSnapshot('2026-10-14').balance, 40000);
  });
  await check('Hủy đúng ranh giới 1 giờ; hủy muộn bị từ chối', () => {
    const booking = rooms.createRoomBooking({ roomId: 'room-01', date: '2026-10-15', slotId: '8' });
    clock = RealDate.parse('2026-10-15T07:00:01+07:00');
    assert.throws(() => rooms.cancelRoomBooking(booking.id), { code: 'CANCELLATION_CUTOFF' });
    clock = RealDate.parse('2026-10-15T07:00:00+07:00');
    rooms.cancelRoomBooking(booking.id);
  });
  await check('Ngày sai, ngày quá khứ và khung giờ hết chỗ bị từ chối', () => {
    clock = RealDate.parse('2026-10-13T08:00:00+07:00');
    for (const date of ['2026-10-12', '2026-02-31', 'invalid']) assert.throws(() => rooms.createRoomBooking({ roomId: 'room-01', date, slotId: '8' }), { code: 'INVALID_DATE' });
    assert.throws(() => rooms.createRoomBooking({ roomId: 'room-01', date: '2026-10-14', slotId: '10' }), { code: 'SLOT_UNAVAILABLE' });
    assert.equal(libraryToday(new RealDate('2026-10-12T18:00:00Z')), '2026-10-13');
  });
  await check('Số dư mock được tách theo người dùng', () => {
    const balance = rooms.getRoomSnapshot('2026-10-14').balance;
    sessionStorage.setItem('libmanager_user', JSON.stringify({ id: 'another-user' }));
    assert.equal(rooms.getRoomSnapshot('2026-10-14').balance, 50000);
    sessionStorage.removeItem('libmanager_user');
    assert.equal(rooms.getRoomSnapshot('2026-10-14').balance, balance);
  });
  await check('PDF xem trước thật sự chỉ có 5 trang, không chỉ khóa nút', async () => {
    const preview = ebooks.getMockPreview('b1');
    const task = getDocument({ data: preview.file.data });
    const pdf = await task.promise;
    assert.equal(pdf.numPages, 5);
    await assert.rejects(pdf.getPage(6));
    await task.destroy();
  });
  await check('Mượn eBook trả phiên 12 trang và không thay đổi tồn kho; mượn lặp trả phiếu cũ', async () => {
    const copies = loans.getStoredBooks().find((book) => book.id === 'b1').availableCopies;
    const loan = ebooks.borrowMockEbook('b1');
    assert.equal(ebooks.borrowMockEbook('b1').id, loan.id);
    assert.equal(loans.getStoredBooks().find((book) => book.id === 'b1').availableCopies, copies);
    const session = ebooks.getMockLoanSession(loan.id);
    assert.equal(session.access, 'borrowed');
    const task = getDocument({ data: session.file.data });
    assert.equal((await task.promise).numPages, 12);
    await task.destroy();
    loans.returnBookAction(loan.id);
    assert.equal(ebooks.getMockLoanSession(loan.id).access, 'locked');
    assert.equal(loans.getStoredBooks().find((book) => book.id === 'b1').availableCopies, copies);
  });
  await check('Hết hạn khóa phiên và mượn lại được; mã phiếu sai không mở sách khác', () => {
    const loan = ebooks.borrowMockEbook('b1');
    clock = new RealDate(loan.expiresAt).getTime();
    assert.equal(ebooks.getMockLoanSession(loan.id).access, 'locked');
    assert.notEqual(ebooks.borrowMockEbook('b1').id, loan.id);
    assert.throws(() => ebooks.getMockLoanSession('not-a-loan'), { status: 404 });
  });
  await check('Quyền đọc thiếu token hoặc hạn sai bị khóa; phát hiện 403', () => {
    assert.equal(accessDeadline({ access: 'borrowed', expiresAt: 'bad', readToken: 'demo' }), 0);
    assert.equal(accessDeadline({ access: 'borrowed', expiresAt: '2026-10-27T09:00:00+07:00' }), 0);
    assert.equal(accessDeadline({ access: 'borrowed', readToken: 'demo', expiresAt: '2026-10-27T09:00:00+07:00', loanExpiresAt: '2026-10-26T09:00:00+07:00' }), RealDate.parse('2026-10-26T09:00:00+07:00'));
    assert.equal(isForbidden({ status: 403 }), true);
    assert.equal(isForbidden({ response: { status: 401 } }), true);
    assert.equal(previewLimit(3), 5); assert.equal(previewLimit(20), 10);
    // ebook_service lưu due_date dạng UTC không timezone (đã đối chiếu với API thật)
    assert.equal(libraryTimestamp('2026-10-27T09:00:00'), '2026-10-27T09:00:00Z');
    assert.equal(libraryTimestamp('2026-11-08T04:12:41.528270'), '2026-11-08T04:12:41.528270Z');
    assert.equal(libraryTimestamp('2026-10-27T09:00:00Z'), '2026-10-27T09:00:00Z');
  });
  const roomUi = await import('../src/utils/roomBooking.js');
  await check('3-18.b: hiển thị đủ 5 trạng thái, hạn check-in 15 phút và mốc hủy 1 giờ', () => {
    clock = RealDate.parse('2026-10-20T07:00:00+07:00');
    const at = (status, date = '2026-10-20', start = '10:00', end = '12:00') => roomUi.describeBooking({ status, date, start, end }, clock);
    assert.equal(at('CONFIRMED').cancellable, true);
    assert.equal(at('CONFIRMED', '2026-10-20', '08:00', '10:00').cancellable, true); // đúng 1 giờ: vẫn được hủy
    clock = RealDate.parse('2026-10-20T07:30:00+07:00');
    assert.equal(at('CONFIRMED', '2026-10-20', '08:00', '10:00').cancellable, undefined);
    assert.match(at('CONFIRMED', '2026-10-20', '08:00', '10:00').note, /dưới 1 giờ/);
    clock = RealDate.parse('2026-10-20T10:10:00+07:00');
    assert.equal(at('CONFIRMED').label, 'Chờ check-in');
    clock = RealDate.parse('2026-10-20T10:16:00+07:00');
    assert.equal(at('CONFIRMED').label, 'Quá hạn check-in');
    assert.deepEqual(['CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map((s) => at(s).label), ['Đang sử dụng', 'Đã hoàn thành', 'Đã hủy', 'Không đến']);
    assert.match(at('NO_SHOW').note, /không được hoàn tiền/);
  });
  await check('3-18.b: lỗi API 402/403/409/400 đổi đúng mã và thông báo số tiền thiếu', () => {
    const err = (status, detail) => ({ response: { status, data: { detail } } });
    const short = roomUi.mapRoomApiError(err(402, { message: 'Số dư không đủ', shortfall: 20000 }));
    assert.equal(short.code, 'INSUFFICIENT_BALANCE'); assert.match(short.message, /20\.000/);
    assert.equal(roomUi.mapRoomApiError(err(403, 'Tài khoản bị khóa')).code, 'ACCOUNT_LOCKED');
    assert.equal(roomUi.mapRoomApiError(err(409, 'Mỗi ngày chỉ một lượt')).code, 'DAILY_LIMIT');
    assert.equal(roomUi.mapRoomApiError(err(409, 'Khung giờ đã có người đặt')).code, 'SLOT_UNAVAILABLE');
    assert.equal(roomUi.mapRoomApiError(err(400, 'Quá hạn hủy'), 'cancel').code, 'CANCELLATION_CUTOFF');
    assert.equal(roomUi.mapRoomApiError({}).code, 'NETWORK');
  });
  await check('3-18.b: dữ liệu API (dạng mock MSW) ghép đúng snapshot; thiếu giá không lỗi', () => {
    clock = RealDate.parse('2026-10-20T09:00:00+07:00');
    const snap = roomUi.toRoomSnapshot({ date: '2026-10-20', now: clock,
      rooms: [{ id: 1, room_name: 'Phong 01', capacity: 6, floor: '1', is_active: true }, { id: 2, room_name: 'Đóng cửa', capacity: 4, is_active: false }],
      availability: { 1: { slots: [{ slot_start: '08:00:00', slot_end: '10:00:00', available: true }, { slot_start: '10:00', slot_end: '12:00', available: false }, { slot_start: '12:00', slot_end: '14:00', available: true }] } },
      bookings: [{ id: 7, room_id: 1, booking_date: '2026-10-21', slot_start: '12:00:00', slot_end: '14:00:00', status: 'CONFIRMED' }],
      wallet: { service_balance: '50000.00' } });
    assert.equal(snap.balance, 50000);
    assert.equal(snap.rooms.length, 1);
    assert.deepEqual(snap.rooms[0].slots.map((s) => s.reason), ['Đã qua', 'Đã đặt', 'Còn trống']);
    assert.equal(snap.rooms[0].slotPrice, null);
    assert.equal(roomUi.formatPrice(null), 'Phí theo quy định');
    assert.deepEqual({ ...snap.bookings[0] }, { id: 7, roomId: 1, roomName: 'Phong 01', date: '2026-10-21', slotId: '12:00', start: '12:00', end: '14:00', price: null, status: 'CONFIRMED', attendees: null });
  });
  await check('3-18.b API thật: giá price_per_slot, lượt đặt lấy giá theo phòng, lỗi 402 dạng chữ có số tiền thiếu', () => {
    clock = RealDate.parse('2026-11-26T09:00:00+07:00');
    const snap = roomUi.toRoomSnapshot({ date: '2026-11-27', now: clock,
      rooms: [{ id: 1, room_name: 'Phòng học nhóm 01', capacity: 6, price_per_slot: 20000, floor: '1', is_active: true }],
      availability: { 1: { room: { id: 1 }, date: '2026-11-27', slots: [{ slot_start: '07:00:00', slot_end: '09:00:00', is_booked: false, is_past: false, available: true }] } },
      bookings: [{ id: 9, room_id: 1, booking_date: '2026-11-27', attendee_count: 3, slot_start: '07:00:00', slot_end: '09:00:00', status: 'CONFIRMED' }],
      wallet: { user_code: 'SV-DEMO-009', balance: 50000, currency: 'VND' } });
    assert.equal(snap.balance, 50000);
    assert.equal(snap.rooms[0].slotPrice, 20000);
    assert.deepEqual(snap.rooms[0].slots.map((x) => [x.start, x.end, x.reason]), [['07:00', '09:00', 'Còn trống']]);
    assert.equal(snap.bookings[0].price, 20000); assert.equal(snap.bookings[0].attendees, 3);
    const err = (status, detail) => ({ response: { status, data: { detail } } });
    const short = roomUi.mapRoomApiError(err(402, 'Số dư tài khoản dịch vụ không đủ để đặt phòng, cần nạp thêm 15,000đ'));
    assert.equal(short.code, 'INSUFFICIENT_BALANCE'); assert.match(short.message, /thiếu 15\.000/);
    assert.equal(roomUi.mapRoomApiError(err(409, 'Mỗi người chỉ được một lượt đặt còn hiệu lực trong ngày')).code, 'DAILY_LIMIT');
  });
  await check('3-18.b mock: khóa tài khoản kiểm tra trước; số tiền thiếu định dạng VNĐ; có lịch sử mẫu', () => {
    clock = RealDate.parse('2026-10-13T08:00:00+07:00');
    sessionStorage.setItem('libmanager_user', JSON.stringify({ id: 'locked-user', is_locked: true }));
    assert.throws(() => rooms.createRoomBooking({ roomId: 'room-01', date: '2026-10-14', slotId: '10' }), { code: 'ACCOUNT_LOCKED' });
    sessionStorage.setItem('libmanager_user', JSON.stringify({ id: 'poor-user' }));
    assert.throws(() => rooms.createRoomBooking({ roomId: 'room-03', date: '2026-10-14', slotId: '16' }), (e) => e.code === 'INSUFFICIENT_BALANCE' && /10\.000/.test(e.message));
    assert.deepEqual(rooms.getRoomSnapshot('2026-10-14').bookings.map((b) => b.status).sort(), ['COMPLETED', 'NO_SHOW']);
    sessionStorage.removeItem('libmanager_user');
  });
  const redirect = await import('../src/utils/loginRedirect.js');
  await check('2B-13: quay lại trang cũ sau đăng nhập, điều hướng theo vai trò, chặn open redirect', () => {
    assert.equal(redirect.loginPathFor({ pathname: '/books/b1', search: '' }), '/login?redirect=%2Fbooks%2Fb1');
    assert.equal(redirect.landingPathFor({ role: 'user' }, '/books/b1'), '/books/b1');
    assert.equal(redirect.landingPathFor({ role: 'user' }, null), '/');
    assert.equal(redirect.landingPathFor({ role: 'user' }, '/admin/users'), '/');
    assert.equal(redirect.landingPathFor({ role: 'admin' }, '/books/b1'), '/admin/catalog'); // Vân bỏ Dashboard (d5e5b49)
    assert.equal(redirect.landingPathFor({ role: 'admin' }, '/admin/loans'), '/admin/loans');
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', '/login?redirect=/']) assert.equal(redirect.safeRedirect(bad), null);
  });
  const borrowErr = await import('../src/utils/borrowErrors.js');
  await check('3-12.a: lỗi 403/409 của API đổi đúng lý do; hết sách gợi ý Hẹn đặt trước', () => {
    const err = (status, detail) => borrowErr.apiError(status, detail);
    assert.equal(borrowErr.mapBorrowError(err(403, 'Tài khoản bị khóa hoặc còn nợ phạt')).code, 'BLOCKED');
    assert.equal(borrowErr.mapBorrowError(err(409, 'Đã đạt hạn mức mượn sách')).code, 'LIMIT');
    assert.equal(borrowErr.mapBorrowError(err(409, 'Bạn đang có phiếu mượn sách này')).code, 'DUPLICATE');
    assert.equal(borrowErr.mapBorrowError(err(409, 'Bạn đã đặt trước sách này')).code, 'ALREADY_WAITLISTED');
    const out = borrowErr.mapBorrowError(err(409, 'Sách đã hết bản có thể mượn'));
    assert.equal(out.code, 'OUT_OF_STOCK'); assert.equal(out.offerWaitlist, true);
    assert.equal(borrowErr.mapBorrowError(new Error('offline')).code, 'NETWORK');
  });
  await check('3-12.b: đúng nguyên văn câu lỗi của POST /api/loans/physical/request (loan_service.py)', () => {
    const map = (status, detail) => borrowErr.mapBorrowError(borrowErr.apiError(status, detail));
    assert.equal(map(403, 'Tài khoản đang bị khóa mượn hoặc còn nợ phạt chưa thanh toán').code, 'BLOCKED');
    assert.equal(map(409, 'Bạn đang có phiếu mượn hoặc đang chờ nhận sách này').code, 'DUPLICATE');
    const limitOut = map(403, 'Đã đạt hạn mức mượn: đang mượn 3/tối đa 3 cuốn');
    assert.equal(limitOut.code, 'LIMIT'); assert.match(limitOut.message, /đang mượn 3\/tối đa 3/); // SRS UC05 E2
    assert.equal(map(409, 'Đã đạt hạn mức mượn đồng thời (3 phiếu)').code, 'LIMIT'); // API cũ
    assert.equal(map(409, 'Sách này không có bản vật lý để đặt mượn tại quầy').code, 'NO_PRINT');
    const out = map(409, 'Sách đã hết bản khả dụng, vui lòng Hẹn đặt trước');
    assert.equal(out.code, 'OUT_OF_STOCK'); assert.equal(out.offerWaitlist, true);
  });
  await check('4-14.a: lỗi Axios → Toast đỏ; nợ phạt và thiếu số dư kèm nút sang trang nạp tiền', () => {
    const fine = borrowErr.errorToast(borrowErr.apiError(403, 'Tài khoản đang bị khóa mượn hoặc còn nợ phạt chưa thanh toán'));
    assert.equal(fine.type, 'error'); assert.equal(fine.action.to, '/account?topup=1'); // 4-13: trả phạt bằng ví
    const limit = borrowErr.errorToast(borrowErr.apiError(403, 'Đã đạt hạn mức mượn: đang mượn 5/tối đa 5 cuốn'));
    assert.match(limit.message, /tối đa/); assert.equal(limit.action, undefined);
    const room = borrowErr.errorToast(Object.assign(new Error('Số dư không đủ. Bạn còn thiếu 20.000 ₫ để đặt phòng.'), { code: 'INSUFFICIENT_BALANCE' }));
    assert.match(room.message, /thiếu 20\.000/); assert.equal(room.action.label, 'Sang Nạp tiền');
    const offline = borrowErr.errorToast(Object.assign(new Error('Network Error'), { isAxiosError: true }));
    assert.match(offline.message, /Không kết nối/);
  });
  const wallet = await import('../src/utils/wallet.js');
  await check('4-13: số tiền nạp 10.000–500.000đ, đọc "50.000", đếm ngược 15 phút', () => {
    assert.equal(wallet.parseAmount('50.000'), 50000); assert.equal(wallet.parseAmount('1,000,000'), 1000000); assert.equal(wallet.parseAmount('abc'), null);
    assert.equal(wallet.validateTopUpAmount(10000), null); assert.equal(wallet.validateTopUpAmount(500000), null);
    assert.match(wallet.validateTopUpAmount(9999), /10\.000/); assert.match(wallet.validateTopUpAmount(500001), /500\.000/);
    assert.match(wallet.validateTopUpAmount(null), /nhập số tiền/);
    const t = wallet.toTopUp({ pay_code: 'TVABCD1234', amount: 50000, status: 'pending', created_at: '2026-10-13T01:00:00', expired_at: '2026-10-13T01:15:00', qr_url: 'https://img.vietqr.io/x.png', bank: { account_no: '123', content: 'TVABCD1234' } });
    assert.equal(t.status, 'PENDING'); assert.equal(t.content, 'TVABCD1234'); assert.equal(t.expiresAt, '2026-10-13T01:15:00Z');
    assert.equal(wallet.secondsLeft(t.expiresAt, Date.parse('2026-10-13T01:00:00Z')), 15 * 60);
    assert.equal(wallet.formatCountdown(wallet.secondsLeft(t.expiresAt, Date.parse('2026-10-13T01:14:01Z'))), '00:59');
    assert.equal(wallet.secondsLeft(t.expiresAt, Date.parse('2026-10-13T02:00:00Z')), 0);
    assert.equal(wallet.TOPUP_POLL_MS, 3000);
  });
  await check('4-13: lịch sử giao dịch đổi nhãn/dấu; trả phạt thiếu tiền hiện đúng số tiền thiếu', () => {
    const credit = wallet.toTxn({ id: 1, txn_type: 'TOPUP', amount: 50000, balance_after: 70000, created_at: '2026-10-13T01:00:00' });
    const debit = wallet.toTxn({ id: 2, txn_type: 'FINE_PAYMENT', amount: -25000 });
    assert.equal(credit.label, 'Nạp tiền'); assert.equal(credit.credit, true); assert.equal(debit.label, 'Trả phí phạt'); assert.equal(debit.credit, false);
    assert.deepEqual(wallet.finePaymentPlan(150000, 25000), { status: 'OK', due: 25000, balance: 150000, missing: 0 });
    assert.deepEqual(wallet.finePaymentPlan(5000, 25000), { status: 'INSUFFICIENT', due: 25000, balance: 5000, missing: 20000 });
    assert.equal(wallet.finePaymentPlan(0, '0.00').status, 'NO_DEBT');
    assert.equal(wallet.suggestedTopUp(20000), 20000); assert.equal(wallet.suggestedTopUp(1500), 10000); assert.equal(wallet.suggestedTopUp(21000), 30000);
  });
  const wl = await import('../src/utils/waitlist.js');
  await check('3-13: tab Đặt trước hiện vị trí x/y, giữ chỗ còn hạn, mục giữ chỗ lên đầu', () => {
    const waiting = wl.toWaitlistEntry({ id: 1, book_id: 7, queue_position: 2, queue_size: 5, status: 'WAITING' });
    assert.equal(wl.positionLabel(waiting), '2/5'); assert.equal(waiting.held, false);
    assert.equal(wl.positionLabel(wl.toWaitlistEntry({ id: 2, book_id: 8, queue_position: 3, status: 'WAITING' })), '3'); // API chưa trả tổng
    const held = wl.toWaitlistEntry({ id: 3, book_id: 9, queue_position: 1, status: 'held', hold_expires_at: '2026-10-13T10:00:00' });
    assert.equal(held.held, true); assert.equal(held.holdExpiresAt, '2026-10-13T10:00:00Z');
    assert.equal(wl.holdRemaining(held.holdExpiresAt, Date.parse('2026-10-13T04:48:00Z')), '5 giờ 12 phút');
    assert.equal(wl.holdRemaining(held.holdExpiresAt, Date.parse('2026-10-13T09:50:00Z')), '10 phút');
    assert.equal(wl.holdRemaining(held.holdExpiresAt, Date.parse('2026-10-13T11:00:00Z')), 'Đã hết hạn giữ');
    assert.deepEqual(wl.sortWaitlist([waiting, held]).map((e) => e.id), [3, 1]);
  });
  await check('3-12.a mock: chốt chặn nợ phạt -> hạn mức -> tồn; thành công tạo phiếu Chờ nhận hạn 24 giờ', () => {
    clock = RealDate.parse('2026-10-26T09:00:00+07:00');
    sessionStorage.removeItem('libmanager_user_loans'); sessionStorage.removeItem('libmanager_books_data'); sessionStorage.removeItem('libmanager_waitlists');
    const code = (fn) => { try { fn(); } catch (e) { return borrowErr.mapBorrowError(e).code; } return 'OK'; };
    assert.equal(code(() => loans.requestPhysicalLoan('b2', { role: 'user', total_fines: 5000 })), 'BLOCKED');
    const student = { role: 'user', apiRole: 'STUDENT' };
    const before = loans.getStoredBooks().find((b) => b.id === 'b3').availableCopies;
    const loan = loans.requestPhysicalLoan('b3', student);
    assert.equal(loan.status, 'Chờ nhận');
    assert.match(loan.loanCode, /^PM-2026-\d{4}$/);
    assert.equal(RealDate.parse(loan.pickupDeadline) - clock, 24 * 3600000);
    assert.equal(loans.getStoredBooks().find((b) => b.id === 'b3').availableCopies, before - 1);
    // Mock có sẵn 2 phiếu Đang mượn + 1 Chờ nhận = 3 = hạn mức sinh viên
    assert.equal(code(() => loans.requestPhysicalLoan('b5', student)), 'LIMIT');
    assert.equal(code(() => loans.requestPhysicalLoan('b5', { role: 'user', apiRole: 'LECTURER' })), 'OK');
    assert.equal(code(() => loans.requestPhysicalLoan('b4', { role: 'user', apiRole: 'LECTURER' })), 'OUT_OF_STOCK');
  });
  await check('3-12.a mock: Hẹn đặt trước chỉ khi hết sách, không đặt trùng', () => {
    const lecturer = { role: 'user', apiRole: 'LECTURER' };
    const code = (fn) => { try { fn(); } catch (e) { return borrowErr.mapBorrowError(e).code; } return 'OK'; };
    assert.equal(code(() => loans.joinWaitlist('b6', lecturer)), 'STILL_AVAILABLE');
    assert.equal(loans.joinWaitlist('b4', lecturer).status, 'WAITING');
    assert.equal(code(() => loans.joinWaitlist('b4', lecturer)), 'ALREADY_WAITLISTED');
    assert.equal(loans.borrowDaysFor(lecturer), 30); assert.equal(loans.borrowDaysFor({ apiRole: 'STUDENT' }), 14);
  });
  console.log(`${checks} kiểm tra nghiệp vụ đạt.`);
} finally { globalThis.Date = RealDate; }
