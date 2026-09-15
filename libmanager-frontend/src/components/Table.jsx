import React from 'react';

/**
 * MOCK DATA: Dữ liệu mẫu 4 dòng đại diện cho hệ thống Thư viện LibManage
 * Hỗ trợ kiểm thử và render ngay trên giao diện mà chưa cần tích hợp Backend API.
 */
const DEFAULT_MOCK_DATA = [
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

/**
 * Component hiển thị Status Badge theo chuẩn thiết kế LibManage
 */
const StatusBadge = ({ status, type = 'neutral' }) => {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  const dotStyles = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    neutral: 'bg-slate-400',
  };

  const currentStyle = styles[type] || styles.neutral;
  const currentDot = dotStyles[type] || dotStyles.neutral;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border select-none ${currentStyle}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${currentDot}`} />
      {status}
    </span>
  );
};

/**

 * - Mobile Responsiveness: Bọc toàn bộ bảng bằng container `w-full overflow-x-auto whitespace-nowrap`
 * - Styling tổng thể: `bg-white rounded-xl shadow-sm border border-slate-200`
 * - Header Row: `bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 text-left`
 * - Data Cells: `text-sm text-slate-700 border-b border-slate-100 py-4 px-4`
 * 
 * Props:
 * @param {Array} data - Mảng dữ liệu nguồn (mặc định sử dụng DEFAULT_MOCK_DATA gồm 4 dòng)
 * @param {Array} columns - Tùy biến cột (tùy chọn). Nếu không truyền sẽ dùng bộ cột mặc định
 * @param {function} onEdit - Hàm callback khi click Sửa
 * @param {function} onDelete - Hàm callback khi click Xóa
 * @param {string} className - Class tùy biến thêm cho wrapper
 */
export const Table = ({
  data = DEFAULT_MOCK_DATA,
  columns,
  onEdit,
  onDelete,
  className = '',
  title,
  subtitle,
  actions
}) => {
  return (
    <div className={`w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      {/* Table Top Header (nếu có tiêu đề hoặc action toolbar) */}
      {(title || actions) && (
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white">
          <div>
            {title && <h3 className="text-base sm:text-lg font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* CRITICAL: Mobile responsive wrapper với overflow-x-auto và whitespace-nowrap */}
      <div className="w-full overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-slate-200">
        <table className="w-full text-left border-collapse">
          {/* Header Row */}
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th scope="col" className="py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider text-left">
                Mã Barcode
              </th>
              <th scope="col" className="py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider text-left">
                Tên Sách & Tác Giả
              </th>
              <th scope="col" className="py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider text-left">
                Thể Loại
              </th>
              <th scope="col" className="py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider text-left">
                Vị Trí Kệ
              </th>
              <th scope="col" className="py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider text-left">
                Bản Sao
              </th>
              <th scope="col" className="py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider text-left">
                Trạng Thái
              </th>
              <th scope="col" className="py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider text-right">
                Thao Tác
              </th>
            </tr>
          </thead>

          {/* Data Rows */}
          <tbody className="divide-y divide-slate-100 bg-white">
            {data && data.length > 0 ? (
              data.map((row) => (
                <tr
                  key={row.id || row.barcode}
                  className="hover:bg-slate-50/70 transition-colors duration-150"
                >
                  {/* Barcode */}
                  <td className="py-4 px-4 text-sm font-semibold text-indigo-600 border-b border-slate-100">
                    <span className="bg-indigo-50 px-2 py-1 rounded-md text-xs font-mono">
                      {row.barcode}
                    </span>
                  </td>

                  {/* Title & Author */}
                  <td className="py-4 px-4 border-b border-slate-100">
                    <div className="flex flex-col max-w-xs sm:max-w-md">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {row.title}
                      </span>
                      <span className="text-xs text-slate-500 truncate mt-0.5">
                        {row.author} • ISBN: {row.isbn}
                      </span>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-4 px-4 text-sm text-slate-700 border-b border-slate-100">
                    <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-md font-medium">
                      {row.category}
                    </span>
                  </td>

                  {/* Location */}
                  <td className="py-4 px-4 text-sm text-slate-700 border-b border-slate-100">
                    {row.location}
                  </td>

                  {/* Copies count */}
                  <td className="py-4 px-4 text-sm text-slate-700 font-medium border-b border-slate-100">
                    {row.availableCopies}
                  </td>

                  {/* Status badge */}
                  <td className="py-4 px-4 border-b border-slate-100">
                    <StatusBadge status={row.status} type={row.statusType} />
                  </td>

                  {/* Actions (Ghost Buttons) */}
                  <td className="py-4 px-4 text-right border-b border-slate-100">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit && onEdit(row)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Chỉnh sửa"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete && onDelete(row)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Xóa"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                  Không tìm thấy bản ghi nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer: Tóm tắt số lượng & phân trang mô phỏng */}
      <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Hiển thị <strong>{data.length}</strong> trên <strong>{data.length}</strong> bản ghi</span>
        <span className="font-medium text-slate-400">Dữ liệu thử nghiệm cục bộ</span>
      </div>
    </div>
  );
};

export default Table;
