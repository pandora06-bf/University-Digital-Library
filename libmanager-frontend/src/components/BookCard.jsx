import { BookOpen, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './Button';

/**
 * Component BookCard hiển thị thẻ sách theo chuẩn Figma node 44:24
 * 
 * Quy chuẩn:
 * - Kích thước: padding 16px, rounded-[20px], bóng shadow-sm
 * - Tiêu đề sách: text-title-lg (24px/32px/600)
 * - Tách biệt vùng link chi tiết và nút mượn sách để đảm bảo ngữ nghĩa HTML và accessibility (tránh bọc button trong link)
 */
export const BookCard = ({
  book,
  onBorrow,
  isBorrowing = false,
  className = '',
}) => {
  const isAvailable = book.availableCopies > 0;

  return (
    <div
      className={`bg-white rounded-[20px] border border-[#D9E2EE] p-4 shadow-sm flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${className}`}
    >
      <div>
        {/* Bìa sách tượng trưng (Cover container) */}
        <Link
          to={`/books/${book.id}`}
          className="block w-full h-48 rounded-xl bg-gradient-to-br from-indigo-500/10 to-indigo-600/20 mb-3.5 relative overflow-hidden group/cover focus:outline-none focus:ring-2 focus:ring-indigo-500"
          title={`Xem chi tiết ${book.title}`}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600 mb-2 group-hover/cover:scale-110 transition-transform">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              {book.barcode}
            </span>
          </div>
        </Link>

        {/* Thể loại & Tình trạng */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 bg-[#EEF2FF] text-[#3730A3] rounded-md">
            {book.category}
          </span>
          <span className="text-xs flex items-center gap-1 font-medium">
            {isAvailable ? (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{book.availableCopies} cuốn</span>
              </span>
            ) : (
              <span className="text-rose-500 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>Hết sách</span>
              </span>
            )}
          </span>
        </div>

        {/* Tiêu đề sách chuẩn 24/32/600 (Figma) */}
        <Link
          to={`/books/${book.id}`}
          className="block group/title focus:outline-none"
        >
          <h3 className="text-title-lg text-[#172033] line-clamp-2 group-hover/title:text-indigo-600 transition-colors">
            {book.title}
          </h3>
        </Link>

        {/* Tác giả & Năm XB */}
        <p className="text-body-md text-[#5B6B82] mt-1 line-clamp-1">
          {book.author} • {book.publishYear}
        </p>
      </div>

      {/* CTA Buttons */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
        <Link
          to={`/books/${book.id}`}
          className="flex-1"
        >
          <Button
            variant="outline"
            size="sm"
            fullWidth
          >
            Chi tiết
          </Button>
        </Link>

        <div className="flex-1">
          <Button
            variant="primary"
            size="sm"
            fullWidth
            disabled={!isAvailable}
            loading={isBorrowing}
            onClick={() => onBorrow && onBorrow(book)}
          >
            {isAvailable ? 'Mượn sách' : 'Hết bản sao'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BookCard;
