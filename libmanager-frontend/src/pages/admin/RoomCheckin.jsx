import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, DoorOpen, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '../../components/Button';
import { Table, StatusBadge } from '../../components/Table';
import { Input } from '../../components/Input';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import axiosInstance from '../../services/axios_instance';
import { getApiErrorMessage } from '../../services/errorHandler';
import { getTodayBookings } from '../../mocks/adminRoomsMock';

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
  const [useMockList, setUseMockList] = useState(false);
  const [rows, setRows] = useState([]);
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
        setUseMockList(false);
      } catch (error) {
        // Fallback mock chỉ khi API lỗi — giữ UI demo được
        const mock = getTodayBookings().map((b) => ({
          id: b.booking_code,
          user_code: b.user_code,
          room_id: b.room_name || b.room_id,
          slot_start: b.slot_start,
          slot_end: b.slot_end,
          status: b.status,
          attendee_count: null,
          _mock: true,
        }));
        setRows(mock);
        setUseMockList(true);
        if (!opts.silent) {
          showToast(
            getApiErrorMessage(error, 'Không tải được lượt đặt — đang dùng dữ liệu mẫu.'),
            'warning'
          );
        }
      } finally {
        setLoadingList(false);
      }
    },
    [bookingDate, showToast]
  );

  useEffect(() => {
    loadBookings({ silent: true });
  }, [loadBookings]);

  const waiting = useMemo(
    () => rows.filter((b) => b.status === 'CONFIRMED').length,
    [rows]
  );
  const checked = useMemo(
    () => rows.filter((b) => b.status === 'CHECKED_IN').length,
    [rows]
  );

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
        `Check-in OK · #${updated.id}` +
          (updated.user_code && updated.user_code !== '—' ? ` · ${updated.user_code}` : ''),
        'success'
      );
      // Đồng bộ lại list theo ngày đang chọn
      await loadBookings({ silent: true });
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Check-in phòng thất bại.'), 'error');
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
      render: (val) => (
        <span className="font-mono text-sm font-semibold text-indigo-700">#{val}</span>
      ),
    },
    {
      key: 'user_code',
      header: 'Bạn đọc',
      render: (val) => <span className="font-mono text-sm text-slate-700">{val}</span>,
    },
    {
      key: 'room_id',
      header: 'Phòng',
      render: (val) => (
        <span className="text-sm text-slate-700">
          {typeof val === 'number' ? `Phòng #${val}` : val || '—'}
        </span>
      ),
    },
    {
      key: 'slot',
      header: 'Khung giờ',
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
      render: (val) => {
        const m = statusMeta(val);
        return <StatusBadge status={m.label} type={m.type} />;
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (_, row) => {
        if (useMockList || row._mock) {
          return <span className="text-xs text-slate-400">Mẫu</span>;
        }
        if (row.status !== 'CONFIRMED') {
          return <span className="text-xs text-slate-400">—</span>;
        }
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            isLoading={checkingId === row.id}
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

      {useMockList && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Đang dùng dữ liệu mẫu</p>
          <p className="text-amber-800/90 mt-0.5 text-[13px]">
            Không tải được{' '}
            <code className="bg-amber-100 px-1 rounded">GET /api/admin/room-bookings</code>. Form
            check-in vẫn gọi API thật khi nhập mã số.
          </p>
        </div>
      )}

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
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            {useMockList ? 'Trong ngày (mẫu)' : 'Trong ngày'}
          </p>
          <p className="text-3xl font-extrabold text-slate-800 leading-none">
            {rows.length}{' '}
            <span className="text-sm font-medium text-slate-500">lượt đặt</span>
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Chờ check-in
          </p>
          <p className="text-3xl font-extrabold text-amber-600 leading-none">
            {waiting} <span className="text-sm font-medium text-amber-500">lượt</span>
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Đã check-in
          </p>
          <p className="text-3xl font-extrabold text-emerald-600 leading-none">
            {checked} <span className="text-sm font-medium text-emerald-500">lượt</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-800">
          Lượt đặt {bookingDate}
          {useMockList ? ' (mẫu)' : ''}
        </h2>
        <Button
          variant="outline"
          size="sm"
          icon={<RotateCcw className="w-4 h-4" />}
          disabled={loadingList}
          onClick={() => loadBookings({ silent: false })}
        >
          {loadingList ? 'Đang tải…' : 'Tải lại'}
        </Button>
      </div>
      <Table
        columns={columns}
        data={rows}
        loading={loadingList}
        emptyMessage="Chưa có lượt đặt trong ngày này."
        rowKey={(r) => String(r.id)}
      />
    </div>
  );
}
