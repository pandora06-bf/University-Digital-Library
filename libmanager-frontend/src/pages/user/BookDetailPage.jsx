import { useCallback, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, BookOpen, Bookmark, CheckCircle, XCircle, MapPin, Building, Calendar, Hash, FileText, BellRing } from 'lucide-react';
import { Button } from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import ToastAlertComponent from '../../components/ToastAlertComponent';
import { getStoredBooks, borrowDaysFor } from '../../mocks/loans';
import { getCurrentUser } from '../../mocks/auth';
import { getToken } from '../../services/axios_instance';
import { loanService } from '../../services/loanService';
import { mapBorrowError } from '../../utils/borrowErrors';
import { loginPathFor } from '../../utils/loginRedirect';

const formatDateTime = (value) => new Date(value).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
});
const formatDate = (value) => new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

/**
 * BorrowButton (3-12.a): "Đặt mượn" khi còn tồn, "Hẹn đặt trước" khi hết tồn (2B-14).
 * - Khách: chuyển sang Đăng nhập rồi quay lại trang sách.
 * - Xác nhận: hiện vị trí kệ và hạn trả dự kiến; thành công hiện mã mượn và hạn nhận sách.
 * - Lỗi 403/409: Toast đỏ nêu lý do; hết sách thì hỏi chuyển sang Hẹn đặt trước.
 */
function BorrowButton({ book, onChanged }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [dialog, setDialog] = useState(null); // 'borrow' | 'waitlist' | 'outOfStock' | { loan } | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [openedAt, setOpenedAt] = useState(0); // thời điểm bấm nút, để tính hạn trả dự kiến
  const closeToast = useCallback(() => { setError(null); setNotice(null); }, []);
  const available = book.availableCopies > 0;

  const open = (kind) => {
    if (!getToken() || !getCurrentUser()) {
      navigate(loginPathFor(location));
      return;
    }
    closeToast();
    setOpenedAt(Date.now());
    setDialog(kind);
  };

  const borrow = async () => {
    setBusy(true);
    try {
      const loan = await loanService.requestPhysical(book.id);
      setDialog({ loan });
    } catch (failure) {
      if (mapBorrowError(failure).offerWaitlist) setDialog('outOfStock');
      else { setDialog(null); setError(failure); }
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const waitlist = async () => {
    setBusy(true);
    try {
      const entry = await loanService.joinWaitlist(book.id);
      setNotice({ type: 'success', message: `Đã hẹn đặt trước. Bạn đang ở vị trí số ${entry.queuePosition}; khi có sách, thư viện giữ chỗ cho bạn 24 giờ và gửi email báo.` });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
      setDialog(null);
    }
  };

  const user = getCurrentUser();
  const borrowDays = borrowDaysFor(user);
  const dueEstimate = openedAt + borrowDays * 86400000;

  return (
    <>
      {available ? (
        <Button variant="primary" size="lg" onClick={() => open('borrow')} icon={<Bookmark className="w-5 h-5" />} className="px-8">
          Đặt mượn
        </Button>
      ) : (
        <Button variant="outline" size="lg" onClick={() => open('waitlist')} icon={<BellRing className="w-5 h-5" />} className="px-8">
          Hẹn đặt trước
        </Button>
      )}

      {dialog === 'borrow' && (
        <ConfirmDialog title="Xác nhận đặt mượn" confirmLabel="Đặt mượn" loading={busy} onClose={() => setDialog(null)} onConfirm={borrow}>
          <p className="font-semibold text-slate-800">{book.title}</p>
          <p>Vị trí kệ: <strong>{book.location}</strong></p>
          <p>Hạn trả dự kiến: <strong>{formatDate(dueEstimate)}</strong> ({borrowDays} ngày nếu nhận sách hôm nay; hạn chính thức tính khi nhận tại quầy).</p>
          <p>Sau khi đặt, bạn có 24 giờ để đến quầy nhận sách.</p>
        </ConfirmDialog>
      )}

      {dialog?.loan && (
        <ConfirmDialog title="Đặt mượn thành công" confirmLabel="Xem Sách của tôi" cancelLabel="Đóng" onClose={() => setDialog(null)} onConfirm={() => navigate('/my-books')}>
          <p>Mã mượn: <strong className="font-mono text-indigo-700">{dialog.loan.loanCode}</strong></p>
          <p>Hạn nhận sách: <strong>{formatDateTime(dialog.loan.pickupDeadline)}</strong></p>
          <p>Vị trí kệ: <strong>{book.location}</strong>. Đưa mã mượn cho thủ thư khi nhận sách; quá hạn nhận, phiếu tự hủy.</p>
        </ConfirmDialog>
      )}

      {(dialog === 'waitlist' || dialog === 'outOfStock') && (
        <ConfirmDialog title={dialog === 'outOfStock' ? 'Sách vừa hết bản' : 'Hẹn đặt trước'} confirmLabel="Hẹn đặt trước" loading={busy} onClose={() => setDialog(null)} onConfirm={waitlist}>
          {dialog === 'outOfStock' && <p>Bản cuối vừa được người khác đặt mượn. Bạn có muốn chuyển sang Hẹn đặt trước không?</p>}
          <p>Khi có sách trả về, người đầu hàng chờ được giữ chỗ 24 giờ và nhận email thông báo.</p>
        </ConfirmDialog>
      )}

      <ToastAlertComponent error={error} notice={notice} onClose={closeToast} />
    </>
  );
}

/**
 * Trang Chi tiết Sách (Book Detail Page)
 * Tham chiếu Figma Node 46:5
 */
export default function BookDetailPage() {
  const { bookId } = useParams();
  const [, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const book = getStoredBooks().find((b) => b.id === bookId);

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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
      
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
            <BorrowButton book={book} onChanged={refresh} />

            {book.pdfAvailable && (
              <Link to={`/books/${book.id}/preview`}>
                <Button
                  variant="outline"
                  size="lg"
                  icon={<FileText className="w-5 h-5" />}
                >
                  Đọc/Mượn eBook
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
