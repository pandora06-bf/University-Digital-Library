import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, DoorOpen, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { Table, StatusBadge } from '../../components/Table';
import { Input } from '../../components/Input';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import axiosInstance from '../../services/axios_instance';
import { getApiErrorMessage } from '../../services/errorHandler';

/** YYYY-MM-DD theo lịch máy (VN thường GMT+7). */
function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const formatSlot = (v) => {
  if (v == null) return '—';
  if (typeof v === 'string') return v.slice(0, 5);
  return String(v);
};

const statusMeta = (s) => {
  if (s === 'CHECKED_IN') return { label: 'Đã check-in', type: 'success' };
  if (s === 'CONFIRMED') return { label: 'Chờ check-in', type: 'warning' };
  if (s === 'NO_SHOW') return { label: 'Vắng mặt', type: 'danger' };
  if (s === 'CANCELLED') return { label: 'Đã hủy', type: 'neutral' };
  if (s === 'COMPLETED') return { label: 'Hoàn tất', type: 'success' };
  return { label: s || '—', type: 'neutral' };
};

function parseBookingId(raw) {
  const value = String(raw || '').trim();
  if (!/^\d+$/.test(value)) return null;
  const n = parseInt(value, 10);
  return n > 0 ? n : null;
}

function mapBookingRow(b) {
  return {
    id: b.id,
    user_code: b.user_code || '—',
    room_id: b.room_id,
    booking_date: b.booking_date,
    slot_start: formatSlot(b.slot_start),
    slot_end: formatSlot(b.slot_end),
    status: b.status || 'CONFIRMED',
    checkin_time: b.checkin_time,
    attendee_count: b.attendee_count,
  };
}

export default function RoomCheckin() {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const [bookingDate, setBookingDate] = useState(todayISODate);
  const [bookingIdInput, setBookingIdInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | CONFIRMED | CHECKED_IN
  const [checkingId, setCheckingId] = useState(null);

  const loadBookings = useCallback(
    async (opts = { silent: false }) => {
      setLoadingList(true);
      try {
        const { data } = await axiosInstance.get('/api/admin/room-bookings', {
          params: { booking_date: bookingDate },
        });
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setRows(list.map(mapBookingRow));
      } catch (error) {
        setRows([]);
        if (!opts.silent) {
          showToast(
            getApiErrorMessage(error, 'Không tải được danh sách lượt đặt.'),
            'error'
          );
        }
      } finally {
        setLoadingList(false);
      }
    },
    [bookingDate, showToast]
  );

  useEffect(() => {
    // Defer để tránh setState đồng bộ trong body effect (react-hooks/set-state-in-effect)
    const timer = window.setTimeout(() => {
      loadBookings({ silent: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBookings]);

  const waiting = useMemo(
    () => rows.filter((b) => b.status === 'CONFIRMED').length,
    [rows]
  );
  const checked = useMemo(
    () => rows.filter((b) => b.status === 'CHECKED_IN').length,
    [rows]
  );
  const filteredRows = useMemo(() => {
    if (statusFilter === 'ALL') return rows;
    return rows.filter((b) => b.status === statusFilter);
  }, [rows, statusFilter]);

  const runCheckin = async (bookingId) => {
    setCheckingId(bookingId);
    setBusy(true);
    try {
      const { data } = await axiosInstance.post('/api/admin/room-bookings/checkin', {
        booking_id: bookingId,
      });
      const updated = mapBookingRow(data || { id: bookingId, status: 'CHECKED_IN' });
      setRows((prev) => {
        const exists = prev.some((r) => String(r.id) === String(updated.id));
        if (!exists) return [updated, ...prev];
        return prev.map((r) => (String(r.id) === String(updated.id) ? { ...r, ...updated } : r));
      });
      setBookingIdInput('');
      showToast(
        `Đã xác nhận vào phòng · #${updated.id}` +
          (updated.user_code && updated.user_code !== '—' ? ` · ${updated.user_code}` : ''),
        'success'
      );
      // Đồng bộ lại list theo ngày đang chọn
      await loadBookings({ silent: true });
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Xác nhận vào phòng thất bại.'), 'error');
    } finally {
      setBusy(false);
      setCheckingId(null);
    }
  };

  const handleFormCheckin = async (e) => {
    e?.preventDefault?.();
    const bookingId = parseBookingId(bookingIdInput);
    if (bookingId == null) {
      setInputError('Nhập mã lượt đặt dạng số (vd: 12)');
      showToast('Vui lòng nhập mã lượt đặt (số).', 'warning');
      return;
    }
    setInputError('');
    await runCheckin(bookingId);
  };

  const columns = [
    {
      key: 'id',
      header: 'Mã lượt',
      width: '10%',
      render: (val) => (
        <span className="font-mono text-sm font-semibold text-indigo-700">#{val}</span>
      ),
    },
    {
      key: 'user_code',
      header: 'Bạn đọc',
      width: '16%',
      render: (val) => <span className="font-mono text-sm text-slate-700">{val}</span>,
    },
    {
      key: 'room_id',
      header: 'Phòng',
      width: '16%',
      render: (val) => (
        <span className="text-sm text-slate-700">
          {typeof val === 'number' ? `Phòng #${val}` : val || '—'}
        </span>
      ),
    },
    {
      key: 'slot',
      header: 'Khung giờ',
      width: '24%',
      render: (_, row) => (
        <span className="text-sm text-slate-600 whitespace-nowrap">
          {row.slot_start}–{row.slot_end}
          {row.attendee_count != null ? ` · ${row.attendee_count} người` : ''}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '16%',
      render: (val) => {
        const m = statusMeta(val);
        return <StatusBadge status={m.label} type={m.type} />;
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '18%',
      align: 'right',
      render: (_, row) => {
        if (row.status !== 'CONFIRMED') {
          return <span className="text-xs text-slate-400">—</span>;
        }
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            isLoading={checkingId === row.id}
            icon={<ScanLine className="w-3.5 h-3.5" />}
            onClick={() => runCheckin(row.id)}
          >
            Check-in
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      <Toast toast={toast} onClose={hideToast} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Check-in phòng học nhóm</h1>
          <p className="text-sm text-slate-500 mt-1">
            Nhập mã lượt đặt hoặc bấm Check-in trên bảng. Chỉ hợp lệ trong 15 phút đầu khung giờ.
          </p>
        </div>
        <Button
          variant="outline"
          icon={<DoorOpen className="w-4 h-4" />}
          onClick={() => navigate('/admin/rooms')}
        >
          Danh mục phòng
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <ScanLine className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-800">Check-in lượt đặt</h2>
        </div>
        <form
          className="flex flex-col sm:flex-row gap-3 sm:items-end"
          onSubmit={handleFormCheckin}
        >
          <div className="w-full sm:w-44">
            <Input
              label="Ngày"
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value || todayISODate())}
            />
          </div>
          <div className="flex-1">
            <Input
              label="Mã lượt đặt"
              autoFocus
              inputMode="numeric"
              value={bookingIdInput}
              error={inputError}
              placeholder="vd: 12"
              onChange={(e) => {
                setBookingIdInput(e.target.value.replace(/[^\d]/g, ''));
                setInputError('');
              }}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={busy}
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            {busy ? 'Đang gửi…' : 'Xác nhận check-in'}
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden transition-colors ${
            statusFilter === 'ALL' ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <DoorOpen className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Trong ngày
          </p>
          <p className="text-3xl font-extrabold text-slate-800 leading-none">
            {rows.length}{' '}
            <span className="text-sm font-medium text-slate-500">lượt đặt</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-slate-500">Bấm để xem tất cả</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('CONFIRMED')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-amber-50/40 transition-colors ${
            statusFilter === 'CONFIRMED' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-amber-100 hover:border-amber-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <ScanLine className="w-6 h-6 text-amber-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Chờ vào phòng
          </p>
          <p className="text-3xl font-extrabold text-amber-600 leading-none">
            {waiting} <span className="text-sm font-medium text-amber-500">lượt</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-amber-600">Bấm để lọc chờ vào phòng</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('CHECKED_IN')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/40 transition-colors ${
            statusFilter === 'CHECKED_IN' ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-emerald-100 hover:border-emerald-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Đã vào phòng
          </p>
          <p className="text-3xl font-extrabold text-emerald-600 leading-none">
            {checked} <span className="text-sm font-medium text-emerald-500">lượt</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-emerald-600">Bấm để lọc đã vào phòng</p>
        </button>
      </div>

      <h2 className="text-base font-bold text-slate-800">
        Lượt đặt {bookingDate}
        {loadingList ? ' · Đang tải…' : ''}
        {statusFilter !== 'ALL' ? ` · Đang lọc (${filteredRows.length})` : ''}
      </h2>
      <Table
        columns={columns}
        data={filteredRows}
        loading={loadingList}
        pagination
        itemsPerPage={10}
        emptyMessage="Chưa có lượt đặt trong ngày này."
        rowKey={(r) => String(r.id)}
      />
    </div>
  );
}
