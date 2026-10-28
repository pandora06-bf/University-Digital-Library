import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getToken } from '../services/axios_instance';
import { getCurrentUser } from '../mocks/auth';
import { loginPathFor } from '../utils/loginRedirect';

/**
 * ProtectedRoute (2B-13): chặn trang cần đăng nhập ở cổng Người dùng.
 * - Chưa đăng nhập: chuyển sang /login và quay lại đúng trang sau khi đăng nhập.
 * - Có `roles` mà vai trò không khớp: về trang mặc định của vai trò đó.
 * Khu Admin dùng AdminRoute (2B-17, Vân).
 */
export default function ProtectedRoute({ children, roles }) {
  const location = useLocation();
  const user = getCurrentUser();

  if (!getToken() || !user) return <Navigate to={loginPathFor(location)} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={user.role === 'admin' ? '/admin/catalog' : '/'} replace />;

  return children ?? <Outlet />;
}
