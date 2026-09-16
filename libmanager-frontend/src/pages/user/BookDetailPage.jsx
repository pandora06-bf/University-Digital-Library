import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Bookmark, CheckCircle, XCircle, MapPin, Building, Calendar, Hash, FileText } from 'lucide-react';
import { Button } from '../../components/Button';
import { getStoredBooks, borrowBookAction } from '../../mocks/loans';

/**
 * Trang Chi tiết Sách (Book Detail Page)
 * Tham chiếu Figma Node 46:5
 */
export default function BookDetailPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const books = getStoredBooks();
  const book = books.find((b) => b.id === bookId);

  const [isBorrowing, setIsBorrowing] = useState(false);
  const [toast, setToast] = useState(null);

  if (!book) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800">Không tìm thấy tài liệu</h2>
        <p className="text-slate-500 text-sm">Tài liệu bạn tìm kiếm không tồn tại hoặc đã bị gỡ bỏ.</p>
        <Link to="/catalog">
          <Button variant="primary">Quay lại danh mục</Button>
        </Link>
      </div>
    );
  }

  const isAvailable = book.availableCopies > 0;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleBorrow = () => {
    setIsBorrowing(true);
    setTimeout(() => {
      const res = borrowBookAction(book.id);
      setIsBorrowing(false);
      if (res.success) {
        showToast(`Đã mượn thành công cuốn "${book.title}"!`, 'success');
        setTimeout(() => navigate('/my-books'), 1200);
      } else {
        showToast(res.message, 'error');
      }
    }, 400);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2 border ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-rose-600 text-white border-rose-500'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Back Button */}
      <Link
        to="/catalog"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay lại Danh mục</span>
      </Link>

      {/* Main Detail Card */}
      <div className="bg-white rounded-3xl border border-[#D9E2EE] p-6 sm:p-10 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
        
        {/* Cột trái: Bìa sách lớn */}
        <div className="md:col-span-1 flex flex-col items-center">
          <div className="w-full max-w-[280px] h-80 sm:h-96 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-900 text-white p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_70%)] pointer-events-none" />
            
            <div className="flex items-center justify-between text-xs font-mono uppercase text-indigo-200">
              <span>{book.barcode}</span>
              <BookOpen className="w-5 h-5" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-white/20 text-white inline-block">
                {book.category}
              </span>
              <h2 className="text-xl font-bold leading-snug line-clamp-3 text-white">
                {book.title}
              </h2>
              <p className="text-xs text-indigo-200 line-clamp-1">{book.author}</p>
            </div>

            <div className="text-[11px] text-indigo-300 font-mono">
              ISBN: {book.isbn}
            </div>
          </div>

          {/* Trạng thái bản sao */}
          <div className="mt-6 text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold">
              {isAvailable ? (
                <span className="text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>Còn {book.availableCopies} / {book.totalCopies} bản sao</span>
                </span>
              ) : (
                <span className="text-rose-600 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  <span>Tạm thời hết bản sao trên kệ</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Vị trí: <strong>{book.location}</strong>
            </p>
          </div>
        </div>

        {/* Cột phải: Thông tin chi tiết & CTA */}
        <div className="md:col-span-2 space-y-6">
          
          <div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg">
              {book.category}
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-3">
              {book.title}
            </h1>
            <p className="text-base text-slate-600 mt-1 font-medium">
              Tác giả: <span className="text-indigo-600">{book.author}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button
              variant="primary"
              size="lg"
              loading={isBorrowing}
              disabled={!isAvailable}
              onClick={handleBorrow}
              icon={<Bookmark className="w-5 h-5" />}
              className="px-8"
            >
              {isAvailable ? 'Mượn tài liệu này' : 'Hết bản sao'}
            </Button>

            {book.pdfAvailable && (
              <Link to="/reader/sample">
                <Button
                  variant="outline"
                  size="lg"
                  icon={<FileText className="w-5 h-5" />}
                >
                  Đọc bản số hóa
                </Button>
              </Link>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-sm">
            <div className="flex items-start gap-3">
              <Building className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <span className="text-xs text-slate-400 block font-medium">Nhà xuất bản</span>
                <span className="font-semibold text-slate-800">{book.publisher}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <span className="text-xs text-slate-400 block font-medium">Năm xuất bản</span>
                <span className="font-semibold text-slate-800">{book.publishYear}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Hash className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <span className="text-xs text-slate-400 block font-medium">Mã chuẩn ISBN</span>
                <span className="font-semibold text-slate-800 font-mono text-xs">{book.isbn}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <span className="text-xs text-slate-400 block font-medium">Vị trí kệ sách</span>
                <span className="font-semibold text-slate-800">{book.location}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Tóm tắt nội dung
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {book.description}
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
