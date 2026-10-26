import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, LockKeyhole, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from './Button';
import { accessDeadline, isForbidden, previewLimit } from '../utils/ebookAccess';
import '../styles/protected-reader.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
const PDF_OPTIONS = { isEvalSupported: false };

export default function ProtectedPDFViewer({ session, onBorrow, onReturn, busy = false, watermark = 'LIBMANAGER · CHỈ ĐỌC TRỰC TUYẾN' }) {
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [now, setNow] = useState(Date.now);
  const [failure, setFailure] = useState(null);
  const [notice, setNotice] = useState('');
  const [width, setWidth] = useState(720);
  const container = useRef(null);
  const expired = now >= accessDeadline(session);
  const locked = expired || failure === 'forbidden' || session.access === 'locked';
  const preview = session.access === 'preview';
  const allowedPages = preview ? Math.min(pages, previewLimit(session.previewPages)) : pages;

  useEffect(() => {
    const updateTime = () => setNow(Date.now());
    const timer = window.setInterval(updateTime, 1000);
    document.addEventListener('visibilitychange', updateTime);
    window.addEventListener('focus', updateTime);
    const blockShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && ['p', 's'].includes(event.key.toLowerCase())) {
        event.preventDefault(); event.stopPropagation();
        setNotice('Tài liệu chỉ được đọc trực tuyến. Chức năng in và lưu đã bị khóa.');
      }
    };
    document.addEventListener('keydown', blockShortcut, true);
    document.body.classList.add('protected-reader-open');
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('keydown', blockShortcut, true);
      document.removeEventListener('visibilitychange', updateTime);
      window.removeEventListener('focus', updateTime);
      document.body.classList.remove('protected-reader-open');
    };
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.min(720, entry.contentRect.width - 32))));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  const handlePdfError = (error) => setFailure(isForbidden(error) ? 'forbidden' : 'load');
  return (
    <div className="protected-reader min-h-screen bg-slate-950 text-slate-100 select-none" onContextMenu={(event) => { event.preventDefault(); setNotice('Tài liệu được bảo vệ; menu lưu và in đã bị khóa.'); }}>
      <header className="sticky top-0 z-30 border-b border-slate-700 bg-slate-900 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/my-books" aria-label="Quay lại Sách của tôi" className="rounded-lg p-2 hover:bg-slate-800"><ArrowLeft className="w-5 h-5" /></Link>
            <BookOpen className="hidden sm:block w-5 h-5 shrink-0 text-indigo-300" />
            <h1 className="text-sm font-semibold truncate max-w-[200px] sm:max-w-sm">{session.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-slate-700 px-1 py-1">
              <button type="button" aria-label="Trang trước" disabled={locked || page <= 1} onClick={() => setPage((value) => value - 1)} className="p-2 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span aria-live="polite" className="text-xs px-2">{locked ? '—' : pages ? `${page} / ${allowedPages}` : 'Đang tải…'}</span>
              <button type="button" aria-label="Trang sau" disabled={locked || !pages || page >= allowedPages} onClick={() => setPage((value) => value + 1)} className="p-2 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center rounded-xl border border-slate-700 px-1 py-1">
              <button type="button" aria-label="Thu nhỏ" disabled={locked || zoom <= 70} onClick={() => setZoom((value) => Math.max(70, value - 10))} className="p-2 disabled:opacity-30"><ZoomOut className="w-4 h-4" /></button>
              <span className="text-xs w-10 text-center">{zoom}%</span>
              <button type="button" aria-label="Phóng to" disabled={locked || zoom >= 160} onClick={() => setZoom((value) => Math.min(160, value + 10))} className="p-2 disabled:opacity-30"><ZoomIn className="w-4 h-4" /></button>
            </div>
            {session.loanId && session.access === 'borrowed' && !locked && <Button size="sm" variant="outline" onClick={onReturn} loading={busy} icon={<RotateCcw className="w-4 h-4" />}>Trả sách</Button>}
          </div>
        </div>
      </header>
      <div className="px-4 py-3 text-center text-xs bg-slate-900/70 text-slate-300">
        {session.isDemo ? 'Tài liệu mẫu để trải nghiệm trình đọc · ' : ''}
        {preview ? `Bản xem trước · Tối đa ${previewLimit(session.previewPages)} trang đầu` : session.access === 'free' ? 'Sách miễn phí · Đọc toàn bộ' : session.expiresAt && Number.isFinite(new Date(session.expiresAt).getTime()) ? `Quyền đọc đến ${new Date(session.expiresAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Quyền đọc được thư viện quản lý'}
      </div>
      {notice && <p role="status" className="p-3 text-center text-sm bg-amber-950 text-amber-100">{notice}</p>}
      <main ref={container} className="mx-auto max-w-5xl p-4 sm:p-8 overflow-auto min-h-[65vh]">
        {locked ? <div role="alert" className="max-w-md mx-auto my-16 rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center space-y-4">
          <LockKeyhole className="w-10 h-10 mx-auto text-amber-300" />
          <h2 className="text-xl font-semibold">Quyền đọc đã bị khóa</h2>
          <p className="text-sm text-slate-300">Phiếu mượn đã hết hạn, đã trả hoặc bạn không còn quyền đọc tài liệu này. Mượn lại để tiếp tục.</p>
          <Button loading={busy} onClick={onBorrow}>Mượn lại</Button>
        </div> : failure ? <div role="alert" className="text-center py-16 space-y-3"><h2 className="font-semibold">Không thể tải tài liệu</h2><p className="text-sm text-slate-400">Kiểm tra kết nối và mở lại trình đọc.</p><Button size="sm" onClick={() => window.location.reload()}>Thử lại</Button></div> : (
          <div className="w-fit mx-auto relative">
            <Document file={session.file} options={PDF_OPTIONS} suspense={false} onLoadSuccess={({ numPages }) => setPages(numPages)} onLoadError={handlePdfError} onSourceError={handlePdfError} loading={<p role="status" className="p-12 text-sm">Đang tải tài liệu…</p>} error={<p>Không thể tải PDF.</p>}>
              <Page pageNumber={page} width={Math.round(width * zoom / 100)} renderTextLayer={false} renderAnnotationLayer={false} onLoadError={handlePdfError} onRenderError={handlePdfError} loading={<p className="p-12 text-sm">Đang tải trang…</p>} />
            </Document>
            {pages > 0 && <div aria-hidden="true" className="absolute inset-0 pointer-events-none grid place-items-center overflow-hidden"><span className="-rotate-35 text-slate-700/15 text-xl sm:text-3xl font-bold text-center">{watermark}</span></div>}
          </div>
        )}
        {preview && !locked && <div className="max-w-lg mx-auto mt-6 rounded-2xl border border-indigo-700 bg-indigo-950 p-5 text-center space-y-3">
          <h2 className="font-semibold">{page >= allowedPages && pages > 0 ? 'Bạn đã đọc hết phần xem trước' : 'Muốn đọc toàn bộ tài liệu?'}</h2>
          <p className="text-sm text-indigo-200">Mượn eBook để đọc các trang tiếp theo trong thời hạn của phiếu mượn.</p>
          <Button onClick={onBorrow} loading={busy}>Mượn eBook</Button>
        </div>}
      </main>
    </div>
  );
}
