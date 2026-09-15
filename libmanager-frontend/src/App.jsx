import React, { useState } from 'react';
import Login from './pages/auth/Login';
import { Search, BookOpen, Filter, BookMarked, LogOut, Mail, Lock } from 'lucide-react';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { Table } from './components/Table';

export default function App() {
  const [user, setUser] = useState(null);

  const books = [
    { id: 1, title: 'Cấu trúc dữ liệu & Giải thuật', author: 'Nguyễn Văn A', category: 'IT' },
    { id: 2, title: 'Thiết kế hệ thống Microservices', author: 'Trần Văn B', category: 'IT' },
    { id: 3, title: 'Kinh tế vĩ mô', author: 'Lê Văn C', category: 'Kinh tế' },
    { id: 4, title: 'Mạng máy tính nâng cao', author: 'Phạm Văn D', category: 'IT' },
  ];

  // 1. Chưa đăng nhập -> Hiện trang Login
  if (!user) {
    return <Login onLogin={(userData) => setUser(userData)} />;
  }

  // 2. Đã đăng nhập -> Hiện Giao diện User Portal
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-indigo-600" />
            <span className="text-xl font-bold text-indigo-600">LibManager</span>
          </div>

          <div className="relative w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm tên sách, tác giả..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-6 text-sm font-medium">
            <a href="#" className="text-indigo-600">Trang chủ</a>
            <a href="#" className="text-slate-600 hover:text-indigo-600 transition-colors">Danh mục</a>
            <a href="#" className="text-slate-600 hover:text-indigo-600 transition-colors">Sách của tôi</a>

            {/* Nút Đăng xuất */}
            <button
              onClick={() => setUser(null)}
              title="Đăng xuất"
              className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Thoát ({user.role === 'admin' ? 'Admin' : 'User'})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar Filter */}
        <aside className="w-64 shrink-0 bg-white p-5 rounded-xl border border-slate-200/80 h-fit">
          <div className="flex items-center gap-2 font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span>Bộ lọc tìm kiếm</span>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Thể loại</h4>
              <div className="space-y-2 text-sm text-slate-600">
                <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                  <input type="checkbox" defaultChecked className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>Công nghệ thông tin</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                  <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>Kinh tế & Quản lý</span>
                </label>
              </div>
            </div>
          </div>
        </aside>

        {/* Book Cards Grid */}
        <main className="flex-1">
          {/* Test Component Button */}
          <div className="mb-8 p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold mb-4 text-slate-800">Kiểm tra Button Component</h2>
            <div className="flex flex-wrap gap-4 items-center">
              <Button variant="primary">Nút Primary</Button>
              <Button variant="outline">Nút Outline</Button>
              <Button variant="ghost">Nút Ghost</Button>
              <Button variant="danger">Nút Danger</Button>
              <div className="w-px h-8 bg-slate-200 mx-2"></div>
              <Button size="sm" variant="primary">Size SM</Button>
              <Button size="lg" variant="outline">Size LG</Button>
            </div>
          </div>

          {/* Test Component Input */}
          <div className="mb-8 p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold mb-4 text-slate-800">Kiểm tra Input Component</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input 
                label="Tiêu đề sách" 
                placeholder="Nhập tiêu đề sách..." 
                required 
              />
              <Input 
                label="Email" 
                type="email" 
                placeholder="Nhập email..." 
                leftIcon={<Mail className="w-4 h-4" />}
                helperText="Email dùng để nhận thông báo mượn sách"
              />
              <Input 
                label="Trạng thái lỗi" 
                placeholder="Dữ liệu không hợp lệ..." 
                error="Vui lòng nhập thông tin hợp lệ" 
                leftIcon={<Lock className="w-4 h-4" />}
              />
              <Input 
                label="Bị vô hiệu hóa" 
                placeholder="Không thể chỉnh sửa" 
                disabled 
              />
            </div>
          </div>

          {/* Test Component Table */}
          <div className="mb-8">
            <Table title="Kiểm tra Table Component" subtitle="Hiển thị Mock Data có sẵn từ Table.jsx" />
          </div>

          <h2 className="text-xl font-bold mb-6 text-slate-800">Danh mục sách nổi bật</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {books.map((book) => (
              <div key={book.id} className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                <div>
                  <div className="h-44 bg-slate-100 rounded-lg mb-3 flex items-center justify-center group-hover:bg-indigo-50/50 transition-colors">
                    <BookMarked className="w-10 h-10 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md">
                    {book.category}
                  </span>
                  <h3 className="font-bold text-slate-800 mt-2 line-clamp-1">{book.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{book.author}</p>
                </div>

                <button className="mt-4 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm">
                  Mượn sách ngay
                </button>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}