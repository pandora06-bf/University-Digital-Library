import { Construction, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../../components/Button';

const PAGE_META = {
  '/admin/users': {
    title: 'Quản lý Người dùng',
    task: '2B-18',
    desc: 'Danh sách, tạo/sửa, khóa/mở khóa, đặt lại mật khẩu, nhập CSV. Sẽ nối API admin users khi BE sẵn sàng.',
  },
  '/admin/rooms': {
    title: 'Quản lý Phòng & Check-in',
    task: '3-17',
    desc: 'Danh mục phòng học nhóm, danh sách đặt trong ngày và check-in mã đặt phòng tại quầy.',
  },
  '/admin/unmatched': {
    title: 'Giao dịch chưa khớp',
    task: '4-16',
    desc: 'Tra cứu giao dịch nạp tiền ngân hàng chưa gán user và gán thủ công (UC16).',
  },
};

export default function AdminComingSoon() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname] || {
    title: 'Đang phát triển',
    task: '—',
    desc: 'Mục này đã có trong khung Admin; chức năng đầy đủ sẽ bổ sung ở sprint tiếp theo.',
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 sm:p-10 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-5">
          <Construction className="w-7 h-7 text-amber-600" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">
          Đang phát triển · Task {meta.task}
        </p>
        <h1 className="text-2xl font-bold text-slate-800 mb-3">{meta.title}</h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-8">{meta.desc}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Về Tổng quan
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/admin/loans')}>
            Sang Quầy mượn / trả
          </Button>
        </div>
      </div>
    </div>
  );
}
