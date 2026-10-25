# Bàn giao 3-15, 3-18.a và 3-23

Ngày: 14/10/2026. Đối chiếu bản phân công mới, gồm quy tắc của 3-03,
2B-21, 2B-22 và 3-10 để các giao diện không lệch nghiệp vụ backend.

## Chạy và mở các màn hình

```sh
cd libmanager-frontend
npm install
npm run dev
```

- Trang đặt phòng: `/rooms`; có link ở thanh điều hướng desktop và mobile.
- Trang Nạp tiền thử: `/wallet/top-up`.
- Xem trước eBook: từ chi tiết sách bấm **Xem trước eBook**, hoặc
  `/books/b1/preview`. Sau khi mượn chuyển sang `/reader/<mã-phiếu>`.
- `/reader/loan_01` minh họa trạng thái không còn quyền đọc của phiếu cũ.
- Mã sách hoặc phiếu không tồn tại hiện thông báo; không mở một sách khác.

Mặc định eBook dùng dữ liệu giả (`VITE_USE_MOCK=true`). Đặt biến này trong
`libmanager-frontend/.env.local` nếu cần. Tài liệu mẫu là PDF tự tạo, không
chứa sách bản quyền, gồm 12 trang; endpoint giả xem trước chỉ cấp 5 trang.

## 3-15: ProtectedPDFViewer.jsx

Thay màn mô phỏng bằng `react-pdf` 11; worker PDF.js được Vite đóng gói cùng
ứng dụng. Màn có chuyển trang, zoom, watermark, trạng thái đang tải/lỗi,
xem trước và nút mượn, mượn lại, xác nhận trả sách. Không có nút tải hoặc in.
Chặn context menu trong viewer và Ctrl/Cmd+P, Ctrl/Cmd+S trong thời gian
màn đọc được mở; CSS print ẩn tài liệu kể cả khi dùng menu in của trình duyệt.

Phiên xem trước giới hạn 5–10 trang. Phiên đã mượn đòi hỏi token và hạn đọc
hợp lệ; lấy hạn sớm nhất của token và phiếu mượn. Kiểm tra mỗi giây và khi
quay lại tab. Hết hạn hoặc lỗi PDF HTTP 401/403 thì gỡ `Document` và canvas,
khóa điều hướng, hiện **Mượn lại**. Khi trả thành công, gỡ tài liệu ngay.
Trả eBook từ Sách của tôi không tăng tồn kho bản giấy.

`ebookService.js` có adapter API cho các endpoint đã ghi trong bản phân công:

- `GET /api/books/{book_id}`: metadata; cần `title`, `ebook.is_free`,
  `ebook.preview_pages` (số trang từ 5 đến 10).
- `GET /api/ebooks/{book_id}/preview`: byte PDF đã cắt trang cho sách bản quyền;
  sách miễn phí được backend trả toàn bộ. Không dùng JSON chứa link tĩnh công khai.
- `POST /api/loans/ebook/borrow`, body `{ "book_id": ... }`, trả `id` hoặc `loan_id`.
- `GET /api/loans/me?skip=...&limit=50`: dùng API lịch sử đã có; đọc các trường
  `id`, `book_id`, `book_title`, `loan_type=EBOOK`, `loan_status=BORROWED`,
  `due_date`, `read_token` hoặc `ebook_access_token`, tùy chọn `read_token_expires_at`.
- `GET /api/ebooks/{book_id}/stream?read_token=...`: React-PDF gửi JWT đăng nhập
  qua Authorization header và read token qua query. Mỗi request, kể cả Range,
  backend phải kiểm tra chủ sở hữu, hạn, quyền đọc, phiếu đã trả.
- `POST /api/loans/{loan_id}/return-ebook`.

Ngày giờ nên trả ISO 8601 có offset/Z. Timestamp không offset hiện tại được
frontend coi là UTC+7. Các tên trường ebook metadata/borrow mới là hợp đồng
đề xuất cần thống nhất với Nhất khi 3-03 xong. `VITE_USE_MOCK=false` chỉ bật
sau khi các API này có thật; hiện chúng chưa có trong backend local.

Bảo vệ URL `/stream` là trách nhiệm backend 3-03/2B-10: PDF phải nằm ngoài
thư mục static công khai; backend trả 403 khi token hết hạn/đã trả. Việc chặn
UI không thay thế kiểm tra này. Network vẫn thấy URL, và người đang có quyền
đọc có thể chụp màn hình như giới hạn được chấp nhận trong bản phân công.
Sau khi nối API, phải kiểm tra URL với token hết hạn và token đã thu hồi bằng
request thật; hiện chưa xác nhận được do backend chưa triển khai.

## 3-18.a: RoomBookingPage.jsx

Dùng chung Button, Toast, dialog xác nhận. Có ngày, phòng, sức chứa, tiện ích,
giá theo **khung 2 giờ**, giờ còn trống/đã đặt/đã qua; đặt và hủy; lịch sử của
tôi; số dư và CTA Nạp tiền. Toast thiếu số dư giữ nút Nạp tiền cho đến khi
người dùng đóng hoặc chuyển trang. Có trạng thái tải, lỗi, thử lại, danh sách rỗng.

Mock store đặt trong `mocks/roomBookings.js`, lưu số dư cùng lượt đặt trong
một object sessionStorage, tách theo user ID; mỗi ngày chỉ một lượt CONFIRMED,
kiểm tra giờ trống và số dư trước khi ghi; hủy tối thiểu 1 giờ trước bắt đầu,
hoàn 100%, hủy lần hai không hoàn lần nữa. Đồng hồ/snapshot làm mới mỗi 30 giây.
Quy tắc hủy/hoàn theo 2B-22 và 3-10. Mỗi thao tác vẫn kiểm tra lại giờ ở store.

`services/roomBookingService.js` là adapter mock riêng; nó chưa gọi API thật,
kể cả khi đổi `VITE_USE_MOCK` của eBook. Sau 2B-22/2B-21, thay các phương thức
trong adapter, giữ các giao diện Promise sau để không cần viết lại trang:

```js
getSnapshot(date) // { balance, bookings, rooms }
book({ roomId, date, slotId }) // booking mới
cancel(bookingId) // booking đã hủy
```

Shape nội bộ:

```js
room = { id, name, floor, capacity, slotPrice, amenities,
  slots: [{ id, start: '08:00', end: '10:00', available, reason }] }
booking = { id, roomId, roomName, date: '2026-10-14', slotId,
  start, end, price, status: 'CONFIRMED' | 'CANCELLED', createdAt }
```

API theo phân công: GET `/api/rooms`, GET `/api/rooms/{room_id}/availability`,
POST `/api/room-bookings`, GET `/api/room-bookings/my`, DELETE
`/api/room-bookings/{booking_id}`, GET `/api/wallet`. Thống nhất body/schema
với Nhất/Hiền trước khi viết mapper; server phải quyết định phí, hoàn tiền,
khóa tài khoản và bảo vệ đặt trùng. Mock không thay thế transaction hoặc kiểm
tra cạnh tranh của backend. Ánh xạ 402 thành `INSUFFICIENT_BALANCE`, 409
thành lỗi giờ đã đặt/hạn mức để trang hiển thị thông báo.

Trang Nạp tiền hiện chỉ thêm **tiền thử**, được ghi rõ trên màn hình. Khi
4-13 xong thay trang đích này bằng WalletSection/TopUpModal thật. Không tự
cộng tiền ở frontend khi dùng giao dịch thật.

## 3-23: Email

Sản phẩm nằm trong backend thật `back_fast_api/templates/email/*.html`:
`receipt`, `due_reminder`, `hold_24h`, `top_up` (đã chuyển từ `backend/`
để Docker có sẵn template). Hướng dẫn đường dẫn loader trong
`back_fast_api/templates/email/README.md`. Các mẫu dùng bảng 600px co theo chiều
rộng, CSS inline, escape biến, font hệ thống, không phụ thuộc hình ảnh.

`sample_context.json`, `render_preview.py` và bốn bản HTML trong `preview/`
để Nhất gắn thử dữ liệu. Backend cần Jinja2, StrictUndefined và autoescape.
Mốc giữ chỗ và số tiền nạp thực nhận do backend tính; template chỉ hiển thị.

Chưa chạy render bằng Python/Jinja2 tại máy này: Python launcher có nhưng
không có Python runtime. Bản preview đã gắn dữ liệu bằng tiện ích Node tạm,
kiểm tra thiếu biến, escape HTML và CSS inline; đây không phải kiểm tra Jinja2 thật.
Gmail chưa được kiểm tra hiển thị trực tiếp vì chưa có kết nối tài khoản và
trình duyệt khả dụng. Checklist Gmail và lệnh render thật trong README email.

## Kiểm tra đã chạy

```sh
cd libmanager-frontend
npm run verify:features
npm run build
```

- 9 kiểm tra nghiệp vụ đạt: trừ tiền/đặt lặp, hạn mức ngày, hoàn tiền chỉ một
  lần, thiếu số dư, ranh giới hủy 1 giờ, ngày/giờ không hợp lệ, tách số dư,
  số trang PDF preview/full, eBook không đổi tồn giấy, hết hạn/mượn lại,
  mã phiếu sai, hạn/token sai và nhận diện 401/403.
- ESLint trên toàn bộ file frontend mới/sửa: đạt.
- Vite production build: đạt. Có cảnh báo bundle lớn; viewer đã lazy-load.
- ESLint toàn repo còn lỗi cũ trong BookManagement.jsx, CatalogManagement.jsx
  và vite.config.js. Các file đó chưa được sửa trong đợt này.
- Chưa kiểm tra UI bằng trình duyệt, phím tắt thực tế, API server, SMTP hoặc Gmail.

Kiểm tra giao diện tiếp theo: desktop/mobile 375px, chọn/hủy/nạp thử rồi đặt
lại, đọc đến trang cuối preview, zoom, Ctrl/Cmd+P/S, context menu, để phiên
hết hạn và thử 403 thật. Với email kiểm tra Gmail web/mobile và chế độ tối.
