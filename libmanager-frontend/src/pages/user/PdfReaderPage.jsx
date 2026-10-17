import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ProtectedPDFViewer from '../../components/ProtectedPDFViewer';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast from '../../components/UserToast';
import { Button } from '../../components/Button';
import { ebookService } from '../../services/ebookService';
import { getCurrentUser } from '../../mocks/auth';
import { isForbidden } from '../../utils/ebookAccess';

export default function PdfReaderPage() {
  const { loanId, bookId } = useParams();
  return <ReaderSession key={`${loanId ?? ''}:${bookId ?? ''}`} loanId={loanId} bookId={bookId} />;
}

function ReaderSession({ loanId, bookId }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);
  useEffect(() => {
    let cancelled = false;
    const request = bookId ? ebookService.getPreview(bookId) : ebookService.getLoanSession(loanId);
    request.then((data) => { if (!cancelled) setSession(data); }).catch((failure) => {
      if (!cancelled) setError(isForbidden(failure) ? 'Bạn không có quyền đọc tài liệu này. Vui lòng mượn eBook từ trang chi tiết sách.' : failure.message || 'Không thể mở tài liệu.');
    });
    return () => { cancelled = true; };
  }, [loanId, bookId]);

  const borrow = async () => {
    setBusy(true);
    try {
      const loan = await ebookService.borrow(session.bookId);
      if (String(loan.id) === String(loanId)) setSession(await ebookService.getLoanSession(loan.id));
      else navigate(`/reader/${loan.id}`, { replace: true });
    } catch (failure) { setToast({ type: 'error', message: failure.response?.data?.detail || failure.message }); }
    finally { setBusy(false); }
  };
  const returnBook = async () => {
    setBusy(true);
    try {
      await ebookService.returnBook(session.loanId);
      setSession({ ...session, access: 'locked', file: null, readToken: undefined });
      setReturning(false);
      setToast({ message: 'Đã trả eBook. Quyền đọc của phiếu mượn đã kết thúc.' });
    } catch (failure) { setToast({ type: 'error', message: failure.response?.data?.detail || failure.message }); }
    finally { setBusy(false); }
  };
  if (error) return <div role="alert" className="max-w-lg mx-auto p-8 mt-12 space-y-4"><h1 className="text-xl font-semibold">Không thể mở trình đọc</h1><p>{error}</p><Link to={bookId ? `/books/${bookId}` : '/my-books'}><Button>Quay lại</Button></Link></div>;
  if (!session) return <p role="status" className="p-12 text-center">Đang kiểm tra quyền đọc…</p>;
  return <>
    <ProtectedPDFViewer key={`${session.loanId ?? session.bookId}:${session.access}:${session.expiresAt ?? ''}`} session={session} onBorrow={borrow} onReturn={() => setReturning(true)} busy={busy} watermark={`${getCurrentUser()?.name ?? 'LIBMANAGER'} · CHỈ ĐỌC TRỰC TUYẾN`} />
    <Toast toast={toast} onClose={closeToast} />
    {returning && <ConfirmDialog title="Trả eBook?" confirmLabel="Trả sách" loading={busy} onClose={() => setReturning(false)} onConfirm={returnBook}>Sau khi trả “{session.title}”, quyền đọc của phiếu mượn sẽ kết thúc ngay.</ConfirmDialog>}
  </>;
}
