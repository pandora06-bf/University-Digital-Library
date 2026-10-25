import { Navigate, Outlet } from 'react-router-dom';
import { getToken } from '../services/axios_instance';
import { getCurrentUser } from '../mocks/auth';

/**
 * AdminRoute: chặn truy cập khu Admin nếu chưa đăng nhập hoặc role khác ADMIN (2B-17).
 */
export default function AdminRoute({ children }) {
  const token = getToken();
  const user = getCurrentUser();

  if (!token || !user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return children ? children : <Outlet />;
}
