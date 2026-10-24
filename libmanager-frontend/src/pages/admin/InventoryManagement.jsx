import { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, 
  CheckCircle2, ArrowLeftRight, AlertOctagon, BookCopy, RotateCcw, Trash2, Edit2, Archive
} from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axiosInstance from '../../services/axios_instance';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { ADMIN_MOCK_BOOKS, ADMIN_MOCK_COPIES } from '../../mocks/adminCatalogMock';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { getApiErrorMessage } from '../../services/errorHandler';

export default function InventoryManagement() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, showToast, hideToast } = useToast();

  // State nạp danh sách đầu sách cho Combobox (NFR-PE-02: page_size ≤ 50)
  const [booksList, setBooksList] = useState([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);

  const [tableData, setTableData] = useState([]);
  const [bookInfo, setBookInfo] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingRow, setDeletingRow] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [retiringRow, setRetiringRow] = useState(null);
  const [retireReason, setRetireReason] = useState('');
  const [isRetiring, setIsRetiring] = useState(false);

  const [addFormErrors, setAddFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});

  const [addForm, setAddForm] = useState({
    barcode: '',
    zone: 'Khu A',
    floor: 'Tầng 1',
    shelf: 'Kệ 1',
    status: 'AVAILABLE',
    condition: ''
  });

  const [editForm, setEditForm] = useState({
    zone: '', floor: '', shelf: '', status: '', condition: ''
  });

  // Nạp danh sách đầu sách cho combobox chọn sách
  useEffect(() => {
    axiosInstance.get('/api/books/search?page_size=50')
      .then(res => {
        if (res.data?.items && res.data.items.length > 0) {
          setBooksList(res.data.items);
        } else {
          setBooksList(ADMIN_MOCK_BOOKS);
        }
      })
      .catch(err => {
        console.warn('API sách chưa sẵn sàng, nạp danh sách sách mock:', err?.message);
        setBooksList(ADMIN_MOCK_BOOKS);
      })
      .finally(() => {
        setIsLoadingBooks(false);
      });
  }, []);

  // BE chỉ nhận AVAILABLE | BORROWED | DAMAGED | LOST (không có RETIRED).
  // Thanh lý FE → PATCH status=DAMAGED + damage_notes; UI vẫn hiện "Đã thanh lý".
  const mapCopyStatusLabel = (status) => {
    if (status === 'AVAILABLE') return 'Sẵn sàng';
    if (status === 'BORROWED') return 'Đang cho mượn';
    if (status === 'LOST') return 'Báo mất';
    if (status === 'DAMAGED' || status === 'RETIRED') return 'Đã thanh lý';
    return status || 'Không rõ';
  };

  const mapCopyStatusType = (status) => {
    if (status === 'AVAILABLE') return 'success';
    if (status === 'BORROWED') return 'warning';
    if (status === 'DAMAGED' || status === 'RETIRED') return 'retired';
    return 'danger';
  };

  const isCopyRetired = (status) =>
    status === 'DAMAGED' || status === 'RETIRED' || status === 'LOST';

  const mapCopyRow = (c, targetBook) => ({
    id: c.copy_barcode || c.barcode,
    barcode: c.copy_barcode || c.barcode,
    location: `${c.zone} - ${c.floor} - ${c.shelf}`,
    status: mapCopyStatusLabel(c.status),
    statusType: mapCopyStatusType(c.status),
    condition: c.damage_notes ? 'Hư hỏng' : 'Nguyên vẹn',
    title: targetBook?.title || '...',
    author: targetBook?.author || '',
    isbn: targetBook?.isbn || '',
    rawZone: c.zone,
    rawFloor: c.floor,
    rawShelf: c.shelf,
    rawStatus: c.status,
    rawCondition: c.damage_notes,
  });

  const fallbackMockCopies = (targetBookId, currentBookInfo) => {
    const rawCopies = ADMIN_MOCK_COPIES[parseInt(targetBookId)] || [];
    setTableData(rawCopies.map((c) => mapCopyRow(c, currentBookInfo)));
  };

  const fetchInventory = async (targetBookId, currentBookInfo) => {
    const idToFetch = targetBookId || bookId;
    if (!idToFetch) return;
    const targetBook = currentBookInfo || bookInfo;
    try {
      const res = await axiosInstance.get(`/api/admin/books/${idToFetch}/copies`);
      if (Array.isArray(res.data)) {
        setTableData(res.data.map((c) => mapCopyRow(c, targetBook)));
      } else {
        fallbackMockCopies(idToFetch, targetBook);
      }
    } catch (error) {
      console.warn('API bản sao chưa sẵn sàng, nạp dữ liệu bản sao mock:', error?.message);
      fallbackMockCopies(idToFetch, targetBook);
    }
  };

  // Nạp thông tin sách và các bản sao khi `bookId` thay đổi
  useEffect(() => {
    if (!bookId) return;

    let isMounted = true;
    axiosInstance.get('/api/books/search?page_size=50')
      .then(res => {
        if (!isMounted) return;
        const found = res.data?.items?.find(x => x.id.toString() === bookId.toString());
        if (found) {
          setBookInfo(found);
          fetchInventory(bookId, found);
        } else {
          const mockBook = ADMIN_MOCK_BOOKS.find(x => x.id.toString() === bookId.toString());
          if (mockBook) setBookInfo(mockBook);
          fetchInventory(bookId, mockBook);
        }
      })
      .catch(err => {
        if (!isMounted) return;
        console.warn('API sách chưa sẵn sàng, nạp thông tin đầu sách mock:', err?.message);
        const mockBook = ADMIN_MOCK_BOOKS.find(x => x.id.toString() === bookId.toString());
        if (mockBook) setBookInfo(mockBook);
        fetchInventory(bookId, mockBook);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const handleSelectBook = (e) => {
    const newId = e.target.value;
    const basePath = location.pathname.startsWith('/admin/books') ? '/admin/books' : '/admin/inventory';
    if (newId) {
      navigate(`${basePath}/${newId}`);
    } else {
      navigate(basePath);
    }
  };

  const handleOpenEdit = (row) => {
    setEditingRow(row);
    setEditFormErrors({});
    setEditForm({
      zone: row.rawZone || '',
      floor: row.rawFloor || '',
      shelf: row.rawShelf || '',
      status: row.rawStatus || 'AVAILABLE',
      condition: row.rawCondition || ''
    });
  };

  const handleSaveEdit = async () => {
    const errors = {};
    if (!editForm.zone.trim()) errors.zone = 'Khu vực không được để trống';
    if (!editForm.floor.trim()) errors.floor = 'Tầng không được để trống';
    if (!editForm.shelf.trim()) errors.shelf = 'Kệ không được để trống';

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }
    setEditFormErrors({});

    try {
      await axiosInstance.patch(`/api/admin/copies/${editingRow.barcode}/condition`, {
        zone: editForm.zone.trim(),
        floor: editForm.floor.trim(),
        shelf: editForm.shelf.trim(),
        status: editForm.status,
        damage_notes: editForm.condition ? editForm.condition.trim() : null
      });
      showToast('Cập nhật bản sao thành công!', 'success');
      setEditingRow(null);
      fetchInventory(bookId, bookInfo);
    } catch (error) {
      console.error('Lỗi cập nhật bản sao:', error);
      const errorMsg = getApiErrorMessage(error, 'Không thể cập nhật bản sao. Vui lòng kiểm tra lại thông tin.');
      showToast(errorMsg, 'error');
      // Giữ nguyên modal để người dùng chỉnh sửa
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRow) return;
    try {
      await axiosInstance.delete(`/api/admin/copies/${deletingRow.barcode}`);
      showToast('Đã xóa bản sao thành công!', 'success');
      setDeletingRow(null);
      fetchInventory(bookId, bookInfo);
    } catch (error) {
      console.error('Lỗi xóa bản sao:', error);
      const errorMsg = getApiErrorMessage(error, 'Không thể xóa bản sao. Vui lòng thử lại.');
      showToast(errorMsg, 'error');
      setDeletingRow(null);
    }
  };

  const handleOpenRetire = (row) => {
    // Kiểm tra nghiệp vụ ngay khi bấm nút thanh lý (UC09 / BR-17)
    if (row.rawStatus === 'BORROWED') {
      showToast('Không thể thanh lý: Bản sao đang trong trạng thái "Đang cho mượn" (Quy tắc UC09 / BR-17).', 'warning');
      return;
    }
    if (isCopyRetired(row.rawStatus)) {
      showToast('Bản sao này đã ở trạng thái "Đã thanh lý" / ngừng lưu thông. Không thể thực hiện lại.', 'warning');
      return;
    }
    setRetiringRow(row);
    setRetireReason('');
  };

  const handleCloseRetire = () => {
    setRetiringRow(null);
    setRetireReason('');
  };

  const handleConfirmRetire = async () => {
    if (!retiringRow) return;

    // Kiểm tra nghiệp vụ phía Client: không thanh lý bản sao đang mượn (UC09 E4 / BR-17)
    if (retiringRow.rawStatus === 'BORROWED') {
      showToast('Không thể thanh lý bản sao đang trong trạng thái "Đang cho mượn" (Quy tắc UC09 / BR-17).', 'warning');
      return;
    }
    if (isCopyRetired(retiringRow.rawStatus)) {
      showToast('Bản sao này đã ở trạng thái "Đã thanh lý".', 'warning');
      return;
    }

    setIsRetiring(true);
    try {
      // BE không có RETIRED → dùng DAMAGED để loại khỏi tồn khả dụng + ghi chú thanh lý
      const note = retireReason.trim()
        ? `[Thanh lý] ${retireReason.trim()}`
        : (retiringRow.rawCondition
          ? `[Thanh lý] ${retiringRow.rawCondition}`
          : '[Thanh lý] Ngừng lưu thông');
      await axiosInstance.patch(`/api/admin/copies/${retiringRow.barcode}/condition`, {
        status: 'DAMAGED',
        damage_notes: note,
      });
      showToast('Thanh lý bản sao thành công!', 'success');
      handleCloseRetire();
      fetchInventory(bookId, bookInfo);
    } catch (error) {
      console.error('Lỗi khi thanh lý bản sao:', error);
      const errorMsg = getApiErrorMessage(error, 'Không thể thanh lý bản sao. Vui lòng thử lại.');
      showToast(errorMsg, 'error');
    } finally {
      setIsRetiring(false);
    }
  };

  const handleSaveCopy = async () => {
    const errors = {};
    if (!addForm.barcode.trim()) errors.barcode = 'Mã Barcode không được để trống';
    if (!addForm.zone.trim()) errors.zone = 'Khu vực không được để trống';
    if (!addForm.floor.trim()) errors.floor = 'Tầng không được để trống';
    if (!addForm.shelf.trim()) errors.shelf = 'Kệ không được để trống';

    if (Object.keys(errors).length > 0) {
      setAddFormErrors(errors);
      return;
    }
    setAddFormErrors({});

    if (!bookId) {
      showToast('Vui lòng chọn một đầu sách!', 'error');
      return;
    }

    try {
      await axiosInstance.post(`/api/admin/books/${bookId}/copies`, {
        copy_barcode: addForm.barcode.trim(),
        zone: addForm.zone.trim(),
        floor: addForm.floor.trim(),
        shelf: addForm.shelf.trim(),
        status: addForm.status,
        damage_notes: addForm.condition ? addForm.condition.trim() : null
      });
      showToast('Thêm bản sao thành công!', 'success');
      setShowAddModal(false);
      setAddForm({ barcode: '', zone: 'Khu A', floor: 'Tầng 1', shelf: 'Kệ 1', status: 'AVAILABLE', condition: '' });
      fetchInventory(bookId, bookInfo); // Refresh bảng
    } catch (error) {
      console.error('Lỗi thêm bản sao:', error);
      const errorMsg = getApiErrorMessage(error, 'Không thể thêm bản sao. Vui lòng kiểm tra lại thông tin.');
      showToast(errorMsg, 'error');
      // Giữ nguyên modal setShowAddModal(true) và addForm để người dùng sửa lại
    }
  };

  // Tạo danh sách vị trí duy nhất từ dữ liệu thực tế đã tải về
  const availableLocations = Array.from(
    new Set(tableData.map(item => item.location).filter(Boolean))
  ).sort();

  // Filter Data
  const filteredData = tableData.filter(item => {
    const matchSearch = !searchTerm || 
      item.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchLocation = locationFilter === 'ALL' || item.location === locationFilter;
    const matchStatus = statusFilter === 'ALL' || item.rawStatus === statusFilter;
    
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
        else if (row.statusType === 'retired') colors = 'bg-slate-100 text-slate-600 border-slate-300';
        
        let navAction = null;
        if (val === 'Đang mượn' || val === 'Đang cho mượn') navAction = () => navigate('/admin/loans');
        if (val === 'Báo mất') navAction = () => navigate('/admin/incidents');
        if (val === 'Cần sửa chữa') navAction = () => navigate('/admin/fines');
        
        return (
          <button 
            onClick={navAction}
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${colors} ${navAction ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
            title={navAction ? 'Xem chi tiết giao dịch' : ''}
          >
            {val}
          </button>
        );
      }
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      align: 'right',
      render: (val, row) => {
        const isBorrowed = row.rawStatus === 'BORROWED';
        const isRetired = isCopyRetired(row.rawStatus);
        const canRetire = !isBorrowed && !isRetired;

        return (
          <div className="flex items-center justify-end gap-2 transition-opacity">
            <button
              onClick={() => handleOpenRetire(row)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                canRetire
                  ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 cursor-pointer shadow-xs'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200 cursor-pointer opacity-70'
              }`}
              title={
                isBorrowed
                  ? 'Bản sao đang cho mượn, không thể thanh lý (UC09)'
                  : isRetired
                    ? 'Bản sao đã thanh lý'
                    : 'Thanh lý bản sao'
              }
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleOpenEdit(row)}
              className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors cursor-pointer"
              title="Chỉnh sửa bản sao"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeletingRow(row)}
              className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors cursor-pointer"
              title="Xóa bản sao"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      }
    }
  ];

  const totalCopies = tableData.length;
  const availableCopies = tableData.filter(c => c.rawStatus === 'AVAILABLE').length;
  const availablePercent = totalCopies > 0 ? Math.round((availableCopies / totalCopies) * 100) : 0;
  const borrowedCopies = tableData.filter(c => c.rawStatus === 'BORROWED').length;
  const brokenCopies = tableData.filter(c => c.rawStatus === 'DAMAGED' || c.rawStatus === 'LOST').length;
  const brokenPercent = totalCopies > 0 ? Math.round((brokenCopies / totalCopies) * 100) : 0;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      <Toast toast={toast} onClose={hideToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Tồn kho & Bản sao</h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý các bản sao vật lý, barcode, vị trí kệ và tình trạng lưu thông theo từng đầu sách.
          </p>
        </div>

        {/* Dropdown chọn đầu sách */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
          <label htmlFor="inventory-book-select" className="text-xs sm:text-sm font-semibold text-slate-700 whitespace-nowrap">
            Chọn đầu sách:
            {isLoadingBooks && <span className="text-indigo-600 font-normal text-xs ml-1">(Đang tải...)</span>}
          </label>
          <div className="w-full sm:w-80 md:w-96">
            <select
              id="inventory-book-select"
              className="w-full h-10 px-3 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-lg text-sm font-medium text-slate-700 focus:outline-none cursor-pointer transition-all truncate shadow-xs"
              value={bookId ? bookId.toString() : ''}
              onChange={handleSelectBook}
            >
              <option value="">-- Chọn đầu sách để quản lý tồn kho --</option>
              {booksList.map(b => (
                <option key={b.id} value={b.id}>
                  #{b.id} - {b.title} {b.author ? `(${b.author})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!bookId ? (
        /* Màn hình hướng dẫn chọn sách thân thiện (thay thế ngõ cụt cũ) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
            <BookCopy className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Vui lòng chọn một đầu sách để xem tồn kho</h2>
          <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
            Dữ liệu bản sao và vị trí kệ được quản lý chi tiết theo từng đầu sách. Hãy chọn một cuốn sách từ thanh chọn phía trên hoặc truy cập từ biểu tượng Tồn kho tại trang Danh mục Sách.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/admin/catalog')}>
              Đến trang Danh mục Sách
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Subheader khi đã chọn sách */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white px-5 py-4 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono">
                  Mã #{bookInfo?.id || bookId}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 truncate max-w-xl">
                  {bookInfo?.title || 'Đang tải thông tin sách...'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tác giả: <span className="font-semibold text-slate-700">{bookInfo?.author || 'Chưa cập nhật'}</span>
                {bookInfo?.publisher && <> • NXB: <span className="font-semibold text-slate-700">{bookInfo.publisher}</span></>}
                {(bookInfo?.publication_year || bookInfo?.year) && <> • Năm: <span className="font-semibold text-slate-700">{bookInfo?.publication_year || bookInfo?.year}</span></>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="primary" 
                icon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setAddFormErrors({});
                  setShowAddModal(true);
                }}
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
            <h3 className="text-3xl font-extrabold text-slate-800 leading-none">{totalCopies} <span className="text-sm font-medium text-slate-500">cuốn</span></h3>
          </div>
          <div className="mt-3 text-[11px] font-medium flex items-center gap-1.5">
            <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">Của đầu sách này</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sẵn sàng trên kệ</p>
          <div className="flex items-end gap-2">
            <h3 className="text-3xl font-extrabold text-slate-800 leading-none">{availableCopies} <span className="text-sm font-medium text-slate-500">cuốn</span></h3>
          </div>
          <div className="mt-3 text-[11px] font-medium flex items-center gap-1.5">
            <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">{availablePercent}%</span>
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
            <h3 className="text-3xl font-extrabold text-slate-800 leading-none">{borrowedCopies} <span className="text-sm font-medium text-slate-500">cuốn</span></h3>
          </div>
          <div className="mt-3 text-[11px] font-medium flex items-center gap-1.5">
            <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">Đang lưu thông</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <AlertOctagon className="w-6 h-6 text-rose-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cần xử lý & Bảo quản</p>
          <div className="flex items-end gap-2">
            <h3 className="text-3xl font-extrabold text-rose-700 leading-none">{brokenCopies} <span className="text-sm font-medium text-rose-500">cuốn</span></h3>
          </div>
          <div className="mt-3 text-[11px] font-medium flex items-center gap-1.5">
            <span className="text-rose-600 font-bold">{brokenPercent}%</span>
            <span className="text-slate-500">hư hỏng, sửa, thất lạc</span>
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
              <option value="ALL">Vị trí kho / Tầng (Tất cả)</option>
              {availableLocations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select 
              className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer min-w-[180px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Tình trạng (Tất cả)</option>
              <option value="AVAILABLE">Sẵn sàng</option>
              <option value="BORROWED">Đang cho mượn</option>
              <option value="DAMAGED">Đã thanh lý / Hỏng</option>
              <option value="LOST">Báo mất</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={() => {
                setSearchTerm('');
                setLocationFilter('ALL');
                setStatusFilter('ALL');
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

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Thêm bản in mới"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Hủy</Button>
            <Button variant="primary" onClick={handleSaveCopy}>
              Xác nhận Thêm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Mã Barcode <span className="text-rose-500">*</span></label>
            <Input 
              placeholder="VD: BC-2026-9999" 
              className="w-full font-mono" 
              value={addForm.barcode}
              error={addFormErrors.barcode}
              onChange={(e) => {
                setAddForm({...addForm, barcode: e.target.value});
                if (addFormErrors.barcode) setAddFormErrors(prev => ({...prev, barcode: ''}));
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tên đầu sách</label>
            <Input value={bookInfo?.title || ''} disabled className="w-full bg-slate-50 text-slate-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Vị trí kệ <span className="text-rose-500">*</span></label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                 <Input 
                   placeholder="Khu vực (VD: Khu A)" 
                   className="text-sm" 
                   value={addForm.zone} 
                   error={addFormErrors.zone}
                   onChange={e => {
                     setAddForm({...addForm, zone: e.target.value});
                     if (addFormErrors.zone) setAddFormErrors(prev => ({...prev, zone: ''}));
                   }} 
                 />
                 <Input 
                   placeholder="Tầng (VD: Tầng 1)" 
                   className="text-sm" 
                   value={addForm.floor} 
                   error={addFormErrors.floor}
                   onChange={e => {
                     setAddForm({...addForm, floor: e.target.value});
                     if (addFormErrors.floor) setAddFormErrors(prev => ({...prev, floor: ''}));
                   }} 
                 />
                 <Input 
                   placeholder="Kệ (VD: Kệ 1)" 
                   className="text-sm" 
                   value={addForm.shelf} 
                   error={addFormErrors.shelf}
                   onChange={e => {
                     setAddForm({...addForm, shelf: e.target.value});
                     if (addFormErrors.shelf) setAddFormErrors(prev => ({...prev, shelf: ''}));
                   }} 
                 />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tình trạng vật lý</label>
              <Input placeholder="Nguyên vẹn, Rách bìa..." className="w-full text-sm" value={addForm.condition} onChange={e => setAddForm({...addForm, condition: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Trạng thái lưu thông</label>
              <select 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm"
                value={addForm.status}
                onChange={e => setAddForm({...addForm, status: e.target.value})}
              >
                <option value="AVAILABLE">Sẵn sàng</option>
                <option value="BORROWED">Đang mượn</option>
                <option value="DAMAGED">Đã thanh lý / Hỏng</option>
                <option value="LOST">Báo mất</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!editingRow}
        onClose={() => setEditingRow(null)}
        title="Chỉnh sửa bản sao"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingRow(null)}>Hủy</Button>
            <Button variant="primary" onClick={handleSaveEdit}>
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
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Vị trí kệ <span className="text-rose-500">*</span></label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                   <Input 
                     placeholder="Khu vực" 
                     className="text-sm" 
                     value={editForm.zone} 
                     error={editFormErrors.zone}
                     onChange={e => {
                       setEditForm({...editForm, zone: e.target.value});
                       if (editFormErrors.zone) setEditFormErrors(prev => ({...prev, zone: ''}));
                     }} 
                   />
                   <Input 
                     placeholder="Tầng" 
                     className="text-sm" 
                     value={editForm.floor} 
                     error={editFormErrors.floor}
                     onChange={e => {
                       setEditForm({...editForm, floor: e.target.value});
                       if (editFormErrors.floor) setEditFormErrors(prev => ({...prev, floor: ''}));
                     }} 
                   />
                   <Input 
                     placeholder="Kệ" 
                     className="text-sm" 
                     value={editForm.shelf} 
                     error={editFormErrors.shelf}
                     onChange={e => {
                       setEditForm({...editForm, shelf: e.target.value});
                       if (editFormErrors.shelf) setEditFormErrors(prev => ({...prev, shelf: ''}));
                     }} 
                   />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tình trạng vật lý</label>
                <Input placeholder="Ghi chú hỏng hóc..." className="w-full text-sm" value={editForm.condition} onChange={e => setEditForm({...editForm, condition: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Trạng thái lưu thông</label>
                <select 
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm"
                  value={editForm.status}
                  onChange={e => setEditForm({...editForm, status: e.target.value})}
                >
                  <option value="AVAILABLE">Sẵn sàng</option>
                  <option value="BORROWED">Đang mượn</option>
                  <option value="DAMAGED">Đã thanh lý / Hỏng</option>
                  <option value="LOST">Báo mất</option>
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
              onClick={handleConfirmDelete}
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

      {/* Modal Xác nhận Thanh lý */}
      <Modal
        isOpen={!!retiringRow}
        onClose={handleCloseRetire}
        title="Xác nhận thanh lý bản sao"
        footer={
          <>
            <Button variant="outline" onClick={handleCloseRetire} disabled={isRetiring}>Hủy bỏ</Button>
            <Button
              variant="primary"
              className="!bg-amber-600 hover:!bg-amber-700 !border-amber-600 text-white"
              onClick={handleConfirmRetire}
              disabled={isRetiring || retiringRow?.rawStatus === 'BORROWED' || isCopyRetired(retiringRow?.rawStatus)}
            >
              {isRetiring ? 'Đang xử lý...' : 'Xác nhận Thanh lý'}
            </Button>
          </>
        }
      >
        {retiringRow && (
          <div className="flex items-start gap-4 p-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Archive className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1 space-y-3">
              <h3 className="text-sm font-bold text-slate-800">
                Bạn có chắc chắn muốn thanh lý bản sao này không?
              </h3>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                <p className="font-bold text-slate-800 text-sm">{retiringRow.title}</p>
                <p className="text-xs font-mono text-slate-600">
                  <span className="font-semibold text-slate-700">Mã Barcode:</span> {retiringRow.barcode}
                </p>
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Vị trí lưu kho:</span> {retiringRow.location}
                </p>
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Trạng thái hiện tại:</span> {retiringRow.status}
                </p>
              </div>

              {retiringRow.rawStatus === 'BORROWED' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-700 flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>Bản sao đang được mượn. Quy tắc nghiệp vụ (UC09) không cho phép thanh lý bản sao đang lưu thông.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Lý do thanh lý / Ghi chú tình trạng
                </label>
                <input
                  type="text"
                  placeholder="VD: Hư hỏng nặng không thể phục hồi, sách cũ nát thanh lý..."
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  value={retireReason}
                  onChange={(e) => setRetireReason(e.target.value)}
                />
              </div>

              <p className="text-xs font-medium text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200/60 flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-1.5"></span>
                <span>Bản sao sau khi thanh lý sẽ chuyển sang trạng thái <strong>DAMAGED (Đã thanh lý / ngừng lưu thông)</strong> theo API Backend, bị loại khỏi tồn khả dụng. Hành động này không thể hoàn tác dễ dàng.</span>
              </p>
            </div>
          </div>
        )}
      </Modal>
        </>
      )}
    </div>
  );
}
