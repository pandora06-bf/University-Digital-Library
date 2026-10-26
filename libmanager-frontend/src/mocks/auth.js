/**
 * Dữ liệu tài khoản mẫu & Quản lý phiên đăng nhập (Mock Auth)
 * Không lưu mật khẩu nhạy cảm hay can thiệp ngầm vào backend
 */

export const DEMO_USERS = [
  {
    id: 'user_01',
    email: 'sinhvien@tdtu.edu.vn',
    name: 'Nguyễn Văn Đạt',
    role: 'user',
    studentId: '522H0012',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'admin_01',
    email: 'thuthu@tdtu.edu.vn',
    name: 'Phan Phạm Thúy Vân',
    role: 'admin',
    staffId: 'TT-0091',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  },
];

// Helper lấy người dùng hiện tại; lưu localStorage cùng token (2B-13)
export const getCurrentUser = () => {
  try {
    const data = localStorage.getItem('libmanager_user');
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

// Helper lưu người dùng vào localStorage
export const setCurrentUser = (user) => {
  try {
    if (user) localStorage.setItem('libmanager_user', JSON.stringify(user));
    else localStorage.removeItem('libmanager_user');
  } catch { /* bộ nhớ bị chặn: bỏ qua */ }
};
