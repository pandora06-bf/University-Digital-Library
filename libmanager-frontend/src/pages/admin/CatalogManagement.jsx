import { useState } from 'react';
import { 
  Plus, Search, BookType, LayoutGrid, Clock, Edit2, Trash2,
  RotateCcw, Circle, LayoutList, BookCopy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';

// Dữ liệu giả lập chuẩn theo thiết kế Stitch
const catalogData = [
  {
    id: '1',
    cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=100&auto=format&fit=crop',
    title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
    isbn: 'ISBN: 978-0132350884',
    barcode: 'BC-881021',
    author: 'Robert C. Martin',
    publisher: 'NXB Prentice Hall',
    category: 'CNTT & Phần mềm',
    categoryColor: 'blue',
    year: '2008',
    copies: 15,
    available: 12,
    status: 'Đang lưu hành',
    statusColor: 'blue'
  },
  {
    id: '2',
    cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=100&auto=format&fit=crop',
    title: 'Giải thuật & Lập trình nâng cao',
    isbn: 'ISBN: 978-6047721290',
    barcode: 'BC-774012',
    author: 'Lê Minh Hoàng',
    publisher: 'NXB ĐHQG Hà Nội',
    category: 'Giáo trình',
    categoryColor: 'indigo',
    year: '2021',
    copies: 40,
    available: 3,
    status: 'Mượn nhiều',
    statusColor: 'indigo'
  },
  {
    id: '3',
    cover: 'https://images.unsplash.com/photo-1555661530-68c8e98db4e6?q=80&w=100&auto=format&fit=crop',
    title: 'Designing Data-Intensive Applications',
    isbn: 'ISBN: 978-1449373320',
    barcode: 'BC-994322',
    author: 'Martin Kleppmann',
    publisher: "O'Reilly Media",
    category: 'Hệ thống TT',
    categoryColor: 'blue',
    year: '2017',
    copies: 8,
    available: 8,
    status: 'Sẵn sàng',
    statusColor: 'emerald'
  },
  {
    id: '4',
    cover: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=100&auto=format&fit=crop',
    title: 'Tư duy nhanh và chậm (Thinking, Fast and Slow)',
    isbn: 'ISBN: 978-6045628612',
    barcode: 'BC-331004',
    author: 'Daniel Kahneman',
    publisher: 'NXB Thế Giới',
    category: 'Kinh tế',
    categoryColor: 'indigo',
    year: '2020',
    copies: 22,
    available: 18,
    status: 'Đang lưu hành',
    statusColor: 'blue'
  },
  {
    id: '5',
    cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=100&auto=format&fit=crop',
    title: 'Nguyên lý Tiếp thị (Principles of Marketing)',
    isbn: 'ISBN: 978-0134492513',
    barcode: 'BC-552190',
    author: 'Philip Kotler, Gary Armstrong',
    publisher: 'NXB Lao Động Xã Hội',
    category: 'Kinh tế & QTKD',
    categoryColor: 'blue',
    year: '2022',
    copies: 16,
    available: 0,
    status: 'Hết bản in',
    statusColor: 'rose'
  },
  {
    id: '6',
    cover: 'https://images.unsplash.com/photo-1526379095098-d400fd0bfce8?q=80&w=100&auto=format&fit=crop',
    title: 'Giải Phẫu Học Người',
    isbn: 'ISBN: 978-6047321556',
    barcode: 'BC-998123',
    author: 'Frank H. Netter',
    publisher: 'NXB Y Học',
    category: 'Y học & Sức khỏe',
    categoryColor: 'emerald',
    year: '2019',
    copies: 5,
    available: 5,
    status: 'Sẵn sàng',
    statusColor: 'emerald'
  },
  {
    id: '7',
    cover: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=100&auto=format&fit=crop',
    title: 'Quản trị Dự án Cơ bản',
    isbn: 'ISBN: 978-0123456789',
    barcode: 'BC-887123',
    author: 'Harold Kerzner',
    publisher: 'NXB Trẻ',
    category: 'Kinh tế & QTKD',
    categoryColor: 'blue',
    year: '2020',
    copies: 12,
    available: 4,
    status: 'Đang lưu hành',
    statusColor: 'amber'
  },
  {
    id: '8',
    cover: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=100&auto=format&fit=crop',
    title: 'Nhập Môn Lập Trình Python',
    isbn: 'ISBN: 978-9876543210',
    barcode: 'BC-112233',
    author: 'John V. Guttag',
    publisher: 'MIT Press',
    category: 'CNTT & Phần mềm',
    categoryColor: 'indigo',
    year: '2021',
    copies: 20,
    available: 15,
    status: 'Sẵn sàng',
    statusColor: 'emerald'
  },
  {
    id: '9',
    cover: 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?q=80&w=100&auto=format&fit=crop',
    title: 'Thiết Kế Đồ Họa Căn Bản',
    isbn: 'ISBN: 978-1112223334',
    barcode: 'BC-445566',
    author: 'Robin Williams',
    publisher: 'Peachpit Press',
    category: 'Thiết kế',
    categoryColor: 'blue',
    year: '2018',
    copies: 8,
    available: 2,
    status: 'Đang lưu hành',
    statusColor: 'amber'
  },
  {
    id: '10',
    cover: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=100&auto=format&fit=crop',
    title: 'Cơ Sở Dữ Liệu Quan Hệ',
    isbn: 'ISBN: 978-5556667778',
    barcode: 'BC-778899',
    author: 'Ramez Elmasri',
    publisher: 'Pearson',
    category: 'CNTT & Phần mềm',
    categoryColor: 'indigo',
    year: '2019',
    copies: 15,
    available: 10,
    status: 'Sẵn sàng',
    statusColor: 'emerald'
  },
  {
    id: '11',
    cover: 'https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?q=80&w=100&auto=format&fit=crop',
    title: 'English Grammar in Use',
    isbn: 'ISBN: 978-0521189064',
    barcode: 'BC-334455',
    author: 'Raymond Murphy',
    publisher: 'Cambridge',
    category: 'Ngoại ngữ',
    categoryColor: 'blue',
    year: '2019',
    copies: 30,
    available: 0,
    status: 'Hết bản in',
    statusColor: 'rose'
  },
  {
    id: '12',
    cover: 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?q=80&w=100&auto=format&fit=crop',
    title: 'Tiếng Nhật Minna no Nihongo',
    isbn: 'ISBN: 978-4883196036',
    barcode: 'BC-990011',
    author: '3A Network',
    publisher: '3A Corporation',
    category: 'Ngoại ngữ',
    categoryColor: 'blue',
    year: '2012',
    copies: 25,
    available: 5,
    status: 'Đang lưu hành',
    statusColor: 'amber'
  }
];

const getCatalogColumns = (onEdit, onDelete, navigate) => [
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
    render: (value, row) => (
      <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold text-center leading-tight ${
        row.categoryColor === 'indigo' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'
      }`}>
        {row.category}
      </span>
    )
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
          onClick={() => onEdit(row)}
          className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors">
          <Edit2 className="w-4 h-4" />
        </button>
        <button 
          onClick={() => onDelete(row)}
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
  const [deletingBook, setDeletingBook] = useState(null);
  
  // Form State for Validation
  const [bookForm, setBookForm] = useState({ 
    title: '', otherTitle: '', isbn: '', author: '', publisher: '', year: '', 
    bookType: 'Sách in', category: 'CNTT & Phần mềm', subject: '', courseCode: '', description: '', keywords: '' 
  });
  const [formErrors, setFormErrors] = useState({});

  const handleOpenAdd = () => {
    setBookForm({ 
      title: '', otherTitle: '', isbn: '', author: '', publisher: '', year: '', 
      bookType: 'Sách in', category: 'CNTT & Phần mềm', subject: '', courseCode: '', description: '', keywords: '' 
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
      bookType: book.bookType || 'Sách in',
      category: book.category || 'CNTT & Phần mềm',
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
  };

  const handleSaveBook = () => {
    const errors = {};
    if (!bookForm.title.trim()) errors.title = 'Tên sách không được để trống';
    if (!bookForm.author.trim()) errors.author = 'Tác giả không được để trống';
    if (!bookForm.year.trim()) errors.year = 'Năm xuất bản không được để trống';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    alert(`Đã lưu thành công sách: ${bookForm.title}`);
    handleCloseModal();
  };

  const catalogColumns = getCatalogColumns(handleOpenEdit, setDeletingBook, navigate);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Tất cả thể loại');
  const [publisherFilter, setPublisherFilter] = useState('Tất cả nhà xuất bản');
  const [statusFilter, setStatusFilter] = useState('Tất cả tình trạng');

  const filteredData = catalogData.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
                          item.title.toLowerCase().includes(searchLower) || 
                          item.author.toLowerCase().includes(searchLower) ||
                          item.barcode.toLowerCase().includes(searchLower) ||
                          item.isbn.toLowerCase().includes(searchLower);
    const matchesCategory = categoryFilter === 'Tất cả thể loại' || item.category === categoryFilter;
    const matchesPublisher = publisherFilter === 'Tất cả nhà xuất bản' || item.publisher === publisherFilter;
    const matchesStatus = statusFilter === 'Tất cả tình trạng' || item.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesPublisher && matchesStatus;
  });

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
            icon={<BookCopy className="w-4 h-4" />}
            onClick={() => navigate('/admin/books')}
          >
            Quản lý tồn kho
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
            12,450 <span className="text-sm font-medium text-slate-500">tựa sách</span>
          </h3>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">+120 đầu sách mới tháng này</span>
            </div>
            {/* Fake mini chart */}
            <svg className="w-16 h-4 text-indigo-500" viewBox="0 0 64 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 12C5 12 10 14 15 14C20 14 25 8 30 8C35 8 40 10 45 10C50 10 55 4 64 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
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
          <h3 className="text-4xl font-extrabold text-slate-800">48 <span className="text-base font-bold text-slate-500">chuyên ngành</span></h3>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium truncate pr-4">CNTT, Kinh tế, Ngoại ngữ, Y học...</span>
            <a href="#" className="text-[11px] font-bold text-blue-600 hover:underline shrink-0">Xem phân bổ &gt;</a>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-6 right-6">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <Clock className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 mb-2">Mới nhập nhận gần đây</p>
          <h3 className="text-4xl font-extrabold text-slate-800">32 <span className="text-base font-bold text-slate-500">đầu sách</span></h3>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Circle className="w-2 h-2 fill-indigo-400 text-indigo-400" />
              <span className="text-[11px] font-medium text-slate-500">Cập nhật số lượng & bản in tuần này</span>
            </div>
            <span className="text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md whitespace-nowrap">24 giờ qua</span>
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
              <option>Tất cả thể loại</option>
              <option>CNTT & Phần mềm</option>
              <option>Kinh tế & QTKD</option>
              <option>Ngoại ngữ</option>
              <option>Hệ thống TT</option>
              <option>Giáo trình</option>
              <option>Kinh tế</option>
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
                setCategoryFilter('Tất cả thể loại');
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
                value={bookForm.category}
                onChange={(e) => setBookForm({...bookForm, category: e.target.value})}
              >
                <option>CNTT & Phần mềm</option>
                <option>Kinh tế & QTKD</option>
                <option>Ngoại ngữ</option>
                <option>Khoa học Cơ bản</option>
                <option>Giáo trình</option>
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
            <Button variant="primary" className="!bg-rose-600 hover:!bg-rose-700 !border-rose-600" onClick={() => {
              alert('Đã xóa thành công sách ' + deletingBook?.title);
              setDeletingBook(null);
            }}>
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
