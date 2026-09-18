import React, { useState } from 'react';
import { DEFAULT_MOCK_DATA } from '../mocks/tableMock';
import { Button } from './Button';

/**
 * Component hiển thị Status Badge theo chuẩn thiết kế LibManager
 */
export const StatusBadge = ({ status, type = 'neutral' }) => {
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
 * Component Table dùng chung cho cả User Portal (Đạt) và Admin (Vân)
 * 
 * Hỗ trợ 2 chế độ:
 * 1. Chế độ Custom Columns: Truyền mảng `columns` với các định nghĩa { key, header, render, align }
 *    Thích hợp cho User Portal (Phiếu mượn sách, lịch sử đọc...)
 * 2. Chế độ Preset 7 cột tồn kho mặc định: Khi không truyền `columns`, giữ nguyên định dạng quản lý kho của Vân.
 * 
 * An toàn dữ liệu:
 * - Chuẩn hóa data = null / undefined -> mảng rỗng.
 * - Hỗ trợ prop loading với loading indicator và colSpan động theo số cột thực tế.
 * - Hỗ trợ custom emptyMessage và rowKey linh hoạt.
 */
export const Table = ({
  data,
  columns,
  onEdit,
  onDelete,
  className = '',
  title,
  subtitle,
  actions,
  loading = false,
  emptyMessage = 'Không tìm thấy bản ghi nào',
  rowKey,
  footerNote,
  pagination = false,
  itemsPerPage = 5,
}) => {
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Xác định dữ liệu an toàn
  const isCustomColumns = Array.isArray(columns) && columns.length > 0;

  // Nếu không truyền columns và data là undefined -> dùng mock data mặc định
  let safeData = [];
  if (data === undefined && !isCustomColumns) {
    safeData = DEFAULT_MOCK_DATA;
  } else if (Array.isArray(data)) {
    safeData = data;
  }

  // Pagination Logic
  const totalPages = Math.ceil(safeData.length / itemsPerPage);
  const displayData = pagination 
    ? safeData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : safeData;

  // Reset trang về 1 nếu dữ liệu thay đổi
  React.useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  // Số lượng cột đang hiển thị
  const totalColumns = isCustomColumns ? columns.length : 7;

  // Lấy key cho từng row
  const getRowKey = (row, index) => {
    if (typeof rowKey === 'function') return rowKey(row, index);
    if (typeof rowKey === 'string' && row[rowKey] !== undefined) return row[rowKey];
    if (row.id !== undefined && row.id !== null) return row.id;
    if (row.barcode) return row.barcode;
    return index;
  };

  return (
    <div className={`w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      {/* Table Top Header */}
      {(title || actions) && (
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white">
          <div>
            {title && <h3 className="text-base sm:text-lg font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Table responsive container */}
      <div className="w-full overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-slate-200">
        <table className="w-full text-left border-collapse">
          {/* Header Row */}
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {isCustomColumns ? (
                columns.map((col, idx) => {
                  const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                  return (
                    <th
                      key={col.key || idx}
                      scope="col"
                      className={`py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider ${alignClass}`}
                    >
                      {col.header}
                    </th>
                  );
                })
              ) : (
                /* Preset 7 cột tồn kho thư viện */
                <>
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
                </>
              )}
            </tr>
          </thead>

          {/* Data Rows */}
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={totalColumns} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm font-medium">Đang tải dữ liệu...</span>
                  </div>
                </td>
              </tr>
            ) : safeData.length > 0 ? (
              displayData.map((row, rowIndex) => {
                const key = getRowKey(row, rowIndex);

                if (isCustomColumns) {
                  return (
                    <tr key={key} className="hover:bg-slate-50/70 transition-colors duration-150">
                      {columns.map((col, colIdx) => {
                        const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                        const cellValue = row[col.key];
                        return (
                          <td key={col.key || colIdx} className={`py-4 px-4 text-sm text-slate-700 border-b border-slate-100 ${alignClass}`}>
                            {col.render ? col.render(cellValue, row, rowIndex) : cellValue}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }

                // Preset render 7 cột gốc
                return (
                  <tr
                    key={key}
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

                    {/* Actions */}
                    <td className="py-4 px-4 text-right border-b border-slate-100">
                      <div className="inline-flex items-center gap-1.5">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(row)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Chỉnh sửa"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(row)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Xóa"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={totalColumns} className="py-10 text-center text-sm text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      {pagination && totalPages > 1 ? (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-white rounded-b-2xl">
          <span className="text-sm text-slate-500">
            Trang <strong className="font-semibold text-slate-700">{currentPage}</strong> / {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Trước
            </Button>
            <div className="flex items-center px-2 gap-1">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                    currentPage === idx + 1 
                      ? 'bg-indigo-600 text-white' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Sau
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Hiển thị <strong>{displayData.length}</strong> trên <strong>{safeData.length}</strong> bản ghi</span>
          {footerNote && <span className="font-medium text-slate-400">{footerNote}</span>}
        </div>
      )}
    </div>
  );
};

export default Table;
