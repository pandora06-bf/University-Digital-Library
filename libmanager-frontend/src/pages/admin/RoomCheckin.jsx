import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, DoorOpen, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '../../components/Button';
import { Table, StatusBadge } from '../../components/Table';
import { Input } from '../../components/Input';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import axiosInstance from '../../services/axios_instance';
import { getApiErrorMessage } from '../../services/errorHandler';
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

/** BE CheckinBody chỉ nhận booking_id (int). Cho phép số thuần hoặc mã có đuôi số. */
function resolveBookingId(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  const tail = value.match(/(\d+)$/);
  return tail ? parseInt(tail[1], 10) : null;
}

export default function RoomCheckin() {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);

  const todayList = useMemo(() => {
    void revision;
    return getTodayBookings();
  }, [revision]);

  const waiting = todayList.filter((b) => b.status === 'CONFIRMED').length;
  const checked = todayList.filter((b) => b.status === 'CHECKED_IN').length;

  const refresh = () => setRevision((n) => n + 1);

  const handleCheckin = async (preset) => {
    const value = (preset || code).trim();
    if (!value) {
      setCodeError('Nhập booking_id hoặc mã đặt phòng');
      showToast('Vui lòng nhập booking_id (số) hoặc mã đặt mẫu.', 'warning');
      return;
    }
    setCodeError('');
    setBusy(true);

    const bookingId = resolveBookingId(value);

    // Ưu tiên API thật khi suy ra được booking_id
    if (bookingId != null) {
      try {
        const { data } = await axiosInstance.post('/api/admin/room-bookings/checkin', {
          booking_id: bookingId,
        });
        showToast(
          `Check-in OK (API): #${data?.id ?? bookingId}` +
            (data?.user_code ? ` · ${data.user_code}` : '') +
            (data?.status ? ` · ${data.status}` : ''),
          'success'
        );
        // Đồng bộ mock list nếu có cùng id/code
        try {
          checkInByCode(String(data?.id ?? bookingId));
        } catch {
          /* danh sách hôm nay vẫn mock — bỏ qua nếu không khớp */
        }
        setCode('');
        refresh();
        setBusy(false);
        return;
      } catch (error) {
        // Fallback mock theo mã nếu API lỗi (booking không tồn tại / ngoài khung giờ)
        const status = error?.response?.status;
        if (status && status !== 404 && status !== 409) {
          showToast(getApiErrorMessage(error, 'Check-in API thất bại.'), 'error');
          setBusy(false);
          return;
        }
        // 404/409: thử mock theo mã mẫu để demo UI
      }
    }

    try {
      const booking = checkInByCode(value);
      showToast(
        `Check-in OK (mẫu): ${booking.booking_code} · ${booking.user_name} · ${booking.room_name}`,
        'success'
      );
      setCode('');
      refresh();
    } catch (e) {
      showToast(
        getApiErrorMessage(
          { response: { data: { detail: e.message } } },
          e.message || 'Check-in thất bại. BE cần booking_id (int); danh sách hôm nay vẫn là mẫu.'
        ),
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'booking_code',
      header: 'Mã đặt',
      render: (val, row) => (
        <div>
          <span className="font-mono text-sm font-semibold text-indigo-700">{val}</span>
          {row.id != null && (
            <p className="text-[11px] text-slate-400 font-mono">id={row.id}</p>
          )}
        </div>
      ),
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
          <Button
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => handleCheckin(row.id != null ? String(row.id) : row.booking_code)}
          >
            Check-in
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
          <h1 className="text-2xl font-bold text-slate-800">Check-in phòng học nhóm</h1>
          <p className="text-sm text-slate-500 mt-1">
            API thật: <code className="bg-slate-100 px-1 rounded text-xs">POST /api/admin/room-bookings/checkin</code>
            {' '}với <code className="bg-slate-100 px-1 rounded text-xs">booking_id</code>. Danh sách hôm nay vẫn là mẫu (BE chưa có list admin).
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

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">Danh sách hôm nay = dữ liệu mẫu</p>
        <p className="text-amber-800/90 mt-0.5 text-[13px]">
          Nhập <strong>booking_id số</strong> (id trên DB) để gọi API check-in thật. Mã mẫu kiểu{' '}
          <code className="bg-amber-100 px-1 rounded">RB-2026-1001</code> chỉ cập nhật localStorage khi API 404/409.
          BE chỉ cho check-in trong 15 phút đầu khung giờ.
        </p>
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
            Tất cả đặt phòng trong ngày hiện tại (mẫu)
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-amber-50/40">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chờ check-in</p>
          <p className="text-3xl font-extrabold text-amber-600 leading-none">
            {waiting} <span className="text-sm font-medium text-amber-500">lượt đặt</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-amber-600">
            Đã xác nhận, chờ quầy check-in
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
          <h2 className="text-lg font-bold text-slate-800">Quét / nhập booking_id</h2>
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
              label="booking_id (số) hoặc mã mẫu"
              autoFocus
              value={code}
              error={codeError}
              placeholder="vd 12 hoặc RB-2026-1001"
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError('');
              }}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={busy}
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            {busy ? 'Đang xử lý…' : 'Xác nhận check-in'}
          </Button>
        </form>
        <p className="text-xs text-slate-500 mt-3">
          Gợi ý mẫu UI: <code className="bg-slate-100 px-1 rounded">RB-2026-1001</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">RB-2026-1002</code>
          {getStoredAdminBookings().length ? '' : ''}
        </p>
      </div>

      <div>
        <h2 className="text-base font-bold text-slate-800 mb-3">Lượt đặt trong ngày (mẫu)</h2>
        <Table columns={columns} data={todayList} emptyMessage="Chưa có lượt đặt hôm nay." />
      </div>
    </div>
  );
}
