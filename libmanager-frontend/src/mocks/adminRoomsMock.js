/**
 * Mock Admin Phòng học nhóm + Check-in (3-17)
 * API thật: GET/POST/PUT /api/admin/rooms, POST /api/admin/room-bookings/checkin (Hiền/Nhất)
 */

const ROOMS_KEY = 'libmanager_admin_rooms_v1';
const BOOKINGS_KEY = 'libmanager_admin_room_bookings_v1';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const INITIAL_ADMIN_ROOMS = [
  {
    id: 'room-01',
    name: 'Phòng học nhóm A201',
    floor: 'Tầng 2 · Khu A',
    capacity: 4,
    slot_price: 20000,
    is_active: true,
  },
  {
    id: 'room-02',
    name: 'Phòng thảo luận A202',
    floor: 'Tầng 2 · Khu A',
    capacity: 8,
    slot_price: 40000,
    is_active: true,
  },
  {
    id: 'room-03',
    name: 'Phòng nghiên cứu B301',
    floor: 'Tầng 3 · Khu B',
    capacity: 12,
    slot_price: 60000,
    is_active: true,
  },
  {
    id: 'room-04',
    name: 'Phòng họp nhỏ C105',
    floor: 'Tầng 1 · Khu C',
    capacity: 6,
    slot_price: 30000,
    is_active: false,
  },
];

function seedBookings() {
  const t = todayStr();
  return [
    {
      id: 'RB-2026-1001',
      booking_code: 'RB-2026-1001',
      room_id: 'room-01',
      room_name: 'Phòng học nhóm A201',
      user_code: '52400001',
      user_name: 'Nguyễn Văn Đạt',
      booking_date: t,
      slot_start: '08:00',
      slot_end: '10:00',
      status: 'CONFIRMED',
      checkin_time: null,
      price: 20000,
    },
    {
      id: 'RB-2026-1002',
      booking_code: 'RB-2026-1002',
      room_id: 'room-02',
      room_name: 'Phòng thảo luận A202',
      user_code: '52400007',
      user_name: 'Lê Minh An',
      booking_date: t,
      slot_start: '10:00',
      slot_end: '12:00',
      status: 'CONFIRMED',
      checkin_time: null,
      price: 40000,
    },
    {
      id: 'RB-2026-1003',
      booking_code: 'RB-2026-1003',
      room_id: 'room-01',
      room_name: 'Phòng học nhóm A201',
      user_code: 'GV0002',
      user_name: 'Trần Thị Lan',
      booking_date: t,
      slot_start: '14:00',
      slot_end: '16:00',
      status: 'CHECKED_IN',
      checkin_time: `${t}T14:05:00`,
      price: 20000,
    },
  ];
}

export function getStoredAdminRooms() {
  try {
    const raw = sessionStorage.getItem(ROOMS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const list = [...INITIAL_ADMIN_ROOMS];
  sessionStorage.setItem(ROOMS_KEY, JSON.stringify(list));
  return list;
}

export function saveAdminRooms(list) {
  sessionStorage.setItem(ROOMS_KEY, JSON.stringify(list));
  return list;
}

export function resetAdminRooms() {
  sessionStorage.removeItem(ROOMS_KEY);
  sessionStorage.removeItem(BOOKINGS_KEY);
  return getStoredAdminRooms();
}

export function getStoredAdminBookings() {
  try {
    const raw = sessionStorage.getItem(BOOKINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const list = seedBookings();
  sessionStorage.setItem(BOOKINGS_KEY, JSON.stringify(list));
  return list;
}

function saveBookings(list) {
  sessionStorage.setItem(BOOKINGS_KEY, JSON.stringify(list));
  return list;
}

export function getTodayBookings(date = todayStr()) {
  return getStoredAdminBookings().filter((b) => b.booking_date === date);
}

export function upsertAdminRoom(payload, editingId = null) {
  const list = getStoredAdminRooms();
  const name = (payload.name || '').trim();
  if (!name) throw Object.assign(new Error('Tên phòng không được để trống'), { code: 'VALIDATION' });
  const capacity = Number(payload.capacity);
  if (!capacity || capacity < 1) throw Object.assign(new Error('Sức chứa phải ≥ 1'), { code: 'VALIDATION' });
  const slot_price = Number(payload.slot_price);
  if (Number.isNaN(slot_price) || slot_price < 0) {
    throw Object.assign(new Error('Giá khung giờ không hợp lệ'), { code: 'VALIDATION' });
  }
  const dup = list.find(
    (r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== editingId
  );
  if (dup) throw Object.assign(new Error('Tên phòng đã tồn tại'), { code: '409' });

  if (editingId) {
    const next = list.map((r) =>
      r.id === editingId
        ? {
            ...r,
            name,
            floor: (payload.floor || '').trim(),
            capacity,
            slot_price,
            is_active: payload.is_active !== false,
          }
        : r
    );
    return saveAdminRooms(next).find((r) => r.id === editingId);
  }

  const row = {
    id: `room-${Date.now()}`,
    name,
    floor: (payload.floor || '').trim(),
    capacity,
    slot_price,
    is_active: true,
  };
  return saveAdminRooms([row, ...list])[0];
}

/** Ngừng sử dụng: 409 nếu còn lượt CONFIRMED trong tương lai (theo SRS / 2B-21). */
export function setRoomActive(roomId, isActive) {
  const list = getStoredAdminRooms();
  const room = list.find((r) => r.id === roomId);
  if (!room) throw Object.assign(new Error('Không tìm thấy phòng'), { code: '404' });

  if (!isActive) {
    const t = todayStr();
    const future = getStoredAdminBookings().some(
      (b) =>
        b.room_id === roomId &&
        b.booking_date >= t &&
        ['CONFIRMED', 'CHECKED_IN'].includes(b.status)
    );
    if (future) {
      throw Object.assign(
        new Error('Không thể ngừng phòng còn lượt đặt trong tương lai.'),
        { code: '409' }
      );
    }
  }

  const next = list.map((r) => (r.id === roomId ? { ...r, is_active: isActive } : r));
  return saveAdminRooms(next).find((r) => r.id === roomId);
}

export function checkInByCode(code) {
  const key = (code || '').trim().toUpperCase();
  if (!key) throw Object.assign(new Error('Nhập mã đặt phòng'), { code: 'VALIDATION' });
  const list = getStoredAdminBookings();
  const booking = list.find(
    (b) => b.booking_code.toUpperCase() === key || b.id.toUpperCase() === key
  );
  if (!booking) throw Object.assign(new Error('Không tìm thấy mã đặt phòng'), { code: '404' });
  if (booking.booking_date !== todayStr()) {
    throw Object.assign(new Error('Chỉ check-in lượt đặt trong ngày hôm nay'), { code: 'VALIDATION' });
  }
  if (booking.status === 'CHECKED_IN') {
    throw Object.assign(new Error('Lượt đặt đã check-in rồi'), { code: '409' });
  }
  if (booking.status !== 'CONFIRMED') {
    throw Object.assign(new Error(`Trạng thái ${booking.status} không cho check-in`), { code: '409' });
  }
  booking.status = 'CHECKED_IN';
  booking.checkin_time = new Date().toISOString();
  saveBookings([...list]);
  return booking;
}
