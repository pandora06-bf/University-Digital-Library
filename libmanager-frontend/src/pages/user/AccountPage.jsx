import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { UserRound, Mail, Phone, Building2, BookMarked, ShieldAlert, BellRing } from 'lucide-react';
import WalletSection from '../../components/user/WalletSection';
import { profileService } from '../../services/profileService';
import { TOPUP_MIN, TOPUP_MAX } from '../../utils/wallet';

/**
 * Trang Thông tin người dùng (4-13): hồ sơ (GET /api/users/me) + mục Tài khoản dịch vụ (WalletSection).
 * Link sâu: /account?topup=50000 mở sẵn hộp nạp tiền (Toast thiếu số dư, trang Đặt phòng dùng link này).
 */

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-medium text-slate-800 break-words">{value}</div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const [searchParams] = useSearchParams();
  const [revision, setRevision] = useState(0);
  const [profile, setProfile] = useState({ key: -1, data: null, error: null });

  // ?topup=1 hoặc ?topup=<số tiền> → mở sẵn hộp nạp tiền, chỉ đọc một lần khi vào trang.
  const [topUpRequest] = useState(() => {
    const raw = searchParams.get('topup');
    if (raw == null) return null;
    const amount = Number(raw);
    return { amount: amount >= TOPUP_MIN && amount <= TOPUP_MAX ? amount : 50_000 };
  });

  useEffect(() => {
    let cancelled = false;
    profileService.getMe()
      .then((data) => !cancelled && setProfile({ key: revision, data, error: null }))
      .catch((error) => !cancelled && setProfile((prev) => ({ ...prev, key: revision, error })));
    return () => { cancelled = true; };
  }, [revision]);

  const reloadProfile = useCallback(() => setRevision((value) => value + 1), []);
  const me = profile.data;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-8">
      <div className="border-b border-slate-200/80 pb-6">
        <h1 className="text-2xl sm:text-headline-lg text-[#172033] font-semibold tracking-tight">Thông tin người dùng</h1>
        <p className="text-body-md text-[#5B6B82] mt-1">Hồ sơ thư viện, tài khoản dịch vụ và công nợ của bạn</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-6 items-start">
        <aside className="rounded-2xl border border-[#D9E2EE] bg-white p-5 space-y-4">
          {!me && !profile.error && (
            <div className="space-y-3" aria-busy="true">
              <div className="h-14 rounded-xl bg-slate-100 animate-pulse" />
              <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
            </div>
          )}
          {profile.error && !me && (
            <p role="alert" className="text-sm text-rose-700">
              Không tải được hồ sơ.{' '}
              <button type="button" onClick={reloadProfile} className="font-semibold underline min-h-10">Thử lại</button>
            </p>
          )}
          {me && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <UserRound className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 break-words">{me.fullName || me.userCode}</div>
                  <div className="text-sm text-slate-500">{[me.roleLabel, me.userCode].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
              {me.locked && (
                <p className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  Tài khoản đang bị khóa mượn. Trả hết phí phạt để mở khóa.
                </p>
              )}
              <div className="divide-y divide-slate-100">
                <InfoRow icon={Mail} label="Email" value={me.email} />
                <InfoRow icon={Phone} label="Số điện thoại" value={me.phone} />
                <InfoRow icon={Building2} label="Khoa / Đơn vị" value={me.department} />
                <InfoRow icon={BookMarked} label="Đang mượn / hạn mức" value={me.borrowLimit} />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link to="/my-books" className="min-h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 flex items-center justify-center gap-1.5 hover:border-indigo-300">
                  <BookMarked className="w-4 h-4" /> Phiếu mượn
                </Link>
                <Link to="/my-books?tab=waitlist" className="min-h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 flex items-center justify-center gap-1.5 hover:border-indigo-300">
                  <BellRing className="w-4 h-4" /> Đặt trước
                </Link>
              </div>
            </>
          )}
        </aside>

        <WalletSection topUpRequest={topUpRequest} onChanged={reloadProfile} />
      </div>
    </div>
  );
}
