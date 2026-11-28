import axiosInstance from './axios_instance';

// Chatbot (chat_router.py) và phiếu hỗ trợ (support_router.py). Chế độ mock do MSW trả lời.
export const MAX_QUESTION = 1000;
const MAX_TURNS = 12;
const MAX_ANSWER = 4000;
const CHAT_TIMEOUT = 90000; // mô hình có thể trả lời lâu hơn mức 10 giây mặc định

// Backend nhận tối đa 12 lượt chữ, bắt đầu và kết thúc bằng người dùng.
export function toHistory(messages) {
  const turns = messages
    .filter((item) => !item.local && item.content)
    .map((item) => ({
      role: item.role,
      content: item.content.slice(0, item.role === 'user' ? MAX_QUESTION : MAX_ANSWER),
    }))
    .slice(-MAX_TURNS);
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns;
}

export const chatService = {
  async isEnabled() {
    const { data } = await axiosInstance.get('/api/chat/status');
    return data?.enabled === true;
  },
  async send(messages, sharePersonal = false) {
    const { data } = await axiosInstance.post(
      '/api/chat',
      { messages: toHistory(messages), share_personal: sharePersonal },
      { timeout: CHAT_TIMEOUT },
    );
    return data;
  },
  async createTicket(summary) {
    const { data } = await axiosInstance.post('/api/support/tickets', { summary });
    return data;
  },
  async myTickets() {
    const { data } = await axiosInstance.get('/api/support/tickets/my');
    return data?.data ?? [];
  },
  async adminTickets(status = 'open', page = 1, size = 20) {
    const { data } = await axiosInstance.get('/api/admin/support/tickets', { params: { status, page, size } });
    return { items: data?.data ?? [], total: Number(data?.total ?? 0) };
  },
  async replyTicket(ticketId, reply) {
    const { data } = await axiosInstance.post(
      `/api/admin/support/tickets/${encodeURIComponent(ticketId)}/reply`,
      { reply },
    );
    return data;
  },
};
