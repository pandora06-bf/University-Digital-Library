import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, X, Send, Trash2, LifeBuoy, BookOpen } from 'lucide-react';
import { Button } from '../Button';
import { chatService, MAX_QUESTION } from '../../services/chatService';
import { getToken } from '../../services/axios_instance';
import { getCurrentUser } from '../../mocks/auth';
import { loginPathFor } from '../../utils/loginRedirect';
import { resolveMediaUrl } from '../../utils/mediaUrl';

/**
 * Trợ lý ảo ở góc phải dưới: gợi ý sách, tình trạng sách, hướng dẫn sử dụng, gặp thủ thư.
 * - Hội thoại chỉ nằm trong bộ nhớ trình duyệt: tải lại trang hoặc đăng xuất là mất.
 * - Thẻ sách dựng từ dữ liệu server trả về, không từ chữ mô hình viết.
 * - Ẩn hoàn toàn khi backend tắt CHATBOT_ENABLED.
 */
const STRINGS = {
  vi: {
    title: 'Trợ lý thư viện', open: 'Mở trợ lý thư viện', close: 'Đóng', clear: 'Xóa hội thoại',
    greeting: 'Chào bạn! Mình giúp tìm sách, xem sách còn bản không, hướng dẫn dùng thư viện.',
    privacy: 'Nội dung bạn nhập được gửi tới dịch vụ AI và có thể được dùng để cải thiện dịch vụ đó. Đừng nhập mật khẩu hay thông tin nhạy cảm.',
    placeholder: 'Nhập câu hỏi…', send: 'Gửi', typing: 'Đang trả lời…',
    suggestions: ['Hôm nay tôi nên đọc gì?', 'Làm sao mượn một cuốn sách?', 'Cách nạp tiền vào ví?'],
    copies: (n) => `Còn ${n} bản`, none: 'Hết bản trên kệ', borrowed: 'đang có người mượn', ebook: 'Có eBook',
    agree: 'Đồng ý', decline: 'Không', declined: 'Mình sẽ không gửi thông tin cá nhân của bạn.',
    librarian: 'Gặp thủ thư', ticketLabel: 'Nội dung gửi thủ thư (bạn có thể sửa)',
    ticketSend: 'Gửi yêu cầu', cancel: 'Hủy', ticketShort: 'Vui lòng viết ít nhất 10 ký tự.',
    ticketDone: 'Đã gửi cho thủ thư. Xem câu trả lời ở trang Tài khoản, mục "Yêu cầu hỗ trợ của tôi".',
    ticketLogin: 'Bạn cần đăng nhập để gửi yêu cầu cho thủ thư.', login: 'Đăng nhập',
    failed: 'Không gửi được. Vui lòng thử lại.',
  },
  en: {
    title: 'Library assistant', open: 'Open library assistant', close: 'Close', clear: 'Clear chat',
    greeting: 'Hi! I can find books, check copies and explain how to use the library.',
    privacy: 'What you type is sent to an AI service and may be used to improve it. Do not enter passwords or sensitive data.',
    placeholder: 'Type your question…', send: 'Send', typing: 'Answering…',
    suggestions: ['What should I read today?', 'How do I borrow a book?', 'How do I top up my wallet?'],
    copies: (n) => `${n} copies free`, none: 'No copy on shelf', borrowed: 'borrowed by someone', ebook: 'eBook',
    agree: 'I agree', decline: 'No', declined: 'I will not send your personal information.',
    librarian: 'Ask a librarian', ticketLabel: 'Message to the librarian (you can edit it)',
    ticketSend: 'Send request', cancel: 'Cancel', ticketShort: 'Please write at least 10 characters.',
    ticketDone: 'Sent. Read the reply on the Account page, "Yêu cầu hỗ trợ của tôi".',
    ticketLogin: 'Please log in to contact a librarian.', login: 'Log in',
    failed: 'Could not send. Please try again.',
  },
};

function BookSuggestion({ book, text, onNavigate }) {
  const cover = resolveMediaUrl(book.cover_image_path);
  const facts = [
    book.has_print ? (book.copies_available > 0 ? text.copies(book.copies_available) : text.none) : null,
    book.is_borrowed_by_someone ? text.borrowed : null,
    book.has_ebook ? text.ebook : null,
  ].filter(Boolean);
  return (
    <li>
      <Link to={`/books/${book.id}`} onClick={onNavigate}
        className="flex gap-3 rounded-xl border border-slate-200 bg-white p-2 hover:border-indigo-300">
        {cover
          ? <img src={cover} alt="" loading="lazy" className="h-16 w-12 shrink-0 rounded object-cover" />
          : <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-400"><BookOpen className="h-5 w-5" /></span>}
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-800 line-clamp-2">{book.title}</span>
          <span className="block truncate text-xs text-slate-500">{book.author}</span>
          <span className="block text-xs text-indigo-700">{facts.join(' · ')}</span>
        </span>
      </Link>
    </li>
  );
}

export default function ChatWidget({ raised = false }) {
  const location = useLocation();
  const signedIn = Boolean(getToken() && getCurrentUser());
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const [lang, setLang] = useState('vi');
  const [ticket, setTicket] = useState(null); // null = đóng form; chuỗi = nội dung đang soạn
  const [ticketError, setTicketError] = useState('');
  const bottom = useRef(null);
  const session = useRef(0); // tăng khi xóa hội thoại để bỏ câu trả lời đến muộn
  const text = STRINGS[lang];

  useEffect(() => {
    let cancelled = false;
    chatService.isEnabled()
      .then((value) => { if (!cancelled) setEnabled(value); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy, open, ticket]);

  if (!enabled) return null;

  const ask = async (history, share) => {
    const current = session.current;
    setBusy(true);
    try {
      const data = await chatService.send(history, share);
      if (current !== session.current) return;
      setLang(data.language === 'en' ? 'en' : 'vi');
      // Câu xin phép và câu chứa dữ liệu cá nhân không đưa lại vào lịch sử gửi cho mô hình
      setMessages([...history, { role: 'assistant', content: data.reply, data, local: data.needs_consent || data.private }]);
    } catch (error) {
      if (current !== session.current) return;
      const detail = error.response?.data?.detail;
      setMessages([...history, { role: 'assistant', local: true, content: typeof detail === 'string' ? detail : text.failed }]);
    } finally {
      if (current === session.current) setBusy(false);
    }
  };

  const submit = (value) => {
    const content = value.trim();
    if (!content || busy) return;
    const history = [...messages, { role: 'user', content }];
    setMessages(history);
    setInput('');
    ask(history, shared);
  };

  const agree = () => {
    const history = messages.slice(0, -1); // bỏ câu xin phép, hỏi lại câu trước
    setShared(true);
    setMessages(history);
    ask(history, true);
  };

  const decline = () => {
    setMessages([...messages.slice(0, -1), { role: 'assistant', content: text.declined, local: true }]);
  };

  const clear = () => {
    session.current += 1;
    setMessages([]);
    setTicket(null);
    setShared(false);
    setBusy(false);
  };

  const openTicket = (draft) => {
    const lastQuestion = [...messages].reverse().find((item) => item.role === 'user')?.content;
    setTicket(draft || lastQuestion || '');
    setTicketError('');
  };

  const sendTicket = async (event) => {
    event.preventDefault();
    if (ticket.trim().length < 10) { setTicketError(text.ticketShort); return; }
    setBusy(true);
    try {
      await chatService.createTicket(ticket.trim());
      setTicket(null);
      setMessages((items) => [...items, { role: 'assistant', content: text.ticketDone, local: true }]);
    } catch (error) {
      const detail = error.response?.data?.detail;
      setTicketError(typeof detail === 'string' ? detail : text.failed);
    } finally {
      setBusy(false);
    }
  };

  const closeOnPhone = () => { if (window.innerWidth < 640) setOpen(false); };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label={text.open} title={text.open}
        className={`fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 ${raised ? 'bottom-24 lg:bottom-6' : 'bottom-6'}`}>
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <section role="dialog" aria-label={text.title}
      onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
      className="fixed inset-0 z-[60] flex flex-col bg-slate-50 sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(640px,calc(100vh-3rem))] sm:w-96 sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-2xl">
      <header className="flex items-center justify-between gap-2 bg-indigo-600 px-4 py-3 text-white sm:rounded-t-2xl">
        <h2 className="text-base font-semibold">{text.title}</h2>
        <div className="flex gap-1">
          <button type="button" onClick={clear} aria-label={text.clear} title={text.clear} className="rounded-lg p-2 hover:bg-white/15"><Trash2 className="h-4 w-4" /></button>
          <button type="button" onClick={() => setOpen(false)} aria-label={text.close} title={text.close} className="rounded-lg p-2 hover:bg-white/15"><X className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
        <p className="rounded-xl bg-white p-3 text-sm text-slate-700 shadow-sm">{text.greeting}</p>
        <p className="text-xs text-slate-500">{text.privacy}</p>
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {text.suggestions.map((item) => (
              <button key={item} type="button" onClick={() => submit(item)}
                className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50">{item}</button>
            ))}
          </div>
        )}
        {messages.map((message, index) => {
          const data = message.data;
          const latest = index === messages.length - 1;
          if (message.role === 'user') {
            return <p key={index} className="ml-10 whitespace-pre-line break-words rounded-xl bg-indigo-600 p-3 text-sm text-white">{message.content}</p>;
          }
          return (
            <div key={index} className="mr-6 space-y-2">
              <p className="whitespace-pre-line break-words rounded-xl bg-white p-3 text-sm text-slate-800 shadow-sm">{message.content}</p>
              {data?.books?.length > 0 && (
                <ul className="space-y-2">
                  {data.books.map((book) => <BookSuggestion key={book.id} book={book} text={text} onNavigate={closeOnPhone} />)}
                </ul>
              )}
              {data?.needs_consent && latest && !busy && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={agree}>{text.agree}</Button>
                  <Button size="sm" variant="outline" onClick={decline}>{text.decline}</Button>
                </div>
              )}
              {(data?.actions?.length > 0 || data?.handoff_summary) && (
                <div className="flex flex-wrap gap-2">
                  {data.actions?.map((action) => (
                    <Link key={action.to} onClick={closeOnPhone}
                      to={action.to === '/login' ? loginPathFor(location) : action.to}
                      className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">{action.label}</Link>
                  ))}
                  {data.handoff_summary && (
                    <Button size="sm" variant="outline" onClick={() => openTicket(data.handoff_summary)}>{text.librarian}</Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {busy && <p role="status" className="text-xs text-slate-500">{text.typing}</p>}
        {ticket !== null && (signedIn ? (
          <form onSubmit={sendTicket} className="space-y-2 rounded-xl border border-indigo-200 bg-white p-3">
            <label htmlFor="chat-ticket" className="block text-xs font-semibold text-slate-700">{text.ticketLabel}</label>
            <textarea id="chat-ticket" rows={4} maxLength={MAX_QUESTION} value={ticket}
              onChange={(event) => { setTicket(event.target.value); setTicketError(''); }}
              className="w-full rounded-lg border border-slate-300 p-2 text-base sm:text-sm" />
            {ticketError && <p role="alert" className="text-xs text-rose-700">{ticketError}</p>}
            <div className="flex gap-2">
              <Button size="sm" type="submit" loading={busy}>{text.ticketSend}</Button>
              <Button size="sm" variant="ghost" onClick={() => setTicket(null)}>{text.cancel}</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2 rounded-xl border border-indigo-200 bg-white p-3 text-sm text-slate-700">
            <p>{text.ticketLogin}</p>
            <Link to={loginPathFor(location)} className="font-semibold text-indigo-700 underline">{text.login}</Link>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <footer className="border-t border-slate-200 bg-white p-3 sm:rounded-b-2xl">
        <button type="button" onClick={() => openTicket('')}
          className="mb-2 flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline">
          <LifeBuoy className="h-3.5 w-3.5" />{text.librarian}
        </button>
        <form onSubmit={(event) => { event.preventDefault(); submit(input); }} className="flex gap-2">
          <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={MAX_QUESTION}
            placeholder={text.placeholder} aria-label={text.placeholder} autoFocus
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-indigo-500 focus:outline-none" />
          <Button size="sm" type="submit" disabled={busy || !input.trim()} aria-label={text.send}><Send className="h-4 w-4" /></Button>
        </form>
      </footer>
    </section>
  );
}
