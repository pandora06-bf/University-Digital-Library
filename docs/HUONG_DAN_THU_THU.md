# Hướng dẫn nhanh Thủ thư — LibManager

| | |
|---|---|
| **Sprint / task** | 4-17.a (phần 1/2) — bàn giao **23/10/2026** |
| **Người biên soạn** | Vân (FE Admin) |
| **Ứng dụng** | Cổng Quản trị LibManager |
| **URL (Docker)** | http://localhost:5174 |
| **Đăng nhập demo** | `admin` / `Admin@123` |
| **File nguồn** | `docs/HUONG_DAN_THU_THU.md` |

Tài liệu ngắn cho ca trực: Check-out, Check-in, thu phạt, báo mất/hỏng, check-in phòng.

**Máy quét barcode:** ô quét **tự focus** (`autoFocus`); tít mã hoặc gõ rồi **Enter** — hạn chế chuột. Toast Admin hiện **giữa phía trên**.

---

## 1. Check-out (xuất mượn) — `/admin/loans`

1. Cột **Quầy Xuất Phiếu Mượn**: nhập **MSSV / mã độc giả** → **Enter** (gọi `GET /api/admin/loans/lookup`).
2. Kiểm tra thẻ **Người mượn + danh sách phiếu** (mã phiếu, tên sách, trạng thái, hạn).
3. (Tuỳ chọn) Điền **condition_notes** — ghi chú tình trạng sách khi giao (BR-03).
4. Quét barcode sách (`FastBarcodeScanner`, tự xóa sau mỗi lần quét) → thêm vào phiếu.
5. **Xác nhận xuất phiếu mượn** → API `POST /api/admin/loans/checkout` → Toast thành công / lỗi.

> Check-out thành công khi có phiếu `REQUESTED` hoặc `PENDING_PICKUP` và barcode khớp đúng đầu sách của phiếu.

---

## 2. Check-in (nhận trả) — `/admin/loans`

1. Cột **Quầy Nhận Trả Sách Nhanh**: quét barcode sách trả → **Enter** (ô đã autoFocus).
2. Chọn tình trạng: **Nguyên vẹn** hoặc **Hư hỏng / Mất sách** (có thể ghi chú chi tiết trong modal).
3. **Xác nhận trả sách** → API `POST /api/admin/loans/checkin` → Toast thành công / lỗi nghiệp vụ.

Nếu hư hỏng / mất: chuyển **Thu phạt** (`/admin/fines`) hoặc **Biên bản** (`/admin/incidents`).

---

## 3. Thu phạt — `/admin/fines`

1. Ô tìm: nhập **MSSV** → **Enter** (`GET /api/admin/fines/lookup`).
2. Toast báo số khoản UNPAID / tổng nợ (hoặc không còn nợ).
3. **Thu tiền** → **Xác nhận Đã Thu** → `POST /api/admin/fines/collect`.

> API chỉ cho phép **thu đủ toàn bộ** `total_fines` (không thu một phần).

---

## 4. Báo mất / hỏng — `/admin/incidents`

1. Tra cứu barcode / mã phiếu (UI mock hỗ trợ ca trực) nếu cần xác minh phiếu đang mượn.
2. **Lập biên bản sự cố** → chọn loại (mất / hỏng), ghi chú → lưu.
3. Toast xác nhận; theo dõi công nợ tại `/admin/fines` nếu cần.

---

## 5. Check-in phòng học nhóm

| | |
|---|---|
| Độc giả đặt / xem lượt | Cổng User **`/rooms`** (mock đặt phòng + số dư demo) |
| Màn Admin quầy check-in phòng | **Chưa có** (ghi nợ phần 2/2 nếu sprint sau làm) |
| Cách làm tạm trong ca | Đối chiếu danh sách đặt trên `/rooms`; xác nhận miệng / ghi sổ khi SV đến giờ |

---

## 6. Sơ đồ ca trực (Admin)

| Việc | Đường dẫn |
|------|-----------|
| Danh mục / giá bìa (debounce + phân trang server) | `/admin/catalog` |
| Tồn kho / thanh lý bản sao | `/admin/inventory` |
| Mượn–trả (quầy) | `/admin/loans` |
| Thu phạt | `/admin/fines` |
| Mất–hỏng | `/admin/incidents` |
| Đặt phòng (User) | `/rooms` |

---

## 7. API quầy liên quan (đã mount BE)

- `GET /api/admin/loans/lookup`
- `POST /api/admin/loans/checkout`
- `POST /api/admin/loans/checkin`
- `GET /api/admin/fines/lookup`
- `POST /api/admin/fines/collect`

Swagger: http://localhost:8010/docs (đăng nhập JWT admin trước khi thử).
