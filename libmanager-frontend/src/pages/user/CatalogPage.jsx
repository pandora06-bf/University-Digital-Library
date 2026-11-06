import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, BookOpen, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { BookCard } from '../../components/BookCard';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { ScrollReveal } from '../../components/motion/ScrollReveal';
import { bookService } from '../../services/bookService';

const SEARCH_DELAY_MS = 350;

// Trang hiện tại ± 1, luôn có trang đầu và cuối: 1 … 4 5 6 … 10
const pageWindow = (page, totalPages) => {
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);
  return pages.flatMap((n, i) => (i > 0 && n - pages[i - 1] > 1 ? ['gap', n] : [n]));
};

/**
 * Trang Danh mục Sách (Catalog Page) – 2B-12
 * Tham chiếu Figma Node 46:4 (Desktop) & Node 66:4 (Mobile)
 *
 * - Dữ liệu từ GET /api/books/search (Full-Text Search, phân trang 20 sách/trang) qua bookService
 * - Thể loại lấy từ GET /api/books/categories
 * - Từ khóa, thể loại, eBook, trang đều nằm trên URL (?q=&category=&ebook=1&page=) nên tải lại hoặc
 *   tìm từ ô trên header vẫn giữ đúng kết quả
 */
export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('q') || '';
  const categoryId = Number(searchParams.get('category')) || null;
  const ebookOnly = searchParams.get('ebook') === '1';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  // Đổi bộ lọc thì quay về trang 1; chỉ đổi trang thì giữ bộ lọc.
  const updateParams = (changes, { keepPage = false } = {}) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
      if (!keepPage) next.delete('page');
      return next;
    }, { replace: true });
  };

  // Ô tìm kiếm chỉ đổi theo phím người dùng gõ. Ngừng gõ 350ms mới đưa từ khóa lên URL → gọi API.
  // Không được ghi giá trị vào ô khi bộ gõ tiếng Việt (EVKey, Unikey, IME Windows) đang soạn chữ
  // (chữ gạch chân): khi bấm space, bộ gõ chèn chữ đó lần nữa → "trítrí".
  const [searchText, setSearchText] = useState(searchTerm);
  const composing = useRef(false);
  const pushedTerm = useRef(searchTerm); // từ khóa chính trang này vừa đưa lên URL
  const searchTimer = useRef(null);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  // URL đổi từ nơi khác (ô tìm trên header, nút Quay lại của trình duyệt) → hiện đúng từ khóa đó.
  useEffect(() => {
    if (searchTerm === pushedTerm.current) return;
    pushedTerm.current = searchTerm;
    clearTimeout(searchTimer.current);
    setSearchText(searchTerm);
  }, [searchTerm]);

  const scheduleSearch = (value) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (composing.current) return; // compositionend sẽ hẹn lại
      pushedTerm.current = value;
      updateParams({ q: value });
    }, SEARCH_DELAY_MS);
  };
  const searchInputProps = {
    value: searchText,
    onChange: (e) => {
      setSearchText(e.target.value);
      scheduleSearch(e.target.value);
    },
    onCompositionStart: () => { composing.current = true; },
    onCompositionEnd: (e) => {
      composing.current = false;
      scheduleSearch(e.currentTarget.value);
    },
  };

  const [categories, setCategories] = useState([]);
  useEffect(() => {
    bookService.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const query = searchTerm;
  const requestKey = JSON.stringify({ query, categoryId, ebookOnly, page });
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false; // bỏ kết quả của request cũ nếu người dùng đã đổi bộ lọc
    bookService
      .search({ q: query, categoryId, bookType: ebookOnly ? 'EBOOK' : undefined, page })
      .then((data) => !cancelled && setResult({ key: requestKey, data, error: null }))
      .catch((error) => !cancelled && setResult({ key: requestKey, data: null, error }));
    return () => { cancelled = true; };
  }, [requestKey, query, categoryId, ebookOnly, page, reloadCount]);

  const loading = result.key !== requestKey;
  const books = result.data?.items ?? [];
  const total = result.data?.total ?? 0;
  const totalPages = result.data?.totalPages ?? 1;

  const goToPage = (target) => {
    updateParams({ page: target > 1 ? String(target) : null }, { keepPage: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetFilters = () => setSearchParams({}, { replace: true });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 space-y-8">

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
              placeholder="Nhập tên sách, tác giả hoặc nhà xuất bản..."
              {...searchInputProps}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Lọc sách có bản điện tử (book_type=EBOOK) */}
          <label className="flex items-center gap-2.5 px-4 py-3 bg-white border border-[#D9E2EE] rounded-xl cursor-pointer select-none text-sm font-medium text-slate-700 hover:border-indigo-400 transition-colors shrink-0">
            <input
              type="checkbox"
              checked={ebookOnly}
              onChange={(e) => updateParams({ ebook: e.target.checked ? '1' : null })}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Chỉ hiện sách có eBook</span>
          </label>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mr-2 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Thể loại:</span>
          </div>
          {[{ id: null, name: 'Tất cả' }, ...categories].map((cat) => {
            const isSelected = categoryId === cat.id;
            return (
              <button
                key={cat.id ?? 'all'}
                type="button"
                onClick={() => updateParams({ category: cat.id ? String(cat.id) : null })}
                className={`min-h-10 lg:min-h-0 px-3.5 py-2 lg:py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all select-none ${
                  isSelected
                    ? 'bg-[#4F46E5] text-white shadow-sm shadow-indigo-200'
                    : 'bg-white border border-slate-200 text-[#5B6B82] hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Result Stats */}
      <div className="text-xs text-slate-500 font-medium" aria-live="polite">
        {loading ? 'Đang tải danh mục…' : result.error ? 'Không tải được danh mục' : (
          <>Tìm thấy <strong>{total}</strong> tài liệu phù hợp{totalPages > 1 && ` · Trang ${page}/${totalPages}`}</>
        )}
      </div>

      {/* Book Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-[380px] rounded-[20px] border border-[#D9E2EE] bg-white p-4 animate-pulse">
              <div className="h-48 rounded-xl bg-slate-100 mb-4" />
              <div className="h-4 w-1/3 rounded bg-slate-100 mb-3" />
              <div className="h-5 w-4/5 rounded bg-slate-100 mb-2" />
              <div className="h-4 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : result.error ? (
        /* Error State */
        <div className="py-16 bg-white rounded-2xl border border-rose-200 text-center p-8 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Không kết nối được máy chủ thư viện</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Vui lòng kiểm tra kết nối mạng rồi thử lại.
          </p>
          <Button size="sm" variant="outline" onClick={() => setReloadCount((n) => n + 1)}>Thử lại</Button>
        </div>
      ) : books.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {books.map((book, idx) => (
              <ScrollReveal key={book.id} delay={Math.min(idx * 0.05, 0.4)}>
                <BookCard book={book} />
              </ScrollReveal>
            ))}
          </div>

          {/* Pagination: 20 sách/trang (NFR-PE-02) */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-1.5 flex-wrap" aria-label="Phân trang">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 inline-flex items-center gap-1 disabled:opacity-40 hover:border-indigo-400"
              >
                <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Trước</span>
              </button>
              {pageWindow(page, totalPages).map((item, i) => (item === 'gap' ? (
                <span key={`gap-${i}`} className="px-1 text-slate-400">…</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => goToPage(item)}
                  aria-current={item === page ? 'page' : undefined}
                  className={`h-9 min-w-9 px-2 rounded-xl text-sm font-semibold ${
                    item === page
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-400'
                  }`}
                >
                  {item}
                </button>
              )))}
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 inline-flex items-center gap-1 disabled:opacity-40 hover:border-indigo-400"
              >
                <span className="hidden sm:inline">Sau</span> <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          )}
        </>
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
            onClick={resetFilters}
            className="min-h-10 px-3 text-xs font-semibold text-indigo-600 hover:underline"
          >
            Đặt lại tất cả bộ lọc
          </button>
        </div>
      )}

    </div>
  );
}
