# Hướng dẫn nhanh Thủ thư — LibManager

| | |
|---|---|
| **Sprint / task** | Sprint 3 Admin (FE) — cập nhật **28/10/2026** |
| **Người biên soạn** | Vân (FE Admin) |
| **Ứng dụng** | Cổng Quản trị LibManager |
| **URL (Docker)** | http://localhost:5174 |
| **Đăng nhập demo** | `admin` / `Admin@123` |
| **File nguồn** | `docs/HUONG_DAN_THU_THU.md` |

Tài liệu ngắn cho ca trực trên cổng Admin. Sidebar đã đủ các mục quản trị (không còn trang Tổng quan riêng).

**Máy quét barcode:** ô quét **tự focus**; tít mã hoặc gõ rồi **Enter**. Toast Admin hiện **giữa phía trên**.

**Banner vàng «Đang dùng dữ liệu mẫu»:** hiện khi trang chưa nối máy chủ (Users / Rooms / Unmatched / …) hoặc khi API tạm lỗi (Catalog / Inventory / eBook).

---

## Trạng thái nhanh theo màn hình

| Màn hình | Đường dẫn | Máy chủ |
|----------|-----------|---------|
| Danh mục sách | `/admin/catalog` | **Đã nối** (CRUD + thể loại + upload) |
| eBook / PDF | `/admin/ebooks` | **List + upload** đã nối; xem trước cần BE bật preview |
| Tồn kho | `/admin/inventory` | **Đã nối** (bản sao / thanh lý) |
| Mượn / Trả | `/admin/loans` | **Đã nối** quầy lookup / checkout / check-in |
| Thu phạt | `/admin/fines` | **Đã nối** lookup MSSV + thu đủ nợ |
| Báo mất / Hỏng | `/admin/incidents` | **Tạo** qua nhận trả; **danh sách** lưu trình duyệt |
| Người dùng | `/admin/users` | **Mẫu FE** (chờ API admin users) |
| Phòng học nhóm | `/admin/rooms` | **Mẫu FE** |
| Check-in phòng | `/admin/rooms/checkin` | **Mẫu FE** |
| GD chưa khớp | `/admin/unmatched` | **Mẫu FE** |

---

## 1. Check-out (xuất mượn) — `/admin/loans`

1. Cột **Quầy Xuất Phiếu Mượn**: nhập **MSSV / mã độc giả** → **Enter**.
2. Kiểm tra thẻ người mượn + danh sách phiếu (trạng thái, hạn).
3. (Tuỳ chọn) ghi chú tình trạng sách khi giao.
4. Quét barcode sách (**tít liên tục** — ô tự xóa sau mỗi lần) → thêm vào phiếu.
5. **Xác nhận xuất phiếu mượn** → Toast thành công / lỗi.

> Thành công khi có phiếu chờ xuất / chờ nhận và barcode khớp đúng đầu sách.

Thống kê góc trên = **phiên làm việc hiện tại** (không phải số liệu cả ngày từ máy chủ).

---

## 2. Check-in (nhận trả) — `/admin/loans`

1. Cột **Quầy Nhận Trả Sách Nhanh**: quét barcode sách trả → **Enter** (ô giữ mã để xác nhận).
2. Chọn tình trạng: **Nguyên vẹn** hoặc **Hư hỏng / Mất sách**.
3. **Xác nhận trả sách** → Toast thành công / lỗi nghiệp vụ.

Nếu hư hỏng / mất: sang **Thu phạt** (`/admin/fines`) hoặc **Biên bản** (`/admin/incidents`).

---

## 3. Thu phạt — `/admin/fines`

1. Nhập **MSSV** → **Enter** để tra cứu công nợ.
2. Xem các khoản chưa thu / tổng nợ.
3. **Thu tiền** → **Xác nhận Đã Thu** (tiền mặt; **thu đủ toàn bộ** nợ).

---

## 4. Báo mất / hỏng — `/admin/incidents`

1. **Lập biên bản** → nhập mã vạch / mã phiếu → **Tra cứu**.
2. Chọn loại (mất / hỏng), mô tả, tiền bồi thường → Lưu.
3. Nếu máy chủ nhận được: sự cố được ghi qua luồng nhận trả; bảng danh sách vẫn chủ yếu trên trình duyệt.

---

## 5. Danh mục & tồn kho & eBook (UC09)

### `/admin/catalog`
- Tìm (debounce) + phân trang; thêm/sửa/xóa đầu sách; upload bìa/PDF.
- **Quản lý thể loại**: thêm / sửa / xóa.

### `/admin/inventory`
- Chọn đầu sách → xem barcode, vị trí kệ, tình trạng.
- Thêm / sửa / xóa bản sao; **không thanh lý** khi đang mượn.

### `/admin/ebooks`
- Danh sách đầu sách điện tử; tải lên / thay PDF; xem trước khi máy chủ hỗ trợ.

---

## 6. Phòng học nhóm & check-in

### `/admin/rooms`
1. Xem / thêm / sửa phòng; ngừng phòng còn lịch đặt tương lai → Toast nghiệp vụ.
2. **Check-in mã đặt** → `/admin/rooms/checkin`.

### `/admin/rooms/checkin`
1. Nhập mã đặt → Enter / xác nhận (vd mẫu `RB-2026-1001`).
2. Xem lượt đặt trong ngày.

> Đang dùng **dữ liệu mẫu** trên trình duyệt.

---

## 7. Người dùng & giao dịch chưa khớp

### `/admin/users`
CRUD, khóa/mở khóa, đặt lại mật khẩu tạm (hiện một lần) — **mẫu FE**.

### `/admin/unmatched`
Gán giao dịch nạp tiền chưa khớp cho bạn đọc — **mẫu FE** (không cộng ví thật).

---

## 8. Sơ đồ ca trực

| Việc | Đường dẫn |
|------|-----------|
| Danh mục / thể loại | `/admin/catalog` |
| eBook / PDF | `/admin/ebooks` |
| Tồn kho / thanh lý | `/admin/inventory` |
| Mượn–trả (quầy) | `/admin/loans` |
| Thu phạt | `/admin/fines` |
| Mất–hỏng | `/admin/incidents` |
| Người dùng | `/admin/users` |
| Phòng / check-in mã đặt | `/admin/rooms`, `/admin/rooms/checkin` |
| Giao dịch chưa khớp | `/admin/unmatched` |

---

## 9. API quầy đã mount (tham chiếu kỹ thuật)

- `GET /api/admin/loans/lookup`
- `POST /api/admin/loans/checkout`
- `POST /api/admin/loans/checkin`
- `GET /api/admin/fines/lookup`
- `POST /api/admin/fines/collect`
- Admin books / categories / inventory (UC09)

Swagger: http://localhost:8010/docs (JWT admin trước khi thử).
