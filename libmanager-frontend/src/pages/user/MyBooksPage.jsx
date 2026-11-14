import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, BookMarked, FileText, CheckCircle2, AlertTriangle, Clock, MapPin, BellRing } from 'lucide-react';
import { Table, StatusBadge } from '../../components/Table';
import { Button } from '../../components/Button';
import { loanService, ACTIVE_LOAN_STATES, WAITING_PICKUP_STATES } from '../../services/loanService';
import WaitlistTab from '../../components/user/WaitlistTab';

/**
 * Trang Sách của tôi (My Books Page) — nối API ở 3-12.b
 * Tham chiếu Figma Node 46:6 (Desktop) & Node 66:5 (Mobile)
 *
 * Dữ liệu: GET /api/loans/me qua loanService (phiếu vật lý và eBook, mới nhất trước).
 * - Desktop: Table với cột riêng của độc giả, không có nút Sửa/Xóa của Admin.
 * - Mobile: danh sách thẻ.
 * - Tab "Đặt trước" (3-13, ?tab=waitlist): vị trí hàng chờ, giữ chỗ, hủy (WaitlistTab).
 * - Sách in nhận và trả tại quầy (thủ thư quét mã, UC10/UC11) nên trang chỉ hướng dẫn;
 *   phiếu eBook còn hiệu lực có nút Đọc online (/reader/:loanId), trả eBook trong trình đọc.
 */

// "HH:mm dd/MM" theo giờ Việt Nam (ICU vi-VN tự in "dd-MM" khi bỏ năm, nên ghép tay).
const shortDateTime = (value) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}`;
};
const shortDate = (value) => (value
  ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—');

const isActive = (loan) => ACTIVE_LOAN_STATES.includes(loan.state);
const isWaitingPickup = (loan) => WAITING_PICKUP_STATES.includes(loan.state);
const canRead = (loan) => loan.isEbook && isActive(loan);

// Cột "Hạn": phiếu chờ nhận chưa có hạn trả (tính khi nhận sách) nên hiện hạn nhận tại quầy.
function DueText({ loan }) {
  if (isWaitingPickup(loan) && loan.pickupDeadline) {
    return <span className="font-semibold text-indigo-700">Nhận trước {shortDateTime(loan.pickupDeadline)}</span>;
  }
  if (loan.state === 'RETURNED') {
    return <span className="font-semibold text-slate-400">Trả ngày {shortDate(loan.returnDate ?? loan.dueDate)}</span>;
  }
  if (!isActive(loan)) return <span className="text-slate-400">—</span>;
  return (
    <span className={`font-semibold ${loan.state === 'OVERDUE' ? 'text-rose-600' : 'text-amber-700'}`}>
      {shortDate(loan.dueDate)}
    </span>
  );
}

// Thao tác của một phiếu: eBook đọc online; sách in thì nhắc việc cần làm tại quầy.
function LoanAction({ loan, fullWidth = false }) {
  if (canRead(loan)) {
    return (
      <Link to={`/reader/${loan.id}`} className={fullWidth ? 'flex-1' : undefined}>
        <Button size="sm" variant="outline" fullWidth={fullWidth} icon={<FileText className="w-3.5 h-3.5" />}>
          Đọc online
        </Button>
      </Link>
    );
  }
  const hint = isWaitingPickup(loan)
    ? `Đưa mã ${loan.loanCode} cho thủ thư để nhận sách`
    : loan.state === 'OVERDUE'
      ? 'Quá hạn — trả tại quầy sớm để tránh phạt thêm'
      : isActive(loan)
        ? 'Trả sách tại quầy thư viện'
        : 'Đã hoàn tất';
  return (
    <span className={`text-xs font-medium whitespace-normal ${loan.state === 'OVERDUE' ? 'text-rose-600' : 'text-slate-500'}`}>
      {hint}
    </span>
  );
}

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
          {row.isEbook ? <FileText className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
        </div>
        {/* Table dùng whitespace-nowrap; cột này cho xuống dòng để bảng không tràn ở 1440px */}
        <div className="flex flex-col w-64 whitespace-normal">
          <Link to={`/books/${row.bookId}`} className="font-semibold text-slate-900 line-clamp-2 hover:text-indigo-600">{val}</Link>
          <span className="text-xs text-slate-500 line-clamp-1">
            {[row.author, row.isEbook ? 'eBook' : 'Sách in'].filter(Boolean).join(' • ')}
          </span>
        </div>
      </div>
    ),
  },
  {
    key: 'borrowDate',
    header: 'Ngày đặt',
    align: 'left',
    render: (val) => <span className="text-slate-600 font-medium">{shortDate(val)}</span>,
  },
  {
    key: 'dueDate',
    header: 'Hạn',
    align: 'left',
    render: (_, row) => <DueText loan={row} />,
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
    render: (_, row) => <div className="inline-flex justify-end max-w-[220px] text-right"><LoanAction loan={row} /></div>,
  },
];

function StatCard({ icon, label, value, tone }) {
  const tones = {
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-600 [&_strong]:text-indigo-900',
    rose: 'bg-rose-50 border-rose-100 text-rose-600 [&_strong]:text-rose-900',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600 [&_strong]:text-emerald-900',
  };
  return (
    <div className={`px-3 sm:px-4 py-2.5 border rounded-xl flex items-center gap-2.5 ${tones[tone]}`}>
      {icon}
      <div>
        <div className="text-xs font-medium">{label}</div>
        <strong className="block text-base font-bold">{value}</strong>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'loans', label: 'Phiếu mượn', icon: BookMarked },
  { id: 'waitlist', label: 'Đặt trước', icon: BellRing },
];

export default function MyBooksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'waitlist' ? 'waitlist' : 'loans';
  const selectTab = (id) => setSearchParams(id === 'loans' ? {} : { tab: id }, { replace: true });
  const [waitlistCount, setWaitlistCount] = useState(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const [result, setResult] = useState({ key: -1, loans: null, error: null });

  useEffect(() => {
    let cancelled = false;
    loanService.getMyLoans()
      .then((loans) => !cancelled && setResult({ key: revision, loans, error: null }))
      .catch((error) => !cancelled && setResult({ key: revision, loans: null, error }));
    return () => { cancelled = true; };
  }, [revision]);

  const loading = result.key !== revision;
  const loans = result.loans ?? [];

  // Thống kê nhanh (phiếu Chờ nhận cũng tính vào hạn mức, 3-01.a)
  const activeCount = loans.filter(isActive).length;
  const overdueCount = loans.filter((loan) => loan.state === 'OVERDUE').length;
  const returnedCount = loans.filter((loan) => loan.state === 'RETURNED').length;
  const pickups = loans.filter(isWaitingPickup);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 space-y-8">

      {/* Page Title & Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-headline-lg text-[#172033] font-semibold tracking-tight">
            Sách của tôi
          </h1>
          <p className="text-body-md text-[#5B6B82] mt-1">
            Theo dõi phiếu mượn, hàng chờ đặt trước và đọc sách điện tử
          </p>
        </div>

        {result.loans && (
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-3">
            <StatCard tone="indigo" label="Đang mượn" value={`${activeCount} cuốn`} icon={<BookMarked className="w-4 h-4 shrink-0" />} />
            <StatCard tone="rose" label="Quá hạn" value={`${overdueCount} cuốn`} icon={<AlertTriangle className="w-4 h-4 shrink-0" />} />
            <StatCard tone="emerald" label="Đã trả" value={`${returnedCount} cuốn`} icon={<CheckCircle2 className="w-4 h-4 shrink-0" />} />
          </div>
        )}
      </div>

      <div role="tablist" aria-label="Sách của tôi" className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map(({ id, label, icon: Icon }) => {
          const count = id === 'loans' ? (result.loans ? loans.length : null) : waitlistCount;
          const selected = tab === id;
          return (
            <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={selected} aria-controls={`panel-${id}`}
              onClick={() => selectTab(id)}
              className={`inline-flex items-center gap-2 min-h-10 px-4 rounded-xl text-sm font-semibold border whitespace-nowrap transition-colors ${selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
              <Icon className="w-4 h-4" />{label}
              {count != null && <span className={`rounded-full px-1.5 text-xs ${selected ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'waitlist' && (
        <div role="tabpanel" id="panel-waitlist" aria-labelledby="tab-waitlist">
          <WaitlistTab onCountChange={setWaitlistCount} />
        </div>
      )}

      {tab === 'loans' && <div role="tabpanel" id="panel-loans" aria-labelledby="tab-loans" className="space-y-8">
      {/* Nhắc phiếu đang chờ nhận: quá 24 giờ chưa tới quầy thì phiếu tự hủy */}
      {pickups.length > 0 && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 flex items-start gap-3 text-sm text-indigo-900">
          <Clock className="w-5 h-5 shrink-0 mt-0.5 text-indigo-600" />
          <div className="space-y-1">
            <p className="font-semibold">Bạn có {pickups.length} phiếu đang chờ nhận sách tại quầy</p>
            <p>Đưa mã phiếu cho thủ thư trước hạn nhận; quá hạn, phiếu tự hủy và sách được trả về kệ.</p>
          </div>
        </div>
      )}

      {loading && !result.loans && (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-24 rounded-2xl border border-[#D9E2EE] bg-white animate-pulse" />
          ))}
        </div>
      )}

      {!loading && result.error && (
        <div role="alert" className="py-10 bg-white rounded-2xl border border-rose-200 text-center space-y-3 px-6">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="font-semibold text-slate-800">Không tải được danh sách phiếu mượn</p>
          <p className="text-sm text-slate-500">
            {result.error.response?.status === 401
              ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
              : 'Không kết nối được máy chủ thư viện. Vui lòng thử lại.'}
          </p>
          <Button variant="outline" onClick={reload}>Thử lại</Button>
        </div>
      )}

      {result.loans && (
        <>
          {/* DESKTOP VIEW: Tái sử dụng Table với Custom Columns */}
          <div className="hidden md:block">
            <Table
              title="Phiếu mượn tài liệu cá nhân"
              subtitle="Tất cả phiếu mượn sách in và eBook của bạn"
              columns={loanColumns}
              data={loans}
              emptyMessage="Bạn chưa có phiếu mượn tài liệu nào trong thư viện"
              footerNote="Hạn trả tính từ lúc nhận sách tại quầy: sinh viên 14 ngày, giảng viên 30 ngày"
              pagination={true}
              itemsPerPage={5}
            />
          </div>

          {/* MOBILE VIEW: Card List chuẩn Figma Node 66:5 */}
          <div className="md:hidden space-y-4">
            {loans.length > 0 ? (
              loans.map((loan) => (
                <div key={loan.id} className="bg-white rounded-2xl border border-[#D9E2EE] p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded truncate">
                      {loan.loanCode}
                    </span>
                    <StatusBadge status={loan.status} type={loan.statusType} />
                  </div>

                  <div>
                    <Link to={`/books/${loan.bookId}`} className="text-base font-bold text-slate-900 line-clamp-2 break-words">
                      {loan.bookTitle}
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[loan.author, loan.isEbook ? 'eBook' : 'Sách in'].filter(Boolean).join(' • ')}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100">
                    <div>
                      <span className="text-slate-400 block">Ngày đặt:</span>
                      <span className="font-medium text-slate-700">{shortDate(loan.borrowDate)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Hạn:</span>
                      <DueText loan={loan} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {!canRead(loan) && isActive(loan) && <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    <LoanAction loan={loan} fullWidth />
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
        </>
      )}
      </div>}
    </div>
  );
}
