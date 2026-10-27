import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WalletCards, Link2, RotateCcw } from 'lucide-react';
import { Button } from '../../components/Button';
import { Table, StatusBadge } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import {
  getStoredUnmatched,
  assignUnmatched,
  resetUnmatched,
  DEMO_USERS_FOR_ASSIGN,
} from '../../mocks/adminUnmatchedMock';

const formatVND = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);

const formatWhen = (iso) => {
  try {
    return new Date(iso).toLocaleString('vi-VN');
  } catch {
    return iso;
  }
};

export default function UnmatchedTxPage() {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const [rows, setRows] = useState(() => getStoredUnmatched());
  const [statusFilter, setStatusFilter] = useState('UNRESOLVED');
  const [q, setQ] = useState('');
  const [assignTarget, setAssignTarget] = useState(null);
  const [userCode, setUserCode] = useState('');
  const [notes, setNotes] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const okStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const okQ =
        !term ||
        r.bank_tx_id.toLowerCase().includes(term) ||
        (r.transfer_content || '').toLowerCase().includes(term) ||
        (r.assigned_user_code || '').toLowerCase().includes(term);
      return okStatus && okQ;
    });
  }, [rows, statusFilter, q]);

  const openCount = rows.filter((r) => r.status === 'UNRESOLVED').length;

  const openAssign = (row) => {
    setAssignTarget(row);
    setUserCode(DEMO_USERS_FOR_ASSIGN[0]?.user_code || '');
    setNotes('');
  };

  const confirmAssign = () => {
    try {
      assignUnmatched(assignTarget.id, userCode, notes);
      setRows(getStoredUnmatched());
      setAssignTarget(null);
      showToast(`Đã gán ${assignTarget.bank_tx_id} → ${userCode} và cộng số dư (mock).`, 'success');
    } catch (e) {
      showToast(e.message || 'Gán thất bại.', 'error');
    }
  };

  const columns = [
    {
      key: 'bank_tx_id',
      header: 'Mã ngân hàng',
      render: (val, row) => (
        <div>
          <p className="font-mono text-sm font-semibold text-slate-800">{val}</p>
          <p className="text-xs text-slate-500">{formatWhen(row.received_at)}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Số tiền',
      align: 'right',
      render: (val) => <span className="font-bold text-emerald-700">{formatVND(val)}</span>,
    },
    {
      key: 'transfer_content',
      header: 'Nội dung CK',
      render: (val) => <span className="text-sm text-slate-700 line-clamp-2">{val}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (val, row) =>
        val === 'ASSIGNED' ? (
          <div>
            <StatusBadge status="Đã gán" type="success" />
            <p className="text-[11px] text-slate-500 mt-1">{row.assigned_user_code}</p>
          </div>
        ) : (
          <StatusBadge status="Chưa khớp" type="warning" />
        ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (_, row) =>
        row.status === 'UNRESOLVED' ? (
          <Button size="sm" variant="primary" icon={<Link2 className="w-3.5 h-3.5" />} onClick={() => openAssign(row)}>
            Gán user
          </Button>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      <Toast toast={toast} onClose={hideToast} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Giao dịch chưa khớp</h1>
          <p className="text-sm text-slate-500 mt-1">
            Liệt kê UnmatchedTx chưa gán; thủ thư chọn user để cộng số dư ví (4-16 / UC16). Mock khi API 4-07 chưa sẵn.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/admin/users')}>
            Người dùng
          </Button>
          <Button
            variant="outline"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={() => {
              setRows(resetUnmatched());
              showToast('Đã nạp lại mock giao dịch chưa khớp.', 'success');
            }}
          >
            Nạp lại mock
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chưa gán</p>
              <p className="text-3xl font-extrabold text-amber-600">{openCount}</p>
            </div>
            <WalletCards className="w-8 h-8 text-amber-500 opacity-30" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tổng giao dịch</p>
          <p className="text-3xl font-extrabold text-slate-800">{rows.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Tìm mã NH, nội dung CK, MSSV đã gán…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="UNRESOLVED">Chưa khớp</option>
          <option value="ASSIGNED">Đã gán</option>
          <option value="ALL">Tất cả</option>
        </select>
      </div>

      <Table columns={columns} data={filtered} emptyMessage="Không có giao dịch phù hợp." />

      <Modal
        isOpen={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        title="Gán giao dịch cho người dùng"
      >
        {assignTarget && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm">
              <p className="font-mono font-semibold text-slate-800">{assignTarget.bank_tx_id}</p>
              <p className="text-emerald-700 font-bold mt-1">{formatVND(assignTarget.amount)}</p>
              <p className="text-slate-600 mt-2">{assignTarget.transfer_content}</p>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Người dùng
              <select
                className="mt-1.5 w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
              >
                {DEMO_USERS_FOR_ASSIGN.map((u) => (
                  <option key={u.user_code} value={u.user_code}>
                    {u.user_code} — {u.full_name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Ghi chú (tuỳ chọn)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Đối chiếu nội dung chuyển khoản…"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAssignTarget(null)}>
                Hủy
              </Button>
              <Button variant="primary" onClick={confirmAssign}>
                Xác nhận gán
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
