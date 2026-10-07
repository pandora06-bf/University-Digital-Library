import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Book, 
  Archive, 
  ArrowLeftRight, 
  FileWarning, 
  FileText, 
  Search, 
  LogOut,
  BookOpen,
  ChevronRight,
  X,
  Menu
} from 'lucide-react';

// Quick search data để navigate
const SEARCH_SUGGESTIONS = [
  { label: 'Tổng quan', desc: 'Dashboard báo cáo nhanh', path: '/admin', icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'Quản lý Danh mục Sách', desc: 'Quản lý đầu sách và thể loại', path: '/admin/catalog', icon: <Book className="w-4 h-4" /> },
  { label: 'Quản lý Tồn kho', desc: 'Bản sao vật lý, vị trí kệ', path: '/admin/books', icon: <Archive className="w-4 h-4" /> },
  { label: 'Mượn / Trả sách', desc: 'Quầy giao dịch thủ thư', path: '/admin/loans', icon: <ArrowLeftRight className="w-4 h-4" /> },
  { label: 'Thu phạt & Công nợ', desc: 'Phiếu phạt, dư nợ độc giả', path: '/admin/fines', icon: <FileWarning className="w-4 h-4" /> },
];


import { logout } from '../services/authService';

// Breadcrumb map theo route
const BREADCRUMB_MAP = {
  '/admin': [{ label: 'Tổng quan' }],
  '/admin/catalog': [{ label: 'Quản lý Danh mục Sách' }],
  '/admin/ebooks': [{ label: 'Quản lý eBook / PDF' }],
  '/admin/books': [{ label: 'Quản lý Tồn kho' }],
  '/admin/loans': [{ label: 'Mượn / Trả sách' }],
  '/admin/fines': [{ label: 'Thu phạt & Công nợ' }],
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

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

  const breadcrumbs = BREADCRUMB_MAP[location.pathname] || [{ label: 'Thư viện' }];

  const navItems = [
    { path: '/admin', icon: <LayoutDashboard size={20} />, label: 'Tổng quan' },
    { path: '/admin/catalog', icon: <Book size={20} />, label: 'Quản lý Danh mục Sách' },
    { path: '/admin/ebooks', icon: <FileText size={20} />, label: 'Quản lý eBook / PDF' },
    { path: '/admin/books', icon: <Archive size={20} />, label: 'Quản lý Tồn kho' },
    { path: '/admin/loans', icon: <ArrowLeftRight size={20} />, label: 'Quản lý Mượn / Trả' },
    { path: '/admin/fines', icon: <FileWarning size={20} />, label: 'Thu phạt & Công nợ' },
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
        <div className="h-20 bg-white flex items-center gap-3 px-6 border-b border-[#D9E2EE]">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#312E81] via-[#4F46E5] to-[#0E7490] flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[22px] font-bold bg-gradient-to-r from-[#312E81] to-[#4F46E5] bg-clip-text text-transparent leading-none mb-1">
              LibManager
            </span>
            <span className="text-[10px] font-medium text-[#5B6B82] leading-tight">
              Cổng Quản trị Thư viện Số TDTU
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setIsSidebarOpen(false);
                }
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-lg font-semibold transition-colors relative ${
                  isActive 
                    ? 'bg-white/20 text-white shadow-sm' 
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                  )}
                  {item.icon}
                  {item.label}
                </>
              )}
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
              TV
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">Thùy Vân</p>
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

            {/* Breadcrumb placed near search bar */}
            <div className="flex items-center gap-2 text-sm font-medium sm:ml-4 sm:border-l sm:border-slate-200 sm:pl-4">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="font-bold text-slate-700">{crumb.label}</span>
              ))}
            </div>
          </div>


          {/* Right: Notification + User */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0 ml-auto">


            {/* User Avatar */}
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-slate-50 p-1 sm:p-1.5 sm:pr-3 rounded-full transition-colors">
              <img 
                src="https://ui-avatars.com/api/?name=Thuy+Van&background=4F46E5&color=fff" 
                alt="Avatar" 
                className="w-8 h-8 rounded-full ring-2 ring-indigo-50"
              />
              <div className="hidden sm:block text-right">
                <p className="text-sm font-bold text-slate-800 leading-tight">Thùy Vân</p>
                <p className="text-[11px] text-slate-500 font-medium">Thủ thư / Admin</p>
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
