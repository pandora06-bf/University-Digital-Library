import { Link } from 'react-router-dom';
import { BookX, ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#F6F8FC] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-6">
        <BookX className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">404 — Trang không tồn tại</h1>
      <p className="text-slate-500 text-sm max-w-md mb-8">
        Địa chỉ bạn đang truy cập không tồn tại hoặc đã được thay đổi trong hệ thống thư viện.
      </p>
      <Link to="/">
        <Button variant="primary" icon={<ArrowLeft className="w-4 h-4" />}>
          Quay về Trang chủ
        </Button>
      </Link>
    </div>
  );
}
