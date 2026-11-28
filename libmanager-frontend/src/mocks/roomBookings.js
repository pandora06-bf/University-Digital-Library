import { getCurrentUser } from './auth';
import { libraryToday, slotTimestamp, formatMoney } from '../utils/libraryDate';

export const ROOMS = [
  { id: 'room-01', name: 'Phòng học nhóm A201', floor: 'Tầng 2 · Khu A', capacity: 4, slotPrice: 20000, amenities: ['Bảng viết', 'Wi-Fi', 'Ổ cắm'] },
  { id: 'room-02', name: 'Phòng thảo luận A202', floor: 'Tầng 2 · Khu A', capacity: 8, slotPrice: 40000, amenities: ['Màn hình', 'Bảng viết', 'Wi-Fi'] },
  { id: 'room-03', name: 'Phòng nghiên cứu B301', floor: 'Tầng 3 · Khu B', capacity: 12, slotPrice: 60000, amenities: ['Máy chiếu', 'Bảng viết', 'Wi-Fi'] },
];
export const ROOM_SLOTS = Array.from({ length: 5 }, (_, i) => ({
  id: `${8 + i * 2}`, start: `${String(8 + i * 2).padStart(2, '0')}:00`, end: `${String(10 + i * 2).padStart(2, '0')}:00`,
}));

// Lịch sử mẫu để giao diện thể hiện trạng thái do thủ thư/JOB-06 cập nhật (2B-27).
function sampleHistory() {
  const daysAgo = (n) => libraryToday(new Date(Date.now() - n * 86400000));
  const past = (n, room, slot, status) => ({ id: `sample-${status.toLowerCase()}`, roomId: room.id, roomName: room.name,
    date: daysAgo(n), slotId: slot.id, start: slot.start, end: slot.end, price: room.slotPrice, status, createdAt: daysAgo(n + 1) });
  return [past(2, ROOMS[0], ROOM_SLOTS[1], 'COMPLETED'), past(5, ROOMS[1], ROOM_SLOTS[3], 'NO_SHOW')];
}

function storageKey() {
  return `libmanager_rooms_v1_${getCurrentUser()?.id ?? 'guest'}`;
}
function readState() {
  const raw = sessionStorage.getItem(storageKey());
  if (raw) return JSON.parse(raw);
  return { balance: 50000, bookings: sampleHistory() };
}
function saveState(state) {
  // Số dư và lượt đặt ghi cùng một lần; không có bước trừ tiền riêng.
  sessionStorage.setItem(storageKey(), JSON.stringify(state));
}
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };

export function getRoomSnapshot(date) {
  const state = readState();
  return {
    balance: state.balance,
    bookings: state.bookings,
    rooms: ROOMS.map((room, index) => ({ ...room, slots: ROOM_SLOTS.map((slot) => {
      const elapsed = slotTimestamp(date, slot.start) <= Date.now();
      // Một số lượt đặt của độc giả khác để thể hiện trạng thái hết chỗ (2B-27).
      const occupied = Number(slot.id) === 10 + index * 2;
      const reserved = state.bookings.some((booking) => booking.roomId === room.id && booking.date === date && booking.slotId === slot.id && booking.status === 'CONFIRMED');
      return { ...slot, available: !elapsed && !occupied && !reserved, reason: elapsed ? 'Đã qua' : occupied || reserved ? 'Đã đặt' : 'Còn trống' };
    }) })),
  };
}

export function createRoomBooking({ roomId, date, slotId }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < libraryToday() || !Number.isFinite(slotTimestamp(date, '00:00')) || libraryToday(new Date(slotTimestamp(date, '12:00'))) !== date) fail('INVALID_DATE', 'Vui lòng chọn ngày hợp lệ từ hôm nay.');
  // Thứ tự kiểm tra theo 2B-22: khóa tài khoản trước, rồi khung giờ, hạn mức ngày, số dư.
  if (getCurrentUser()?.is_locked) fail('ACCOUNT_LOCKED', 'Tài khoản đang bị khóa đặt phòng. Vui lòng liên hệ thủ thư.');
  const state = readState();
  const room = getRoomSnapshot(date).rooms.find((item) => item.id === roomId);
  const slot = room?.slots.find((item) => item.id === slotId);
  if (!room || !slot?.available) fail('SLOT_UNAVAILABLE', 'Khung giờ này không còn trống. Vui lòng chọn khung giờ khác.');
  if (state.bookings.some((booking) => booking.date === date && ['CONFIRMED', 'CHECKED_IN'].includes(booking.status))) fail('DAILY_LIMIT', 'Bạn chỉ được có một lượt đặt còn hiệu lực mỗi ngày.');
  if (state.balance < room.slotPrice) fail('INSUFFICIENT_BALANCE', `Số dư không đủ. Bạn còn thiếu ${formatMoney(room.slotPrice - state.balance)} để đặt phòng.`);
  const booking = {
    id: crypto.randomUUID(), roomId, roomName: room.name, date, slotId, start: slot.start, end: slot.end,
    price: room.slotPrice, status: 'CONFIRMED', createdAt: new Date().toISOString(),
  };
  saveState({ balance: state.balance - booking.price, bookings: [booking, ...state.bookings] });
  return booking;
}

export function cancelRoomBooking(id) {
  const state = readState();
  const booking = state.bookings.find((item) => item.id === id);
  if (!booking || booking.status !== 'CONFIRMED') fail('NOT_CANCELLABLE', 'Lượt đặt này không thể hủy hoặc đã được hủy.');
  if (slotTimestamp(booking.date, booking.start) - Date.now() < 3600000) fail('CANCELLATION_CUTOFF', 'Chỉ được hủy trước giờ bắt đầu ít nhất 1 giờ.');
  booking.status = 'CANCELLED';
  saveState({ ...state, balance: state.balance + booking.price });
  return booking;
}

export function topUpSampleWallet(amount) {
  if (![50000, 100000, 200000].includes(amount)) fail('INVALID_AMOUNT', 'Số tiền nạp thử không hợp lệ.');
  const state = readState();
  saveState({ ...state, balance: state.balance + amount });
  return state.balance + amount;
}
