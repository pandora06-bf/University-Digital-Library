# Hướng dẫn nhanh Thủ thư — LibManager

| | |
|---|---|
| **Sprint / task** | Sprint 3 Admin (FE) — cập nhật **08/11/2026** |
| **Người biên soạn** | Vân (FE Admin) |
| **Ứng dụng** | Cổng Quản trị LibManager |
| **URL (Docker)** | http://localhost:5174 |
| **API** | http://localhost:8010 |
| **Đăng nhập demo** | `admin` / `Admin@123` — vào thẳng **Danh mục sách** |
| **File nguồn** | `docs/HUONG_DAN_THU_THU.md` |

Tài liệu ngắn cho ca trực trên cổng Admin. Sidebar đủ các mục quản trị (không có trang Tổng quan riêng).

**Máy quét barcode:** ô quét tự focus. Tít mã hoặc gõ rồi **Enter**. Toast hiện giữa phía trên.

**Barcode** là mã từng bản in (`DEMO-BC-099-01`), xem ở **Tồn kho** sau khi chọn đầu sách. File ebook không có barcode.

**Bạn đọc thật trong database** dùng mã `SV-DEMO-001`, `GV-DEMO-002`, … Đăng nhập cổng bạn đọc: `demo_student_001` / `User@123`. Trang **Người dùng** của Admin vẫn là dữ liệu mẫu (`50214569`, `TEST409DEBT`), không dùng các mã đó để mượn hoặc thu phạt.

**Banner vàng «Đang dùng dữ liệu mẫu»:** trang chưa ghi máy chủ (Người dùng, Phòng, Giao dịch chưa khớp) hoặc API tạm lỗi (Danh mục, Tồn kho, eBook).

---

## Trạng thái nhanh theo màn hình

| Màn hình | Đường dẫn | Máy chủ |
|----------|-----------|---------|
| Danh mục sách | `/admin/catalog` | **Đã nối** (CRUD + thể loại + bìa/PDF) |
| eBook / PDF | `/admin/ebooks` | **Đã nối** list + upload + preview (`ebook_router`). Chỉ hiện «Sẵn sàng» khi `has_pdf` |
| Tồn kho | `/admin/inventory` | **Đã nối** (bản sao / thanh lý) |
| Mượn / Trả | `/admin/loans` | **Đã nối** tra cứu / xuất mượn / nhận trả |
| Thu phạt | `/admin/fines` | **Đã nối** tra một mã bạn đọc + thu đủ nợ. Không có danh sách mọi phiếu |
| Báo mất / Hỏng | `/admin/incidents` | **Đã nối** `GET /api/admin/incidents` + tạo `POST /api/admin/loans/incident` |
| Người dùng | `/admin/users` | **Mẫu FE** (chưa có list-all; có import/reset riêng) |
| Phòng học nhóm | `/admin/rooms` | **Mẫu FE** |
| Check-in phòng | `/admin/rooms/checkin` | **Mẫu FE** |
| GD chưa khớp | `/admin/unmatched` | **Mẫu FE** (không cộng ví thật) |

---

## 1. Check-out (xuất mượn) — `/admin/loans`

1. Cột **Quầy Xuất Phiếu Mượn**: nhập **mã bạn đọc** (`SV-DEMO-001`) → **Enter**.
2. Xem phiếu chờ nhận nếu có. Không có phiếu chờ vẫn xuất mượn trực tiếp tại quầy.
3. Ghi chú tình trạng sách khi giao nếu cần.
4. Quét barcode bản in đang **Sẵn sàng** (ô tự xóa sau mỗi lần) → thêm vào phiếu.
5. **Xác nhận xuất phiếu mượn**.

Barcode không có trong kho thì toast: không tìm thấy bản sao (E1). Sách đang giữ chỗ cho bạn đọc khác thì máy chủ từ chối xuất cho người không giữ chỗ.

Thống kê góc trên là **phiên làm việc hiện tại**, không phải số liệu cả ngày.

---

## 2. Check-in (nhận trả) — `/admin/loans`

1. Cột **Quầy Nhận Trả Sách Nhanh**: quét barcode bản đang **BORROWED** hoặc **OVERDUE** → **Enter** (ô giữ mã để xác nhận).
2. Chọn **Nguyên vẹn** hoặc **Hư hỏng / Mất sách**.
3. **Xác nhận trả sách** một lần.

Chỉ trả được phiếu còn đang mượn hoặc quá hạn. Bấm lại cùng mã sau khi đã trả sẽ báo không còn phiếu BORROWED (E3).

Lần trả đầu đôi khi hiện **Hệ thống gặp sự cố** dù sách đã được ghi nhận trả. Tra lại mã: nếu bản sao đã **Sẵn sàng** thì không trả thêm lần nữa.

Phiếu quá hạn **đã có khoản phạt** (mẫu `DEMO-BC-002-01` / `SV-DEMO-003`) hiện chưa nhận trả được: máy chủ báo dữ liệu trùng.

Mất hoặc hỏng nặng: lập tiếp ở **Báo mất / Hỏng**. Tiền phạt quá hạn thu ở **Thu phạt**.

---

## 3. Thu phạt — `/admin/fines`

1. Nhập đúng **mã bạn đọc** (`SV-DEMO-003`) → **Enter**. Bảng trống cho đến khi tra cứu.
2. Xem khoản chưa thu và tổng nợ.
3. **Thu tiền** → **Xác nhận Đã Thu**. Chỉ thu **đủ toàn bộ** nợ một lần, bằng tiền mặt.

`demo_student_003` và mã trên trang Người dùng mẫu không tra được.

---

## 4. Báo mất / hỏng — `/admin/incidents`

1. Bảng danh sách lấy từ `GET /api/admin/incidents`.
2. **Lập biên bản** → nhập **mã bạn đọc** hoặc **số id phiếu** → **Tra cứu**.
3. Chỉ phiếu **BORROWED** hoặc **OVERDUE** được điền vào form. Quét barcode ở ô này hiện chưa ra phiếu.
4. Chọn mất hoặc hỏng, mô tả, tiền bồi thường (tra cứu chưa trả giá bìa, nhập tay nếu ô tiền bằng 0) → Lưu.

Lưu ưu tiên `POST /api/admin/loans/incident`. Nếu thiếu `loan_id` hợp lệ mới thử luồng nhận trả. Phiếu quá hạn đã có phạt có thể bị từ chối.

---

## 5. Danh mục, tồn kho, eBook

### `/admin/catalog`

Tìm (tự tìm sau khoảng 0,35 giây) và phân trang. Thêm, sửa, xóa đầu sách. Upload bìa và PDF. Quản lý thể loại: thêm, sửa, xóa.

Form thêm đầu sách chỉ có **tên sách**. Không có ô tên khác.

### `/admin/inventory`

Chọn đầu sách → xem mã vạch, vị trí kệ, tình trạng.

Thêm, sửa, xóa bản sao. **Không thanh lý** bản đang cho mượn. Lý do thanh lý **không bắt buộc**. Để trống thì ghi chú mặc định `[Thanh lý] Ngừng lưu thông`.

Sau thanh lý, bản sao ở lại danh sách của đầu sách với trạng thái **Đã thanh lý**, không còn tính vào tồn cho mượn. Sửa vẫn đổi được vị trí kệ và ghi chú. Không đưa lại **Sẵn sàng** hoặc **Đang mượn**.

### `/admin/ebooks`

Danh sách gồm sách `EBOOK` và `BOTH` từ search. Cột trạng thái: **Sẵn sàng** chỉ khi máy chủ báo `has_pdf`; chưa có PDF thì **Chưa có PDF** (không bịa tên `ebook-{id}.pdf`).

Tải / thay PDF được với đầu sách `EBOOK` hoặc `BOTH`. Form có **trang xem trước (5–10)** và **miễn phí đọc toàn bộ**; `borrow_days` gửi sẵn 14.

**Xem trước** gọi `GET /api/ebooks/{id}/preview` (router đã gắn). Nút mắt khóa khi chưa có PDF. Seed cũ ghi `demo/ebook-NNN.pdf` vẫn mở được nếu file `ebook-NNN.pdf` có trong `private_storage/ebooks/`.

---

## 6. Phòng học nhóm

### `/admin/rooms`

Xem, thêm, sửa phòng. Ngừng phòng còn lịch đặt tương lai thì có toast nghiệp vụ. **Check-in mã đặt** mở `/admin/rooms/checkin`.

### `/admin/rooms/checkin`

Nhập mã đặt → Enter (mẫu `RB-2026-1001`). Xem lượt trong ngày.

Đang dùng dữ liệu mẫu trên trình duyệt.

---

## 7. Người dùng và giao dịch chưa khớp

### `/admin/users`

Thêm, sửa, khóa, mở khóa, đặt lại mật khẩu tạm (hiện một lần). Chỉ lưu trên trình duyệt. Banner vàng nghĩa là chưa ghi máy chủ. Danh sách này không phải 100 hồ sơ `SV-DEMO-xxx`.

### `/admin/unmatched`

Gán giao dịch nạp tiền chưa khớp. Chỉ mô phỏng trên trình duyệt, không cộng ví thật.

---

## 8. Sơ đồ ca trực

| Việc | Đường dẫn |
|------|-----------|
| Danh mục / thể loại | `/admin/catalog` |
| eBook / PDF | `/admin/ebooks` |
| Tồn kho / thanh lý / barcode | `/admin/inventory` |
| Mượn–trả | `/admin/loans` |
| Thu phạt | `/admin/fines` |
| Mất–hỏng | `/admin/incidents` |
| Người dùng (mẫu) | `/admin/users` |
| Phòng / check-in mã đặt (mẫu) | `/admin/rooms`, `/admin/rooms/checkin` |
| Giao dịch chưa khớp (mẫu) | `/admin/unmatched` |

---

## 9. API quầy đã gắn

- `GET /api/admin/loans/lookup` — theo id phiếu hoặc mã bạn đọc
- `POST /api/admin/loans/checkout`
- `POST /api/admin/loans/checkin`
- `GET /api/admin/fines/lookup`
- `POST /api/admin/fines/collect`
- Sách, thể loại, tồn kho
- `GET /api/ebooks/{id}/preview` — đã gắn; search trả `has_pdf` / `preview_pages` / `is_free`
- `GET /api/admin/incidents`, `POST /api/admin/loans/incident`

Swagger: http://localhost:8010/docs (đăng nhập admin lấy JWT trước khi thử).
