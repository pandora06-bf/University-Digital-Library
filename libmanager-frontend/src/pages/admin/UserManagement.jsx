import { useCallback, useEffect, useState } from 'react';
import {
  Users, Search, Plus, Lock, Unlock, KeyRound, Pencil, Eye,
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
import { AdminIconButton } from '../../components/AdminIconButton';

const PAGE_SIZE = 8;

/** Chỉ 3 vai trò nghiệp vụ trên UI; ADMIN/LIBRARIAN cùng hiện «Thủ thư». */
const ROLE_LABEL_VI = {
  STUDENT: 'Sinh viên',
  LECTURER: 'Giảng viên',
  ADMIN: 'Thủ thư',
  LIBRARIAN: 'Thủ thư',
};

const roleLabelVi = (role) =>
  ROLE_LABEL_VI[String(role || '').toUpperCase()] || role || '—';

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
    lock_reason: u.lock_reason || '',
    total_fines: Number(u.total_fines || 0),
    max_borrow_limit: u.max_borrow_limit ?? (u.role === 'LECTURER' || u.user_type === 'LECTURER' ? 5 : 3),
  };
}

export default function UserManagement() {
  const { toast, showToast, hideToast } = useToast();
  const [apiError, setApiError] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [lockFilter, setLockFilter] = useState('ALL'); // ALL | LOCKED | ACTIVE
  const [debtFilter, setDebtFilter] = useState('ALL'); // ALL | DEBT | CLEAR
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [lockTarget, setLockTarget] = useState(null);
  const [lockReason, setLockReason] = useState('');
  const [lockReasonError, setLockReasonError] = useState('');
  const [tempPassword, setTempPassword] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [importing, setImporting] = useState(false);
  /** UC13 AC4/E5: báo cáo import — số thành công + danh sách dòng lỗi */
  const [importReport, setImportReport] = useState(null);
  const [stats, setStats] = useState({ students: 0, locked: 0, debt: 0 });

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  /** Tổng SV / khóa / công nợ trên toàn DB — không đếm theo trang (trang 1 toàn GV nên trước đây = 0). */
  const fetchStats = useCallback(async () => {
    try {
      const [{ data: studentPage }, { data: first }] = await Promise.all([
        axiosInstance.get('/api/admin/users', { params: { role: 'STUDENT', page: 1, page_size: 1 } }),
        axiosInstance.get('/api/admin/users', { params: { page: 1, page_size: 100 } }),
      ]);
      const total = Number(first?.total || 0);
      const pages = Math.max(1, Math.ceil(total / 100));
      let items = [...(first?.items || [])];
      if (pages > 1) {
        const rest = await Promise.all(
          Array.from({ length: pages - 1 }, (_, i) =>
            axiosInstance.get('/api/admin/users', { params: { page: i + 2, page_size: 100 } })
          )
        );
        for (const res of rest) items = items.concat(res.data?.items || []);
      }
      const mapped = items.map(mapApiUser);
      setStats({
        students: Number(studentPage?.total || 0),
        locked: mapped.filter((u) => u.is_locked).length,
        debt: mapped.filter((u) => Number(u.total_fines) > 0).length,
      });
    } catch {
      /* giữ stats cũ nếu lỗi */
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get('/api/admin/users', {
        params: {
          q: debouncedQ || undefined,
          role: roleFilter === 'ALL' ? undefined : roleFilter,
          locked: lockFilter === 'LOCKED' ? true : lockFilter === 'ACTIVE' ? false : undefined,
          has_debt: debtFilter === 'DEBT' ? true : debtFilter === 'CLEAR' ? false : undefined,
          page,
          page_size: PAGE_SIZE,
        },
      });
      setAllUsers((data?.items || []).map(mapApiUser));
      setTotalCount(data?.total || 0);
      setApiError('');
    } catch (error) {
      setApiError(getApiErrorMessage(error, 'Không tải được danh sách người dùng.'));
      setAllUsers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, roleFilter, lockFilter, debtFilter, page]);

  useEffect(() => {
    // Defer để tránh setState đồng bộ trong body effect (react-hooks/set-state-in-effect)
    const timer = window.setTimeout(() => {
      fetchUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchUsers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchStats();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchStats]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = page;
  const pageRows = allUsers;
  const totalUsers = totalCount;
  const lockedCount = stats.locked;
  const debtCount = stats.debt;
  const studentCount = stats.students;

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
      await fetchStats();
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
      setLockReason('');
      setLockReasonError('');
      return;
    }
    if (lockTarget.role === 'ADMIN' && nextLocked) {
      showToast('Không thể khóa tài khoản thủ thư.', 'error');
      setLockTarget(null);
      setLockReason('');
      setLockReasonError('');
      return;
    }
    const reason = lockReason.trim();
    if (nextLocked && !reason) {
      setLockReasonError('Vui lòng nhập lý do khóa tài khoản');
      return;
    }

    try {
      await axiosInstance.patch(`/api/admin/users/${encodeURIComponent(lockTarget.user_code)}/lock`, {
        is_locked: nextLocked,
        reason: nextLocked ? reason : null,
      });
      showToast(nextLocked ? 'Đã khóa tài khoản.' : 'Đã mở khóa.', 'success');
      setLockTarget(null);
      setLockReason('');
      setLockReasonError('');
      await fetchUsers();
      await fetchStats();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không đổi trạng thái khóa.'), 'error');
      setLockTarget(null);
      setLockReason('');
      setLockReasonError('');
    }
  };

  const handleResetPassword = async (row) => {
    try {
      const accountId = row.account_id;
      if (accountId == null) {
        showToast('Thiếu Account.id, không thể reset mật khẩu.', 'error');
        return;
      }
      const { data } = await axiosInstance.post(`/api/admin/users/${accountId}/reset-password`);
      const temp = data?.temporary_password;
      if (temp) setTempPassword({ user_code: row.user_code, password: temp });
      showToast('Đã cấp mật khẩu tạm.', 'success');
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
      const created =
        Number(data?.success_count ?? data?.created_accounts?.length ?? data?.created ?? 0);
      const errors = Array.isArray(data?.errors) ? data.errors : [];
      const errorCount = Number(data?.error_count ?? errors.length ?? data?.skipped ?? 0);
      setImportReport({
        fileName: file.name,
        created,
        errorCount,
        errors,
      });
      showToast(
        `Import xong: ${created} tài khoản mới` + (errorCount ? `, ${errorCount} dòng lỗi` : ''),
        errorCount ? 'warning' : 'success'
      );
      await fetchUsers();
      await fetchStats();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Import thất bại.'), 'error');
    } finally {
      setImporting(false);
      const input = document.getElementById('admin-user-import-input');
      if (input) input.value = '';
    }
  };

  const iconBtn =
    'w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer';

  const columns = [
    {
      key: 'user_code',
      header: 'MSSV / Mã',
      width: '14%',
      render: (val) => (
        <span className="font-mono font-bold text-indigo-600 block bg-indigo-50/70 px-2 py-1 rounded w-fit text-xs">
          {val}
        </span>
      ),
    },
    {
      key: 'full_name',
      header: 'Họ tên & Email',
      width: '23%',
      render: (val, row) => (
        <div className="min-w-0 w-full">
          <p className="font-bold text-slate-800 text-sm truncate" title={val}>{val}</p>
          <p className="text-[11px] text-slate-400 truncate">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Vai trò',
      width: '12%',
      render: (val) => {
        const role = String(val || '').toUpperCase();
        return (
          <StatusBadge
            status={roleLabelVi(role)}
            type={
              role === 'ADMIN' || role === 'LIBRARIAN'
                ? 'warning'
                : role === 'LECTURER'
                  ? 'neutral'
                  : 'success'
            }
          />
        );
      },
    },
    {
      key: 'department',
      header: 'Khoa / Ngành',
      width: '16%',
      render: (val) => <span className="text-sm text-slate-700">{val || '—'}</span>,
    },
    {
      key: 'is_locked',
      header: 'Trạng thái',
      width: '16%',
      render: (val, row) => (
        <div className="flex items-center gap-2 min-w-0 whitespace-nowrap">
          <StatusBadge status={val ? 'Đã khóa' : 'Hoạt động'} type={val ? 'danger' : 'success'} />
          {Number(row.total_fines) > 0 && (
            <span className="text-[11px] text-rose-500 font-medium truncate">
              Nợ {Number(row.total_fines).toLocaleString('vi-VN')} ₫
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '19%',
      align: 'right',
      render: (_, row) => (
        <div className="inline-flex items-center justify-end gap-1.5 min-w-[140px] whitespace-nowrap">
          <AdminIconButton
            onClick={() => setDetailRow(row)}
            className={`${iconBtn} bg-indigo-50 text-indigo-600 hover:bg-indigo-100`}
            title="Xem chi tiết"
          >
            <Eye className="w-4 h-4" />
          </AdminIconButton>
          <AdminIconButton
            onClick={() => openEdit(row)}
            className={`${iconBtn} bg-slate-50 text-slate-600 hover:bg-slate-100`}
            title="Chỉnh sửa"
          >
            <Pencil className="w-4 h-4" />
          </AdminIconButton>
          <AdminIconButton
            onClick={() => {
              setLockTarget(row);
              setLockReason('');
              setLockReasonError('');
            }}
            className={`${iconBtn} ${
              row.is_locked
                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
            }`}
            title={row.is_locked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
          >
            {row.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </AdminIconButton>
          <AdminIconButton
            onClick={() => handleResetPassword(row)}
            className={`${iconBtn} bg-amber-50 text-amber-600 hover:bg-amber-100`}
            title="Đặt lại mật khẩu"
          >
            <KeyRound className="w-4 h-4" />
          </AdminIconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      <Toast toast={toast} onClose={hideToast} />

      {/* Header — title trái, CTA phải (cùng khung Catalog / Incident / Rooms) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Người dùng</h1>
          <p className="text-sm text-slate-500 mt-1">
            Danh sách, thêm, sửa, khóa và đặt lại mật khẩu tài khoản bạn đọc / thủ thư.
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-3 shrink-0 ml-auto">
          <Button
            variant="outline"
            icon={<Upload className="w-4 h-4" />}
            disabled={importing}
            className={importing ? 'opacity-60' : undefined}
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
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
            Thêm người dùng
          </Button>
        </div>
      </div>

      {apiError && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{apiError}</div>}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => {
            setRoleFilter('ALL');
            setLockFilter('ALL');
            setDebtFilter('ALL');
            setPage(1);
          }}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden transition-colors ${
            roleFilter === 'ALL' && lockFilter === 'ALL' && debtFilter === 'ALL'
              ? 'border-indigo-400 ring-2 ring-indigo-200'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <Users className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tổng tài khoản</p>
          <h3 className="text-3xl font-extrabold text-slate-800 leading-none">
            {totalUsers} <span className="text-sm font-medium text-slate-500">tài khoản</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-slate-500">Bấm để xem tất cả</p>
        </button>
        <button
          type="button"
          onClick={() => {
            setRoleFilter('STUDENT');
            setLockFilter('ALL');
            setDebtFilter('ALL');
            setPage(1);
          }}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-indigo-50/30 transition-colors ${
            roleFilter === 'STUDENT' ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-indigo-100 hover:border-indigo-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <GraduationCap className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sinh viên</p>
          <h3 className="text-3xl font-extrabold text-indigo-600 leading-none">
            {studentCount} <span className="text-sm font-medium text-indigo-400">tài khoản</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-indigo-600">Bấm để lọc sinh viên</p>
        </button>
        <button
          type="button"
          onClick={() => {
            setLockFilter('LOCKED');
            setDebtFilter('ALL');
            setPage(1);
          }}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-rose-50/30 transition-colors ${
            lockFilter === 'LOCKED' ? 'border-rose-400 ring-2 ring-rose-200' : 'border-rose-100 hover:border-rose-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <UserX className="w-6 h-6 text-rose-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Đang khóa</p>
          <h3 className="text-3xl font-extrabold text-rose-600 leading-none">
            {lockedCount} <span className="text-sm font-medium text-rose-400">tài khoản</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-rose-600">Bấm để lọc đang khóa</p>
        </button>
        <button
          type="button"
          onClick={() => {
            setDebtFilter('DEBT');
            setLockFilter('ALL');
            setPage(1);
          }}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-amber-50/30 transition-colors ${
            debtFilter === 'DEBT' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-amber-100 hover:border-amber-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <ShieldAlert className="w-6 h-6 text-amber-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Có công nợ</p>
          <h3 className="text-3xl font-extrabold text-amber-600 leading-none">
            {debtCount} <span className="text-sm font-medium text-amber-400">người</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-amber-600">Bấm để lọc còn nợ</p>
        </button>
      </div>

      {/* Bảng + filter trong một card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl space-y-3">
          <div className="flex items-stretch gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <Input
                type="text"
                placeholder="Tìm MSSV, họ tên, email…"
                leftIcon={<Search className="w-4 h-4" />}
                className="!h-10 !rounded-lg placeholder:font-sans"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const q = searchTerm.trim();
                    setDebouncedQ(q);
                    setPage(1);
                    showToast(
                      q
                        ? `Đang tra cứu «${q}».`
                        : 'Nhập MSSV/họ tên rồi bấm Tra cứu (hoặc để trống để xem tất cả).',
                      q ? 'success' : 'warning'
                    );
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="primary"
              className="!h-10 shrink-0 px-3 sm:px-4"
              icon={<Search className="w-4 h-4" />}
              onClick={() => {
                const q = searchTerm.trim();
                setDebouncedQ(q);
                setPage(1);
                showToast(
                  q
                    ? `Đang tra cứu «${q}».`
                    : 'Nhập MSSV/họ tên rồi bấm Tra cứu (hoặc để trống để xem tất cả).',
                  q ? 'success' : 'warning'
                );
              }}
            >
              Tra cứu
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              className="h-10 w-full px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Vai trò (Tất cả)</option>
              <option value="STUDENT">Sinh viên</option>
              <option value="LECTURER">Giảng viên</option>
              <option value="ADMIN">Thủ thư</option>
            </select>
            <select
              className="h-10 w-full px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              value={lockFilter}
              onChange={(e) => {
                setLockFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Khóa (Tất cả)</option>
              <option value="LOCKED">Đang khóa</option>
              <option value="ACTIVE">Đang hoạt động</option>
            </select>
            <select
              className="h-10 w-full px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              value={debtFilter}
              onChange={(e) => {
                setDebtFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Công nợ (Tất cả)</option>
              <option value="DEBT">Có công nợ</option>
              <option value="CLEAR">Không nợ</option>
            </select>
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
              <option value="ADMIN">Thủ thư</option>
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
        onClose={() => {
          setLockTarget(null);
          setLockReason('');
          setLockReasonError('');
        }}
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
          {lockTarget?.is_locked && lockTarget?.lock_reason && (
            <span className="block mt-2 text-slate-500">
              Lý do khóa hiện tại: <span className="font-medium text-slate-700">{lockTarget.lock_reason}</span>
            </span>
          )}
        </p>
        {!lockTarget?.is_locked && (
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Lý do khóa <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={lockReason}
              onChange={(e) => {
                setLockReason(e.target.value);
                if (lockReasonError) setLockReasonError('');
              }}
              rows={3}
              maxLength={500}
              placeholder="VD: Vi phạm quy định mượn sách / nợ phạt kéo dài..."
              className={`w-full px-3 py-2.5 rounded-xl border text-sm text-slate-700 focus:outline-none focus:ring-2 resize-none ${
                lockReasonError
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
              }`}
            />
            {lockReasonError && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">{lockReasonError}</p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            variant="outline"
            onClick={() => {
              setLockTarget(null);
              setLockReason('');
              setLockReasonError('');
            }}
          >
            Hủy
          </Button>
          <Button variant="primary" onClick={confirmLockToggle}>Xác nhận</Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(importReport)}
        onClose={() => setImportReport(null)}
        title="Báo cáo import tài khoản"
        maxWidth="max-w-lg"
      >
        {importReport && (
          <>
            <p className="text-sm text-slate-600 mb-3">
              Tệp <span className="font-mono text-indigo-600">{importReport.fileName}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                <p className="text-[11px] font-bold uppercase text-emerald-600">Thành công</p>
                <p className="text-2xl font-extrabold text-emerald-700 tabular-nums">
                  {importReport.created}
                </p>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
                <p className="text-[11px] font-bold uppercase text-rose-600">Dòng lỗi</p>
                <p className="text-2xl font-extrabold text-rose-700 tabular-nums">
                  {importReport.errorCount}
                </p>
              </div>
            </div>
            {importReport.errors.length > 0 ? (
              <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-bold w-20">Dòng</th>
                      <th className="px-3 py-2 font-bold">Lý do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importReport.errors.map((err, idx) => (
                      <tr key={`${err.row}-${idx}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-mono font-semibold text-slate-800">
                          {err.row ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {err.reason || err.message || 'Không rõ lý do'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                Không có dòng lỗi — toàn bộ dòng hợp lệ đã được tạo.
              </p>
            )}
            <div className="flex justify-end mt-4 pt-3 border-t border-slate-100">
              <Button variant="primary" onClick={() => setImportReport(null)}>
                Đóng
              </Button>
            </div>
          </>
        )}
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
                ['Vai trò', roleLabelVi(detailRow.role)],
                ['Hạn mức mượn', detailRow.max_borrow_limit],
                ['Công nợ', `${Number(detailRow.total_fines).toLocaleString('vi-VN')} ₫`],
                ['Khóa mượn', detailRow.is_locked ? 'Có' : 'Không'],
                ['Lý do khóa', detailRow.lock_reason || '—'],
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
                icon={<Pencil className="w-4 h-4" />}
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
