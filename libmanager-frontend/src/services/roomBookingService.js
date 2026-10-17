import { getRoomSnapshot, createRoomBooking, cancelRoomBooking, topUpDemoWallet } from '../mocks/roomBookings';

// Điểm thay thế duy nhất khi API 2B-22 hoàn thành. Không đoán endpoint API.
// Adapter thật phải giữ dạng snapshot và mã lỗi như docs/HANDOFF_NEW_FEATURES.md.
export const roomBookingService = {
  mode: 'mock',
  async getSnapshot(date) { return getRoomSnapshot(date); },
  async book(selection) { return createRoomBooking(selection); },
  async cancel(id) { return cancelRoomBooking(id); },
  async topUp(amount) { return topUpDemoWallet(amount); },
};
