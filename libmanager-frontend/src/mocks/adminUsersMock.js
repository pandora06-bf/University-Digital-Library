/**
 * Mock Admin User Management (2B-18)
 *
 * Kịch bản test sẵn:
 * - 409 trùng MSSV: tạo lại bất kỳ mã đã có (vd 50214569, TEST409DUP)
 * - 409 mở khóa khi còn nợ: TEST409DEBT (khóa + nợ > 0)
 * - 409 không khóa ADMIN: admin / TESTADMIN
 * - 422: để form sai (kkk, SĐT ii, email thiếu @) — validation FE, không cần user mock
 */

const STORAGE_KEY = 'libmanager_admin_users_v1';

export const INITIAL_ADMIN_USERS = [
  // --- ADMIN: dùng để test không khóa được ---
  {
    user_code: 'admin',
    full_name: 'Thủ thư Hệ thống',
    email: 'admin@tdtu.edu.vn',
    phone_number: '0900000001',
    department: 'Thư viện',
    role: 'ADMIN',
    is_locked: false,
    total_fines: 0,
    max_borrow_limit: 0,
  },
  {
    user_code: 'TESTADMIN',
    full_name: 'Admin Kiểm Thử',
    email: 'test.admin@tdtu.edu.vn',
    phone_number: '0900000002',
    department: 'Thư viện',
    role: 'ADMIN',
    is_locked: false,
    total_fines: 0,
    max_borrow_limit: 0,
  },

  // --- 409: mở khóa khi còn nợ ---
  {
    user_code: 'TEST409DEBT',
    full_name: 'Nguyễn Thị Nợ Phạt',
    email: 'test409.debt@student.tdtu.edu.vn',
    phone_number: '0911111111',
    department: 'CNTT',
    role: 'STUDENT',
    is_locked: true,
    total_fines: 75000,
    max_borrow_limit: 3,
  },
  {
    user_code: '50221320',
    full_name: 'Lê Thị Mai Hương',
    email: '50221320@student.tdtu.edu.vn',
    phone_number: '0912345678',
    department: 'KHMT',
    role: 'STUDENT',
    is_locked: true,
    total_fines: 50000,
    max_borrow_limit: 3,
  },

  // --- 409: trùng mã khi tạo mới (dùng lại các mã dưới) ---
  {
    user_code: 'TEST409DUP',
    full_name: 'Trần Văn Trùng Mã',
    email: 'test409.dup@student.tdtu.edu.vn',
    phone_number: '0922222222',
    department: 'CNTT',
    role: 'STUDENT',
    is_locked: false,
    total_fines: 0,
    max_borrow_limit: 3,
  },
  {
    user_code: '50214569',
    full_name: 'Trần Quốc Bảo',
    email: '50214569@student.tdtu.edu.vn',
    phone_number: '0901234567',
    department: 'CNTT',
    role: 'STUDENT',
    is_locked: false,
    total_fines: 0,
    max_borrow_limit: 3,
  },

  // --- User thường: khóa/mở khóa OK, reset MK ---
  {
    user_code: '50201111',
    full_name: 'Phạm Thúy Vy',
    email: '50201111@student.tdtu.edu.vn',
    phone_number: '0933333333',
    department: 'CNTT',
    role: 'STUDENT',
    is_locked: false,
    total_fines: 0,
    max_borrow_limit: 3,
  },
  {
    user_code: '50198822',
    full_name: 'Hoàng Minh Đức',
    email: '50198822@student.tdtu.edu.vn',
    phone_number: '0944444444',
    department: 'KTPM',
    role: 'STUDENT',
    is_locked: false,
    total_fines: 15000,
    max_borrow_limit: 3,
  },
  {
    user_code: 'GV001',
    full_name: 'Nguyễn Văn Khoa',
    email: 'khoa.nv@tdtu.edu.vn',
    phone_number: '0987654321',
    department: 'CNTT',
    role: 'LECTURER',
    is_locked: false,
    total_fines: 0,
    max_borrow_limit: 5,
  },
  {
    user_code: 'TESTOK',
    full_name: 'Lê Văn Bình Thường',
    email: 'test.ok@student.tdtu.edu.vn',
    phone_number: '0955555555',
    department: 'KHMT',
    role: 'STUDENT',
    is_locked: false,
    total_fines: 0,
    max_borrow_limit: 3,
  },
];

/** Gợi ý nhanh trên UI / docs */
export const MOCK_TEST_HINTS = [
  'Trùng mã: Thêm người dùng với MSSV TEST409DUP hoặc 50214569',
  'Còn nợ: Mở khóa TEST409DEBT hoặc 50221320',
  'Không khóa quản trị viên: thử khóa admin hoặc TESTADMIN',
  'Biểu mẫu sai: họ tên "kkk", số điện thoại "ii", email "abc", khoa "x"',
];

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [...INITIAL_ADMIN_USERS];
}

function save(list) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

export function getStoredAdminUsers() {
  return load();
}

/** Xóa cache session → nạp lại seed mock (nút Đặt lại bộ lọc có thể gọi). */
export function resetStoredAdminUsers() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return save([...INITIAL_ADMIN_USERS]);
}

export function upsertStoredAdminUser(user) {
  const list = load();
  const idx = list.findIndex((u) => u.user_code === user.user_code);
  if (idx >= 0) list[idx] = { ...list[idx], ...user };
  else list.unshift(user);
  return save(list);
}

export function setStoredUserLock(userCode, isLocked) {
  const list = load().map((u) =>
    u.user_code === userCode ? { ...u, is_locked: isLocked } : u
  );
  return save(list);
}

export function issueTempPassword(userCode) {
  const temp = `Tmp${Math.random().toString(36).slice(2, 8)}!`;
  const list = load().map((u) =>
    u.user_code === userCode ? { ...u, _lastTempPassword: temp } : u
  );
  save(list);
  return temp;
}
