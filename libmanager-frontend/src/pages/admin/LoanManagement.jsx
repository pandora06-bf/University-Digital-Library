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

export default function LoanManagement() {
  const [returnBarcode, setReturnBarcode] = useState('');
  const [borrowUserId, setBorrowUserId] = useState('');
  const [borrowBarcode, setBorrowBarcode] = useState('');
  
  // Modals for confirmation
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);

  // Loading States for Mock API
  const [isReturnLoading, setIsReturnLoading] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [isBorrowLoading, setIsBorrowLoading] = useState(false);
  const [userValidated, setUserValidated] = useState(false); // default false

  // Return Condition States
  const [returnCondition, setReturnCondition] = useState('Nguyên vẹn');
  const [returnIssue, setReturnIssue] = useState('Rách bìa');
  const [returnNote, setReturnNote] = useState('');

  // Functional Mock States
  const [returnBookScanned, setReturnBookScanned] = useState(false);
  const [borrowBooks, setBorrowBooks] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('Tất cả'); // 'Tất cả' | 'Mượn sách' | 'Trả sách'
  
  // Mock data for history table
  const historyData = [
    { id: 'TX-8821', type: 'Mượn', book: 'Cấu trúc dữ liệu và Giải thuật (00-2024-8901)', user: 'Trần Quốc Bảo (50214569)', time: '10:24 AM - 15/09/2026', staff: 'Nguyễn Quản Trị', status: 'Đang mượn' },
    { id: 'TX-8820', type: 'Trả', book: 'Kỹ thuật Lập trình Hệ thống (00-2024-4902)', user: 'Hoàng Minh Đức (50198822)', time: '10:15 AM - 15/09/2026', staff: 'Nguyễn Quản Trị', status: 'Đã trả' },
    { id: 'TX-8819', type: 'Mượn', book: 'Thiết kế Cơ sở Dữ liệu Quan hệ SQL (00-2024-6991)', user: 'Phạm Thúy Vy (50201111)', time: '09:58 AM - 15/09/2026', staff: 'Trần Đình Tuấn', status: 'Quá hạn' },
    { id: 'TX-8818', type: 'Trả', book: 'Nhập môn Trí tuệ Nhân tạo & Học máy (00-2024-8111)', user: 'Lê Thị Mai Hương (50221320)', time: '09:30 AM - 15/09/2026', staff: 'Trần Đình Tuấn', status: 'Đã trả' },
  ];

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

  // Mock API Handlers
  const handleReturnScan = (code) => {
    const targetCode = (typeof code === 'string' ? code : returnBarcode).trim();
    if (!targetCode) return;
    setIsReturnLoading(true);
    setReturnBookScanned(false);
    setTimeout(() => {
      setIsReturnLoading(false);
      setReturnBookScanned(true);
    }, 600);
  };

  const handleUserScan = () => {
    if (!borrowUserId) return;
    setIsUserLoading(true);
    setUserValidated(false);
    setTimeout(() => {
      setIsUserLoading(false);
      setUserValidated(true);
    }, 600);
  };

  const handleBorrowScan = (code) => {
    const targetCode = (typeof code === 'string' ? code : borrowBarcode).trim();
    if (!targetCode) return;
    setIsBorrowLoading(true);
    setTimeout(() => {
      setIsBorrowLoading(false);
      setBorrowBooks(prev => [...prev, { 
        id: Date.now(), 
        title: 'Tài liệu mới quét (' + targetCode + ')', 
        barcode: targetCode 
      }]);
      setBorrowBarcode('');
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Mượn / Trả Sách</h1>
          <p className="text-sm text-slate-500 mt-1">Hệ thống quản lý giao dịch lưu thông tài liệu thư viện trực tiếp</p>
        </div>
        
        {/* Top Stats */}
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm overflow-x-auto w-full lg:w-auto hide-scrollbar">
          <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-100">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <ArrowUpFromLine className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Mượn hôm nay</p>
              <p className="text-lg font-extrabold text-emerald-800 leading-none mt-0.5">142 <span className="text-xs font-semibold text-emerald-600">phiếu</span></p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <ArrowDownToLine className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Trả hôm nay</p>
              <p className="text-lg font-extrabold text-blue-800 leading-none mt-0.5">105 <span className="text-xs font-semibold text-blue-600">phiếu</span></p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 px-4 py-2 bg-rose-50 rounded-lg border border-rose-100">
            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Chờ xử lý / Quá hạn</p>
              <p className="text-lg font-extrabold text-rose-800 leading-none mt-0.5">12 <span className="text-xs font-semibold text-rose-600">phiếu</span></p>
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
              placeholder="Quét mã vạch sách trả (VD: BC-2024-0891)..."
              value={returnBarcode}
              onChange={(e) => setReturnBarcode(e.target.value)}
              onScan={(scannedCode) => {
                setReturnBarcode(scannedCode);
                handleReturnScan(scannedCode);
              }}
              loading={isReturnLoading}
              buttonText="Kiểm tra"
              autoClear={false}
              helperText="Tít mã vạch bằng máy quét hoặc nhấn Enter để nhận diện sách trả."
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
                    <h3 className="font-bold text-slate-800 text-base leading-tight">Cấu trúc dữ liệu và Giải thuật</h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 shrink-0">Đang mượn (Còn 3 ngày)</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono">Barcode: BC-2024-8901</p>
                  
                  <div className="flex items-center gap-2 mt-3 text-sm">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                      <User className="w-3 h-3 text-slate-500" />
                    </div>
                    <span className="font-medium text-slate-700">Trần Quốc Bảo</span>
                    <span className="text-slate-400 font-mono text-xs">(50214569)</span>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Condition Check */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Tình trạng tài liệu khi trả lại</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-indigo-500 bg-indigo-50/50 cursor-pointer">
                  <input type="radio" name="condition" defaultChecked className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">Nguyên vẹn</p>
                    <p className="text-xs text-slate-500">Sách hoàn chỉnh, không rách nát và hư hỏng</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input type="radio" name="condition" className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300" />
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
                  placeholder="Nhập và nhấn Enter..."
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
                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 flex justify-between items-center animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
                      LM
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        Lê Thị Mai Hương
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">Hợp lệ</span>
                      </p>
                      <p className="text-xs text-slate-500 font-mono">MSSV: 50221320 • K25 CNTT</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">Đang mượn: <span className="font-bold text-slate-700">1/5 cuốn</span></p>
                    <p className="text-[10px] text-slate-500">Vi phạm: <span className="font-bold text-emerald-600">0</span></p>
                  </div>
                </div>

                {/* Fast Barcode Scanner cho mượn sách liên tục */}
                <FastBarcodeScanner
                  label="Quét Barcode sách mượn"
                  placeholder="Quét Barcode cuốn sách muốn mượn (tít liên tục)..."
                  onScan={(scannedCode) => handleBorrowScan(scannedCode)}
                  loading={isBorrowLoading}
                  autoClear={true}
                  buttonText="Thêm"
                  helperText="Hỗ trợ máy tít quét liên tục nhiều cuốn sách vào phiếu mượn."
                />

            {/* List of scanned books to borrow */}
            <div className="space-y-2">
              {borrowBooks.map((book, index) => (
                <div key={book.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white group hover:border-indigo-300 transition-colors animate-in fade-in">
                  <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5 text-indigo-600 text-xs font-bold">{index + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{book.title}</p>
                    <p className="text-xs text-slate-500 font-mono">Barcode: {book.barcode}</p>
                  </div>
                  <button 
                    className="w-6 h-6 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center text-slate-400 transition-colors shrink-0"
                    onClick={() => setBorrowBooks(prev => prev.filter(b => b.id !== book.id))}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {borrowBooks.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">Chưa có sách nào được quét.</p>
              )}
            </div>

              {/* Summary & Action Button */}
              <div className="mt-auto pt-4 flex flex-col gap-3">
                <div className="flex justify-between items-center px-2">
                  <span className="text-sm font-bold text-slate-700">Tổng cộng: <span className="text-indigo-600">{borrowBooks.length} cuốn</span></span>
                  <span className="text-xs font-medium text-slate-500">(Thời hạn 14 ngày) <span className="text-slate-800 font-bold ml-1">Hạn trả: 30/09/2026</span></span>
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
            <Button variant="outline" onClick={() => setShowReturnModal(false)}>Hủy bỏ</Button>
            <Button variant="primary" onClick={() => {
              alert('Đã xác nhận trả sách thành công!');
              setShowReturnModal(false);
              setReturnBookScanned(false);
              setReturnBarcode('');
              setReturnCondition('Nguyên vẹn');
            }}>
              Xác nhận trả sách
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-sm font-bold text-slate-800 mb-1">Cấu trúc dữ liệu và Giải thuật</h4>
            <div className="text-xs text-slate-500 space-y-1 font-medium">
              <p>Barcode: <span className="text-slate-700">BC-2024-8901</span></p>
              <p>Độc giả: <span className="text-slate-700">Nguyễn Văn A (MSSV: 50221320)</span></p>
              <p>Mã phiếu: <span className="text-slate-700">PM-9902</span></p>
              <p>Ngày mượn: <span className="text-slate-700">10/09/2026</span> - Hạn trả: <span className="text-rose-600">20/09/2026</span></p>
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
                <input type="file" accept="image/*" className="block w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors" />
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
            <Button variant="outline" onClick={() => setShowBorrowModal(false)}>Hủy bỏ</Button>
            <Button variant="primary" onClick={() => {
              alert('Đã tạo phiếu mượn thành công!');
              setShowBorrowModal(false);
              setBorrowBooks([]);
              setBorrowUserId('');
              setUserValidated(false);
            }}>
              Tạo phiếu mượn
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 mb-4">Hệ thống sẽ tạo phiếu mượn với các thông tin sau:</p>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">LM</div>
          <div>
            <p className="text-sm font-bold text-slate-800">Lê Thị Mai Hương</p>
            <p className="text-xs font-mono text-slate-500">MSSV: 50221320</p>
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-2">Số lượng tài liệu: <span className="text-indigo-600 font-bold">{borrowBooks.length} cuốn</span></p>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
          {borrowBooks.map((b, i) => (
            <div key={i} className="text-xs text-slate-600 font-medium pb-2 border-b border-slate-100 last:border-0 last:pb-0">
              {i+1}. {b.title} <span className="text-slate-400 font-normal">({b.barcode})</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
