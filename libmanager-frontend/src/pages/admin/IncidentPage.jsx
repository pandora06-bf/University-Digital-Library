import { useState } from 'react';
import { 
  AlertOctagon, Plus, Search, RotateCcw, Eye, 
  FileText, AlertTriangle, DollarSign,
  ScanLine, BookOpen, User, Receipt
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import {
  getStoredIncidents,
  addStoredIncident,
  findMockActiveLoan,
  MOCK_ACTIVE_LOANS,
} from '../../mocks/incidents';

const EMPTY_CREATE_FORM = {
  code: '',
  incident_type: 'LOST',
  description: '',
  book_price: 0,
  book_title: '',
  barcode: '',
  loan_code: '',
  borrower_name: '',
  borrower_code: '',
  borrower_class: '',
};

export default function IncidentPage() {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();

  // Danh sách biên bản sự cố từ mock data (khởi tạo qua lazy initializer)
  const [incidents, setIncidents] = useState(() => getStoredIncidents());
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal states
  const [detailRow, setDetailRow] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form tạo biên bản mới — trống đến khi Tra cứu thành công
  const [createForm, setCreateForm] = useState({ ...EMPTY_CREATE_FORM });
  const [loanLookedUp, setLoanLookedUp] = useState(false);
  const [isSearchingBook, setIsSearchingBook] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Format tiền tệ VNĐ
  const formatVND = (num) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
  };

  const handleLookupLoan = () => {
    const code = createForm.code.trim();
    if (!code) {
      setFormErrors((prev) => ({ ...prev, code: 'Mã barcode hoặc mã phiếu không được để trống' }));
      showToast('Vui lòng nhập mã barcode hoặc mã phiếu trước khi tra cứu.', 'warning');
      return;
    }

    setIsSearchingBook(true);
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.code;
      return next;
    });

    // Mock FE: tra cứu đồng bộ trên MOCK_ACTIVE_LOANS (không gọi API)
    window.setTimeout(() => {
      const found = findMockActiveLoan(code);
      setIsSearchingBook(false);

      if (!found) {
        setLoanLookedUp(false);
        setCreateForm((prev) => ({
          ...prev,
          book_price: 0,
          book_title: '',
          barcode: '',
          loan_code: '',
          borrower_name: '',
          borrower_code: '',
          borrower_class: '',
        }));
        showToast(
          `Không tìm thấy phiếu BORROWED cho "${code}". Thử: ${MOCK_ACTIVE_LOANS[0].barcode} hoặc ${MOCK_ACTIVE_LOANS[0].loan_code}.`,
          'error'
        );
        return;
      }

      setLoanLookedUp(true);
      setCreateForm((prev) => ({
        ...prev,
        code,
        book_price: found.book_price,
        book_title: found.book_title,
        barcode: found.barcode,
        loan_code: found.loan_code,
        borrower_name: found.borrower_name,
        borrower_code: found.borrower_code,
        borrower_class: found.borrower_class,
      }));
      showToast(`Đã tra cứu phiếu ${found.loan_code} (BORROWED).`, 'success');
    }, 350);
  };

  // Lọc dữ liệu
  const filteredData = incidents.filter(item => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch = !term ||
      item.incident_code.toLowerCase().includes(term) ||
      item.barcode.toLowerCase().includes(term) ||
      item.loan_code.toLowerCase().includes(term) ||
      item.book_title.toLowerCase().includes(term) ||
      item.borrower_name.toLowerCase().includes(term) ||
      item.borrower_code.toLowerCase().includes(term);

    const matchType = typeFilter === 'ALL' || item.incident_type === typeFilter;
    const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;

    return matchSearch && matchType && matchStatus;
  });

  // Thống kê nhanh
  const totalIncidents = incidents.length;
  const lostCount = incidents.filter(i => i.incident_type === 'LOST').length;
  const damagedCount = incidents.filter(i => i.incident_type === 'DAMAGED').length;
  const totalCompensation = incidents.reduce((sum, item) => sum + (item.compensation_amount || 0), 0);

  // Xử lý tạo biên bản mới
  const handleSaveIncident = () => {
    const errors = {};
    if (!createForm.code.trim()) errors.code = 'Mã barcode hoặc mã phiếu không được để trống';
    if (!loanLookedUp || !createForm.loan_code) {
      errors.code = errors.code || 'Vui lòng bấm Tra cứu và chọn phiếu BORROWED hợp lệ';
    }
    if (!createForm.description.trim()) errors.description = 'Mô tả chi tiết sự cố không được để trống';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('Vui lòng kiểm tra lại thông tin biên bản trước khi lưu.', 'warning');
      return;
    }
    setFormErrors({});

    const newIncident = {
      id: `INC-2026-${String(incidents.length + 1).padStart(3, '0')}`,
      incident_code: `BB-2026-${String(incidents.length + 1).padStart(3, '0')}`,
      loan_code: createForm.loan_code,
      barcode: createForm.barcode,
      book_title: createForm.book_title,
      borrower_name: createForm.borrower_name,
      borrower_code: createForm.borrower_code,
      borrower_class: createForm.borrower_class,
      incident_type: createForm.incident_type,
      description: createForm.description.trim(),
      book_price: Number(createForm.book_price) || 0,
      compensation_amount: Number(createForm.book_price) || 0,
      created_at: new Date().toLocaleDateString('vi-VN'),
      created_by: 'Thủ thư Quản trị viên',
      status: 'PENDING',
    };

    const updated = addStoredIncident(newIncident);
    setIncidents(updated);
    setShowCreateModal(false);
    setLoanLookedUp(false);
    setCreateForm({ ...EMPTY_CREATE_FORM });
    showToast(`Đã lập biên bản ${newIncident.incident_code} thành công!`, 'success');
  };

  // Cấu hình các cột cho bảng Table component
  const incidentColumns = [
    {
      key: 'incident_code',
      header: 'Mã Biên Bản',
      render: (val, row) => (
        <div className="min-w-[130px]">
          <span className="font-mono font-bold text-indigo-600 block bg-indigo-50/70 px-2 py-1 rounded w-fit text-xs">
            {val}
          </span>
          <span className="text-[11px] text-slate-400 font-medium block mt-1">
            Ngày: {row.created_at}
          </span>
        </div>
      )
    },
    {
      key: 'book_title',
      header: 'Tài Liệu & Mã Mượn',
      render: (val, row) => (
        <div className="min-w-[220px] max-w-sm">
          <p className="font-bold text-slate-800 text-sm truncate" title={val}>
            {val}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">BC: {row.barcode}</span>
            <span>•</span>
            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">Phiếu: {row.loan_code}</span>
          </div>
        </div>
      )
    },
    {
      key: 'borrower',
      header: 'Người Mượn',
      render: (_, row) => (
        <div className="min-w-[150px]">
          <span className="font-semibold text-slate-800 block text-sm">{row.borrower_name}</span>
          <span className="text-xs text-slate-500 font-mono block mt-0.5">
            {row.borrower_code} ({row.borrower_class})
          </span>
        </div>
      )
    },
    {
      key: 'incident_type',
      header: 'Loại Sự Cố',
      render: (val) => {
        const isLost = val === 'LOST';
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${
            isLost 
              ? 'bg-rose-50 text-rose-700 border-rose-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLost ? 'bg-rose-500' : 'bg-amber-500'}`} />
            {isLost ? 'Mất sách' : 'Hỏng nặng'}
          </span>
        );
      }
    },
    {
      key: 'description',
      header: 'Mô Tả Tình Trạng',
      render: (val) => (
        <div className="min-w-[200px] max-w-xs">
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed" title={val}>
            {val}
          </p>
        </div>
      )
    },
    {
      key: 'compensation_amount',
      header: 'Giá Bìa / Bồi Thường',
      align: 'right',
      render: (val) => (
        <div className="min-w-[120px] text-right">
          <span className="font-bold text-slate-800 block text-sm">
            {formatVND(val)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Giá bìa (BR-28)</span>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      render: (val) => {
        let style = 'bg-slate-100 text-slate-600 border-slate-200';
        let label = 'Chờ xử lý';
        if (val === 'PENDING') {
          style = 'bg-amber-50 text-amber-700 border-amber-200';
          label = 'Chờ xử lý';
        } else if (val === 'RECORDED') {
          style = 'bg-indigo-50 text-indigo-700 border-indigo-200';
          label = 'Đã ghi công nợ';
        } else if (val === 'RESOLVED') {
          style = 'bg-emerald-50 text-emerald-700 border-emerald-200';
          label = 'Đã bồi thường';
        }
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${style}`}>
            {label}
          </span>
        );
      }
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5 min-w-[80px]">
          <button
            onClick={() => setDetailRow(row)}
            className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors cursor-pointer"
            title="Xem chi tiết biên bản"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      <Toast toast={toast} onClose={hideToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Báo mất / Hỏng sách</h1>
          <p className="text-sm text-slate-500 mt-1">
            Lập biên bản sự cố tài liệu, ngừng lưu thông bản sao (RETIRED) và tính bồi thường theo giá bìa.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin/fines')}
            icon={<Receipt className="w-4 h-4" />}
          >
            Thu phạt &amp; Công nợ
          </Button>
          <Button 
            variant="primary" 
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setCreateForm({ ...EMPTY_CREATE_FORM });
              setLoanLookedUp(false);
              setFormErrors({});
              setShowCreateModal(true);
            }}
          >
            Lập biên bản sự cố
          </Button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng biên bản */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <FileText className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tổng số biên bản</p>
          <div className="flex items-end gap-2">
            <h3 className="text-3xl font-extrabold text-slate-800 leading-none">
              {totalIncidents} <span className="text-sm font-medium text-slate-500">vụ việc</span>
            </h3>
          </div>
          <div className="mt-3 text-[11px] font-medium text-slate-500">
            Dữ liệu mẫu kiểm thử giao diện Admin
          </div>
        </div>

        {/* Card 2: Báo mất */}
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-rose-50/30">
          <div className="absolute top-4 right-4">
            <AlertOctagon className="w-6 h-6 text-rose-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Báo mất sách</p>
          <div className="flex items-end gap-2">
            <h3 className="text-3xl font-extrabold text-rose-600 leading-none">
              {lostCount} <span className="text-sm font-medium text-rose-400">cuốn</span>
            </h3>
          </div>
          <div className="mt-3 text-[11px] font-medium text-rose-600 flex items-center gap-1">
            <span>Ngừng lưu thông, bản sao chuyển RETIRED</span>
          </div>
        </div>

        {/* Card 3: Hỏng nặng */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-amber-50/30">
          <div className="absolute top-4 right-4">
            <AlertTriangle className="w-6 h-6 text-amber-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hỏng nặng</p>
          <div className="flex items-end gap-2">
            <h3 className="text-3xl font-extrabold text-amber-600 leading-none">
              {damagedCount} <span className="text-sm font-medium text-amber-400">cuốn</span>
            </h3>
          </div>
          <div className="mt-3 text-[11px] font-medium text-amber-600">
            Rách bìa, mất trang, hư hỏng không phục hồi
          </div>
        </div>

        {/* Card 4: Tổng bồi thường */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <DollarSign className="w-6 h-6 text-emerald-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tổng bồi thường ước tính</p>
          <div className="flex items-end gap-2">
            <h3 className="text-2xl font-extrabold text-emerald-600 leading-none">
              {formatVND(totalCompensation)}
            </h3>
          </div>
          <div className="mt-3 text-[11px] font-medium text-slate-500">
            Theo nguyên tắc giá bìa (BR-28)
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
        {/* Filters Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 rounded-t-2xl">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <div className="w-full sm:w-80">
              <Input
                type="text"
                placeholder="Tìm mã biên bản, barcode, tên sách, độc giả..."
                leftIcon={<Search className="w-4 h-4" />}
                className="!h-10 !rounded-lg placeholder:font-sans"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Loại sự cố */}
            <select
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer min-w-[190px]"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">Loại sự cố (Tất cả)</option>
              <option value="LOST">Mất sách</option>
              <option value="DAMAGED">Hỏng nặng</option>
            </select>

            {/* Filter Trạng thái */}
            <select
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer min-w-[190px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Trạng thái (Tất cả)</option>
              <option value="PENDING">Chờ xử lý</option>
              <option value="RECORDED">Đã ghi nhận công nợ</option>
              <option value="RESOLVED">Đã bồi thường</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="!text-slate-500"
            >
              Đặt lại
            </Button>
          </div>
        </div>

        {/* Table Hiển thị biên bản */}
        <Table 
          columns={incidentColumns}
          data={filteredData}
          className="border-0 shadow-none rounded-none rounded-b-2xl"
          emptyMessage={
            <div className="py-8 text-center space-y-2">
              <AlertOctagon className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-slate-700 font-semibold text-sm">Không tìm thấy biên bản sự cố nào</p>
              <p className="text-slate-400 text-xs">Hãy thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc.</p>
            </div>
          }
        />
      </div>

      {/* Modal Chi tiết Biên bản */}
      <Modal
        isOpen={!!detailRow}
        onClose={() => setDetailRow(null)}
        title="Chi tiết biên bản sự cố báo mất / hỏng sách"
        maxWidth="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setDetailRow(null)}>Đóng</Button>
            <Button 
              variant="primary" 
              icon={<Receipt className="w-4 h-4" />}
              onClick={() => {
                setDetailRow(null);
                navigate('/admin/fines');
              }}
            >
              Xem tại Thu phạt &amp; Công nợ
            </Button>
          </>
        }
      >
        {detailRow && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-600 block">{detailRow.incident_code}</span>
                <span className="text-xs text-slate-500">Mã hệ thống: {detailRow.id} • Ngày lập: {detailRow.created_at}</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                detailRow.incident_type === 'LOST' 
                  ? 'bg-rose-50 text-rose-700 border-rose-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {detailRow.incident_type === 'LOST' ? 'Mất sách' : 'Hỏng nặng'}
              </span>
            </div>

            {/* Sách & Phiếu mượn */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                Thông tin tài liệu
              </h4>
              <p className="font-bold text-slate-900 text-sm">{detailRow.book_title}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                <p>Mã vạch (Barcode): <strong className="font-mono text-slate-800">{detailRow.barcode}</strong></p>
                <p>Mã phiếu mượn: <strong className="font-mono text-slate-800">{detailRow.loan_code}</strong></p>
                <p>Giá bìa gốc: <strong className="text-slate-800">{formatVND(detailRow.book_price)}</strong></p>
                <p>Người lập biên bản: <strong className="text-slate-800">{detailRow.created_by}</strong></p>
              </div>
            </div>

            {/* Độc giả */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-600" />
                Thông tin độc giả mượn
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <p>Họ tên độc giả: <strong className="text-slate-800">{detailRow.borrower_name}</strong></p>
                <p>Mã số sinh viên/cán bộ: <strong className="font-mono text-slate-800">{detailRow.borrower_code}</strong></p>
                <p>Lớp / Khoa: <strong className="text-slate-800">{detailRow.borrower_class}</strong></p>
                <p>Trạng thái tài khoản: <strong className="text-rose-600">Khóa mượn (is_locked = TRUE)</strong></p>
              </div>
            </div>

            {/* Mô tả sự cố */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase block">Mô tả sự cố &amp; Biên bản</label>
              <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                {detailRow.description}
              </p>
            </div>

            {/* Bồi thường */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-800 uppercase">Khoản tiền bồi thường (BR-28)</p>
                <p className="text-xs text-amber-600 mt-0.5">Cộng vào Total_Fines, độc giả nộp tại quầy hoặc ví dịch vụ</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-extrabold text-amber-700">
                  {formatVND(detailRow.compensation_amount)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Lập biên bản mới (phần 1/3) */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Lập biên bản báo mất / hỏng sách mới"
        maxWidth="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Hủy bỏ</Button>
            <Button 
              variant="primary" 
              onClick={handleSaveIncident}
              className="!bg-indigo-600 hover:!bg-indigo-700"
            >
              Xác nhận Lập biên bản
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Nhập mã Barcode hoặc mã phiếu mượn để hệ thống tra cứu phiếu BORROWED tương ứng.
          </p>

          {/* Ô quét mã */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Mã Barcode hoặc Mã Phiếu mượn <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="VD: BC-2026-0012 hoặc PM-2026-0089"
                  leftIcon={<ScanLine className="w-4 h-4" />}
                  className="font-mono text-sm"
                  value={createForm.code}
                  error={formErrors.code}
                  onChange={(e) => {
                    setLoanLookedUp(false);
                    setCreateForm({ ...createForm, code: e.target.value });
                    if (formErrors.code) setFormErrors({ ...formErrors, code: '' });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLookupLoan();
                    }
                  }}
                />
              </div>
              <Button
                variant="outline"
                className="shrink-0"
                disabled={isSearchingBook}
                onClick={handleLookupLoan}
              >
                {isSearchingBook ? 'Đang tìm...' : 'Tra cứu'}
              </Button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Mock FE — thử: {MOCK_ACTIVE_LOANS.map((l) => l.barcode).slice(0, 2).join(', ')}
            </p>
          </div>

          {/* Thẻ thông tin sau khi tra cứu */}
          {loanLookedUp ? (
            <div className="bg-emerald-50/70 rounded-xl p-3.5 border border-emerald-200 text-xs space-y-1.5">
              <p className="font-bold text-slate-800 text-sm">{createForm.book_title}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600">
                <p>Barcode: <span className="font-mono font-semibold text-slate-800">{createForm.barcode}</span></p>
                <p>Phiếu: <span className="font-mono font-semibold text-slate-800">{createForm.loan_code}</span></p>
                <p>Độc giả: <span className="font-semibold text-slate-800">{createForm.borrower_name} ({createForm.borrower_code})</span></p>
                <p>Giá bìa: <span className="font-bold text-emerald-600">{formatVND(createForm.book_price)}</span></p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-3.5 border border-dashed border-slate-200 text-xs text-slate-500">
              Chưa có phiếu. Nhập mã rồi bấm <strong>Tra cứu</strong> (hoặc Enter) để hiện sách, độc giả và giá bồi thường.
            </div>
          )}

          {/* Loại sự cố */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
              Loại sự cố <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                createForm.incident_type === 'LOST' 
                  ? 'border-rose-500 bg-rose-50/50 text-rose-800' 
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}>
                <input 
                  type="radio" 
                  name="incident_type" 
                  checked={createForm.incident_type === 'LOST'}
                  onChange={() => setCreateForm({ ...createForm, incident_type: 'LOST' })}
                  className="w-4 h-4 text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <div>
                  <p className="text-sm font-bold">Mất sách</p>
                  <p className="text-[11px] opacity-80">Chuyển RETIRED, bồi thường giá bìa</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                createForm.incident_type === 'DAMAGED' 
                  ? 'border-amber-500 bg-amber-50/50 text-amber-800' 
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}>
                <input 
                  type="radio" 
                  name="incident_type" 
                  checked={createForm.incident_type === 'DAMAGED'}
                  onChange={() => setCreateForm({ ...createForm, incident_type: 'DAMAGED' })}
                  className="w-4 h-4 text-amber-600 focus:ring-amber-500 border-slate-300"
                />
                <div>
                  <p className="text-sm font-bold">Hỏng nặng</p>
                  <p className="text-[11px] opacity-80">Rách nát, ẩm mốc không phục hồi</p>
                </div>
              </label>
            </div>
          </div>

          {/* Mô tả sự cố */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Mô tả chi tiết sự cố <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows="3"
              placeholder="Ghi rõ lý do mất, tình trạng hư hỏng, địa điểm hoặc nguyên nhân..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              value={createForm.description}
              onChange={(e) => {
                setCreateForm({ ...createForm, description: e.target.value });
                if (formErrors.description) setFormErrors({ ...formErrors, description: '' });
              }}
            />
            {formErrors.description && (
              <p className="text-xs text-rose-600 mt-1">{formErrors.description}</p>
            )}
          </div>

          {/* Hiển thị số tiền bồi thường dự kiến */}
          <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-indigo-900 uppercase">Số tiền bồi thường dự kiến</p>
              <p className="text-[11px] text-indigo-700">Tự động lấy theo giá bìa của đầu sách (BR-28)</p>
            </div>
            <span className="text-lg font-extrabold text-indigo-700">
              {formatVND(createForm.book_price)}
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
