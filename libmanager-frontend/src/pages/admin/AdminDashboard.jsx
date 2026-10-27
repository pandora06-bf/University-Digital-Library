import { BookOpen, Archive, Users, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Button } from '../../components/Button';
// Mock Data for Charts
const activityData = [
  { name: 'T2', mượn: 400, trả: 240 },
  { name: 'T3', mượn: 300, trả: 139 },
  { name: 'T4', mượn: 200, trả: 980 },
  { name: 'T5', mượn: 278, trả: 390 },
  { name: 'T6', mượn: 189, trả: 480 },
  { name: 'T7', mượn: 239, trả: 380 },
  { name: 'CN', mượn: 349, trả: 430 },
];

const categoryData = [
  { name: 'Giáo trình & Bài giảng', value: 45 },
  { name: 'Sách giáo khoa / Tham khảo', value: 20 },
  { name: 'Tạp chí Khoa học', value: 15 },
  { name: 'Sách ngoại văn', value: 20 },
];
const COLORS = ['#4F46E5', '#0EA5E9', '#F59E0B', '#10B981'];

// Mock Data for Table
const recentActivities = [
  { id: '1', maPhieu: 'PM-2026-0001', docGia: 'Nguyễn Văn A (52000001)', tenSach: 'Giáo trình Cấu trúc dữ liệu', ngayMuon: '15/09/2026', trangThai: 'Đang mượn' },
  { id: '2', maPhieu: 'PM-2026-0002', docGia: 'Trần Thị B (52000002)', tenSach: 'Lập trình Hướng đối tượng', ngayMuon: '14/09/2026', trangThai: 'Đã trả' },
  { id: '3', maPhieu: 'PM-2026-0003', docGia: 'Lê Văn C (52000003)', tenSach: 'Thiết kế cơ sở dữ liệu', ngayMuon: '01/09/2026', trangThai: 'Quá hạn' },
  { id: '4', maPhieu: 'PM-2026-0004', docGia: 'Phạm Thị D (52000004)', tenSach: 'Mạng máy tính cơ bản', ngayMuon: '16/09/2026', trangThai: 'Đang mượn' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Tổng quan </h1>
        <p className="text-sm text-slate-500 mt-1">Thống kê tình hình hoạt động của toàn bộ thư viện số.</p>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-slate-500 mb-1">Tổng số sách</p>
              <h3 className="text-3xl font-extrabold text-slate-800">12,450 <span className="text-sm font-semibold text-slate-400">cuốn</span></h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm pt-2 border-t border-slate-50">
            <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">+2.5%</span>
            <span className="text-slate-400 font-medium">so với tháng trước</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-slate-500 mb-1">Sách đang cho mượn</p>
              <h3 className="text-3xl font-extrabold text-slate-800">3,210 <span className="text-sm font-semibold text-slate-400">cuốn</span></h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Archive className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm pt-2 border-t border-slate-50">
            <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">25.6%</span>
            <span className="text-slate-400 font-medium">tỷ lệ lấp đầy kho</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-slate-500 mb-1">Thành viên mới/HĐ</p>
              <h3 className="text-3xl font-extrabold text-slate-800">1,580 <span className="text-sm font-semibold text-slate-400">bạn đọc</span></h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm pt-2 border-t border-slate-50">
            <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">+12%</span>
            <span className="text-slate-400 font-medium">lượt truy cập tuần này</span>
          </div>
        </div>

        {/* Card 4 - Alert State */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-rose-50 rounded-full -z-10 group-hover:scale-125 transition-transform"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-rose-600 mb-1">Sách quá hạn / Chờ xử lý</p>
              <h3 className="text-3xl font-extrabold text-rose-700">48 <span className="text-sm font-semibold text-rose-500">cuốn</span></h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner shadow-rose-200/50">
              <ShieldAlert className="w-6 h-6 text-rose-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm pt-2 border-t border-rose-100/50">
            <span className="text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded-md">5 phiếu</span>
            <span className="text-slate-500 font-medium">cần gửi email nhắc nhở</span>
          </div>
        </div>
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart (Takes 2 columns on Large screens) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800">Hoạt động mượn & trả theo thời gian</h3>
            <p className="text-sm text-slate-500 mt-1">Số lượng sách mượn/trả theo ngày trong tuần (dữ liệu minh họa)</p>
          </div>
          <div className="h-72 w-full text-sm mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontWeight: 500 }} />
                <RechartsTooltip 
                  cursor={{ fill: '#F8FAFC' }} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 500 }} />
                <Bar dataKey="mượn" name="Lượt Mượn" fill="#4F46E5" radius={[6, 6, 0, 0]} maxBarSize={48} />
                <Bar dataKey="trả" name="Lượt Trả" fill="#38BDF8" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart (Takes 1 column) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-2">
            <h3 className="text-lg font-bold text-slate-800">Phân loại tài liệu mượn</h3>
            <p className="text-sm text-slate-500 mt-1">Tỷ lệ theo từng danh mục</p>
          </div>
          <div className="h-56 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={6}
                  dataKey="value"
                  stroke="none"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  itemStyle={{ fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-extrabold text-slate-800">100%</span>
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Tổng cộng</span>
            </div>
          </div>
          
          {/* Custom Legend for Donut Chart */}
          <div className="mt-auto space-y-3.5 pt-4">
            {categoryData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index] }}></div>
                  <span className="text-slate-600 font-semibold">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded text-xs">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activities Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Hoạt động mượn trả gần đây</h3>
            <p className="text-sm text-slate-500 mt-1">Danh sách các giao dịch tài liệu mới cập nhật</p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/admin/loans')}
          >
            Xem tất cả
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
            <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4 rounded-tl-lg">Mã Phiếu</th>
                <th className="px-6 py-4">Độc giả / MSSV</th>
                <th className="px-6 py-4">Tên đầu sách</th>
                <th className="px-6 py-4">Ngày mượn / Hạn trả</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right rounded-tr-lg">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentActivities.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                  <td className="px-6 py-4 font-bold text-slate-800">{row.maPhieu}</td>
                  <td className="px-6 py-4 font-medium">{row.docGia}</td>
                  <td className="px-6 py-4">
                    <span className="truncate max-w-[250px] inline-block font-medium text-slate-700">{row.tenSach}</span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-500">{row.ngayMuon}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                      row.trangThai === 'Đang mượn' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                      row.trangThai === 'Đã trả' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                      {row.trangThai}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
                        onClick={() => row.trangThai === 'Quá hạn' ? navigate('/admin/fines') : navigate('/admin/loans')}
                      >
                        Chi tiết
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Footer Padding */}
      <div className="h-4"></div>
    </div>
  );
}
