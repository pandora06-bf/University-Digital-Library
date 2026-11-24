import { useEffect, useRef, useState } from 'react';
import { 
  Book, User, CheckCircle2, X, Search
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { FastBarcodeScanner } from '../../components/FastBarcodeScanner';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import axiosInstance from '../../services/axios_instance';
import { getApiErrorMessage } from '../../services/errorHandler';
import { AdminIconButton } from '../../components/AdminIconButton';

export default function LoanManagement() {
  const { toast, showToast, hideToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoLookupDone = useRef('');
  const [returnBarcode, setReturnBarcode] = useState('');
  const [borrowUserId, setBorrowUserId] = useState('');

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);

  const [isUserLoading, setIsUserLoading] = useState(false);
  const [isBorrowLoading, setIsBorrowLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [userValidated, setUserValidated] = useState(false);
  const [readerProfile, setReaderProfile] = useState(null);
  const [pendingLoans, setPendingLoans] = useState([]);

  const [returnCondition, setReturnCondition] = useState('Nguyên vẹn');
  const [returnIssue, setReturnIssue] = useState('Rách bìa');
  const [returnNote, setReturnNote] = useState('');
  const [checkoutConditionNotes, setCheckoutConditionNotes] = useState('');

  const [returnBookScanned, setReturnBookScanned] = useState(false);
  const [returnSlip, setReturnSlip] = useState(null);
  const [returnHint, setReturnHint] = useState('');
  const [isReturnLoading, setIsReturnLoading] = useState(false);
  const [borrowBooks, setBorrowBooks] = useState([]);

  const formatLoanDate = (value) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('vi-VN');
    } catch {
      return String(value);
    }
  };

  const loanStatusLabel = (status) => {
    const map = {
      REQUESTED: 'Chờ xuất',
      PENDING_PICKUP: 'Chờ nhận',
      BORROWED: 'Đang mượn',
      OVERDUE: 'Quá hạn',
      RETURNED: 'Đã trả',
    };
    return map[status] || status || '—';
  };

  const looksLikeReaderCode = (code) =>
    /^(SV|GV|ADMIN|LIBRARIAN)[-_]/i.test(String(code || '').trim());

  const showReturnSlip = (slip, extraNote) => {
    setReturnHint('');
    setReturnBarcode(slip.copy_barcode);
    setReturnSlip(slip);
    setReturnBookScanned(true);
    const who = slip.full_name ? `${slip.full_name} (${slip.user_code})` : slip.user_code;
    showToast(
      extraNote || (slip.overdue
        ? `${who} đang quá hạn. Kiểm tra thẻ rồi mới xác nhận trả.`
        : `${who} đang mượn cuốn này. Kiểm tra thẻ rồi mới xác nhận trả.`),
      slip.overdue ? 'warning' : 'success'
    );
  };

  const loadReturnSlip = async (barcode) => {
    setIsReturnLoading(true);
    setReturnSlip(null);
    setReturnBookScanned(false);
    setReturnHint('');
    try {
      const { data } = await axiosInstance.get('/api/admin/loans/active-return', {
        params: { barcode },
      });
      showReturnSlip(data);
    } catch (error) {
      setReturnBarcode(barcode);
      showToast(getApiErrorMessage(error, 'Không tìm thấy phiếu đang mượn cho mã vạch này.'), 'error');
    } finally {
      setIsReturnLoading(false);
    }
  };

  const handleReturnScan = async (code) => {
    const targetCode = (typeof code === 'string' ? code : returnBarcode).trim();
    if (!targetCode) {
      showToast('Vui lòng quét hoặc nhập mã vạch sách trả rồi nhấn phím Enter.', 'warning');
      return;
    }

    if (looksLikeReaderCode(targetCode)) {
      setIsReturnLoading(true);
      try {
        const res = await axiosInstance.get('/api/admin/loans/lookup', {
          params: { q: targetCode },
        });
        const reader = res.data?.reader;
        const loans = res.data?.data || [];
        const active = loans.filter(
          (l) =>
            ['BORROWED', 'OVERDUE'].includes(String(l.loan_status || '').toUpperCase())
            && l.copy_barcode
        );
        if (!reader?.user_code) {
          setReturnBookScanned(false);
          setReturnSlip(null);
          setReturnHint('');
          showToast('Không có MSSV này trong hệ thống.', 'error');
          return;
        }
        if (!active.length) {
          const who = reader.full_name
            ? `${reader.full_name} (${reader.user_code})`
            : reader.user_code;
          const note = `${who} không có sách đang mượn để trả.`;
          setReturnBookScanned(false);
          setReturnSlip(null);
          setReturnBarcode(reader.user_code);
          setReturnHint(note);
          showToast(note, 'warning');
          return;
        }
        const barcode = active[0].copy_barcode;
        const { data } = await axiosInstance.get('/api/admin/loans/active-return', {
          params: { barcode },
        });
        showReturnSlip(
          data,
          active.length === 1
            ? null
            : `${targetCode} có ${active.length} cuốn đang mượn. Thẻ này là ${barcode}; trả các mã còn lại ở lần sau.`
        );
      } catch (error) {
        setReturnSlip(null);
        setReturnBookScanned(false);
        setReturnHint('');
        showToast(
          getApiErrorMessage(error, 'Không có MSSV này trong hệ thống.'),
          'error'
        );
      } finally {
        setIsReturnLoading(false);
      }
      return;
    }

    await loadReturnSlip(targetCode);
  };

  const handleUserScan = async (presetMssv) => {
    const fromArg = typeof presetMssv === 'string' ? presetMssv : '';
    const mssv = (fromArg || borrowUserId).trim();
    if (!mssv) {
      showToast('Nhập MSSV rồi bấm Tra cứu (không để trống).', 'warning');
      return;
    }
    setBorrowUserId(mssv);
    setIsUserLoading(true);
    setUserValidated(false);
    setReaderProfile(null);
    setPendingLoans([]);
    try {
      const res = await axiosInstance.get('/api/admin/loans/lookup', { params: { q: mssv } });
      const reader = res.data?.reader;
      if (!reader?.user_code) {
        showToast('Không có MSSV này trong hệ thống. Chỉ tra được mã bạn đọc đã có.', 'error');
        return;
      }
      const loans = (res.data?.data || []).filter(
        (l) => String(l.user_code || '').toUpperCase() === String(reader.user_code).toUpperCase()
      );
      const pending = loans.filter((l) =>
        ['REQUESTED', 'PENDING_PICKUP'].includes(l.loan_status)
      );
      setBorrowUserId(reader.user_code);
      setReaderProfile(reader);
      setPendingLoans(pending);
      setUserValidated(true);
      const blocked = Number(reader.total_fines) > 0 || reader.is_borrowing_blocked;
      showToast(
        blocked
          ? `${reader.user_code} có trong hệ thống nhưng đang nợ hoặc bị khóa mượn.`
          : pending.length
            ? `${reader.full_name} (${reader.user_code}): ${pending.length} phiếu chờ xuất mượn.`
            : `${reader.full_name} (${reader.user_code}): không có phiếu chờ. Có thể xuất mượn tại quầy.`,
        blocked || !pending.length ? 'warning' : 'success'
      );
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không tra cứu được độc giả.'), 'error');
    } finally {
      setIsUserLoading(false);
    }
  };

  // Từ Thu phạt / Chi tiết: /admin/loans?mssv=SV-DEMO-007 → tự điền + tra cứu
  useEffect(() => {
    const mssv = (searchParams.get('mssv') || '').trim();
    if (!mssv || autoLookupDone.current === mssv) return;
    autoLookupDone.current = mssv;
    handleUserScan(mssv);
    const next = new URLSearchParams(searchParams);
    next.delete('mssv');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi query mssv đổi
  }, [searchParams]);

  const copyStatusVi = {
    AVAILABLE: 'sẵn sàng',
    BORROWED: 'đang mượn',
    RETIRED: 'thanh lý',
    LOST: 'mất',
    DAMAGED: 'hỏng',
  };

  const readerBlocked =
    Number(readerProfile?.total_fines) > 0 || Boolean(readerProfile?.is_borrowing_blocked);

  const handleBorrowScan = async (code) => {
    const targetCode = String(code || '').trim();
    if (!targetCode) {
      showToast('Vui lòng quét mã vạch sách mượn rồi nhấn phím Enter.', 'warning');
      return;
    }
    if (readerBlocked) {
      showToast('Bạn đọc đang nợ hoặc bị khóa mượn. Thu đủ phạt trước khi xuất phiếu.', 'error');
      return;
    }
    if (borrowBooks.some((b) => b.barcode === targetCode)) {
      showToast(`Mã vạch ${targetCode} đã có trong phiếu.`, 'warning');
      return;
    }
    setIsBorrowLoading(true);
    try {
      const { data } = await axiosInstance.get('/api/admin/loans/copy', {
        params: { barcode: targetCode },
      });
      if (data.status !== 'AVAILABLE') {
        showToast(
          `${data.copy_barcode} đang ${copyStatusVi[data.status] || data.status}. Chỉ xuất được bản Sẵn sàng.`,
          'error'
        );
        return;
      }
      const match = pendingLoans.find(
        (loan) =>
          loan.book_id === data.book_id && !borrowBooks.some((book) => book.loanId === loan.id)
      );
      setBorrowBooks((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: data.book_title || `Sách ${data.copy_barcode}`,
          barcode: data.copy_barcode,
          loanId: match?.id,
        },
      ]);
      showToast(
        match
          ? `Đã gắn ${data.copy_barcode} vào phiếu chờ #${match.id}.`
          : `Đã thêm ${data.copy_barcode}. Không có phiếu chờ — xuất trực tiếp tại quầy.`,
        'success'
      );
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không tìm thấy bản sao sách.'), 'error');
    } finally {
      setIsBorrowLoading(false);
    }
  };

  const confirmCheckin = async () => {
    const barcode = returnBarcode.trim();
    if (!barcode) {
      showToast('Thiếu mã vạch sách trả.', 'error');
      return;
    }
    const damaged = returnCondition === 'Hư hỏng / Mất sách';
    const lost = damaged && returnIssue === 'Mất sách';
    setIsConfirming(true);
    try {
      const payload = {
        copy_barcode: barcode,
        condition_notes: damaged
          ? `[${returnIssue}] ${returnNote.trim() || returnCondition}`
          : returnCondition,
        is_lost: lost,
        is_damaged: damaged && !lost,
      };
      if (damaged) {
        const penalty = Number(returnSlip?.book_price);
        if (Number.isFinite(penalty) && penalty > 0) {
          payload.damage_penalty = penalty;
        }
      }
      const res = await axiosInstance.post('/api/admin/loans/checkin', payload);
      const data = res.data || {};
      setShowReturnModal(false);
      setReturnBookScanned(false);
      setReturnSlip(null);
      setReturnBarcode('');
      setReturnCondition('Nguyên vẹn');
      setReturnNote('');
      showToast(data.message || 'Trả sách thành công.', 'success');
    } catch (error) {
      const msg = getApiErrorMessage(error, 'Trả sách thất bại.');
      const alreadyReturned =
        /không tìm thấy phiếu đang mượn|đã được trả|quá hạn cho mã vạch/i.test(msg);
      showToast(
        alreadyReturned
          ? `${msg} Có thể sách đã được trả — xuất mượn lại mã này hoặc lấy mã đang mượn khác ở Tồn kho.`
          : msg,
        'error'
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const confirmCheckout = async () => {
    const mssv = borrowUserId.trim();
    if (readerBlocked) {
      showToast('Bạn đọc đang nợ hoặc bị khóa mượn. Không xuất phiếu.', 'error');
      return;
    }
    if (!mssv || borrowBooks.length === 0) {
      showToast('Cần MSSV và ít nhất một mã vạch bản Sẵn sàng.', 'warning');
      return;
    }
    setIsConfirming(true);
    let ok = 0;
    const errors = [];
    for (const book of borrowBooks) {
      try {
        const payload = {
          copy_barcode: book.barcode,
          user_code: mssv,
          condition_notes: checkoutConditionNotes.trim() || null,
        };
        if (book.loanId) payload.loan_id = book.loanId;
        await axiosInstance.post('/api/admin/loans/checkout', payload);
        ok += 1;
      } catch (error) {
        errors.push(`${book.barcode}: ${getApiErrorMessage(error, 'lỗi')}`);
      }
    }
    const totalTried = borrowBooks.length;
    setIsConfirming(false);
    if (ok > 0) {
      setShowBorrowModal(false);
      setBorrowBooks([]);
      setBorrowUserId('');
      setUserValidated(false);
      setReaderProfile(null);
      setPendingLoans([]);
      setCheckoutConditionNotes('');
      showToast(`Xuất mượn thành công ${ok}/${totalTried} cuốn.`, 'success');
    }
    if (errors.length) {
      showToast(errors.slice(0, 2).join(' | '), 'error');
    }
  };

  const panelShell =
    'bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0 md:min-h-[32rem] lg:min-h-[36rem]';

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-8 sm:pb-10 px-0">
      <Toast toast={toast} onClose={hideToast} />

      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
          Quản lý Mượn / Trả Sách
        </h1>
        <p className="text-sm text-slate-500 max-w-2xl">
          Nhận trả: quét mã vạch trên sách đang mượn.<br />Xuất mượn: tra MSSV rồi quét bản sẵn sàng, gồm phiếu đã đặt hoặc mượn thẳng tại quầy.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 items-stretch">
        {/* 1 — Check-in */}
        <section className={panelShell} aria-labelledby="loan-checkin-title">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
              1
            </div>
            <div className="min-w-0">
              <h2 id="loan-checkin-title" className="text-base sm:text-lg font-bold text-slate-800">
                Quầy Nhận Trả Sách
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Quét mã vạch bản đang mượn / quá hạn → xác nhận tình trạng
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex-1 flex flex-col gap-4 sm:gap-5">
            <FastBarcodeScanner
              label="Quét mã vạch sách trả"
              placeholder="Quét mã vạch đang mượn - Enter"
              value={returnBarcode}
              onChange={(e) => {
                const next = e.target.value;
                setReturnBarcode(next);
                setReturnHint('');
                if (returnSlip && next.trim() !== returnSlip.copy_barcode) {
                  setReturnSlip(null);
                  setReturnBookScanned(false);
                }
              }}
              onScan={(scannedCode) => {
                setReturnBarcode(scannedCode);
                handleReturnScan(scannedCode);
              }}
              loading={isReturnLoading}
              buttonText="Kiểm tra"
              autoFocus
              autoClear={false}
              autoRefocus
              helperText="Quét mã vạch trên sách, hoặc nhập MSSV để lấy cuốn đang mượn."
            />

            {returnBookScanned ? (
              <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-11 h-14 sm:w-12 sm:h-16 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center shrink-0">
                    <Book className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                        {returnSlip?.full_name || 'Người trả'}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        returnSlip?.overdue
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {returnSlip?.overdue ? 'Quá hạn' : 'Đang mượn'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-mono mt-1">{returnSlip?.user_code || '—'}</p>
                    <p className="text-xs text-slate-700 mt-1.5 leading-snug">{returnSlip?.book_title || '—'}</p>
                    <p className="text-xs text-slate-500 mt-1 font-mono break-all">
                      Mã vạch: {returnSlip?.copy_barcode || returnBarcode}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Hạn trả: <span className={returnSlip?.overdue ? 'text-rose-700 font-semibold' : 'text-slate-700 font-medium'}>{formatLoanDate(returnSlip?.due_date)}</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
                <p className="text-sm font-medium text-slate-600">
                  {returnHint || 'Chưa có mã trả'}
                </p>
                {!returnHint && (
                  <p className="text-xs text-slate-400 mt-1">Quét mã vạch hoặc nhập MSSV để hiện thẻ xác nhận.</p>
                )}
              </div>
            )}

            <div>
              <p className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                Tình trạng khi trả
              </p>
              <div className="grid grid-cols-1 gap-2">
                <label
                  className={`flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border-2 cursor-pointer touch-manipulation ${
                    returnCondition === 'Nguyên vẹn'
                      ? 'border-indigo-500 bg-indigo-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="condition"
                    checked={returnCondition === 'Nguyên vẹn'}
                    onChange={() => setReturnCondition('Nguyên vẹn')}
                    className="mt-0.5 w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">Nguyên vẹn</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Không rách / hỏng — trả về kho sẵn sàng
                    </span>
                  </span>
                </label>
                <label
                  className={`flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border-2 cursor-pointer touch-manipulation ${
                    returnCondition === 'Hư hỏng / Mất sách'
                      ? 'border-indigo-500 bg-indigo-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="condition"
                    checked={returnCondition === 'Hư hỏng / Mất sách'}
                    onChange={() => setReturnCondition('Hư hỏng / Mất sách')}
                    className="mt-0.5 w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span>
                    <span className="block text-sm font-bold text-rose-600">Hư hỏng / Mất sách</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Lập bồi thường (có thể sang Báo mất / Hỏng)
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-auto pt-2 sm:pt-3 sticky bottom-0 bg-white/95 backdrop-blur-sm pb-0.5 -mx-1 px-1 sm:static sm:bg-transparent sm:backdrop-blur-none">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!returnSlip}
                icon={<CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />}
                onClick={() => setShowReturnModal(true)}
              >
                Xác nhận trả sách
              </Button>
            </div>
          </div>
        </section>

        {/* 2 — Check-out */}
        <section className={panelShell} aria-labelledby="loan-checkout-title">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
              2
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="loan-checkout-title" className="text-base sm:text-lg font-bold text-slate-800">
                  Quầy Xuất Phiếu Mượn
                </h2>
                {borrowBooks.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {borrowBooks.length} cuốn trên phiếu
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tra MSSV → quét mã vạch sẵn sàng → xuất mượn
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex-1 flex flex-col gap-4 sm:gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                MSSV / mã bạn đọc
              </label>
              <div className="flex items-stretch gap-2 min-w-0">
                <div className="relative min-w-0 flex-1">
                  <Input
                    type="text"
                    placeholder="Nhập mã bạn đọc / MSSV - Enter"
                    leftIcon={<User className="w-5 h-5" />}
                    className="!h-11 font-mono text-sm"
                    value={borrowUserId}
                    onChange={(e) => {
                      setBorrowUserId(e.target.value);
                      if (userValidated) {
                        setUserValidated(false);
                        setReaderProfile(null);
                        setPendingLoans([]);
                        setBorrowBooks([]);
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleUserScan()}
                    disabled={isUserLoading}
                  />
                  {isUserLoading && (
                    <div className="absolute right-3 top-3 w-5 h-5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="primary"
                  className="!h-11 shrink-0 px-3 sm:px-4"
                  icon={<Search className="w-4 h-4" />}
                  disabled={isUserLoading}
                  onClick={() => handleUserScan()}
                  aria-label="Tra cứu bạn đọc"
                >
                  Tra cứu
                </Button>
              </div>
            </div>

            {!userValidated ? (
              <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center min-h-[12rem]">
                <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3">
                  <User className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Chưa tra cứu bạn đọc</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[16rem] leading-relaxed">
                  Nhập MSSV rồi bấm Tra cứu (không để trống). Sau đó mới quét sách vào phiếu.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-indigo-50 rounded-xl p-3.5 sm:p-4 border border-indigo-100 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold shrink-0 text-sm">
                      {(borrowUserId || 'U').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm flex flex-wrap items-center gap-2">
                        {readerProfile?.full_name || 'Người mượn'}
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">
                          Có trong hệ thống
                        </span>
                      </p>
                      <p className="text-xs text-slate-600 font-mono mt-0.5 truncate">{readerProfile?.user_code || borrowUserId}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {pendingLoans.length} phiếu chờ xuất
                        {readerBlocked ? ' · đang nợ hoặc khóa mượn' : ''}
                      </p>
                    </div>
                  </div>

                  {pendingLoans.length > 0 ? (
                    <div className="space-y-2 max-h-36 sm:max-h-40 overflow-y-auto overscroll-contain pr-0.5">
                      {pendingLoans.slice(0, 8).map((loan) => (
                        <div
                          key={loan.id}
                          className="bg-white/90 rounded-lg border border-indigo-100 px-3 py-2 text-xs"
                        >
                          <div className="flex justify-between gap-2 items-start">
                            <p className="font-semibold text-slate-800 leading-snug break-words min-w-0">
                              {loan.book_title || `Book #${loan.book_id || '—'}`}
                            </p>
                            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {loanStatusLabel(loan.loan_status)}
                            </span>
                          </div>
                          <p className="text-slate-500 font-mono mt-1 break-all">
                            Phiếu #{loan.id}
                            {loan.copy_barcode ? ` · BC: ${loan.copy_barcode}` : ''}
                          </p>
                          <p className="text-slate-400 mt-0.5">
                            Mượn: {formatLoanDate(loan.borrow_date)} · Hạn:{' '}
                            {formatLoanDate(loan.due_date)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                      Không có phiếu chờ nhận. Quét đúng mã vạch bản Sẵn sàng để xuất mượn trực tiếp tại quầy.
                    </p>
                  )}
                </div>

                {readerBlocked ? (
                  <p className="text-sm text-rose-800 bg-rose-50 border border-rose-100 rounded-xl px-3 py-3 leading-relaxed">
                    Bạn đọc này còn nợ hoặc bị khóa mượn. Không được xuất phiếu. Hãy sang trang Thu phạt để thu đủ rồi tra lại.
                  </p>
                ) : (
                <FastBarcodeScanner
                  label="Quét mã vạch sách mượn"
                  placeholder="Enter để thêm vào phiếu"
                  onScan={(scannedCode) => handleBorrowScan(scannedCode)}
                  loading={isBorrowLoading}
                  autoFocus
                  autoClear
                  autoRefocus
                  buttonText="Thêm"
                  helperText="Chỉ mã vạch bản Sẵn sàng, không nhập mã phiếu. Mã lạ hoặc bản đã thanh lý không vào phiếu."
                />
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ghi chú khi giao (tuỳ chọn)
                  </label>
                  <Input
                    type="text"
                    placeholder="VD: Bìa hơi cong…"
                    className="!h-10"
                    value={checkoutConditionNotes}
                    onChange={(e) => setCheckoutConditionNotes(e.target.value)}
                  />
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto overscroll-contain">
                  {borrowBooks.map((book, index) => (
                    <div
                      key={book.id}
                      className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5 text-indigo-600 text-xs font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{book.title}</p>
                        <p className="text-xs text-slate-500 font-mono break-all">
                          {book.barcode}
                          {book.loanId ? ` · phiếu #${book.loanId}` : ''}
                        </p>
                      </div>
                      <AdminIconButton
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-400 transition-colors shrink-0 touch-manipulation"
                        title="Xóa khỏi phiếu"
                        onClick={() =>
                          setBorrowBooks((prev) => prev.filter((b) => b.id !== book.id))
                        }
                      >
                        <X className="w-3.5 h-3.5" />
                      </AdminIconButton>
                    </div>
                  ))}
                  {borrowBooks.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-5 border border-dashed border-slate-200 rounded-xl">
                      Chưa có sách trên phiếu
                    </p>
                  )}
                </div>

                <div className="mt-auto pt-2 sm:pt-3 sticky bottom-0 bg-white/95 backdrop-blur-sm pb-0.5 -mx-1 px-1 sm:static sm:bg-transparent sm:backdrop-blur-none space-y-2">
                  <div className="px-0.5">
                    <span className="text-sm font-bold text-slate-700">
                      Tổng: <span className="text-indigo-600">{borrowBooks.length} cuốn</span>
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    icon={<CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />}
                    onClick={() => setShowBorrowModal(true)}
                    disabled={borrowBooks.length === 0 || readerBlocked}
                  >
                    Xác nhận xuất phiếu mượn
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <Modal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Xác nhận Trả sách"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowReturnModal(false)} disabled={isConfirming}>Hủy bỏ</Button>
            <Button variant="primary" onClick={confirmCheckin} disabled={isConfirming}>
              {isConfirming ? 'Đang xử lý…' : 'Xác nhận trả sách'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-sm font-bold text-slate-800 mb-1">
              {returnSlip?.full_name || 'Người trả'}
              {returnSlip?.overdue ? ' · Quá hạn' : ''}
            </h4>
            <div className="text-xs text-slate-500 space-y-1 font-medium">
              <p>MSSV: <span className="text-slate-700 font-mono">{returnSlip?.user_code || '—'}</span></p>
              <p>Sách: <span className="text-slate-700">{returnSlip?.book_title || '—'}</span></p>
              <p>Mã vạch: <span className="text-slate-700 font-mono">{returnSlip?.copy_barcode || returnBarcode}</span></p>
              <p>Hạn trả: <span className={returnSlip?.overdue ? 'text-rose-700 font-semibold' : 'text-slate-700'}>{formatLoanDate(returnSlip?.due_date)}</span></p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Tình trạng sách khi trả</label>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
              <label className="flex items-center gap-2 cursor-pointer touch-manipulation min-h-10">
                <input
                  type="radio"
                  name="returnCondition"
                  value="Nguyên vẹn"
                  checked={returnCondition === 'Nguyên vẹn'}
                  onChange={(e) => setReturnCondition(e.target.value)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">Nguyên vẹn</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer touch-manipulation min-h-10">
                <input
                  type="radio"
                  name="returnCondition"
                  value="Hư hỏng / Mất sách"
                  checked={returnCondition === 'Hư hỏng / Mất sách'}
                  onChange={(e) => setReturnCondition(e.target.value)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">Hư hỏng / Mất sách</span>
              </label>
            </div>
          </div>

          {returnCondition === 'Hư hỏng / Mất sách' && (
            <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Loại vấn đề</label>
                <select 
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm"
                  value={returnIssue}
                  onChange={(e) => setReturnIssue(e.target.value)}
                >
                  <option>Rách bìa</option>
                  <option>Mất trang</option>
                  <option>Hư hỏng khác</option>
                  <option>Mất sách</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú chi tiết</label>
                <textarea 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm resize-none" 
                  rows="2"
                  placeholder="Mô tả chi tiết tình trạng hư hỏng..."
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                ></textarea>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Borrow Confirmation Modal */}
      <Modal
        isOpen={showBorrowModal}
        onClose={() => setShowBorrowModal(false)}
        title="Xác nhận Xuất phiếu mượn"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowBorrowModal(false)} disabled={isConfirming}>Hủy bỏ</Button>
            <Button variant="primary" onClick={confirmCheckout} disabled={isConfirming}>
              {isConfirming ? 'Đang xử lý…' : 'Xác nhận xuất mượn'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 mb-4">Xuất mượn từng mã vạch (cần phiếu chờ xuất / chờ nhận khớp đầu sách):</p>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
            {(borrowUserId || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">MSSV / mã độc giả</p>
            <p className="text-xs font-mono text-slate-500">{borrowUserId}</p>
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-2">Số lượng tài liệu: <span className="text-indigo-600 font-bold">{borrowBooks.length} cuốn</span></p>
        {checkoutConditionNotes.trim() && (
          <p className="text-xs text-slate-500 mb-3 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            Ghi chú tình trạng: <span className="text-slate-700 font-medium">{checkoutConditionNotes.trim()}</span>
          </p>
        )}
        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
          {borrowBooks.map((b, i) => (
            <div key={b.id || i} className="text-xs text-slate-600 font-medium pb-2 border-b border-slate-100 last:border-0 last:pb-0">
              {i + 1}. {b.title}{' '}
              <span className="text-slate-400 font-normal">
                ({b.barcode}{b.loanId ? ` · phiếu #${b.loanId}` : ''})
              </span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
