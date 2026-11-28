import axiosInstance from './axios_instance';
import { getRoomSnapshot, createRoomBooking, cancelRoomBooking, topUpSampleWallet } from '../mocks/roomBookings';
import { mapRoomApiError, toRoomSnapshot } from '../utils/roomBooking';

// Phòng đọc dùng API thật (2B-21 Hiền, 2B-22 Nhất, 3-10 Đức) khi frontend chạy với backend thật
// (VITE_USE_MOCK=false). Chế độ mock (CI, E2E) vẫn dùng mocks/roomBookings để không cần database.
// VITE_ROOM_BOOKING_API=true/false ép chế độ khi cần thử riêng.
const roomFlag = import.meta.env.VITE_ROOM_BOOKING_API;
const useApi = roomFlag === 'true' || (roomFlag !== 'false' && import.meta.env.VITE_USE_MOCK === 'false');
const listOf = (data) => (Array.isArray(data) ? data : data?.data ?? data?.items ?? []);

// Hợp đồng API: room_router.py (GET /api/rooms → {data,total}; /availability → {room,date,slots}),
// room_booking_router.py (POST/DELETE /api/room-bookings, GET /my → {data,page,size}), wallet_router.py.
const api = {
  async getSnapshot(date) {
    try {
      const [roomsRes, { data: mine }, { data: wallet }] = await Promise.all([
        axiosInstance.get('/api/rooms'),
        axiosInstance.get('/api/room-bookings/my', { params: { size: 100 } }),
        axiosInstance.get('/api/wallet'),
      ]);
      const rooms = listOf(roomsRes.data).filter((room) => room.is_active !== false);
      const entries = await Promise.all(rooms.map(async (room) => {
        const { data } = await axiosInstance.get(`/api/rooms/${room.id}/availability`, { params: { date } });
        return [String(room.id), data];
      }));
      const bookings = listOf(mine);
      return toRoomSnapshot({ date, rooms, availability: Object.fromEntries(entries), bookings, wallet });
    } catch (error) {
      throw mapRoomApiError(error, 'load');
    }
  },
  // slot_start/slot_end dạng "HH:MM" giờ thư viện; attendee_count kiểm tra theo sức chứa phòng (2B-22).
  async book({ roomId, date, slotId, slotEnd, attendees = 1 }) {
    try {
      const { data } = await axiosInstance.post('/api/room-bookings', {
        room_id: roomId, booking_date: date, slot_start: slotId, slot_end: slotEnd, attendee_count: attendees,
      });
      return data;
    } catch (error) {
      throw mapRoomApiError(error, 'book');
    }
  },
  async cancel(id) {
    try {
      const { data } = await axiosInstance.delete(`/api/room-bookings/${encodeURIComponent(id)}`);
      return data;
    } catch (error) {
      throw mapRoomApiError(error, 'cancel');
    }
  },
  async topUp() {
    // Nạp tiền thật đi qua QR VietQR (3-09), không cộng tiền trực tiếp từ giao diện.
    throw Object.assign(new Error('Nạp tiền thật dùng mã QR của tài khoản dịch vụ (3-09), chưa có trên hệ thống.'), { code: 'TOPUP_UNAVAILABLE' });
  },
};

const mock = {
  async getSnapshot(date) { return getRoomSnapshot(date); },
  async book(selection) { return createRoomBooking(selection); },
  async cancel(id) { return cancelRoomBooking(id); },
  async topUp(amount) { return topUpSampleWallet(amount); },
};

export const roomBookingService = { mode: useApi ? 'api' : 'mock', ...(useApi ? api : mock) };
