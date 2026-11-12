// Đổi lỗi API mượn sách / đặt trước (3-01.a, 3-04.a) thành thông báo Toast (3-12.a).
// Backend trả 403 khi khóa tài khoản hoặc nợ phạt; 409 khi vượt hạn mức, hết sách, mượn trùng.

function detailText(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail.message === 'string') return detail.message;
  return '';
}

export function mapBorrowError(error) {
  const status = Number(error?.response?.status);
  const text = detailText(error);
  // Lỗi đã nhận ra: dùng câu giải thích rõ ràng; lỗi lạ: dùng nguyên câu backend trả về.
  const make = (code, message, extra = {}) => ({ code, status, message, detail: text, ...extra });
  const raw = (code, message) => ({ code, status, message: text || message, detail: text });

  if (!status) return { code: 'NETWORK', status: 0, message: 'Không kết nối được máy chủ. Vui lòng thử lại.' };
  if (status === 403) {
    return /nợ|phạt|fine/i.test(text) && !/khóa|lock/i.test(text)
      ? make('DEBT', 'Bạn còn nợ phạt chưa thanh toán nên tạm thời không thể mượn sách.')
      : make('BLOCKED', 'Tài khoản đang bị khóa mượn hoặc còn nợ phạt. Vui lòng thanh toán tại quầy hoặc bằng tài khoản dịch vụ.');
  }
  if (status === 409) {
    if (/không có bản vật lý|no physical/i.test(text)) return make('NO_PRINT', 'Sách này hiện chưa cho đặt mượn bản in. Bạn có thể đọc hoặc mượn bản eBook.');
    if (/hạn mức|limit/i.test(text)) return make('LIMIT', 'Bạn đã mượn đủ số sách tối đa (sinh viên 3, giảng viên 5). Hãy trả bớt sách trước khi mượn thêm.');
    if (/đã đặt trước|already.*wait/i.test(text)) return make('ALREADY_WAITLISTED', 'Bạn đã đặt trước sách này.');
    if (/còn bản|still available/i.test(text)) return make('STILL_AVAILABLE', 'Sách vẫn còn bản để mượn, không cần đặt trước.');
    if (/đang có phiếu|đang mượn|already/i.test(text)) return make('DUPLICATE', 'Bạn đang có phiếu mượn sách này.');
    if (/hết|out of stock|stock/i.test(text)) return make('OUT_OF_STOCK', 'Sách vừa hết bản trên kệ.', { offerWaitlist: true });
    return raw('CONFLICT', 'Không thể mượn sách lúc này. Vui lòng thử lại.');
  }
  if (status === 404) return raw('NOT_FOUND', 'Không tìm thấy tài liệu.');
  return raw('UNKNOWN', 'Thao tác thất bại. Vui lòng thử lại.');
}

// Tạo lỗi giả lập theo đúng dạng lỗi Axios, để mock và API đi chung một đường xử lý.
export function apiError(status, detail) {
  return Object.assign(new Error(detail), { response: { status, data: { detail } } });
}

// Lỗi liên quan tới tiền: kèm lối tắt sang trang nạp tiền / thanh toán (4-14.a).
const PAYMENT_ACTIONS = {
  DEBT: { to: '/wallet/top-up', label: 'Nạp tiền & thanh toán phí phạt' },
  BLOCKED: { to: '/wallet/top-up', label: 'Nạp tiền & thanh toán phí phạt' },
  INSUFFICIENT_BALANCE: { to: '/wallet/top-up', label: 'Sang Nạp tiền' },
};

/**
 * Đổi một lỗi bất kỳ thành nội dung Toast đỏ cho ToastAlertComponent (4-14.a):
 * - Lỗi Axios còn nguyên (có response, hoặc mất mạng) → mapBorrowError: nợ phạt, hạn mức, hết sách...
 * - Lỗi service đã đổi sẵn sang tiếng Việt (vd. mapRoomApiError: thiếu số dư) → giữ câu và mã của nó.
 */
export function errorToast(error, action) {
  const raw = error?.isAxiosError || error?.response;
  const mapped = raw || !error?.message ? mapBorrowError(error) : { code: error.code, message: error.message };
  return { type: 'error', message: mapped.message, action: action ?? PAYMENT_ACTIONS[mapped.code] };
}
