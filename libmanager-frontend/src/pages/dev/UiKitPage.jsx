import { useState } from 'react';
import { Mail, Lock, Search, Bookmark, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Table, StatusBadge } from '../../components/Table';
import { FastBarcodeScanner } from '../../components/FastBarcodeScanner';

export default function UiKitPage() {
  const [btnLoading, setBtnLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [tableLoading, setTableLoading] = useState(false);
  const [scannedHistory, setScannedHistory] = useState(['BC-2026-0001', 'BC-2026-0002']);

  // Custom columns test cho User Loan Records
  const userLoanColumns = [
    { key: 'loanCode', header: 'Mã phiếu', align: 'left', render: (val) => <span className="font-mono text-indigo-600 font-semibold">{val}</span> },
    { key: 'bookTitle', header: 'Tên tài liệu', align: 'left', render: (val, row) => (
      <div>
        <div className="font-semibold text-slate-800">{val}</div>
        <div className="text-xs text-slate-500">{row.author}</div>
      </div>
    )},
    { key: 'borrowDate', header: 'Ngày mượn', align: 'left' },
    { key: 'dueDate', header: 'Hạn trả', align: 'left' },
    { key: 'status', header: 'Trạng thái', align: 'center', render: (val, row) => <StatusBadge status={val} type={row.statusType} /> },
    { key: 'action', header: 'Thao tác', align: 'right', render: (_, row) => (
      <Button size="sm" variant="outline" onClick={() => alert(`Xem chi tiết ${row.loanCode}`)}>
        Chi tiết
      </Button>
    )},
  ];

  const customLoanData = [
    { id: 'LN-01', loanCode: 'PM-2026-081', bookTitle: 'Clean Architecture Tiếng Việt', author: 'Robert C. Martin', borrowDate: '01/09/2026', dueDate: '15/09/2026', status: 'Đang mượn', statusType: 'warning' },
    { id: 'LN-02', loanCode: 'PM-2026-082', bookTitle: 'Kỹ nghệ phần mềm thực hành', author: 'Roger S. Pressman', borrowDate: '28/08/2026', dueDate: '11/09/2026', status: 'Sẵn sàng', statusType: 'success' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-6 sm:px-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Về trang chủ User
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">LibManager UI Kit & Component Lab</h1>
          <p className="text-sm text-slate-500">Môi trường kiểm thử toàn diện 3 component dùng chung của Đạt & Vân</p>
        </div>
        <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
          Chỉ kích hoạt ở môi trường DEV
        </span>
      </div>

      {/* SECTION 1: BUTTONS */}
      <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-10 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">1. Button Component (`Button.jsx`)</h2>
          <p className="text-xs text-slate-500">Variants: primary, outline (alias secondary), ghost, danger. Sizes: sm (36px), md (48px - chữ 18px), lg (56px)</p>
        </div>

        {/* Variants */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Các biến thể (Variants)</h3>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary">Primary Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="secondary">Alias Secondary (Figma)</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="danger">Danger Button</Button>
          </div>
        </div>

        {/* Sizes */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kích thước (Sizes)</h3>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm" variant="primary">Size SM (36px)</Button>
            <Button size="md" variant="primary">Size MD (48px — 18/24/600)</Button>
            <Button size="lg" variant="primary">Size LG (56px)</Button>
          </div>
        </div>

        {/* States: Loading, Disabled, Icon */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trạng thái đặc biệt (Loading, Disabled, Icon)</h3>
          <div className="flex flex-wrap items-center gap-4">
            <Button
              variant="primary"
              loading={btnLoading}
              onClick={() => {
                setBtnLoading(true);
                setTimeout(() => setBtnLoading(false), 2000);
              }}
            >
              {btnLoading ? 'Đang xử lý...' : 'Click thử Loading (2s)'}
            </Button>
            <Button variant="outline" disabled>Bị vô hiệu hóa</Button>
            <Button variant="primary" icon={<Bookmark className="w-4 h-4" />}>
              Có Icon kèm
            </Button>
          </div>
        </div>
      </section>

      {/* SECTION 2: INPUTS */}
      <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-10 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">2. Input Component (`Input.jsx`)</h2>
          <p className="text-xs text-slate-500">Tự sinh useId, hỗ trợ label, error (string/boolean), helperText, icon trái/phải và ARIA chuẩn</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Tiêu đề tài liệu"
            placeholder="Nhập tên tài liệu..."
            required
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            helperText="Tên đầy đủ theo bìa sách"
          />

          <Input
            label="Tìm kiếm độc giả"
            placeholder="Nhập mã sinh viên hoặc email..."
            leftIcon={<Search className="w-4 h-4" />}
            rightIcon={<span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">⌘K</span>}
          />

          <Input
            label="Tài khoản email"
            type="email"
            placeholder="sinhvien@tdtu.edu.vn"
            leftIcon={<Mail className="w-4 h-4" />}
            helperText="Sử dụng email do trường cấp"
          />

          <Input
            label="Mật khẩu"
            type="password"
            placeholder="••••••••"
            leftIcon={<Lock className="w-4 h-4" />}
            error="Mật khẩu phải có ít nhất 8 ký tự"
          />

          <Input
            label="Ô nhập vô hiệu hóa"
            placeholder="Không thể chỉnh sửa..."
            disabled
            value="Dữ liệu cố định từ hệ thống"
          />

          <Input
            label="Input không truyền ID/name (Kiểm tra useId)"
            placeholder="Label vẫn click focus được"
            helperText="Kiểm tra quan hệ htmlFor và id tự động sinh"
          />
        </div>
      </section>

      {/* SECTION 3: TABLES */}
      <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-8">
        <div>
          <h2 className="text-lg font-bold text-slate-900">3. Table Component (`Table.jsx`)</h2>
          <p className="text-xs text-slate-500">Kiểm tra chế độ Preset tồn kho của Vân và Chế độ Custom Columns cho User</p>
        </div>

        {/* Case 1: Custom columns */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Trường hợp 1: Bảng Phiếu mượn User (Custom Columns)</h3>
            <Button size="sm" variant="outline" onClick={() => setTableLoading(!tableLoading)}>
              Toggle Loading ({tableLoading ? 'Bật' : 'Tắt'})
            </Button>
          </div>
          <Table
            title="Sách đang mượn của bạn"
            subtitle="Danh sách phiếu mượn tài liệu học tập"
            columns={userLoanColumns}
            data={customLoanData}
            loading={tableLoading}
            footerNote="Dữ liệu mượn trả thời gian thực"
            pagination={true}
            itemsPerPage={1}
          />
        </div>

        {/* Case 2: Preset 7 cột của Vân */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Trường hợp 2: Preset 7 cột tồn kho mặc định của Vân</h3>
          <Table
            title="Quản lý kho thư viện (Preset Admin của Vân)"
            subtitle="Hiển thị 4 dòng mock mặc định khi không truyền columns"
            onEdit={(row) => alert(`Sửa sách: ${row.title}`)}
            onDelete={(row) => alert(`Xóa sách: ${row.title}`)}
            footerNote="Dữ liệu thử nghiệm cục bộ"
            pagination={true}
            itemsPerPage={2}
          />
        </div>

        {/* Case 3: Empty State & Null Safe */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Trường hợp 3: Bảng rỗng (Empty State) & Null Safe</h3>
          <Table
            title="Bảng rỗng kiểm tra an toàn dữ liệu"
            columns={userLoanColumns}
            data={[]}
            emptyMessage="Hiện tại bạn chưa có tài liệu nào quá hạn"
          />
        </div>
      </section>

      {/* SECTION 4: FAST BARCODE SCANNER (SPRINT 3 - VÂN) */}
      <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-10 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">4. FastBarcodeScanner Component (`FastBarcodeScanner.jsx` — Sprint 3 của Vân)</h2>
          <p className="text-xs text-slate-500">Bắt sự kiện Enter liên tục cho máy quét mã vạch không cần dùng chuột; tự động xóa ô nhập và phát âm thanh beep / hiệu ứng thị giác.</p>
        </div>

        <div className="max-w-xl space-y-4">
          <FastBarcodeScanner
            label="Mô phỏng máy tít mã vạch tại quầy"
            placeholder="Tít mã vạch hoặc nhập mã rồi gõ Enter..."
            onScan={(code) => setScannedHistory(prev => [code, ...prev])}
            helperText="Nhập mã (VD: BC-2026-8888) rồi nhấn Enter để trải nghiệm âm thanh POS và hiệu ứng viền xanh."
          />

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase">Lịch sử tít mã vạch ({scannedHistory.length})</span>
              {scannedHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setScannedHistory([])}
                  className="text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  Xóa lịch sử
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {scannedHistory.map((code, idx) => (
                <span key={idx} className="font-mono text-xs font-semibold px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg shadow-xs">
                  {code}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
