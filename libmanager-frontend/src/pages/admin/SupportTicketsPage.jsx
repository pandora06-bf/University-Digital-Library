import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Toast } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { chatService } from '../../services/chatService';
import { getApiErrorMessage } from '../../services/errorHandler';
import { libraryTimestamp } from '../../utils/ebookAccess';

const PAGE_SIZE = 20;
const FILTERS = [
  { value: 'open', label: 'Chờ xử lý' },
  { value: 'answered', label: 'Đã trả lời' },
  { value: 'all', label: 'Tất cả' },
];
const when = (value) => (value ? new Date(libraryTimestamp(value)).toLocaleString('vi-VN') : '');

/** Thủ thư xem và trả lời yêu cầu bạn đọc gửi từ trợ lý ảo. */
export default function SupportTicketsPage() {
  const { toast, showToast, hideToast } = useToast();
  const [filter, setFilter] = useState('open');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ key: '', items: [], total: 0, error: '' });
  const [target, setTarget] = useState(null);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);
  const key = `${filter}:${page}:${revision}`;
  const loading = result.key !== key;
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  useEffect(() => {
    let cancelled = false;
    chatService.adminTickets(filter, page, PAGE_SIZE)
      .then((data) => { if (!cancelled) setResult({ key, ...data, error: '' }); })
      .catch((error) => {
        if (!cancelled) setResult({ key, items: [], total: 0, error: getApiErrorMessage(error, 'Không tải được yêu cầu hỗ trợ.') });
      });
    return () => { cancelled = true; };
  }, [filter, page, key]);

  const send = async () => {
    if (!reply.trim()) { showToast('Vui lòng nhập câu trả lời.', 'warning'); return; }
    setSaving(true);
    try {
      await chatService.replyTicket(target.id, reply.trim());
      showToast(`Đã trả lời yêu cầu #${target.id}.`, 'success');
      setTarget(null);
      setRevision((value) => value + 1);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không gửi được câu trả lời.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Toast toast={toast} onClose={hideToast} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Yêu cầu hỗ trợ</h1>
          <p className="text-sm text-slate-500">Câu hỏi bạn đọc chuyển cho thủ thư từ trợ lý ảo.</p>
        </div>
        <select aria-label="Lọc trạng thái" value={filter}
          onChange={(event) => { setFilter(event.target.value); setPage(1); }}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
          {FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      {loading && <p role="status" className="text-sm text-slate-500">Đang tải…</p>}
      {!loading && result.error && <p role="alert" className="text-sm text-rose-700">{result.error}</p>}
      {!loading && !result.error && result.items.length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Không có yêu cầu nào.</p>
      )}
      {!loading && result.items.length > 0 && (
        <ul className="space-y-3">
          {result.items.map((ticket) => (
            <li key={ticket.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm text-slate-500">
                  <strong className="text-slate-800">#{ticket.id} · {ticket.full_name || ticket.user_code}</strong> ({ticket.user_code}) · {when(ticket.created_at)}
                </p>
                {ticket.status === 'OPEN'
                  ? <Button size="sm" onClick={() => { setTarget(ticket); setReply(''); }}>Trả lời</Button>
                  : <span className="text-xs font-semibold text-emerald-700">Đã trả lời</span>}
              </div>
              <p className="mt-2 whitespace-pre-line break-words text-sm text-slate-800">{ticket.summary}</p>
              {ticket.reply && <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-indigo-50 p-2 text-sm text-indigo-900">{ticket.reply}</p>}
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center justify-center gap-3 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
          <span>Trang {page}/{totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Sau</Button>
        </nav>
      )}

      <Modal isOpen={Boolean(target)} onClose={() => !saving && setTarget(null)} title="Trả lời yêu cầu"
        footer={(
          <>
            <Button variant="outline" disabled={saving} onClick={() => setTarget(null)}>Hủy</Button>
            <Button loading={saving} onClick={send}>Gửi trả lời</Button>
          </>
        )}>
        <p className="whitespace-pre-line break-words text-sm text-slate-700">{target?.summary}</p>
        <label htmlFor="ticket-reply" className="mt-3 block text-sm font-semibold text-slate-700">Câu trả lời</label>
        <textarea id="ticket-reply" rows={5} maxLength={2000} value={reply}
          onChange={(event) => setReply(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm" />
      </Modal>
    </div>
  );
}
