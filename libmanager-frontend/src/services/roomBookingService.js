import axiosInstance from './axios_instance';
import { getRoomSnapshot, createRoomBooking, cancelRoomBooking, topUpDemoWallet } from '../mocks/roomBookings';
import { mapRoomApiError, toRoomSnapshot } from '../utils/roomBooking';

// Cờ riêng cho phòng đọc: API 2B-22/3-09 chưa có trên backend, nên mặc định dùng mock (2B-27)
// kể cả khi VITE_USE_MOCK=false. Đặt VITE_ROOM_BOOKING_API=true khi backend xong.
const useApi = import.meta.env.VITE_ROOM_BOOKING_API === 'true';

// Endpoint theo bảng phân công: 2B-22 (room-bookings), 3-09 (wallet); danh sách phòng
// và khung trống theo hợp đồng mock MSW (src/mocks/handlers.js).
const api = {
  async getSnapshot(date) {
    try {
      const [{ data: rooms }, { data: mine }, { data: wallet }] = await Promise.all([
        axiosInstance.get('/api/rooms'),
        axiosInstance.get('/api/room-bookings/my'),
        axiosInstance.get('/api/wallet'),
      ]);
      const entries = await Promise.all(rooms.map(async (room) => {
        const { data } = await axiosInstance.get(`/api/rooms/${room.id}/availability`, { params: { date } });
        return [String(room.id), data];
      }));
      const bookings = Array.isArray(mine) ? mine : mine.items ?? mine.data ?? [];
      return toRoomSnapshot({ date, rooms, availability: Object.fromEntries(entries), bookings, wallet });
    } catch (error) {
      throw mapRoomApiError(error, 'load');
    }
  },
  async book({ roomId, date, slotId }) {
    try {
      const { data } = await axiosInstance.post('/api/room-bookings', { room_id: roomId, booking_date: date, slot_start: slotId });
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
  async topUp(amount) { return topUpDemoWallet(amount); },
};

export const roomBookingService = { mode: useApi ? 'api' : 'mock', ...(useApi ? api : mock) };
