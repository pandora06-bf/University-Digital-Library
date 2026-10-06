import { useState } from 'react';
import { 
  FileText, Search, UploadCloud, Eye, Trash2, Edit2, 
  CheckCircle2, AlertCircle, FilePlus
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';

// Mock Data
const INITIAL_DATA = [
  {
    id: 1,
    title: 'Cấu trúc Dữ liệu và Giải thuật',
    filename: 'cau-truc-du-lieu-tdtu-2023.pdf',
    size: '15.4 MB',
    uploadDate: '10/09/2026',
    status: 'Sẵn sàng'
  },
  {
    id: 2,
    title: 'Nhập môn Lập trình Web',
    filename: 'web-dev-basics-v2.pdf',
    size: '22.1 MB',
    uploadDate: '12/09/2026',
    status: 'Sẵn sàng'
  },
  {
    id: 3,
    title: 'Mạng Máy Tính Hiện Đại',
    filename: 'mang-may-tinh-hien-dai.pdf',
    size: '8.7 MB',
    uploadDate: '15/09/2026',
    status: 'Lỗi định dạng'
  },
  {
    id: 4,
    title: 'Cơ sở dữ liệu nâng cao',
    filename: 'csdl-nang-cao.pdf',
    size: '12.3 MB',
    uploadDate: '16/09/2026',
    status: 'Sẵn sàng'
  },
  {
    id: 5,
    title: 'Hệ điều hành Windows',
    filename: 'he-dieu-hanh.pdf',
    size: '30.5 MB',
    uploadDate: '17/09/2026',
    status: 'Sẵn sàng'
  },
  {
    id: 6,
    title: 'Thiết kế giao diện người dùng',
    filename: 'ui-ux-design.pdf',
    size: '45.2 MB',
    uploadDate: '18/09/2026',
    status: 'Sẵn sàng'
  },
  {
    id: 7,
    title: 'Trí tuệ nhân tạo cơ bản',
    filename: 'ai-basics.pdf',
    size: '18.9 MB',
    uploadDate: '19/09/2026',
    status: 'Sẵn sàng'
  },
  {
    id: 8,
    title: 'Bảo mật thông tin',
    filename: 'security-101.pdf',
    size: '9.4 MB',
    uploadDate: '20/09/2026',
    status: 'Lỗi định dạng'
  },
  {
    id: 9,
    title: 'Kiến trúc máy tính',
    filename: 'computer-architecture.pdf',
    size: '11.1 MB',
    uploadDate: '21/09/2026',
    status: 'Sẵn sàng'
  },
  {
    id: 10,
    title: 'Lập trình di động iOS',
    filename: 'ios-dev.pdf',
    size: '25.6 MB',
    uploadDate: '22/09/2026',
    status: 'Sẵn sàng'
  },
  {
    id: 11,
    title: 'Phân tích dữ liệu với Python',
    filename: 'data-analysis.pdf',
    size: '14.8 MB',
    uploadDate: '23/09/2026',
    status: 'Sẵn sàng'
  },
  {
    id: 12,
    title: 'Kỹ năng mềm cho IT',
    filename: 'soft-skills.pdf',
    size: '5.2 MB',
    uploadDate: '24/09/2026',
    status: 'Sẵn sàng'
  }
];

export default function EbookManagement() {
  const [data, setData] = useState(INITIAL_DATA);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEbook, setSelectedEbook] = useState(null);

  const filteredData = data.filter(item => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      key: 'title',
      header: 'Tên Sách',
      render: (val) => <span className="font-semibold text-slate-800">{val}</span>
    },
    {
      key: 'filename',
      header: 'Tên File PDF',
      render: (val) => (
        <div className="flex items-center gap-2 text-indigo-600">
          <FileText className="w-4 h-4" />
          <span className="font-medium text-sm">{val}</span>
        </div>
      )
    },
    { key: 'size', header: 'Kích Thước' },
    { key: 'uploadDate', header: 'Ngày Tải Lên' },
    {
      key: 'status',
      header: 'Trạng Thái',
      render: (val) => {
        const isSuccess = val === 'Sẵn sàng';
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {isSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {val}
          </span>
        );
      }
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      align: 'right',
      render: (val, row) => (
        <div className="flex items-center justify-end gap-2 transition-opacity">
          <button
            onClick={() => window.open('/reader/preview-' + row.id, '_blank')}
            className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors"
            title="Xem PDF"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setSelectedEbook(row); setShowReplaceModal(true); }}
            className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors"
            title="Thay thế file PDF"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setSelectedEbook(row); setShowDeleteModal(true); }}
            className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors"
            title="Xóa PDF"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý eBook / PDF</h1>
          <p className="text-sm text-slate-500 mt-1">Tải lên, xem trước và quản lý tài liệu số nội bộ thư viện.</p>
        </div>
        <Button 
          variant="primary" 
          icon={<FilePlus className="w-4 h-4" />}
          onClick={() => setShowUploadModal(true)}
        >
          Tải lên PDF mới
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
          <div className="w-full sm:w-96">
            <Input
              type="text"
              placeholder="Tìm kiếm theo tên sách hoặc tên file..."
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
          className="border-0 shadow-none rounded-none"
          pagination={true}
          itemsPerPage={5}
        />
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Tải lên tài liệu PDF mới"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>Hủy</Button>
            <Button variant="primary" onClick={() => setShowUploadModal(false)}>
              Tải lên
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Chọn đầu sách <span className="text-rose-500">*</span></label>
            <select className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer">
              <option>-- Chọn đầu sách --</option>
              <option>Lập trình Web hiện đại với React</option>
              <option>Cấu trúc dữ liệu & Giải thuật</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Chọn file PDF <span className="text-rose-500">*</span></label>
            <input 
              type="file" 
              accept=".pdf" 
              className="flex-1 block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-indigo-50 file:text-indigo-600
                hover:file:bg-indigo-100 transition-colors"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  // Giả lập hiển thị alert hoặc UI (chỉ cần console log là đủ cho mock)
                  console.log(`Đã chọn file: ${file.name} - ${(file.size / 1024 / 1024).toFixed(2)} MB`);
                }
              }}
            />
            <p className="text-[10px] text-slate-400 mt-1.5">Định dạng hỗ trợ: .pdf. Kích thước tối đa: 50MB.</p>
          </div>
        </div>
      </Modal>

      {/* Replace Modal */}
      <Modal
        isOpen={showReplaceModal}
        onClose={() => setShowReplaceModal(false)}
        title="Thay thế file PDF"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowReplaceModal(false)}>Hủy</Button>
            <Button variant="primary" onClick={() => {
              // Mock action
              setShowReplaceModal(false);
            }}>
              Cập nhật file
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Bạn đang cập nhật tài liệu cho sách: <strong className="text-slate-800">{selectedEbook?.title}</strong>
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">File PDF mới</label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100 hover:border-indigo-400 transition-colors">
              <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
              <p className="text-sm font-medium text-slate-700">Kéo thả file thay thế vào đây</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Xác nhận xóa tài liệu PDF"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Hủy bỏ</Button>
            <Button
              variant="primary"
              className="!bg-rose-600 hover:!bg-rose-700 !border-rose-600"
              onClick={() => {
                setData(prev => prev.filter(r => r.id !== selectedEbook.id));
                setShowDeleteModal(false);
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
            <h3 className="text-sm font-bold text-slate-800">Bạn có chắc chắn muốn xóa file PDF này không?</h3>
            <div className="mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
              <p className="font-bold text-slate-800 text-sm">{selectedEbook?.title}</p>
              <p className="text-xs font-mono text-slate-500">File: {selectedEbook?.filename}</p>
            </div>
            <p className="text-xs font-medium text-rose-600 mt-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0"></span>
              File sẽ bị xóa vĩnh viễn khỏi hệ thống lưu trữ.
            </p>
          </div>
        </div>
      </Modal>

    </div>
  );
}
