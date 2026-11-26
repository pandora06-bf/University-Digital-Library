import { slotTimestamp, formatMoney } from './libraryDate';

const HOUR = 3600000;
const CHECKIN_WINDOW = 15 * 60000;

// Trạng thái RoomBooking theo SRS: CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED, NO_SHOW.
export function describeBooking(booking, now = Date.now()) {
  const start = slotTimestamp(booking.date, booking.start);
  const end = slotTimestamp(booking.date, booking.end);
  switch (booking.status) {
    case 'CHECKED_IN':
      return { label: 'Đang sử dụng', tone: 'indigo', note: 'Đã check-in tại quầy.' };
    case 'COMPLETED':
      return { label: 'Đã hoàn thành', tone: 'slate' };
    case 'CANCELLED':
      return { label: 'Đã hủy', tone: 'slate', note: 'Phí đã được hoàn vào số dư.' };
    case 'NO_SHOW':
      return { label: 'Không đến', tone: 'rose', note: 'Không check-in trong 15 phút đầu nên không được hoàn tiền.' };
    case 'CONFIRMED':
    default: {
      if (now >= end) return { label: 'Đã hết giờ', tone: 'slate', note: 'Hệ thống đang cập nhật trạng thái.' };
      if (now >= start + CHECKIN_WINDOW) return { label: 'Quá hạn check-in', tone: 'rose', note: 'Đã quá 15 phút đầu; lượt đặt sẽ chuyển sang Không đến.' };
      if (now >= start) return { label: 'Chờ check-in', tone: 'amber', note: 'Hãy check-in tại quầy trong 15 phút đầu.' };
      if (start - now >= HOUR) return { label: 'Đã xác nhận', tone: 'emerald', cancellable: true };
      return { label: 'Đã xác nhận', tone: 'emerald', note: 'Không thể hủy: còn dưới 1 giờ trước giờ bắt đầu.' };
    }
  }
}

export const formatPrice = (value) => (Number.isFinite(value) ? formatMoney(value) : 'Phí theo quy định');

function detailText(detail) {
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail.message === 'string') return detail.message;
  return '';
}

// Đổi lỗi HTTP của API phòng đọc (2B-22, 3-10) thành mã lỗi mà giao diện đang dùng.
export function mapRoomApiError(error, action = 'book') {
  const status = Number(error?.response?.status);
  const detail = error?.response?.data?.detail;
  const text = detailText(detail);
  const make = (code, fallback) => Object.assign(new Error(text || fallback), { code, status });
  if (!status) return make('NETWORK', 'Không kết nối được máy chủ. Vui lòng thử lại.');
  if (status === 402) {
    // Backend trả câu "…cần nạp thêm 20,000đ" (detail dạng chuỗi), bản cũ trả { shortfall }.
    const fromText = /([\d.,]+)\s*đ/i.exec(text)?.[1]?.replace(/[.,]/g, '');
    const shortfall = Number(detail?.shortfall ?? detail?.missing_amount ?? fromText);
    return Number.isFinite(shortfall) && shortfall > 0
      ? Object.assign(new Error(`Số dư không đủ. Bạn còn thiếu ${formatMoney(shortfall)} để đặt phòng.`), { code: 'INSUFFICIENT_BALANCE', status })
      : make('INSUFFICIENT_BALANCE', 'Số dư không đủ để đặt phòng.');
  }
  if (status === 403) return make('ACCOUNT_LOCKED', 'Tài khoản đang bị khóa đặt phòng. Vui lòng liên hệ thủ thư.');
  if (status === 409) {
    if (action === 'cancel') return make('NOT_CANCELLABLE', 'Lượt đặt này không thể hủy hoặc đã được hủy.');
    return /ngày|daily|per day/i.test(text)
      ? make('DAILY_LIMIT', 'Bạn chỉ được có một lượt đặt còn hiệu lực mỗi ngày.')
      : make('SLOT_UNAVAILABLE', 'Khung giờ này không còn trống. Vui lòng chọn khung giờ khác.');
  }
  if (status === 400 || status === 422) {
    return action === 'cancel'
      ? make('CANCELLATION_CUTOFF', 'Chỉ được hủy trước giờ bắt đầu ít nhất 1 giờ.')
      : make('INVALID_DATE', 'Vui lòng chọn ngày và khung giờ hợp lệ.');
  }
  return make('UNKNOWN', 'Thao tác thất bại. Vui lòng thử lại.');
}

const hhmm = (value) => String(value ?? '').slice(0, 5);
// Giá một khung giờ: API thật trả price_per_slot (3-10); thiếu giá thì trả null để hiện "Phí theo quy định".
const priceOf = (item) => {
  for (const key of ['price_per_slot', 'slot_price', 'price', 'amount', 'fee']) {
    const value = item?.[key];
    if (value !== undefined && value !== null && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
};

// Ghép dữ liệu API thành snapshot mà RoomBookingPage đang dùng (giống bản mock).
export function toRoomSnapshot({ date, rooms, availability, bookings, wallet, now = Date.now() }) {
  const nameById = new Map(rooms.map((room) => [String(room.id), room.room_name]));
  // API lượt đặt không trả giá: lấy giá hiện tại của phòng để hiện số tiền hoàn khi hủy.
  const priceById = new Map(rooms.map((room) => [String(room.id), priceOf(room)]));
  return {
    balance: Number(wallet?.service_balance ?? wallet?.balance ?? 0),
    bookings: bookings.map((item) => ({
      id: item.id, roomId: item.room_id, roomName: item.room_name ?? nameById.get(String(item.room_id)) ?? `Phòng ${item.room_id}`,
      date: item.booking_date, slotId: hhmm(item.slot_start), start: hhmm(item.slot_start), end: hhmm(item.slot_end),
      price: priceOf(item) ?? priceById.get(String(item.room_id)) ?? null, status: item.status,
      attendees: item.attendee_count ?? null,
    })),
    rooms: rooms.filter((room) => room.is_active !== false).map((room) => ({
      id: room.id, name: room.room_name, floor: room.floor ? `Tầng ${room.floor}` : 'Thư viện', capacity: room.capacity,
      slotPrice: priceOf(room), amenities: room.amenities ?? [],
      slots: (availability[String(room.id)]?.slots ?? []).map((slot) => {
        const start = hhmm(slot.slot_start);
        const elapsed = slotTimestamp(date, start) <= now;
        const available = Boolean(slot.available) && !elapsed;
        return { id: start, start, end: hhmm(slot.slot_end), available, reason: elapsed ? 'Đã qua' : available ? 'Còn trống' : 'Đã đặt' };
      }),
    })),
  };
}
