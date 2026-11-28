import { useEffect, useState } from 'react';
import { Button } from '../Button';
import { chatService } from '../../services/chatService';
import { libraryTimestamp } from '../../utils/ebookAccess';

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hourCycle: 'h23',
});
const when = (value) => (value ? dateTime.format(new Date(libraryTimestamp(value))) : '');

/** Mục "Yêu cầu hỗ trợ của tôi" ở trang Tài khoản: câu đã gửi cho thủ thư và câu trả lời. */
export default function SupportTickets() {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ tickets: null, error: false });

  useEffect(() => {
    let cancelled = false;
    chatService.myTickets()
      .then((tickets) => { if (!cancelled) setState({ tickets, error: false }); })
      .catch(() => { if (!cancelled) setState((prev) => ({ ...prev, error: true })); });
    return () => { cancelled = true; };
  }, [revision]);

  return (
    <section aria-labelledby="support-heading" className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="support-heading" className="text-lg font-semibold text-slate-800">Yêu cầu hỗ trợ của tôi</h2>
        <Button size="sm" variant="ghost" onClick={() => setRevision((value) => value + 1)}>Tải lại</Button>
      </div>
      {state.error && <p role="alert" className="mt-3 text-sm text-rose-700">Không tải được yêu cầu hỗ trợ.</p>}
      {!state.tickets && !state.error && <p role="status" className="mt-3 text-sm text-slate-500">Đang tải…</p>}
      {state.tickets?.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">Bạn chưa gửi yêu cầu nào. Mở trợ lý thư viện và bấm “Gặp thủ thư”.</p>
      )}
      {state.tickets?.length > 0 && (
        <ul className="mt-3 space-y-3">
          {state.tickets.map((ticket) => (
            <li key={ticket.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">
                #{ticket.id} · {when(ticket.created_at)} · {ticket.status === 'ANSWERED' ? 'Đã trả lời' : 'Chờ xử lý'}
              </p>
              <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-800">{ticket.summary}</p>
              {ticket.reply && (
                <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-indigo-50 p-2 text-sm text-indigo-900">
                  <strong>Thủ thư ({when(ticket.replied_at)}):</strong> {ticket.reply}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
