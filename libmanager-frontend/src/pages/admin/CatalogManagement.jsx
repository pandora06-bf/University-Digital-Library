import { useState, useEffect } from 'react';
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



const getCatalogColumns = (onEdit, onDelete, navigate, categories = []) => [
  {
    key: 'cover',
    header: 'Bìa',
    align: 'center',
    render: () => (
      <div className="w-10 h-14 bg-indigo-50 rounded flex items-center justify-center border border-indigo-100 mx-auto text-indigo-400 shrink-0">
        <BookType className="w-5 h-5" />
      </div>
    )
  },
  {
    key: 'title',
    header: 'Tên Sách & Mã ISBN / Barcode',
    render: (value, row) => (
      <div className="min-w-[200px]">
        <button 
          onClick={() => navigate('/admin/books')} 
          className="font-bold text-slate-800 block text-left leading-snug mb-1 line-clamp-2 hover:text-indigo-600 transition-colors cursor-pointer"
          title="Xem tồn kho"
        >
          {row.title}
        </button>
        <span className="text-[11px] text-slate-500 font-mono block">{row.isbn} • {row.barcode}</span>
      </div>
    )
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
      const catName = cat ? cat.category_name : 'Chưa phân loại';
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
      <span className="font-mono text-slate-600">{row.year}</span>
    )
  },
  {
    key: 'price',
    header: 'Giá bìa',
    align: 'right',
    render: (value, row) => (
      <span className="font-mono text-slate-600">{new Intl.NumberFormat('vi-VN').format(row.price || 0)} ₫</span>
    )
  },
  {
    key: 'copies',
    header: 'Số Bản Sao (Sẵn Sàng)',
    render: (value, row) => (
      <div className="min-w-[140px] group cursor-pointer" onClick={() => navigate('/admin/books')} title="Xem tồn kho">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-slate-800 text-xs group-hover:text-indigo-600 transition-colors">{row.available} / {row.copies} <span className="font-normal text-slate-500">cuốn</span></span>
          <span className="text-[10px] font-bold text-indigo-600 group-hover:text-indigo-700 transition-colors">{Math.round((row.available/row.copies)*100)}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div 
            className={`h-1.5 rounded-full transition-colors ${row.available === 0 ? 'bg-rose-500 group-hover:bg-rose-600' : 'bg-indigo-500 group-hover:bg-indigo-600'}`} 
            style={{ width: `${(row.available/row.copies)*100}%` }}
          ></div>
        </div>
      </div>
    )
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
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [editingBook, setEditingBook] = useState(null);
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [deletingBook, setDeletingBook] = useState(null);
  
  // Form State for Validation
  const [bookForm, setBookForm] = useState({ 
    title: '', otherTitle: '', isbn: '', author: '', publisher: '', year: '', 
    price: '', bookType: 'Sách in', categoryId: '', subject: '', courseCode: '', description: '', keywords: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [coverFile, setCoverFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [booksData, setBooksData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Lấy dữ liệu sách từ API
  const fetchBooks = async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get('/api/books/search?page_size=100');
      const data = res.data;
      if (data && data.items) {
        // Map data từ Backend sang dạng UI
        const mappedData = data.items.map(b => ({
          id: b.id,
          cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=100&auto=format&fit=crop', // Tạm thời
          title: b.title,
          isbn: b.isbn || 'N/A',
          barcode: `BC-${b.id}000`, // Giả lập barcode
          author: b.author || 'Đang cập nhật',
          publisher: b.publisher || 'Đang cập nhật',
          category: b.category_id ? 'Thể loại ' + b.category_id : 'Chưa phân loại',
          categoryColor: 'blue',
          year: b.published_year || 2024,
          price: b.price || 0,
          copies: 10, // Mock, vì search API không trả về
          available: 10,
          status: 'Sẵn sàng',
          statusColor: 'emerald',
          ...b // Giữ lại id và các trường gốc
        }));
        setBooksData(mappedData);
      }
    } catch (error) {
      console.error('Lỗi khi tải danh sách sách:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axiosInstance.get('/api/admin/categories');
      setCategories(res.data);
    } catch (error) {
      console.error('Lỗi khi tải danh sách thể loại:', error);
    }
  };

  useEffect(() => {
    fetchBooks();
    fetchCategories();
  }, []);

  const handleOpenAdd = () => {
    setBookForm({ 
      title: '', otherTitle: '', isbn: '', author: '', publisher: '', year: '', 
      price: '', bookType: 'Sách in', categoryId: categories.length > 0 ? categories[0].id : '', subject: '', courseCode: '', description: '', keywords: ''
    });
    setFormErrors({});
    setIsAddingBook(true);
  };

  const handleOpenEdit = (book) => {
    setBookForm({
      title: book.title || '',
      otherTitle: book.otherTitle || '',
      isbn: book.isbn || '',
      author: book.author || '',
      publisher: book.publisher || '',
      year: book.year || '',
      price: book.price ?? 0,
      bookType: book.bookType || 'Sách in',
      categoryId: book.category_id || (categories.length > 0 ? categories[0].id : ''),
      subject: book.subject || '',
      courseCode: book.courseCode || '',
      description: book.description || '',
      keywords: book.keywords || ''
    });
    setFormErrors({});
    setEditingBook(book);
  };

  const handleCloseModal = () => {
    setIsAddingBook(false);
    setEditingBook(null);
    setCoverFile(null);
    setPdfFile(null);
  };

  const handleSaveBook = async () => {
    const errors = {};
    if (!bookForm.title.trim()) errors.title = 'Tên sách không được để trống';
    if (!bookForm.author.trim()) errors.author = 'Tác giả không được để trống';
    if (!bookForm.year.toString().trim()) errors.year = 'Năm xuất bản không được để trống';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      title: bookForm.title,
      author: bookForm.author,
      publisher: bookForm.publisher || "NXB Chưa Rõ",
      publication_year: parseInt(bookForm.year) || 2024,
      price: parseInt(bookForm.price, 10) || 0,
      description: bookForm.description || "",
      book_type: bookForm.bookType === "eBook" ? "EBOOK" : "PRINTED",
      category_id: parseInt(bookForm.categoryId) || null, 
      available_stock: 10
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
          await fetch(`/api/admin/books/${bookId}/upload-cover`, {
            method: 'POST',
            body: coverData
          });
        }

        // Gọi API Upload PDF (nếu có chọn file và sách là eBook)
        if (bookId && pdfFile && payload.book_type === 'EBOOK') {
          const pdfData = new FormData();
          pdfData.append('file', pdfFile);
          await fetch(`/api/admin/books/${bookId}/upload-pdf`, {
            method: 'POST',
            body: pdfData
          });
        }

        alert(editingBook ? 'Cập nhật thành công!' : 'Thêm sách mới thành công!');
        handleCloseModal();
        fetchBooks(); // Load lại data
      } else {
        alert('Lỗi Backend không xác định');
      }
    } catch (error) {
      console.error('Lỗi lưu sách:', error);
      const detail = error.response?.data?.detail || error.message || 'Network Error';
      alert(`Lỗi Backend: ${detail}`);
    }
  };

  const confirmDelete = async () => {
    if (!deletingBook) return;
    try {
      await axiosInstance.delete(`/api/admin/books/${deletingBook.id}`);
      alert('Đã xóa sách thành công!');
      setDeletingBook(null);
      fetchBooks();
    } catch (error) {
      alert(`Lỗi Backend: ${error.response?.data?.detail || 'Không thể xóa sách'}`);
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryFormName.trim()) return;
    setIsSavingCategory(true);
    try {
      await axiosInstance.post('/api/admin/categories', {
        category_name: categoryFormName.trim()
      });
      await fetchCategories(); // Cập nhật lại danh sách thể loại ngay lập tức
      setIsAddingCategory(false);
      setCategoryFormName('');
    } catch (error) {
      alert(`Lỗi: ${error.response?.data?.detail || 'Không thể thêm thể loại'}`);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const catalogColumns = getCatalogColumns(handleOpenEdit, setDeletingBook, navigate, categories);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [publisherFilter, setPublisherFilter] = useState('Tất cả nhà xuất bản');
  const [statusFilter, setStatusFilter] = useState('Tất cả tình trạng');

  const filteredData = booksData.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
                          item.title.toLowerCase().includes(searchLower) || 
                          item.author.toLowerCase().includes(searchLower) ||
                          item.barcode.toLowerCase().includes(searchLower) ||
                          item.isbn.toLowerCase().includes(searchLower);
    const matchesCategory = categoryFilter === '' || (item.category_id && item.category_id.toString() === categoryFilter);
    const matchesPublisher = publisherFilter === 'Tất cả nhà xuất bản' || item.publisher === publisherFilter;
    const matchesStatus = statusFilter === 'Tất cả tình trạng' || item.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesPublisher && matchesStatus;
  });

  const totalBooks = booksData.length;
  const uniqueCategories = new Set(booksData.map(b => b.category_id)).size || 0;
  const recentBooksCount = Math.min(booksData.length, 5);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Danh mục Sách</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý thông tin đầu sách, danh mục thể loại, tác giả và nhà xuất bản học thuật.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddingCategory(true)}
          >
            Thêm thể loại
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
              <span className="text-[11px] font-medium text-slate-500">Đã đồng bộ thành công</span>
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
                placeholder="Tìm tên sách, tác giả, ISBN, Barcode..."
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
              onChange={(e) => setCategoryFilter(e.target.value)}
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
              onChange={(e) => setPublisherFilter(e.target.value)}
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
                setCategoryFilter('');
                setPublisherFilter('Tất cả nhà xuất bản');
                setStatusFilter('Tất cả tình trạng');
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

        {/* Table / Grid */}
        {viewMode === 'list' ? (
          <Table 
            columns={catalogColumns}
            data={filteredData}
            hideHeader={false}
            pagination={true}
            itemsPerPage={5}
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
          </div>
        )}


      </div>

      {/* Modal Thêm Thể Loại */}
      <Modal 
        isOpen={isAddingCategory} 
        onClose={() => {
          setIsAddingCategory(false);
          setCategoryFormName('');
        }}
        title="Thêm thể loại mới"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tên thể loại <span className="text-rose-500">*</span></label>
            <Input 
              value={categoryFormName}
              onChange={(e) => setCategoryFormName(e.target.value)}
              className="w-full" 
              placeholder="VD: Tâm lý học, Khoa học dữ liệu..."
              autoFocus
            />
          </div>
          <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setIsAddingCategory(false)} disabled={isSavingCategory}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSaveCategory} isLoading={isSavingCategory} disabled={!categoryFormName.trim()}>
              Lưu Thể Loại
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingBook}
        onClose={() => setDeletingBook(null)}
        title="Xác nhận xóa"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingBook(null)}>Hủy</Button>
            <Button variant="primary" className="!bg-rose-600 hover:!bg-rose-700 !border-rose-600" onClick={confirmDelete}>Xác nhận xóa</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Bạn có chắc chắn muốn xóa cuốn sách <b>{deletingBook?.title}</b> không? Dữ liệu đã xóa sẽ không thể khôi phục.</p>
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
                onChange={(e) => setBookForm({...bookForm, title: e.target.value})}
                className="w-full" 
                error={formErrors.title}
                placeholder="Nhập tên sách..."
              />
            </div>
            
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tên khác</label>
              <Input 
                value={bookForm.otherTitle}
                onChange={(e) => setBookForm({...bookForm, otherTitle: e.target.value})}
                className="w-full" 
                placeholder="Nhập tên khác (nếu có)..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">ISBN</label>
              <Input 
                value={bookForm.isbn}
                onChange={(e) => setBookForm({...bookForm, isbn: e.target.value})}
                className="w-full" 
                placeholder="Nhập mã ISBN..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tác giả <span className="text-rose-500">*</span></label>
              <Input 
                value={bookForm.author}
                onChange={(e) => setBookForm({...bookForm, author: e.target.value})}
                className="w-full" 
                error={formErrors.author}
                placeholder="Nhập tên tác giả..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Nhà xuất bản</label>
              <Input 
                value={bookForm.publisher}
                onChange={(e) => setBookForm({...bookForm, publisher: e.target.value})}
                className="w-full" 
                placeholder="Nhập nhà xuất bản..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Năm xuất bản <span className="text-rose-500">*</span></label>
              <Input 
                value={bookForm.year}
                onChange={(e) => setBookForm({...bookForm, year: e.target.value})}
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
                onChange={(e) => setBookForm({...bookForm, price: e.target.value})}
                className="w-full"
                placeholder="VD: 150000"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Loại sách</label>
              <select 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                value={bookForm.bookType}
                onChange={(e) => setBookForm({...bookForm, bookType: e.target.value})}
              >
                <option>Sách in</option>
                <option>eBook</option>
                <option>Khóa luận / Đồ án</option>
                <option>Tạp chí</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Thể loại</label>
              <select 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                value={bookForm.categoryId}
                onChange={(e) => setBookForm({...bookForm, categoryId: e.target.value})}
              >
                {categories.length > 0 ? (
                  categories.map(c => (
                    <option key={c.id} value={c.id}>{c.category_name}</option>
                  ))
                ) : (
                  <option value="">Chưa có thể loại (Vui lòng tạo trước)</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Chủ đề / Môn học</label>
              <Input 
                value={bookForm.subject}
                onChange={(e) => setBookForm({...bookForm, subject: e.target.value})}
                className="w-full" 
                placeholder="VD: Cấu trúc dữ liệu..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Mã học phần</label>
              <Input 
                value={bookForm.courseCode}
                onChange={(e) => setBookForm({...bookForm, courseCode: e.target.value})}
                className="w-full" 
                placeholder="VD: COMP1020..."
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Từ khóa</label>
              <Input 
                value={bookForm.keywords}
                onChange={(e) => setBookForm({...bookForm, keywords: e.target.value})}
                className="w-full" 
                placeholder="Phân tách bằng dấu phẩy..."
              />
            </div>
            
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Mô tả</label>
              <textarea 
                value={bookForm.description}
                onChange={(e) => setBookForm({...bookForm, description: e.target.value})}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none h-24"
                placeholder="Nhập tóm tắt nội dung sách..."
              />
            </div>

            {/* Khu vực Upload Files */}
            <div className="col-span-1 sm:col-span-2 border-t border-slate-100 pt-4 mt-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-2">
                <Upload className="w-3.5 h-3.5" />
                Tải lên Ảnh bìa
              </label>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files[0])}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
              {editingBook && editingBook.cover_image_path && !coverFile && (
                <p className="text-[11px] text-slate-500 mt-2">Đang sử dụng ảnh bìa hiện tại. Chọn file mới để thay đổi.</p>
              )}
            </div>

            {bookForm.bookType === 'eBook' && (
              <div className="col-span-1 sm:col-span-2 border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5 text-rose-500" />
                  Tải lên file PDF (eBook)
                </label>
                <input 
                  type="file" 
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files[0])}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 cursor-pointer"
                />
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
