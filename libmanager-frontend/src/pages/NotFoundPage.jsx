import { Link, useLocation } from 'react-router-dom';
import { BookX, ArrowLeft, LayoutDashboard, Home } from 'lucide-react';
import { Button } from '../components/Button';
import { getCurrentUser } from '../mocks/auth';

export default function NotFoundPage() {
  const location = useLocation();
  const user = getCurrentUser();
  const isAdminPath = location.pathname.startsWith('/admin');
  const isAdminUser = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-[#F6F8FC] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-6 shadow-sm">
        <BookX className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">404 — Trang không tồn tại</h1>
      <p className="text-slate-500 text-sm max-w-md mb-8">
        Địa chỉ <code className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-mono text-xs">{location.pathname}</code> không tồn tại hoặc đã được thay đổi trong hệ thống thư viện.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {isAdminPath || isAdminUser ? (
          <>
            <Link to="/admin">
              <Button variant="primary" icon={<LayoutDashboard className="w-4 h-4" />}>
                Về Tổng quan Quản trị
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" icon={<Home className="w-4 h-4" />}>
                Về Cổng Độc giả
              </Button>
            </Link>
          </>
        ) : (
          <Link to="/">
            <Button variant="primary" icon={<ArrowLeft className="w-4 h-4" />}>
              Quay về Trang chủ
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
