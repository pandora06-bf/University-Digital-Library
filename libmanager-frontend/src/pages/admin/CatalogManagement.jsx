import { useState, useEffect, useCallback, useRef } from 'react';
import axiosInstance from '../../services/axios_instance';
import { 
  Plus, Search, BookType, LayoutGrid, Clock, Edit2, Trash2,
  RotateCcw, Circle, LayoutList, BookCopy, Upload
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import {
  ADMIN_MOCK_BOOKS,
  ADMIN_MOCK_CATEGORIES,
  getLocalBookPrice,
  setLocalBookPrice,
  resolveBookPrice,
} from '../../mocks/adminCatalogMock';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { getApiErrorMessage } from '../../services/errorHandler';

const formatVND = (val) => {
  if (val === undefined || val === null || val === '') return null;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
};

const getCatalogColumns = (onEdit, onDelete, navigate, categories = []) => [
  {
    key: 'cover',
    header: 'Bìa',
    align: 'center',
    render: (value, row) => {
      const coverSrc = value || row.cover || row.cover_image_path;
      if (!coverSrc) {
        return (
          <div className="w-10 h-14 bg-indigo-50 rounded flex items-center justify-center border border-indigo-100 mx-auto text-indigo-400 shrink-0">
            <BookType className="w-5 h-5" />
          </div>
        );
      }
      return (
        <div className="relative w-10 h-14 mx-auto shrink-0">
          <img
            src={coverSrc}
            alt={row.title ? `Bìa: ${row.title}` : 'Ảnh bìa sách'}
            className="w-10 h-14 object-cover rounded border border-indigo-100 bg-slate-100"
            onError={(e) => {
              e.currentTarget.classList.add('hidden');
              const fallback = e.currentTarget.nextElementSibling;
              if (fallback) {
                fallback.classList.remove('hidden');
                fallback.classList.add('flex');
              }
            }}
          />
          <div className="hidden w-10 h-14 bg-indigo-50 rounded items-center justify-center border border-indigo-100 text-indigo-400 absolute inset-0">
            <BookType className="w-5 h-5" />
          </div>
        </div>
      );
    }
  },
  {
    key: 'title',
    header: 'Tên Sách & Mã ISBN',
    render: (value, row) => {
      const priceVal = resolveBookPrice(row);
      const priceText = formatVND(priceVal);
      const isEbook = row.book_type === 'EBOOK' || row.bookType === 'eBook';
      const isbnText = row.isbn && row.isbn !== 'N/A' ? row.isbn : null;
      // Chỉ hiện barcode thật từ dữ liệu; không tạo mã giả kiểu BC-{id}000
      const realBarcode = row.copy_barcode || (row.barcode && !String(row.barcode).startsWith('BC-') ? row.barcode : null);

      return (
        <div className="min-w-[200px]">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <button 
              onClick={() => navigate(`/admin/books/${row.id}`)} 
              className="font-bold text-slate-800 text-left leading-snug line-clamp-2 hover:text-indigo-600 transition-colors cursor-pointer"
              title="Xem chi tiết tồn kho và bản sao"
            >
              {row.title}
            </button>
            {isEbook ? (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                eBook
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                Vật lý
              </span>
            )}
            {(row.book_attribute || row.bookAttribute) && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {row.book_attribute || row.bookAttribute}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono flex-wrap">
            <span>
              {isbnText || 'Chưa có ISBN'}
              {realBarcode ? ` • ${realBarcode}` : ''}
            </span>
            {priceText ? (
              <span className="text-emerald-700 font-sans font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                {priceText}
              </span>
            ) : (
              <span className="text-slate-500 font-sans font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                Chưa có giá bìa
              </span>
            )}
          </div>
        </div>
      );
    }
  },
  {
    key: 'author',
    header: 'Tác Giả & Nhà Xuất Bản',
    render: (value, row) => (
      <div className="min-w-[150px]">
        <span className="font-bold text-slate-700 block truncate">{row.author}</span>
        <span className="text-[11px] text-slate-500 block mt-1 truncate">{row.publisher}</span>
      </div>
    )
  },
  {
    key: 'category',
    header: 'Thể Loại',
    render: (value, row) => {
      const cat = categories.find(c => c.id === row.category_id);
      const catName = cat ? cat.category_name : (row.category || 'Chưa phân loại');
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold text-center leading-tight bg-blue-50 text-blue-600`}>
          {catName}
        </span>
      );
    }
  },
  {
    key: 'year',
    header: 'Năm Xuất Bản',
    align: 'center',
    render: (value, row) => (
      <span className="font-mono text-slate-600">{row.year || row.publication_year}</span>
    )
  },
  {
    key: 'copies',
    header: 'Số Bản Sao (Sẵn Sàng)',
    render: (value, row) => {
      const totalCopies = row.copies ?? (row.available_stock || 0);
      const availableCopies = row.available ?? (row.available_stock || 0);
      const percent = totalCopies > 0 ? Math.round((availableCopies / totalCopies) * 100) : 0;

      return (
        <div className="min-w-[140px] group cursor-pointer" onClick={() => navigate(`/admin/books/${row.id}`)} title="Xem chi tiết tồn kho và bản sao">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-slate-800 text-xs group-hover:text-indigo-600 transition-colors">
              {availableCopies} / {totalCopies} <span className="font-normal text-slate-500">cuốn</span>
            </span>
            <span className="text-[10px] font-bold text-indigo-600 group-hover:text-indigo-700 transition-colors">
              {percent}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full transition-colors ${availableCopies === 0 ? 'bg-rose-500 group-hover:bg-rose-600' : 'bg-indigo-500 group-hover:bg-indigo-600'}`} 
              style={{ width: `${percent}%` }}
            ></div>
          </div>
        </div>
      );
    }
  },
  {
    key: 'status',
    header: 'Trạng Thái',
    render: (value, row) => {
      if (row.status === 'Hết bản hiện' || row.status === 'Hết bản in') {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 whitespace-nowrap">
            {row.status}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
          <Circle className={`w-1.5 h-1.5 fill-current ${
            row.statusColor === 'indigo' ? 'text-indigo-600' : 
            row.statusColor === 'emerald' ? 'text-emerald-500' : 
            'text-blue-500'
          }`} />
          {row.status}
        </span>
      );
    }
  },
  {
    key: 'actions',
    header: 'Thao Tác',
    align: 'right',
    render: (value, row) => (
      <div className="flex items-center justify-end gap-2 transition-opacity">
        <button 
          onClick={() => navigate(`/admin/books/${row.id}`)}
          title="Tồn kho"
          className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors">
          <BookCopy className="w-4 h-4" />
        </button>
        <button 
          onClick={() => onEdit(row)}
          title="Sửa"
          className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors">
          <Edit2 className="w-4 h-4" />
        </button>
        <button 
          onClick={() => onDelete(row)}
          title="Xóa"
          className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )
  }
];

export default function CatalogManagement() {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [editingBook, setEditingBook] = useState(null);
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [deletingBook, setDeletingBook] = useState(null);
  
  // Form State for Validation
  const [bookForm, setBookForm] = useState({ 
    title: '', isbn: '', author: '', publisher: '', year: '', 
    bookType: 'Vật lý', categoryId: '', subject: '', courseCode: '', description: '', keywords: '',
    price: '', numPages: '', previewPages: '', bookAttribute: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [coverFile, setCoverFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [booksData, setBooksData] = useState([]);
  const [categories, setCategories] = useState(ADMIN_MOCK_CATEGORIES);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [useMockCatalog, setUseMockCatalog] = useState(false);

  // 4-17.a: phân trang server + debounce tìm kiếm
  const PAGE_SIZE = 10;
  const SEARCH_DEBOUNCE_MS = 350;
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [publisherFilter, setPublisherFilter] = useState('Tất cả nhà xuất bản');
  const [statusFilter, setStatusFilter] = useState('Tất cả tình trạng');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const fetchSeqRef = useRef(0);

  const mapBookRow = useCallback((b) => {
    const mockMatch = ADMIN_MOCK_BOOKS.find((m) => String(m.id) === String(b.id));
    const uiPrice =
      b.price ??
      b.book_price ??
      getLocalBookPrice(b.id) ??
      mockMatch?.price ??
      mockMatch?.book_price ??
      null;

    return {
      ...b,
      id: b.id,
      cover: b.cover_image_path || mockMatch?.cover_image_path || null,
      title: b.title,
      isbn: b.isbn || mockMatch?.isbn || 'N/A',
      barcode: b.copy_barcode || b.barcode || mockMatch?.barcode || null,
      author: b.author || 'Đang cập nhật',
      publisher: b.publisher || 'Đang cập nhật',
      category_id: b.category_id,
      category: b.category_id ? 'Thể loại ' + b.category_id : 'Chưa phân loại',
      categoryColor: 'blue',
      year: b.publication_year || b.published_year || 2024,
      copies: b.available_stock ?? 0,
      available: b.available_stock ?? 0,
      status: (b.available_stock === 0) ? 'Hết bản in' : 'Sẵn sàng',
      statusColor: (b.available_stock === 0) ? 'rose' : 'emerald',
      book_type: b.book_type || 'PRINTED',
      bookType: (b.book_type === 'EBOOK' || b.bookType === 'eBook') ? 'eBook' : 'Vật lý',
      price: uiPrice,
      book_price: uiPrice,
      num_pages: b.num_pages ?? mockMatch?.num_pages ?? null,
      preview_pages: b.preview_pages ?? b.ebook?.preview_pages ?? mockMatch?.preview_pages ?? null,
      book_attribute: b.book_attribute || b.attribute || mockMatch?.book_attribute || '',
      subject_code: b.subject_code || mockMatch?.subject_code || '',
    };
  }, []);

  const applyMockPage = useCallback((pageNum, q, catId, publisher) => {
    const qLower = (q || '').trim().toLowerCase();
    let rows = ADMIN_MOCK_BOOKS.map(mapBookRow);
    if (qLower) {
      rows = rows.filter((item) =>
        item.title.toLowerCase().includes(qLower) ||
        item.author.toLowerCase().includes(qLower) ||
        (item.barcode || '').toLowerCase().includes(qLower) ||
        (item.isbn || '').toLowerCase().includes(qLower)
      );
    }
    if (catId) {
      rows = rows.filter((item) => item.category_id && item.category_id.toString() === catId);
    }
    if (publisher && publisher !== 'Tất cả nhà xuất bản') {
      rows = rows.filter((item) => item.publisher === publisher);
    }
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, pageNum), pages);
    const start = (safePage - 1) * PAGE_SIZE;
    setBooksData(rows.slice(start, start + PAGE_SIZE));
    setTotalItems(total);
    setTotalPages(pages);
    if (safePage !== pageNum) setPage(safePage);
  }, [mapBookRow]);

  const fetchBooks = useCallback(async (opts = {}) => {
    const pageNum = opts.page ?? page;
    const q = opts.q !== undefined ? opts.q : debouncedSearch;
    const catId = opts.categoryId !== undefined ? opts.categoryId : categoryFilter;
    const publisher = opts.publisher !== undefined ? opts.publisher : publisherFilter;

    if (useMockCatalog) {
      applyMockPage(pageNum, q, catId, publisher);
      return;
    }

    const seq = ++fetchSeqRef.current;
    setIsLoadingBooks(true);
    try {
      const params = {
        page: pageNum,
        page_size: PAGE_SIZE,
      };
      if (q && q.trim()) params.q = q.trim();
      if (catId) params.category_id = catId;
      if (publisher && publisher !== 'Tất cả nhà xuất bản') params.publisher = publisher;

      const res = await axiosInstance.get('/api/books/search', { params });
      if (seq !== fetchSeqRef.current) return;

      const data = res.data || {};
      const items = data.items || [];
      setBooksData(items.map(mapBookRow));
      const total = data.total ?? items.length;
      setTotalItems(total);
      setTotalPages(Math.max(1, data.total_pages ?? (Math.ceil(total / PAGE_SIZE) || 1)));
    } catch (error) {
      if (seq !== fetchSeqRef.current) return;
      console.warn('Backend API chưa sẵn sàng, dùng mock danh mục phân trang:', error?.message);
      setUseMockCatalog(true);
      applyMockPage(pageNum, q, catId, publisher);
    } finally {
      if (seq === fetchSeqRef.current) setIsLoadingBooks(false);
    }
  }, [
    page, debouncedSearch, categoryFilter, publisherFilter,
    useMockCatalog, applyMockPage, mapBookRow,
  ]);

  const fetchCategories = () => {
    axiosInstance.get('/api/admin/categories').then(res => {
      if (res.data && res.data.length > 0) {
        setCategories(res.data);
      }
    }).catch(error => {
      console.warn('Backend API chưa sẵn sàng, tiếp tục sử dụng mock categories:', error?.message);
    });
  };

  // Debounce ô tìm kiếm → chỉ khi ổn định mới gọi API
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    // Defer để tránh setState đồng bộ trong body effect (react-hooks/set-state-in-effect)
    const timer = window.setTimeout(() => {
      fetchBooks({ page, q: debouncedSearch });
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch khi page/filter ổn định
  }, [page, debouncedSearch, categoryFilter, publisherFilter, useMockCatalog]);

  const handleOpenAdd = () => {
    setBookForm({ 
      title: '', isbn: '', author: '', publisher: '', year: '', 
      bookType: 'Vật lý', categoryId: '', subject: '', courseCode: '', description: '', keywords: '',
      price: '', numPages: '', previewPages: '', bookAttribute: ''
    });
    setFormErrors({});
    setIsAddingBook(true);
  };

  const handleOpenEdit = (book) => {
    setBookForm({
      title: book.title || '',
      isbn: book.isbn || '',
      author: book.author || '',
      publisher: book.publisher || '',
      year: book.year || book.publication_year || '',
      bookType: (book.bookType === 'eBook' || book.book_type === 'EBOOK') ? 'eBook' : 'Vật lý',
      categoryId: book.category_id !== undefined && book.category_id !== null ? book.category_id.toString() : '',
      subject: book.subject || book.subject_name || '',
      courseCode: book.subject_code || book.courseCode || '',
      description: book.description || '',
      keywords: book.keywords || '',
      price: (() => {
        const p = resolveBookPrice(book);
        return p !== null && p !== undefined ? String(p) : '';
      })(),
      numPages: (book.num_pages !== undefined && book.num_pages !== null) ? book.num_pages.toString() : (book.numPages || ''),
      previewPages: (book.preview_pages !== undefined && book.preview_pages !== null)
        ? book.preview_pages.toString()
        : (book.previewPages !== undefined && book.previewPages !== null
          ? book.previewPages.toString()
          : (book.ebook?.preview_pages !== undefined && book.ebook?.preview_pages !== null
            ? book.ebook.preview_pages.toString()
            : '')),
      bookAttribute: book.book_attribute || book.attribute || book.bookAttribute || ''
    });
    setFormErrors({});
    setEditingBook(book);
  };

  const handleCloseModal = () => {
    setIsAddingBook(false);
    setEditingBook(null);
    setCoverFile(null);
    setPdfFile(null);
    setFormErrors({});
  };

  const handleFieldChange = (field, value) => {
    setBookForm(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => {
        const nextErrors = { ...prev };
        delete nextErrors[field];
        return nextErrors;
      });
    }
    if (field === 'bookType' && value !== 'eBook' && formErrors.previewPages) {
      setFormErrors(prev => {
        const nextErrors = { ...prev };
        delete nextErrors.previewPages;
        return nextErrors;
      });
    }
  };

  const handleSaveBook = async () => {
    const errors = {};

    // 1. Tên sách (title): Bắt buộc, max 255 ký tự
    const trimmedTitle = bookForm.title?.trim() || '';
    if (!trimmedTitle) {
      errors.title = 'Tên sách không được để trống';
    } else if (trimmedTitle.length > 255) {
      errors.title = 'Tên sách không được vượt quá 255 ký tự';
    }

    // 2. Tác giả (author): Bắt buộc, max 150 ký tự, phải chứa ít nhất một chữ cái (không cho phép chỉ toàn số)
    const trimmedAuthor = bookForm.author?.trim() || '';
    if (!trimmedAuthor) {
      errors.author = 'Tác giả không được để trống';
    } else if (trimmedAuthor.length > 150) {
      errors.author = 'Tên tác giả không được vượt quá 150 ký tự';
    } else if (!/\p{L}/u.test(trimmedAuthor)) {
      errors.author = 'Tên tác giả phải chứa ít nhất một chữ cái';
    }

    // 3. Nhà xuất bản (publisher): Bắt buộc, max 150 ký tự, phải chứa ít nhất một chữ cái (cho phép cả chữ và số như 123 Publishing, NXB 1)
    const trimmedPublisher = bookForm.publisher?.trim() || '';
    if (!trimmedPublisher) {
      errors.publisher = 'Nhà xuất bản không được để trống';
    } else if (trimmedPublisher.length > 150) {
      errors.publisher = 'Tên nhà xuất bản không được vượt quá 150 ký tự';
    } else if (!/\p{L}/u.test(trimmedPublisher)) {
      errors.publisher = 'Tên nhà xuất bản phải chứa ít nhất một chữ cái';
    }

    // 4. Năm xuất bản (year): Bắt buộc, số nguyên từ 1000 đến 2100 theo schema backend
    const trimmedYear = bookForm.year !== undefined && bookForm.year !== null
      ? bookForm.year.toString().trim()
      : '';
    if (!trimmedYear) {
      errors.year = 'Năm xuất bản không được để trống';
    } else if (!/^\d+$/.test(trimmedYear)) {
      errors.year = 'Năm xuất bản phải là số nguyên (chỉ gồm các chữ số)';
    } else {
      const yearNum = parseInt(trimmedYear, 10);
      if (yearNum < 1000 || yearNum > 2100) {
        errors.year = 'Năm xuất bản phải nằm trong khoảng từ 1000 đến 2100';
      }
    }

    // 5. Thể loại (categoryId): Bắt buộc, phải tồn tại trong danh mục đang tải
    const trimmedCatId = bookForm.categoryId !== undefined && bookForm.categoryId !== null
      ? bookForm.categoryId.toString().trim()
      : '';
    if (!trimmedCatId) {
      errors.categoryId = 'Vui lòng chọn thể loại sách';
    } else {
      const selectedCatId = parseInt(trimmedCatId, 10);
      const isValidCategory = !isNaN(selectedCatId) && categories.some(c => c.id === selectedCatId);
      if (!isValidCategory) {
        errors.categoryId = 'Thể loại đã chọn không hợp lệ trong danh mục';
      }
    }

    // 6. Số trang (numPages): Tùy chọn; nếu nhập phải là số nguyên dương >= 1
    let validNumPages = null;
    const trimmedPages = bookForm.numPages !== undefined && bookForm.numPages !== null
      ? bookForm.numPages.toString().trim()
      : '';
    if (trimmedPages !== '') {
      if (!/^\d+$/.test(trimmedPages)) {
        errors.numPages = 'Số trang phải là số nguyên dương (không chứa chữ cái, số âm hay số thập phân)';
      } else {
        const pageVal = parseInt(trimmedPages, 10);
        if (pageVal < 1) {
          errors.numPages = 'Số trang phải lớn hơn hoặc bằng 1';
        } else {
          validNumPages = pageVal;
        }
      }
    }

    // 7. Số trang xem trước (previewPages): Chỉ áp dụng cho eBook (PDF) theo đặc tả UC09 (5–10 trang)
    let validPreviewPages = null;
    if (bookForm.bookType === 'eBook') {
      const trimmedPreview = bookForm.previewPages !== undefined && bookForm.previewPages !== null
        ? bookForm.previewPages.toString().trim()
        : '';
      if (trimmedPreview !== '') {
        if (!/^\d+$/.test(trimmedPreview)) {
          errors.previewPages = 'Số trang xem trước phải là số nguyên dương (không chứa chữ cái, số âm hay số thập phân)';
        } else {
          const previewVal = parseInt(trimmedPreview, 10);
          if (previewVal < 1) {
            errors.previewPages = 'Số trang xem trước phải là số nguyên dương (từ 5 đến 10 trang)';
          } else if (previewVal < 5 || previewVal > 10) {
            errors.previewPages = 'Số trang xem trước theo quy định từ 5 đến 10 trang';
          } else if (validNumPages && previewVal > validNumPages) {
            errors.previewPages = `Số trang xem trước (${previewVal}) không được vượt quá tổng số trang (${validNumPages})`;
          } else {
            validPreviewPages = previewVal;
          }
        }
      }
    }

    // Giá bìa (BE đã có field price ≥ 0)
    const trimmedPrice = bookForm.price !== undefined && bookForm.price !== null
      ? bookForm.price.toString().trim()
      : '';
    let validPrice = 0;
    if (trimmedPrice !== '') {
      if (!/^\d+$/.test(trimmedPrice)) {
        errors.price = 'Giá bìa phải là số nguyên không âm (VNĐ)';
      } else {
        validPrice = parseInt(trimmedPrice, 10);
      }
    }

    // Nếu có lỗi validation, dừng ngay và không gọi API
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    // Ghi chú API contract:
    // 1. subject_code được Pydantic schema BookBase hỗ trợ (tối đa 50 ký tự, liên kết bảng subjects).
    // 2. book_attribute và preview_pages chưa có trong model/schema Backend → không gửi (tránh 422).
    // 3. price đã có trên BE → gửi trong payload.
    const payload = {
      title: trimmedTitle,
      author: trimmedAuthor,
      publisher: trimmedPublisher,
      publication_year: parseInt(trimmedYear, 10),
      price: validPrice,
      description: bookForm.description?.trim() || null,
      book_type: bookForm.bookType === "eBook" ? "EBOOK" : "PRINTED",
      category_id: parseInt(trimmedCatId, 10),
      keywords: bookForm.keywords?.trim() || null,
      num_pages: validNumPages,
      subject_code: bookForm.courseCode?.trim() || null
    };

    try {
      let savedBook = null;
      let bookId = null;

      if (editingBook) {
        const res = await axiosInstance.put(`/api/admin/books/${editingBook.id}`, payload);
        savedBook = res.data;
      } else {
        const res = await axiosInstance.post('/api/admin/books', payload);
        savedBook = res.data;
      }

      if (savedBook) {
        bookId = savedBook.id || (editingBook ? editingBook.id : null);

        // Gọi API Upload Ảnh Bìa (nếu có chọn file)
        if (bookId && coverFile) {
          const coverData = new FormData();
          coverData.append('file', coverFile);
          await axiosInstance.post(`/api/admin/books/${bookId}/upload-cover`, coverData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }

        // Gọi API Upload PDF (nếu có chọn file và sách là eBook)
        if (bookId && pdfFile && payload.book_type === 'EBOOK') {
          const pdfData = new FormData();
          pdfData.append('file', pdfFile);
          await axiosInstance.post(`/api/admin/books/${bookId}/upload-pdf`, pdfData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }

        // Đồng bộ cache FE (phòng khi list API chưa trả price ngay)
        setLocalBookPrice(bookId, validPrice);

        // Cập nhật state nội bộ để giữ preview_pages, book_attribute, giá bìa khi sửa lại trong session
        setBooksData(prev => prev.map(b => {
          if (b.id === bookId) {
            return {
              ...b,
              ...payload,
              preview_pages: validPreviewPages,
              previewPages: validPreviewPages,
              book_attribute: bookForm.bookAttribute || null,
              bookAttribute: bookForm.bookAttribute || null,
              subject_code: payload.subject_code,
              courseCode: payload.subject_code,
              price: validPrice,
              book_price: validPrice,
            };
          }
          return b;
        }));

        showToast(
          editingBook ? 'Cập nhật đầu sách thành công!' : 'Thêm sách mới thành công!',
          'success'
        );
        handleCloseModal();
        fetchBooks(); // Load lại data (vẫn merge giá local)
      } else {
        showToast('Không nhận được dữ liệu phản hồi từ máy chủ.', 'error');
      }
    } catch (error) {
      console.error('Lỗi lưu sách:', error);
      const errorMsg = getApiErrorMessage(error, 'Không thể lưu sách. Vui lòng kiểm tra lại thông tin.');
      showToast(errorMsg, 'error');
      // Giữ nguyên modal và form data để người dùng sửa lại
    }
  };

  const confirmDelete = async () => {
    if (!deletingBook) return;
    try {
      await axiosInstance.delete(`/api/admin/books/${deletingBook.id}`);
      showToast('Đã xóa đầu sách thành công!', 'success');
      setDeletingBook(null);
      fetchBooks();
    } catch (error) {
      console.error('Lỗi xóa sách:', error);
      const errorMsg = getApiErrorMessage(error, 'Không thể xóa sách. Vui lòng thử lại.');
      showToast(errorMsg, 'error');
      setDeletingBook(null);
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryFormName.trim()) {
      showToast('Tên thể loại không được để trống.', 'warning');
      return;
    }
    setIsSavingCategory(true);
    try {
      if (editingCategory?.id != null) {
        await axiosInstance.put(`/api/admin/categories/${editingCategory.id}`, {
          category_name: categoryFormName.trim(),
        });
        showToast('Cập nhật thể loại thành công!', 'success');
      } else {
        await axiosInstance.post('/api/admin/categories', {
          category_name: categoryFormName.trim(),
        });
        showToast('Thêm thể loại mới thành công!', 'success');
      }
      fetchCategories();
      setIsAddingCategory(false);
      setEditingCategory(null);
      setCategoryFormName('');
    } catch (error) {
      console.error('Lỗi lưu thể loại:', error);
      const errorMsg = getApiErrorMessage(error, 'Không thể lưu thể loại.');
      showToast(errorMsg, 'error');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deletingCategory?.id) return;
    setIsSavingCategory(true);
    try {
      await axiosInstance.delete(`/api/admin/categories/${deletingCategory.id}`);
      showToast(`Đã xóa thể loại «${deletingCategory.category_name}».`, 'success');
      setDeletingCategory(null);
      fetchCategories();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không thể xóa thể loại (có thể đang được dùng bởi sách).'), 'error');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const catalogColumns = getCatalogColumns(handleOpenEdit, setDeletingBook, navigate, categories);

  // Lọc tình trạng trên trang hiện tại (API chưa có filter status tồn)
  const filteredData = statusFilter === 'Tất cả tình trạng'
    ? booksData
    : booksData.filter((item) => item.status === statusFilter);

  const totalBooks = totalItems;
  const uniqueCategories = categories.length || 0;
  const recentBooksCount = Math.min(totalItems, 5);
  const isSearching = searchTerm !== debouncedSearch;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      <Toast toast={toast} onClose={hideToast} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Danh mục Sách</h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý đầu sách, thể loại, tác giả và nhà xuất bản trong thư viện số.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingCategory(null);
              setCategoryFormName('');
              setIsAddingCategory(true);
            }}
          >
            Quản lý thể loại
          </Button>
          <Button 
            variant="primary" 
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            Thêm đầu sách mới
          </Button>
        </div>
      </div>

      {useMockCatalog && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Đang dùng dữ liệu mẫu</p>
          <p className="text-amber-800/90 mt-0.5 text-[13px]">
            Không kết nối được danh mục trên máy chủ. Danh sách hiện tại chỉ để xem giao diện.
          </p>
        </div>
      )}

      {/* 3 Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-6 right-6">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <BookType className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 mb-2">Tổng số đầu sách</p>
          <h3 className="text-4xl font-extrabold text-slate-800 flex items-baseline gap-2">
            {totalBooks} <span className="text-sm font-medium text-slate-500">tựa sách</span>
          </h3>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">Toàn hệ thống</span>
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-6 right-6">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <LayoutGrid className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 mb-2">Thể loại & Chủ đề</p>
          <h3 className="text-4xl font-extrabold text-slate-800">{uniqueCategories} <span className="text-base font-bold text-slate-500">chuyên ngành</span></h3>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium truncate pr-4">Đã được ghi nhận</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-6 right-6">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <Clock className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 mb-2">Mới nhập gần đây</p>
          <h3 className="text-4xl font-extrabold text-slate-800">{recentBooksCount} <span className="text-base font-bold text-slate-500">đầu sách</span></h3>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Circle className="w-2 h-2 fill-indigo-400 text-indigo-400" />
              <span className="text-[11px] font-medium text-slate-500">
                {useMockCatalog ? 'Hiển thị dữ liệu mẫu' : 'Trên trang hiện tại'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
        
        {/* Filters Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-slate-50/50 rounded-t-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 w-full xl:w-auto flex-1">
            {/* Search */}
            <div className="w-full">
              <Input
                type="text"
                placeholder="Tìm tên sách, tác giả, ISBN… (tự tìm sau 0,35 giây)"
                leftIcon={<Search className="w-4 h-4" />}
                className="!h-10 !rounded-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Category Dropdown */}
            <select 
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả thể loại</option>
              {categories.map(c => (
                <option key={c.id} value={c.id.toString()}>{c.category_name}</option>
              ))}
            </select>

            {/* Publisher Dropdown */}
            <select 
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              value={publisherFilter}
              onChange={(e) => {
                setPublisherFilter(e.target.value);
                setPage(1);
              }}
            >
              <option>Tất cả nhà xuất bản</option>
              <option>NXB Trẻ</option>
              <option>NXB Giáo Dục</option>
              <option>O'Reilly Media</option>
              <option>NXB Prentice Hall</option>
              <option>NXB ĐHQG Hà Nội</option>
              <option>NXB Thế Giới</option>
              <option>NXB Lao Động Xã Hội</option>
            </select>

            {/* Status Dropdown */}
            <select 
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>Tất cả tình trạng</option>
              <option>Sẵn sàng</option>
              <option>Đang lưu hành</option>
              <option>Mượn nhiều</option>
              <option>Hết bản in</option>
            </select>
          </div>
          
          <div className="flex items-center gap-3 justify-between w-full xl:w-auto shrink-0 border-t xl:border-0 border-slate-200 pt-3 xl:pt-0">
            <Button 
              variant="ghost" 
              size="sm" 
              className="!bg-transparent !p-0 !h-auto !px-2 !text-slate-500 hover:!text-slate-800"
              onClick={() => {
                setSearchTerm('');
                setDebouncedSearch('');
                setCategoryFilter('');
                setPublisherFilter('Tất cả nhà xuất bản');
                setStatusFilter('Tất cả tình trạng');
                setPage(1);
              }}
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Đặt lại bộ lọc
            </Button>
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <Button 
                variant="ghost" size="sm"
                onClick={() => setViewMode('list')}
                className={`!h-7 !w-7 !p-0 !rounded-md ${viewMode === 'list' ? '!bg-white !text-indigo-600 shadow-sm hover:!bg-white' : '!text-slate-400 hover:!text-slate-600 hover:!bg-transparent'}`}
              >
                <LayoutList className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" size="sm"
                onClick={() => setViewMode('grid')}
                className={`!h-7 !w-7 !p-0 !rounded-md ${viewMode === 'grid' ? '!bg-white !text-indigo-600 shadow-sm hover:!bg-white' : '!text-slate-400 hover:!text-slate-600 hover:!bg-transparent'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {(isLoadingBooks || isSearching) && (
          <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 bg-slate-50/80">
            {isSearching ? 'Đang chờ gõ xong để tìm…' : 'Đang tải danh mục từ máy chủ…'}
          </div>
        )}

        {/* Table / Grid — phân trang phía server */}
        {viewMode === 'list' ? (
          <Table 
            columns={catalogColumns}
            data={filteredData}
            hideHeader={false}
            pagination={true}
            loading={isLoadingBooks}
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={setPage}
            emptyMessage={isLoadingBooks ? 'Đang tải…' : 'Không tìm thấy đầu sách nào'}
          />
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 bg-slate-50">
            {filteredData.map(row => (
              <div key={row.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                {/* Image Placeholder & Status Badge */}
                <div className="relative aspect-[3/4] bg-indigo-50/50 border-b border-slate-100 flex flex-col items-center justify-center text-indigo-300">
                  <BookType className="w-16 h-16 mb-4 opacity-50" />
                  <span className="font-mono text-sm font-medium text-indigo-400/70">{row.barcode}</span>
                  
                  <div className="absolute top-3 left-3">
                    {row.status === 'Hết bản hiện' || row.status === 'Hết bản in' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-sm">
                        {row.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/90 backdrop-blur-sm text-slate-700 shadow-sm">
                        <Circle className={`w-1.5 h-1.5 fill-current ${
                          row.statusColor === 'indigo' ? 'text-indigo-600' : 
                          row.statusColor === 'emerald' ? 'text-emerald-500' : 
                          'text-blue-500'
                        }`} />
                        {row.status}
                      </span>
                    )}
                  </div>
                  <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        className="bg-white/90 backdrop-blur-sm text-slate-500 hover:text-indigo-600 p-2 rounded-full shadow-md hover:bg-indigo-50 transition-colors"
                        onClick={() => setEditingBook(row)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        className="bg-white/90 backdrop-blur-sm text-slate-500 hover:text-rose-600 p-2 rounded-full shadow-md hover:bg-rose-50 transition-colors"
                        onClick={() => setDeletingBook(row)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                  </div>
                </div>
                
                {/* Info */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="mb-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-center leading-tight mb-2 ${
                        row.categoryColor === 'indigo' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {row.category}
                    </span>
                    <h4 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 mb-1" title={row.title}>{row.title}</h4>
                    <p className="text-[11px] text-slate-500 font-mono mb-2">{row.isbn}</p>
                    <p className="text-xs font-semibold text-slate-600 truncate">{row.author}</p>
                  </div>
                  
                  {/* Progress Bar (Pushed to bottom) */}
                  <div className="mt-auto">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-800 text-xs">{row.available} / {row.copies} <span className="font-normal text-slate-500">cuốn</span></span>
                      <span className="text-[10px] font-bold text-indigo-600">{Math.round((row.available/row.copies)*100)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${row.available === 0 ? 'bg-rose-500' : 'bg-indigo-500'}`} 
                        style={{ width: `${(row.available/row.copies)*100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filteredData.length === 0 && (
              <p className="col-span-full text-center text-sm text-slate-400 py-10">
                {isLoadingBooks ? 'Đang tải…' : 'Không tìm thấy đầu sách nào'}
              </p>
            )}
          </div>
        )}

        {viewMode === 'grid' && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-white rounded-b-2xl">
            <span className="text-sm text-slate-500">
              Trang <strong className="font-semibold text-slate-700">{page}</strong> / {totalPages}
              <span className="text-slate-400"> · {totalItems} bản ghi</span>
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Trước
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Sau
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* Modal Quản lý thể loại — GET/POST/PUT/DELETE /api/admin/categories */}
      <Modal 
        isOpen={isAddingCategory} 
        onClose={() => {
          setIsAddingCategory(false);
          setEditingCategory(null);
          setCategoryFormName('');
        }}
        title={editingCategory ? 'Sửa thể loại' : 'Quản lý thể loại'}
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-100">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700 truncate">{cat.category_name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50"
                    title="Sửa"
                    onClick={() => {
                      setEditingCategory(cat);
                      setCategoryFormName(cat.category_name || '');
                    }}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                    title="Xóa"
                    onClick={() => setDeletingCategory(cat)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="px-3 py-4 text-sm text-slate-400 text-center">Chưa có thể loại.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              {editingCategory ? 'Tên thể loại (sửa)' : 'Thêm thể loại mới'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <Input 
              value={categoryFormName}
              onChange={(e) => setCategoryFormName(e.target.value)}
              className="w-full" 
              placeholder="VD: Tâm lý học, Khoa học dữ liệu..."
              autoFocus
            />
          </div>
          <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => {
                if (editingCategory) {
                  setEditingCategory(null);
                  setCategoryFormName('');
                } else {
                  setIsAddingCategory(false);
                }
              }}
              disabled={isSavingCategory}
            >
              {editingCategory ? 'Hủy sửa' : 'Đóng'}
            </Button>
            <Button variant="primary" onClick={handleSaveCategory} isLoading={isSavingCategory} disabled={!categoryFormName.trim()}>
              {editingCategory ? 'Cập nhật' : 'Thêm thể loại'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        title="Xóa thể loại"
        width="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Xóa thể loại <strong>«{deletingCategory?.category_name}»</strong>? Không xóa được nếu còn sách đang dùng.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeletingCategory(null)} disabled={isSavingCategory}>
              Hủy
            </Button>
            <Button
              variant="primary"
              className="!bg-rose-600 hover:!bg-rose-700"
              onClick={handleConfirmDeleteCategory}
              isLoading={isSavingCategory}
            >
              Xóa
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isAddingBook || !!editingBook}
        onClose={handleCloseModal}
        title={isAddingBook ? "Thêm sách mới" : "Chỉnh sửa thông tin sách"}
        footer={
          <>
            <Button variant="outline" onClick={handleCloseModal}>Hủy</Button>
            <Button variant="primary" onClick={handleSaveBook}>Lưu thay đổi</Button>
          </>
        }
      >
        <div className="space-y-4 h-[60vh] overflow-y-auto pr-2 pb-2 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tên sách <span className="text-rose-500">*</span></label>
              <Input 
                value={bookForm.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                className="w-full" 
                error={formErrors.title}
                placeholder="Nhập tên sách..."
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">ISBN</label>
              <Input 
                value={bookForm.isbn}
                onChange={(e) => handleFieldChange('isbn', e.target.value)}
                className="w-full" 
                placeholder="Nhập mã ISBN..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tác giả <span className="text-rose-500">*</span></label>
              <Input 
                value={bookForm.author}
                onChange={(e) => handleFieldChange('author', e.target.value)}
                className="w-full" 
                error={formErrors.author}
                placeholder="Nhập tên tác giả..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Nhà xuất bản <span className="text-rose-500">*</span></label>
              <Input 
                value={bookForm.publisher}
                onChange={(e) => handleFieldChange('publisher', e.target.value)}
                className="w-full" 
                error={formErrors.publisher}
                placeholder="Nhập nhà xuất bản..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Năm xuất bản <span className="text-rose-500">*</span></label>
              <Input 
                value={bookForm.year}
                onChange={(e) => handleFieldChange('year', e.target.value)}
                className="w-full" 
                error={formErrors.year}
                placeholder="VD: 2024"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Giá bìa (VNĐ)</label>
              <Input
                type="number"
                min="0"
                step="1"
                value={bookForm.price}
                onChange={(e) => handleFieldChange('price', e.target.value)}
                className="w-full"
                placeholder="VD: 150000"
                error={formErrors.price}
                helperText={!formErrors.price ? 'Lưu cùng đầu sách (giá bìa).' : undefined}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Số trang</label>
              <Input 
                value={bookForm.numPages}
                onChange={(e) => handleFieldChange('numPages', e.target.value)}
                className="w-full" 
                error={formErrors.numPages}
                placeholder="VD: 320"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Định dạng tài liệu</label>
              <select 
                className="w-full h-12 px-4 bg-white border border-[#D9E2EE] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 rounded-xl text-sm font-medium text-slate-700 focus:outline-none cursor-pointer transition-all"
                value={bookForm.bookType}
                onChange={(e) => handleFieldChange('bookType', e.target.value)}
              >
                <option value="Vật lý">Vật lý</option>
                <option value="eBook">eBook</option>
              </select>
            </div>

            {bookForm.bookType === 'eBook' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Số trang xem trước (Preview Pages)
                </label>
                <Input 
                  type="number"
                  min="1"
                  max="10"
                  value={bookForm.previewPages}
                  onChange={(e) => handleFieldChange('previewPages', e.target.value)}
                  className="w-full" 
                  error={formErrors.previewPages}
                  helperText={!formErrors.previewPages ? "Quy định từ 5 đến 10 trang cho eBook bản quyền" : undefined}
                  placeholder="VD: 10 (từ 5–10 trang)"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Thuộc tính sách
              </label>
              <select 
                className="w-full h-12 px-4 bg-white border border-[#D9E2EE] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 rounded-xl text-sm font-medium text-slate-700 focus:outline-none cursor-pointer transition-all"
                value={bookForm.bookAttribute}
                onChange={(e) => handleFieldChange('bookAttribute', e.target.value)}
              >
                <option value="">-- Chưa phân loại thuộc tính --</option>
                <option value="Giáo trình">Giáo trình</option>
                <option value="Tài liệu tham khảo">Tài liệu tham khảo</option>
                <option value="Sách bài tập">Sách bài tập</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Thể loại <span className="text-rose-500">*</span>
              </label>
              <select 
                className={`w-full h-12 px-4 bg-white border ${formErrors.categoryId ? 'border-[#BE123C] focus:border-[#BE123C] focus:ring-2 focus:ring-[#BE123C]/20' : 'border-[#D9E2EE] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20'} rounded-xl text-sm font-medium text-slate-700 focus:outline-none cursor-pointer transition-all`}
                value={bookForm.categoryId}
                onChange={(e) => handleFieldChange('categoryId', e.target.value)}
              >
                <option value="">-- Chọn thể loại sách --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.category_name}</option>
                ))}
              </select>
              {formErrors.categoryId && (
                <p className="text-[14px] leading-[20px] font-normal text-[#BE123C] mt-1.5 flex items-center gap-1.5">
                  <svg className="w-4 h-4 inline-block shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{formErrors.categoryId}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Chủ đề / Môn học</label>
              <Input 
                value={bookForm.subject}
                onChange={(e) => handleFieldChange('subject', e.target.value)}
                className="w-full" 
                placeholder="VD: Cấu trúc dữ liệu..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Mã học phần</label>
              <Input 
                value={bookForm.courseCode}
                onChange={(e) => handleFieldChange('courseCode', e.target.value)}
                className="w-full" 
                placeholder="VD: IT, ECO, ENG, MATH..."
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Từ khóa</label>
              <Input 
                value={bookForm.keywords}
                onChange={(e) => handleFieldChange('keywords', e.target.value)}
                className="w-full" 
                error={formErrors.keywords}
                placeholder="Phân tách bằng dấu phẩy..."
              />
            </div>
            
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Mô tả</label>
              <textarea 
                value={bookForm.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                className={`w-full px-4 py-3 bg-white border ${formErrors.description ? 'border-[#BE123C] focus:border-[#BE123C] focus:ring-2 focus:ring-[#BE123C]/20' : 'border-[#D9E2EE] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20'} rounded-xl text-sm font-medium text-slate-700 focus:outline-none resize-none h-24 transition-all`}
                placeholder="Nhập tóm tắt nội dung sách..."
              />
              {formErrors.description && (
                <p className="text-[14px] leading-[20px] font-normal text-[#BE123C] mt-1.5 flex items-center gap-1.5">
                  <svg className="w-4 h-4 inline-block shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{formErrors.description}</span>
                </p>
              )}
            </div>

            {/* Khu vực tải tệp */}
            <div className="col-span-1 sm:col-span-2 border-t border-slate-100 pt-4 mt-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-2">
                <Upload className="w-3.5 h-3.5" />
                Tải lên ảnh bìa
              </label>
              <label className="flex items-center justify-between gap-3 w-full px-4 py-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 cursor-pointer hover:bg-slate-100 hover:border-indigo-400 transition-colors">
                <span className="text-sm font-medium text-slate-700 truncate">
                  {coverFile ? coverFile.name : 'Chọn ảnh bìa từ máy tính'}
                </span>
                <span className="shrink-0 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">
                  Chọn ảnh
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                />
              </label>
              {editingBook && editingBook.cover_image_path && !coverFile && (
                <p className="text-[11px] text-slate-500 mt-2">Đang dùng ảnh bìa hiện tại. Chọn ảnh mới để thay đổi.</p>
              )}
            </div>

            {bookForm.bookType === 'eBook' && (
              <div className="col-span-1 sm:col-span-2 border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5 text-rose-500" />
                  Tải lên tệp PDF (eBook)
                </label>
                <label className="flex items-center justify-between gap-3 w-full px-4 py-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 cursor-pointer hover:bg-slate-100 hover:border-rose-400 transition-colors">
                  <span className="text-sm font-medium text-slate-700 truncate">
                    {pdfFile ? pdfFile.name : 'Chọn tệp PDF từ máy tính'}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg">
                    Chọn tệp
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deletingBook}
        onClose={() => setDeletingBook(null)}
        title="Xác nhận xóa sách"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingBook(null)}>Hủy bỏ</Button>
            <Button variant="primary" className="!bg-rose-600 hover:!bg-rose-700 !border-rose-600" onClick={confirmDelete}>
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
            <h3 className="text-sm font-bold text-slate-800 leading-snug">
              Bạn có chắc chắn muốn xóa đầu sách này không?
            </h3>
            <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="font-bold block">{deletingBook?.title}</span>
              <span className="text-xs font-mono text-slate-500 mt-1 block">Barcode: {deletingBook?.barcode}</span>
            </p>
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
