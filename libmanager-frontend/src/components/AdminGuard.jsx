import { Navigate, Outlet } from 'react-router-dom';
import { getToken } from '../services/axios_instance';
import { getCurrentUser } from '../mocks/auth';

/**
 * AdminGuard: Component chốt chặn bảo vệ các trang Admin.
 * Nếu chưa đăng nhập hoặc không phải quyền admin -> Đá về /login.
 */
export default function AdminGuard({ children }) {
  const token = getToken();
  const user = getCurrentUser();

  if (!token || !user || user.role !== 'admin') {
    // Chưa có vé hoặc vé không phải của Admin -> Đuổi về cửa
    return <Navigate to="/login" replace />;
  }

  // Nếu hợp lệ, cho phép render component con (hoặc Layout)
  return children ? children : <Outlet />;
}
