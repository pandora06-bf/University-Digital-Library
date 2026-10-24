import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, DoorOpen, MapPin, Users, Wallet, RotateCcw } from 'lucide-react';
import { Button } from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast from '../../components/Toast';
import { roomBookingService } from '../../services/roomBookingService';
import { libraryToday, formatLibraryDate, formatMoney, slotTimestamp } from '../../utils/libraryDate';

export default function RoomBookingPage() {
  const [date, setDate] = useState(libraryToday);
  const [snapshot, setSnapshot] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
      setRevision((value) => value + 1);
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    roomBookingService.getSnapshot(date).then((data) => {
      if (!cancelled) { setSnapshot(data); setLoadError(''); }
    }).catch(() => { if (!cancelled) setLoadError('Không thể tải danh sách phòng. Vui lòng thử lại.'); });
    return () => { cancelled = true; };
  }, [date, revision]);

  const changeDate = (value) => {
    if (!value) return;
    setDate(value); setSnapshot(null); setSelection(null); setLoadError('');
  };
  const performAction = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (confirm.type === 'book') {
        await roomBookingService.book({ roomId: selection.room.id, date, slotId: selection.slot.id });
        setToast({ message: 'Đặt phòng thành công. Bạn có thể xem lượt đặt ở bên dưới.' });
      } else {
        await roomBookingService.cancel(confirm.booking.id);
        setToast({ message: 'Đã hủy lượt đặt và hoàn tiền vào số dư.' });
      }
      setSelection(null);
    } catch (error) {
      setToast({ type: 'error', message: error.message || 'Thao tác thất bại. Vui lòng thử lại.',
        action: error.code === 'INSUFFICIENT_BALANCE' ? { label: 'Sang Nạp tiền', to: '/wallet/top-up' } : undefined });
    } finally {
      setBusy(false); setConfirm(null); setRevision((value) => value + 1);
    }
  };
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-8 space-y-8">
      <Toast toast={toast} onClose={closeToast} placement="bottom" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-indigo-600 mb-2">KHÔNG GIAN HỌC TẬP</p>
          <h1 className="text-3xl font-semibold tracking-tight">Đặt phòng thư viện</h1>
          <p className="text-slate-500 mt-2">Một không gian yên tĩnh cho buổi học nhóm tiếp theo.</p>
        </div>
        <div className="rounded-2xl bg-indigo-600 p-5 text-white flex items-center gap-4 shadow-lg shadow-indigo-100">
          <Wallet className="w-6 h-6" />
          <div><p className="text-xs text-indigo-100">Số dư của tôi</p><p className="text-xl font-semibold" aria-live="polite">{snapshot ? formatMoney(snapshot.balance) : 'Đang tải…'}</p></div>
          <Link to="/wallet/top-up" className="rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25">Nạp tiền</Link>
        </div>
      </div>
      {roomBookingService.mode === 'mock' && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Chế độ trải nghiệm: phòng, lượt đặt và số dư là dữ liệu thử; không thu tiền thật.</p>}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-end justify-between border-b border-slate-200 pb-6">
        <label className="block text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-2 mb-2"><CalendarDays className="w-4 h-4" />Ngày sử dụng phòng</span>
          <input type="date" min={libraryToday()} value={date} onChange={(event) => changeDate(event.target.value)} className="block h-12 rounded-xl border border-slate-300 bg-white px-4 focus:ring-2 focus:ring-indigo-500" />
        </label>
        <p className="text-sm text-slate-500">Giờ mở cửa: 08:00–18:00 · Mỗi khung giờ 2 tiếng</p>
      </div>
      {loadError ? <div role="alert" className="p-6 bg-white rounded-2xl border border-rose-200 space-y-3"><p>{loadError}</p><Button size="sm" onClick={() => setRevision((value) => value + 1)}>Thử lại</Button></div> : !snapshot ? <p role="status" className="py-12 text-center text-slate-500">Đang tìm khung giờ trống…</p> : (
        <div className="grid lg:grid-cols-3 gap-5">
          {snapshot.rooms.map((room) => (
            <article key={room.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-6 bg-gradient-to-br from-indigo-50 to-cyan-50">
                <DoorOpen className="w-8 h-8 text-indigo-600 mb-5" />
                <h2 className="text-lg font-semibold">{room.name}</h2>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-500"><span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{room.floor}</span><span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{room.capacity} người</span></div>
                <p className="mt-4 text-xl text-indigo-700 font-semibold">{formatMoney(room.slotPrice)}<span className="text-xs font-normal text-slate-500"> / khung giờ</span></p>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-2 mb-5">{room.amenities.map((item) => <span key={item} className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{item}</span>)}</div>
                <p className="text-sm font-semibold mb-3">Chọn khung giờ</p>
                <div className="grid grid-cols-2 gap-2">
                  {room.slots.map((slot) => {
                    const selected = selection?.room.id === room.id && selection?.slot.id === slot.id;
                    return <button key={slot.id} type="button" disabled={!slot.available || busy} aria-pressed={selected} aria-label={`${room.name}, ${slot.start} đến ${slot.end}, ${slot.reason}`} onClick={() => setSelection({ room, slot })} className={`rounded-xl border px-2 py-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 ${selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 hover:border-indigo-400 text-slate-700'} disabled:bg-slate-50 disabled:text-slate-400 disabled:hover:border-slate-200 disabled:cursor-not-allowed`}><span className="block font-semibold">{slot.start}–{slot.end}</span><span className="text-[11px]">{selected ? 'Đã chọn' : slot.reason}</span></button>;
                  })}
                </div>
                {!room.slots.some((slot) => slot.available) && <p className="text-sm text-amber-700 mt-3">Không còn giờ trống. Hãy chọn ngày khác.</p>}
              </div>
            </article>
          ))}
        </div>
      )}
      {selection && <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div><p className="font-semibold text-indigo-900">{selection.room.name}</p><p className="text-sm text-indigo-700 mt-1">{formatLibraryDate(date)} · {selection.slot.start}–{selection.slot.end} · {formatMoney(selection.room.slotPrice)}</p></div>
        <Button onClick={() => setConfirm({ type: 'book' })} icon={<CalendarDays className="w-4 h-4" />}>Đặt khung giờ này</Button>
      </div>}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2"><Clock3 className="w-5 h-5 text-indigo-600" />Lượt đặt của tôi</h2>
        {snapshot?.bookings.length === 0 && <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-10 text-center text-slate-500">Bạn chưa có lượt đặt nào. Chọn phòng và khung giờ phía trên để bắt đầu.</div>}
        {snapshot?.bookings.map((booking) => {
          const started = slotTimestamp(booking.date, booking.start) <= now;
          const status = booking.status === 'CANCELLED' ? 'Đã hủy' : started ? 'Đã đến giờ sử dụng' : 'Đã xác nhận';
          return <article key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row justify-between gap-4">
            <div><div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">{booking.roomName}</h3><span className={`text-xs rounded-full px-3 py-1 ${booking.status === 'CANCELLED' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{status}</span></div><p className="mt-2 text-sm text-slate-500">{formatLibraryDate(booking.date)} · {booking.start}–{booking.end} · {formatMoney(booking.price)}</p></div>
            {booking.status === 'CONFIRMED' && slotTimestamp(booking.date, booking.start) - now >= 3600000 && <Button size="sm" variant="ghost" disabled={busy} className="text-rose-600" onClick={() => setConfirm({ type: 'cancel', booking })} icon={<RotateCcw className="w-4 h-4" />}>Hủy đặt phòng</Button>}
          </article>;
        })}
      </section>
      {confirm && <ConfirmDialog title={confirm.type === 'book' ? 'Xác nhận đặt phòng' : 'Hủy lượt đặt?'} confirmLabel={confirm.type === 'book' ? 'Xác nhận đặt' : 'Hủy và hoàn tiền'} danger={confirm.type === 'cancel'} loading={busy} onClose={() => setConfirm(null)} onConfirm={performAction}>
        {confirm.type === 'book' ? <><p>{selection.room.name} · {formatLibraryDate(date)}</p><p>{selection.slot.start}–{selection.slot.end}. Phí {formatMoney(selection.room.slotPrice)} được trừ từ số dư khi đặt thành công.</p></> : <p>Hủy {confirm.booking.roomName} lúc {confirm.booking.start} ngày {formatLibraryDate(confirm.booking.date)}? Khoản {formatMoney(confirm.booking.price)} sẽ được hoàn vào số dư.</p>}
      </ConfirmDialog>}
    </div>
  );
}
