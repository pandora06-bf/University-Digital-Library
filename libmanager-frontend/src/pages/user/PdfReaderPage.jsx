import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, BookOpen, Download, Printer, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/Button';
import { getStoredLoans } from '../../mocks/loans';

/**
 * Khung giao diện Trình đọc Sách Điện tử (PDF Viewer UI Frame)
 * Tham chiếu Figma Node 46:7
 * 
 * Quy chuẩn:
 * - Khung hiển thị tài liệu số hóa chuẩn bảo vệ bản quyền thư viện
 * - Toolbar điều khiển: Chuyển trang, phóng to thu nhỏ, quay lại My Books
 * - Các nút tải/in được gắn nhãn bản quyền rõ ràng theo yêu cầu
 */
export default function PdfReaderPage() {
  const { loanId } = useParams();
  const loans = getStoredLoans();
  const loan = loans.find((l) => l.id === loanId) || loans[0];

  const [page, setPage] = useState(1);
  const totalPages = 24;
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 15, 160));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 15, 70));

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col select-none">
      
      {/* 1. READER TOOLBAR CHUẨN FIGMA */}
      <header className="h-16 bg-slate-800/90 backdrop-blur-md border-b border-slate-700/80 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
        
        {/* Nút Quay lại & Tiêu đề */}
        <div className="flex items-center gap-3 sm:gap-4 truncate">
          <Link to="/my-books">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white hover:bg-slate-700 px-2 sm:px-3"
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              <span className="hidden sm:inline">Quay lại</span>
            </Button>
          </Link>

          <div className="h-5 w-px bg-slate-700 hidden sm:block" />

          <div className="flex items-center gap-2 truncate">
            <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
              {loan ? loan.bookTitle : 'Tài liệu Thư viện Số'}
            </span>
          </div>
        </div>

        {/* Bộ điều khiển Chuyển trang & Zoom */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Chuyển trang */}
          <div className="flex items-center gap-1 bg-slate-900/80 px-2 py-1 rounded-xl border border-slate-700 text-xs">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-1.5 font-mono text-slate-300">
              {page} / {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom */}
          <div className="hidden md:flex items-center gap-1 bg-slate-900/80 px-2 py-1 rounded-xl border border-slate-700 text-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 text-slate-400 hover:text-white"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-1.5 font-mono text-slate-300">{zoom}%</span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 text-slate-400 hover:text-white"
              title="Phóng to"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Quyền sở hữu / Không cho tải trộm */}
          <div className="hidden lg:flex items-center gap-1">
            <button
              type="button"
              disabled
              title="Tài liệu được bảo vệ bản quyền số bởi Thư viện TDTU"
              className="p-2 text-slate-500 cursor-not-allowed rounded-lg opacity-50"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled
              title="Chức năng in bị khóa trên bản ghi số này"
              className="p-2 text-slate-500 cursor-not-allowed rounded-lg opacity-50"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

      </header>

      {/* 2. VÙNG HIỂN THỊ TÀI LIỆU SỐ (DOCUMENT CANVAS) */}
      <main className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-slate-950">
        <div
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          className="transition-transform duration-150 ease-out"
        >
          {/* Trang giấy mô phỏng */}
          <div className="w-[600px] sm:w-[750px] min-h-[950px] bg-white text-slate-900 rounded-lg shadow-2xl p-10 sm:p-14 space-y-8 relative overflow-hidden">
            
            {/* Dấu watermark bảo vệ số */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] rotate-45 select-none text-4xl sm:text-6xl font-black text-slate-900">
              TDTU DIGITAL LIBRARY • CHỈ XEM NỘI BỘ
            </div>

            {/* Đầu trang sách */}
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-200 pb-4">
              <span>{loan ? loan.bookTitle : 'Giáo trình Thư viện Số'}</span>
              <span className="font-mono">Trang {page}</span>
            </div>

            {/* Nội dung mẫu của trang sách */}
            <div className="space-y-6 text-sm sm:text-base leading-relaxed text-slate-700">
              <div className="text-center space-y-2 py-4">
                <span className="text-xs uppercase tracking-widest text-indigo-600 font-bold">
                  Chương {page}: Khái niệm Cốt lõi & Kiến trúc Phần mềm
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {loan ? loan.bookTitle : 'Lập trình Hiện đại'}
                </h1>
                <p className="text-xs text-slate-500">Tác giả: {loan ? loan.author : 'Ban biên soạn'}</p>
              </div>

              <p className="indent-6">
                Trong phát triển ứng dụng quy mô lớn, việc tổ chức mã nguồn và phân tách ranh giới giữa các tầng nghiệp vụ là yếu tố then chốt quyết định tính bền vững của dự án. Một kiến trúc vững chắc cho phép các thành viên trong nhóm phát triển độc lập mà không gây xung đột logic.
              </p>

              <div className="bg-slate-50 border-l-4 border-indigo-500 p-4 rounded-r-xl my-4 text-xs sm:text-sm text-slate-800">
                <div className="font-semibold text-indigo-900 mb-1">Ghi chú trọng tâm cho sinh viên:</div>
                Hệ thống component tái sử dụng (Atomic Design) giúp tối ưu hóa thời gian phát triển và đảm bảo sự nhất quán trong trải nghiệm người dùng trên mọi nền tảng thiết bị.
              </div>

              <p className="indent-6">
                Các nguyên lý SOLID và Clean Architecture nhấn mạnh việc các chi tiết triển khai (Frameworks, Database, UI) phải phụ thuộc vào các chính sách trừu tượng cấp cao, chứ không phải ngược lại. Điều này cho phép hệ thống dễ dàng thay thế giao diện hoặc thư viện hỗ trợ mà không làm thay đổi các quy tắc kinh doanh cốt lõi.
              </p>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-600">
                Mã tham chiếu: {loan ? loan.loanCode : 'PM-2026-DEMO'} • Thời gian truy cập: {new Date().toLocaleDateString('vi-VN')}
              </div>
            </div>

            {/* Chân trang sách */}
            <div className="pt-8 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span>Bản quyền tài liệu thuộc Đại học Tôn Đức Thắng</span>
              </span>
              <span>— {page} —</span>
            </div>

          </div>
        </div>
      </main>

    </div>
  );
}
