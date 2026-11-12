import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText, Search, UploadCloud, Eye, Edit2,
  CheckCircle2, FilePlus, RotateCcw,
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import axiosInstance from '../../services/axios_instance';
import { getApiErrorMessage } from '../../services/errorHandler';
import {
  getStoredAdminEbooks,
  resetAdminEbooks,
  upsertAdminEbook,
  DEMO_EBOOK_BOOK_OPTIONS,
} from '../../mocks/adminEbooksMock';

function formatSize(file) {
  if (!file?.size) return '—';
  return `${(file.size / 1024 / 1024).toFixed(1)} MB`;
}

function mapApiEbook(book) {
  const hasPdf = Boolean(
    book.has_pdf
      ?? book.hasPdf
      ?? book.ebook
      ?? book.filename
      ?? book.file_path
  );
  const filename = book.filename
    || (typeof book.file_path === 'string' ? book.file_path.split('/').pop() : null)
    || (typeof book.ebook?.file_path === 'string' ? book.ebook.file_path.split('/').pop() : null);
  return {
    id: book.id,
    title: book.title || `Sách #${book.id}`,
    bookType: book.book_type || book.bookType || 'EBOOK',
    filename: hasPdf ? (filename || 'PDF đã gắn') : '—',
    size: book.size || '—',
    uploadDate: book.uploadDate
      || (book.updated_at
        ? new Date(book.updated_at).toLocaleDateString('vi-VN')
        : '—'),
    status: hasPdf ? 'Sẵn sàng' : 'Chưa có PDF',
    hasPdf,
    previewPages: book.preview_pages ?? book.previewPages ?? book.ebook?.preview_pages ?? 10,
    isFree: Boolean(book.is_free ?? book.isFree ?? book.ebook?.is_free),
    fromApi: true,
  };
}

export default function EbookManagement() {
  const { toast, showToast, hideToast } = useToast();
  const [rows, setRows] = useState([]);
  const [bookOptions, setBookOptions] = useState(DEMO_EBOOK_BOOK_OPTIONS);
  const [usingMock, setUsingMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [selectedEbook, setSelectedEbook] = useState(null);
  const [uploadBookId, setUploadBookId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [replaceFile, setReplaceFile] = useState(null);
  const [previewPages, setPreviewPages] = useState('10');
  const [isFree, setIsFree] = useState(false);
  const [busy, setBusy] = useState(false);

  const readyCount = rows.filter((r) => r.hasPdf || r.status === 'Sẵn sàng').length;

  const loadFromApi = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/books/search', {
        params: { book_type: 'EBOOK', page: 1, page_size: 50 },
      });
      const items = res.data?.items || res.data?.data || [];
      const mapped = items.map(mapApiEbook);
      setRows(mapped);
      setBookOptions(
        mapped.length
          ? mapped.map((r) => ({ id: r.id, title: r.title }))
          : DEMO_EBOOK_BOOK_OPTIONS
      );
      setUsingMock(false);
      return true;
    } catch {
      const mock = getStoredAdminEbooks();
      setRows(mock);
      setBookOptions(DEMO_EBOOK_BOOK_OPTIONS);
      setUsingMock(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer để tránh setState đồng bộ trong body effect (react-hooks/set-state-in-effect)
    const timer = window.setTimeout(() => {
      loadFromApi();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadFromApi]);

  const filteredData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        String(item.filename || '').toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  const applyLocalUpload = (bookId, file, titleHint) => {
    const book = bookOptions.find((b) => String(b.id) === String(bookId));
    const pages = Math.min(10, Math.max(5, parseInt(previewPages, 10) || 10));
    if (usingMock) {
      const next = upsertAdminEbook({
        id: Number(bookId),
        title: book?.title || titleHint || `Sách #${bookId}`,
        filename: file.name,
        size: formatSize(file),
        uploadDate: new Date().toLocaleDateString('vi-VN'),
        previewPages: pages,
        isFree,
      });
      setRows(next);
      return;
    }
    setRows((prev) => {
      const idx = prev.findIndex((r) => String(r.id) === String(bookId));
      const nextRow = {
        id: Number(bookId),
        title: book?.title || titleHint || `Sách #${bookId}`,
        bookType: book?.bookType || 'EBOOK',
        filename: file.name,
        size: formatSize(file),
        uploadDate: new Date().toLocaleDateString('vi-VN'),
        status: 'Sẵn sàng',
        hasPdf: true,
        previewPages: pages,
        isFree,
        fromApi: true,
      };
      if (idx < 0) return [nextRow, ...prev];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...nextRow };
      return copy;
    });
  };

  const tryApiUpload = async (bookId, file) => {
    const form = new FormData();
    form.append('file', file);
    const pages = Math.min(10, Math.max(5, parseInt(previewPages, 10) || 10));
    // Không gắn Content-Type tay — Axios tự thêm boundary cho FormData.
    await axiosInstance.post(`/api/admin/books/${bookId}/upload-pdf`, form, {
      params: { preview_pages: pages, is_free: isFree, borrow_days: 14 },
    });
  };

  const handleUpload = async () => {
    if (!uploadBookId) {
      showToast('Chọn đầu sách eBook.', 'warning');
      return;
    }
    if (!uploadFile) {
      showToast('Vui lòng chọn tệp PDF.', 'warning');
      return;
    }
    if (uploadFile.type && uploadFile.type !== 'application/pdf' && !uploadFile.name.toLowerCase().endsWith('.pdf')) {
      showToast('Chỉ chấp nhận tệp PDF.', 'error');
      return;
    }
    setBusy(true);
    try {
      await tryApiUpload(uploadBookId, uploadFile);
      applyLocalUpload(uploadBookId, uploadFile);
      setUsingMock(false);
      showToast('Đã tải PDF lên máy chủ thành công.', 'success');
      setShowUploadModal(false);
      setUploadBookId('');
      setUploadFile(null);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404 || status === 409 || status === 422 || status === 400) {
        showToast(
          getApiErrorMessage(error, 'Máy chủ từ chối tải PDF. Kiểm tra đầu sách eBook và tệp PDF.'),
          'error'
        );
      } else {
        applyLocalUpload(uploadBookId, uploadFile);
        setUsingMock(true);
        showToast(
          getApiErrorMessage(
            error,
            'Không kết nối được máy chủ. Đã lưu tạm trên giao diện (dữ liệu mẫu — không ghi máy chủ).'
          ),
          'warning'
        );
        setShowUploadModal(false);
        setUploadBookId('');
        setUploadFile(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReplace = async () => {
    if (!selectedEbook?.id) return;
    if (!replaceFile) {
      showToast('Vui lòng chọn tệp PDF mới.', 'warning');
      return;
    }
    setBusy(true);
    try {
      await tryApiUpload(selectedEbook.id, replaceFile);
      applyLocalUpload(selectedEbook.id, replaceFile, selectedEbook.title);
      setUsingMock(false);
      showToast('Đã cập nhật PDF trên máy chủ thành công.', 'success');
      setShowReplaceModal(false);
      setReplaceFile(null);
      setSelectedEbook(null);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404 || status === 409 || status === 422 || status === 400) {
        showToast(
          getApiErrorMessage(error, 'Máy chủ từ chối cập nhật PDF. Kiểm tra đầu sách và tệp.'),
          'error'
        );
      } else {
        applyLocalUpload(selectedEbook.id, replaceFile, selectedEbook.title);
        setUsingMock(true);
        showToast(
          getApiErrorMessage(
            error,
            'Không kết nối được máy chủ. Đã cập nhật tạm trên giao diện (dữ liệu mẫu).'
          ),
          'warning'
        );
        setShowReplaceModal(false);
        setReplaceFile(null);
        setSelectedEbook(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async (row) => {
    if (!row.hasPdf && row.status !== 'Sẵn sàng') {
      showToast('Đầu sách này chưa có tệp PDF để xem trước.', 'warning');
      return;
    }
    try {
      const { data } = await axiosInstance.get(`/api/ebooks/${row.id}/preview`, {
        responseType: 'blob',
      });
      // Một số BE trả JSON lỗi nhưng status 200 + blob — kiểm tra content-type
      if (data?.type && data.type.includes('json')) {
        showToast('Máy chủ chưa trả được PDF xem trước cho đầu sách này.', 'error');
        return;
      }
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404) {
        showToast(
          'Không tìm thấy PDF xem trước. Kiểm tra đầu sách đã có tệp và máy chủ đã bật /api/ebooks/{id}/preview.',
          'error'
        );
        return;
      }
      if (status === 409 || status === 422 || status === 400) {
        showToast(
          getApiErrorMessage(error, `Không xem trước được “${row.title}”.`),
          'error'
        );
        return;
      }
      showToast(
        getApiErrorMessage(
          error,
          `Không tải được bản xem trước “${row.title}”. Kiểm tra kết nối máy chủ.`
        ),
        'warning'
      );
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Tên Sách',
      render: (val, row) => (
        <div>
          <span className="font-semibold text-slate-800 block">{val}</span>
          {row.bookType && (
            <span className="text-[11px] text-slate-400 font-medium">{row.bookType}</span>
          )}
        </div>
      ),
    },
    {
      key: 'filename',
      header: 'Tên File PDF',
      render: (val, row) => (
        <div className={`flex items-center gap-2 ${row.hasPdf === false ? 'text-slate-400' : 'text-indigo-600'}`}>
          <FileText className="w-4 h-4 shrink-0" />
          <span className="font-medium text-sm truncate max-w-[240px]" title={val}>{val}</span>
        </div>
      ),
    },
    { key: 'size', header: 'Kích Thước' },
    { key: 'uploadDate', header: 'Ngày Tải Lên' },
    {
      key: 'status',
      header: 'Trạng Thái',
      render: (val) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
          val === 'Sẵn sàng'
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-amber-50 text-amber-700'
        }`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          {val}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      align: 'right',
      render: (_val, row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handlePreview(row)}
            disabled={row.hasPdf === false}
            className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={row.hasPdf === false ? 'Chưa có PDF' : 'Xem trước PDF'}
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedEbook(row);
              setReplaceFile(null);
              setShowReplaceModal(true);
            }}
            className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors"
            title="Thay thế tệp PDF"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-8">
      <Toast toast={toast} onClose={hideToast} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý eBook / PDF</h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý tài liệu điện tử: tải lên, xem trước và cập nhật tệp PDF cho từng đầu sách.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<FilePlus className="w-4 h-4" />}
          onClick={() => {
            setUploadBookId('');
            setUploadFile(null);
            setShowUploadModal(true);
          }}
        >
          Tải lên PDF mới
        </Button>
      </div>

      {usingMock && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Đang dùng dữ liệu mẫu / chế độ tạm</p>
          <p className="text-amber-800/90 mt-0.5 text-[13px]">
            Danh sách hoặc thao tác gần nhất chưa ghi máy chủ. Upload/preview lỗi sẽ báo rõ; thành công mới đồng bộ API.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tổng tài liệu</p>
          <p className="text-3xl font-extrabold text-slate-800 leading-none">
            {rows.length} <span className="text-sm font-medium text-slate-500">cuốn</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-slate-500">
            Số đầu sách điện tử đang quản lý
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm bg-gradient-to-br from-white to-emerald-50/40">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Đã có PDF</p>
          <p className="text-3xl font-extrabold text-emerald-600 leading-none">
            {readyCount} <span className="text-sm font-medium text-emerald-500">cuốn</span>
          </p>
          <p className="mt-3 text-[11px] font-medium text-emerald-600">
            Đã gắn tệp PDF, sẵn sàng xem trước
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Làm mới</p>
            <p className="text-sm text-slate-600">{loading ? 'Đang tải…' : 'Cập nhật danh sách mới nhất'}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            disabled={loading}
            onClick={async () => {
              const ok = await loadFromApi();
              if (!ok) {
                setRows(resetAdminEbooks());
                showToast('API chưa sẵn — đã nạp danh sách eBook mẫu.', 'warning');
              } else {
                showToast('Đã đồng bộ danh sách eBook từ máy chủ.', 'success');
              }
            }}
          >
            Nạp lại
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
          <div className="w-full sm:w-96">
            <Input
              type="text"
              placeholder="Tìm theo tên sách hoặc tên file…"
              leftIcon={<Search className="w-4 h-4" />}
              className="!h-10 !rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Table
          columns={columns}
          data={filteredData}
          emptyMessage={loading ? 'Đang tải danh sách eBook…' : 'Chưa có đầu sách điện tử trong danh mục.'}
          className="border-0 shadow-none rounded-none"
          pagination
          itemsPerPage={5}
        />
      </div>

      <Modal
        isOpen={showUploadModal}
        onClose={() => !busy && setShowUploadModal(false)}
        title="Tải lên tài liệu PDF mới"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowUploadModal(false)} disabled={busy}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleUpload} loading={busy}>
              Tải lên
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Chọn đầu sách <span className="text-rose-500">*</span>
            </label>
            <select
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              value={uploadBookId}
              onChange={(e) => setUploadBookId(e.target.value)}
            >
              <option value="">-- Chọn đầu sách --</option>
              {bookOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Chọn tệp PDF <span className="text-rose-500">*</span>
            </label>
            <label className="border-2 border-dashed border-slate-300 rounded-xl p-5 flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100 hover:border-indigo-400 transition-colors">
              <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-700 text-center">
                {uploadFile ? uploadFile.name : 'Chọn tệp PDF từ máy tính'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Định dạng hỗ trợ: .pdf</p>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Trang xem trước (5–10)"
              value={previewPages}
              onChange={(e) => setPreviewPages(e.target.value)}
            />
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
              Miễn phí đọc toàn bộ
            </label>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showReplaceModal}
        onClose={() => !busy && setShowReplaceModal(false)}
        title="Thay thế tệp PDF"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowReplaceModal(false)} disabled={busy}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleReplace} loading={busy}>
              Cập nhật file
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Cập nhật tài liệu cho: <strong className="text-slate-800">{selectedEbook?.title}</strong>
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tệp PDF mới</label>
            <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100 hover:border-indigo-400 transition-colors">
              <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
              <p className="text-sm font-medium text-slate-700 text-center">
                {replaceFile ? replaceFile.name : 'Chọn hoặc kéo thả tệp PDF'}
              </p>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
