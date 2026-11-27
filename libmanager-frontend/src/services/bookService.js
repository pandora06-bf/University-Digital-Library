import axiosInstance from './axios_instance';
import { resolveMediaUrl } from '../utils/mediaUrl';

// 2B-12: các trang sách luôn gọi API. Khi VITE_USE_MOCK=true, MSW (mocks/handlers.js) trả lời thay backend.
export const PAGE_SIZE = 20; // NFR-PE-02, trùng DEFAULT_PAGE_SIZE trong back_fast_api/app/services/search_crud.py

const EBOOK_TYPES = ['EBOOK', 'BOTH'];
// Thuộc tính sách theo SRS UC02 (trùng app/models/book_attributes.py)
export const ATTRIBUTE_LABELS = { TEXTBOOK: 'Giáo trình', REFERENCE: 'Tài liệu tham khảo', WORKBOOK: 'Sách bài tập' };
const splitKeywords = (text) => [...new Set(String(text ?? '').split(/[,;]+/).map((word) => word.trim()).filter(Boolean))];

const toLocation = (copy) => ({
  barcode: copy.copy_barcode,
  status: copy.status,
  label: [copy.zone && `Khu ${copy.zone}`, copy.floor && `Tầng ${copy.floor}`, copy.shelf && `Kệ ${copy.shelf}`]
    .filter(Boolean).join(' — '),
});

// Đổi tên trường backend (snake_case) sang tên mà BookCard, BookDetailPage đang dùng.
const toBook = (data) => {
  const locations = (data.locations ?? []).map(toLocation);
  const shelf = locations.find((copy) => copy.status === 'AVAILABLE') ?? locations[0];
  return {
    id: data.id,
    title: data.title,
    author: data.author || 'Chưa rõ tác giả',
    publisher: data.publisher,
    publishYear: data.publication_year ?? data.published_year,
    isbn: data.isbn,
    barcode: shelf?.barcode ?? data.barcode,
    category: data.category_name ?? null,
    categoryId: data.category_id ?? null,
    description: data.description,
    // SRS UC02: tên khác, thuộc tính, từ khóa, số chương, số trang, môn học
    alternativeTitle: data.alternative_title ?? null,
    attribute: data.book_attribute ?? null,
    attributeLabel: data.book_attribute_label ?? ATTRIBUTE_LABELS[data.book_attribute] ?? null,
    keywords: splitKeywords(data.keywords),
    numPages: data.num_pages ?? null,
    numChapters: data.num_chapters ?? null,
    subjectCode: data.subject_code ?? null,
    coverUrl: resolveMediaUrl(data.cover_image_url ?? data.cover_image_path) ?? null,
    bookType: data.book_type ?? null,
    // Ưu tiên has_pdf từ API; không có thì suy từ book_type (EBOOK/BOTH).
    pdfAvailable: data.has_pdf === true
      || (data.has_pdf == null && EBOOK_TYPES.includes(data.book_type)),
    // /api/books/search chưa trả available_stock (đã báo Hiền): null nghĩa là "chưa rõ", khác 0 là "hết sách".
    availableCopies: data.available_stock ?? null,
    location: shelf?.label ?? null,
    locations,
  };
};

// Backend trả cây môn học, mỗi môn kèm danh sách thể loại (trùng nhau giữa các môn); MSW trả mảng phẳng.
const toCategories = (data) => {
  const list = Array.isArray(data) ? data : (data.subjects ?? []).flatMap((subject) => subject.categories ?? []);
  const unique = new Map(list.map((category) => [category.id, { id: category.id, name: category.category_name }]));
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
};

export const bookService = {
  // category_id và book_type là tên tham số cũ mà backend vẫn nhận, và cũng là tên MSW đang đọc.
  // SRS UC03: lọc theo môn học, thuộc tính, tác giả, NXB, năm, thể loại, định dạng.
  async search({ q, categoryId, bookType, subjectCode, attribute, author, publisher, year, page = 1, pageSize = PAGE_SIZE } = {}) {
    const { data } = await axiosInstance.get('/api/books/search', {
      params: {
        q: q?.trim() || undefined,
        category_id: categoryId || undefined,
        book_type: bookType || undefined,
        subject_code: subjectCode || undefined,
        attribute: attribute || undefined,
        author: author?.trim() || undefined,
        publisher: publisher?.trim() || undefined,
        year: year || undefined,
        page,
        page_size: pageSize,
      },
    });
    return { items: data.items.map(toBook), total: data.total, page: data.page, totalPages: data.total_pages };
  },
  async getCategories() {
    const { data } = await axiosInstance.get('/api/books/categories');
    return toCategories(data);
  },
  // Cây danh mục đầy đủ (SRS UC02): môn học/bộ môn, thuộc tính sách, thể loại.
  async getCatalog() {
    const { data } = await axiosInstance.get('/api/books/categories');
    const subjects = Array.isArray(data) ? [] : (data.subjects ?? []).map((subject) => ({ code: subject.subject_code, name: subject.name }));
    const attributes = Array.isArray(data?.attributes) ? data.attributes.map((item) => ({ code: item.code, label: item.label, count: item.count }))
      : Object.entries(ATTRIBUTE_LABELS).map(([code, label]) => ({ code, label, count: null }));
    return { categories: toCategories(data), subjects, attributes };
  },
  async getBook(bookId) {
    const { data } = await axiosInstance.get(`/api/books/${encodeURIComponent(bookId)}`);
    return toBook(data);
  },
};
