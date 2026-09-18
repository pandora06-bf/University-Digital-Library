import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, BookMarked, FileText, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';
import { Table, StatusBadge } from '../../components/Table';
import { Button } from '../../components/Button';
import { getStoredLoans, returnBookAction } from '../../mocks/loans';

/**
 * Trang Sách của tôi (My Books Page)
 * Tham chiếu Figma Node 46:6 (Desktop) & Node 66:5 (Mobile)
 * 
 * Bố cục:
 * - Desktop 1440: Sử dụng Table với custom columns, không hiện cột tồn kho hay nút Sửa/Xóa của Admin.
 * - Mobile 390: Chuyển đổi linh hoạt sang dạng thẻ (Card list) tối ưu cho màn hình nhỏ.
 * - Tính năng: Đọc sách trực tuyến (/reader/:loanId), Trả sách, cập nhật realtime.
 */
export default function MyBooksPage() {
  const [loans, setLoans] = useState(getStoredLoans);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleReturn = (loanId) => {
    const res = returnBookAction(loanId);
    if (res.success) {
      showToast('Đã hoàn trả tài liệu thành công!', 'success');
      setLoans(getStoredLoans());
    } else {
      showToast(res.message, 'error');
    }
  };

  // Thống kê nhanh
  const activeLoansCount = loans.filter((l) => l.status === 'Đang mượn').length;
  const returnedCount = loans.filter((l) => l.status === 'Đã trả').length;

  // Cấu hình Custom Columns cho Table của User Portal
  const loanColumns = [
    {
      key: 'loanCode',
      header: 'Mã phiếu',
      align: 'left',
      render: (val) => <span className="font-mono text-indigo-600 font-semibold">{val}</span>,
    },
    {
      key: 'bookTitle',
      header: 'Tài liệu & Tác giả',
      align: 'left',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-11 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="flex flex-col max-w-sm">
            <span className="font-semibold text-slate-900 line-clamp-1">{val}</span>
            <span className="text-xs text-slate-500 line-clamp-1">{row.author} • ISBN: {row.isbn}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'borrowDate',
      header: 'Ngày mượn',
      align: 'left',
      render: (val) => <span className="text-slate-600 font-medium">{val}</span>,
    },
    {
      key: 'dueDate',
      header: 'Hạn trả',
      align: 'left',
      render: (val, row) => (
        <span className={`font-semibold ${row.status === 'Đã trả' ? 'text-slate-400' : 'text-amber-700'}`}>
          {val}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      align: 'center',
      render: (val, row) => <StatusBadge status={val} type={row.statusType} />,
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (_, row) => (
        <div className="inline-flex items-center gap-2">
          {row.pdfAvailable && row.status !== 'Đã trả' && (
            <Link to={`/reader/${row.id}`}>
              <Button size="sm" variant="outline" icon={<FileText className="w-3.5 h-3.5" />}>
                Đọc online
              </Button>
            </Link>
          )}
          {row.status === 'Đang mượn' ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-600 hover:bg-rose-50"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => handleReturn(row.id)}
            >
              Trả sách
            </Button>
          ) : (
            <span className="text-xs text-slate-400 font-medium px-2 py-1">Đã hoàn tất</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 space-y-8">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2 border ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-rose-600 text-white border-rose-500'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Page Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-headline-lg text-[#172033] font-semibold tracking-tight">
            Sách của tôi
          </h1>
          <p className="text-body-md text-[#5B6B82] mt-1">
            Theo dõi danh sách tài liệu đang mượn, gia hạn và đọc sách điện tử
          </p>
        </div>

        {/* Quick Stats Cards */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-2.5">
            <BookMarked className="w-4 h-4 text-indigo-600" />
            <div>
              <div className="text-xs text-indigo-600 font-medium">Đang mượn</div>
              <div className="text-base font-bold text-indigo-900">{activeLoansCount} cuốn</div>
            </div>
          </div>

          <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <div>
              <div className="text-xs text-emerald-600 font-medium">Đã trả</div>
              <div className="text-base font-bold text-emerald-900">{returnedCount} cuốn</div>
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP VIEW: Tái sử dụng Table với Custom Columns */}
      <div className="hidden md:block">
        <Table
          title="Phiếu mượn tài liệu cá nhân"
          subtitle="Tất cả các bản ghi mượn và đọc trực tuyến của bạn"
          columns={loanColumns}
          data={loans}
          emptyMessage="Bạn chưa có phiếu mượn tài liệu nào trong thư viện"
          footerNote="Hạn mượn tối đa 14 ngày kể từ ngày tạo phiếu"
          pagination={true}
          itemsPerPage={5}
        />
      </div>

      {/* MOBILE VIEW: Card List chuẩn Figma Node 66:5 */}
      <div className="md:hidden space-y-4">
        {loans.length > 0 ? (
          loans.map((loan) => (
            <div
              key={loan.id}
              className="bg-white rounded-2xl border border-[#D9E2EE] p-4 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {loan.loanCode}
                </span>
                <StatusBadge status={loan.status} type={loan.statusType} />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 line-clamp-2">
                  {loan.bookTitle}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{loan.author}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100">
                <div>
                  <span className="text-slate-400 block">Ngày mượn:</span>
                  <span className="font-medium text-slate-700">{loan.borrowDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Hạn trả:</span>
                  <span className={`font-semibold ${loan.status === 'Đã trả' ? 'text-slate-400' : 'text-amber-700'}`}>
                    {loan.dueDate}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {loan.pdfAvailable && loan.status !== 'Đã trả' && (
                  <Link to={`/reader/${loan.id}`} className="flex-1">
                    <Button size="sm" variant="outline" fullWidth icon={<FileText className="w-3.5 h-3.5" />}>
                      Đọc online
                    </Button>
                  </Link>
                )}

                {loan.status === 'Đang mượn' && (
                  <div className="flex-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      fullWidth
                      className="text-rose-600 hover:bg-rose-50"
                      icon={<RotateCcw className="w-3.5 h-3.5" />}
                      onClick={() => handleReturn(loan.id)}
                    >
                      Trả sách
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center p-6 space-y-3">
            <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-slate-800">Chưa có phiếu mượn</div>
            <p className="text-xs text-slate-500">Khám phá danh mục để mượn sách bạn cần.</p>
            <Link to="/catalog">
              <Button size="sm" variant="primary">Khám phá Danh mục</Button>
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}
