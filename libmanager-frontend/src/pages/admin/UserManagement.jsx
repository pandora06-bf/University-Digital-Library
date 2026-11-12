import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Plus, RotateCcw, Lock, Unlock, KeyRound, Pencil, Eye,
  UserX, ShieldAlert, GraduationCap, Upload,
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Table, StatusBadge } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import axiosInstance from '../../services/axios_instance';
import { getApiErrorMessage } from '../../services/errorHandler';
const PAGE_SIZE = 8;
const EMPTY_FORM = {
  user_code: '',
  full_name: '',
  email: '',
  phone_number: '',
  department: '',
  role: 'STUDENT',
};

function mapApiUser(u) {
  return {
    // BE reset-password cần Account.id (int), không phải user_code
    account_id: u.account_id ?? u.account?.id ?? (Number.isInteger(u.id) ? u.id : null),
    user_code: u.user_code || u.student_id || u.username || u.id,
    full_name: u.full_name || u.name || '',
    email: u.email || '',
    phone_number: u.phone_number || u.phone || '',
    department: u.department || u.major || '',
    role: u.role || u.user_type || u.account?.role || 'STUDENT',
    is_locked: Boolean(u.is_locked ?? u.is_borrowing_blocked),
    total_fines: Number(u.total_fines || 0),
    max_borrow_limit: u.max_borrow_limit ?? (u.role === 'LECTURER' || u.user_type === 'LECTURER' ? 5 : 3),
  };
}

export default function UserManagement() {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const [apiError, setApiError] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [lockTarget, setLockTarget] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get('/api/admin/users', {
        params: { q: debouncedQ || undefined, role: roleFilter === 'ALL' ? undefined : roleFilter, page, page_size: PAGE_SIZE },
      });
<<<<<<< HEAD
      setAllUsers((data?.items || []).map(mapApiUser));
      setTotalCount(data?.total || 0);
      setApiError('');
    } catch (error) {
      setApiError(getApiErrorMessage(error, 'Không tải được danh sách người dùng từ API.'));
      setAllUsers([]);
      setTotalCount(0);
=======
      // Response 2xx (kể cả danh sách rỗng) = API list đã có — không ép mock
      const items = data?.items || data?.users || (Array.isArray(data) ? data : []);
      setUseMock(false);
      setAllUsers(items.map(mapApiUser));
    } catch {
      // Chỉ fallback mock khi request lỗi (404/5xx) — đúng với BE hiện tại
      setUseMock(true);
      refreshMock();
>>>>>>> origin/main
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, roleFilter, page]);

  useEffect(() => {
    // Defer để tránh setState đồng bộ trong body effect (react-hooks/set-state-in-effect)
    const timer = window.setTimeout(() => {
      fetchUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchUsers]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = page;
  const pageRows = allUsers;
  const totalUsers = totalCount;
  const lockedCount = allUsers.filter((u) => u.is_locked).length;
  const debtCount = allUsers.filter((u) => Number(u.total_fines) > 0).length;
  const studentCount = allUsers.filter((u) => u.role === 'STUDENT').length;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      user_code: row.user_code,
      full_name: row.full_name,
      email: row.email || '',
      phone_number: row.phone_number || '',
      department: row.department || '',
      role: row.role || 'STUDENT',
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = () => {
    const err = {};
    const code = form.user_code.trim();
    const name = form.full_name.trim();
    const email = form.email.trim();
    const phone = form.phone_number.trim();
    const dept = form.department.trim();

    // MSSV/mã: chữ số hoặc chữ+số, 3–20 ký tự (vd 50214569, GV001)
    if (!code) err.user_code = 'MSSV / mã bắt buộc';
    else if (!/^[A-Za-z0-9_-]{3,20}$/.test(code)) {
      err.user_code = 'Mã 3–20 ký tự (chữ/số/_/-), không khoảng trắng.';
    }

    // Họ tên: ≥ 2 từ, chỉ chữ cái + khoảng trắng (có dấu tiếng Việt)
    if (!name) err.full_name = 'Họ tên bắt buộc';
    else if (name.length < 5 || name.split(/\s+/).filter(Boolean).length < 2) {
      err.full_name = 'Họ tên tối thiểu 2 từ (vd: Nguyễn Văn A).';
    } else if (!/^[\p{L}\s'.-]+$/u.test(name)) {
      err.full_name = 'Họ tên chỉ gồm chữ cái và khoảng trắng.';
    }

    if (!email) err.email = 'Email bắt buộc';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      err.email = 'Email không đúng định dạng.';
    }

    // SĐT: nếu nhập thì phải 9–11 chữ số (cho phép +84 / 0 đầu)
    if (phone) {
      const digits = phone.replace(/[\s.-]/g, '');
      if (!/^(\+?84|0)?[3-9]\d{8}$/.test(digits) && !/^0\d{9,10}$/.test(digits)) {
        err.phone_number = 'SĐT không hợp lệ (vd: 0901234567).';
      }
    }

    if (!dept) err.department = 'Khoa / ngành bắt buộc';
    else if (dept.length < 3 || !/^[\p{L}0-9\s/&.-]+$/u.test(dept)) {
      err.department = 'Khoa/ngành không hợp lệ (vd: CNTT, tối thiểu 3 ký tự).';
    }

    setFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      showToast('Dữ liệu chưa hợp lệ. Vui lòng kiểm tra các ô báo đỏ.', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      user_code: form.user_code.trim(),
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone_number: form.phone_number.trim() || null,
      department: form.department.trim(),
      role: form.role,
    };

    try {
      if (editing) {
        await axiosInstance.put(`/api/admin/users/${encodeURIComponent(payload.user_code)}`, payload);
      } else {
        const { data } = await axiosInstance.post('/api/admin/users', payload);
        if (data?.temporary_password) {
          setTempPassword({ user_code: data.user_code, password: data.temporary_password });
        }
      }
      showToast(editing ? 'Đã cập nhật người dùng.' : 'Đã tạo người dùng.', 'success');
      setFormOpen(false);
      await fetchUsers();
    } catch (error) {
      const status = error?.response?.status;
      const msg = getApiErrorMessage(error, 'Không lưu được người dùng.');
      showToast(msg, 'error');
      if (status === 409) setFormErrors((e) => ({ ...e, user_code: msg }));
      if (status === 422) setFormErrors((e) => ({ ...e, email: msg }));
    } finally {
      setSaving(false);
    }
  };

  const confirmLockToggle = async () => {
    if (!lockTarget) return;
    const nextLocked = !lockTarget.is_locked;
    // BR-16: không mở khóa khi còn công nợ
    if (!nextLocked && Number(lockTarget.total_fines) > 0) {
      showToast('Còn công nợ, không mở khóa. Thu phạt trước tại quầy.', 'error');
      setLockTarget(null);
      return;
    }
    if (lockTarget.role === 'ADMIN' && nextLocked) {
      showToast('Không thể khóa tài khoản ADMIN.', 'error');
      setLockTarget(null);
      return;
    }

    try {
      await axiosInstance.patch(`/api/admin/users/${encodeURIComponent(lockTarget.user_code)}/lock`, {
        is_locked: nextLocked,
      });
      showToast(nextLocked ? 'Đã khóa tài khoản.' : 'Đã mở khóa.', 'success');
      setLockTarget(null);
      await fetchUsers();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không đổi trạng thái khóa.'), 'error');
      setLockTarget(null);
    }
  };

  const handleResetPassword = async (row) => {
    try {
      const accountId = row.account_id;
<<<<<<< HEAD
      if (accountId == null) {
        showToast('Thiếu Account.id, không thể reset mật khẩu.', 'error');
        return;
      }
      const { data } = await axiosInstance.post(`/api/admin/users/${accountId}/reset-password`);
      const temp = data?.temporary_password;
      if (temp) setTempPassword({ user_code: row.user_code, password: temp });
      showToast('Đã cấp mật khẩu tạm.', 'success');
=======
      if (!useMock && accountId != null) {
        const { data } = await axiosInstance.post(
          `/api/admin/users/${accountId}/reset-password`
        );
        const temp = data?.temporary_password || data?.temp_password || data?.password;
        if (!temp) {
          showToast('Máy chủ không trả mật khẩu tạm.', 'warning');
          return;
        }
        setTempPassword({ user_code: row.user_code, password: temp });
        showToast('Mật khẩu tạm chỉ hiện một lần — hãy ghi lại.', 'success');
        return;
      }
      if (!useMock && accountId == null) {
        showToast('Thiếu account_id — API đặt lại mật khẩu cần Account.id, không dùng MSSV.', 'warning');
        return;
      }
      const temp = issueTempPassword(row.user_code);
      setTempPassword({ user_code: row.user_code, password: temp });
      showToast('Mật khẩu tạm (dữ liệu mẫu) — chỉ hiện một lần.', 'success');
>>>>>>> origin/main
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không đặt lại mật khẩu.'), 'error');
    }
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
      showToast('Chỉ hỗ trợ tệp CSV hoặc XLSX.', 'warning');
      return;
    }
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await axiosInstance.post('/api/admin/users/import', form);
      const created = data?.created_accounts?.length ?? data?.created ?? 0;
      const skipped = data?.skipped ?? data?.errors?.length ?? 0;
      showToast(
        `Import xong: ${created} tài khoản mới` + (skipped ? `, ${skipped} bỏ qua/lỗi` : ''),
        'success'
      );
<<<<<<< HEAD
      await fetchUsers();
=======
      // Danh sách vẫn mock vì BE chưa có GET /users — chỉ báo kết quả import
>>>>>>> origin/main
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Import thất bại.'), 'error');
    } finally {
      setImporting(false);
    }
  };

  const iconBtn =
    'w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer';

  const columns = [
    {
      key: 'user_code',
      header: 'MSSV / Mã',
      render: (val) => (
        <span className="font-mono font-bold text-indigo-600 block bg-indigo-50/70 px-2 py-1 rounded w-fit text-xs">
          {val}
        </span>
      ),
    },
    {
      key: 'full_name',
      header: 'Họ tên & Email',
      render: (val, row) => (
        <div className="min-w-[180px] max-w-xs">
          <p className="font-bold text-slate-800 text-sm truncate" title={val}>{val}</p>
          <p className="text-[11px] text-slate-400 truncate">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Vai trò',
      render: (val) => (
        <StatusBadge
          status={val === 'ADMIN' ? 'Admin' : val === 'LECTURER' ? 'Giảng viên' : 'Sinh viên'}
          type={val === 'ADMIN' ? 'warning' : val === 'LECTURER' ? 'neutral' : 'success'}
        />
      ),
    },
    {
      key: 'department',
      header: 'Khoa / Ngành',
      render: (val) => <span className="text-sm font-medium text-slate-600">{val || '—'}</span>,
    },
    {
      key: 'is_locked',
      header: 'Trạng thái',
      render: (val, row) => (
        <div className="space-y-1 min-w-[110px]">
          <StatusBadge status={val ? 'Đã khóa' : 'Hoạt động'} type={val ? 'danger' : 'success'} />
          {Number(row.total_fines) > 0 && (
            <p className="text-[11px] text-rose-500 font-medium">
              Nợ {Number(row.total_fines).toLocaleString('vi-VN')} ₫
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5 min-w-[140px]">
          <button
            type="button"
            onClick={() => setDetailRow(row)}
            className={`${iconBtn} bg-indigo-50 text-indigo-600 hover:bg-indigo-100`}
            title="Xem chi tiết"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => openEdit(row)}
            className={`${iconBtn} bg-slate-50 text-slate-600 hover:bg-slate-100`}
            title="Sửa"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setLockTarget(row)}
            className={`${iconBtn} ${
              row.is_locked
                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
            }`}
            title={row.is_locked ? 'Mở khóa' : 'Khóa'}
          >
            {row.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => handleResetPassword(row)}
            className={`${iconBtn} bg-amber-50 text-amber-600 hover:bg-amber-100`}
            title="Đặt lại mật khẩu"
          >
            <KeyRound className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      <Toast toast={toast} onClose={hideToast} />

      {/* Header — cùng kiểu Incident / Fines */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Người dùng</h1>
          <p className="text-sm text-slate-500 mt-1">
<<<<<<< HEAD
            Quản lý tài khoản qua API thật: danh sách, thêm, sửa, khóa và đặt lại mật khẩu.
=======
            BE hiện chỉ có import CSV/XLSX và đặt lại mật khẩu theo Account.id — danh sách/CRUD/khóa vẫn dùng mẫu.
>>>>>>> origin/main
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={() => navigate('/admin/fines')}>
            Thu phạt &amp; Công nợ
          </Button>
          <label className={`inline-flex ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
            <Button
              variant="outline"
              icon={<Upload className="w-4 h-4" />}
              disabled={importing}
              onClick={() => document.getElementById('admin-user-import-input')?.click()}
            >
              {importing ? 'Đang import…' : 'Import CSV/XLSX'}
            </Button>
            <input
              id="admin-user-import-input"
              type="file"
              accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                handleImportFile(f);
              }}
            />
          </label>
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
            Thêm người dùng
          </Button>
        </div>
      </div>

<<<<<<< HEAD
      {apiError && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{apiError}</div>}
=======
      {useMock && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Danh sách đang dùng dữ liệu mẫu</p>
          <p className="text-amber-800/90 mt-0.5 text-[13px]">
            BE chưa có GET/CRUD/khóa <code className="bg-amber-100 px-1 rounded">/api/admin/users</code>.
            Chỉ <strong>Import CSV/XLSX</strong> và reset mật khẩu (Account.id) ghi máy chủ; thêm/sửa/khóa trên bảng chỉ lưu trình duyệt.
          </p>
        </div>
      )}
>>>>>>> origin/main

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <Users className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tổng tài khoản</p>
          <h3 className="text-3xl font-extrabold text-slate-800 leading-none">
            {totalUsers} <span className="text-sm font-medium text-slate-500">tài khoản</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-slate-500">Tổng tài khoản theo bộ lọc</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-indigo-50/30">
          <div className="absolute top-4 right-4">
            <GraduationCap className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sinh viên</p>
          <h3 className="text-3xl font-extrabold text-indigo-600 leading-none">
            {studentCount} <span className="text-sm font-medium text-indigo-400">tài khoản</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-indigo-600">Số sinh viên trên trang hiện tại</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-rose-50/30">
          <div className="absolute top-4 right-4">
            <UserX className="w-6 h-6 text-rose-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Đang khóa</p>
          <h3 className="text-3xl font-extrabold text-rose-600 leading-none">
            {lockedCount} <span className="text-sm font-medium text-rose-400">tài khoản</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-rose-600">Số đang khóa trên trang hiện tại</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-amber-50/30">
          <div className="absolute top-4 right-4">
            <ShieldAlert className="w-6 h-6 text-amber-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Có công nợ</p>
          <h3 className="text-3xl font-extrabold text-amber-600 leading-none">
            {debtCount} <span className="text-sm font-medium text-amber-400">người</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-amber-600">Số có nợ trên trang hiện tại</p>
        </div>
      </div>

      {/* Bảng + filter trong một card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 rounded-t-2xl">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="w-full sm:w-80">
              <Input
                type="text"
                placeholder="Tìm MSSV, họ tên, email…"
                leftIcon={<Search className="w-4 h-4" />}
                className="!h-10 !rounded-lg placeholder:font-sans"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer min-w-[180px]"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Vai trò (Tất cả)</option>
              <option value="STUDENT">Sinh viên</option>
              <option value="LECTURER">Giảng viên</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={() => {
                setSearchTerm('');
                setDebouncedQ('');
                setRoleFilter('ALL');
                setPage(1);

              }}
            >
              Đặt lại bộ lọc
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          data={pageRows}
          loading={loading}
          pagination
          page={safePage}
          totalPages={totalPages}
          totalItems={totalCount}
          onPageChange={setPage}
          emptyMessage="Không tìm thấy người dùng nào"
          rowKey={(r) => r.user_code}
        />
      </div>

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Sửa người dùng' : 'Thêm người dùng'}
        maxWidth="max-w-lg"
      >
        <div className="space-y-3">
          <Input
            label="MSSV / Mã"
            value={form.user_code}
            disabled={Boolean(editing)}
            error={formErrors.user_code}
            onChange={(e) => setForm((f) => ({ ...f, user_code: e.target.value }))}
          />
          <Input
            label="Họ tên"
            value={form.full_name}
            error={formErrors.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          />
          <Input
            label="Email"
            value={form.email}
            error={formErrors.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Điện thoại"
              value={form.phone_number}
              error={formErrors.phone_number}
              onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
            />
            <Input
              label="Khoa / ngành"
              value={form.department}
              error={formErrors.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            />
          </div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Vai trò
            <select
              className="mt-1 w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="STUDENT">Sinh viên</option>
              <option value="LECTURER">Giảng viên</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Hủy</Button>
            <Button variant="primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(lockTarget)}
        onClose={() => setLockTarget(null)}
        title={lockTarget?.is_locked ? 'Mở khóa tài khoản?' : 'Khóa tài khoản?'}
      >
        <p className="text-sm text-slate-600 mb-4">
          <span className="font-semibold text-slate-800">{lockTarget?.full_name}</span>
          {' '}
          <span className="font-mono text-xs text-indigo-600">({lockTarget?.user_code})</span>
          {Number(lockTarget?.total_fines) > 0 && (
            <span className="block mt-2 text-rose-600 font-medium">
              Đang nợ {Number(lockTarget.total_fines).toLocaleString('vi-VN')} ₫ — không mở khóa khi còn công nợ.
            </span>
          )}
        </p>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={() => setLockTarget(null)}>Hủy</Button>
          <Button variant="primary" onClick={confirmLockToggle}>Xác nhận</Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(tempPassword)}
        onClose={() => setTempPassword(null)}
        title="Mật khẩu tạm thời"
      >
        <p className="text-sm text-slate-600 mb-3">
          Chỉ hiện <strong>một lần</strong> cho{' '}
          <span className="font-mono text-indigo-600">{tempPassword?.user_code}</span>. Sao chép ngay.
        </p>
        <code className="block w-full p-3 rounded-xl bg-slate-900 text-amber-300 font-mono text-sm select-all">
          {tempPassword?.password}
        </code>
        <div className="flex justify-end mt-4 pt-3 border-t border-slate-100">
          <Button
            variant="primary"
            onClick={() => {
              navigator.clipboard?.writeText(tempPassword?.password || '');
              showToast('Đã copy mật khẩu tạm.', 'success');
              setTempPassword(null);
            }}
          >
            Copy &amp; đóng
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
        title="Chi tiết người dùng"
        maxWidth="max-w-lg"
      >
        {detailRow && (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                ['MSSV / Mã', detailRow.user_code],
                ['Họ tên', detailRow.full_name],
                ['Email', detailRow.email],
                ['SĐT', detailRow.phone_number || '—'],
                ['Khoa', detailRow.department || '—'],
                ['Vai trò', detailRow.role],
                ['Hạn mức mượn', detailRow.max_borrow_limit],
                ['Công nợ', `${Number(detailRow.total_fines).toLocaleString('vi-VN')} ₫`],
                ['Khóa mượn', detailRow.is_locked ? 'Có' : 'Không'],
              ].map(([k, v]) => (
                <div key={k} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">{k}</dt>
                  <dd className="font-semibold text-slate-800 mt-0.5 break-all">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setDetailRow(null)}>Đóng</Button>
              <Button
                variant="primary"
                onClick={() => {
                  openEdit(detailRow);
                  setDetailRow(null);
                }}
              >
                Sửa thông tin
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
