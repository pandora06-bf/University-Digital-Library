/**
 * Utility chuẩn hóa và trích xuất thông báo lỗi từ API response (AxiosError / Pydantic FastAPI)
 * Đặc biệt tối ưu hóa cho HTTP 409 (Conflict) và HTTP 422 (Unprocessable Entity).
 */

const FIELD_LABELS = {
  title: 'Tên sách',
  author: 'Tác giả',
  publisher: 'Nhà xuất bản',
  publication_year: 'Năm xuất bản',
  year: 'Năm xuất bản',
  book_type: 'Loại sách',
  category_id: 'Thể loại',
  subject_code: 'Mã môn học / Bộ môn',
  num_pages: 'Số trang',
  available_stock: 'Số lượng tồn kho',
  copy_barcode: 'Mã Barcode bản sao',
  barcode: 'Mã Barcode bản sao',
  zone: 'Khu vực kệ',
  floor: 'Tầng',
  shelf: 'Kệ sách',
  status: 'Trạng thái',
  damage_notes: 'Ghi chú hư hỏng / tình trạng',
  category_name: 'Tên thể loại'
};

/**
 * Trích xuất message thân thiện từ API response
 * @param {any} error - Đối tượng lỗi từ Axios hoặc Error
 * @param {string} [defaultMessage] - Thông báo dự phòng
 * @returns {string} Thông báo lỗi dễ hiểu cho người dùng
 */
export function getApiErrorMessage(error, defaultMessage = '') {
  if (!error) return defaultMessage || 'Đã xảy ra lỗi không xác định.';

  // Trường hợp chuỗi thuần
  if (typeof error === 'string') return error;

  const response = error.response;

  // Lỗi mất kết nối mạng hoặc server không phản hồi
  if (!response || error.code === 'ERR_NETWORK') {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.';
  }

  const status = response.status;
  const data = response.data;
  const detail = data?.detail;

  // 1. Xử lý HTTP 409 - Conflict
  if (status === 409) {
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    return defaultMessage || 'Dữ liệu bị xung đột. Vui lòng kiểm tra lại thông tin và thử lại.';
  }

  // 2. Xử lý HTTP 422 - Unprocessable Entity (Pydantic Validation Error)
  if (status === 422) {
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const messages = detail.map((err) => {
        let fieldName = '';
        if (Array.isArray(err.loc) && err.loc.length > 0) {
          const rawField = err.loc[err.loc.length - 1];
          fieldName = FIELD_LABELS[rawField] || rawField;
        }

        const msg = err.msg || 'Dữ liệu không hợp lệ';
        return fieldName ? `${fieldName}: ${msg}` : msg;
      });

      return `Dữ liệu chưa hợp lệ: ${messages.join('; ')}`;
    }

    return defaultMessage || 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại thông tin đã nhập.';
  }

  // 3. Xử lý HTTP 401 - Unauthorized
  if (status === 401) {
    return 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
  }

  // 4. Xử lý HTTP 403 - Forbidden
  if (status === 403) {
    if (typeof detail === 'string' && detail.trim()) return detail;
    return 'Bạn không có quyền thực hiện thao tác này (yêu cầu quyền Quản trị viên).';
  }

  // 5. Xử lý HTTP 404 - Not Found
  if (status === 404) {
    if (typeof detail === 'string' && detail.trim()) return detail;
    return defaultMessage || 'Không tìm thấy dữ liệu yêu cầu.';
  }

  // 6. Xử lý HTTP 500 - Server Error
  if (status >= 500) {
    return 'Lỗi hệ thống máy chủ (500). Vui lòng thử lại sau hoặc liên hệ bộ phận kỹ thuật.';
  }

  // Các trường hợp có detail string khác
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  return defaultMessage || error.message || 'Đã xảy ra lỗi không xác định.';
}
