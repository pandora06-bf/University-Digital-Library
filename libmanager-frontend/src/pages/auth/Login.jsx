import { useState } from 'react';
import { BookOpen, Lock, Mail, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { CursorRipple } from '../../components/motion/CursorRipple';
import { DEMO_USERS, setCurrentUser } from '../../mocks/auth';

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
export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    setIsLoading(true);

    // Mô phỏng độ trễ đăng nhập xác thực
    setTimeout(() => {
      setIsLoading(false);

      // Tìm tài khoản demo hoặc tạo session độc giả
      const normalizedEmail = email.trim().toLowerCase();
      const matchedUser = DEMO_USERS.find((u) => u.email.toLowerCase() === normalizedEmail);

      let loggedInUser;
      if (matchedUser) {
        loggedInUser = matchedUser;
      } else {
        // Tài khoản sinh viên tự do
        const isStaff = normalizedEmail.includes('thuthu') || normalizedEmail.includes('admin');
        loggedInUser = {
          id: `user_${Date.now()}`,
          email: normalizedEmail,
          name: isStaff ? 'Cán bộ Thư viện' : 'Sinh viên TDTU',
          role: isStaff ? 'admin' : 'user',
          studentId: isStaff ? 'TT-MOCK' : '522H0999',
        };
      }

      setCurrentUser(loggedInUser);
      if (onLogin) onLogin(loggedInUser);
      navigate('/');
    }, 500);
  };

  const fillDemoAccount = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('12345678');
    setErrorMsg('');
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

        {/* Brand Header */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15">
            <div className="w-8 h-8 rounded-xl bg-white text-indigo-600 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="font-semibold tracking-wide text-sm sm:text-base">LibManager Portal</span>
          </div>
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
              Sử dụng tài khoản email sinh viên hoặc cán bộ thư viện
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Input Email */}
            <Input
              label="Tên đăng nhập hoặc Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sinhvien@tdtu.edu.vn"
              leftIcon={<Mail className="w-4 h-4" />}
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

          {/* Hỗ trợ Đăng nhập mẫu nhanh (Demo Pills) */}
          <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
            <span className="text-[12px] font-medium text-[#667085] block text-center">
              Chọn nhanh tài khoản kiểm thử:
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => fillDemoAccount('sinhvien@tdtu.edu.vn')}
                className="p-2.5 text-left rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-xs"
              >
                <div className="font-semibold text-slate-800">Độc giả</div>
                <div className="text-[11px] text-slate-500 font-mono truncate">sinhvien@tdtu.edu.vn</div>
              </button>

              <button
                type="button"
                onClick={() => fillDemoAccount('thuthu@tdtu.edu.vn')}
                className="p-2.5 text-left rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-xs"
              >
                <div className="font-semibold text-slate-800">Thủ thư</div>
                <div className="text-[11px] text-slate-500 font-mono truncate">thuthu@tdtu.edu.vn</div>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
