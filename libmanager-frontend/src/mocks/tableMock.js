/**
 * Dữ liệu mẫu 4 dòng đại diện cho bảng kiểm thử kho thư viện của Vân
 */
export const DEFAULT_MOCK_DATA = [
  {
    id: 1,
    barcode: 'BC-2026-00091',
    title: 'Lập trình Web hiện đại với React & TypeScript',
    author: 'Dan Vanderkam, TS. Phạm Văn Bình',
    isbn: '978-604-2-0192',
    category: 'CNTT & Phần mềm',
    publishYear: 2024,
    location: 'Kệ A2 — Tầng 2 (Khu IT)',
    status: 'Sẵn sàng',
    statusType: 'success', // success | warning | danger | neutral
    availableCopies: '12/15 cuốn'
  },
  {
    id: 2,
    barcode: 'BC-2026-00092',
    title: 'Cấu trúc dữ liệu & Giải thuật nâng cao',
    author: 'Đỗ Xuân Lôi, Lê Minh Hoàng',
    isbn: '978-604-5-8921',
    category: 'Giáo trình ĐH',
    publishYear: 2023,
    location: 'Kệ B1 — Tầng 1',
    status: 'Đang mượn',
    statusType: 'warning',
    availableCopies: '5/40 cuốn'
  },
  {
    id: 3,
    barcode: 'BC-2024-05112',
    title: 'Kinh tế vi mô ứng dụng trong quản trị',
    author: 'NXB Kinh tế Quốc dân',
    isbn: '978-604-5-8812',
    category: 'Kinh tế & QTKD',
    publishYear: 2022,
    location: 'Phòng Kỹ thuật phục chế (Kệ C4)',
    status: 'Cần sửa chữa',
    statusType: 'danger',
    availableCopies: '0/8 cuốn'
  },
  {
    id: 4,
    barcode: 'BC-2026-00431',
    title: 'Trí tuệ nhân tạo & Machine Learning thực chiến',
    author: 'Vũ Tiến Dũng, Hoàng Minh Đức',
    isbn: '978-604-9-4432',
    category: 'Khoa học Công nghệ',
    publishYear: 2025,
    location: 'Kệ A1 — Tầng 2 (Khu AI)',
    status: 'Sẵn sàng',
    statusType: 'success',
    availableCopies: '14/16 cuốn'
  }
];
