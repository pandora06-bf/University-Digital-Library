/**
 * Mock FE cho /admin/ebooks (UI demo).
 * Upload/preview API thật: POST /api/admin/books/{id}/upload-pdf, GET /api/ebooks/{id}/preview.
 */

const STORAGE_KEY = 'libmanager_admin_ebooks_v1';

export const INITIAL_ADMIN_EBOOKS = [
  {
    id: 101,
    title: 'Cấu trúc Dữ liệu và Giải thuật',
    filename: 'cau-truc-du-lieu-tdtu-2023.pdf',
    size: '15.4 MB',
    uploadDate: '10/09/2026',
    status: 'Sẵn sàng',
    previewPages: 8,
    isFree: false,
  },
  {
    id: 102,
    title: 'Nhập môn Lập trình Web',
    filename: 'web-dev-basics-v2.pdf',
    size: '22.1 MB',
    uploadDate: '12/09/2026',
    status: 'Sẵn sàng',
    previewPages: 10,
    isFree: false,
  },
  {
    id: 103,
    title: 'Mạng Máy Tính Hiện Đại',
    filename: 'mang-may-tinh-hien-dai.pdf',
    size: '8.7 MB',
    uploadDate: '15/09/2026',
    status: 'Sẵn sàng',
    previewPages: 5,
    isFree: true,
  },
  {
    id: 104,
    title: 'Cơ sở dữ liệu nâng cao',
    filename: 'csdl-nang-cao.pdf',
    size: '12.3 MB',
    uploadDate: '16/09/2026',
    status: 'Sẵn sàng',
    previewPages: 10,
    isFree: false,
  },
  {
    id: 105,
    title: 'Trí tuệ nhân tạo cơ bản',
    filename: 'ai-basics.pdf',
    size: '18.9 MB',
    uploadDate: '19/09/2026',
    status: 'Sẵn sàng',
    previewPages: 7,
    isFree: false,
  },
  {
    id: 106,
    title: 'Bảo mật thông tin',
    filename: 'security-101.pdf',
    size: '9.4 MB',
    uploadDate: '20/09/2026',
    status: 'Sẵn sàng',
    previewPages: 6,
    isFree: false,
  },
  {
    id: 107,
    title: 'Kiến trúc máy tính',
    filename: 'computer-architecture.pdf',
    size: '11.1 MB',
    uploadDate: '21/09/2026',
    status: 'Sẵn sàng',
    previewPages: 10,
    isFree: false,
  },
  {
    id: 108,
    title: 'Phân tích dữ liệu với Python',
    filename: 'data-analysis.pdf',
    size: '14.8 MB',
    uploadDate: '23/09/2026',
    status: 'Sẵn sàng',
    previewPages: 9,
    isFree: true,
  },
];

export const DEMO_EBOOK_BOOK_OPTIONS = INITIAL_ADMIN_EBOOKS.map((e) => ({
  id: e.id,
  title: e.title,
}));

export function getStoredAdminEbooks() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const list = INITIAL_ADMIN_EBOOKS.map((x) => ({ ...x }));
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

function save(list) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function resetAdminEbooks() {
  sessionStorage.removeItem(STORAGE_KEY);
  return getStoredAdminEbooks();
}

export function upsertAdminEbook(entry) {
  const list = getStoredAdminEbooks();
  const idx = list.findIndex((r) => String(r.id) === String(entry.id));
  const row = {
    id: entry.id,
    title: entry.title,
    filename: entry.filename,
    size: entry.size || '—',
    uploadDate: entry.uploadDate || new Date().toLocaleDateString('vi-VN'),
    status: 'Sẵn sàng',
    previewPages: entry.previewPages ?? 10,
    isFree: Boolean(entry.isFree),
  };
  if (idx >= 0) list[idx] = { ...list[idx], ...row };
  else list.unshift(row);
  return save(list);
}
