// Ngày nghiệp vụ của thư viện luôn theo múi giờ Việt Nam.
export function libraryToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function slotTimestamp(date, time) {
  return new Date(`${date}T${time}:00+07:00`).getTime();
}

export const formatMoney = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(value);

export const formatLibraryDate = (date) => new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium',
}).format(new Date(`${date}T12:00:00+07:00`));
