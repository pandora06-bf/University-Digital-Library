import { useCallback, useEffect, useState } from 'react';
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, AlertTriangle, Receipt } from 'lucide-react';
import { Button } from '../Button';
import ToastAlertComponent from '../ToastAlertComponent';
import TopUpModal from './TopUpModal';
import PayFineButton from './PayFineButton';
import { walletService, TXN_PAGE_SIZE } from '../../services/walletService';
import { formatMoney } from '../../utils/libraryDate';

/**
 * WalletSection (4-13): mục "Tài khoản dịch vụ" trong trang Thông tin người dùng.
 * - Số dư (GET /api/wallet) và tổng nợ phạt (GET /api/fines/my-fines).
 * - Lịch sử giao dịch phân trang (GET /api/wallet/transactions?page&size).
 * - Nút Nạp tiền → TopUpModal (QR + đếm ngược + tự cập nhật khi PAID).
 * - Nút "Trả phạt bằng tài khoản dịch vụ" → PayFineButton.
 * `topUpRequest`: { amount } để mở sẵn hộp nạp tiền (vd. từ link /account?topup=50000).
 * `onChanged`: báo trang cha khi số dư / nợ phạt đổi (để cập nhật phần Công nợ).
 */

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hourCycle: 'h23',
});

function TxnRow({ txn }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${txn.credit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
        {txn.credit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-900 text-sm">{txn.label}</div>
        <div className="text-xs text-slate-500 truncate">
          {txn.createdAt ? dateTime.format(new Date(txn.createdAt)) : ''}
          {txn.description && txn.description !== txn.label ? ` · ${txn.description}` : ''}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`font-semibold tabular-nums text-sm ${txn.credit ? 'text-emerald-700' : 'text-rose-700'}`}>
          {txn.credit ? '+' : '−'}{formatMoney(Math.abs(txn.amount))}
        </div>
        {txn.balanceAfter != null && <div className="text-xs text-slate-400 tabular-nums">Số dư {formatMoney(txn.balanceAfter)}</div>}
      </div>
    </li>
  );
}

export default function WalletSection({ topUpRequest = null, onChanged }) {
  const [summaryRev, setSummaryRev] = useState(0);
  const [summary, setSummary] = useState({ key: -1, balance: null, fines: null, error: null });
  const [page, setPage] = useState(1);
  const [txnRev, setTxnRev] = useState(0);
  const [txns, setTxns] = useState({ key: '', data: null, error: null });
  const [topUp, setTopUp] = useState(topUpRequest);
  const [notice, setNotice] = useState(null);
  const [failure, setFailure] = useState(null);
  const closeToast = useCallback(() => { setNotice(null); setFailure(null); }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([walletService.getBalance(), walletService.getMyFines()])
      .then(([balance, fines]) => !cancelled && setSummary({ key: summaryRev, balance, fines, error: null }))
      .catch((error) => !cancelled && setSummary((prev) => ({ ...prev, key: summaryRev, error })));
    return () => { cancelled = true; };
  }, [summaryRev]);

  const txnKey = `${page}:${txnRev}`;
  useEffect(() => {
    let cancelled = false;
    walletService.getTransactions(page, TXN_PAGE_SIZE)
      .then((data) => !cancelled && setTxns({ key: txnKey, data, error: null }))
      .catch((error) => !cancelled && setTxns((prev) => ({ ...prev, key: txnKey, error })));
    return () => { cancelled = true; };
  }, [page, txnKey]);

  // Số dư / nợ phạt đổi → tải lại tóm tắt, quay về trang 1 lịch sử, báo trang cha.
  const refresh = useCallback(() => {
    setSummaryRev((value) => value + 1);
    setPage(1);
    setTxnRev((value) => value + 1);
    onChanged?.();
  }, [onChanged]);

  const handleTopUpPaid = useCallback((paid) => {
    setNotice({ type: 'success', message: `Đã cộng ${formatMoney(paid.amount)} vào tài khoản dịch vụ.` });
    refresh();
  }, [refresh]);

  const handleFinePaid = (result) => {
    setNotice(result.alreadyCleared
      ? { type: 'info', message: 'Bạn không còn khoản phạt nào cần trả.' }
      : { type: 'success', message: `Đã trả ${formatMoney(result.amountPaid)} tiền phạt. Tài khoản đã được mở khóa mượn.` });
    refresh();
  };

  const loadingSummary = summary.balance == null && !summary.error;
  const totalFines = summary.fines?.total ?? null;
  const txnData = txns.data;
  const txnLoading = txns.key !== txnKey;

  return (
    <section id="wallet" aria-labelledby="wallet-heading" className="space-y-5 scroll-mt-28">
      <ToastAlertComponent error={failure} notice={notice} onClose={closeToast} />

      <div className="rounded-3xl bg-gradient-to-br from-[#312E81] via-[#4F46E5] to-[#0E7490] text-white p-5 sm:p-7 shadow-lg shadow-indigo-500/20">
        <div className="flex items-center gap-2 text-indigo-100 text-sm font-medium">
          <Wallet className="w-4 h-4" /><h2 id="wallet-heading">Tài khoản dịch vụ</h2>
        </div>
        <div className="mt-2 text-3xl sm:text-4xl font-bold tabular-nums" aria-live="polite" aria-busy={loadingSummary}>
          {loadingSummary ? <span className="inline-block w-40 h-9 rounded-lg bg-white/20 animate-pulse" /> : summary.balance == null ? '—' : formatMoney(summary.balance)}
        </div>
        <p className="mt-1 text-sm text-indigo-100">Dùng để đặt phòng đọc và trả phí phạt trực tuyến.</p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setTopUp({ amount: 50_000 })} icon={<Plus className="w-4 h-4" />}
            className="!bg-white !text-indigo-700 hover:!bg-indigo-50 w-full sm:w-auto">
            Nạp tiền
          </Button>
        </div>
      </div>

      {summary.error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />Không tải được số dư.</span>
          <Button size="sm" variant="outline" onClick={() => setSummaryRev((v) => v + 1)}>Thử lại</Button>
        </div>
      )}

      {totalFines != null && totalFines > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-3">
            <Receipt className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-900">Bạn đang nợ phạt {formatMoney(totalFines)}</p>
              <p className="text-sm text-rose-800">{summary.fines?.blocked ? 'Tài khoản đang bị khóa mượn cho tới khi trả hết.' : 'Trả sớm để không bị khóa mượn.'}</p>
            </div>
          </div>
          <PayFineButton totalFines={totalFines} onPaid={handleFinePaid} onError={setFailure}
            onTopUp={(amount) => setTopUp({ amount })} fullWidth className="sm:w-auto" />
        </div>
      )}

      <div className="rounded-2xl border border-[#D9E2EE] bg-white">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Lịch sử giao dịch</h3>
          {txnData && <span className="text-xs text-slate-500">{txnData.total} giao dịch</span>}
        </div>
        <div className="px-4 sm:px-5">
          {!txnData && !txns.error && (
            <div className="py-4 space-y-3" aria-busy="true">
              {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />)}
            </div>
          )}
          {txns.error && !txnLoading && (
            <div role="alert" className="py-6 text-center space-y-2">
              <p className="text-sm text-slate-600">Không tải được lịch sử giao dịch.</p>
              <Button size="sm" variant="outline" onClick={() => setTxnRev((v) => v + 1)}>Thử lại</Button>
            </div>
          )}
          {txnData && txnData.items.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">Chưa có giao dịch nào. Bấm “Nạp tiền” để bắt đầu.</p>
          )}
          {txnData && txnData.items.length > 0 && (
            <ul className={`divide-y divide-slate-100 transition-opacity ${txnLoading ? 'opacity-50' : ''}`}>
              {txnData.items.map((txn) => <TxnRow key={txn.id} txn={txn} />)}
            </ul>
          )}
        </div>
        {txnData && txnData.pages > 1 && (
          <nav aria-label="Phân trang lịch sử giao dịch" className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-slate-100">
            <Button size="sm" variant="outline" disabled={page <= 1 || txnLoading} onClick={() => setPage((p) => p - 1)}
              icon={<ChevronLeft className="w-4 h-4" />} className="min-h-10">Trước</Button>
            <span className="text-sm text-slate-600">Trang {page}/{txnData.pages}</span>
            <Button size="sm" variant="outline" disabled={page >= txnData.pages || txnLoading} onClick={() => setPage((p) => p + 1)}
              className="min-h-10">Sau <ChevronRight className="w-4 h-4" /></Button>
          </nav>
        )}
      </div>

      {topUp && (
        <TopUpModal initialAmount={topUp.amount} onClose={() => setTopUp(null)} onPaid={handleTopUpPaid} />
      )}
    </section>
  );
}
