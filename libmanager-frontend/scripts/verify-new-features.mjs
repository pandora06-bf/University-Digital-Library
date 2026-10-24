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
    assert.equal(libraryTimestamp('2026-10-27T09:00:00'), '2026-10-27T09:00:00+07:00');
    assert.equal(libraryTimestamp('2026-10-27T09:00:00Z'), '2026-10-27T09:00:00Z');
  });
  console.log(`${checks} kiểm tra nghiệp vụ đạt.`);
} finally { globalThis.Date = RealDate; }
