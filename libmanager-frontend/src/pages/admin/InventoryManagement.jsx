import { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, 
  CheckCircle2, ArrowLeftRight, AlertOctagon, BookCopy, Trash2, Edit2, Archive
} from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axiosInstance from '../../services/axios_instance';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { getApiErrorMessage } from '../../services/errorHandler';
import { AdminIconButton } from '../../components/AdminIconButton';
import { BookTypeBadge } from '../../components/BookTypeBadge';

export default function InventoryManagement() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, showToast, hideToast } = useToast();

  // Chọn đầu sách: gõ mã/tên hoặc chọn trong danh sách đủ kho.
  const [bookPickMode, setBookPickMode] = useState('type'); // 'type' | 'suggest'
  const [booksList, setBooksList] = useState([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [bookPickerQuery, setBookPickerQuery] = useState('');

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
    condition: ''
  });

  const [editForm, setEditForm] = useState({
    zone: '', floor: '', shelf: '', status: '', condition: ''
  });

  const inventoryBasePath = location.pathname.startsWith('/admin/books')
    ? '/admin/books'
    : '/admin/inventory';

  const mergeBookIntoList = (book) => {
    if (!book?.id) return;
    setBooksList((prev) => {
      const rest = prev.filter((b) => String(b.id) !== String(book.id));
      return [book, ...rest];
    });
  };

  const loadBookSuggestions = async (q = '') => {
    setIsLoadingBooks(true);
    try {
      const items = [];
      const query = q.trim();
      for (let page = 1; page <= 40; page += 1) {
        const res = await axiosInstance.get('/api/books/search', {
          params: { page, page_size: 50, ...(query ? { q: query } : {}) },
        });
        const batch = res.data?.items || [];
        items.push(...batch);
        const totalPages = Number(res.data?.total_pages) || 1;
        if (page >= totalPages || batch.length === 0) break;
      }
      setBooksList(items);
    } catch (error) {
      setBooksList([]);
      showToast(getApiErrorMessage(error, 'Không tải được danh sách đầu sách.'), 'error');
    } finally {
      setIsLoadingBooks(false);
    }
  };

  // Gợi ý gồm mọi đầu sách đang dùng, không dừng ở 50 cuốn đầu.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadBookSuggestions('');
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapCopyStatusLabel = (status) => {
    if (status === 'AVAILABLE') return 'Sẵn sàng';
    if (status === 'BORROWED') return 'Đang cho mượn';
    if (status === 'LOST') return 'Báo mất';
    if (status === 'DAMAGED') return 'Hư hỏng';
    if (status === 'RETIRED') return 'Đã thanh lý';
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

  // Ngừng lưu thông: không đưa lại Sẵn sàng (UC09).
  const isLiquidatedStatus = (status) =>
    status === 'DAMAGED' || status === 'RETIRED' || status === 'LOST';
  // Đang mượn / đã ngừng: không đổi status tay trên form sửa.
  const isStatusLocked = (status) => isLiquidatedStatus(status) || status === 'BORROWED';

  // SRS UC09: tình trạng vật lý = damage_notes (ghi chú); không mirror status lưu thông.
  const mapConditionLabel = (damageNotes) => {
    const note = typeof damageNotes === 'string' ? damageNotes.trim() : '';
    return note || 'Nguyên vẹn';
  };

  const mapCopyRow = (c, targetBook) => ({
    id: c.copy_barcode || c.barcode,
    barcode: c.copy_barcode || c.barcode,
    location: `${c.zone} - ${c.floor} - ${c.shelf}`,
    status: mapCopyStatusLabel(c.status),
    statusType: mapCopyStatusType(c.status),
    condition: mapConditionLabel(c.damage_notes),
    title: targetBook?.title || '...',
    author: targetBook?.author || '',
    rawZone: c.zone,
    rawFloor: c.floor,
    rawShelf: c.shelf,
    rawStatus: c.status,
    rawCondition: c.damage_notes,
  });

  const fetchInventory = async (targetBookId, currentBookInfo) => {
    const idToFetch = targetBookId || bookId;
    if (!idToFetch) return;
    const targetBook = currentBookInfo || bookInfo;
    try {
      const res = await axiosInstance.get(`/api/admin/books/${idToFetch}/copies`);
      let copies = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      // Fallback: chi tiết sách đã có locations — tránh bảng trống khi copies lỗi shape
      if (!copies.length && Array.isArray(targetBook?.locations) && targetBook.locations.length) {
        copies = targetBook.locations;
      }
      setTableData(copies.map((c) => mapCopyRow(c, targetBook)));
    } catch (error) {
      const fallback = Array.isArray(targetBook?.locations) ? targetBook.locations : [];
      if (fallback.length) {
        setTableData(fallback.map((c) => mapCopyRow(c, targetBook)));
        showToast('Dùng vị trí từ chi tiết sách (API copies lỗi).', 'warning');
      } else {
        setTableData([]);
        showToast(
          getApiErrorMessage(error, 'Không tải được danh sách bản sao.'),
          'error'
        );
      }
    }
  };

  // Danh mục search chỉ loại đầu sách đã vô hiệu hóa, nên sách 404 ở cổng bạn đọc vẫn tìm được ở đây.
  const findActiveCatalogBook = async (id) => {
    for (let page = 1; page <= 40; page += 1) {
      const res = await axiosInstance.get('/api/books/search', {
        params: { page, page_size: 50 },
      });
      const items = res.data?.items || [];
      const found = items.find((book) => String(book.id) === String(id));
      if (found) return found;
      const totalPages = Number(res.data?.total_pages) || 1;
      if (page >= totalPages || items.length === 0) break;
    }
    return null;
  };

  // Nạp đúng đầu sách theo ID trên URL; reset lọc bảng mỗi lần đổi sách
  useEffect(() => {
    let isMounted = true;
    const timer = window.setTimeout(() => {
      if (!bookId) {
        if (!isMounted) return;
        setBookInfo(null);
        setTableData([]);
        return;
      }

      setSearchTerm('');
      setLocationFilter('ALL');
      setStatusFilter('ALL');

      axiosInstance
        .get(`/api/books/${bookId}`)
        .then((res) => {
          if (!isMounted) return;
          const found = res.data;
          setBookInfo(found);
          mergeBookIntoList(found);
          // Đồng bộ field theo chế độ đang dùng — không trộn hai ô
          if (bookPickMode === 'type') {
            setBookPickerQuery(String(found.id));
          } else {
            setBookPickerQuery('');
          }
          fetchInventory(bookId, found);
        })
        .catch(async (error) => {
          if (!isMounted) return;
          // Chi tiết bạn đọc trả 404 khi mọi bản in đã ngừng lưu hành, dù đầu sách vẫn is_active.
          // Không gọi API mới: tìm trong danh mục đang bật, rồi lấy bản sao ở endpoint kho sẵn có.
          const status = error?.response?.status;
          if (status === 404) {
            const apiMsg = getApiErrorMessage(error, '');
            const inactiveHint = /vô hiệu|ngừng lưu hành/i.test(apiMsg);
            let found;
            try {
              found = await findActiveCatalogBook(bookId);
            } catch {
              found = undefined;
            }
            if (!isMounted) return;
            if (!found) {
              try {
                const copiesRes = await axiosInstance.get(`/api/admin/books/${bookId}/copies`);
                const copies = Array.isArray(copiesRes.data)
                  ? copiesRes.data
                  : (copiesRes.data?.items || []);
                if (copies.length) {
                  found = { id: Number(bookId), title: `Đầu sách #${bookId}`, author: '' };
                }
              } catch {
                found = undefined;
              }
            }
            if (!isMounted) return;
            if (found) {
              setBookInfo(found);
              mergeBookIntoList(found);
              if (bookPickMode === 'type') setBookPickerQuery(String(found.id));
              fetchInventory(bookId, found);
              showToast(
                inactiveHint
                  ? 'Đầu sách đã vô hiệu hóa nhưng vẫn còn bản sao. Thanh lý/xóa bản trên Tồn kho trước khi xóa thể loại.'
                  : 'Đầu sách vẫn đang dùng. Mọi bản in đã thanh lý hoặc hỏng nên cổng bạn đọc không mở sách này.',
                'warning'
              );
              return;
            }
          }
          if (!isMounted) return;
          setBookInfo(null);
          setTableData([]);
          showToast(
            getApiErrorMessage(error, `Không tìm thấy đầu sách #${bookId}.`),
            'error'
          );
        });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const switchBookPickMode = (mode) => {
    setBookPickMode(mode);
    if (mode === 'type') {
      setBookPickerQuery(bookId ? String(bookId) : '');
      // không đụng booksList
    } else {
      setBookPickerQuery('');
      if (!booksList.length) loadBookSuggestions('');
    }
  };

  const handleSelectBook = (e) => {
    const newId = e.target.value;
    // Chế độ gợi ý: chọn là xong — không dùng ô gõ / nút Tra cứu
    setBookPickerQuery('');
    if (newId) {
      navigate(`${inventoryBasePath}/${newId}`);
    } else {
      navigate(inventoryBasePath);
    }
  };

  const handleBookPickerSubmit = async () => {
    if (bookPickMode !== 'type') {
      showToast('Đang dùng danh sách gợi ý — chọn dòng trong dropdown, không cần Tra cứu.', 'warning');
      return;
    }
    const q = bookPickerQuery.trim();
    if (!q) {
      showToast('Nhập mã sách (vd 207) hoặc từ khóa tên sách rồi Tra cứu.', 'warning');
      return;
    }

    // Chỉ số → mở đúng ID qua GET /api/books/{id}
    if (/^\d+$/.test(q) || /^#\d+$/.test(q)) {
      const id = q.replace(/^#/, '');
      navigate(`${inventoryBasePath}/${id}`);
      return;
    }

    // Mã vạch bản sao (BC-001-02) → mở đầu sách chứa bản đó
    const looksLikeBarcode = !/\s/.test(q) && /[A-Za-z]/.test(q) && /\d/.test(q) && q.includes('-');
    if (looksLikeBarcode) {
      const candidates = q === q.toUpperCase() ? [q] : [q, q.toUpperCase()];
      for (const code of candidates) {
        try {
          const { data } = await axiosInstance.get(`/api/admin/copies/${encodeURIComponent(code)}`);
          if (data?.book_id) {
            navigate(`${inventoryBasePath}/${data.book_id}`);
            showToast(`Mã ${data.copy_barcode} thuộc đầu sách #${data.book_id}.`, 'success');
            return;
          }
        } catch (error) {
          if (error?.response?.status !== 404) {
            showToast(getApiErrorMessage(error, 'Không tra được mã vạch.'), 'error');
            return;
          }
        }
      }
    }

    setIsLoadingBooks(true);
    try {
      const items = await (async () => {
        const found = [];
        for (let page = 1; page <= 40; page += 1) {
          const res = await axiosInstance.get('/api/books/search', {
            params: { q, page, page_size: 50 },
          });
          const batch = res.data?.items || [];
          found.push(...batch);
          const totalPages = Number(res.data?.total_pages) || 1;
          if (page >= totalPages || batch.length === 0) break;
        }
        return found;
      })();
      if (items.length === 1) {
        navigate(`${inventoryBasePath}/${items[0].id}`);
        showToast(`Đã chọn #${items[0].id} — ${items[0].title}`, 'success');
      } else if (items.length === 0) {
        showToast(`Không tìm thấy đầu sách cho «${q}».`, 'warning');
      } else if (items.length > 1) {
        // Nhiều kết quả → chuyển sang chế độ gợi ý để chọn 1 cuốn (không trộn ô gõ)
        setBooksList(items);
        setBookPickMode('suggest');
        setBookPickerQuery('');
        showToast(`Tìm thấy ${items.length} đầu sách — chọn trong danh sách gợi ý.`, 'success');
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không tìm được đầu sách.'), 'error');
    } finally {
      setIsLoadingBooks(false);
    }
  };

  const handleOpenEdit = async (row) => {
    setEditingRow(row);
    setEditFormErrors({});
    setEditForm({
      zone: row.rawZone || '',
      floor: row.rawFloor || '',
      shelf: row.rawShelf || '',
      status: row.rawStatus || 'AVAILABLE',
      condition: row.rawCondition || ''
    });
    // Đồng bộ chi tiết mới nhất từ BE (GET /api/admin/copies/{barcode})
    try {
      const { data } = await axiosInstance.get(`/api/admin/copies/${encodeURIComponent(row.barcode)}`);
      if (!data) return;
      setEditForm({
        zone: data.zone || '',
        floor: data.floor || '',
        shelf: data.shelf || '',
        status: data.status || 'AVAILABLE',
        condition: data.damage_notes || '',
      });
      setEditingRow((prev) => prev ? {
        ...prev,
        rawZone: data.zone,
        rawFloor: data.floor,
        rawShelf: data.shelf,
        rawStatus: data.status,
        rawCondition: data.damage_notes,
      } : prev);
    } catch {
      /* giữ form từ hàng bảng nếu API lỗi */
    }
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
      const payload = {
        zone: editForm.zone.trim(),
        floor: editForm.floor.trim(),
        shelf: editForm.shelf.trim(),
        damage_notes: editForm.condition ? editForm.condition.trim() : null,
      };
      // Bản đang mượn / đã ngừng lưu thông: chỉ sửa vị trí và ghi chú, không gửi status.
      if (!isStatusLocked(editingRow.rawStatus)) {
        payload.status = editForm.status;
      }
      await axiosInstance.patch(`/api/admin/copies/${editingRow.barcode}/condition`, payload);
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
      showToast('Không thể thanh lý: bản sao đang được mượn.', 'warning');
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
      showToast('Không thể thanh lý bản sao đang được mượn.', 'warning');
      return;
    }
    if (isCopyRetired(retiringRow.rawStatus)) {
      showToast('Bản sao này đã ở trạng thái "Đã thanh lý".', 'warning');
      return;
    }

    setIsRetiring(true);
    try {
      const note = retireReason.trim()
        ? `[Thanh lý] ${retireReason.trim()}`
        : (retiringRow.rawCondition
          ? `[Thanh lý] ${retiringRow.rawCondition}`
          : '[Thanh lý] Ngừng lưu thông');
      await axiosInstance.patch(`/api/admin/copies/${retiringRow.barcode}/condition`, {
        status: 'RETIRED',
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
    if (!addForm.barcode.trim()) errors.barcode = 'Mã vạch không được để trống';
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
        status: 'AVAILABLE',
        damage_notes: addForm.condition ? addForm.condition.trim() : null
      });
      showToast('Thêm bản sao thành công!', 'success');
      setShowAddModal(false);
      setAddForm({ barcode: '', zone: 'Khu A', floor: 'Tầng 1', shelf: 'Kệ 1', condition: '' });
      fetchInventory(bookId, bookInfo); // Refresh bảng
    } catch (error) {
      console.error('Lỗi thêm bản sao:', error);
      const errorMsg = getApiErrorMessage(error, 'Không thể thêm bản sao. Vui lòng kiểm tra lại thông tin.');
      showToast(errorMsg, 'error');
      // Giữ nguyên modal setShowAddModal(true) và addForm để người dùng sửa lại
    }
  };

  // Tạo danh sách vị trí / trạng thái duy nhất từ dữ liệu thật (không hiện option dư)
  const availableLocations = Array.from(
    new Set(tableData.map(item => item.location).filter(Boolean))
  ).sort();

  const STATUS_FILTER_META = [
    { value: 'AVAILABLE', label: 'Sẵn sàng' },
    { value: 'BORROWED', label: 'Đang cho mượn' },
    { value: 'DAMAGED', label: 'Hư hỏng' },
    { value: 'LOST', label: 'Báo mất' },
    { value: 'RETIRED', label: 'Đã thanh lý' },
  ];
  const presentRawStatuses = new Set(
    tableData.map((item) => item.rawStatus).filter(Boolean)
  );
  const availableStatusFilters = STATUS_FILTER_META.filter((opt) =>
    presentRawStatuses.has(opt.value)
  );
  // Nhóm "Đã loại / Bảo quản" (mất/hỏng/thanh lý) — chỉ hiện option khi thật sự có bản
  const hasIssueCopies = ['DAMAGED', 'LOST', 'RETIRED'].some((s) => presentRawStatuses.has(s));

  useEffect(() => {
    if (statusFilter === 'ALL') return;
    const statuses = new Set(tableData.map((item) => item.rawStatus).filter(Boolean));
    let next = null;
    if (statusFilter === 'ISSUE') {
      const stillHasIssue = ['DAMAGED', 'LOST', 'RETIRED'].some((s) => statuses.has(s));
      if (!stillHasIssue) next = 'ALL';
    } else if (!statuses.has(statusFilter)) {
      next = 'ALL';
    }
    if (!next) return undefined;
    // Defer để tránh setState đồng bộ trong body effect (react-hooks/set-state-in-effect)
    const timer = window.setTimeout(() => setStatusFilter(next), 0);
    return () => window.clearTimeout(timer);
  }, [statusFilter, tableData]);

  // Filter Data
  const filteredData = tableData.filter(item => {
    const matchSearch = !searchTerm || 
      item.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchLocation = locationFilter === 'ALL' || item.location === locationFilter;
    const matchStatus =
      statusFilter === 'ALL'
      || (statusFilter === 'ISSUE' && ['DAMAGED', 'LOST', 'RETIRED'].includes(item.rawStatus))
      || item.rawStatus === statusFilter;
    
    return matchSearch && matchLocation && matchStatus;
  });

  // Custom Columns with Navigation
  const inventoryColumns = [
    {
      key: 'barcode',
      header: 'Mã vạch',
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
            {row.author || '—'}
          </span>
        </div>
      )
    },
    {
      key: 'location',
      header: 'Vị Trí Kệ',
      render: (val) => (
        <span className="text-sm text-slate-700 block max-w-[140px] truncate" title={val || undefined}>
          {val || '—'}
        </span>
      ),
    },
    {
      key: 'condition',
      header: 'Tình trạng',
      headerTitle: 'Tình trạng vật lý (ghi chú damage_notes)',
      render: (val, row) => {
        const label = val || mapConditionLabel(row.rawCondition);
        const isPristine = label === 'Nguyên vẹn';
        return (
          <span
            className={`inline-flex max-w-[11rem] items-center px-2.5 py-1 rounded-md text-xs font-semibold border leading-snug break-words whitespace-normal text-left ${
              isPristine
                ? 'bg-slate-50 text-slate-700 border-slate-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
            title={label}
          >
            {label}
          </span>
        );
      }
    },
    {
      key: 'status',
      header: 'Trạng thái',
      headerTitle: 'Trạng thái lưu thông (AVAILABLE / BORROWED / …)',
      render: (val, row) => {
        let colors = '';
        if (row.statusType === 'success') colors = 'bg-emerald-50 text-emerald-600 border-emerald-200';
        else if (row.statusType === 'warning') colors = 'bg-amber-50 text-amber-600 border-amber-200';
        else if (row.statusType === 'danger') colors = 'bg-rose-50 text-rose-600 border-rose-200';
        else if (row.statusType === 'retired') colors = 'bg-slate-100 text-slate-600 border-slate-300';
        
        let navAction = null;
        let navTitle = '';
        if (val === 'Đang mượn' || val === 'Đang cho mượn') {
          navAction = () => navigate(`/admin/loans?barcode=${encodeURIComponent(row.barcode || '')}`);
          navTitle = 'Mở quầy nhận trả với mã này';
        } else if (val === 'Sẵn sàng' || row.rawStatus === 'AVAILABLE') {
          navAction = () => navigate(
            `/admin/loans?checkout_barcode=${encodeURIComponent(row.barcode || '')}`
          );
          navTitle = 'Đưa mã này sang quầy xuất mượn (giữ phiếu đang làm)';
        }
        if (val === 'Báo mất') {
          navAction = () => navigate('/admin/incidents');
          navTitle = 'Sang Báo mất / Hỏng';
        }
        
        return (
          <button 
            type="button"
            onClick={navAction || undefined}
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${colors} ${navAction ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
            title={navTitle || undefined}
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
          <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
            <AdminIconButton
              onClick={() => handleOpenRetire(row)}
              className={`w-8 h-8 rounded-full transition-colors ${
                canRetire
                  ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 cursor-pointer shadow-xs'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200 cursor-pointer opacity-70'
              }`}
              title={
                isBorrowed
                  ? 'Bản sao đang cho mượn, không thể thanh lý'
                  : isRetired
                    ? 'Bản sao đã thanh lý'
                    : 'Thanh lý bản sao'
              }
            >
              <Archive className="w-4 h-4" />
            </AdminIconButton>
            <AdminIconButton
              onClick={() => handleOpenEdit(row)}
              className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
              title="Chỉnh sửa"
            >
              <Edit2 className="w-4 h-4" />
            </AdminIconButton>
            <AdminIconButton
              onClick={() => {
                if (row.rawStatus !== 'AVAILABLE') {
                  showToast(
                    'Chỉ xóa bản Sẵn sàng (chưa từng lưu thông). Bản đã mượn/mất/hỏng hãy dùng Thanh lý.',
                    'warning'
                  );
                  return;
                }
                setDeletingRow(row);
              }}
              className={`w-8 h-8 rounded-full transition-colors ${
                row.rawStatus === 'AVAILABLE'
                  ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-pointer opacity-70'
              }`}
              title={
                row.rawStatus === 'AVAILABLE'
                  ? 'Xóa bản sao'
                  : 'Không xóa được — dùng Thanh lý để ngừng lưu thông'
              }
            >
              <Trash2 className="w-4 h-4" />
            </AdminIconButton>
          </div>
        );
      }
    }
  ];

  const totalCopies = tableData.length;
  const availableCopies = tableData.filter(c => c.rawStatus === 'AVAILABLE').length;
  const availablePercent = totalCopies > 0 ? Math.round((availableCopies / totalCopies) * 100) : 0;
  const borrowedCopies = tableData.filter(c => c.rawStatus === 'BORROWED').length;
  const brokenCopies = tableData.filter((c) =>
    ['DAMAGED', 'LOST', 'RETIRED'].includes(c.rawStatus)
  ).length;
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

        {/* Chọn đầu sách — chỉ 1 trong 2: gõ tay hoặc danh sách gợi ý */}
        <div className="w-full sm:max-w-xl flex flex-col gap-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-semibold text-slate-700">
              Chọn đầu sách
              {isLoadingBooks && <span className="text-indigo-600 font-normal text-xs ml-1">(Đang tải…)</span>}
            </span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  bookPickMode === 'type' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => switchBookPickMode('type')}
              >
                Gõ mã / tên
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  bookPickMode === 'suggest' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => switchBookPickMode('suggest')}
              >
                Danh sách gợi ý
              </button>
            </div>
          </div>

          {bookPickMode === 'type' ? (
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="inventory-book-picker"
                  className="flex-1 min-w-0"
                  placeholder="Mã sách, mã vạch hoặc tên"
                  value={bookPickerQuery}
                  onChange={(e) => setBookPickerQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBookPickerSubmit()}
                />
                <Button
                  type="button"
                  variant="outline"
                  icon={<Search className="w-4 h-4" />}
                  disabled={isLoadingBooks}
                  onClick={handleBookPickerSubmit}
                >
                  Tra cứu
                </Button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Nhập ID đầu sách, mã vạch bản sao hoặc tên rồi Tra cứu. Nhiều kết quả theo tên sẽ chuyển sang danh sách gợi ý.
              </p>
            </>
          ) : (
            <>
              <select
                id="inventory-book-select"
                className="w-full h-10 px-3 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-lg text-sm font-medium text-slate-700 focus:outline-none cursor-pointer transition-all truncate shadow-xs"
                value={bookId ? bookId.toString() : ''}
                onChange={handleSelectBook}
              >
                <option value="">-- Chọn đầu sách --</option>
                {booksList.map((b) => (
                  <option key={b.id} value={b.id}>
                    #{b.id} — {b.title}{b.author ? ` (${b.author})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Danh sách gồm mọi đầu sách đang dùng. Chọn một dòng là mở tồn kho ngay.
              </p>
            </>
          )}
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
            <Button
              variant="outline"
              icon={<BookCopy className="w-4 h-4" />}
              onClick={() => navigate('/admin/catalog')}
            >
              Đến trang Danh mục Sách
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Subheader khi đã chọn sách */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-white px-4 sm:px-5 py-4 rounded-2xl border border-slate-200 shadow-xs min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono shrink-0">
                  Mã #{bookInfo?.id || bookId}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 truncate min-w-0">
                  {bookInfo?.title || 'Đang tải thông tin sách...'}
                </h2>
                {bookInfo?.book_type && <BookTypeBadge type={bookInfo.book_type} />}
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate">
                Tác giả: <span className="font-semibold text-slate-700">{bookInfo?.author || 'Chưa cập nhật'}</span>
                {bookInfo?.publisher && <> • NXB: <span className="font-semibold text-slate-700">{bookInfo.publisher}</span></>}
                {(bookInfo?.publication_year || bookInfo?.year) && <> • Năm: <span className="font-semibold text-slate-700">{bookInfo?.publication_year || bookInfo?.year}</span></>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:shrink-0">
              <Button
                variant="outline"
                icon={<Filter className="w-4 h-4" />}
                onClick={() => {
                  const borrowed = tableData.find((c) => c.rawStatus === 'BORROWED');
                  if (borrowed?.barcode) {
                    navigate(`/admin/loans?barcode=${encodeURIComponent(borrowed.barcode)}`);
                    return;
                  }
                  // Không có bản đang mượn → vẫn vào quầy, kèm book_id để FE gợi ý
                  const id = bookInfo?.id || bookId;
                  navigate(id ? `/admin/loans?book_id=${encodeURIComponent(id)}` : '/admin/loans');
                }}
              >
                Xem Phiếu Mượn
              </Button>
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

      {/* 4 Stats Cards — màu/tint giống Users · eBook */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden transition-colors ${
            statusFilter === 'ALL' ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <BookCopy className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tổng bản sao vật lý</p>
          <h3 className="text-3xl font-extrabold text-slate-800 leading-none">
            {totalCopies} <span className="text-sm font-medium text-slate-500">cuốn</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-slate-500">Bấm để xem tất cả</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('AVAILABLE')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/40 transition-colors ${
            statusFilter === 'AVAILABLE' ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-emerald-100 hover:border-emerald-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sẵn sàng trên kệ</p>
          <h3 className="text-3xl font-extrabold text-emerald-600 leading-none">
            {availableCopies} <span className="text-sm font-medium text-emerald-500">cuốn</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-emerald-600">Bấm để lọc sẵn sàng · {availablePercent}%</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('BORROWED')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-amber-50/40 transition-colors ${
            statusFilter === 'BORROWED' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-amber-100 hover:border-amber-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <ArrowLeftRight className="w-6 h-6 text-amber-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Đang cho mượn</p>
          <h3 className="text-3xl font-extrabold text-amber-600 leading-none">
            {borrowedCopies} <span className="text-sm font-medium text-amber-500">cuốn</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-amber-600">Bấm để lọc đang mượn</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('ISSUE')}
          className={`text-left bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-rose-50/30 transition-colors ${
            statusFilter === 'ISSUE' ? 'border-rose-400 ring-2 ring-rose-200' : 'border-rose-100 hover:border-rose-300'
          }`}
        >
          <div className="absolute top-4 right-4">
            <AlertOctagon className="w-6 h-6 text-rose-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Đã loại / Bảo quản</p>
          <h3 className="text-3xl font-extrabold text-rose-600 leading-none">
            {brokenCopies} <span className="text-sm font-medium text-rose-400">cuốn</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-rose-600">Bấm để lọc mất, hỏng, đã thanh lý · {brokenPercent}%</p>
        </button>
      </div>

      {/* Main Content Area — filter bar đồng bộ Fines/Users */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-w-0 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl space-y-3">
          <div className="flex items-stretch gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <Input
                type="text"
                placeholder="Lọc theo mã vạch hoặc tên sách…"
                leftIcon={<Search className="w-4 h-4" />}
                className="!h-10 !rounded-lg font-mono placeholder:font-sans"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!searchTerm.trim()) {
                      showToast('Nhập mã vạch/tên sách rồi bấm Tra cứu (lọc bảng bên dưới).', 'warning');
                    }
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="primary"
              className="!h-10 shrink-0 px-3 sm:px-4"
              icon={<Search className="w-4 h-4" />}
              onClick={() => {
                if (!searchTerm.trim()) {
                  showToast('Nhập mã vạch/tên sách rồi bấm Tra cứu (lọc bảng bên dưới).', 'warning');
                }
              }}
            >
              Tra cứu
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              aria-label="Lọc theo vị trí kệ"
              className="h-10 w-full min-w-0 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="ALL">Vị trí kệ (khu/tầng/dãy)</option>
              {availableLocations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <select
              aria-label="Lọc theo trạng thái lưu thông"
              className="h-10 w-full min-w-0 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Trạng thái lưu thông (tất cả)</option>
              {availableStatusFilters.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
              {hasIssueCopies && (
                <option value="ISSUE">Đã loại / Bảo quản</option>
              )}
            </select>
          </div>
        </div>

        {/* Table Preset */}
        <Table 
          columns={inventoryColumns}
          data={filteredData}
          pagination
          itemsPerPage={10}
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
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Mã vạch <span className="text-rose-500">*</span></label>
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
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase leading-snug mb-1.5">
              Vị trí kệ <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
              <div className="min-w-0">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Khu</label>
                <Input
                  placeholder="VD: Khu A"
                  className="text-sm"
                  value={addForm.zone}
                  error={addFormErrors.zone}
                  onChange={(e) => {
                    setAddForm({ ...addForm, zone: e.target.value });
                    if (addFormErrors.zone) setAddFormErrors((prev) => ({ ...prev, zone: '' }));
                  }}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tầng</label>
                <Input
                  placeholder="VD: Tầng 1"
                  className="text-sm"
                  value={addForm.floor}
                  error={addFormErrors.floor}
                  onChange={(e) => {
                    setAddForm({ ...addForm, floor: e.target.value });
                    if (addFormErrors.floor) setAddFormErrors((prev) => ({ ...prev, floor: '' }));
                  }}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dãy</label>
                <Input
                  placeholder="VD: Dãy 1 / Kệ 1"
                  className="text-sm"
                  value={addForm.shelf}
                  error={addFormErrors.shelf}
                  onChange={(e) => {
                    setAddForm({ ...addForm, shelf: e.target.value });
                    if (addFormErrors.shelf) setAddFormErrors((prev) => ({ ...prev, shelf: '' }));
                  }}
                />
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-bold text-slate-700 uppercase leading-snug mb-1.5">
              Tình trạng vật lý
            </label>
            <Input
              placeholder="Nguyên vẹn, Rách bìa..."
              className="w-full text-sm"
              value={addForm.condition}
              onChange={(e) => setAddForm({ ...addForm, condition: e.target.value })}
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-bold text-slate-700 uppercase leading-snug mb-1.5">
              Trạng thái lưu thông
            </label>
            <Input defaultValue="Sẵn sàng" disabled className="w-full bg-slate-50 text-slate-500" />
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
              Bản sao mới luôn vào kho ở trạng thái Sẵn sàng. Mượn / mất / hỏng do nghiệp vụ quầy, không chọn tay.
            </p>
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
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Mã vạch</label>
              <Input defaultValue={editingRow.barcode} disabled className="w-full font-mono bg-slate-50 text-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tên đầu sách</label>
              <Input defaultValue={editingRow.title} disabled className="w-full bg-slate-50 text-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Vị trí kệ <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Khu</label>
                  <Input
                    placeholder="VD: Khu A"
                    className="text-sm"
                    value={editForm.zone}
                    error={editFormErrors.zone}
                    onChange={(e) => {
                      setEditForm({ ...editForm, zone: e.target.value });
                      if (editFormErrors.zone) setEditFormErrors((prev) => ({ ...prev, zone: '' }));
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tầng</label>
                  <Input
                    placeholder="VD: Tầng 1"
                    className="text-sm"
                    value={editForm.floor}
                    error={editFormErrors.floor}
                    onChange={(e) => {
                      setEditForm({ ...editForm, floor: e.target.value });
                      if (editFormErrors.floor) setEditFormErrors((prev) => ({ ...prev, floor: '' }));
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dãy</label>
                  <Input
                    placeholder="VD: Dãy 1 / Kệ 1"
                    className="text-sm"
                    value={editForm.shelf}
                    error={editFormErrors.shelf}
                    onChange={(e) => {
                      setEditForm({ ...editForm, shelf: e.target.value });
                      if (editFormErrors.shelf) setEditFormErrors((prev) => ({ ...prev, shelf: '' }));
                    }}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase leading-snug mb-1.5">
                Tình trạng vật lý
              </label>
              <Input
                placeholder="Ghi chú hỏng hóc..."
                className="w-full text-sm"
                value={editForm.condition}
                onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })}
              />
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                Ghi chú vật lý (rách bìa, ướt…) — không đổi quyền cho mượn.
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase leading-snug mb-1.5">
                Trạng thái lưu thông
              </label>
              {isStatusLocked(editingRow.rawStatus) ? (
                <>
                  <Input
                    defaultValue={mapCopyStatusLabel(editingRow.rawStatus)}
                    disabled
                    className="w-full bg-slate-50 text-slate-500"
                  />
                  <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                    {editingRow.rawStatus === 'BORROWED'
                      ? 'Bản đang cho mượn — trạng thái do quầy trả/sự cố cập nhật, không sửa tay.'
                      : 'Bản đã ngừng lưu thông (mất / hỏng / thanh lý). Không đưa lại Sẵn sàng.'}
                  </p>
                </>
              ) : (
                <>
                  <select
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="AVAILABLE">Sẵn sàng</option>
                    <option value="RETIRED">Đã thanh lý</option>
                  </select>
                  <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                    Chỉ Sẵn sàng hoặc Thanh lý kho. Mất/hỏng khi đang mượn → quầy Sự cố / Trả sách.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Xác nhận Xóa bản sao */}
      <Modal
        isOpen={!!deletingRow}
        onClose={() => setDeletingRow(null)}
        title="Xóa bản sao"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingRow(null)}>Hủy bỏ</Button>
            <Button
              variant="primary"
              className="!bg-rose-600 hover:!bg-rose-700 !border-rose-600"
              onClick={handleConfirmDelete}
            >
              Xóa bản sao
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-4 p-2">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-6 h-6 text-rose-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-800">Xóa bản sao này?</h3>
            <div className="mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
              <p className="font-bold text-slate-800 text-sm">{deletingRow?.title}</p>
              <p className="text-xs font-mono text-slate-500">Mã vạch: {deletingRow?.barcode}</p>
              <p className="text-xs text-slate-500">Vị trí: {deletingRow?.location}</p>
            </div>
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
                  <span className="font-semibold text-slate-700">Mã vạch:</span> {retiringRow.barcode}
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
                  <span>Bản sao đang được mượn — không thể thanh lý khi còn trong lưu thông.</span>
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
                <span>Bản sao sau khi thanh lý sẽ chuyển sang trạng thái <strong>Đã thanh lý / ngừng lưu thông</strong>, bị loại khỏi tồn khả dụng. Hành động này không hoàn tác dễ dàng.</span>
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
