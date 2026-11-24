import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Library, 
  Archive, 
  ArrowLeftRight, 
  FileWarning, 
  Files, 
  Search, 
  LogOut,
  BookOpen,
  ChevronRight,
  X,
  Menu,
  AlertOctagon,
  Users,
  DoorOpen,
  WalletCards,
} from 'lucide-react';

// Quick search data để navigate (2B-17: đủ mục Admin)
// Icon outline stroke giống Users (multi-shape Lucide)
const SEARCH_SUGGESTIONS = [
  { label: 'Quản lý Danh mục Sách', desc: 'Quản lý đầu sách và thể loại', path: '/admin/catalog', icon: <Library className="w-4 h-4" strokeWidth={2} /> },
  { label: 'Quản lý eBook / PDF', desc: 'Tài liệu số, PDF và xem trước', path: '/admin/ebooks', icon: <Files className="w-4 h-4" strokeWidth={2} /> },
  { label: 'Quản lý Tồn kho', desc: 'Bản sao vật lý, vị trí kệ', path: '/admin/inventory', icon: <Archive className="w-4 h-4" strokeWidth={2} /> },
  { label: 'Quản lý Mượn / Trả', desc: 'Quầy giao dịch thủ thư', path: '/admin/loans', icon: <ArrowLeftRight className="w-4 h-4" strokeWidth={2} /> },
  { label: 'Thu phạt & Công nợ', desc: 'Phiếu phạt, dư nợ độc giả', path: '/admin/fines', icon: <FileWarning className="w-4 h-4" strokeWidth={2} /> },
  { label: 'Báo mất / Hỏng sách', desc: 'Biên bản sự cố và bồi thường', path: '/admin/incidents', icon: <AlertOctagon className="w-4 h-4" strokeWidth={2} /> },
  { label: 'Quản lý Người dùng', desc: 'Tạo/sửa, khóa, đặt lại mật khẩu', path: '/admin/users', icon: <Users className="w-4 h-4" strokeWidth={2} /> },
  { label: 'Phòng học nhóm', desc: 'Danh mục phòng & check-in mã đặt', path: '/admin/rooms', icon: <DoorOpen className="w-4 h-4" strokeWidth={2} /> },
  { label: 'Check-in phòng', desc: 'Quầy nhập mã đặt trong ngày', path: '/admin/rooms/checkin', icon: <DoorOpen className="w-4 h-4" strokeWidth={2} /> },
  { label: 'Giao dịch chưa khớp', desc: 'Gán nạp tiền chưa khớp cho người dùng', path: '/admin/unmatched', icon: <WalletCards className="w-4 h-4" strokeWidth={2} /> },
];

import { logout, getMe } from '../services/authService';
import { getCurrentUser, setCurrentUser } from '../mocks/auth';

function roleLabel(user) {
  const role = String(user?.apiRole || user?.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'LIBRARIAN' || user?.role === 'admin') {
    return 'Thủ thư';
  }
  if (role === 'LECTURER') return 'Giảng viên';
  if (role === 'STUDENT') return 'Sinh viên';
  return 'Tài khoản';
}

function displayName(user) {
  return user?.full_name || user?.name || user?.username || 'Admin';
}

function avatarInitials(user) {
  const name = displayName(user).trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'AD';
}

function avatarUrl(user) {
  if (user?.avatar) return user.avatar;
  const name = encodeURIComponent(displayName(user));
  return `https://ui-avatars.com/api/?name=${name}&background=4F46E5&color=fff`;
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authUser, setAuthUser] = useState(() => getCurrentUser());

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled || !me) return;
        const merged = {
          ...(getCurrentUser() || {}),
          id: me.id,
          username: me.username,
          name: me.username,
          apiRole: me.role,
          role: String(me.role || '').toUpperCase() === 'ADMIN' ? 'admin' : 'user',
        };
        setCurrentUser(merged);
        setAuthUser(merged);
      })
      .catch(() => {
        if (!cancelled) setAuthUser(getCurrentUser());
      });
    return () => { cancelled = true; };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const searchRef = useRef(null);

  // Default sidebar state based on window width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredSuggestions = searchQuery.trim()
    ? SEARCH_SUGGESTIONS.filter(s =>
        s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.desc.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : SEARCH_SUGGESTIONS;

  const handleSearchSelect = (path) => {
    setSearchQuery('');
    setShowSearchDropdown(false);
    navigate(path);
  };

  const ADMIN_HOME = '/admin/catalog';

  const getBreadcrumbs = () => {
    const pathname = location.pathname;
    const root = { label: 'Thủ thư', path: ADMIN_HOME };

    // Dynamic routes: /admin/inventory/:bookId
    if (pathname.startsWith('/admin/inventory/')) {
      const bookId = pathname.replace('/admin/inventory/', '').split('/')[0];
      return [
        root,
        { label: 'Quản lý Tồn kho', path: '/admin/inventory' },
        { label: bookId ? `Tồn kho đầu sách #${bookId}` : 'Chi tiết bản sao' }
      ];
    }

    // Dynamic routes: /admin/books/:bookId (điều hướng từ Danh mục Sách)
    if (pathname.startsWith('/admin/books/')) {
      const bookId = pathname.replace('/admin/books/', '').split('/')[0];
      return [
        root,
        { label: 'Danh mục Sách', path: '/admin/catalog' },
        { label: bookId ? `Tồn kho đầu sách #${bookId}` : 'Chi tiết bản sao' }
      ];
    }

    // Static Admin Routes
    const STATIC_CRUMBS = {
      '/admin/catalog': [
        root,
        { label: 'Danh mục Sách' }
      ],
      '/admin/ebooks': [
        root,
        { label: 'Quản lý eBook / PDF' }
      ],
      '/admin/inventory': [
        root,
        { label: 'Quản lý Tồn kho' }
      ],
      '/admin/books': [
        root,
        { label: 'Quản lý Tồn kho' }
      ],
      '/admin/loans': [
        root,
        { label: 'Quản lý Mượn / Trả' }
      ],
      '/admin/fines': [
        root,
        { label: 'Thu phạt & Công nợ' }
      ],
      '/admin/incidents': [
        root,
        { label: 'Báo mất / Hỏng sách' }
      ],
      '/admin/users': [
        root,
        { label: 'Quản lý Người dùng' }
      ],
      '/admin/rooms': [
        root,
        { label: 'Phòng học nhóm' }
      ],
      '/admin/rooms/checkin': [
        root,
        { label: 'Phòng học nhóm', path: '/admin/rooms' },
        { label: 'Check-in mã đặt' }
      ],
      '/admin/unmatched': [
        root,
        { label: 'Giao dịch chưa khớp' }
      ],
    };

    if (STATIC_CRUMBS[pathname]) {
      return STATIC_CRUMBS[pathname];
    }

    // Fallback an toàn cho route con phát sinh
    return [root, { label: 'Trang quản trị' }];
  };

  const breadcrumbs = getBreadcrumbs();

  const isItemActive = (itemPath, isExactActive) => {
    if (isExactActive) return true;
    if (itemPath === '/admin/inventory') {
      return (
        location.pathname === '/admin/inventory' ||
        location.pathname.startsWith('/admin/inventory/') ||
        location.pathname === '/admin/books' ||
        location.pathname.startsWith('/admin/books/')
      );
    }
    return location.pathname === itemPath || location.pathname.startsWith(itemPath + '/');
  };

  // 2B-17: khung menu đủ các mục chức năng Admin
  const navItems = [
    { path: '/admin/catalog', icon: <Library size={20} strokeWidth={2} />, label: 'Quản lý Danh mục Sách' },
    { path: '/admin/ebooks', icon: <Files size={20} strokeWidth={2} />, label: 'Quản lý eBook / PDF' },
    { path: '/admin/inventory', icon: <Archive size={20} strokeWidth={2} />, label: 'Quản lý Tồn kho' },
    { path: '/admin/loans', icon: <ArrowLeftRight size={20} strokeWidth={2} />, label: 'Quản lý Mượn / Trả' },
    { path: '/admin/fines', icon: <FileWarning size={20} strokeWidth={2} />, label: 'Thu phạt & Công nợ' },
    { path: '/admin/incidents', icon: <AlertOctagon size={20} strokeWidth={2} />, label: 'Báo mất / Hỏng sách' },
    { path: '/admin/users', icon: <Users size={20} strokeWidth={2} />, label: 'Người dùng' },
    { path: '/admin/rooms', icon: <DoorOpen size={20} strokeWidth={2} />, label: 'Phòng học nhóm' },
    { path: '/admin/unmatched', icon: <WalletCards size={20} strokeWidth={2} />, label: 'Giao dịch chưa khớp' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 h-full w-64 bg-gradient-to-b from-[#312E81] via-[#4F46E5] to-[#0E7490] text-white flex flex-col shrink-0 transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'translate-x-0 lg:w-64' : '-translate-x-full lg:translate-x-0 lg:w-0'}`}>
        {/* Logo */}
        <NavLink
          to="/admin/catalog"
          aria-label="Về Cổng Quản trị LibManager"
          title="Về Cổng Quản trị"
          onClick={() => {
            if (window.innerWidth < 1024) {
              setIsSidebarOpen(false);
            }
          }}
          className="h-20 bg-white flex items-center gap-3 px-6 border-b border-[#D9E2EE] cursor-pointer hover:bg-slate-50/80 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset group"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#312E81] via-[#4F46E5] to-[#0E7490] flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[22px] font-bold bg-gradient-to-r from-[#312E81] to-[#4F46E5] bg-clip-text text-transparent leading-none mb-1 group-hover:opacity-90">
              LibManager
            </span>
            <span className="text-[10px] font-medium text-[#5B6B82] leading-tight">
              Cổng Quản trị Thư viện Số TDTU
            </span>
          </div>
        </NavLink>

        {/* Navigation */}
        <nav className="flex-1 py-5 flex flex-col gap-2.5 px-3 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin/catalog'}
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setIsSidebarOpen(false);
                }
              }}
              className={({ isActive }) => {
                const active = isItemActive(item.path, isActive);
                return `flex items-center gap-3 px-3.5 py-3 rounded-xl text-lg font-semibold transition-colors relative ${
                  active 
                    ? 'bg-white/20 text-white shadow-sm' 
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`;
              }}
            >
              {({ isActive }) => {
                const active = isItemActive(item.path, isActive);
                return (
                  <>
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                    )}
                    {item.icon}
                    <span className="flex-1 leading-tight">{item.label}</span>
                    {item.comingSoon && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-amber-400/90 text-amber-950 shrink-0">
                        Đang PT
                      </span>
                    )}
                  </>
                );
              }}
            </NavLink>
          ))}
        </nav>

        {/* User Info & Logout (Bottom) */}
        <div className="p-4 border-t border-white/10">
          <div 
            onClick={handleLogout}
            className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-sm shrink-0 text-indigo-600">
              {avatarInitials(authUser)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{displayName(authUser)}</p>
              <p className="text-xs text-rose-400 font-medium truncate group-hover:text-rose-300 transition-colors">Đăng xuất</p>
            </div>
            <LogOut className="w-5 h-5 text-rose-400 group-hover:text-rose-300 transition-colors" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        {/* Header */}
        <header className="h-20 bg-white border-b border-[#D9E2EE] flex items-center justify-between px-4 sm:px-6 shadow-sm shrink-0 z-20">
          
          {/* Left: Search Bar & Toggle */}
          <div className="flex items-center gap-3 sm:gap-4 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="inline-flex items-center justify-center w-10 h-10 shrink-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100"
              title="Đóng/Mở Sidebar"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative w-full max-w-[200px] sm:max-w-xs lg:max-w-md hidden md:block" ref={searchRef}>
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearchDropdown(true)}
                placeholder="Tìm kiếm chức năng..."
                className="w-full h-10 pl-9 pr-8 bg-slate-100/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all border border-transparent focus:border-indigo-500/30"
              />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Search Dropdown */}
            {showSearchDropdown && (
              <div className="absolute top-full mt-2 left-0 w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {searchQuery ? `Kết quả cho "${searchQuery}"` : 'Điều hướng nhanh'}
                  </p>
                </div>
                {filteredSuggestions.length > 0 ? (
                  <div className="py-1">
                    {filteredSuggestions.map((s) => (
                      <button
                        key={s.path}
                        onClick={() => handleSearchSelect(s.path)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 transition-colors text-left group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 transition-colors">
                          {s.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-tight">{s.label}</p>
                          <p className="text-xs text-slate-500 leading-tight mt-0.5">{s.desc}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-slate-400">
                    Không tìm thấy kết quả nào
                  </div>
                )}
              </div>
            )}
          </div>

            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm font-medium sm:ml-4 sm:border-l sm:border-slate-200 sm:pl-4">
              {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1;
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-slate-400 select-none">/</span>}
                    {crumb.path && !isLast ? (
                      <Link
                        to={crumb.path}
                        className="text-slate-500 hover:text-indigo-600 transition-colors font-medium hover:underline focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 -mx-1"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span 
                        className={`font-bold ${isLast ? 'text-slate-800' : 'text-slate-400'}`}
                        aria-current={isLast ? 'page' : undefined}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>


          {/* Right: Notification + User */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0 ml-auto">


            {/* User Avatar */}
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-slate-50 p-1 sm:p-1.5 sm:pr-3 rounded-full transition-colors">
              <img 
                src={avatarUrl(authUser)} 
                alt={displayName(authUser)} 
                className="w-8 h-8 rounded-full ring-2 ring-indigo-50"
              />
              <div className="hidden sm:block text-right">
                <p className="text-sm font-bold text-slate-800 leading-tight">{displayName(authUser)}</p>
                <p className="text-[11px] text-slate-500 font-medium">{roleLabel(authUser)}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50/50 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
