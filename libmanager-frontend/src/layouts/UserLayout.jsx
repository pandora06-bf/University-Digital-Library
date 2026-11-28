import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Search, Home, Layers, BookmarkCheck, LogOut, Menu, X, CalendarDays, UserRound } from 'lucide-react';
import { getCurrentUser } from '../mocks/auth';
import BrandMark from '../components/BrandMark';
import HeaderAccount from '../components/user/HeaderAccount';
import ChatWidget from '../components/chat/ChatWidget';
import { SHOW_UI_KIT } from '../utils/featureFlags';
import { logout } from '../services/authService';
import { loginPathFor } from '../utils/loginRedirect';
import { Button } from '../components/Button';
import { PageTransition } from '../components/motion/PageTransition';
import '../styles/user-mobile.css'; // bản vá CSS điện thoại (4-14.a)

export default function UserLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleLogout = () => {
    logout(); // xóa cả token lẫn user (2B-13)
    navigate('/login');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/catalog?q=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate('/catalog');
    }
  };

  const navLinks = [
    { to: '/', label: 'Trang chủ', icon: Home },
    { to: '/catalog', label: 'Danh mục', icon: Layers },
    { to: '/my-books', label: 'Sách của tôi', icon: BookmarkCheck },
    { to: '/rooms', label: 'Đặt phòng', icon: CalendarDays },
    { to: '/account', label: 'Tài khoản', icon: UserRound }, // 4-13
  ];

  // Kiểm tra trang có cần bottom navigation trên mobile không
  const showMobileBottomNav = ['/catalog', '/my-books', '/rooms', '/wallet/top-up', '/account'].includes(location.pathname);

  return (
    <div className="user-portal min-h-screen flex flex-col bg-[#F6F8FC] text-[#172033]">
      {/* Top Header */}
      <header className="bg-white border-b border-[#D9E2EE] sticky top-0 z-30 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 h-20 sm:h-24 lg:h-32 flex items-center justify-between gap-4">
          
          {/* Logo & Brand Name */}
          <NavLink 
            to="/" 
            aria-label="Về trang chủ thư viện LibManager"
            title="Về trang chủ Thư viện"
            className="flex items-center gap-3 shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl p-1 cursor-pointer hover:opacity-95 transition-opacity group"
          >
            {/* Logo phương án B "Dấu trang chữ L" (Figma: LibManager – Logo mới) */}
            <BrandMark className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-[30%] shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform" />
            <div>
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-[#172033]">
                Lib<span className="text-[#4F46E5]">Manager</span>
              </span>
              <p className="text-[11px] font-medium text-[#5B6B82] hidden sm:block">
                Cổng Thư viện Số TDTU
              </p>
            </div>
          </NavLink>

          {/* Search Header Bar (Desktop & Tablet) */}
          <form onSubmit={handleSearchSubmit} className="hidden 2xl:flex flex-1 max-w-xs mx-4">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm tên sách, tác giả, chuyên ngành..."
                className="w-full h-11 pl-10 pr-4 bg-[#F6F8FC] border border-[#D9E2EE] rounded-xl text-body-md text-[#172033] placeholder:text-slate-400 focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 transition-all"
              />
            </div>
          </form>

          {/* Navigation Links Desktop (18/24/600 theo Figma) */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-6">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-sm xl:text-base whitespace-nowrap leading-6 font-semibold transition-colors relative py-1 ${
                    isActive
                      ? 'text-[#4F46E5] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#4F46E5]'
                      : 'text-[#5B6B82] hover:text-[#172033]'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            {/* Link trang Dev UI-Kit — ẩn mặc định, bật bằng VITE_SHOW_UI_KIT=true */}
            {SHOW_UI_KIT && (
              <NavLink
                to="/dev/ui-kit"
                className="hidden xl:inline-flex items-center px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors"
              >
                UI-Kit Lab
              </NavLink>
            )}

            {user ? (
              <div className="flex items-center gap-3 pl-2 sm:border-l border-slate-200">
                <HeaderAccount user={user} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  icon={<LogOut className="w-4 h-4 text-rose-600" />}
                  className="text-rose-600 hover:bg-rose-50"
                  title="Đăng xuất"
                >
                  <span className="hidden sm:inline">Đăng xuất</span>
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(loginPathFor(location))}
              >
                Đăng nhập
              </Button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl focus:outline-none"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search & Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm kiếm tài liệu..."
                  className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
            </form>
            <div className="space-y-1 pt-2">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-base font-semibold ${
                        isActive ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span>{link.label}</span>
                  </NavLink>
                );
              })}
              {SHOW_UI_KIT && (
                <NavLink
                  to="/dev/ui-kit"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-base font-semibold text-amber-700 hover:bg-amber-50"
                >
                  <span>Môi trường Dev UI-Kit</span>
                </NavLink>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Page Content với PageTransition */}
      <main className={`flex-1 ${showMobileBottomNav ? 'pb-24 lg:pb-8' : ''}`}>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>

      {/* Mobile Bottom Navigation (Cao 84px chuẩn Figma cho Catalog & My Books) */}
      {showMobileBottomNav && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-[84px] bg-white border-t border-slate-200 z-40 px-2 flex items-center justify-around pb-4 shadow-lg">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex-1 min-w-0 flex flex-col items-center gap-1 py-1 px-1 rounded-lg transition-colors ${
                    isActive ? 'text-indigo-600 font-bold' : 'text-slate-500 font-medium'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] whitespace-nowrap">{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}

      {/* Trợ lý ảo: key theo người dùng để đổi tài khoản là xóa hội thoại */}
      <ChatWidget key={user?.id ?? 'guest'} raised={showMobileBottomNav} />

      {/* Footer */}
      <footer className="bg-white border-t border-[#D9E2EE] py-6 px-4 sm:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5B6B82]">
          <p>© 2026 LibManager — Hệ thống Thư viện Số Đại học Tôn Đức Thắng (TDTU).</p>
          <div className="flex items-center gap-4 font-medium">
            <span>Phiên bản 2.0.0</span>
            <span>•</span>
            <span>Cổng Độc giả: Đạt</span>
            <span>•</span>
            <span>Cổng Quản trị: Vân</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
