import axiosInstance from './axios_instance';

const ROLE_LABELS = {
  STUDENT: 'Sinh viên',
  LECTURER: 'Giảng viên',
  ADMIN: 'Thủ thư',
  LIBRARIAN: 'Thủ thư',
};

// Thông tin người dùng (GET /api/users/me, user_service.get_user_profile).
export const profileService = {
  async getMe() {
    const { data } = await axiosInstance.get('/api/users/me');
    return {
      fullName: data.full_name ?? '',
      userCode: data.user_code ?? '',
      email: data.email ?? null,
      phone: data.phone_number ?? null,
      department: data.department ?? null,
      role: data.role ?? null,
      roleLabel: ROLE_LABELS[String(data.role ?? '').toUpperCase()] ?? data.role ?? '',
      locked: Boolean(data.is_locked),
      totalFines: Number(data.total_fines ?? 0),
      balance: Number(data.service_balance ?? 0),
      borrowLimit: data.borrow_limit ?? null, // dạng "1/3"
    };
  },
};
