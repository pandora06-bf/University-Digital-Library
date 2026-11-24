import { useState } from 'react';
import { DEFAULT_MOCK_DATA } from '../mocks/tableMock';
import { Button } from './Button';
import { AdminIconButton } from './AdminIconButton';

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
  /** Phân trang server: truyền page + totalPages + onPageChange — không cắt mảng data phía client */
  page: controlledPage,
  totalPages: controlledTotalPages,
  totalItems,
  onPageChange,
}) => {
  const isServerPaging = typeof onPageChange === 'function'
    && controlledTotalPages !== undefined
    && controlledTotalPages !== null;

  // Pagination State (client-side only)
  const [pageState, setPageState] = useState({ data, page: 1 });
  const clientPage = pageState.data === data ? pageState.page : 1;
  const changeClientPage = (next) => setPageState({ data, page: next });

  const currentPage = isServerPaging ? (controlledPage || 1) : clientPage;
  const changePage = (next) => {
    if (isServerPaging) onPageChange(next);
    else changeClientPage(next);
  };

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
  const totalPages = isServerPaging
    ? Math.max(1, Number(controlledTotalPages) || 1)
    : Math.ceil(safeData.length / itemsPerPage);
  const displayData = pagination && !isServerPaging
    ? safeData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : safeData;
  const totalCount = isServerPaging
    ? (totalItems ?? safeData.length)
    : safeData.length;

  // Số lượng cột đang hiển thị
  const totalColumns = isCustomColumns ? columns.length : 7;
  const hasFixedWidths = isCustomColumns && columns.some((col) => col.width);

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
      <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
        <table className={`w-full text-left border-collapse ${hasFixedWidths ? 'table-fixed min-w-[60.5rem]' : ''}`}>
          {hasFixedWidths && (
            <colgroup>
              {columns.map((col, idx) => (
                <col key={col.key || idx} style={col.width ? { width: col.width } : undefined} />
              ))}
            </colgroup>
          )}
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
                      className={`py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider ${alignClass} ${hasFixedWidths ? 'overflow-hidden' : ''}`}
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
                          <td key={col.key || colIdx} className={`py-3 px-4 text-sm text-slate-700 border-b border-slate-100 align-middle ${alignClass} ${hasFixedWidths ? 'overflow-hidden' : ''}`}>
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
                    <td className="py-3 px-4 text-sm font-semibold text-indigo-600 border-b border-slate-100 align-middle">
                      <span className="bg-indigo-50 px-2 py-1 rounded-md text-xs font-mono">
                        {row.barcode}
                      </span>
                    </td>

                    {/* Title & Author */}
                    <td className="py-3 px-4 border-b border-slate-100 align-middle">
                      <div className="flex flex-col max-w-xs sm:max-w-md min-w-0">
                        <span className="text-sm font-semibold text-slate-900 truncate" title={row.title}>
                          {row.title}
                        </span>
                        <span className="text-xs text-slate-500 truncate mt-0.5">
                          {row.author} • ISBN: {row.isbn}
                        </span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 text-sm text-slate-700 border-b border-slate-100 align-middle">
                      <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-md font-medium whitespace-nowrap">
                        {row.category}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="py-3 px-4 text-sm text-slate-700 border-b border-slate-100 align-middle max-w-[140px] truncate" title={row.location}>
                      {row.location}
                    </td>

                    {/* Copies count */}
                    <td className="py-3 px-4 text-sm text-slate-700 font-medium border-b border-slate-100 align-middle whitespace-nowrap">
                      {row.availableCopies}
                    </td>

                    {/* Status badge */}
                    <td className="py-3 px-4 border-b border-slate-100 align-middle">
                      <StatusBadge status={row.status} type={row.statusType} />
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right border-b border-slate-100 align-middle">
                      <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        {onEdit && (
                          <AdminIconButton
                            onClick={() => onEdit(row)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                            title="Chỉnh sửa"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </AdminIconButton>
                        )}
                        {onDelete && (
                          <AdminIconButton
                            onClick={() => onDelete(row)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
                            title="Xóa"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </AdminIconButton>
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

      {/* Table Footer — nằm ngoài vùng cuộn bảng để không bị cắt trên màn hẹp */}
      {pagination && totalPages > 1 ? (
        <div className="px-4 py-3 border-t border-slate-100 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-500">
            Hiển thị <strong>{displayData.length}</strong> trên <strong>{totalCount}</strong> bản ghi
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Trước
            </Button>
            <div className="flex flex-wrap items-center px-2 gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }).map((_, idx) => {
                let pageNum = idx + 1;
                if (totalPages > 7) {
                  const start = Math.min(Math.max(1, currentPage - 3), totalPages - 6);
                  pageNum = start + idx;
                }
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => changePage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                      currentPage === pageNum
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Sau
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <span>Hiển thị <strong>{displayData.length}</strong> trên <strong>{totalCount}</strong> bản ghi</span>
          {footerNote && <span className="font-medium text-slate-400">{footerNote}</span>}
        </div>
      )}
    </div>
  );
};

export default Table;
