import { useState, useEffect, useCallback, useRef } from 'react';
import axiosInstance from '../../services/axios_instance';
import { 
  Plus, Search, BookType, LayoutGrid, Edit2, Trash2,
  Circle, LayoutList, BookCopy, Upload, Library
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import {
  SEED_PUBLISHERS,
  getLocalBookPrice,
  setLocalBookPrice,
  resolveBookPrice,
} from '../../mocks/adminCatalogMock';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { getApiErrorMessage } from '../../services/errorHandler';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { AdminIconButton } from '../../components/AdminIconButton';

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
      const coverSrc = resolveMediaUrl(value || row.cover || row.cover_image_path);
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
    header: 'Tên sách',
    render: (value, row) => {
      const priceVal = resolveBookPrice(row);
      const priceText = formatVND(priceVal);
      const bookType = row.book_type || row.bookType;
      const isEbook = bookType === 'EBOOK' || bookType === 'eBook';
      const isBoth = bookType === 'BOTH';
      // Chỉ hiện barcode thật từ dữ liệu; không tạo mã giả kiểu BC-{id}000
      const realBarcode = row.copy_barcode || (row.barcode && !String(row.barcode).startsWith('BC-') ? row.barcode : null);

      return (
        <div className="min-w-0 max-w-sm">
          <div className="flex items-center gap-1.5 min-w-0 mb-1">
            <button
              type="button"
              onClick={() => navigate(`/admin/books/${row.id}`)}
              className="font-bold text-slate-800 text-left truncate min-w-0 hover:text-indigo-600 transition-colors cursor-pointer"
              title={row.title || 'Xem chi tiết tồn kho và bản sao'}
            >
              {row.title}
            </button>
            {isBoth ? (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200 whitespace-nowrap">
                Cả hai
              </span>
            ) : isEbook ? (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 whitespace-nowrap">
                eBook
              </span>
            ) : (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                Vật lý
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono min-w-0">
            <span className="truncate">
              {realBarcode || '—'}
            </span>
            {priceText ? (
              <span className="shrink-0 text-emerald-700 font-sans font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 whitespace-nowrap">
                {priceText}
              </span>
            ) : (
              <span className="shrink-0 text-slate-500 font-sans font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">
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
        <span className="inline-flex items-center max-w-[140px] px-2 py-1 rounded text-[10px] font-bold leading-tight bg-blue-50 text-blue-600 truncate" title={catName}>
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
      <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
        <AdminIconButton
          title="Xem chi tiết tồn kho"
          onClick={() => navigate(`/admin/books/${row.id}`)}
          className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
        >
          <BookCopy className="w-4 h-4" />
        </AdminIconButton>
        <AdminIconButton
          title="Chỉnh sửa"
          onClick={() => onEdit(row)}
          className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </AdminIconButton>
        <AdminIconButton
          title="Xóa sách"
          onClick={() => onDelete(row)}
          className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </AdminIconButton>
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
    title: '', author: '', publisher: '', year: '', 
    bookType: 'Vật lý', categoryId: '', courseCode: '', description: '', keywords: '',
    price: '', numPages: '', previewPages: '', borrowDays: '14'
  });
  const [formErrors, setFormErrors] = useState({});
  const [coverFile, setCoverFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [booksData, setBooksData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);

  // 4-17.a: phân trang server + debounce tìm kiếm
  const PAGE_SIZE = 10;
  const SEARCH_DEBOUNCE_MS = 350;
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [publisherFilter, setPublisherFilter] = useState('Tất cả nhà xuất bản');
  const [publisherOptions, setPublisherOptions] = useState(SEED_PUBLISHERS);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const fetchSeqRef = useRef(0);

  const mapBookRow = useCallback((b) => {
    const uiPrice =
      b.price ??
      b.book_price ??
      getLocalBookPrice(b.id) ??
      null;

    return {
      ...b,
      id: b.id,
      cover: b.cover_image_path || null,
      title: b.title,
      barcode: b.copy_barcode || b.barcode || null,
      author: b.author || 'Đang cập nhật',
      publisher: b.publisher || 'Đang cập nhật',
      category_id: b.category_id,
      category:
        b.category_name
        || (b.category_id ? `Thể loại ${b.category_id}` : null)
        || 'Chưa phân loại',
      categoryColor: 'blue',
      year: b.publication_year || b.published_year || 2024,
      copies: b.available_stock ?? 0,
      available: b.available_stock ?? 0,
      status: (b.available_stock === 0) ? 'Hết bản in' : 'Sẵn sàng',
      statusColor: (b.available_stock === 0) ? 'rose' : 'emerald',
      book_type: b.book_type || 'PRINTED',
      bookType:
        b.book_type === 'BOTH'
          ? 'BOTH'
          : (b.book_type === 'EBOOK' || b.bookType === 'eBook')
            ? 'eBook'
            : 'Vật lý',
      price: uiPrice,
      book_price: uiPrice,
      num_pages: b.num_pages ?? null,
      preview_pages: b.preview_pages ?? b.ebook?.preview_pages ?? null,
      borrow_days: b.borrow_days ?? b.ebook?.borrow_days ?? null,
      has_ebook: Boolean(b.has_pdf || b.ebook),
      ebook: b.ebook || (b.has_pdf ? { preview_pages: b.preview_pages, borrow_days: b.borrow_days, is_free: b.is_free } : null),
      book_attribute: b.book_attribute || b.attribute || '',
      subject_code: b.subject_code || '',
    };
  }, []);

  const fetchBooks = useCallback(async (opts = {}) => {
    const pageNum = opts.page ?? page;
    const q = opts.q !== undefined ? opts.q : debouncedSearch;
    const catId = opts.categoryId !== undefined ? opts.categoryId : categoryFilter;
    const publisher = opts.publisher !== undefined ? opts.publisher : publisherFilter;

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
      setBooksData([]);
      setTotalItems(0);
      setTotalPages(1);
      showToast(
        getApiErrorMessage(error, 'Không tải được danh mục sách.'),
        'error'
      );
    } finally {
      if (seq === fetchSeqRef.current) setIsLoadingBooks(false);
    }
  }, [
    page, debouncedSearch, categoryFilter, publisherFilter,
    mapBookRow, showToast,
  ]);

  const fetchCategories = () => {
    axiosInstance.get('/api/admin/categories').then(res => {
      setCategories(Array.isArray(res.data) ? res.data : (res.data?.items || []));
    }).catch((error) => {
      setCategories([]);
      showToast(
        getApiErrorMessage(error, 'Không tải được danh sách thể loại.'),
        'error'
      );
    });
  };

  /** Nạp NXB từ DB rồi gộp với seed — dropdown khớp dữ liệu thật. */
  const fetchPublisherOptions = useCallback(async () => {
    const pubs = new Set(SEED_PUBLISHERS);
    try {
      for (let p = 1; p <= 3; p += 1) {
        const res = await axiosInstance.get('/api/books/search', {
          params: { page: p, page_size: 50 },
        });
        (res.data?.items || []).forEach((b) => {
          if (b?.publisher) pubs.add(String(b.publisher).trim());
        });
        const pages = res.data?.total_pages ?? 1;
        if (p >= pages) break;
      }
    } catch {
      /* giữ seed nếu API lỗi */
    }
    setPublisherOptions([...pubs].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi')));
  }, []);

  // Debounce ô tìm kiếm → chỉ khi ổn định mới gọi API
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    // Defer để tránh setState đồng bộ trong body effect (react-hooks/set-state-in-effect)
    const timer = window.setTimeout(() => {
      fetchCategories();
      fetchPublisherOptions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPublisherOptions]);

  useEffect(() => {
    // Defer để tránh setState đồng bộ trong body effect (react-hooks/set-state-in-effect)
    const timer = window.setTimeout(() => {
      fetchBooks({ page, q: debouncedSearch });
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch khi page/filter ổn định
  }, [page, debouncedSearch, categoryFilter, publisherFilter]);

  const handleOpenAdd = () => {
    setBookForm({ 
      title: '', author: '', publisher: '', year: '', 
      bookType: 'Vật lý', categoryId: '', courseCode: '', description: '', keywords: '',
      price: '', numPages: '', previewPages: '', borrowDays: '14'
    });
    setFormErrors({});
    setCoverFile(null);
    setPdfFile(null);
    setIsAddingBook(true);
  };

  const handleOpenEdit = (book) => {
    setBookForm({
      title: book.title || '',
      author: book.author || '',
      publisher: book.publisher || '',
      year: book.year || book.publication_year || '',
      bookType:
        book.bookType === 'BOTH' || book.book_type === 'BOTH'
          ? 'BOTH'
          : (book.bookType === 'eBook' || book.book_type === 'EBOOK')
            ? 'eBook'
            : 'Vật lý',
      categoryId: book.category_id !== undefined && book.category_id !== null ? book.category_id.toString() : '',
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
      borrowDays: (() => {
        const d = book.ebook?.borrow_days ?? book.borrow_days ?? book.borrowDays;
        return d !== undefined && d !== null ? String(d) : '14';
      })(),
    });
    setFormErrors({});
    setCoverFile(null);
    setPdfFile(null);
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

        // 7. Số trang xem trước + số ngày mượn eBook (UC09)
    let validPreviewPages = null;
    let validBorrowDays = 14;
    if (bookForm.bookType === 'eBook' || bookForm.bookType === 'BOTH') {
      const trimmedPreview = bookForm.previewPages !== undefined && bookForm.previewPages !== null
        ? bookForm.previewPages.toString().trim()
        : '';
      if (trimmedPreview !== '') {
        if (!/^\d+$/.test(trimmedPreview)) {
          errors.previewPages = 'Số trang xem trước phải là số nguyên dương (không nhập chữ cái, số âm hay số thập phân)';
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

      const trimmedBorrow = bookForm.borrowDays !== undefined && bookForm.borrowDays !== null
        ? bookForm.borrowDays.toString().trim()
        : '';
      if (trimmedBorrow === '') {
        validBorrowDays = 14;
      } else if (!/^\d+$/.test(trimmedBorrow)) {
        errors.borrowDays = 'Số ngày mượn eBook phải là số nguyên dương';
      } else {
        const days = parseInt(trimmedBorrow, 10);
        if (days < 1 || days > 365) {
          errors.borrowDays = 'Số ngày mượn eBook phải từ 1 đến 365';
        } else {
          validBorrowDays = days;
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
    // 2. preview_pages gửi qua upload-pdf params; không có field book_attribute trên BE.
    // 3. price đã có trên BE → gửi trong payload.
    const payload = {
      title: trimmedTitle,
      author: trimmedAuthor,
      publisher: trimmedPublisher,
      publication_year: parseInt(trimmedYear, 10),
      price: validPrice,
      description: bookForm.description?.trim() || null,
      book_type:
        bookForm.bookType === 'eBook'
          ? 'EBOOK'
          : bookForm.bookType === 'BOTH'
            ? 'BOTH'
            : 'PRINTED',
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
          // Không gắn Content-Type tay — Axios tự thêm boundary cho FormData.
          await axiosInstance.post(`/api/admin/books/${bookId}/upload-cover`, coverData);
        }

        // Upload PDF khi sách EBOOK hoặc BOTH (BE đã cho phép cả hai)
        const isEbookType = payload.book_type === 'EBOOK' || payload.book_type === 'BOTH';
        if (bookId && pdfFile && isEbookType) {
          const pdfData = new FormData();
          pdfData.append('file', pdfFile);
          await axiosInstance.post(`/api/admin/books/${bookId}/upload-pdf`, pdfData, {
            params: {
              preview_pages: validPreviewPages || 10,
              is_free: false,
              borrow_days: validBorrowDays,
            },
          });
        }

        // Đồng bộ cache FE (phòng khi list API chưa trả price ngay)
        setLocalBookPrice(bookId, validPrice);

        // Cập nhật state nội bộ để giữ preview_pages, giá bìa khi sửa lại trong session
        setBooksData(prev => prev.map(b => {
          if (b.id === bookId) {
            return {
              ...b,
              ...payload,
              preview_pages: validPreviewPages,
              previewPages: validPreviewPages,
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
        showToast('Không nhận được phản hồi khi lưu đầu sách.', 'error');
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

  const totalBooks = totalItems;
  const uniqueCategories = categories.length || 0;
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
            icon={<BookType className="w-4 h-4" />}
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

      {/* Stats — màu/tint giống Users · eBook */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <Library className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tổng số đầu sách</p>
          <h3 className="text-3xl font-extrabold text-slate-800 leading-none">
            {totalBooks} <span className="text-sm font-medium text-slate-500">tựa sách</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-slate-500">Toàn hệ thống</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-indigo-50/40">
          <div className="absolute top-4 right-4">
            <LayoutGrid className="w-6 h-6 text-indigo-500 opacity-20" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Thể loại</p>
          <h3 className="text-3xl font-extrabold text-indigo-600 leading-none">
            {uniqueCategories} <span className="text-sm font-medium text-indigo-400">danh mục</span>
          </h3>
          <p className="mt-3 text-[11px] font-medium text-indigo-600">Quản lý qua nút Thể loại</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
        
        {/* Filters Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-slate-50/50 rounded-t-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full xl:w-auto flex-1">
            {/* Search + Tra cứu ngay (không chờ debounce) */}
            <div className="w-full flex items-stretch gap-2 min-w-0 md:col-span-2 lg:col-span-1">
              <div className="min-w-0 flex-1">
                <Input
                  type="text"
                  placeholder="Tìm tên sách, tác giả…"
                  leftIcon={<Search className="w-4 h-4" />}
                  className="!h-10 !rounded-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const q = searchTerm.trim();
                      setDebouncedSearch(q);
                      setPage(1);
                      showToast(
                        q
                          ? `Đang tra cứu «${q}».`
                          : 'Nhập tên sách/tác giả rồi bấm Tra cứu (hoặc để trống để xem tất cả).',
                        q ? 'success' : 'warning'
                      );
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="primary"
                className="!h-10 shrink-0 px-3"
                icon={<Search className="w-4 h-4" />}
                onClick={() => {
                  const q = searchTerm.trim();
                  setDebouncedSearch(q);
                  setPage(1);
                  showToast(
                    q
                      ? `Đang tra cứu «${q}».`
                      : 'Nhập tên sách/tác giả rồi bấm Tra cứu (hoặc để trống để xem tất cả).',
                    q ? 'success' : 'warning'
                  );
                }}
              >
                Tra cứu
              </Button>
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
              <option value="Tất cả nhà xuất bản">Tất cả nhà xuất bản</option>
              {publisherOptions.map((pub) => (
                <option key={pub} value={pub}>{pub}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-3 justify-end w-full xl:w-auto shrink-0 border-t xl:border-0 border-slate-200 pt-3 xl:pt-0">
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
            {isSearching ? 'Đang chờ gõ xong để tìm…' : 'Đang tải danh mục…'}
          </div>
        )}

        {/* Table / Grid — phân trang phía server */}
        {viewMode === 'list' ? (
          <Table 
            columns={catalogColumns}
            data={booksData}
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
            {booksData.map(row => {
              const coverSrc = resolveMediaUrl(row.cover || row.cover_image_path);
              return (
              <div key={row.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                {/* Cover & Status Badge */}
                <div className="relative aspect-[3/4] bg-indigo-50/50 border-b border-slate-100 flex flex-col items-center justify-center text-indigo-300 overflow-hidden">
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling;
                        if (fallback) fallback.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`relative z-[1] flex flex-col items-center justify-center ${coverSrc ? 'hidden' : ''}`}>
                    <BookType className="w-16 h-16 mb-4 opacity-50" />
                    <span className="font-mono text-sm font-medium text-indigo-400/70">{row.barcode}</span>
                  </div>

                  <div className="absolute top-3 left-3 z-10">
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
                  <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <AdminIconButton
                        className="bg-white/90 backdrop-blur-sm text-slate-500 hover:text-indigo-600 p-2 rounded-full shadow-md hover:bg-indigo-50 transition-colors"
                        title="Chỉnh sửa"
                        onClick={() => setEditingBook(row)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </AdminIconButton>
                      <AdminIconButton
                        className="bg-white/90 backdrop-blur-sm text-slate-500 hover:text-rose-600 p-2 rounded-full shadow-md hover:bg-rose-50 transition-colors"
                        title="Xóa sách"
                        onClick={() => setDeletingBook(row)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </AdminIconButton>
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
                    <p className="text-xs font-semibold text-slate-600 truncate mb-2">{row.author}</p>
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
              );
            })}
            {booksData.length === 0 && (
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
                  <AdminIconButton
                    className="p-1.5 rounded-full text-indigo-600 hover:bg-indigo-50"
                    title="Chỉnh sửa thể loại"
                    onClick={() => {
                      setEditingCategory(cat);
                      setCategoryFormName(cat.category_name || '');
                    }}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </AdminIconButton>
                  <AdminIconButton
                    className="p-1.5 rounded-full text-rose-600 hover:bg-rose-50"
                    title="Xóa thể loại"
                    onClick={() => setDeletingCategory(cat)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </AdminIconButton>
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
                <option value="BOTH">Cả hai</option>
              </select>
            </div>

            {(bookForm.bookType === 'eBook' || bookForm.bookType === 'BOTH') && (
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

            {(bookForm.bookType === 'eBook' || bookForm.bookType === 'BOTH') && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Số ngày mượn eBook
                </label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={bookForm.borrowDays}
                  onChange={(e) => handleFieldChange('borrowDays', e.target.value)}
                  className="w-full"
                  error={formErrors.borrowDays}
                  helperText={!formErrors.borrowDays ? "Mặc định 14 ngày (1–365)" : undefined}
                  placeholder="VD: 14"
                />
              </div>
            )}

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

            {(bookForm.bookType === 'eBook' || bookForm.bookType === 'BOTH') && (
              <div className="col-span-1 sm:col-span-2 border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5 text-rose-500" />
                  Tải lên tệp PDF (eBook / Cả hai)
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
