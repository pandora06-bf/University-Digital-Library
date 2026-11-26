import { useEffect, useRef, useState } from 'react';
import { 
  Search,
  Wallet, Receipt, AlertCircle, Banknote, ShieldAlert,
  CheckCircle2, Eye, AlertOctagon, ArrowLeftRight
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import axiosInstance from '../../services/axios_instance';
import { getApiErrorMessage } from '../../services/errorHandler';
import { AdminIconButton } from '../../components/AdminIconButton';

/** Giữ kết quả tra cứu khi sang Báo mất/hỏng hoặc Mượn/Trả rồi quay lại. */
const FINES_DRAFT_KEY = 'admin_fines_counter_draft_v1';

function readFinesDraft() {
  try {
    const raw = sessionStorage.getItem(FINES_DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function writeFinesDraft(payload) {
  try {
    sessionStorage.setItem(FINES_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export default function FineManagement() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoLookupDone = useRef('');
  const [draft] = useState(readFinesDraft);
  const { toast, showToast, hideToast } = useToast();
  // UC10: bảng trống đến khi tra cứu mã bạn đọc qua /api/admin/fines/lookup
  const [finesData, setFinesData] = useState(() => draft?.finesData || []);
  const [lookedUpName, setLookedUpName] = useState(() => draft?.lookedUpName || '');
  const [collectingRow, setCollectingRow] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState(() => draft?.searchTerm || '');
  const [typeFilter, setTypeFilter] = useState(() => draft?.typeFilter || 'Loại vi phạm (Tất cả)');
  const [statusFilter, setStatusFilter] = useState(() => draft?.statusFilter || 'Trạng thái (Tất cả)');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lookupTotal, setLookupTotal] = useState(() => (
    draft?.lookupTotal != null ? Number(draft.lookupTotal) : null
  ));

  useEffect(() => {
    writeFinesDraft({
      searchTerm,
      lookedUpName,
      finesData,
      lookupTotal,
      typeFilter,
      statusFilter,
    });
  }, [searchTerm, lookedUpName, finesData, lookupTotal, typeFilter, statusFilter]);

  const unpaidRows = finesData.filter((r) => r.status === 'Chưa thu');
  const unpaidSum = unpaidRows.reduce((s, r) => s + (Number(r.amountNum) || 0), 0);
  const displayDebt = lookupTotal != null ? Number(lookupTotal) : unpaidSum;

  const handleCollect = async (row) => {
    if (!row || row.statusColor === 'emerald') {
      showToast(row?.statusColor === 'emerald' ? 'Phiếu này đã thu, không thu lại.' : 'Không có phiếu phạt để thu.', 'error');
      setCollectingRow(null);
      return;
    }
    const userCode = row.mssv;
    const amount = lookupTotal != null ? Number(lookupTotal) : row.amountNum;
    if (!userCode || !amount || amount <= 0) {
      showToast('Thiếu mã bạn đọc hoặc số tiền thu (chỉ thu đủ toàn bộ nợ).', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await axiosInstance.post('/api/admin/fines/collect', {
        user_code: userCode,
        amount,
        notes: `Thu tại quầy — phiếu ${row.id}`,
      });
      setFinesData((prev) =>
        prev.map((r) =>
          r.mssv === userCode
            ? { ...r, status: 'Đã hoàn tất', statusColor: 'emerald', action: 'Chi tiết' }
            : r
        )
      );
      setCollectingRow(null);
      setLookupTotal(null);
      const warning = res.data?.warning;
      showToast(
        warning
          ? `Đã thu đủ ${amount.toLocaleString('vi-VN')} ₫. ${warning}`
          : `Đã thu đủ ${amount.toLocaleString('vi-VN')} ₫ cho ${userCode}.`,
        warning ? 'warning' : 'success'
      );
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Thu phạt thất bại.'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearchSubmit = async (presetMssv) => {
    const fromArg = typeof presetMssv === 'string' ? presetMssv : '';
    const q = (fromArg || searchTerm).trim();
    if (!q) {
      // Xóa ô tìm + Tra cứu → reset bảng (không giữ kết quả tra cứu trước)
      setSearchTerm('');
      setFinesData([]);
      setLookedUpName('');
      setLookupTotal(null);
      setCollectingRow(null);
      setDetailRow(null);
      autoLookupDone.current = '';
      showToast('Đã xóa bộ lọc. Nhập mã bạn đọc rồi Tra cứu lại.', 'warning');
      return;
    }
    setSearchTerm(q);
    try {
      const res = await axiosInstance.get('/api/admin/fines/lookup', {
        params: { user_code: q, include_paid: true },
      });
      const data = res.data || {};
      const fines = data.fines || [];
      setLookedUpName(data.full_name || q);
      setLookupTotal(data.total_fines != null ? Number(data.total_fines) : null);
      if (fines.length === 0) {
        setFinesData([]);
        showToast(
          data.total_fines > 0
            ? `${data.full_name || q}: tổng nợ ${Number(data.total_fines).toLocaleString('vi-VN')} ₫ nhưng chưa có khoản phạt.`
            : `${data.full_name || q}: không có khoản phạt.`,
          'warning'
        );
        return;
      }
      const mapped = fines.map((f) => {
        const paid = String(f.payment_status || '').toUpperCase() === 'PAID';
        const overdueDays = Number(f.overdue_days) || 0;
        const total = Number(f.total_amount || 0);
        // Ưu tiên fine_type/has_incident từ BE; fallback heuristic chỉ khi thiếu field.
        const apiType = String(f.fine_type || '').toUpperCase();
        let fineType = 'OTHER';
        if (apiType === 'LOST_DAMAGE' || apiType === 'OVERDUE' || apiType === 'OTHER') {
          fineType = apiType;
        } else if (f.has_incident) {
          fineType = 'LOST_DAMAGE';
        } else if (overdueDays > 0) {
          fineType = 'OVERDUE';
        } else if (total > 0) {
          fineType = 'OTHER';
        }
        let reason;
        if (fineType === 'LOST_DAMAGE') {
          reason = overdueDays > 0
            ? `Bồi thường mất/hỏng + trễ hạn ${overdueDays} ngày (phiếu ${f.loan_id || '—'})`
            : `Bồi thường mất/hỏng sách (phiếu ${f.loan_id || '—'})`;
        } else if (fineType === 'OVERDUE') {
          reason = `Trễ hạn ${overdueDays} ngày (phiếu mượn ${f.loan_id || '—'})`;
        } else {
          reason = `Phạt phiếu mượn ${f.loan_id || '—'}`;
        }
        return {
          id: String(f.fine_id),
          date: f.created_at ? new Date(f.created_at).toLocaleDateString('vi-VN') : '—',
          user: data.full_name || q,
          mssv: data.user_code || q,
          fineType,
          reason,
          amount: `${total.toLocaleString('vi-VN')} ₫`,
          amountNum: total,
          status: paid ? 'Đã hoàn tất' : 'Chưa thu',
          statusColor: paid ? 'emerald' : 'rose',
          action: paid ? 'Chi tiết' : 'Thu tiền',
        };
      });
      setFinesData(mapped);
      const unpaidCount = mapped.filter((row) => row.status === 'Chưa thu').length;
      const paidCount = mapped.length - unpaidCount;
      showToast(
        unpaidCount
          ? `Tìm thấy ${unpaidCount} khoản chưa thu${paidCount ? `, ${paidCount} khoản đã thu` : ''} · Tổng nợ ${Number(data.total_fines || 0).toLocaleString('vi-VN')} ₫`
          : `${data.full_name || q}: không còn nợ. ${paidCount} khoản đã thu.`,
        unpaidCount ? 'success' : 'warning'
      );
    } catch (error) {
      setFinesData([]);
      setLookupTotal(null);
      setLookedUpName('');
      showToast(getApiErrorMessage(error, `Không tra được công nợ cho «${q}».`), 'error');
    }
  };

  // Từ Báo mất/hỏng: /admin/fines?mssv=SV-DEMO-005 → tự điền + tra cứu
  useEffect(() => {
    const mssv = (searchParams.get('mssv') || '').trim();
    if (!mssv || autoLookupDone.current === mssv) return;
    autoLookupDone.current = mssv;
    handleSearchSubmit(mssv);
    const next = new URLSearchParams(searchParams);
    next.delete('mssv');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi query mssv đổi
  }, [searchParams]);

  const fineColumns = [
    {
      key: 'id',
      header: 'Mã Phiếu & Ngày',
      width: '14%',
      render: (value, row) => (
        <div className="min-w-0">
          <span className="font-mono font-bold text-indigo-600 block bg-indigo-50/70 px-2 py-1 rounded w-fit max-w-full truncate text-xs" title={row.id}>
            {row.id}
          </span>
          <span className="text-[11px] text-slate-400 font-medium block mt-1 truncate">{row.date}</span>
        </div>
      )
    },
    {
      key: 'user',
      header: 'Bạn đọc (mã)',
      width: '16%',
      render: (value, row) => (
        <div className="min-w-0 max-w-[180px]">
          <span className="font-bold text-slate-800 block truncate" title={row.user}>{row.user}</span>
          <span className="text-[11px] text-slate-500 font-mono block mt-1 truncate">{row.mssv}</span>
        </div>
      )
    },
    {
      key: 'reason',
      header: 'Lý do vi phạm',
      width: '16%',
      render: (value, row) => (
        <div className="flex items-center gap-2 min-w-0 max-w-xs">
          <AlertCircle className={`w-4 h-4 shrink-0 ${
            row.fineType === 'OVERDUE' ? 'text-amber-500' : 'text-rose-500'
          }`} />
          <span className="font-medium text-slate-700 truncate" title={row.reason}>{row.reason}</span>
        </div>
      )
    },
    {
      key: 'amount',
      header: 'Tổng Tiền Phạt',
      width: '12%',
      align: 'right',
      render: (value, row) => (
        <div className="min-w-0 text-right">
          <span className="font-bold text-slate-800 block text-base truncate" title={row.amount}>{row.amount}</span>
          {row.paid && (
            <span className="text-[11px] text-emerald-600 font-medium block mt-0.5 truncate">Đã thu: {row.paid}</span>
          )}
        </div>
      )
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      width: '12%',
      noClip: true,
      render: (value, row) => (
        <span className={`inline-flex max-w-full items-center px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${
          row.statusColor === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-200' :
          row.statusColor === 'amber' ? 'bg-amber-50 text-amber-600 border-amber-200' :
          'bg-emerald-50 text-emerald-600 border-emerald-200'
        }`}>
          {row.status}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      width: '30%',
      align: 'right',
      noClip: true,
      render: (value, row) => (
        <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
          {row.statusColor !== 'emerald' ? (
            <>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 text-white font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg transition-colors shadow-sm shadow-indigo-200 whitespace-nowrap"
                onClick={() => setCollectingRow(row)}
              >
                <Banknote className="w-4 h-4 shrink-0" />
                Thu tiền
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 text-slate-600 font-semibold text-xs bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                onClick={() => setDetailRow(row)}
              >
                <Eye className="w-3.5 h-3.5" />
                Chi tiết
              </button>
            </>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1.5 text-slate-600 font-semibold text-xs bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              onClick={() => setDetailRow(row)}
            >
              <Eye className="w-3.5 h-3.5" />
              Chi tiết
            </button>
          )}
          <AdminIconButton
            className="w-8 h-8 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            onClick={() => navigate(row.mssv ? `/admin/loans?mssv=${encodeURIComponent(row.mssv)}` : '/admin/loans')}
            title="Xem phiếu mượn liên quan"
          >
            <Receipt className="w-4 h-4" />
          </AdminIconButton>
        </div>
      )
    }
  ];

  // Ô mã bạn đọc là khóa tra cứu API, không lọc lại bảng (dễ loại mất đúng dòng vừa tìm).
  const filteredData = finesData.filter((item) => {
    const matchType = typeFilter === 'Loại vi phạm (Tất cả)'
      || (typeFilter === 'Trễ hạn trả sách' && item.fineType === 'OVERDUE')
      || (typeFilter === 'Mất / hỏng sách' && item.fineType === 'LOST_DAMAGE')
      || (typeFilter === 'Phạt khác' && item.fineType === 'OTHER');
    const matchStatus = statusFilter === 'Trạng thái (Tất cả)' || item.status === statusFilter;
    return matchType && matchStatus;
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      <Toast toast={toast} onClose={hideToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Thu phạt &amp; Công nợ</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tra cứu công nợ theo mã bạn đọc (SV/GV) và xác nhận thu phạt tại quầy.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Sang Biên bản / Phiếu mượn rồi quay lại — mã bạn đọc và bảng công nợ vẫn được giữ.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            icon={<AlertOctagon className="w-4 h-4" />}
            onClick={() => {
              const mssv = (searchTerm || finesData[0]?.mssv || '').trim();
              navigate(mssv ? `/admin/incidents?mssv=${encodeURIComponent(mssv)}` : '/admin/incidents');
            }}
          >
            Biên bản Mất / Hỏng
          </Button>
          <Button
            variant="primary"
            icon={<ArrowLeftRight className="w-4 h-4" />}
            onClick={() => {
              const mssv = (searchTerm || finesData[0]?.mssv || '').trim();
              navigate(mssv ? `/admin/loans?mssv=${encodeURIComponent(mssv)}` : '/admin/loans');
            }}
          >
            Xem Phiếu Mượn
          </Button>
        </div>
      </div>

      {/* Stats — icon outline mờ giống Users */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm bg-gradient-to-br from-white to-rose-50/50 min-w-0 relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <ShieldAlert className="w-6 h-6 text-rose-500 opacity-20" aria-hidden />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 truncate">Tổng dư nợ</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 tabular-nums leading-none">
            {displayDebt > 0 ? displayDebt.toLocaleString('vi-VN') : '0'}
            <span className="ml-1 text-base font-bold text-rose-400">₫</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-slate-500 line-clamp-2" title={lookedUpName || undefined}>
            {lookedUpName
              ? <>Độc giả <span className="text-slate-700 font-bold">{lookedUpName}</span></>
              : 'Nhập mã bạn đọc rồi bấm Tra cứu'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setStatusFilter('Chưa thu')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm bg-gradient-to-br from-white to-emerald-50/50 min-w-0 relative overflow-hidden transition-colors ${
            statusFilter === 'Chưa thu' ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-emerald-100 hover:border-emerald-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <Wallet className="w-6 h-6 text-emerald-500 opacity-20" aria-hidden />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 truncate">Khoản chưa thu</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tabular-nums leading-none">
            {unpaidRows.length}
            <span className="ml-1 text-base font-bold text-emerald-400">phiếu</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-emerald-700">Bấm để lọc chưa thu</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('Trạng thái (Tất cả)')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm bg-gradient-to-br from-white to-amber-50/50 min-w-0 md:col-span-2 lg:col-span-1 relative overflow-hidden transition-colors ${
            statusFilter === 'Trạng thái (Tất cả)' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-amber-100 hover:border-amber-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <Receipt className="w-6 h-6 text-amber-500 opacity-20" aria-hidden />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 truncate">Phiếu trên bảng</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 tabular-nums leading-none">
            {finesData.length}
            <span className="ml-1 text-base font-bold text-amber-400">phiếu</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-amber-700">Bấm để xem tất cả phiếu tra cứu</p>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-w-0 overflow-hidden">
        {/* Filters Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl space-y-3">
          <div className="flex items-stretch gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <Input
                type="text"
                placeholder="Nhập mã bạn đọc (SV/GV)…"
                leftIcon={<Search className="w-4 h-4" />}
                className="!h-10 !rounded-lg font-mono placeholder:font-sans"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
              />
            </div>
            <Button
              type="button"
              variant="primary"
              className="!h-10 shrink-0 px-3 sm:px-4"
              icon={<Search className="w-4 h-4" />}
              onClick={() => handleSearchSubmit()}
            >
              Tra cứu
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              className="h-10 w-full px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option>Loại vi phạm (Tất cả)</option>
              <option>Trễ hạn trả sách</option>
              <option>Mất / hỏng sách</option>
              <option>Phạt khác</option>
            </select>
            <select
              className="h-10 w-full px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>Trạng thái (Tất cả)</option>
              <option>Chưa thu</option>
              <option>Đã hoàn tất</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <Table
          columns={fineColumns}
          minTableWidth="64rem"
          data={filteredData}
          pagination
          itemsPerPage={10}
          emptyMessage={
            finesData.length === 0
              ? (lookedUpName
                ? `${lookedUpName}: không có khoản phạt.`
                : 'Nhập mã bạn đọc rồi bấm Tra cứu. Xóa ô tìm rồi Tra cứu để làm mới bảng.')
              : 'Không có phiếu khớp bộ lọc này.'
          }
          className="border-0 shadow-none rounded-none rounded-b-2xl"
        />
      </div>

      {/* Modal Thu tiền */}
      <Modal
        isOpen={!!collectingRow}
        onClose={() => setCollectingRow(null)}
        title="Xác nhận thu phí phạt"
        footer={
          <>
            <Button variant="outline" onClick={() => setCollectingRow(null)}>Hủy</Button>
            <Button
              variant="primary"
              className="!bg-indigo-600 hover:!bg-indigo-700"
              icon={isProcessing ? null : <Banknote className="w-4 h-4" />}
              onClick={() => handleCollect(collectingRow)}
              disabled={isProcessing}
            >
              {isProcessing ? 'Đang xử lý...' : 'Xác nhận Đã Thu'}
            </Button>
          </>
        }
      >
        {collectingRow && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Mã phiếu</span>
                <span className="font-mono font-bold text-slate-800">{collectingRow.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Độc giả</span>
                <span className="font-bold text-slate-800">{collectingRow.user}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Lý do</span>
                <span className="font-medium text-slate-700 text-right max-w-[200px]">{collectingRow.reason}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-slate-500 font-bold">Số tiền cần thu (đủ nợ)</span>
                <span className="text-xl font-extrabold text-indigo-600">
                  {(lookupTotal != null ? Number(lookupTotal) : collectingRow.amountNum).toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Phương thức thanh toán</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">Tiền mặt</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Quầy chỉ thu tiền mặt. Trả bằng ví do bạn đọc tự thao tác trên cổng độc giả.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Chi tiết phiếu đã hoàn tất */}
      <Modal
        isOpen={!!detailRow}
        onClose={() => setDetailRow(null)}
        title="Chi tiết phiếu phạt"
        footer={
          <>
            <Button variant="outline" onClick={() => setDetailRow(null)}>Đóng</Button>
            <Button
              variant="primary"
              icon={<ArrowLeftRight className="w-4 h-4" />}
              onClick={() => {
                const mssv = (detailRow?.mssv || '').trim();
                setDetailRow(null);
                navigate(mssv ? `/admin/loans?mssv=${encodeURIComponent(mssv)}` : '/admin/loans');
              }}
            >
              Xem phiếu mượn
            </Button>
          </>
        }
      >
        {detailRow && (
          <div className="space-y-3">
            {detailRow.statusColor === 'emerald' ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-emerald-800 text-sm">Đã hoàn tất thanh toán</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Phiếu phạt này đã được thu tại quầy.</p>
                </div>
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
                <div>
                  <p className="font-bold text-rose-800 text-sm">Chưa thu</p>
                  <p className="text-xs text-rose-600 mt-0.5">Phiếu vẫn còn nợ. Dùng nút Thu tiền để xác nhận thu tiền mặt.</p>
                </div>
              </div>
            )}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Mã phiếu</span>
                <span className="font-mono font-bold">{detailRow.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Ngày lập</span>
                <span className="font-medium">{detailRow.date}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Độc giả</span>
                <span className="font-bold">{detailRow.user} ({detailRow.mssv})</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Lý do vi phạm</span>
                <span className="font-medium text-right max-w-[200px]">{detailRow.reason}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-700">Tổng phạt</span>
                <span className="text-lg font-extrabold text-slate-800">{detailRow.amount}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
