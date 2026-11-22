import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen, BookMarked, FileText, AlertTriangle, Clock, MapPin,
  BellRing, Receipt, History, RefreshCw, ShieldAlert,
} from 'lucide-react';
import { Table, StatusBadge } from '../../components/Table';
import { Button } from '../../components/Button';
import ToastAlertComponent from '../../components/ToastAlertComponent';
import PayFineButton from '../../components/user/PayFineButton';
import WaitlistTab from '../../components/user/WaitlistTab';
import {
  loanService, ACTIVE_LOAN_STATES, WAITING_PICKUP_STATES, canRenewLoan, isSoonDue,
} from '../../services/loanService';
import { walletService } from '../../services/walletService';
import { profileService } from '../../services/profileService';
import { formatMoney } from '../../utils/libraryDate';

/**
 * Sách của tôi — 3-12.b + bảng điều khiển cá nhân / gia hạn (3-14).
 * Tab: Đang mượn | Lịch sử | Đặt trước (3-13) | Công nợ (PayFineButton 4-13).
 */

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

const TAB_IDS = ['active', 'history', 'waitlist', 'fines'];
const TABS = [
  { id: 'active', label: 'Đang mượn', icon: BookMarked },
  { id: 'history', label: 'Lịch sử', icon: History },
  { id: 'waitlist', label: 'Đặt trước', icon: BellRing },
  { id: 'fines', label: 'Công nợ', icon: Receipt },
];

function DueText({ loan }) {
  if (isWaitingPickup(loan) && loan.pickupDeadline) {
    return <span className="font-semibold text-indigo-700">Nhận trước {shortDateTime(loan.pickupDeadline)}</span>;
  }
  if (loan.state === 'RETURNED') {
    return <span className="font-semibold text-slate-400">Trả ngày {shortDate(loan.returnDate ?? loan.dueDate)}</span>;
  }
  if (!isActive(loan)) return <span className="text-slate-400">—</span>;
  const soon = isSoonDue(loan);
  return (
    <span className={`font-semibold ${loan.state === 'OVERDUE' ? 'text-rose-600' : soon ? 'text-amber-700' : 'text-slate-700'}`}>
      {shortDate(loan.dueDate)}
      {soon && loan.state !== 'OVERDUE' ? ' · Sắp đến hạn' : ''}
    </span>
  );
}

function LoanAction({ loan, fullWidth = false, renewingId, onRenew }) {
  if (canRead(loan)) {
    return (
      <Link to={`/reader/${loan.id}`} className={fullWidth ? 'flex-1' : undefined}>
        <Button size="sm" variant="outline" fullWidth={fullWidth} icon={<FileText className="w-3.5 h-3.5" />}>
          Đọc online
        </Button>
      </Link>
    );
  }

  if (canRenewLoan(loan)) {
    return (
      <Button
        size="sm"
        variant="primary"
        fullWidth={fullWidth}
        loading={renewingId === loan.id}
        disabled={renewingId != null}
        icon={<RefreshCw className="w-3.5 h-3.5" />}
        onClick={() => onRenew?.(loan)}
      >
        Gia hạn
      </Button>
    );
  }

  const hint = isWaitingPickup(loan)
    ? `Đưa mã ${loan.loanCode} cho thủ thư để nhận sách`
    : loan.state === 'OVERDUE'
      ? 'Quá hạn — trả tại quầy sớm để tránh phạt thêm'
      : isActive(loan)
        ? (loan.renewalCount > 0 ? `Đã gia hạn · Trả tại quầy` : 'Trả sách tại quầy thư viện')
        : 'Đã hoàn tất';
  return (
    <span className={`text-xs font-medium whitespace-normal ${loan.state === 'OVERDUE' ? 'text-rose-600' : 'text-slate-500'}`}>
      {hint}
    </span>
  );
}

function buildLoanColumns({ renewingId, onRenew }) {
  return [
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
          <div className="flex flex-col w-64 whitespace-normal">
            <Link to={`/books/${row.bookId}`} className="font-semibold text-slate-900 line-clamp-2 hover:text-indigo-600">{val}</Link>
            <span className="text-xs text-slate-500 line-clamp-1">
              {[row.author, row.isEbook ? 'eBook' : 'Sách in', row.renewalCount > 0 ? `Đã GH ${row.renewalCount}` : null]
                .filter(Boolean).join(' • ')}
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
      render: (_, row) => (
        <div className="inline-flex justify-end max-w-[220px] text-right">
          <LoanAction loan={row} renewingId={renewingId} onRenew={onRenew} />
        </div>
      ),
    },
  ];
}

function StatCard({ icon, label, value, tone }) {
  const tones = {
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-600 [&_strong]:text-indigo-900',
    rose: 'bg-rose-50 border-rose-100 text-rose-600 [&_strong]:text-rose-900',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600 [&_strong]:text-emerald-900',
    amber: 'bg-amber-50 border-amber-100 text-amber-600 [&_strong]:text-amber-900',
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

function LoanCards({ loans, emptyTitle, emptyHint, renewingId, onRenew }) {
  if (!loans.length) {
    return (
      <div className="md:hidden py-12 bg-white rounded-2xl border border-slate-200 text-center p-6 space-y-3">
        <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
        <div className="text-sm font-bold text-slate-800">{emptyTitle}</div>
        <p className="text-xs text-slate-500">{emptyHint}</p>
        <Link to="/catalog">
          <Button size="sm" variant="primary">Khám phá Danh mục</Button>
        </Link>
      </div>
    );
  }
  return (
    <div className="md:hidden space-y-4">
      {loans.map((loan) => (
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
            {!canRead(loan) && isActive(loan) && !canRenewLoan(loan) && (
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <LoanAction loan={loan} fullWidth renewingId={renewingId} onRenew={onRenew} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FinesTab({ summary, loading, error, onRetry, onPaid, onError, onTopUp }) {
  if (loading && !summary) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-28 rounded-2xl border border-[#D9E2EE] bg-white animate-pulse" />
        <div className="h-40 rounded-2xl border border-[#D9E2EE] bg-white animate-pulse" />
      </div>
    );
  }
  if (error && !summary) {
    return (
      <div role="alert" className="py-10 bg-white rounded-2xl border border-rose-200 text-center space-y-3 px-6">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
        <p className="font-semibold text-slate-800">Không tải được công nợ</p>
        <Button variant="outline" onClick={onRetry}>Thử lại</Button>
      </div>
    );
  }

  const total = summary?.total ?? 0;
  const fines = summary?.fines ?? [];

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between ${
        total > 0 ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'
      }`}>
        <div className="flex items-start gap-3">
          <Receipt className={`w-5 h-5 shrink-0 mt-0.5 ${total > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
          <div>
            <p className={`font-semibold ${total > 0 ? 'text-rose-900' : 'text-emerald-900'}`}>
              {total > 0 ? `Tổng nợ phạt ${formatMoney(total)}` : 'Bạn không còn nợ phạt'}
            </p>
            <p className={`text-sm ${total > 0 ? 'text-rose-800' : 'text-emerald-800'}`}>
              {total > 0
                ? (summary?.blocked ? 'Tài khoản đang bị khóa mượn cho tới khi trả hết.' : 'Trả sớm để không bị khóa mượn.')
                : 'Bạn có thể tiếp tục mượn sách trong hạn mức cho phép.'}
            </p>
          </div>
        </div>
        <PayFineButton
          totalFines={total}
          onPaid={onPaid}
          onError={onError}
          onTopUp={onTopUp}
          fullWidth
          className="sm:w-auto"
        />
      </div>

      <div className="rounded-2xl border border-[#D9E2EE] bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Chi tiết khoản phạt</h3>
          <span className="text-xs text-slate-500">{fines.length} khoản</span>
        </div>
        {fines.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Không có khoản phạt chưa thanh toán.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {fines.map((fine) => (
              <li key={fine.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {fine.overdueDays != null ? `Trễ hạn ${fine.overdueDays} ngày` : `Khoản phạt #${fine.id}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    {fine.createdAt
                      ? new Date(fine.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
                      : '—'}
                    {fine.loanId != null ? ` · Phiếu #${fine.loanId}` : ''}
                  </p>
                </div>
                <p className="font-semibold text-rose-700 tabular-nums shrink-0">{formatMoney(fine.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Có thể trả tại quầy thủ thư hoặc bằng tài khoản dịch vụ.{' '}
        <Link to="/account" className="font-semibold text-indigo-600 hover:underline">Mở trang Tài khoản</Link>
      </p>
    </div>
  );
}

export default function MyBooksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab = TAB_IDS.includes(rawTab) ? rawTab : 'active';
  const selectTab = (id) => setSearchParams(id === 'active' ? {} : { tab: id }, { replace: true });

  const [waitlistCount, setWaitlistCount] = useState(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const [activeResult, setActiveResult] = useState({ key: -1, loans: null, error: null });
  const [historyResult, setHistoryResult] = useState({ key: -1, loans: null, error: null });
  const [profile, setProfile] = useState(null);
  const [finesRev, setFinesRev] = useState(0);
  const [finesState, setFinesState] = useState({ key: -1, data: null, error: null });
  const [renewingId, setRenewingId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [failure, setFailure] = useState(null);
  const closeToast = useCallback(() => { setNotice(null); setFailure(null); }, []);

  useEffect(() => {
    let cancelled = false;
    profileService.getMe()
      .then((data) => { if (!cancelled) setProfile(data); })
      .catch(() => { if (!cancelled) setProfile(null); });
    return () => { cancelled = true; };
  }, [revision, finesRev]);

  useEffect(() => {
    let cancelled = false;
    loanService.getMyActiveLoans()
      .then((loans) => !cancelled && setActiveResult({ key: revision, loans, error: null }))
      .catch((error) => !cancelled && setActiveResult({ key: revision, loans: null, error }));
    return () => { cancelled = true; };
  }, [revision]);

  useEffect(() => {
    if (tab !== 'history') return undefined;
    let cancelled = false;
    loanService.getMyHistory()
      .then((loans) => !cancelled && setHistoryResult({ key: revision, loans, error: null }))
      .catch((error) => !cancelled && setHistoryResult({ key: revision, loans: null, error }));
    return () => { cancelled = true; };
  }, [tab, revision]);

  useEffect(() => {
    if (tab !== 'fines') return undefined;
    let cancelled = false;
    walletService.getMyFines()
      .then((data) => !cancelled && setFinesState({ key: finesRev, data, error: null }))
      .catch((error) => !cancelled && setFinesState({ key: finesRev, data: null, error }));
    return () => { cancelled = true; };
  }, [tab, finesRev]);

  const activeLoading = activeResult.key !== revision;
  const activeLoans = activeResult.loans ?? [];
  const historyLoading = historyResult.key !== revision;
  const historyLoans = historyResult.loans ?? [];
  const finesLoading = finesState.key !== finesRev;
  const finesSummary = finesState.data;

  const overdueCount = activeLoans.filter((loan) => loan.state === 'OVERDUE').length;
  const soonDueCount = activeLoans.filter((loan) => isSoonDue(loan) && loan.state !== 'OVERDUE').length;
  const pickups = activeLoans.filter(isWaitingPickup);
  const locked = Boolean(profile?.locked || finesSummary?.blocked);
  const debtTotal = finesSummary?.total ?? profile?.totalFines ?? 0;

  const handleRenew = useCallback(async (loan) => {
    setRenewingId(loan.id);
    setFailure(null);
    try {
      const updated = await loanService.renewLoan(loan.id);
      setNotice({
        type: 'success',
        message: `Đã gia hạn «${updated.bookTitle}». Hạn mới: ${shortDate(updated.dueDate)}.`,
      });
      reload();
    } catch (error) {
      setFailure(error);
    } finally {
      setRenewingId(null);
    }
  }, [reload]);

  const handleFinePaid = (result) => {
    setNotice(result.alreadyCleared
      ? { type: 'info', message: 'Bạn không còn khoản phạt nào cần trả.' }
      : { type: 'success', message: `Đã trả ${formatMoney(result.amountPaid)} tiền phạt. Tài khoản đã được mở khóa mượn.` });
    setFinesRev((value) => value + 1);
    reload();
  };

  const columns = useMemo(
    () => buildLoanColumns({ renewingId, onRenew: handleRenew }),
    [renewingId, handleRenew],
  );

  const tabCount = (id) => {
    if (id === 'active') return activeResult.loans ? activeLoans.length : null;
    if (id === 'history') return historyResult.loans ? historyLoans.length : null;
    if (id === 'waitlist') return waitlistCount;
    if (id === 'fines') return debtTotal > 0 ? 1 : (finesSummary ? 0 : null);
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 space-y-8">
      <ToastAlertComponent error={failure} notice={notice} onClose={closeToast} />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-headline-lg text-[#172033] font-semibold tracking-tight">
            Sách của tôi
          </h1>
          <p className="text-body-md text-[#5B6B82] mt-1">
            Theo dõi phiếu mượn, gia hạn, hàng chờ và công nợ
          </p>
        </div>

        {activeResult.loans && (
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-3">
            <StatCard tone="indigo" label="Đang mượn" value={`${activeLoans.length} cuốn`} icon={<BookMarked className="w-4 h-4 shrink-0" />} />
            <StatCard tone="rose" label="Quá hạn" value={`${overdueCount} cuốn`} icon={<AlertTriangle className="w-4 h-4 shrink-0" />} />
            <StatCard tone="amber" label="Sắp đến hạn" value={`${soonDueCount} cuốn`} icon={<Clock className="w-4 h-4 shrink-0" />} />
          </div>
        )}
      </div>

      {locked && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3 text-sm text-rose-900">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <div className="space-y-1">
            <p className="font-semibold">Tài khoản đang bị khóa mượn</p>
            <p>
              Trả hết phí phạt để mở khóa.{' '}
              <button type="button" className="font-semibold underline" onClick={() => selectTab('fines')}>
                Xem công nợ
              </button>
              {' · '}
              <Link to="/account" className="font-semibold underline">Tài khoản dịch vụ</Link>
            </p>
          </div>
        </div>
      )}

      <div role="tablist" aria-label="Sách của tôi" className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map(({ id, label, icon: Icon }) => {
          const count = tabCount(id);
          const selected = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={selected}
              aria-controls={`panel-${id}`}
              onClick={() => selectTab(id)}
              className={`inline-flex items-center gap-2 min-h-10 px-4 rounded-xl text-sm font-semibold border whitespace-nowrap transition-colors ${
                selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
              }`}
            >
              <Icon className="w-4 h-4" />{label}
              {count != null && (
                <span className={`rounded-full px-1.5 text-xs ${selected ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'waitlist' && (
        <div role="tabpanel" id="panel-waitlist" aria-labelledby="tab-waitlist">
          <WaitlistTab onCountChange={setWaitlistCount} />
        </div>
      )}

      {tab === 'fines' && (
        <div role="tabpanel" id="panel-fines" aria-labelledby="tab-fines">
          <FinesTab
            summary={finesSummary}
            loading={finesLoading}
            error={finesState.error}
            onRetry={() => setFinesRev((value) => value + 1)}
            onPaid={handleFinePaid}
            onError={setFailure}
            onTopUp={(amount) => navigate(`/account?topup=${amount}`)}
          />
        </div>
      )}

      {tab === 'active' && (
        <div role="tabpanel" id="panel-active" aria-labelledby="tab-active" className="space-y-8">
          {pickups.length > 0 && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 flex items-start gap-3 text-sm text-indigo-900">
              <Clock className="w-5 h-5 shrink-0 mt-0.5 text-indigo-600" />
              <div className="space-y-1">
                <p className="font-semibold">Bạn có {pickups.length} phiếu đang chờ nhận sách tại quầy</p>
                <p>Đưa mã phiếu cho thủ thư trước hạn nhận; quá hạn, phiếu tự hủy và sách được trả về kệ.</p>
              </div>
            </div>
          )}

          {overdueCount > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3 text-sm text-rose-900">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-1">
                <p className="font-semibold">{overdueCount} phiếu đã quá hạn trả</p>
                <p>Hãy trả sách tại quầy sớm để tránh phát sinh thêm phí phạt.</p>
              </div>
            </div>
          )}

          {soonDueCount > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 text-sm text-amber-950">
              <Clock className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              <div className="space-y-1">
                <p className="font-semibold">{soonDueCount} phiếu sắp đến hạn trong 3 ngày tới</p>
                <p>Sách vật lý đủ điều kiện sẽ có nút <strong>Gia hạn</strong> (thêm 3 ngày, tối đa 1 lần).</p>
              </div>
            </div>
          )}

          {activeLoading && !activeResult.loans && (
            <div className="space-y-3" aria-busy="true">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-24 rounded-2xl border border-[#D9E2EE] bg-white animate-pulse" />
              ))}
            </div>
          )}

          {!activeLoading && activeResult.error && (
            <div role="alert" className="py-10 bg-white rounded-2xl border border-rose-200 text-center space-y-3 px-6">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="font-semibold text-slate-800">Không tải được danh sách phiếu mượn</p>
              <p className="text-sm text-slate-500">
                {activeResult.error.response?.status === 401
                  ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
                  : 'Không kết nối được máy chủ thư viện. Vui lòng thử lại.'}
              </p>
              <Button variant="outline" onClick={reload}>Thử lại</Button>
            </div>
          )}

          {activeResult.loans && (
            <>
              <div className="hidden md:block">
                <Table
                  title="Đang mượn & chờ nhận"
                  subtitle="Phiếu còn hiệu lực — gia hạn khi sắp đến hạn (sách in)"
                  columns={columns}
                  data={activeLoans}
                  emptyMessage="Bạn chưa có phiếu mượn đang mở"
                  footerNote="Gia hạn: còn ≥ 6 giờ trước hạn, chưa gia hạn lần nào, không nợ phạt, sách không có hàng chờ"
                  pagination
                  itemsPerPage={5}
                />
              </div>
              <LoanCards
                loans={activeLoans}
                emptyTitle="Chưa có phiếu đang mở"
                emptyHint="Khám phá danh mục để mượn sách bạn cần."
                renewingId={renewingId}
                onRenew={handleRenew}
              />
            </>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div role="tabpanel" id="panel-history" aria-labelledby="tab-history" className="space-y-8">
          {historyLoading && !historyResult.loans && (
            <div className="space-y-3" aria-busy="true">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-24 rounded-2xl border border-[#D9E2EE] bg-white animate-pulse" />
              ))}
            </div>
          )}

          {!historyLoading && historyResult.error && (
            <div role="alert" className="py-10 bg-white rounded-2xl border border-rose-200 text-center space-y-3 px-6">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="font-semibold text-slate-800">Không tải được lịch sử mượn</p>
              <Button variant="outline" onClick={reload}>Thử lại</Button>
            </div>
          )}

          {historyResult.loans && (
            <>
              <div className="hidden md:block">
                <Table
                  title="Lịch sử mượn trả"
                  subtitle="Các phiếu đã trả, hủy, hết hạn nhận hoặc báo mất"
                  columns={columns}
                  data={historyLoans}
                  emptyMessage="Chưa có lịch sử mượn trả"
                  footerNote="Chỉ hiển thị phiếu đã đóng"
                  pagination
                  itemsPerPage={5}
                />
              </div>
              <div className="md:hidden">
                <LoanCards
                  loans={historyLoans}
                  emptyTitle="Chưa có lịch sử"
                  emptyHint="Sau khi trả sách, phiếu sẽ xuất hiện tại đây."
                  renewingId={renewingId}
                  onRenew={handleRenew}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
