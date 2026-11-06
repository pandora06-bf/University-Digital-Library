import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Sparkles, ArrowRight, Bookmark, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/Button';
import { BookCard } from '../../components/BookCard';
import { CursorRipple } from '../../components/motion/CursorRipple';
import { HeroParallax } from '../../components/motion/HeroParallax';
import { ScrollReveal } from '../../components/motion/ScrollReveal';
import { bookService } from '../../services/bookService';

const SHELF_SIZE = 4;

// Một kệ sách trên Trang chủ: đang tải → khung xám, lỗi → thông báo nhỏ, có dữ liệu → BookCard.
function BookShelf({ state }) {
  if (state.error) {
    return (
      <div className="py-8 bg-white rounded-2xl border border-rose-200 text-center text-sm text-slate-600 flex items-center justify-center gap-2">
        <AlertTriangle className="w-4 h-4 text-rose-500" /> Không tải được danh sách sách. Vui lòng tải lại trang.
      </div>
    );
  }
  if (!state.books) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" aria-busy="true">
        {Array.from({ length: SHELF_SIZE }, (_, i) => (
          <div key={i} className="h-[380px] rounded-[20px] border border-[#D9E2EE] bg-white p-4 animate-pulse">
            <div className="h-48 rounded-xl bg-slate-100 mb-4" />
            <div className="h-5 w-4/5 rounded bg-slate-100 mb-2" />
            <div className="h-4 w-1/2 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }
  if (state.books.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Chưa có tài liệu nào.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {state.books.map((book, idx) => (
        <ScrollReveal key={book.id} delay={idx * 0.06}>
          <BookCard book={book} />
        </ScrollReveal>
      ))}
    </div>
  );
}

// Gọi bookService.search một lần khi mở trang, trả về { books, error } cho BookShelf.
function useShelf(filters, pageSize = SHELF_SIZE) {
  const [state, setState] = useState({ books: null, error: null });
  const key = JSON.stringify(filters);
  useEffect(() => {
    let cancelled = false;
    bookService.search({ ...JSON.parse(key), page: 1, pageSize })
      .then((data) => !cancelled && setState({ books: data.items, error: null }))
      .catch((error) => !cancelled && setState({ books: null, error }));
    return () => { cancelled = true; };
  }, [key, pageSize]);
  return state;
}

/**
 * Trang Chủ (Home Page) — Cổng Độc giả, nối API ở 2B-12
 * Tham chiếu Figma Node 46:3 (Desktop) & Node 66:3 (Mobile)
 *
 * - "Tài liệu mới cập nhật": GET /api/books/search không từ khóa (backend xếp sách mới thêm lên đầu)
 * - "Đọc online ngay": cùng API, lọc book_type=EBOOK. Backend chưa có thống kê lượt mượn nên
 *   chưa làm mục "Được mượn nhiều nhất".
 *
 * Hiệu ứng tích hợp:
 * - Cursor Ripple trên Hero banner
 * - Hero Parallax trên cụm hình collage 440×240px
 * - Scroll Reveal & Stagger trên các danh mục và thẻ sách
 */
export default function HomePage() {
  const latest = useShelf({});
  // Lấy dư 2 kệ rồi bỏ sách đã có ở "Tài liệu mới cập nhật" để hai kệ không lặp cùng một cuốn.
  const ebookPool = useShelf({ bookType: 'EBOOK' }, SHELF_SIZE * 2);
  const shownIds = new Set((latest.books ?? []).map((book) => book.id));
  const ebooks = latest.books && ebookPool.books
    ? { ...ebookPool, books: ebookPool.books.filter((book) => !shownIds.has(book.id)).slice(0, SHELF_SIZE) }
    : { books: null, error: ebookPool.error };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 space-y-12 sm:space-y-16">

      {/* 1. HERO BANNER (1344×320px tại 1440, radius 28px theo Figma Node 46:3) */}
      <section className="relative w-full rounded-[24px] sm:rounded-[28px] overflow-hidden bg-gradient-to-r from-[#312E81] via-[#4F46E5] to-[#0E7490] text-white p-6 sm:p-10 lg:p-14 shadow-lg shadow-indigo-900/10 flex flex-col lg:flex-row items-center justify-between gap-8 min-h-[300px] sm:min-h-[320px]">
        
        {/* Hiệu ứng gợn sóng con trỏ (Cursor Ripple) */}
        <CursorRipple />

        {/* Nền trang trí */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />

        {/* Cột trái: Nội dung Hero */}
        <div className="relative z-10 max-w-xl space-y-4 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-cyan-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hệ thống Thư viện Số Thông minh</span>
          </div>

          <h1 className="text-[28px] sm:text-[36px] lg:text-display-lg font-bold leading-tight tracking-tight">
            Tra cứu & Mượn sách Dễ dàng
          </h1>

          <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed font-normal">
            Hơn 50,000 đầu sách học thuật, giáo trình điện tử và bản ghi kỹ thuật số phục vụ học tập, nghiên cứu tại Đại học Tôn Đức Thắng.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4">
            <Link to="/catalog">
              <Button
                variant="outline"
                size="md"
                className="bg-white text-[#3730A3] hover:bg-slate-50 border-white shadow-md"
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Khám phá Danh mục
              </Button>
            </Link>

            <Link to="/my-books">
              <Button
                variant="ghost"
                size="md"
                className="text-white hover:bg-white/10 border border-white/30"
                icon={<Bookmark className="w-4 h-4" />}
              >
                Sách của tôi
              </Button>
            </Link>
          </div>
        </div>

        {/* Cột phải: Minh họa Collage với HeroParallax (440×240px) */}
        <div className="relative z-10 w-full max-w-[440px] h-[220px] sm:h-[240px] hidden sm:flex items-center justify-center">
          <HeroParallax className="w-full h-full flex items-center justify-center">
            {/* Card mô phỏng 1 */}
            <div className="absolute w-48 h-60 rounded-2xl bg-white/10 backdrop-blur-md border border-white/25 p-4 shadow-xl -rotate-6 transform hover:rotate-0 transition-transform flex flex-col justify-between">
              <div className="w-10 h-10 rounded-xl bg-cyan-400/20 flex items-center justify-center text-cyan-200">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-cyan-200">Sách số hóa</span>
                <div className="text-xs font-bold text-white line-clamp-2 mt-1">Công nghệ Phần mềm & Kiến trúc Hệ thống</div>
              </div>
            </div>

            {/* Card mô phỏng 2 */}
            <div className="absolute w-52 h-64 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/40 p-5 shadow-2xl rotate-6 transform hover:rotate-0 transition-transform flex flex-col justify-between z-10 translate-x-12">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-white text-indigo-700 flex items-center justify-center shadow-md">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-400/20 text-emerald-300 text-[10px] font-bold">Online PDF</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-indigo-200">Giáo trình</span>
                <div className="text-sm font-bold text-white line-clamp-2 mt-1">Trí tuệ Nhân tạo & Machine Learning</div>
                <div className="text-[11px] text-indigo-100 mt-1">Đầy đủ 15 chương</div>
              </div>
            </div>
          </HeroParallax>
        </div>

      </section>

      {/* 2. SECTION: SÁCH MỚI CẬP NHẬT */}
      <ScrollReveal className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
          <div>
            <h2 className="text-xl sm:text-headline-lg text-[#172033] font-semibold tracking-tight">
              Tài liệu mới cập nhật
            </h2>
            <p className="text-body-md text-[#5B6B82] mt-0.5">
              Những ấn phẩm mới nhất vừa được bổ sung vào bộ sưu tập số
            </p>
          </div>
          <Link to="/catalog">
            <Button variant="ghost" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
              Xem tất cả
            </Button>
          </Link>
        </div>

        {/* Grid BookCards với Stagger */}
        <BookShelf state={latest} />
      </ScrollReveal>

      {/* 3. SECTION: SÁCH CÓ BẢN ĐIỆN TỬ */}
      <ScrollReveal className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
          <div>
            <h2 className="text-xl sm:text-headline-lg text-[#172033] font-semibold tracking-tight">
              Đọc online ngay
            </h2>
            <p className="text-body-md text-[#5B6B82] mt-0.5">
              Giáo trình và tài liệu có bản điện tử, đọc trực tiếp trên trình duyệt
            </p>
          </div>
          <Link to="/catalog?ebook=1">
            <Button variant="ghost" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
              Xem tất cả
            </Button>
          </Link>
        </div>

        {/* Grid BookCards với Stagger */}
        <BookShelf state={ebooks} />
      </ScrollReveal>

    </div>
  );
}
