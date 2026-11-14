import { useState } from 'react';
import { 
  Book, User, CheckCircle2, X, Search
} from 'lucide-react';
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
  const [returnBarcode, setReturnBarcode] = useState('');
  const [borrowUserId, setBorrowUserId] = useState('');

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);

  const [isUserLoading, setIsUserLoading] = useState(false);
  const [isBorrowLoading, setIsBorrowLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [userValidated, setUserValidated] = useState(false);
  const [pendingLoans, setPendingLoans] = useState([]);

  const [returnCondition, setReturnCondition] = useState('Nguyên vẹn');
  const [returnIssue, setReturnIssue] = useState('Rách bìa');
  const [returnNote, setReturnNote] = useState('');
  const [checkoutConditionNotes, setCheckoutConditionNotes] = useState('');

  const [returnBookScanned, setReturnBookScanned] = useState(false);
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

  const handleReturnScan = async (code) => {
    const targetCode = (typeof code === 'string' ? code : returnBarcode).trim();
    if (!targetCode) {
      showToast('Vui lòng quét hoặc nhập mã vạch sách trả rồi nhấn phím Enter.', 'warning');
      return;
    }

    // SV-DEMO-001 là mã bạn đọc — check-in API chỉ nhận mã vạch bản sao (DEMO-BC-…).
    if (looksLikeReaderCode(targetCode)) {
      try {
        const res = await axiosInstance.get('/api/admin/loans/lookup', {
          params: { q: targetCode },
        });
        const loans = res.data?.data || [];
        const active = loans.filter(
          (l) =>
            ['BORROWED', 'OVERDUE'].includes(String(l.loan_status || '').toUpperCase())
            && l.copy_barcode
        );
        if (!active.length) {
          setReturnBookScanned(false);
          setReturnBarcode('');
          showToast(
            `${targetCode} là mã bạn đọc, không phải mã vạch. Không tìm thấy phiếu đang mượn/quá hạn có mã vạch.`,
            'warning'
          );
          return;
        }
        const barcode = active[0].copy_barcode;
        setReturnBarcode(barcode);
        setReturnBookScanned(true);
        showToast(
          active.length === 1
            ? `Đã đổi ${targetCode} → mã vạch ${barcode}. Bấm xác nhận để trả.`
            : `${targetCode} có ${active.length} cuốn đang mượn — dùng ${barcode}. Trả lần lượt các mã còn lại.`,
          'success'
        );
      } catch (error) {
        showToast(
          getApiErrorMessage(
            error,
            `${targetCode} là mã bạn đọc. Hãy quét mã vạch trên sách, không nhập MSSV.`
          ),
          'error'
        );
      }
      return;
    }

    setReturnBarcode(targetCode);
    setReturnBookScanned(true);
    showToast(`Đã nhận mã vạch trả: ${targetCode}. Bấm xác nhận để nhận sách.`, 'success');
  };

  const handleUserScan = async () => {
    const mssv = borrowUserId.trim();
    if (!mssv) {
      showToast('Nhập MSSV rồi bấm Tra cứu (không để trống).', 'warning');
      return;
    }
    setIsUserLoading(true);
    setUserValidated(false);
    setPendingLoans([]);
    try {
      const res = await axiosInstance.get('/api/admin/loans/lookup', { params: { q: mssv } });
      const loans = res.data?.data || [];
      const pending = loans.filter((l) =>
        ['REQUESTED', 'PENDING_PICKUP'].includes(l.loan_status)
      );
      setPendingLoans(pending.length ? pending : loans);
      setUserValidated(true);
      showToast(
        pending.length
          ? `MSSV ${mssv}: ${pending.length} phiếu chờ xuất mượn.`
          : `MSSV ${mssv}: ${loans.length} phiếu (không có phiếu chờ nhận). Vẫn có thể thử xuất mượn.`,
        pending.length ? 'success' : 'warning'
      );
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không tra cứu được độc giả.'), 'error');
    } finally {
      setIsUserLoading(false);
    }
  };

  const handleBorrowScan = (code) => {
    const targetCode = String(code || '').trim();
    if (!targetCode) {
      showToast('Vui lòng quét mã vạch sách mượn rồi nhấn phím Enter.', 'warning');
      return;
    }
    if (borrowBooks.some((b) => b.barcode === targetCode)) {
      showToast(`Mã vạch ${targetCode} đã có trong phiếu.`, 'warning');
      return;
    }
    setIsBorrowLoading(true);
    const match = pendingLoans.find((l) => !borrowBooks.some((b) => b.loanId === l.id));
    setBorrowBooks((prev) => [
      ...prev,
      {
        id: Date.now(),
        title: match?.book_title || `Sách quét (${targetCode})`,
        barcode: targetCode,
        loanId: match?.id,
      },
    ]);
    setIsBorrowLoading(false);
    showToast(`Đã thêm ${targetCode} vào phiếu mượn.`, 'success');
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
      const res = await axiosInstance.post('/api/admin/loans/checkin', {
        copy_barcode: barcode,
        condition_notes: damaged
          ? `[${returnIssue}] ${returnNote.trim() || returnCondition}`
          : returnCondition,
        is_lost: lost,
        is_damaged: damaged && !lost,
      });
      const data = res.data || {};
      setShowReturnModal(false);
      setReturnBookScanned(false);
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
    if (!mssv || borrowBooks.length === 0) {
      showToast('Cần MSSV và ít nhất một barcode.', 'warning');
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
          Hai quầy độc lập: nhận trả bên trái, xuất mượn bên phải. Trên điện thoại xếp chồng theo thứ tự đó.
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
              placeholder="Quét mã vạch đang mượn — Enter để nhận mã"
              value={returnBarcode}
              onChange={(e) => setReturnBarcode(e.target.value)}
              onScan={(scannedCode) => {
                setReturnBarcode(scannedCode);
                handleReturnScan(scannedCode);
              }}
              loading={false}
              buttonText="Kiểm tra"
              autoFocus
              autoClear={false}
              autoRefocus
              helperText="Cần mã vạch trên sách (không phải MSSV). Nhập nhầm SV-… sẽ tự tìm mã vạch đang mượn."
            />

            {returnBookScanned ? (
              <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-11 h-14 sm:w-12 sm:h-16 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center shrink-0">
                    <Book className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <h3 className="font-bold text-slate-800 text-sm sm:text-base">Bản sao đã quét</h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        Chờ xác nhận trả
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-mono break-all">
                      Mã vạch: {returnBarcode}
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      Xác nhận sẽ nhận trả phiếu đang mượn hoặc quá hạn theo mã này.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
                <p className="text-sm font-medium text-slate-600">Chưa có mã trả</p>
                <p className="text-xs text-slate-400 mt-1">Quét barcode để hiện thẻ xác nhận.</p>
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
                disabled={!returnBookScanned}
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
                    placeholder="Nhập mã bạn đọc / MSSV"
                    leftIcon={<User className="w-5 h-5" />}
                    className="!h-11 font-mono text-sm"
                    value={borrowUserId}
                    onChange={(e) => {
                      setBorrowUserId(e.target.value);
                      if (userValidated) {
                        setUserValidated(false);
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
                  onClick={handleUserScan}
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
                        Người mượn
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">
                          Đã tra cứu
                        </span>
                      </p>
                      <p className="text-xs text-slate-600 font-mono mt-0.5 truncate">{borrowUserId}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {pendingLoans.length} phiếu ·{' '}
                        {
                          pendingLoans.filter((l) =>
                            ['REQUESTED', 'PENDING_PICKUP'].includes(l.loan_status)
                          ).length
                        }{' '}
                        chờ xuất
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
                      Không có phiếu chờ trong kết quả. Vẫn có thể thử xuất nếu barcode khớp phiếu chờ
                      nhận.
                    </p>
                  )}
                </div>

                <FastBarcodeScanner
                  label="Quét mã vạch sách mượn"
                  placeholder="Enter để thêm vào phiếu"
                  onScan={(scannedCode) => handleBorrowScan(scannedCode)}
                  loading={isBorrowLoading}
                  autoFocus
                  autoClear
                  autoRefocus
                  buttonText="Thêm"
                  helperText="Quét xong tự xóa ô để tít cuốn tiếp."
                />

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
                  <div className="flex flex-wrap justify-between items-center gap-1 px-0.5">
                    <span className="text-sm font-bold text-slate-700">
                      Tổng: <span className="text-indigo-600">{borrowBooks.length} cuốn</span>
                    </span>
                    <span className="text-[11px] text-slate-500">Hạn mặc định BE: +14 ngày</span>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    icon={<CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />}
                    onClick={() => setShowBorrowModal(true)}
                    disabled={borrowBooks.length === 0}
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
            <h4 className="text-sm font-bold text-slate-800 mb-1">Trả sách theo mã vạch</h4>
            <div className="text-xs text-slate-500 space-y-1 font-medium">
              <p>Mã vạch: <span className="text-slate-700 font-mono">{returnBarcode}</span></p>
              <p>Hệ thống sẽ tìm phiếu đang mượn hoặc quá hạn theo mã vạch này.</p>
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
