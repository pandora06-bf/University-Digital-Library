import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, DoorOpen, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '../../components/Button';
import { Table, StatusBadge } from '../../components/Table';
import { Input } from '../../components/Input';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import {
  getTodayBookings,
  checkInByCode,
  getStoredAdminBookings,
  resetAdminRooms,
} from '../../mocks/adminRoomsMock';

const formatVND = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);

const statusMeta = (s) => {
  if (s === 'CHECKED_IN') return { label: 'Đã check-in', type: 'success' };
  if (s === 'CONFIRMED') return { label: 'Chờ check-in', type: 'warning' };
  if (s === 'NO_SHOW') return { label: 'Vắng mặt', type: 'danger' };
  if (s === 'CANCELLED') return { label: 'Đã hủy', type: 'neutral' };
  return { label: s, type: 'neutral' };
};

export default function RoomCheckin() {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [revision, setRevision] = useState(0);

  const todayList = useMemo(() => {
    void revision;
    return getTodayBookings();
  }, [revision]);

  const waiting = todayList.filter((b) => b.status === 'CONFIRMED').length;
  const checked = todayList.filter((b) => b.status === 'CHECKED_IN').length;

  const refresh = () => setRevision((n) => n + 1);

  const handleCheckin = (preset) => {
    const value = (preset || code).trim();
    if (!value) {
      setCodeError('Nhập mã đặt phòng');
      showToast('Vui lòng nhập mã đặt phòng.', 'warning');
      return;
    }
    setCodeError('');
    try {
      const booking = checkInByCode(value);
      showToast(
        `Check-in OK: ${booking.booking_code} · ${booking.user_name} · ${booking.room_name}`,
        'success'
      );
      setCode('');
      refresh();
    } catch (e) {
      showToast(e.message || 'Check-in thất bại.', 'error');
    }
  };

  const columns = [
    {
      key: 'booking_code',
      header: 'Mã đặt',
      render: (val) => <span className="font-mono text-sm font-semibold text-indigo-700">{val}</span>,
    },
    {
      key: 'user_name',
      header: 'Người đặt',
      render: (val, row) => (
        <div>
          <p className="font-medium text-slate-800">{val}</p>
          <p className="text-xs text-slate-500">{row.user_code}</p>
        </div>
      ),
    },
    {
      key: 'room_name',
      header: 'Phòng / khung',
      render: (val, row) => (
        <div>
          <p className="font-medium text-slate-800">{val}</p>
          <p className="text-xs text-slate-500">
            {row.slot_start}–{row.slot_end} · {formatVND(row.price)}
          </p>
        </div>
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
      render: (_, row) =>
        row.status === 'CONFIRMED' ? (
          <Button size="sm" variant="primary" onClick={() => handleCheckin(row.booking_code)}>
            Check-in</Button>
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
          <h1 className="text-2xl font-bold text-slate-800">Check-in phòng học nhóm</h1>
          <p className="text-sm text-slate-500 mt-1">
            Quầy nhập mã đặt phòng (Enter); danh sách lượt đặt trong ngày. Dữ liệu mẫu khi API check-in chưa sẵn.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={<DoorOpen className="w-4 h-4" />} onClick={() => navigate('/admin/rooms')}>
            Danh mục phòng
          </Button>
          <Button
            variant="outline"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={() => {
              resetAdminRooms();
              refresh();
              showToast('Đã nạp lại mẫu phòng & booking.', 'success');
            }}
          >
            Nạp lại mẫu
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <DoorOpen className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hôm nay</p>
          <p className="text-3xl font-extrabold text-slate-800 leading-none">
            {todayList.length} <span className="text-sm font-medium text-slate-500">lượt đặt</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-slate-500">
            Tất cả đặt phòng trong ngày hiện tại
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-amber-50/40">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chờ check-in</p>
          <p className="text-3xl font-extrabold text-amber-600 leading-none">
            {waiting} <span className="text-sm font-medium text-amber-500">lượt đặt</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-amber-600">
            Đã xác nhận, chờ quầy check-in mã đặt phòng
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/40">
          <div className="absolute top-4 right-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Đã check-in</p>
          <p className="text-3xl font-extrabold text-emerald-600 leading-none">
            {checked} <span className="text-sm font-medium text-emerald-500">lượt đặt</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-emerald-600">
            Đã xác nhận có mặt tại phòng học nhóm
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <ScanLine className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-800">Quét / nhập mã đặt phòng</h2>
        </div>
        <form
          className="flex flex-col sm:flex-row gap-3 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            handleCheckin();
          }}
        >
          <div className="flex-1">
            <Input
              label="Mã đặt (vd RB-2026-1001)"
              autoFocus
              value={code}
              error={codeError}
              placeholder="RB-2026-…"
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError('');
              }}
            />
          </div>
          <Button type="submit" variant="primary" icon={<CheckCircle2 className="w-4 h-4" />}>
            Xác nhận check-in
          </Button>
        </form>
        <p className="text-xs text-slate-500 mt-3">
          Gợi ý mẫu: <code className="bg-slate-100 px-1 rounded">RB-2026-1001</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">RB-2026-1002</code>
          {getStoredAdminBookings().length ? '' : ''}
        </p>
      </div>

      <div>
        <h2 className="text-base font-bold text-slate-800 mb-3">Lượt đặt trong ngày</h2>
        <Table columns={columns} data={todayList} emptyMessage="Chưa có lượt đặt hôm nay." />
      </div>
    </div>
  );
}
