import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { Button } from '../../components/Button';
import Toast from '../../components/UserToast';
import { roomBookingService } from '../../services/roomBookingService';
import { formatMoney } from '../../utils/libraryDate';

// Trang đích dùng thử cho CTA Nạp tiền của 3-18.a; không tích hợp cổng thanh toán.
export default function WalletTopUpPage() {
  const [amount, setAmount] = useState(50000);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);
  const topUp = async () => {
    setBusy(true);
    try {
      const balance = await roomBookingService.topUp(amount);
      setToast({ message: `Đã nạp tiền thử. Số dư hiện tại: ${formatMoney(balance)}.`, action: { to: '/rooms', label: 'Quay lại đặt phòng' } });
    } catch (error) { setToast({ type: 'error', message: error.message }); }
    finally { setBusy(false); }
  };
  return <div className="max-w-xl mx-auto px-4 py-12">
    <Toast toast={toast} onClose={closeToast} />
    <Link to="/rooms" className="text-sm text-indigo-600 font-semibold">← Quay lại đặt phòng</Link>
    <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
      <Wallet className="w-10 h-10 text-indigo-600" /><h1 className="text-2xl font-semibold">Nạp tiền thử nghiệm</h1>
      <p className="text-sm text-slate-500">Tiền thử chỉ dùng để trải nghiệm đặt phòng. Bạn không cần thanh toán hoặc cung cấp thông tin ngân hàng.</p>
      <fieldset><legend className="text-sm font-semibold mb-3">Chọn số tiền</legend><div className="grid grid-cols-3 gap-2">{[50000, 100000, 200000].map((value) => <button key={value} type="button" aria-pressed={amount === value} onClick={() => setAmount(value)} className={`rounded-xl p-3 border text-sm font-semibold ${amount === value ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>{formatMoney(value)}</button>)}</div></fieldset>
      <Button fullWidth loading={busy} onClick={topUp}>Nạp {formatMoney(amount)} tiền thử</Button>
    </div>
  </div>;
}
