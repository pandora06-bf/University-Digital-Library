/**
 * Mock Admin giao dịch chưa khớp (4-16)
 * API thật: GET /api/admin/wallet/unmatched ; POST .../assign (Hiền 4-07)
 */

const STORAGE_KEY = 'libmanager_admin_unmatched_v1';

export const DEMO_USERS_FOR_ASSIGN = [
  { user_code: 'SV-DEMO-001', full_name: 'Nguyễn Văn Đạt', email: 'demo_student_001@tdtu.edu.vn' },
  { user_code: 'SV-DEMO-003', full_name: 'Phạm Quốc Huy', email: 'demo_student_003@tdtu.edu.vn' },
  { user_code: 'SV-DEMO-009', full_name: 'Đỗ Thị Hoa', email: 'demo_student_009@tdtu.edu.vn' },
  { user_code: '50214569', full_name: 'Trần Quốc Bảo', email: '50214569@student.tdtu.edu.vn' },
];

export const INITIAL_UNMATCHED = [
  {
    id: 1,
    bank_tx_id: 'FT26_UNMATCHED_001',
    amount: 100000,
    bank_account_number: '0071000888888',
    transfer_content: 'NAP LIB SV DEMO 001 SAI NOI DUNG',
    received_at: '2026-10-24T09:15:00',
    status: 'UNRESOLVED',
    resolved_by: null,
    resolution_notes: null,
  },
  {
    id: 2,
    bank_tx_id: 'FT26_UNMATCHED_002',
    amount: 50000,
    bank_account_number: '0071000888888',
    transfer_content: 'TOPUP THUVIEN',
    received_at: '2026-10-25T14:40:00',
    status: 'UNRESOLVED',
    resolved_by: null,
    resolution_notes: null,
  },
  {
    id: 3,
    bank_tx_id: 'FT26_UNMATCHED_003',
    amount: 200000,
    bank_account_number: '0071000999999',
    transfer_content: 'CK ma khong ghi MSSV',
    received_at: '2026-10-26T11:02:00',
    status: 'UNRESOLVED',
    resolved_by: null,
    resolution_notes: null,
  },
  {
    id: 4,
    bank_tx_id: 'FT26_ASSIGNED_DEMO',
    amount: 50000,
    bank_account_number: '0071000888888',
    transfer_content: 'NAP SV-DEMO-009',
    received_at: '2026-10-20T08:00:00',
    status: 'ASSIGNED',
    resolved_by: 'admin',
    resolution_notes: 'Gán cho SV-DEMO-009',
    assigned_user_code: 'SV-DEMO-009',
  },
];

export function getStoredUnmatched() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const list = INITIAL_UNMATCHED.map((x) => ({ ...x }));
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

function save(list) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function resetUnmatched() {
  sessionStorage.removeItem(STORAGE_KEY);
  return getStoredUnmatched();
}

export function assignUnmatched(txId, userCode, notes = '') {
  const list = getStoredUnmatched();
  const tx = list.find((t) => String(t.id) === String(txId));
  if (!tx) throw Object.assign(new Error('Không tìm thấy giao dịch'), { code: '404' });
  if (tx.status === 'ASSIGNED') {
    throw Object.assign(new Error('Giao dịch đã được gán rồi'), { code: '409' });
  }
  const user = DEMO_USERS_FOR_ASSIGN.find((u) => u.user_code === userCode);
  if (!user) throw Object.assign(new Error('Chọn người dùng hợp lệ'), { code: 'VALIDATION' });

  tx.status = 'ASSIGNED';
  tx.resolved_by = 'admin';
  tx.assigned_user_code = user.user_code;
  tx.assigned_user_name = user.full_name;
  tx.resolution_notes = (notes || `Gán cho ${user.user_code}`).trim();
  save([...list]);
  return tx;
}
