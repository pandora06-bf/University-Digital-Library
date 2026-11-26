import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, DoorOpen, MapPin, Users, Wallet, RotateCcw } from 'lucide-react';
import { Button } from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import ToastAlertComponent from '../../components/ToastAlertComponent';
import { roomBookingService } from '../../services/roomBookingService';
import { libraryToday, formatLibraryDate, formatMoney, slotTimestamp } from '../../utils/libraryDate';
import { describeBooking, formatPrice } from '../../utils/roomBooking';

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-800', rose: 'bg-rose-50 text-rose-700',
  indigo: 'bg-indigo-50 text-indigo-700', slate: 'bg-slate-100 text-slate-600',
};
const ACTIVE = ['CONFIRMED', 'CHECKED_IN'];
// Lượt còn hiệu lực lên đầu (gần nhất trước), lịch sử phía sau (mới nhất trước).
const sortBookings = (bookings) => [...bookings].sort((a, b) => {
  const activeA = ACTIVE.includes(a.status), activeB = ACTIVE.includes(b.status);
  if (activeA !== activeB) return activeA ? -1 : 1;
  const diff = slotTimestamp(a.date, a.start) - slotTimestamp(b.date, b.start);
  return activeA ? diff : -diff;
});

export default function RoomBookingPage() {
  const [date, setDate] = useState(libraryToday);
  const [snapshot, setSnapshot] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState(null);
  const [attendees, setAttendees] = useState(1); // 2B-22: số người tham dự, không vượt sức chứa phòng
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [failure, setFailure] = useState(null); // thiếu số dư, hết chỗ... → Toast đỏ (4-14.a)
  const [now, setNow] = useState(Date.now);
  const closeToast = useCallback(() => { setToast(null); setFailure(null); }, []);

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
    setBusy(true); closeToast();
    try {
      if (confirm.type === 'book') {
        await roomBookingService.book({ roomId: selection.room.id, date, slotId: selection.slot.id, slotEnd: selection.slot.end, attendees });
        setToast({ message: 'Đặt phòng thành công. Bạn có thể xem lượt đặt ở bên dưới.' });
      } else {
        await roomBookingService.cancel(confirm.booking.id);
        setToast({ message: 'Đã hủy lượt đặt và hoàn tiền vào số dư.' });
      }
      setSelection(null);
    } catch (error) {
      // mapRoomApiError đã đổi câu; thiếu số dư thì ToastAlertComponent thêm nút Sang Nạp tiền
      setFailure(error);
    } finally {
      setBusy(false); setConfirm(null); setRevision((value) => value + 1);
    }
  };
  const choose = (room, slot) => {
    setSelection({ room, slot });
    setAttendees((value) => Math.min(Math.max(1, value), room.capacity || 1));
  };
  // Giờ mở cửa lấy theo khung giờ API trả về, không ghi cứng.
  const daySlots = snapshot?.rooms.find((room) => room.slots.length)?.slots ?? [];
  const hours = daySlots.length ? `Giờ mở cửa: ${daySlots[0].start}–${daySlots.at(-1).end} · ` : '';
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-8 space-y-8">
      <ToastAlertComponent error={failure} notice={toast} onClose={closeToast} />
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
        <p className="text-sm text-slate-500">{hours}Mỗi khung giờ 2 tiếng</p>
      </div>
      {loadError ? <div role="alert" className="p-6 bg-white rounded-2xl border border-rose-200 space-y-3"><p>{loadError}</p><Button size="sm" onClick={() => setRevision((value) => value + 1)}>Thử lại</Button></div> : !snapshot ? <p role="status" className="py-12 text-center text-slate-500">Đang tìm khung giờ trống…</p> : (
        <div className="grid lg:grid-cols-3 gap-5">
          {snapshot.rooms.map((room) => (
            <article key={room.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-6 bg-gradient-to-br from-indigo-50 to-cyan-50">
                <DoorOpen className="w-8 h-8 text-indigo-600 mb-5" />
                <h2 className="text-lg font-semibold">{room.name}</h2>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-500"><span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{room.floor}</span><span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{room.capacity} người</span></div>
                <p className="mt-4 text-xl text-indigo-700 font-semibold">{formatPrice(room.slotPrice)}{Number.isFinite(room.slotPrice) && <span className="text-xs font-normal text-slate-500"> / khung giờ</span>}</p>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-2 mb-5">{room.amenities.map((item) => <span key={item} className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{item}</span>)}</div>
                <p className="text-sm font-semibold mb-3">Chọn khung giờ</p>
                <div className="grid grid-cols-2 gap-2">
                  {room.slots.map((slot) => {
                    const selected = selection?.room.id === room.id && selection?.slot.id === slot.id;
                    return <button key={slot.id} type="button" disabled={!slot.available || busy} aria-pressed={selected} aria-label={`${room.name}, ${slot.start} đến ${slot.end}, ${slot.reason}`} onClick={() => choose(room, slot)} className={`rounded-xl border px-2 py-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 ${selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 hover:border-indigo-400 text-slate-700'} disabled:bg-slate-50 disabled:text-slate-400 disabled:hover:border-slate-200 disabled:cursor-not-allowed`}><span className="block font-semibold">{slot.start}–{slot.end}</span><span className="text-[11px]">{selected ? 'Đã chọn' : slot.reason}</span></button>;
                  })}
                </div>
                {!room.slots.some((slot) => slot.available) && <p className="text-sm text-amber-700 mt-3">Không còn giờ trống. Hãy chọn ngày khác.</p>}
              </div>
            </article>
          ))}
        </div>
      )}
      {selection && <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div><p className="font-semibold text-indigo-900">{selection.room.name}</p><p className="text-sm text-indigo-700 mt-1">{formatLibraryDate(date)} · {selection.slot.start}–{selection.slot.end} · {formatPrice(selection.room.slotPrice)}</p></div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 w-full sm:w-auto">
          <label className="text-sm font-semibold text-indigo-900">
            <span className="flex items-center gap-1.5 mb-1"><Users className="w-4 h-4" />Số người</span>
            <input type="number" inputMode="numeric" min={1} max={selection.room.capacity} value={attendees}
              onChange={(event) => setAttendees(Math.min(Math.max(1, Number(event.target.value) || 1), selection.room.capacity))}
              aria-describedby="attendee-hint" className="block h-11 w-full sm:w-24 rounded-xl border border-indigo-200 bg-white px-3 text-base focus:ring-2 focus:ring-indigo-500" />
            <span id="attendee-hint" className="block mt-1 text-xs font-normal text-indigo-700">Tối đa {selection.room.capacity} người</span>
          </label>
          <Button onClick={() => setConfirm({ type: 'book' })} icon={<CalendarDays className="w-4 h-4" />} className="w-full sm:w-auto">Đặt khung giờ này</Button>
        </div>
      </div>}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2"><Clock3 className="w-5 h-5 text-indigo-600" />Lượt đặt của tôi</h2>
        {snapshot?.bookings.length === 0 && <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-10 text-center text-slate-500">Bạn chưa có lượt đặt nào. Chọn phòng và khung giờ phía trên để bắt đầu.</div>}
        {snapshot && sortBookings(snapshot.bookings).map((booking) => {
          const info = describeBooking(booking, now);
          return <article key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">{booking.roomName}</h3><span className={`text-xs rounded-full px-3 py-1 ${TONES[info.tone]}`}>{info.label}</span></div>
              <p className="mt-2 text-sm text-slate-500">{formatLibraryDate(booking.date)} · {booking.start}–{booking.end} · {formatPrice(booking.price)}</p>
              {info.note && <p className="mt-1 text-xs text-slate-500">{info.note}</p>}
            </div>
            {info.cancellable && <Button size="sm" variant="ghost" disabled={busy} className="text-rose-600 self-start sm:self-center" onClick={() => setConfirm({ type: 'cancel', booking })} icon={<RotateCcw className="w-4 h-4" />}>Hủy đặt phòng</Button>}
          </article>;
        })}
      </section>
      {confirm && <ConfirmDialog title={confirm.type === 'book' ? 'Xác nhận đặt phòng' : 'Hủy lượt đặt?'} confirmLabel={confirm.type === 'book' ? 'Xác nhận đặt' : 'Hủy và hoàn tiền'} danger={confirm.type === 'cancel'} loading={busy} onClose={() => setConfirm(null)} onConfirm={performAction}>
        {confirm.type === 'book' ? <><p>{selection.room.name} · {formatLibraryDate(date)} · {attendees} người</p><p>{selection.slot.start}–{selection.slot.end}. {Number.isFinite(selection.room.slotPrice) ? `Phí ${formatMoney(selection.room.slotPrice)} được trừ từ số dư khi đặt thành công.` : 'Phí được trừ từ số dư theo quy định của thư viện khi đặt thành công.'}</p></> : <p>Hủy {confirm.booking.roomName} lúc {confirm.booking.start} ngày {formatLibraryDate(confirm.booking.date)}? {Number.isFinite(confirm.booking.price) ? `Khoản ${formatMoney(confirm.booking.price)} sẽ được hoàn 100% vào số dư.` : 'Phí đã trả sẽ được hoàn 100% vào số dư.'}</p>}
      </ConfirmDialog>}
    </div>
  );
}
