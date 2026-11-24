import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WalletCards, Link2, Search, Users, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { Table, StatusBadge } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import axiosInstance from '../../services/axios_instance';
import { walletService } from '../../services/walletService';
import { getApiErrorMessage } from '../../services/errorHandler';

const formatVND = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);

const formatWhen = (iso) => {
  try {
    return new Date(iso).toLocaleString('vi-VN');
  } catch {
    return iso || '—';
  }
};

const mapRow = (u) => {
  const assigned = u.assigned_user_code || null;
  return {
    id: u.id,
    bank_tx_id: u.bank_tx_id || '',
    amount: Number(u.amount) || 0,
    bank_account_number: u.bank_account_number || '',
    transfer_content: u.transfer_content || '',
    received_at: u.received_at || u.created_at || '',
    status: assigned ? 'ASSIGNED' : 'UNRESOLVED',
    assigned_user_code: assigned,
    resolved_by: u.resolved_by || null,
    resolution_notes: u.resolution_notes || null,
  };
};

export default function UnmatchedTxPage() {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [matchFilter, setMatchFilter] = useState('UNRESOLVED');
  const [assignTarget, setAssignTarget] = useState(null);
  const [userCode, setUserCode] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [manualCode, setManualCode] = useState(false);
  const [notes, setNotes] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [userOptions, setUserOptions] = useState([]);

  const loadRows = useCallback(async ({ silent = false } = {}) => {
    setLoading(true);
    try {
      const items = [];
      let t = 0;
      for (let page = 1; page <= 40; page += 1) {
        const batch = await walletService.listUnmatched(page, 50, 'all');
        t = Number(batch.total) || t;
        items.push(...(batch.items || []));
        if (!batch.items?.length || items.length >= t) break;
      }
      setRows(items.map(mapRow));
      if (!silent) {
        showToast(`Đã tải ${t ?? items?.length ?? 0} giao dịch chưa khớp.`, 'success');
      }
    } catch (error) {
      setRows([]);
      if (!silent) {
        showToast(
          getApiErrorMessage(error, 'Không tải được danh sách giao dịch.'),
          'error'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadUserOptions = useCallback(async () => {
    // API order_by user_code → GV-* đứng trước SV-*; page 1 dễ chỉ toàn giảng viên.
    // Lấy riêng STUDENT + LECTURER rồi xếp SV trước.
    const mapUser = (u) => ({
      user_code: u.user_code,
      full_name: u.full_name || u.user_code,
      role: String(u.role || '').toUpperCase(),
    });
    const sortReaders = (list) =>
      [...list].sort((a, b) => {
        const rank = (code) => (String(code).startsWith('SV') ? 0 : String(code).startsWith('GV') ? 1 : 2);
        const d = rank(a.user_code) - rank(b.user_code);
        return d !== 0 ? d : String(a.user_code).localeCompare(String(b.user_code));
      });

    const fetchRole = async (role) => {
      const items = [];
      for (let page = 1; page <= 20; page += 1) {
        const { data } = await axiosInstance.get('/api/admin/users', {
          params: { role, page, page_size: 100 },
        });
        const batch = data?.items || [];
        items.push(...batch);
        const totalPages = Number(data?.total_pages) || 1;
        if (page >= totalPages || batch.length === 0) break;
      }
      return items;
    };
    try {
      const [students, lecturers] = await Promise.all([
        fetchRole('STUDENT'),
        fetchRole('LECTURER'),
      ]);
      const items = sortReaders([
        ...students.map(mapUser),
        ...lecturers.map(mapUser),
      ]);
      setUserOptions(items);
    } catch {
      setUserOptions([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadRows({ silent: true });
      loadUserOptions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRows, loadUserOptions]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (matchFilter !== 'ALL' && r.status !== matchFilter) return false;
      if (!term) return true;
      return (
        r.bank_tx_id.toLowerCase().includes(term)
        || (r.transfer_content || '').toLowerCase().includes(term)
        || (r.assigned_user_code || '').toLowerCase().includes(term)
        || (r.bank_account_number || '').toLowerCase().includes(term)
      );
    });
  }, [rows, q, matchFilter]);

  const openRows = rows.filter((r) => r.status === 'UNRESOLVED');
  const assignedRows = rows.filter((r) => r.status === 'ASSIGNED');
  const openCount = openRows.length;
  const assignedCount = assignedRows.length;
  const openAmount = openRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const filteredUserOptions = useMemo(() => {
    const term = userQuery.trim().toLowerCase();
    if (!term) return userOptions;
    return userOptions.filter(
      (u) =>
        u.user_code.toLowerCase().includes(term)
        || (u.full_name || '').toLowerCase().includes(term)
    );
  }, [userOptions, userQuery]);

  const selectedUser = useMemo(
    () => userOptions.find((u) => u.user_code === userCode) || null,
    [userOptions, userCode]
  );

  const openAssign = (row) => {
    setAssignTarget(row);
    setUserCode('');
    setUserQuery('');
    setManualCode(false);
    setNotes('');
  };

  const confirmAssign = async () => {
    const code = userCode.trim();
    if (!assignTarget || !code) {
      showToast('Nhập hoặc chọn mã bạn đọc (MSSV) trước khi gán.', 'warning');
      return;
    }
    setAssigning(true);
    try {
      await walletService.assignUnmatched(assignTarget.id, code, notes);
      setAssignTarget(null);
      showToast(`Đã gán ${assignTarget.bank_tx_id} → ${code} và cộng số dư ví.`, 'success');
      await loadRows({ silent: true });
    } catch (e) {
      showToast(getApiErrorMessage(e, e.message || 'Gán thất bại.'), 'error');
    } finally {
      setAssigning(false);
    }
  };

  const columns = [
    {
      key: 'bank_tx_id',
      header: 'Mã ngân hàng',
      width: '22%',
      render: (val, row) => (
        <div className="min-w-0 max-w-[200px]">
          <p className="font-mono text-sm font-semibold text-slate-800 truncate" title={val}>{val}</p>
          <p className="text-xs text-slate-500 truncate">{formatWhen(row.received_at)}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Số tiền',
      width: '14%',
      align: 'right',
      render: (val) => <span className="font-bold text-emerald-700">{formatVND(val)}</span>,
    },
    {
      key: 'transfer_content',
      header: 'Nội dung CK',
      width: '25%',
      render: (val) => (
        <span className="text-sm text-slate-700 block max-w-xs truncate" title={val}>{val}</span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '20%',
      render: (val, row) =>
        val === 'ASSIGNED' ? (
          <div className="flex items-center gap-2 min-w-0">
            <StatusBadge status="Đã khớp" type="success" />
            <span className="text-[11px] text-slate-500 font-mono truncate" title={row.assigned_user_code}>
              {row.assigned_user_code}
            </span>
          </div>
        ) : (
          <StatusBadge status="Chưa khớp" type="warning" />
        ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '19%',
      align: 'right',
      render: (_, row) =>
        row.status === 'UNRESOLVED' ? (
          <Button
            size="sm"
            variant="primary"
            icon={<Link2 className="w-3.5 h-3.5" />}
            title="Gán giao dịch cho bạn đọc"
            onClick={() => openAssign(row)}
          >
            Gán người dùng
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
            Xử lý giao dịch nạp tiền chưa khớp: gán đúng bạn đọc để cộng số dư ví.
          </p>
        </div>
        <Button
          variant="outline"
          icon={<Users className="w-4 h-4" />}
          onClick={() => navigate('/admin/users')}
        >
          Người dùng
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setMatchFilter('UNRESOLVED')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm bg-gradient-to-br from-white to-amber-50/40 min-w-0 relative overflow-hidden transition-colors ${
            matchFilter === 'UNRESOLVED' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-amber-100 hover:border-amber-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <WalletCards className="w-6 h-6 text-amber-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chưa khớp</p>
          <p className="text-3xl font-extrabold text-amber-600 leading-none">
            {openCount} <span className="text-sm font-medium text-amber-500">giao dịch</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-amber-700">Bấm để lọc chưa gán ví</p>
        </button>
        <button
          type="button"
          onClick={() => setMatchFilter('ASSIGNED')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm bg-gradient-to-br from-white to-emerald-50/40 min-w-0 relative overflow-hidden transition-colors ${
            matchFilter === 'ASSIGNED' ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-emerald-100 hover:border-emerald-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Đã khớp</p>
          <p className="text-3xl font-extrabold text-emerald-600 leading-none">
            {assignedCount} <span className="text-sm font-medium text-emerald-500">giao dịch</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-emerald-700">Bấm để lọc đã gán ví</p>
        </button>
        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm min-w-0 relative overflow-hidden bg-gradient-to-br from-white to-indigo-50/40">
          <div className="absolute top-4 right-4">
            <WalletCards className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Số tiền chưa khớp</p>
          <p className="text-2xl font-extrabold text-indigo-600 leading-none">{formatVND(openAmount)}</p>
          <p className="mt-3 text-[11px] font-medium text-indigo-600">Tổng tiền đang chờ gán</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-stretch gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <Input
              placeholder="Tìm mã ngân hàng, nội dung CK…"
              leftIcon={<Search className="w-4 h-4" />}
              className="!h-10 !rounded-lg"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="h-10 w-full sm:w-44 shrink-0 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            value={matchFilter}
            onChange={(e) => setMatchFilter(e.target.value)}
          >
            <option value="ALL">Tất cả</option>
            <option value="UNRESOLVED">Chưa khớp</option>
            <option value="ASSIGNED">Đã khớp</option>
          </select>
          <Button
            type="button"
            variant="primary"
            className="!h-10 shrink-0 px-3 sm:px-4"
            icon={<Search className="w-4 h-4" />}
            onClick={() => {
              showToast(
                q.trim()
                  ? `Hiển thị ${filtered.length} giao dịch khớp bộ lọc.`
                  : 'Nhập từ khóa rồi bấm Tra cứu (lọc bảng bên dưới).',
                q.trim() ? 'success' : 'warning'
              );
            }}
          >
            Tra cứu
          </Button>
        </div>
      </div>

      <Table
        columns={columns}
        data={filtered}
        loading={loading}
        pagination
        itemsPerPage={10}
        emptyMessage={
          matchFilter === 'ASSIGNED'
            ? 'Chưa có giao dịch đã khớp.'
            : matchFilter === 'ALL'
              ? 'Không có giao dịch.'
              : 'Không có giao dịch chưa khớp.'
        }
      />

      <Modal
        isOpen={!!assignTarget}
        onClose={() => !assigning && setAssignTarget(null)}
        title="Gán giao dịch cho người dùng"
      >
        {assignTarget && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono font-semibold text-slate-800">{assignTarget.bank_tx_id}</p>
                <p className="text-emerald-700 font-bold">{formatVND(assignTarget.amount)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Nội dung chuyển khoản
                </p>
                <p className="text-slate-800 mt-0.5 break-words">{assignTarget.transfer_content || '—'}</p>
              </div>
              <p className="text-xs text-slate-500">
                Hệ thống chưa khớp được người nhận. Chọn đúng bạn đọc theo nội dung CK rồi xác nhận.
              </p>
            </div>

            {!manualCode ? (
              <div className="space-y-2">
                <Input
                  label="Tìm bạn đọc"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Tên hoặc MSSV…"
                  leftIcon={<Search className="w-4 h-4" />}
                />
                <label className="block text-sm font-medium text-slate-700">
                  Người nhận tiền
                  <select
                    className="mt-1.5 w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                    value={selectedUser ? userCode : ''}
                    onChange={(e) => setUserCode(e.target.value)}
                  >
                    <option value="">— Chưa chọn —</option>
                    {filteredUserOptions.map((u) => (
                      <option key={u.user_code} value={u.user_code}>
                        {u.full_name} ({u.user_code})
                      </option>
                    ))}
                  </select>
                </label>
                {filteredUserOptions.length === 0 && (
                  <p className="text-xs text-amber-700">Không có kết quả. Thử từ khóa khác hoặc nhập mã thủ công.</p>
                )}
                <button
                  type="button"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  onClick={() => {
                    setManualCode(true);
                    setUserCode('');
                  }}
                >
                  Không có trong danh sách? Nhập mã thủ công
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  label="Mã bạn đọc (MSSV)"
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                  placeholder="VD: SV20210001"
                  className="font-mono"
                  helperText="Nhập đúng mã đã đăng ký trong hệ thống."
                />
                <button
                  type="button"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  onClick={() => {
                    setManualCode(false);
                    setUserCode('');
                    setUserQuery('');
                  }}
                >
                  ← Quay lại chọn từ danh sách
                </button>
              </div>
            )}

            {userCode.trim() && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-sm">
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                  Sẽ cộng ví cho
                </p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {selectedUser
                    ? `${selectedUser.full_name} · ${selectedUser.user_code}`
                    : userCode.trim()}
                </p>
                <p className="text-emerald-800 font-bold mt-0.5">{formatVND(assignTarget.amount)}</p>
              </div>
            )}

            <Input
              label="Ghi chú đối chiếu (tuỳ chọn)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Đúng tên trên CK, đã gọi SV xác nhận…"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" disabled={assigning} onClick={() => setAssignTarget(null)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                loading={assigning}
                disabled={!userCode.trim()}
                icon={<Link2 className="w-4 h-4" />}
                onClick={confirmAssign}
              >
                Xác nhận gán
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
