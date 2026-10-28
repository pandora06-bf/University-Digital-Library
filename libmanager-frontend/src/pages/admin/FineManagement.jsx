import { useState } from 'react';
import { 
  Search,
  Wallet, Receipt, AlertCircle, Banknote, ShieldAlert,
  CheckCircle2, Eye, AlertOctagon, ArrowLeftRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import axiosInstance from '../../services/axios_instance';
import { getApiErrorMessage } from '../../services/errorHandler';

export default function FineManagement() {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  // UC10: bảng trống đến khi tra cứu MSSV qua /api/admin/fines/lookup
  const [finesData, setFinesData] = useState([]);
  const [lookedUpName, setLookedUpName] = useState('');
  const [collectingRow, setCollectingRow] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('Loại vi phạm (Tất cả)');
  const [statusFilter, setStatusFilter] = useState('Trạng thái (Tất cả)');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lookupTotal, setLookupTotal] = useState(null);

  const unpaidRows = finesData.filter((r) => r.status === 'Chưa thu');
  const unpaidSum = unpaidRows.reduce((s, r) => s + (Number(r.amountNum) || 0), 0);
  const displayDebt = lookupTotal != null ? Number(lookupTotal) : unpaidSum;

  const handleCollect = async (row) => {
    if (!row) {
      showToast('Không có phiếu phạt để thu.', 'error');
      return;
    }
    const userCode = row.mssv;
    const amount = lookupTotal != null ? Number(lookupTotal) : row.amountNum;
    if (!userCode || !amount || amount <= 0) {
      showToast('Thiếu MSSV hoặc số tiền thu (chỉ thu đủ toàn bộ nợ).', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      await axiosInstance.post('/api/admin/fines/collect', {
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
      showToast(`Đã thu đủ ${amount.toLocaleString('vi-VN')} ₫ cho ${userCode}.`, 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Thu phạt thất bại.'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearchSubmit = async () => {
    const q = searchTerm.trim();
    if (!q) {
      showToast('Nhập MSSV rồi nhấn phím Enter để tra cứu công nợ.', 'warning');
      return;
    }
    try {
      const res = await axiosInstance.get('/api/admin/fines/lookup', {
        params: { user_code: q },
      });
      const data = res.data || {};
      const fines = data.fines || [];
      setLookedUpName(data.full_name || q);
      setLookupTotal(data.total_fines != null ? Number(data.total_fines) : null);
      if (fines.length === 0) {
        setFinesData([]);
        showToast(
          data.total_fines > 0
            ? `${data.full_name || q}: tổng nợ ${Number(data.total_fines).toLocaleString('vi-VN')} ₫ nhưng chưa có khoản chưa thu.`
            : `${data.full_name || q}: không còn công nợ.`,
          'warning'
        );
        return;
      }
      const mapped = fines.map((f) => ({
        id: `FINE-${f.fine_id}`,
        date: f.created_at ? new Date(f.created_at).toLocaleDateString('vi-VN') : '—',
        user: data.full_name || q,
        mssv: data.user_code || q,
        reason: f.overdue_days
          ? `Trễ hạn ${f.overdue_days} ngày (phiếu mượn ${f.loan_id || '—'})`
          : `Phạt phiếu mượn ${f.loan_id || '—'}`,
        amount: `${Number(f.total_amount || 0).toLocaleString('vi-VN')} ₫`,
        amountNum: Number(f.total_amount || 0),
        status: 'Chưa thu',
        statusColor: 'rose',
        action: 'Thu tiền',
      }));
      setFinesData(mapped);
      showToast(
        `Tìm thấy ${mapped.length} khoản chưa thu · Tổng nợ ${Number(data.total_fines || 0).toLocaleString('vi-VN')} ₫`,
        'success'
      );
    } catch (error) {
      setFinesData([]);
      setLookupTotal(null);
      setLookedUpName('');
      showToast(getApiErrorMessage(error, `Không tra được công nợ cho «${q}».`), 'error');
    }
  };

  const fineColumns = [
    {
      key: 'id',
      header: 'Mã Phiếu & Ngày',
      render: (value, row) => (
        <div className="min-w-[120px]">
          <span className="font-mono font-bold text-slate-700 block">{row.id}</span>
          <span className="text-[11px] text-slate-400 font-medium block mt-1">{row.date}</span>
        </div>
      )
    },
    {
      key: 'user',
      header: 'Độc Giả (MSSV)',
      render: (value, row) => (
        <div className="min-w-[160px]">
          <span className="font-bold text-slate-800 block">{row.user}</span>
          <span className="text-[11px] text-slate-500 font-mono block mt-1">{row.mssv}</span>
        </div>
      )
    },
    {
      key: 'reason',
      header: 'Lý do vi phạm',
      render: (value, row) => (
        <div className="flex items-start gap-2 min-w-[200px]">
          <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
            row.reason.includes('Trễ hạn') ? 'text-amber-500' : 'text-rose-500'
          }`} />
          <span className="font-medium text-slate-700 leading-snug">{row.reason}</span>
        </div>
      )
    },
    {
      key: 'amount',
      header: 'Tổng Tiền Phạt',
      align: 'right',
      render: (value, row) => (
        <div className="min-w-[120px]">
          <span className="font-bold text-slate-800 block text-base">{row.amount}</span>
          {row.paid && (
            <span className="text-[11px] text-emerald-600 font-medium block mt-0.5">Đã thu: {row.paid}</span>
          )}
        </div>
      )
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      render: (value, row) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${
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
      align: 'right',
      render: (value, row) => (
        <div className="min-w-[150px] flex items-center justify-end gap-2">
          {row.statusColor !== 'emerald' ? (
            <>
              <button
                className="flex items-center justify-center gap-1.5 text-white font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg transition-colors shadow-sm shadow-indigo-200 whitespace-nowrap"
                onClick={() => setCollectingRow(row)}
              >
                <Banknote className="w-4 h-4 shrink-0" />
                Thu tiền
              </button>
              <button
                className="flex items-center gap-1.5 text-slate-600 font-semibold text-xs bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                onClick={() => setDetailRow(row)}
              >
                <Eye className="w-3.5 h-3.5" />
                Chi tiết
              </button>
            </>
          ) : (
            <button
              className="flex items-center gap-1.5 text-slate-600 font-semibold text-xs bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              onClick={() => setDetailRow(row)}
            >
              <Eye className="w-3.5 h-3.5" />
              Chi tiết
            </button>
          )}
          <button
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            onClick={() => navigate('/admin/loans')}
            title="Xem phiếu mượn liên quan"
          >
            <Receipt className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const filteredData = finesData.filter(item => {
    const matchSearch = !searchTerm ||
      item.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.mssv.includes(searchTerm) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = typeFilter === 'Loại vi phạm (Tất cả)' ||
      (typeFilter === 'Trễ hạn trả sách' && item.reason.includes('Trễ hạn')) ||
      (typeFilter === 'Làm rách / Hư hỏng' && (item.reason.includes('rách') || item.reason.includes('ướt'))) ||
      (typeFilter === 'Làm mất sách' && item.reason.includes('mất'));
    const matchStatus = statusFilter === 'Trạng thái (Tất cả)' || item.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      <Toast toast={toast} onClose={hideToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Thu phạt &amp; Công nợ</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tra cứu công nợ theo MSSV và xác nhận thu phạt tại quầy cho bạn đọc.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            icon={<AlertOctagon className="w-4 h-4" />}
            onClick={() => navigate('/admin/incidents')}
          >
            Biên bản Mất / Hỏng
          </Button>
          <Button
            variant="primary"
            icon={<ArrowLeftRight className="w-4 h-4" />}
            onClick={() => navigate('/admin/loans')}
          >
            Xem Phiếu Mượn
          </Button>
        </div>
      </div>

      {/* 3 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-rose-50/50 group">
          <div className="absolute top-4 right-4">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-6 h-6 text-rose-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 mb-2">Tổng dư nợ</p>
          <h3 className="text-3xl font-extrabold text-rose-600">
            {displayDebt > 0 ? displayDebt.toLocaleString('vi-VN') : '—'}{' '}
            <span className="text-lg font-bold text-rose-400">₫</span>
          </h3>
          <div className="mt-3 text-sm font-medium text-slate-500">
            {lookedUpName
              ? <>Độc giả <span className="text-slate-700 font-bold">{lookedUpName}</span></>
              : 'Nhập MSSV + Enter để tra cứu'}
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/50 group">
          <div className="absolute top-4 right-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wallet className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 mb-2">Khoản chưa thu</p>
          <h3 className="text-3xl font-extrabold text-emerald-600">
            {unpaidRows.length} <span className="text-lg font-bold text-emerald-400">dòng</span>
          </h3>
          <div className="mt-3 text-sm font-medium text-slate-500">
            Thu đủ toàn bộ số nợ một lần
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-amber-50/50 group">
          <div className="absolute top-4 right-4">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Receipt className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 mb-2">Phiếu trên bảng</p>
          <h3 className="text-3xl font-extrabold text-amber-600">
            {finesData.length} <span className="text-lg font-bold text-amber-400">phiếu</span>
          </h3>
          <div className="mt-3 text-sm font-medium text-slate-500">
            Kết quả tra cứu hiện tại
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
        {/* Filters Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 rounded-t-2xl">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="w-full sm:w-80">
              <Input
                type="text"
                placeholder="Tìm MSSV, tên độc giả hoặc mã phiếu… (nhấn phím Enter)"
                leftIcon={<Search className="w-4 h-4" />}
                className="!h-10 !rounded-lg font-mono placeholder:font-sans"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
              />
            </div>
            <select
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer min-w-[180px]"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option>Loại vi phạm (Tất cả)</option>
              <option>Trễ hạn trả sách</option>
              <option>Làm rách / Hư hỏng</option>
              <option>Làm mất sách</option>
            </select>
            <select
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer min-w-[180px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>Trạng thái (Tất cả)</option>
              <option>Chưa thu</option>
              <option>Thu một phần</option>
              <option>Đã hoàn tất</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <Table
          columns={fineColumns}
          data={filteredData}
          emptyMessage="Nhập MSSV rồi nhấn Enter để tra cứu công nợ chưa thu."
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
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Phương thức thanh toán</label>
              <select className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer">
                <option>Tiền mặt</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Thu tại quầy bằng tiền mặt; cần thu đủ toàn bộ số nợ.</p>
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
            <Button variant="primary" onClick={() => { setDetailRow(null); navigate('/admin/loans'); }}>
              Xem phiếu mượn
            </Button>
          </>
        }
      >
        {detailRow && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-800 text-sm">Đã hoàn tất thanh toán</p>
                <p className="text-xs text-emerald-600 mt-0.5">Phiếu phạt này đã được xử lý xong.</p>
              </div>
            </div>
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
