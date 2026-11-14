import axiosInstance from './axios_instance';
import { bookService } from './bookService';
import { toWaitlistEntry, sortWaitlist } from '../utils/waitlist';

// 3-13: tab Đặt trước (waitlist_router.py). Đăng ký đặt trước nằm ở loanService.joinWaitlist.
export const waitlistService = {
  async getMine() {
    const { data } = await axiosInstance.get('/api/waitlists/my-waitlists');
    const entries = (data.data ?? data.items ?? []).map(toWaitlistEntry);
    // API chỉ trả book_id: lấy tên sách song song; lỗi một cuốn thì vẫn hiện "Sách #id".
    const titled = await Promise.all(entries.map(async (entry) => {
      if (entry.bookTitle) return entry;
      try {
        const book = await bookService.getBook(entry.bookId);
        return { ...entry, bookTitle: book.title, author: book.author ?? null, coverUrl: book.coverUrl ?? null };
      } catch {
        return { ...entry, bookTitle: `Sách #${entry.bookId}` };
      }
    }));
    return sortWaitlist(titled);
  },

  async cancel(waitlistId) {
    const { data } = await axiosInstance.delete(`/api/waitlists/${encodeURIComponent(waitlistId)}`);
    return data;
  },
};
