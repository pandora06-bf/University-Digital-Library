import { useState } from 'react';
import { 
  ArrowDownToLine, ArrowUpFromLine, AlertCircle,
  Book, User, CheckCircle2, X, Circle
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { FastBarcodeScanner } from '../../components/FastBarcodeScanner';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import axiosInstance from '../../services/axios_instance';
import { getApiErrorMessage } from '../../services/errorHandler';

export default function LoanManagement() {
  const { toast, showToast, hideToast } = useToast();
  const [returnBarcode, setReturnBarcode] = useState('');
  const [borrowUserId, setBorrowUserId] = useState('');
  const [borrowBarcode, setBorrowBarcode] = useState('');
  
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
  const [historyFilter, setHistoryFilter] = useState('Tất cả');
  const [historyData, setHistoryData] = useState([]);

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

  const historyColumns = [
    {
      key: 'id',
      header: 'Mã Giao Dịch',
      render: (value, row) => (
        <span className="font-mono font-bold text-slate-700">{row.id}</span>
      )
    },
    {
      key: 'type',
      header: 'Hành Động',
      render: (value, row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
          row.type === 'Mượn' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-blue-50 text-blue-600 border-blue-100'
        }`}>
          {row.type} sách
        </span>
      )
    },
    {
      key: 'book',
      header: 'Tên Sách / Barcode',
      render: (value, row) => {
        const parts = row.book.split(' (');
        return (
          <div className="min-w-[200px]">
            <span className="font-bold text-slate-800 block truncate max-w-[250px]">{parts[0]}</span>
            <span className="text-xs text-slate-400 font-mono block mt-0.5">{parts[1] ? parts[1].replace(')', '') : ''}</span>
          </div>
        );
      }
    },
    {
      key: 'user',
      header: 'Độc giả',
      render: (value, row) => {
        const parts = row.user.split(' (');
        return (
          <div className="min-w-[150px]">
            <span className="font-semibold text-slate-700 block">{parts[0]}</span>
            <span className="text-xs text-slate-400 font-mono block mt-0.5">{parts[1] ? parts[1].replace(')', '') : ''}</span>
          </div>
        );
      }
    },
    {
      key: 'staff',
      header: 'Nhân viên ca',
      render: (value, row) => {
        const parts = row.time.split(' - ');
        return (
          <div className="min-w-[120px]">
            <span className="font-medium text-slate-600 block">{row.staff}</span>
            <span className="text-xs text-slate-400 block mt-0.5">{parts[0]}</span>
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      render: (value, row) => {
        if (row.status === 'Đang mượn') {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white border border-amber-400 text-amber-600 shadow-sm whitespace-nowrap">
              <Circle className="w-2 h-2 fill-current" />
              {row.status}
            </span>
          );
        }
        if (row.status === 'Đã trả') {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white border border-emerald-400 text-emerald-600 shadow-sm whitespace-nowrap">
              <Circle className="w-2 h-2 fill-current" />
              {row.status}
            </span>
          );
        }
        if (row.status === 'Quá hạn') {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white border border-rose-400 text-rose-600 shadow-sm whitespace-nowrap">
              <Circle className="w-2 h-2 fill-current" />
              {row.status}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 whitespace-nowrap">
            {row.status}
          </span>
        );
      }
    }
  ];

  const pushHistory = (row) => setHistoryData((prev) => [row, ...prev]);

  const handleReturnScan = (code) => {
    const targetCode = (typeof code === 'string' ? code : returnBarcode).trim();
    if (!targetCode) {
      showToast('Vui lòng quét hoặc nhập mã vạch sách trả rồi nhấn phím Enter.', 'warning');
      return;
    }
    setReturnBarcode(targetCode);
    setReturnBookScanned(true);
    showToast(`Đã nhận mã vạch trả: ${targetCode}. Bấm xác nhận để nhận sách.`, 'success');
  };

  const handleUserScan = async () => {
    const mssv = borrowUserId.trim();
    if (!mssv) {
      showToast('Vui lòng nhập MSSV / thẻ độc giả rồi nhấn phím Enter.', 'warning');
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
    const targetCode = (typeof code === 'string' ? code : borrowBarcode).trim();
    if (!targetCode) {
      showToast('Vui lòng quét mã vạch sách mượn rồi nhấn phím Enter.', 'warning');
      return;
    }
    if (borrowBooks.some((b) => b.barcode === targetCode)) {
      showToast(`Barcode ${targetCode} đã có trong phiếu.`, 'warning');
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
    setBorrowBarcode('');
    setIsBorrowLoading(false);
    showToast(`Đã thêm ${targetCode} vào phiếu mượn.`, 'success');
  };

  const confirmCheckin = async () => {
    const barcode = returnBarcode.trim();
    if (!barcode) {
      showToast('Thiếu barcode sách trả.', 'error');
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
      pushHistory({
        id: `IN-${data.loan_id || barcode}`,
        type: 'Trả',
        book: `${barcode}`,
        user: '—',
        time: new Date().toLocaleString('vi-VN'),
        staff: 'Quầy thủ thư',
        status: 'Đã trả',
      });
      setShowReturnModal(false);
      setReturnBookScanned(false);
      setReturnBarcode('');
      setReturnCondition('Nguyên vẹn');
      setReturnNote('');
      showToast(data.message || 'Check-in thành công!', 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Check-in thất bại.'), 'error');
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
        const res = await axiosInstance.post('/api/admin/loans/checkout', payload);
        const d = res.data?.data || {};
        ok += 1;
        pushHistory({
          id: `OUT-${d.loan_id || book.barcode}`,
          type: 'Mượn',
          book: `${d.book_id ? `Sách #${d.book_id}` : book.title} (${book.barcode})`,
          user: `${mssv}`,
          time: new Date().toLocaleString('vi-VN'),
          staff: 'Quầy thủ thư',
          status: 'Đang mượn',
        });
      } catch (error) {
        errors.push(`${book.barcode}: ${getApiErrorMessage(error, 'lỗi')}`);
      }
    }
    setIsConfirming(false);
    if (ok > 0) {
      setShowBorrowModal(false);
      setBorrowBooks([]);
      setBorrowUserId('');
      setUserValidated(false);
      setPendingLoans([]);
      setCheckoutConditionNotes('');
      showToast(`Check-out thành công ${ok}/${borrowBooks.length} cuốn.`, 'success');
    }
    if (errors.length) {
      showToast(errors.slice(0, 2).join(' | '), 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <Toast toast={toast} onClose={hideToast} />
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Mượn / Trả Sách</h1>
          <p className="text-sm text-slate-500 mt-1">
            Quầy xuất mượn và nhận trả sách: quét mã vạch rồi xác nhận giao / nhận sách cho bạn đọc.
          </p>
        </div>
        
        {/* Thống kê phiên làm việc (không có API báo cáo ngày) */}
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm overflow-x-auto w-full lg:w-auto hide-scrollbar">
          <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-100">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <ArrowUpFromLine className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Mượn (phiên này)</p>
              <p className="text-lg font-extrabold text-emerald-800 leading-none mt-0.5">
                {historyData.filter((h) => h.type === 'Mượn').length}{' '}
                <span className="text-xs font-semibold text-emerald-600">phiếu</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <ArrowDownToLine className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Trả (phiên này)</p>
              <p className="text-lg font-extrabold text-blue-800 leading-none mt-0.5">
                {historyData.filter((h) => h.type === 'Trả').length}{' '}
                <span className="text-xs font-semibold text-blue-600">phiếu</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 px-4 py-2 bg-rose-50 rounded-lg border border-rose-100">
            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Chờ xuất trên quầy</p>
              <p className="text-lg font-extrabold text-rose-800 leading-none mt-0.5">
                {borrowBooks.length}{' '}
                <span className="text-xs font-semibold text-rose-600">cuốn</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid for Counters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Return Counter */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
          <div className="p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">1</div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Quầy Nhận Trả Sách Nhanh</h2>
              <p className="text-xs text-slate-500">Xử lý sách trả lại và cập nhật tình trạng tài sản</p>
            </div>
          </div>
          
          <div className="p-6 flex-1 flex flex-col gap-5">
            {/* Fast Barcode Scanner Component cho sách trả */}
            <FastBarcodeScanner
              label="Quét Barcode sách trả"
              placeholder="Quét Barcode sách trả (VD: BC-2024-0891)..."
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
              helperText="Tự focus ô nhập — tít mã hoặc nhấn phím Enter để nhận diện sách trả."
            />

            {/* Scanned Book Info Card */}
            {returnBookScanned && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-4">
                <div className="w-12 h-16 bg-white rounded shadow-sm border border-slate-200 flex items-center justify-center shrink-0">
                  <Book className="w-6 h-6 text-indigo-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-800 text-base leading-tight">Bản sao đã quét</h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 shrink-0">Chờ check-in</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono">Barcode: {returnBarcode}</p>
                  <p className="text-xs text-slate-500 mt-2">Xác nhận sẽ nhận trả sách đang mượn hoặc quá hạn theo mã vạch này.</p>
                </div>
              </div>
            </div>
            )}

            {/* Condition Check */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Tình trạng tài liệu khi trả lại</label>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer ${returnCondition === 'Nguyên vẹn' ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="condition"
                    checked={returnCondition === 'Nguyên vẹn'}
                    onChange={() => setReturnCondition('Nguyên vẹn')}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-800">Nguyên vẹn</p>
                    <p className="text-xs text-slate-500">Sách hoàn chỉnh, không rách nát và hư hỏng</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer ${returnCondition === 'Hư hỏng / Mất sách' ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="condition"
                    checked={returnCondition === 'Hư hỏng / Mất sách'}
                    onChange={() => setReturnCondition('Hư hỏng / Mất sách')}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <div>
                    <p className="text-sm font-bold text-rose-600">Hư hỏng / Mất sách</p>
                    <p className="text-xs text-slate-500">Chuyển hồ sơ bồi thường, gửi thu phí</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Action Button */}
            {returnBookScanned && (
              <div className="mt-auto pt-4">
                <Button 
                  variant="primary" 
                  size="lg" 
                  fullWidth 
                  icon={<CheckCircle2 className="w-6 h-6" />}
                  onClick={() => setShowReturnModal(true)}
                >
                  Xác nhận trả sách
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Borrow Counter */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
          <div className="p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">2</div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Quầy Xuất Phiếu Mượn</h2>
              <p className="text-xs text-slate-500">Tạo phiếu lưu thông mượn sách cho độc giả</p>
            </div>
          </div>
          
          <div className="p-6 flex-1 flex flex-col gap-5">
            {/* User ID Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nhập MSSV / Thẻ độc giả</label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Nhập và nhấn phím Enter…"
                  leftIcon={<User className="w-5 h-5" />}
                  className="!h-11 font-mono"
                  value={borrowUserId}
                  onChange={(e) => setBorrowUserId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUserScan()}
                  disabled={isUserLoading}
                />
                {isUserLoading && (
                  <div className="absolute right-3 top-3 w-5 h-5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin"></div>
                )}
              </div>
            </div>

            {/* User Validated Info */}
            {userValidated && (
              <>
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                      {(borrowUserId || 'U').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm flex flex-wrap items-center gap-2">
                        Người mượn
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">Đã tra cứu</span>
                      </p>
                      <p className="text-xs text-slate-600 font-mono mt-0.5">MSSV / mã: {borrowUserId}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {pendingLoans.length} phiếu từ kết quả tra cứu
                        {' · '}
                        {pendingLoans.filter((l) => ['REQUESTED', 'PENDING_PICKUP'].includes(l.loan_status)).length} chờ xuất
                      </p>
                    </div>
                  </div>

                  {pendingLoans.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {pendingLoans.slice(0, 8).map((loan) => (
                        <div
                          key={loan.id}
                          className="bg-white/90 rounded-lg border border-indigo-100 px-3 py-2 text-xs"
                        >
                          <div className="flex justify-between gap-2 items-start">
                            <p className="font-semibold text-slate-800 leading-snug">
                              {loan.book_title || `Book #${loan.book_id || '—'}`}
                            </p>
                            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {loanStatusLabel(loan.loan_status)}
                            </span>
                          </div>
                          <p className="text-slate-500 font-mono mt-1">
                            Phiếu #{loan.id}
                            {loan.copy_barcode ? ` · BC: ${loan.copy_barcode}` : ''}
                          </p>
                          <p className="text-slate-400 mt-0.5">
                            Mượn: {formatLoanDate(loan.borrow_date)} · Hạn: {formatLoanDate(loan.due_date)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      Không có phiếu trong kết quả tra cứu. Vẫn có thể thử xuất mượn nếu có phiếu chờ nhận khớp mã vạch.
                    </p>
                  )}
                </div>

                <FastBarcodeScanner
                  label="Quét Barcode sách mượn"
                  placeholder="Quét Barcode cuốn sách muốn mượn (tít liên tục)..."
                  onScan={(scannedCode) => handleBorrowScan(scannedCode)}
                  loading={isBorrowLoading}
                  autoFocus
                  autoClear
                  autoRefocus
                  buttonText="Thêm"
                  helperText="Tự focus sau khi tra MSSV — quét liên tục không cần chuột."
                />

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ghi chú tình trạng khi giao
                  </label>
                  <Input
                    type="text"
                    placeholder="VD: Bìa hơi cong, có dấu ghi chú trang 12…"
                    className="!h-10"
                    value={checkoutConditionNotes}
                    onChange={(e) => setCheckoutConditionNotes(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Ghi kèm khi xuất mượn. Để trống nếu sách nguyên vẹn.</p>
                </div>

                <div className="space-y-2">
                  {borrowBooks.map((book, index) => (
                    <div key={book.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white group hover:border-indigo-300 transition-colors animate-in fade-in">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5 text-indigo-600 text-xs font-bold">{index + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{book.title}</p>
                        <p className="text-xs text-slate-500 font-mono">
                          Barcode: {book.barcode}
                          {book.loanId ? ` · gắn phiếu #${book.loanId}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="w-6 h-6 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center text-slate-400 transition-colors shrink-0"
                        onClick={() => setBorrowBooks((prev) => prev.filter((b) => b.id !== book.id))}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {borrowBooks.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">Chưa có sách nào được quét.</p>
                  )}
                </div>

                <div className="mt-auto pt-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-sm font-bold text-slate-700">
                      Tổng cộng: <span className="text-indigo-600">{borrowBooks.length} cuốn</span>
                    </span>
                    <span className="text-xs font-medium text-slate-500">Hạn mặc định BE: +14 ngày</span>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    icon={<CheckCircle2 className="w-6 h-6" />}
                    onClick={() => setShowBorrowModal(true)}
                    disabled={borrowBooks.length === 0}
                  >
                    Xác nhận xuất phiếu mượn
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Transaction History Table */}
      <Table 
        title="Lịch sử giao dịch trong ca trực hôm nay"
        subtitle="Danh sách cập nhật các giao dịch mượn và trả theo thời gian thực"
        data={historyFilter === 'Tất cả' ? historyData : historyData.filter(h => h.type + ' sách' === historyFilter)}
        columns={historyColumns}
        actions={
          <>
            <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`!h-7 !px-3 !text-xs !rounded-md shadow-sm ${historyFilter === 'Tất cả' ? '!bg-white !text-slate-800' : '!bg-transparent !text-slate-500 hover:!text-slate-800 hover:!bg-white/50'}`}
                onClick={() => setHistoryFilter('Tất cả')}
              >
                Tất cả
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`!h-7 !px-3 !text-xs !rounded-md shadow-sm ${historyFilter === 'Mượn sách' ? '!bg-white !text-slate-800' : '!bg-transparent !text-slate-500 hover:!text-slate-800 hover:!bg-white/50'}`}
                onClick={() => setHistoryFilter('Mượn sách')}
              >
                Mượn sách
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`!h-7 !px-3 !text-xs !rounded-md shadow-sm ${historyFilter === 'Trả sách' ? '!bg-white !text-slate-800' : '!bg-transparent !text-slate-500 hover:!text-slate-800 hover:!bg-white/50'}`}
                onClick={() => setHistoryFilter('Trả sách')}
              >
                Trả sách
              </Button>
            </div>
          </>
        }
      />

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
            <h4 className="text-sm font-bold text-slate-800 mb-1">Check-in bản sao</h4>
            <div className="text-xs text-slate-500 space-y-1 font-medium">
              <p>Mã vạch: <span className="text-slate-700 font-mono">{returnBarcode}</span></p>
              <p>Hệ thống sẽ tìm phiếu đang mượn hoặc quá hạn theo mã vạch này.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Tình trạng sách khi trả</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
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
              <label className="flex items-center gap-2 cursor-pointer">
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
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ảnh tình trạng</label>
                <label className="flex items-center justify-between gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 cursor-pointer hover:bg-slate-100">
                  <span className="text-xs text-slate-600">Chọn ảnh tình trạng (tuỳ chọn)</span>
                  <span className="text-[11px] font-semibold text-indigo-600">Chọn ảnh</span>
                  <input type="file" accept="image/*" className="hidden" />
                </label>
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
              {isConfirming ? 'Đang xử lý…' : 'Xác nhận check-out'}
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
