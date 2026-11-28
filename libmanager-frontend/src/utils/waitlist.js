// Logic thuần của tab Đặt trước (3-13): không gọi API, không React, để kiểm thử bằng Node.
import { libraryTimestamp } from './ebookAccess';

// Trạng thái hàng chờ (waitlist_logic.py): WAITING đang chờ, HELD đang được giữ sách 24 giờ.
export function toWaitlistEntry(data) {
  const status = String(data.status ?? '').toUpperCase();
  const position = Number(data.queue_position) || null;
  // Tổng số người trong hàng chờ của cuốn sách: backend có thể trả một trong các tên dưới.
  const rawSize = data.queue_size ?? data.queue_total ?? data.queue_length ?? null;
  const size = rawSize == null ? null : Number(rawSize);
  return {
    id: data.id,
    bookId: data.book_id,
    bookTitle: data.book_title ?? null,
    status,
    held: status === 'HELD',
    position,
    queueSize: Number.isFinite(size) && size >= (position ?? 0) ? size : null,
    holdExpiresAt: libraryTimestamp(data.hold_expires_at),
    createdAt: libraryTimestamp(data.created_at),
  };
}

// "2/5" khi biết tổng hàng chờ, nếu không thì chỉ "2".
export function positionLabel(entry) {
  if (!entry.position) return '—';
  return entry.queueSize ? `${entry.position}/${entry.queueSize}` : String(entry.position);
}

// Thời gian giữ chỗ còn lại, dạng "5 giờ 12 phút" / "12 phút" / "Đã hết hạn".
export function holdRemaining(holdExpiresAt, now = Date.now()) {
  if (!holdExpiresAt) return null;
  const minutes = Math.floor((new Date(holdExpiresAt).getTime() - now) / 60000);
  if (minutes <= 0) return 'Đã hết hạn giữ';
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} giờ ${minutes % 60} phút` : `${minutes} phút`;
}

// Sách đang giữ chỗ đưa lên đầu (cần đi nhận trước), sau đó theo vị trí trong hàng chờ.
export function sortWaitlist(entries) {
  return [...entries].sort((a, b) => (Number(b.held) - Number(a.held)) || ((a.position ?? 99) - (b.position ?? 99)));
}
