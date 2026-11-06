import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import ProtectedPDFViewer from '../../components/ProtectedPDFViewer';
import ConfirmDialog from '../../components/ConfirmDialog';
import ToastAlertComponent from '../../components/ToastAlertComponent';
import { Button } from '../../components/Button';
import { ebookService } from '../../services/ebookService';
import { getCurrentUser } from '../../mocks/auth';
import { isForbidden } from '../../utils/ebookAccess';
import { getToken } from '../../services/axios_instance';
import { loginPathFor } from '../../utils/loginRedirect';

// Đổi lỗi Axios thành câu tiếng Việt thay vì "Request failed with status code 404" (4-14.a).
function readerErrorMessage(failure) {
  if (isForbidden(failure)) return 'Bạn không có quyền đọc tài liệu này. Vui lòng mượn eBook từ trang chi tiết sách.';
  if (failure.response?.status === 404) return 'Tài liệu này chưa có tệp eBook trên hệ thống. Bạn có thể đặt mượn bản in tại trang chi tiết sách.';
  if (failure.request && !failure.response) return 'Không kết nối được máy chủ thư viện. Vui lòng kiểm tra mạng rồi thử lại.';
  return failure.response?.data?.detail || 'Không thể mở tài liệu. Vui lòng thử lại sau.';
}

export default function PdfReaderPage() {
  const { loanId, bookId } = useParams();
  return <ReaderSession key={`${loanId ?? ''}:${bookId ?? ''}`} loanId={loanId} bookId={bookId} />;
}

function ReaderSession({ loanId, bookId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const [notice, setNotice] = useState(null);
  const [failure, setFailure] = useState(null); // lỗi mượn/trả → Toast đỏ qua ToastAlertComponent (4-14.a)
  const closeToast = useCallback(() => { setNotice(null); setFailure(null); }, []);
  useEffect(() => {
    let cancelled = false;
    const request = bookId ? ebookService.getPreview(bookId) : ebookService.getLoanSession(loanId);
    request.then((data) => { if (!cancelled) setSession(data); }).catch((loadFailure) => {
      if (!cancelled) setError(readerErrorMessage(loadFailure));
    });
    return () => { cancelled = true; };
  }, [loanId, bookId]);

  const borrow = async () => {
    // Khách xem trước rồi bấm mượn: đăng nhập xong quay lại bản xem trước (2B-14)
    if (!getToken() || !getCurrentUser()) { navigate(loginPathFor(location)); return; }
    setBusy(true); closeToast();
    try {
      const loan = await ebookService.borrow(session.bookId);
      if (String(loan.id) === String(loanId)) setSession(await ebookService.getLoanSession(loan.id));
      else navigate(`/reader/${loan.id}`, { replace: true });
    } catch (failed) { setFailure(failed); }
    finally { setBusy(false); }
  };
  const returnBook = async () => {
    setBusy(true);
    try {
      await ebookService.returnBook(session.loanId);
      setSession({ ...session, access: 'locked', file: null, readToken: undefined });
      setReturning(false);
      setNotice({ message: 'Đã trả eBook. Quyền đọc của phiếu mượn đã kết thúc.' });
    } catch (failed) { setFailure(failed); }
    finally { setBusy(false); }
  };
  if (error) return <div role="alert" className="max-w-lg mx-auto p-8 mt-12 space-y-4"><h1 className="text-xl font-semibold">Không thể mở trình đọc</h1><p>{error}</p><Link to={bookId ? `/books/${bookId}` : '/my-books'}><Button>Quay lại</Button></Link></div>;
  if (!session) return <p role="status" className="p-12 text-center">Đang kiểm tra quyền đọc…</p>;
  return <>
    <ProtectedPDFViewer key={`${session.loanId ?? session.bookId}:${session.access}:${session.expiresAt ?? ''}`} session={session} onBorrow={borrow} onReturn={() => setReturning(true)} busy={busy} watermark={`${getCurrentUser()?.name ?? 'LIBMANAGER'} · CHỈ ĐỌC TRỰC TUYẾN`} />
    <ToastAlertComponent error={failure} notice={notice} onClose={closeToast} />
    {returning && <ConfirmDialog title="Trả eBook?" confirmLabel="Trả sách" loading={busy} onClose={() => setReturning(false)} onConfirm={returnBook}>Sau khi trả “{session.title}”, quyền đọc của phiếu mượn sẽ kết thúc ngay.</ConfirmDialog>}
  </>;
}
