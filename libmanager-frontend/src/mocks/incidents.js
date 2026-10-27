/**
 * Dữ liệu giả lập cho danh sách Biên bản sự cố Báo mất / Hỏng sách (Nhiệm vụ 4-15.a / UC15)
 * Dùng cho kiểm thử giao diện phía Client trước khi Backend triển khai API /api/admin/incidents
 */

/** Phiếu BORROWED mẫu để UI Tra cứu theo barcode / mã phiếu (mock FE, không gọi API). */
export const MOCK_ACTIVE_LOANS = [
  {
    barcode: 'BC-2026-0012',
    loan_code: 'PM-2026-0089',
    book_title: 'Lập trình Web hiện đại với React 19 & Vite',
    borrower_name: 'Trần Quốc Bảo',
    borrower_code: '50214569',
    borrower_class: 'K25 CNTT',
    book_price: 145000,
  },
  {
    barcode: 'BC-2026-0045',
    loan_code: 'PM-2026-0078',
    book_title: 'Cấu trúc dữ liệu & Giải thuật nâng cao',
    borrower_name: 'Lê Thị Mai Hương',
    borrower_code: '50221320',
    borrower_class: 'K26 KHMT',
    book_price: 120000,
  },
  {
    barcode: 'BC-2026-0099',
    loan_code: 'PM-2026-0065',
    book_title: 'Thiết kế Hệ thống Phân tán (Designing Data-Intensive Applications)',
    borrower_name: 'Hoàng Minh Đức',
    borrower_code: '50198822',
    borrower_class: 'K23 KTPM',
    book_price: 280000,
  },
  {
    barcode: 'BC-2026-0103',
    loan_code: 'PM-2026-0052',
    book_title: 'Nhập môn Trí tuệ Nhân tạo & Học máy',
    borrower_name: 'Phạm Thúy Vy',
    borrower_code: '50201111',
    borrower_class: 'K24 CNTT',
    book_price: 165000,
  },
];

export function findMockActiveLoan(code) {
  const key = (code || '').trim().toLowerCase();
  if (!key) return null;
  return (
    MOCK_ACTIVE_LOANS.find(
      (loan) =>
        loan.barcode.toLowerCase() === key || loan.loan_code.toLowerCase() === key
    ) || null
  );
}

export const INITIAL_INCIDENTS = [
  {
    id: 'INC-2026-001',
    incident_code: 'BB-2026-001',
    loan_code: 'PM-2026-0089',
    barcode: 'BC-2026-0012',
    book_title: 'Lập trình Web hiện đại với React 19 & Vite',
    borrower_name: 'Trần Quốc Bảo',
    borrower_code: '50214569',
    borrower_class: 'K25 CNTT',
    incident_type: 'LOST',
    description: 'Độc giả báo làm mất sách trên xe buýt tuyến số 86 khi đi học về, không thể tìm lại.',
    book_price: 145000,
    compensation_amount: 145000,
    created_at: '12/10/2026',
    created_by: 'Thủ thư Quản trị viên',
    status: 'PENDING', // PENDING (Chờ xử lý) | RECORDED (Đã ghi công nợ) | RESOLVED (Đã bồi thường)
  },
  {
    id: 'INC-2026-002',
    incident_code: 'BB-2026-002',
    loan_code: 'PM-2026-0078',
    barcode: 'BC-2026-0045',
    book_title: 'Cấu trúc dữ liệu & Giải thuật nâng cao',
    borrower_name: 'Lê Thị Mai Hương',
    borrower_code: '50221320',
    borrower_class: 'K26 KHMT',
    incident_type: 'DAMAGED',
    description: 'Sách bị rách nát phần bìa và bung 15 trang ruột do ngấm nước mưa lớn, không thể phục hồi lưu thông.',
    book_price: 120000,
    compensation_amount: 120000,
    created_at: '10/10/2026',
    created_by: 'Thủ thư Quản trị viên',
    status: 'RECORDED',
  },
  {
    id: 'INC-2026-003',
    incident_code: 'BB-2026-003',
    loan_code: 'PM-2026-0065',
    barcode: 'BC-2026-0099',
    book_title: 'Thiết kế Hệ thống Phân tán (Designing Data-Intensive Applications)',
    borrower_name: 'Hoàng Minh Đức',
    borrower_code: '50198822',
    borrower_class: 'K23 KTPM',
    incident_type: 'LOST',
    description: 'Để quên tài liệu tại phòng tự học tầng 4 khu nhà C, camera không ghi nhận được người nhặt.',
    book_price: 280000,
    compensation_amount: 280000,
    created_at: '08/10/2026',
    created_by: 'Thủ thư Trần Đình Tuấn',
    status: 'RESOLVED',
  },
  {
    id: 'INC-2026-004',
    incident_code: 'BB-2026-004',
    loan_code: 'PM-2026-0052',
    barcode: 'BC-2026-0103',
    book_title: 'Nhập môn Trí tuệ Nhân tạo & Học máy',
    borrower_name: 'Phạm Thúy Vy',
    borrower_code: '50201111',
    borrower_class: 'K24 CNTT',
    incident_type: 'DAMAGED',
    description: 'Rách gáy sách nghiêm trọng và vẽ bậy bằng bút dạ quang che lấp hơn 30 trang nội dung bài giảng.',
    book_price: 165000,
    compensation_amount: 165000,
    created_at: '05/10/2026',
    created_by: 'Thủ thư Trần Đình Tuấn',
    status: 'RECORDED',
  },
  {
    id: 'INC-2026-005',
    incident_code: 'BB-2026-005',
    loan_code: 'PM-2026-0041',
    barcode: 'BC-2026-0077',
    book_title: 'Kỹ thuật Lập trình Hệ thống Linux',
    borrower_name: 'Nguyễn Văn Tuấn',
    borrower_code: '50210088',
    borrower_class: 'K25 MMT',
    incident_type: 'LOST',
    description: 'Độc giả chuyển phòng trọ làm thất lạc thùng đồ cá nhân trong đó có sách mượn của thư viện.',
    book_price: 135000,
    compensation_amount: 135000,
    created_at: '02/10/2026',
    created_by: 'Thủ thư Quản trị viên',
    status: 'PENDING',
  },
  {
    id: 'INC-2026-006',
    incident_code: 'BB-2026-006',
    loan_code: 'PM-2026-0038',
    barcode: 'BC-2026-0021',
    book_title: 'Cơ sở Dữ liệu Quan hệ & Chuẩn hóa SQL',
    borrower_name: 'Đỗ Gia Huy',
    borrower_code: '50220045',
    borrower_class: 'K26 HTTT',
    incident_type: 'DAMAGED',
    description: 'Gãy gáy sách, ẩm mốc nặng loang lổ nhiều trang do sơ ý đổ cốc trà sữa lên toàn bộ cuốn sách.',
    book_price: 95000,
    compensation_amount: 95000,
    created_at: '28/09/2026',
    created_by: 'Thủ thư Trần Đình Tuấn',
    status: 'RESOLVED',
  },
  {
    id: 'INC-2026-007',
    incident_code: 'BB-2026-007',
    loan_code: 'PM-2026-0029',
    barcode: 'BC-2026-0155',
    book_title: 'Mạng Máy Tính Hiện Đại (Computer Networks 6th Edition)',
    borrower_name: 'Vũ Thị Thanh Thảo',
    borrower_code: '50210777',
    borrower_class: 'K25 ATTT',
    incident_type: 'LOST',
    description: 'Làm rơi sách trên xe buýt khi tham gia buổi dã ngoại hoạt động đoàn của khoa.',
    book_price: 210000,
    compensation_amount: 210000,
    created_at: '25/09/2026',
    created_by: 'Thủ thư Quản trị viên',
    status: 'RECORDED',
  },
  {
    id: 'INC-2026-008',
    incident_code: 'BB-2026-008',
    loan_code: 'PM-2026-0015',
    barcode: 'BC-2026-0088',
    book_title: 'An toàn Thông tin và Mật mã học Cơ sở',
    borrower_name: 'Bùi Quang Khải',
    borrower_code: '50190333',
    borrower_class: 'K23 ATTT',
    incident_type: 'DAMAGED',
    description: 'Sách bị cắn rách góc trên và rách nát trang bìa phụ do thú cưng ở nhà cắn xé.',
    book_price: 115000,
    compensation_amount: 115000,
    created_at: '20/09/2026',
    created_by: 'Thủ thư Trần Đình Tuấn',
    status: 'RESOLVED',
  },
  {
    id: 'INC-2026-009',
    incident_code: 'BB-2026-009',
    loan_code: 'PM-2026-0011',
    barcode: 'BC-2026-0062',
    book_title: 'Kiến trúc Máy tính và Hợp ngữ',
    borrower_name: 'Ngô Kiến Huy',
    borrower_code: '50220912',
    borrower_class: 'K26 KTMT',
    incident_type: 'LOST',
    description: 'Báo mất sách giáo trình trong quá trình đi thực tập thực tế tại doanh nghiệp.',
    book_price: 150000,
    compensation_amount: 150000,
    created_at: '15/09/2026',
    created_by: 'Thủ thư Quản trị viên',
    status: 'RESOLVED',
  },
  {
    id: 'INC-2026-010',
    incident_code: 'BB-2026-010',
    loan_code: 'PM-2026-0004',
    barcode: 'BC-2026-0033',
    book_title: 'Xác suất Thống kê ứng dụng trong Khoa học Dữ liệu',
    borrower_name: 'Trịnh Thu Hà',
    borrower_code: '50200889',
    borrower_class: 'K24 KHDL',
    incident_type: 'DAMAGED',
    description: 'Rách rời hoàn toàn trang bìa trước và sau, các trang mục lục bị xé rách vụn không thể tái sử dụng.',
    book_price: 88000,
    compensation_amount: 88000,
    created_at: '12/09/2026',
    created_by: 'Thủ thư Trần Đình Tuấn',
    status: 'RESOLVED',
  },
];

const STORAGE_KEY = 'libmanager_admin_incidents';

export const getStoredIncidents = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_INCIDENTS));
  return INITIAL_INCIDENTS;
};

export const setStoredIncidents = (incidents) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
};

export const addStoredIncident = (newIncident) => {
  const current = getStoredIncidents();
  const updated = [newIncident, ...current];
  setStoredIncidents(updated);
  return updated;
};

/** 4-15.c: cập nhật trạng thái biên bản (PENDING → RECORDED → RESOLVED). */
export const updateStoredIncidentStatus = (id, status) => {
  const current = getStoredIncidents();
  const updated = current.map((item) => (item.id === id ? { ...item, status } : item));
  setStoredIncidents(updated);
  return updated;
};
