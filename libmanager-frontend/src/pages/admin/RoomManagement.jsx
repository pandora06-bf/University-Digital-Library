import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoorOpen, Plus, Pencil, Power, ScanLine, CheckCircle2, Ban } from 'lucide-react';
import { Button } from '../../components/Button';
import { Table, StatusBadge } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import axiosInstance from '../../services/axios_instance';
import { getApiErrorMessage } from '../../services/errorHandler';
import { AdminIconButton } from '../../components/AdminIconButton';

const EMPTY = { name: '', floor: '', capacity: '4', slot_price: '20000', is_active: true };

const formatVND = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);

/** Map response BE → hàng bảng Admin */
const mapRoom = (r) => ({
  id: r.id,
  name: r.room_name || r.name || '',
  floor: r.floor || '',
  capacity: Number(r.capacity) || 0,
  slot_price: Number(r.price_per_slot ?? r.slot_price) || 0,
  room_type: r.room_type || '',
  is_active: Boolean(r.is_active),
});

export default function RoomManagement() {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // ALL | ACTIVE | INACTIVE
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState({});

  const loadRooms = useCallback(async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axiosInstance.get('/api/admin/rooms');
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setRooms(list.map(mapRoom));
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không tải được danh mục phòng.'), 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      loadRooms();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadRooms]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rooms.filter((r) => {
      const okActive =
        activeFilter === 'ALL'
        || (activeFilter === 'ACTIVE' && r.is_active)
        || (activeFilter === 'INACTIVE' && !r.is_active);
      const okQ =
        !term
        || r.name.toLowerCase().includes(term)
        || (r.floor || '').toLowerCase().includes(term);
      return okActive && okQ;
    });
  }, [rooms, q, activeFilter]);

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

  const handleSave = async () => {
    const nextErr = {};
    if (!form.name.trim()) nextErr.name = 'Bắt buộc';
    if (!Number(form.capacity) || Number(form.capacity) < 1) nextErr.capacity = '≥ 1';
    if (Number.isNaN(Number(form.slot_price)) || Number(form.slot_price) < 1) {
      nextErr.slot_price = '≥ 1';
    }
    if (Object.keys(nextErr).length) {
      setErrors(nextErr);
      showToast('Dữ liệu chưa hợp lệ. Vui lòng kiểm tra các ô báo đỏ.', 'error');
      return;
    }

    const payload = {
      room_name: form.name.trim(),
      floor: form.floor.trim() || null,
      capacity: Number(form.capacity),
      price_per_slot: Number(form.slot_price),
      is_active: form.is_active,
    };

    setSaving(true);
    try {
      if (editing?.id != null) {
        await axiosInstance.put(`/api/admin/rooms/${editing.id}`, payload);
        showToast('Đã cập nhật phòng.', 'success');
      } else {
        await axiosInstance.post('/api/admin/rooms', payload);
        showToast('Đã thêm phòng mới.', 'success');
      }
      setFormOpen(false);
      await loadRooms({ silent: true });
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không lưu được phòng.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    setSaving(true);
    try {
      await axiosInstance.put(`/api/admin/rooms/${row.id}`, {
        is_active: !row.is_active,
      });
      showToast(row.is_active ? 'Đã ngừng sử dụng phòng.' : 'Đã mở lại phòng.', 'success');
      await loadRooms({ silent: true });
    } catch (error) {
      showToast(
        getApiErrorMessage(
          error,
          row.is_active
            ? 'Không ngừng được phòng (có thể còn lượt đặt sắp tới).'
            : 'Không mở lại được phòng.'
        ),
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Phòng',
      render: (val, row) => (
        <div className="min-w-0 max-w-[220px]">
          <p className="font-semibold text-slate-800 truncate" title={val}>{val}</p>
          <p className="text-xs text-slate-500 truncate">{row.floor || '—'}</p>
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
        <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
          <AdminIconButton
            title="Chỉnh sửa"
            onClick={() => openEdit(row)}
            disabled={saving}
            className="w-8 h-8 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100"
          >
            <Pencil className="w-4 h-4" />
          </AdminIconButton>
          <AdminIconButton
            title={row.is_active ? 'Ngừng sử dụng phòng' : 'Mở lại phòng'}
            onClick={() => toggleActive(row)}
            disabled={saving}
            className={`w-8 h-8 rounded-full ${
              row.is_active
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
          >
            <Power className="w-4 h-4" />
          </AdminIconButton>
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
            Quản lý danh mục phòng học nhóm: sức chứa, giá khung giờ và trạng thái sử dụng.
            {loading ? ' · Đang tải…' : ''}
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setActiveFilter('ALL')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden transition-colors ${
            activeFilter === 'ALL' ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <DoorOpen className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tổng phòng</p>
          <p className="text-3xl font-extrabold text-slate-800 leading-none">
            {rooms.length} <span className="text-sm font-medium text-slate-500">phòng</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-slate-500">Bấm để xem tất cả</p>
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('ACTIVE')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/40 transition-colors ${
            activeFilter === 'ACTIVE' ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-emerald-100 hover:border-emerald-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Đang hoạt động</p>
          <p className="text-3xl font-extrabold text-emerald-600 leading-none">
            {activeCount} <span className="text-sm font-medium text-emerald-500">phòng</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-emerald-600">Bấm để lọc đang hoạt động</p>
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('INACTIVE')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-rose-50/30 transition-colors ${
            activeFilter === 'INACTIVE' ? 'border-rose-400 ring-2 ring-rose-200' : 'border-rose-100 hover:border-rose-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <Ban className="w-6 h-6 text-rose-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ngừng sử dụng</p>
          <p className="text-3xl font-extrabold text-rose-600 leading-none">
            {inactiveCount} <span className="text-sm font-medium text-rose-400">phòng</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-rose-600">Bấm để lọc ngừng sử dụng</p>
        </button>
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

      <Table
        columns={columns}
        data={filtered}
        emptyMessage={loading ? 'Đang tải danh mục phòng…' : 'Không có phòng phù hợp.'}
      />

      <Modal
        isOpen={formOpen}
        onClose={() => !saving && setFormOpen(false)}
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
              min={1}
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
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
