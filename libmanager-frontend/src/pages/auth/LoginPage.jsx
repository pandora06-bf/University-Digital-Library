import { useState } from 'react';
import { Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { CursorRipple } from '../../components/motion/CursorRipple';
import { login } from '../../services/authService';
import { getToken } from '../../services/axios_instance';
import { getCurrentUser } from '../../mocks/auth';
import { landingPathFor } from '../../utils/loginRedirect';
import BrandMark from '../../components/user/BrandMark';

/**
 * Màn hình Đăng nhập (Login Page)
 * Chuẩn Figma Node 46:2 (Desktop) và Node 66:2 (Mobile)
 * 
 * Bố cục:
 * - Desktop 1440: Vùng panel thương hiệu trái (720px) với gradient chàm-cyan,
 *   Card đăng nhập phải (430px, padding 40px, radius 28px, heading 32/40/600).
 * - Mobile 390: Brand banner trên cao 320px, card form đè lên 72px (radius 24px),
 *   cuộn linh hoạt khi bàn phím ảo xuất hiện.
 */
export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Đã đăng nhập thì không ở lại trang Đăng nhập
  const current = getCurrentUser();
  if (getToken() && current) return <Navigate to={landingPathFor(current, redirect)} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
      return;
    }

    setIsLoading(true);

    // Gọi POST /api/auth/login; token được lưu để Axios Interceptor tự đính kèm
    try {
      const user = await login(username.trim(), password);
      if (onLogin) onLogin(user);
      // Điều hướng theo vai trò; quay lại trang sách nếu khách bấm mượn trước đó (2B-14)
      navigate(landingPathFor(user, redirect), { replace: true });
    } catch (err) {
      if (err.response?.status === 401) setErrorMsg('Sai tên đăng nhập hoặc mật khẩu');
      else if (err.response?.status === 403) setErrorMsg('Tài khoản đã bị khóa');
      else setErrorMsg('Không kết nối được máy chủ, vui lòng thử lại');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F6F8FC] relative overflow-x-hidden">
      
      {/* 1. BRAND PANEL BÊN TRÁI (Desktop: 720px / Mobile: 320px) */}
      <div className="w-full lg:w-1/2 min-h-[300px] sm:min-h-[340px] lg:min-h-screen bg-gradient-to-br from-[#312E81] via-[#4F46E5] to-[#0E7490] p-8 sm:p-12 lg:p-20 flex flex-col justify-between text-white relative overflow-hidden shrink-0">
        
        {/* Hiệu ứng gợn sóng con trỏ (Cursor Ripple) */}
        <CursorRipple />

        {/* Lớp hạt trang trí & vệt sáng nền */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-indigo-400/20 blur-2xl pointer-events-none" />

        {/* Brand Header — bấm logo về trang chủ (khách duyệt danh mục) */}
        <div className="relative z-10">
          <Link
            to="/"
            aria-label="Về trang chủ thư viện LibManager"
            title="Về trang chủ"
            className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 transition-colors"
          >
            <BrandMark className="w-8 h-8 shrink-0 rounded-[30%] ring-1 ring-white/30" />
            <span className="font-semibold tracking-wide text-sm sm:text-base">LibManager Portal</span>
          </Link>
        </div>

        {/* Brand Hero Slogan */}
        <div className="relative z-10 my-8 lg:my-0 space-y-4 max-w-lg">
          <span className="text-xs font-semibold uppercase tracking-widest text-cyan-200">
            Đại học Tôn Đức Thắng
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
            Khám phá Tri thức trong Kỷ nguyên Số
          </h1>
          <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed font-normal">
            Truy cập hàng chục nghìn giáo trình, tài liệu chuyên ngành, luận văn và bản ghi số hóa chuẩn quốc tế mọi lúc, mọi nơi.
          </p>
        </div>

        {/* Brand Footer */}
        <div className="relative z-10 text-xs text-indigo-200/80 hidden sm:flex items-center justify-between">
          <span>Hệ thống quản lý định danh SSO sinh viên</span>
          <span>Phiên bản 2.0</span>
        </div>
      </div>

      {/* 2. FORM CARD BÊN PHẢI (Desktop: card 430px / Mobile: card đè lên brand 72px) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12 -mt-16 sm:-mt-20 lg:mt-0 relative z-20">
        <div className="w-full max-w-[430px] bg-white rounded-[24px] sm:rounded-[28px] shadow-[0_20px_60px_rgba(23,32,51,0.08)] border border-[#D9E2EE] p-6 sm:p-10 transition-all">
          
          {/* Card Header (Heading 32/40/600 theo Figma) */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-[28px] sm:text-headline-lg text-[#172033] font-semibold tracking-tight">
              Đăng nhập
            </h2>
            <p className="text-body-md text-[#5B6B82] mt-1">
              Sử dụng tài khoản sinh viên hoặc cán bộ thư viện
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Input Tên đăng nhập (backend xác thực bằng username) */}
            <Input
              label="Tên đăng nhập"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập"
              leftIcon={<User className="w-4 h-4" />}
              autoComplete="username"
            />

            {/* Input Mật khẩu */}
            <Input
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="p-1 text-slate-400 hover:text-indigo-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              autoComplete="current-password"
            />

            {/* Thông báo lỗi nếu có */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {errorMsg}
              </div>
            )}

            {/* Nút Đăng nhập */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                loading={isLoading}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Đăng nhập hệ thống
              </Button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
