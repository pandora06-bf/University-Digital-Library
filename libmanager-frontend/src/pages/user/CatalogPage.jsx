import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, BookOpen, ShieldCheck, Clock } from 'lucide-react';
import { BookCard } from '../../components/BookCard';
import { Input } from '../../components/Input';
import { ScrollReveal } from '../../components/motion/ScrollReveal';
import { getStoredBooks, borrowBookAction } from '../../mocks/loans';

/**
 * Trang Danh mục Sách (Catalog Page)
 * Tham chiếu Figma Node 46:4 (Desktop) & Node 66:4 (Mobile)
 * 
 * Tính năng:
 * - Tìm kiếm theo tên sách, tác giả, barcode
 * - Bộ lọc thể loại: Tất cả, CNTT, Giáo trình ĐH, Khoa học, Kinh tế, Ngoại ngữ
 * - Lọc chỉ sách có sẵn
 * - Grid hiển thị BookCard với trạng thái mượn sách realtime
 */
export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';

  const [books, setBooks] = useState(getStoredBooks);
  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [toast, setToast] = useState(null);
  const [borrowingId, setBorrowingId] = useState(null);

  const categories = [
    'Tất cả',
    'Công nghệ thông tin',
    'Giáo trình ĐH',
    'Khoa học Công nghệ',
    'Kinh tế & Quản lý',
    'Ngoại ngữ',
  ];

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleBorrow = (book) => {
    setBorrowingId(book.id);
    setTimeout(() => {
      const result = borrowBookAction(book.id);
      setBorrowingId(null);
      if (result.success) {
        showToast(`Đã mượn thành công cuốn "${book.title}"! Vui lòng kiểm tra ở mục "Sách của tôi".`, 'success');
        setBooks(getStoredBooks());
      } else {
        showToast(result.message, 'error');
      }
    }, 400);
  };

  // Lọc sách theo tìm kiếm và danh mục
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      const matchSearch =
        b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.barcode.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory =
        selectedCategory === 'Tất cả' || b.category === selectedCategory;

      const matchAvailable = !onlyAvailable || b.availableCopies > 0;

      return matchSearch && matchCategory && matchAvailable;
    });
  }, [books, searchTerm, selectedCategory, onlyAvailable]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 space-y-8">
      
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
            {toast.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Page Title Header */}
      <div className="border-b border-slate-200/80 pb-6">
        <h1 className="text-2xl sm:text-headline-lg text-[#172033] font-semibold tracking-tight">
          Danh mục Thư viện
        </h1>
        <p className="text-body-md text-[#5B6B82] mt-1">
          Tra cứu toàn bộ tài liệu học thuật, giáo trình điện tử và luận văn số hóa
        </p>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          {/* Ô tìm kiếm tái sử dụng Input */}
          <div className="flex-1">
            <Input
              placeholder="Nhập tên sách, tác giả hoặc mã barcode..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSearchParams(e.target.value ? { q: e.target.value } : {});
              }}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Toggle chỉ hiện sách có sẵn */}
          <label className="flex items-center gap-2.5 px-4 py-3 bg-white border border-[#D9E2EE] rounded-xl cursor-pointer select-none text-sm font-medium text-slate-700 hover:border-indigo-400 transition-colors shrink-0">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Chỉ hiện sách có sẵn</span>
          </label>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mr-2 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Thể loại:</span>
          </div>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all select-none ${
                  isSelected
                    ? 'bg-[#4F46E5] text-white shadow-sm shadow-indigo-200'
                    : 'bg-white border border-slate-200 text-[#5B6B82] hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Result Stats */}
      <div className="text-xs text-slate-500 font-medium">
        Tìm thấy <strong>{filteredBooks.length}</strong> tài liệu phù hợp
      </div>

      {/* Book Cards Grid */}
      {filteredBooks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBooks.map((book, idx) => (
            <ScrollReveal key={book.id} delay={Math.min(idx * 0.05, 0.4)}>
              <BookCard
                book={book}
                onBorrow={handleBorrow}
                isBorrowing={borrowingId === book.id}
              />
            </ScrollReveal>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="py-16 bg-white rounded-2xl border border-slate-200 text-center p-8 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Không tìm thấy tài liệu phù hợp</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Hãy thử tìm kiếm với từ khóa khác hoặc bỏ các bộ lọc thể loại để xem nhiều kết quả hơn.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('Tất cả');
              setOnlyAvailable(false);
              setSearchParams({});
            }}
            className="text-xs font-semibold text-indigo-600 hover:underline pt-2"
          >
            Đặt lại tất cả bộ lọc
          </button>
        </div>
      )}

    </div>
  );
}
