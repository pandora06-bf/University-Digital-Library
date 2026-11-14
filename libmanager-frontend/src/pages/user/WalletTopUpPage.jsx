import { useCallback, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { Button } from '../../components/Button';
import ToastAlertComponent from '../../components/ToastAlertComponent';
import { roomBookingService } from '../../services/roomBookingService';
import { formatMoney } from '../../utils/libraryDate';

// Trang đích dùng thử cho CTA Nạp tiền của 3-18.a khi phòng đọc chạy mock.
// Phòng đọc chạy API thật (VITE_ROOM_BOOKING_API=true) → dùng ví thật ở trang Tài khoản (4-13).
export default function WalletTopUpPage() {
  if (roomBookingService.mode === 'api') return <Navigate to="/account?topup=1" replace />;
  return <DemoTopUp />;
}

function DemoTopUp() {
  const [amount, setAmount] = useState(50000);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [failure, setFailure] = useState(null);
  const closeToast = useCallback(() => { setToast(null); setFailure(null); }, []);
  const topUp = async () => {
    setBusy(true); closeToast();
    try {
      const balance = await roomBookingService.topUp(amount);
      setToast({ message: `Đã nạp tiền thử. Số dư hiện tại: ${formatMoney(balance)}.`, action: { to: '/rooms', label: 'Quay lại đặt phòng' } });
    } catch (error) { setFailure(error); }
    finally { setBusy(false); }
  };
  return <div className="max-w-xl mx-auto px-4 py-12">
    <ToastAlertComponent error={failure} notice={toast} onClose={closeToast} />
    <Link to="/rooms" className="inline-flex items-center min-h-10 text-sm text-indigo-600 font-semibold">← Quay lại đặt phòng</Link>
    <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
      <Wallet className="w-10 h-10 text-indigo-600" /><h1 className="text-2xl font-semibold">Nạp tiền thử nghiệm</h1>
      <p className="text-sm text-slate-500">Tiền thử chỉ dùng để trải nghiệm đặt phòng. Bạn không cần thanh toán hoặc cung cấp thông tin ngân hàng.</p>
      <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">Nạp tiền thật bằng mã QR và trả phí phạt ở <Link to="/account" className="font-semibold underline">Thông tin người dùng</Link>.</p>
      <fieldset><legend className="text-sm font-semibold mb-3">Chọn số tiền</legend><div className="grid grid-cols-3 gap-2">{[50000, 100000, 200000].map((value) => <button key={value} type="button" aria-pressed={amount === value} onClick={() => setAmount(value)} className={`rounded-xl p-3 border text-sm font-semibold ${amount === value ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>{formatMoney(value)}</button>)}</div></fieldset>
      <Button fullWidth loading={busy} onClick={topUp}>Nạp {formatMoney(amount)} tiền thử</Button>
    </div>
  </div>;
}
