import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, AlertTriangle, Wallet, MapPin } from 'lucide-react';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { walletService } from '../../services/walletService';
import { formatMoney } from '../../utils/libraryDate';
import { finePaymentPlan, suggestedTopUp } from '../../utils/wallet';

/**
 * PayFineButton (4-13): "Trả phạt bằng tài khoản dịch vụ" — dùng ở mục Tài khoản dịch vụ và tab Công nợ.
 * Bấm nút → đọc lại số dư + nợ phạt mới nhất (thủ thư có thể vừa thu tại quầy) rồi:
 * - Đủ tiền: hỏi xác nhận → POST /api/fines/pay-by-wallet (4-02) → onPaid({ amountPaid, balanceAfter }).
 * - Thiếu tiền: hiện số tiền thiếu, gợi ý nạp thêm (onTopUp(soTienGoiY)) hoặc trả tại quầy.
 * - Không còn nợ: báo và gọi onPaid để trang cha tải lại.
 * Lỗi API gửi lên trang cha qua onError (ToastAlertComponent hiện Toast đỏ).
 *
 * Dùng ở trang khác (vd. tab Công nợ của UserDashboard 3-14):
 *   <PayFineButton totalFines={tongNo} onPaid={taiLai} onTopUp={(soTien) => moNapTien(soTien)} onError={setLoi} />
 */
export default function PayFineButton({ totalFines, onPaid, onTopUp, onError, size = 'md', fullWidth = false, className = '' }) {
  const [plan, setPlan] = useState(null);
  const [checking, setChecking] = useState(false);
  const [paying, setPaying] = useState(false);

  const start = async () => {
    setChecking(true);
    try {
      const [balance, fines] = await Promise.all([walletService.getBalance(), walletService.getMyFines()]);
      const next = finePaymentPlan(balance, fines.total);
      if (next.status === 'NO_DEBT') {
        onPaid?.({ amountPaid: 0, balanceAfter: balance, alreadyCleared: true });
      } else {
        setPlan(next);
      }
    } catch (error) {
      onError?.(error);
    } finally {
      setChecking(false);
    }
  };

  const pay = async () => {
    setPaying(true);
    try {
      const result = await walletService.payFines();
      setPlan(null);
      onPaid?.(result);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 402) {
        // Số dư vừa thay đổi (vd. vừa đặt phòng): tính lại số tiền thiếu để hiện cho đúng.
        try {
          const balance = await walletService.getBalance();
          setPlan(finePaymentPlan(balance, plan.due));
          return;
        } catch { /* rơi xuống báo lỗi chung */ }
      }
      setPlan(null);
      onError?.(error);
      if (status === 409) onPaid?.({ amountPaid: 0, alreadyCleared: true }); // đã trả tại quầy: tải lại
    } finally {
      setPaying(false);
    }
  };

  const noDebt = totalFines != null && Number(totalFines) <= 0;

  return (
    <>
      <Button variant={noDebt ? 'outline' : 'danger'} size={size} fullWidth={fullWidth} loading={checking}
        disabled={noDebt} onClick={start} icon={<Receipt className="w-4 h-4 shrink-0" />}
        // Nhãn dài: cho xuống dòng thay vì bị cắt ở màn 360px (Button md cao cố định h-12).
        className={`!h-auto min-h-12 py-2.5 !whitespace-normal text-center leading-snug ${className}`}>
        {noDebt ? 'Không có nợ phạt' : 'Trả phạt bằng tài khoản dịch vụ'}
      </Button>

      {plan && (
        <Modal isOpen onClose={() => !paying && setPlan(null)}
          title={plan.status === 'OK' ? 'Xác nhận trả phí phạt' : 'Số dư chưa đủ để trả phạt'}>
          <dl className="grid grid-cols-2 gap-y-2 text-sm mb-5">
            <dt className="text-slate-500">Tổng nợ phạt</dt><dd className="text-right font-semibold text-rose-600">{formatMoney(plan.due)}</dd>
            <dt className="text-slate-500">Số dư hiện có</dt><dd className="text-right font-semibold">{formatMoney(plan.balance)}</dd>
            {plan.status === 'OK'
              ? <><dt className="text-slate-500">Số dư sau khi trả</dt><dd className="text-right font-semibold text-emerald-700">{formatMoney(plan.balance - plan.due)}</dd></>
              : <><dt className="font-semibold text-rose-700">Còn thiếu</dt><dd className="text-right font-bold text-rose-700">{formatMoney(plan.missing)}</dd></>}
          </dl>

          {plan.status === 'OK' ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Toàn bộ nợ phạt được trừ vào tài khoản dịch vụ và tài khoản được mở khóa mượn ngay.</p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <Button variant="outline" onClick={() => setPlan(null)} disabled={paying}>Để sau</Button>
                <Button onClick={pay} loading={paying}>Trả {formatMoney(plan.due)}</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="flex items-start gap-2 text-sm text-slate-600">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                Bạn có thể nạp thêm rồi trả trực tuyến, hoặc trả tiền mặt tại quầy thư viện.
              </p>
              <div className="flex flex-col gap-2">
                {onTopUp ? (
                  <Button fullWidth icon={<Wallet className="w-4 h-4" />}
                    onClick={() => { const amount = suggestedTopUp(plan.missing); setPlan(null); onTopUp(amount); }}>
                    Nạp thêm {formatMoney(suggestedTopUp(plan.missing))}
                  </Button>
                ) : (
                  <Link to={`/account?topup=${suggestedTopUp(plan.missing)}`} className="block">
                    <Button fullWidth icon={<Wallet className="w-4 h-4" />}>Sang nạp tiền</Button>
                  </Link>
                )}
                <Button variant="outline" fullWidth icon={<MapPin className="w-4 h-4" />} onClick={() => setPlan(null)}>
                  Tôi sẽ trả tại quầy
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
