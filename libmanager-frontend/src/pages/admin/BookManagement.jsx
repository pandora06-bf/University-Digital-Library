import { useState } from 'react';
import { 
  Plus, Search, Filter, 
  CheckCircle2, ArrowLeftRight, AlertOctagon, BookCopy, RotateCcw, Trash2, Edit2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { DEFAULT_MOCK_DATA } from '../../mocks/tableMock';

export default function BookManagement() {
  const navigate = useNavigate();
  const [tableData, setTableData] = useState(DEFAULT_MOCK_DATA);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('Vị trí kho / Tầng (Tất cả)');
  const [statusFilter, setStatusFilter] = useState('Tình trạng (Tất cả)');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingRow, setDeletingRow] = useState(null);
  const [editingRow, setEditingRow] = useState(null);

  // Filter Data
  const filteredData = tableData.filter(item => {
    const matchSearch = !searchTerm || 
      item.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchLocation = locationFilter === 'Vị trí kho / Tầng (Tất cả)' || item.location === locationFilter;
    const matchStatus = statusFilter === 'Tình trạng (Tất cả)' || item.status === statusFilter;
    
    return matchSearch && matchLocation && matchStatus;
  });

  // Custom Columns with Navigation
  const inventoryColumns = [
    {
      key: 'barcode',
      header: 'Mã Barcode',
      render: (val) => (
        <span className="bg-indigo-50 px-2 py-1 rounded-md text-xs font-mono text-indigo-600 font-semibold">
          {val}
        </span>
      )
    },
    {
      key: 'title',
      header: 'Tên Sách & Tác Giả',
      render: (val, row) => (
        <div className="flex flex-col max-w-xs sm:max-w-md">
          <button 
            onClick={() => navigate('/admin/catalog')} 
            className="text-sm font-semibold text-slate-900 truncate hover:text-indigo-600 text-left transition-colors cursor-pointer"
            title="Đến trang quản lý danh mục"
          >
            {val}
          </button>
          <span className="text-xs text-slate-500 truncate mt-0.5">
            {row.author} • ISBN: {row.isbn}
          </span>
        </div>
      )
    },
    {
      key: 'location',
      header: 'Vị Trí Kệ'
    },
    {
      key: 'condition',
      header: 'Tình Trạng',
      render: (val, row) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${
          row.statusType === 'danger' ? 'bg-rose-50 text-rose-600 border-rose-200' : 
          'bg-slate-50 text-slate-700 border-slate-200'
        }`}>
          {row.statusType === 'danger' ? 'Hư hỏng' : 'Nguyên vẹn'}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      render: (val, row) => {
        let colors = '';
        if (row.statusType === 'success') colors = 'bg-emerald-50 text-emerald-600 border-emerald-200';
        else if (row.statusType === 'warning') colors = 'bg-amber-50 text-amber-600 border-amber-200';
        else if (row.statusType === 'danger') colors = 'bg-rose-50 text-rose-600 border-rose-200';
        
        let navAction = null;
        if (val === 'Đang mượn' || val === 'Đang cho mượn') navAction = () => navigate('/admin/loans');
        if (val === 'Báo mất' || val === 'Cần sửa chữa') navAction = () => navigate('/admin/fines');
        
        return (
          <button 
            onClick={navAction}
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${colors} ${navAction ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
            title={navAction ? 'Xem chi tiết giao dịch' : ''}
          >
            {val}
          </button>
        )
      }
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      align: 'right',
      render: (val, row) => (
        <div className="flex items-center justify-end gap-2 transition-opacity">
          <button
            onClick={() => setEditingRow(row)}
            className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors"
            title="Chỉnh sửa bản sao"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeletingRow(row)}
            className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors"
            title="Xóa bản sao"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Tồn kho & Bản sao Sách</h1>
          <p className="text-sm text-slate-500 mt-1">Kiểm soát số lượng bản sao vật lý, định vị trí kệ và tình trạng hiện tại.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="primary" 
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowAddModal(true)}
          >
            Thêm bản sao
          </Button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <BookCopy className="w-16 h-16 text-indigo-900" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tổng bản sao vật lý</p>
          <div className="flex items-end gap-2">
            <h3 className="text-3xl font-extrabold text-slate-800 leading-none">24,850 <span className="text-sm font-medium text-slate-500">cuốn</span></h3>
          </div>
          <div className="mt-3 text-[11px] font-medium flex items-center gap-1.5">
            <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">+180 tháng này</span>
            <span className="text-slate-400">tổng lượng lưu kho</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sẵn sàng trên kệ</p>
          <div className="flex items-end gap-2">
            <h3 className="text-3xl font-extrabold text-slate-800 leading-none">19,420 <span className="text-sm font-medium text-slate-500">cuốn</span></h3>
          </div>
          <div className="mt-3 text-[11px] font-medium flex items-center gap-1.5">
            <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">78.1%</span>
            <span className="text-slate-500">tổng số lượng</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <ArrowLeftRight className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Đang cho mượn</p>
          <div className="flex items-end gap-2">
            <h3 className="text-3xl font-extrabold text-slate-800 leading-none">4,890 <span className="text-sm font-medium text-slate-500">cuốn</span></h3>
          </div>
          <div className="mt-3 text-[11px] font-medium flex items-center gap-1.5">
            <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">+15 hôm nay</span>
            <span className="text-slate-500">lưu thông</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <AlertOctagon className="w-6 h-6 text-rose-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cần xử lý & Bảo quản</p>
          <div className="flex items-end gap-2">
            <h3 className="text-3xl font-extrabold text-rose-700 leading-none">540 <span className="text-sm font-medium text-rose-500">cuốn</span></h3>
          </div>
          <div className="mt-3 text-[11px] font-medium flex items-center gap-1.5">
            <span className="text-rose-600 font-bold">2.2%</span>
            <span className="text-slate-500">sách hư hỏng, đang sửa, thất lạc</span>
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
                placeholder="Lọc theo Barcode hoặc Tên sách..."
                leftIcon={<Search className="w-4 h-4" />}
                className="!h-10 !rounded-lg font-mono placeholder:font-sans"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Location Dropdown */}
            <select 
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer min-w-[200px]"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option>Vị trí kho / Tầng (Tất cả)</option>
              <option>Kệ A - Tầng 1</option>
              <option>Kệ B - Tầng 2</option>
            </select>

            {/* Status Dropdown */}
            <select 
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer min-w-[180px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>Tình trạng (Tất cả)</option>
              <option>Sẵn sàng trên kệ</option>
              <option>Đang cho mượn</option>
              <option>Cần sửa chữa</option>
              <option>Báo mất</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={() => {
                setSearchTerm('');
                setLocationFilter('Vị trí kho / Tầng (Tất cả)');
                setStatusFilter('Tình trạng (Tất cả)');
              }}
              className="!text-slate-500"
            >
              Đặt lại
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              icon={<Filter className="w-4 h-4" />}
              onClick={() => navigate('/admin/loans')}
            >
              Xem Phiếu Mượn
            </Button>
          </div>
        </div>

        {/* Table Preset */}
        <Table 
          columns={inventoryColumns}
          data={filteredData}
          className="border-0 shadow-none rounded-none rounded-b-2xl"
        />
      </div>

      {/* Modal Thêm bản in mới */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Thêm bản in mới"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Hủy</Button>
            <Button variant="primary" onClick={() => {
              alert('Đã thêm bản in mới thành công!');
              setShowAddModal(false);
            }}>
              Xác nhận Thêm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Mã Barcode</label>
            <Input placeholder="VD: BC-2026-9999" className="w-full font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tên đầu sách</label>
            <Input placeholder="Chọn tên sách..." className="w-full" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Vị trí kệ</label>
              <select className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm">
                <option>Kệ A - Tầng 1</option>
                <option>Kệ B - Tầng 2</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tình trạng vật lý</label>
              <select className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm">
                <option>Nguyên vẹn</option>
                <option>Rách bìa</option>
                <option>Mất trang</option>
                <option>Hư hỏng khác</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Trạng thái lưu thông</label>
              <select className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm">
                <option>Sẵn sàng</option>
                <option>Đang mượn</option>
                <option>Cần sửa chữa</option>
                <option>Thanh lý / Ngừng lưu thông</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Chỉnh sửa bản sao */}
      <Modal
        isOpen={!!editingRow}
        onClose={() => setEditingRow(null)}
        title="Chỉnh sửa bản sao"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingRow(null)}>Hủy</Button>
            <Button variant="primary" onClick={() => {
              alert('Cập nhật bản sao thành công!');
              setEditingRow(null);
            }}>
              Lưu thay đổi
            </Button>
          </>
        }
      >
        {editingRow && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Mã Barcode</label>
              <Input defaultValue={editingRow.barcode} disabled className="w-full font-mono bg-slate-50 text-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tên đầu sách</label>
              <Input defaultValue={editingRow.title} disabled className="w-full bg-slate-50 text-slate-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Vị trí kệ</label>
                <select className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm" defaultValue={editingRow.location}>
                  <option>Kệ A - Tầng 1</option>
                  <option>Kệ B - Tầng 2</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tình trạng vật lý</label>
                <select className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm">
                  <option>Nguyên vẹn</option>
                  <option>Rách bìa</option>
                  <option>Mất trang</option>
                  <option>Hư hỏng khác</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Trạng thái lưu thông</label>
                <select className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm" defaultValue={editingRow.status}>
                  <option>Sẵn sàng</option>
                  <option>Đang mượn</option>
                  <option>Cần sửa chữa</option>
                  <option>Thanh lý / Ngừng lưu thông</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Xác nhận Xóa */}
      <Modal
        isOpen={!!deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Xác nhận xóa bản sao"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingRow(null)}>Hủy bỏ</Button>
            <Button
              variant="primary"
              className="!bg-rose-600 hover:!bg-rose-700 !border-rose-600"
              onClick={() => {
                setTableData(prev => prev.filter(r => r.id !== deletingRow.id));
                setDeletingRow(null);
              }}
            >
              Xác nhận Xóa
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-4 p-2">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-6 h-6 text-rose-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-800">Bạn có chắc chắn muốn xóa bản sao này không?</h3>
            <div className="mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
              <p className="font-bold text-slate-800 text-sm">{deletingRow?.title}</p>
              <p className="text-xs font-mono text-slate-500">Barcode: {deletingRow?.barcode}</p>
              <p className="text-xs text-slate-500">Vị trí: {deletingRow?.location}</p>
            </div>
            <p className="text-xs font-medium text-rose-600 mt-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0"></span>
              Hành động này không thể hoàn tác sau khi xác nhận.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
