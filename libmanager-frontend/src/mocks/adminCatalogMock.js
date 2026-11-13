/**
 * Mock data cho Admin Catalog Management & Inventory Management (Task 2B-16)
 * Định dạng phù hợp với FastAPI Backend Schema và React Frontend UI.
 */

/** Lưu giá bìa tạm trên FE khi Backend chưa có field price (session hiện tại). */
const LOCAL_PRICE_KEY = 'libmanager_admin_book_prices';

export function getLocalBookPrices() {
  try {
    const raw = sessionStorage.getItem(LOCAL_PRICE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getLocalBookPrice(bookId) {
  if (bookId === undefined || bookId === null) return null;
  const map = getLocalBookPrices();
  const val = map[String(bookId)];
  return typeof val === 'number' && !Number.isNaN(val) ? val : null;
}

export function setLocalBookPrice(bookId, price) {
  if (bookId === undefined || bookId === null) return;
  const map = getLocalBookPrices();
  const num = Number(price);
  if (!Number.isFinite(num) || num < 0) {
    delete map[String(bookId)];
  } else {
    map[String(bookId)] = num;
  }
  sessionStorage.setItem(LOCAL_PRICE_KEY, JSON.stringify(map));
}

/** Ưu tiên: API → local FE → mock cùng id → null */
export function resolveBookPrice(book) {
  if (!book) return null;
  const fromApi = book.price ?? book.book_price;
  if (fromApi !== undefined && fromApi !== null && fromApi !== '') {
    const n = Number(fromApi);
    if (Number.isFinite(n)) return n;
  }
  const local = getLocalBookPrice(book.id);
  if (local !== null) return local;
  return null;
}

/** Khớp `CATEGORIES` trong `back_fast_api/database_seeder.py` + `data/books_seed.csv`. */
export const ADMIN_MOCK_CATEGORIES = [
  { id: 1, category_name: 'Công nghệ thông tin' },
  { id: 2, category_name: 'Khoa học' },
  { id: 3, category_name: 'Văn học' },
  { id: 4, category_name: 'Kinh tế' },
  { id: 5, category_name: 'Ngoại ngữ' },
];

/** Unique publishers từ `data/books_seed.csv` (seeder Sprint 2C). */
export const SEED_PUBLISHERS = [
  'Addison-Wesley',
  'Addison-Wesley Professional',
  'Athena Scientific',
  'Avon Books / HarperCollins',
  'BBC',
  'Bantam Books',
  "Barron's Educational Series",
  'Brooks/Cole',
  'Cambridge University Press',
  'CareerCup',
  'CreateSpace Independent Publishing Platform',
  'Crown / Three Rivers Press',
  'Crown Business',
  'Farrar, Straus and Giroux',
  'France loisirs',
  'Free Press',
  'Gallimard / Folio',
  'Harcourt Brace Jovanovich',
  'Harper',
  'HarperBusiness',
  'HarperCollins',
  'HarperOne',
  'Harriman House',
  'Harvard Business School Press',
  'Holt, Rinehart and Winston',
  'John Wiley & Sons',
  'Little, Brown and Company',
  'MIT Press',
  'McGraw-Hill',
  'Morgan Kaufmann',
  'NXB Kim Đồng',
  'NXB Trẻ',
  'No Starch Press',
  "O'Reilly Media",
  'Oxford University Press',
  'Paulist Press',
  'Pearson',
  'Pearson Addison-Wesley',
  'Pearson Longman',
  'Pearson Prentice Hall',
  'Penguin',
  'Penguin Books',
  'Plata Publishing',
  'Pocket Books',
  'Prentice Hall',
  'Prentice Hall PTR',
  'Prentice-Hall',
  'Random House / Vintage Books',
  'Routledge',
  'Scribner',
  'South-Western Cengage Learning',
  'Springer',
  'University Science Books',
  'University of Massachusetts Press',
  'University of Michigan Press',
  'Vintage Books',
  'Vintage Books USA',
  'Wellesley-Cambridge Press',
  'William Morrow',
];

export const ADMIN_MOCK_BOOKS = [
  {
    id: 1,
    title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
    isbn: '978-0132350884',
    barcode: 'BC-10001',
    author: 'Robert C. Martin',
    publisher: "O'Reilly Media",
    publication_year: 2021,
    year: 2021,
    category_id: 1,
    category: 'Công nghệ thông tin',
    categoryColor: 'blue',
    book_type: 'PRINTED',
    bookType: 'Vật lý',
    price: 285000,
    book_price: 285000,
    num_pages: 464,
    preview_pages: null,
    copies: 8,
    available: 6,
    available_stock: 6,
    status: 'Sẵn sàng',
    statusColor: 'emerald',
    description: 'Cuốn sách kinh điển hướng dẫn các nguyên lý viết mã nguồn sạch sẽ, dễ bảo trì và mở rộng trong môi trường Agile.',
    keywords: 'Clean Code, Agile, Refactoring, Software Engineering',
    subject_code: 'IT-SE',
    book_attribute: 'Tài liệu tham khảo',
    cover_image_path: 'https://images.unsplash.com/photo-1532012164546-f432f2e37976?q=80&w=200&auto=format&fit=crop',
    ebook: null,
    created_at: '2024-01-10T08:30:00Z'
  },
  {
    id: 2,
    title: 'Nhập môn Trí tuệ Nhân tạo và Machine Learning',
    isbn: '978-6045689123',
    barcode: 'BC-10002',
    author: 'TS. Nguyễn Văn Hùng',
    publisher: 'NXB Giáo Dục',
    publication_year: 2023,
    year: 2023,
    category_id: 2,
    category: 'Khoa học',
    categoryColor: 'indigo',
    book_type: 'EBOOK',
    bookType: 'eBook',
    price: 195000,
    book_price: 195000,
    num_pages: 380,
    preview_pages: 10,
    copies: 12,
    available: 10,
    available_stock: 10,
    status: 'Sẵn sàng',
    statusColor: 'emerald',
    description: 'Giáo trình toàn diện về AI căn bản, các thuật toán học có giám sát, không giám sát và ứng dụng thực tiễn với Scikit-Learn.',
    keywords: 'AI, Machine Learning, Python, Neural Networks',
    subject_code: 'CS-AI',
    book_attribute: 'Giáo trình',
    cover_image_path: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=200&auto=format&fit=crop',
    ebook: {
      file_path: '/static/ebooks/intro_ai_ml_2023.pdf',
      is_free: false,
      preview_pages: 10
    },
    created_at: '2024-01-15T09:15:00Z'
  },
  {
    id: 3,
    title: 'Cấu trúc Dữ liệu & Giải thuật Ứng dụng',
    isbn: '978-0321573513',
    barcode: 'BC-10003',
    author: 'Michael T. Goodrich, Roberto Tamassia',
    publisher: 'NXB Prentice Hall',
    publication_year: 2020,
    year: 2020,
    category_id: 1,
    category: 'Công nghệ thông tin',
    categoryColor: 'blue',
    book_type: 'PRINTED',
    bookType: 'Vật lý',
    price: 240000,
    book_price: 240000,
    num_pages: 720,
    preview_pages: null,
    copies: 10,
    available: 2,
    available_stock: 2,
    status: 'Mượn nhiều',
    statusColor: 'indigo',
    description: 'Tài liệu bắt buộc cho sinh viên kỹ thuật phần mềm, phân tích cấu trúc cây, đồ thị, bảng băm và độ phức tạp tính toán.',
    keywords: 'Data Structures, Algorithms, C++, Tree, Graph',
    subject_code: 'IT-DSA',
    book_attribute: 'Giáo trình',
    cover_image_path: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=200&auto=format&fit=crop',
    ebook: null,
    created_at: '2024-02-01T10:00:00Z'
  },
  {
    id: 4,
    title: 'Nguyên lý Hệ điều hành Hiện đại',
    isbn: '978-1119800361',
    barcode: 'BC-10004',
    author: 'Abraham Silberschatz, Peter B. Galvin',
    publisher: 'NXB ĐHQG Hà Nội',
    publication_year: 2022,
    year: 2022,
    category_id: 1,
    category: 'Công nghệ thông tin',
    categoryColor: 'blue',
    book_type: 'PRINTED',
    bookType: 'Vật lý',
    price: 310000,
    book_price: 310000,
    num_pages: 850,
    preview_pages: null,
    copies: 6,
    available: 4,
    available_stock: 4,
    status: 'Đang lưu hành',
    statusColor: 'blue',
    description: 'Kiến thức cốt lõi về quản lý tiến trình, luồng, bộ nhớ ảo, hệ thống tệp và an toàn hệ điều hành Unix/Linux.',
    keywords: 'Operating Systems, Kernel, Process, Memory Management',
    subject_code: 'IT-OS',
    book_attribute: 'Giáo trình',
    cover_image_path: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=200&auto=format&fit=crop',
    ebook: null,
    created_at: '2024-02-10T14:20:00Z'
  },
  {
    id: 5,
    title: 'Lập trình Web với React và Node.js',
    isbn: '978-6047781029',
    barcode: 'BC-10005',
    author: 'Trần Minh Quân, Lê Hoàng Nam',
    publisher: 'NXB Trẻ',
    publication_year: 2024,
    year: 2024,
    category_id: 1,
    category: 'Công nghệ thông tin',
    categoryColor: 'blue',
    book_type: 'EBOOK',
    bookType: 'eBook',
    price: 175000,
    book_price: 175000,
    num_pages: 420,
    preview_pages: 8,
    copies: 15,
    available: 15,
    available_stock: 15,
    status: 'Sẵn sàng',
    statusColor: 'emerald',
    description: 'Xây dựng ứng dụng đơn trang hiện đại với React 18, Tailwind CSS, RESTful API Node.js và PostgreSQL.',
    keywords: 'React, Node.js, Tailwind, Fullstack, Web API',
    subject_code: 'IT-WEB',
    book_attribute: 'Tài liệu tham khảo',
    cover_image_path: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=200&auto=format&fit=crop',
    ebook: {
      file_path: '/static/ebooks/react_fullstack_2024.pdf',
      is_free: true,
      preview_pages: 8
    },
    created_at: '2024-02-20T11:00:00Z'
  },
  {
    id: 6,
    title: 'Kinh tế Vi mô Ứng dụng trong Doanh nghiệp',
    isbn: '978-6048991201',
    barcode: 'BC-10006',
    author: 'PGS. TS. Trần Đình Khoa',
    publisher: 'NXB Lao Động Xã Hội',
    publication_year: 2021,
    year: 2021,
    category_id: 4,
    category: 'Kinh tế',
    categoryColor: 'emerald',
    book_type: 'PRINTED',
    bookType: 'Vật lý',
    price: 135000,
    book_price: 135000,
    num_pages: 310,
    preview_pages: null,
    copies: 5,
    available: 3,
    available_stock: 3,
    status: 'Đang lưu hành',
    statusColor: 'blue',
    description: 'Phân tích hành vi người tiêu dùng, cơ cấu chi phí, lý thuyết trò chơi và các chiến lược định giá tối ưu.',
    keywords: 'Microeconomics, Pricing, Business Strategy, Market Structure',
    subject_code: 'ECO-MICRO',
    book_attribute: 'Giáo trình',
    cover_image_path: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=200&auto=format&fit=crop',
    ebook: null,
    created_at: '2024-03-01T08:00:00Z'
  },
  {
    id: 7,
    title: 'Xác suất Thống kê và Xử lý Số liệu Thực nghiệm',
    isbn: '978-0134468914',
    barcode: 'BC-10007',
    author: 'Ronald E. Walpole, Raymond H. Myers',
    publisher: 'NXB Giáo Dục',
    publication_year: 2020,
    year: 2020,
    category_id: 2,
    category: 'Khoa học',
    categoryColor: 'amber',
    book_type: 'PRINTED',
    bookType: 'Vật lý',
    price: 180000,
    book_price: 180000,
    num_pages: 512,
    preview_pages: null,
    copies: 7,
    available: 0,
    available_stock: 0,
    status: 'Hết bản in',
    statusColor: 'rose',
    description: 'Cơ sở lý thuyết xác suất, biến ngẫu nhiên, phân phối thống kê, kiểm định giả thuyết và hồi quy tuyến tính.',
    keywords: 'Probability, Statistics, Regression, Hypothesis Testing',
    subject_code: 'MATH-STAT',
    book_attribute: 'Sách bài tập',
    cover_image_path: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=200&auto=format&fit=crop',
    ebook: null,
    created_at: '2024-03-05T09:30:00Z'
  },
  {
    id: 8,
    title: 'Designing Data-Intensive Applications',
    isbn: '978-1449373320',
    barcode: 'BC-10008',
    author: 'Martin Kleppmann',
    publisher: "O'Reilly Media",
    publication_year: 2022,
    year: 2022,
    category_id: 2,
    category: 'Khoa học',
    categoryColor: 'indigo',
    book_type: 'EBOOK',
    bookType: 'eBook',
    price: 450000,
    book_price: 450000,
    num_pages: 616,
    preview_pages: 10,
    copies: 5,
    available: 4,
    available_stock: 4,
    status: 'Sẵn sàng',
    statusColor: 'emerald',
    description: 'Nghiên cứu kiến trúc cơ sở dữ liệu phân tán, tính nhất quán (CAP/PACELC), replication, partitioning và stream processing.',
    keywords: 'Distributed Systems, Reliability, Scalability, Kafka, NoSQL',
    subject_code: 'CS-DATA',
    book_attribute: 'Tài liệu tham khảo',
    cover_image_path: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=200&auto=format&fit=crop',
    ebook: {
      file_path: '/static/ebooks/designing_data_intensive_apps.pdf',
      is_free: false,
      preview_pages: 10
    },
    created_at: '2024-03-12T13:45:00Z'
  },
  {
    id: 9,
    title: 'Quản trị Dự án Phần mềm Theo Mô hình Scrum',
    isbn: '978-6047712398',
    barcode: 'BC-10009',
    author: 'Ken Schwaber, Jeff Sutherland',
    publisher: 'NXB Thế Giới',
    publication_year: 2021,
    year: 2021,
    category_id: 4,
    category: 'Kinh tế',
    categoryColor: 'emerald',
    book_type: 'PRINTED',
    bookType: 'Vật lý',
    price: 110000,
    book_price: 110000,
    num_pages: 220,
    preview_pages: null,
    copies: 4,
    available: 1,
    available_stock: 1,
    status: 'Mượn nhiều',
    statusColor: 'indigo',
    description: 'Hướng dẫn chuẩn tắc về vai trò Product Owner, Scrum Master, Sprint Planning và quản lý backlog dự án công nghệ.',
    keywords: 'Scrum, Agile, Project Management, Sprint',
    subject_code: 'MGT-AGILE',
    book_attribute: 'Tài liệu tham khảo',
    cover_image_path: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=200&auto=format&fit=crop',
    ebook: null,
    created_at: '2024-03-18T10:10:00Z'
  },
  {
    id: 10,
    title: 'English for Information Technology & Engineering',
    isbn: '978-0194574921',
    barcode: 'BC-10010',
    author: 'Mairi Maclean, John Eastwood',
    publisher: 'NXB Giáo Dục',
    publication_year: 2023,
    year: 2023,
    category_id: 5,
    category: 'Ngoại ngữ',
    categoryColor: 'rose',
    book_type: 'EBOOK',
    bookType: 'eBook',
    price: 145000,
    book_price: 145000,
    num_pages: 260,
    preview_pages: 5,
    copies: 9,
    available: 7,
    available_stock: 7,
    status: 'Sẵn sàng',
    statusColor: 'emerald',
    description: 'Từ vựng chuyên ngành, cấu trúc ngữ pháp kỹ thuật, mẫu tài liệu mô tả yêu cầu kỹ thuật (SRS) và giao tiếp dự án.',
    keywords: 'Technical English, IT Vocabulary, Engineering, Communication',
    subject_code: 'ENG-TECH',
    book_attribute: 'Giáo trình',
    cover_image_path: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=200&auto=format&fit=crop',
    ebook: {
      file_path: '/static/ebooks/english_for_it_2023.pdf',
      is_free: true,
      preview_pages: 5
    },
    created_at: '2024-03-22T15:00:00Z'
  },
  {
    id: 11,
    title: 'An toàn Thông tin và Phòng thủ Mạng Doanh nghiệp',
    isbn: '978-0134444284',
    barcode: 'BC-10011',
    author: 'William Stallings',
    publisher: 'NXB ĐHQG Hà Nội',
    publication_year: 2022,
    year: 2022,
    category_id: 1,
    category: 'Công nghệ thông tin',
    categoryColor: 'blue',
    book_type: 'PRINTED',
    bookType: 'Vật lý',
    price: 330000,
    book_price: 330000,
    num_pages: 580,
    preview_pages: null,
    copies: 3,
    available: 2,
    available_stock: 2,
    status: 'Đang lưu hành',
    statusColor: 'blue',
    description: 'Mã hóa khóa công khai RSA, chữ ký số, giao thức TLS/SSL, cấu hình tường lửa và kỹ thuật phòng chống tấn công DDoS.',
    keywords: 'Cybersecurity, Cryptography, Firewall, Network Defense',
    subject_code: 'IT-SEC',
    book_attribute: 'Tài liệu tham khảo',
    cover_image_path: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=200&auto=format&fit=crop',
    ebook: null,
    created_at: '2024-03-25T11:20:00Z'
  },
  {
    id: 12,
    title: 'Báo cáo Khóa luận Tốt nghiệp: Hệ thống Thư viện Số ĐHQG',
    isbn: 'KL-2025-IT-001',
    barcode: 'BC-10012',
    author: 'Phan Phạm Thùy Vân, Nhóm Đồ án CNPM',
    publisher: 'NXB Trẻ',
    publication_year: 2025,
    year: 2025,
    category_id: 1,
    category: 'Công nghệ thông tin',
    categoryColor: 'blue',
    book_type: 'PRINTED',
    bookType: 'Vật lý',
    price: 85000,
    book_price: 85000,
    num_pages: 168,
    preview_pages: null,
    copies: 1,
    available: 1,
    available_stock: 1,
    status: 'Sẵn sàng',
    statusColor: 'emerald',
    description: 'Đồ án nghiên cứu thiết kế kiến trúc vi dịch vụ, quản lý kho bản sao sách vật lý, tài liệu số và phân quyền người dùng.',
    keywords: 'Thesis, Digital Library, Architecture, Fullstack',
    subject_code: 'IT-THESIS',
    cover_image_path: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=200&auto=format&fit=crop',
    ebook: null,
    created_at: '2024-04-01T08:15:00Z'
  },
  {
    id: 13,
    title: 'Tài liệu Chuyên khảo Vi kiến trúc Bộ xử lý CPU',
    isbn: '978-0123849885',
    barcode: 'BC-10013',
    author: 'John L. Hennessy, David A. Patterson',
    publisher: 'NXB ĐHQG Hà Nội',
    publication_year: 2021,
    year: 2021,
    category_id: 2,
    category: 'Khoa học',
    categoryColor: 'indigo',
    book_type: 'PRINTED',
    bookType: 'Vật lý',
    price: 520000,
    book_price: 520000,
    num_pages: 820,
    preview_pages: null,
    copies: 1,
    available: 0,
    available_stock: 0,
    status: 'Hết bản in',
    statusColor: 'rose',
    description: 'Tài liệu độc bản lưu trữ tại phòng đọc đặc biệt, nghiên cứu kiến trúc RISC-V, pipeline, bộ đệm phân cấp và siêu phân luồng.',
    keywords: 'Computer Architecture, RISC-V, Hardware, Cache',
    subject_code: 'CS-ARCH',
    cover_image_path: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=200&auto=format&fit=crop',
    ebook: null,
    created_at: '2024-04-05T14:00:00Z'
  }
];

/**
 * Mock data bản sao sách (Book Copies) cho từng đầu sách để kiểm thử Task 2B-16:
 * - Quản lý tồn kho
 * - Lọc vị trí (Khu - Tầng - Kệ)
 * - Lọc trạng thái (AVAILABLE, BORROWED, DAMAGED, LOST, RETIRED)
 * - Nghiệp vụ thanh lý bản sao (chặn BORROWED, chuyển DAMAGED/AVAILABLE sang RETIRED)
 */
export const ADMIN_MOCK_COPIES = {
  1: [
    { copy_barcode: 'BC-10001-01', book_id: 1, zone: 'Khu A', floor: 'Tầng 2', shelf: 'Kệ 01', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10001-02', book_id: 1, zone: 'Khu A', floor: 'Tầng 2', shelf: 'Kệ 01', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10001-03', book_id: 1, zone: 'Khu A', floor: 'Tầng 2', shelf: 'Kệ 02', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10001-04', book_id: 1, zone: 'Khu A', floor: 'Tầng 2', shelf: 'Kệ 02', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10001-05', book_id: 1, zone: 'Khu A', floor: 'Tầng 1', shelf: 'Kệ 05', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10001-06', book_id: 1, zone: 'Khu B', floor: 'Tầng 1', shelf: 'Kệ 03', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10001-07', book_id: 1, zone: 'Khu B', floor: 'Tầng 1', shelf: 'Kệ 03', status: 'DAMAGED', damage_notes: 'Bìa trước rách 3cm, gáy bung chỉ nhẹ' },
    { copy_barcode: 'BC-10001-08', book_id: 1, zone: 'Khu C', floor: 'Tầng 3', shelf: 'Kho thanh lý', status: 'RETIRED', damage_notes: 'Thanh lý đợt kiểm kê tháng 8/2024' }
  ],
  2: [
    { copy_barcode: 'BC-10002-01', book_id: 2, zone: 'Khu B', floor: 'Tầng 1', shelf: 'Kệ 04', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10002-02', book_id: 2, zone: 'Khu B', floor: 'Tầng 1', shelf: 'Kệ 04', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10002-03', book_id: 2, zone: 'Khu B', floor: 'Tầng 2', shelf: 'Kệ 01', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10002-04', book_id: 2, zone: 'Khu B', floor: 'Tầng 2', shelf: 'Kệ 02', status: 'DAMAGED', damage_notes: 'Mực loang trang 120-125' },
    { copy_barcode: 'BC-10002-05', book_id: 2, zone: 'Khu B', floor: 'Tầng 2', shelf: 'Kệ 02', status: 'AVAILABLE', damage_notes: null }
  ],
  3: [
    { copy_barcode: 'BC-10003-01', book_id: 3, zone: 'Khu A', floor: 'Tầng 1', shelf: 'Kệ 02', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10003-02', book_id: 3, zone: 'Khu A', floor: 'Tầng 1', shelf: 'Kệ 02', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10003-03', book_id: 3, zone: 'Khu A', floor: 'Tầng 1', shelf: 'Kệ 03', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10003-04', book_id: 3, zone: 'Khu A', floor: 'Tầng 1', shelf: 'Kệ 03', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10003-05', book_id: 3, zone: 'Khu C', floor: 'Tầng 2', shelf: 'Kệ 09', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10003-06', book_id: 3, zone: 'Khu C', floor: 'Tầng 2', shelf: 'Kệ 09', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10003-07', book_id: 3, zone: 'Khu B', floor: 'Tầng 3', shelf: 'Kệ 01', status: 'DAMAGED', damage_notes: 'Gáy sách mục nát, rách trang bìa' },
    { copy_barcode: 'BC-10003-08', book_id: 3, zone: 'Khu C', floor: 'Tầng 1', shelf: 'Kệ 04', status: 'LOST', damage_notes: 'Báo mất theo biên bản sự cố INC-004' },
    { copy_barcode: 'BC-10003-09', book_id: 3, zone: 'Khu C', floor: 'Tầng 3', shelf: 'Kho thanh lý', status: 'RETIRED', damage_notes: 'Đã thanh lý bản sao cũ' },
    { copy_barcode: 'BC-10003-10', book_id: 3, zone: 'Khu A', floor: 'Tầng 1', shelf: 'Kệ 01', status: 'BORROWED', damage_notes: null }
  ],
  4: [
    { copy_barcode: 'BC-10004-01', book_id: 4, zone: 'Khu A', floor: 'Tầng 3', shelf: 'Kệ 05', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10004-02', book_id: 4, zone: 'Khu A', floor: 'Tầng 3', shelf: 'Kệ 05', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10004-03', book_id: 4, zone: 'Khu A', floor: 'Tầng 3', shelf: 'Kệ 06', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10004-04', book_id: 4, zone: 'Khu A', floor: 'Tầng 3', shelf: 'Kệ 06', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10004-05', book_id: 4, zone: 'Khu A', floor: 'Tầng 3', shelf: 'Kệ 07', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10004-06', book_id: 4, zone: 'Khu A', floor: 'Tầng 3', shelf: 'Kệ 07', status: 'BORROWED', damage_notes: null }
  ],
  5: [
    { copy_barcode: 'BC-10005-01', book_id: 5, zone: 'Khu B', floor: 'Tầng 2', shelf: 'Kệ 05', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10005-02', book_id: 5, zone: 'Khu B', floor: 'Tầng 2', shelf: 'Kệ 05', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10005-03', book_id: 5, zone: 'Khu B', floor: 'Tầng 2', shelf: 'Kệ 06', status: 'AVAILABLE', damage_notes: null }
  ],
  6: [
    { copy_barcode: 'BC-10006-01', book_id: 6, zone: 'Khu C', floor: 'Tầng 1', shelf: 'Kệ 01', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10006-02', book_id: 6, zone: 'Khu C', floor: 'Tầng 1', shelf: 'Kệ 01', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10006-03', book_id: 6, zone: 'Khu C', floor: 'Tầng 1', shelf: 'Kệ 02', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10006-04', book_id: 6, zone: 'Khu C', floor: 'Tầng 1', shelf: 'Kệ 02', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10006-05', book_id: 6, zone: 'Khu C', floor: 'Tầng 1', shelf: 'Kệ 03', status: 'BORROWED', damage_notes: null }
  ],
  7: [
    { copy_barcode: 'BC-10007-01', book_id: 7, zone: 'Khu B', floor: 'Tầng 3', shelf: 'Kệ 02', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10007-02', book_id: 7, zone: 'Khu B', floor: 'Tầng 3', shelf: 'Kệ 02', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10007-03', book_id: 7, zone: 'Khu B', floor: 'Tầng 3', shelf: 'Kệ 03', status: 'DAMAGED', damage_notes: 'Bị ướt toàn bộ góc dưới' },
    { copy_barcode: 'BC-10007-04', book_id: 7, zone: 'Khu B', floor: 'Tầng 3', shelf: 'Kệ 03', status: 'RETIRED', damage_notes: 'Thanh lý sách hỏng nước' }
  ],
  8: [
    { copy_barcode: 'BC-10008-01', book_id: 8, zone: 'Khu A', floor: 'Tầng 2', shelf: 'Kệ 08', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10008-02', book_id: 8, zone: 'Khu A', floor: 'Tầng 2', shelf: 'Kệ 08', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10008-03', book_id: 8, zone: 'Khu A', floor: 'Tầng 2', shelf: 'Kệ 08', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10008-04', book_id: 8, zone: 'Khu A', floor: 'Tầng 2', shelf: 'Kệ 09', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10008-05', book_id: 8, zone: 'Khu A', floor: 'Tầng 2', shelf: 'Kệ 09', status: 'BORROWED', damage_notes: null }
  ],
  9: [
    { copy_barcode: 'BC-10009-01', book_id: 9, zone: 'Khu C', floor: 'Tầng 2', shelf: 'Kệ 04', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10009-02', book_id: 9, zone: 'Khu C', floor: 'Tầng 2', shelf: 'Kệ 04', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10009-03', book_id: 9, zone: 'Khu C', floor: 'Tầng 2', shelf: 'Kệ 04', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10009-04', book_id: 9, zone: 'Khu C', floor: 'Tầng 2', shelf: 'Kệ 05', status: 'DAMAGED', damage_notes: 'Gãy gáy, bung trang 50' }
  ],
  10: [
    { copy_barcode: 'BC-10010-01', book_id: 10, zone: 'Khu B', floor: 'Tầng 1', shelf: 'Kệ 07', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10010-02', book_id: 10, zone: 'Khu B', floor: 'Tầng 1', shelf: 'Kệ 07', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10010-03', book_id: 10, zone: 'Khu B', floor: 'Tầng 1', shelf: 'Kệ 08', status: 'BORROWED', damage_notes: null },
    { copy_barcode: 'BC-10010-04', book_id: 10, zone: 'Khu B', floor: 'Tầng 1', shelf: 'Kệ 08', status: 'AVAILABLE', damage_notes: null }
  ],
  11: [
    { copy_barcode: 'BC-10011-01', book_id: 11, zone: 'Khu A', floor: 'Tầng 3', shelf: 'Kệ 01', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10011-02', book_id: 11, zone: 'Khu A', floor: 'Tầng 3', shelf: 'Kệ 01', status: 'AVAILABLE', damage_notes: null },
    { copy_barcode: 'BC-10011-03', book_id: 11, zone: 'Khu A', floor: 'Tầng 3', shelf: 'Kệ 02', status: 'BORROWED', damage_notes: null }
  ],
  // Sách chỉ có 1 bản sao duy nhất
  12: [
    { copy_barcode: 'BC-10012-01', book_id: 12, zone: 'Khu C', floor: 'Tầng 3', shelf: 'Kệ Đồ Án 01', status: 'AVAILABLE', damage_notes: null }
  ],
  13: [
    { copy_barcode: 'BC-10013-01', book_id: 13, zone: 'Khu C', floor: 'Tầng 3', shelf: 'Phòng Đọc Đặc Biệt', status: 'BORROWED', damage_notes: null }
  ]
};
