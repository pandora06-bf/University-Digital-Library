import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoorOpen, Plus, Pencil, Power, ScanLine, RotateCcw } from 'lucide-react';
import { Button } from '../../components/Button';
import { Table, StatusBadge } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import {
  getStoredAdminRooms,
  upsertAdminRoom,
  setRoomActive,
  resetAdminRooms,
} from '../../mocks/adminRoomsMock';

const EMPTY = { name: '', floor: '', capacity: '4', slot_price: '20000', is_active: true };

const formatVND = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);

export default function RoomManagement() {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const [rooms, setRooms] = useState(() => getStoredAdminRooms());
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState({});

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rooms.filter(
      (r) =>
        !term ||
        r.name.toLowerCase().includes(term) ||
        (r.floor || '').toLowerCase().includes(term)
    );
  }, [rooms, q]);

  const activeCount = rooms.filter((r) => r.is_active).length;
  const inactiveCount = rooms.length - activeCount;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name,
      floor: row.floor || '',
      capacity: String(row.capacity),
      slot_price: String(row.slot_price),
      is_active: row.is_active,
    });
    setErrors({});
    setFormOpen(true);
  };

  const handleSave = () => {
    const nextErr = {};
    if (!form.name.trim()) nextErr.name = 'Bắt buộc';
    if (!Number(form.capacity) || Number(form.capacity) < 1) nextErr.capacity = '≥ 1';
    if (Number.isNaN(Number(form.slot_price)) || Number(form.slot_price) < 0) {
      nextErr.slot_price = 'Không hợp lệ';
    }
    if (Object.keys(nextErr).length) {
      setErrors(nextErr);
      showToast('Dữ liệu chưa hợp lệ. Vui lòng kiểm tra các ô báo đỏ.', 'error');
      return;
    }
    try {
      upsertAdminRoom(
        {
          name: form.name,
          floor: form.floor,
          capacity: Number(form.capacity),
          slot_price: Number(form.slot_price),
          is_active: form.is_active,
        },
        editing?.id || null
      );
      setRooms(getStoredAdminRooms());
      setFormOpen(false);
      showToast(editing ? 'Đã cập nhật phòng.' : 'Đã thêm phòng mới.', 'success');
    } catch (e) {
      showToast(e.message || 'Không lưu được phòng.', 'error');
    }
  };

  const toggleActive = (row) => {
    try {
      setRoomActive(row.id, !row.is_active);
      setRooms(getStoredAdminRooms());
      showToast(row.is_active ? 'Đã ngừng sử dụng phòng.' : 'Đã mở lại phòng.', 'success');
    } catch (e) {
      showToast(e.message || 'Không đổi trạng thái được.', 'error');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Phòng',
      render: (val, row) => (
        <div>
          <p className="font-semibold text-slate-800">{val}</p>
          <p className="text-xs text-slate-500">{row.floor || '—'}</p>
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'Sức chứa',
      render: (val) => <span className="font-medium">{val} chỗ</span>,
    },
    {
      key: 'slot_price',
      header: 'Giá / khung 2h',
      align: 'right',
      render: (val) => <span className="font-semibold text-slate-800">{formatVND(val)}</span>,
    },
    {
      key: 'is_active',
      header: 'Trạng thái',
      render: (val) => (
        <StatusBadge status={val ? 'Hoạt động' : 'Ngừng dùng'} type={val ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            title="Sửa"
            onClick={() => openEdit(row)}
            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            title={row.is_active ? 'Ngừng sử dụng' : 'Mở lại'}
            onClick={() => toggleActive(row)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              row.is_active
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      <Toast toast={toast} onClose={hideToast} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Phòng học nhóm</h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý danh mục phòng học nhóm: sức chứa, loại phòng, giá khung giờ và trạng thái sử dụng.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={<ScanLine className="w-4 h-4" />} onClick={() => navigate('/admin/rooms/checkin')}>
            Check-in mã đặt
          </Button>
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
            Thêm phòng
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">Đang dùng dữ liệu mẫu</p>
        <p className="text-amber-800/90 mt-0.5 text-[13px]">
          API quản trị phòng học chưa sẵn sàng. Thao tác chỉ lưu trên trình duyệt, không ghi máy chủ.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <DoorOpen className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tổng phòng</p>
          <p className="text-3xl font-extrabold text-slate-800 leading-none">
            {rooms.length} <span className="text-sm font-medium text-slate-500">phòng</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-slate-500">
            Danh mục phòng học nhóm trong hệ thống
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/40">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Đang hoạt động</p>
          <p className="text-3xl font-extrabold text-emerald-600 leading-none">
            {activeCount} <span className="text-sm font-medium text-emerald-500">phòng</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-emerald-600">
            Cho phép đặt lịch khung giờ 2 giờ
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-rose-50/30">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ngừng sử dụng</p>
          <p className="text-3xl font-extrabold text-rose-600 leading-none">
            {inactiveCount} <span className="text-sm font-medium text-rose-400">phòng</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-rose-600">
            Không còn hiện trên lịch đặt của người dùng
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dữ liệu mẫu</p>
            <p className="text-sm text-slate-600">Khôi phục danh sách phòng mẫu</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() => {
              setRooms(resetAdminRooms());
              showToast('Đã nạp lại dữ liệu mẫu phòng.', 'success');
            }}
          >
            Nạp lại
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Tìm tên phòng, tầng…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <DoorOpen className="w-4 h-4" />
          {filtered.length} phòng
        </div>
      </div>

      <Table columns={columns} data={filtered} emptyMessage="Không có phòng phù hợp." />

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Sửa phòng' : 'Thêm phòng mới'}
      >
        <div className="space-y-4">
          <Input
            label="Tên phòng"
            value={form.name}
            error={errors.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Tầng / khu"
            value={form.floor}
            onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Sức chứa"
              type="number"
              min={1}
              value={form.capacity}
              error={errors.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
            <Input
              label="Giá / khung 2 giờ (₫)"
              type="number"
              min={0}
              value={form.slot_price}
              error={errors.slot_price}
              onChange={(e) => setForm((f) => ({ ...f, slot_price: e.target.value }))}
            />
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Đang hoạt động
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Lưu
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
