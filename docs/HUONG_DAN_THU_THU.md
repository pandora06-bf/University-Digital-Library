# Hướng dẫn nhanh Thủ thư — LibManager

| | |
|---|---|
| **Sprint / task** | Sprint 3 Admin (FE) — cập nhật **14/11/2026** (`main` @ `9ea0da9` + polish tìm nhanh local) |
| **Người biên soạn** | Vân (FE Admin) |
| **Ứng dụng** | Cổng Quản trị LibManager |
| **URL (Docker)** | http://localhost:5174 |
| **API** | http://localhost:8010 |
| **Đăng nhập demo** | `admin` / `Admin@123` — vào thẳng **Danh mục sách** |
| **File nguồn** | `docs/HUONG_DAN_THU_THU.md` |

Tài liệu ngắn cho ca trực trên cổng Admin. Sidebar đủ các mục quản trị (không có trang Tổng quan riêng).

**Tìm nhanh:** trên hầu hết trang list, **bấm thẻ thống kê** (Tổng / trạng thái / khóa / nợ…) để lọc bảng — không cần mở dropdown filter.

**Máy quét barcode:** ô quét tự focus. Tít mã hoặc gõ rồi **Enter**. Toast hiện giữa phía trên.

**Barcode** là mã từng bản in (`DEMO-BC-099-01`), xem ở **Tồn kho** sau khi chọn đầu sách. File ebook không có barcode.

**Banner vàng «Đang dùng dữ liệu mẫu»:** Phòng (CRUD); hoặc API tạm lỗi (Danh mục, Tồn kho, eBook, Check-in list).

Chi tiết seeder đầy đủ: `docs/demo_script.md`.

---

## Tài khoản / mã test theo trang

Đăng nhập cổng Admin chỉ dùng tài khoản thủ thư. Quầy Loans / Fines / Incidents / Users dùng **mã bạn đọc** (`SV-DEMO-…` / `GV-DEMO-…`) trên DB — không dùng username `demo_student_…` trong ô quầy.

| Vai trò | Username (login cổng) | Mã bạn đọc (quầy) | Mật khẩu | Ghi chú seed |
|---------|----------------------|-------------------|----------|--------------|
| Thủ thư / Admin | `admin` | — | `Admin@123` | Vào `/admin/catalog` |
| SV thường | `demo_student_001` | `SV-DEMO-001` | `User@123` | Đang mượn; ví ~280k |
| SV nợ phạt (khóa) | `demo_student_003` | `SV-DEMO-003` | `User@123` | Fine 55.000₫ chưa thu |
| SV báo mất (khóa) | `demo_student_005` | `SV-DEMO-005` | `User@123` | Incident BOOK_LOST |
| SV chờ nhận | `demo_student_007` | `SV-DEMO-007` | `User@123` | Phiếu `REQUESTED` |
| SV hàng đợi | `demo_student_009` | `SV-DEMO-009` | `User@123` | `WAITING` + TX đã gán |
| SV lịch sử phạt | `demo_student_011` | `SV-DEMO-011` | `User@123` | Fine 50k đã trả bằng ví |
| GV eBook | `demo_lecturer_002` | `GV-DEMO-002` | `User@123` | Phiếu mượn eBook |
| GV giữ chỗ | `demo_lecturer_004` | `GV-DEMO-004` | `User@123` | Hàng đợi `HELD` + booking hủy |

### Gợi ý theo màn hình Admin

| Trang | Tài khoản / mã thử | Việc nên làm |
|-------|-------------------|--------------|
| Login → `/admin/*` | `admin` / `Admin@123` | Vào cổng quản trị |
| `/admin/loans` check-out | `SV-DEMO-007` (phiếu chờ) hoặc `SV-DEMO-001` + mã **Sẵn sàng** lấy ở Tồn kho | Tra MSSV → quét → xuất. `SV-DEMO-003` bị chặn vì nợ |
| `/admin/loans` check-in | Tài khoản **đang mượn thật** trên seed: `SV-DEMO-001` + mã vạch phiếu active (thường `DEMO-BC-001-01`); quá hạn: `SV-DEMO-003` / `DEMO-BC-002-01` | Quét mã đang mượn → Nguyên vẹn → xác nhận. Xem mục §2 bên dưới |
| `/admin/fines` | `SV-DEMO-003` | Tra → thấy nợ 55.000₫ → Thu đủ một lần. Không tra bằng `demo_student_003` |
| `/admin/incidents` | `SV-DEMO-005` (xem seed LOST); lập mới cần phiếu **BORROWED** khác | Tra mã bạn đọc hoặc `loan_id` → lập mất/hỏng |
| `/admin/users` | Tìm `SV-DEMO-003`, `SV-DEMO-001`… | List / khóa–mở / reset (reset theo **Account.id**, không phải MSSV) / import |
| `/admin/catalog` · `ebooks` · `inventory` | Chỉ cần `admin` | CRUD đầu sách, PDF, bản sao / barcode `DEMO-BC-*` |
| `/admin/rooms` | `admin` | CRUD phòng thật (`/api/admin/rooms`) |
| `/admin/rooms/checkin` | Booking seed `CONFIRMED` trong ngày (xem list theo ngày) | Check-in trong **15 phút đầu** slot; mã lượt / `booking_id` từ bảng |
| `/admin/unmatched` | List chưa gán từ API; gán bằng `SV-DEMO-…` | Cộng ví thật sau gán |

Barcode mẫu dạng `DEMO-BC-xxx-01`. Giao dịch phòng seed: `DEMO-RB-*`.

---

## Trạng thái nhanh theo màn hình

| Màn hình | Đường dẫn | Máy chủ |
|----------|-----------|---------|
| Danh mục sách | `/admin/catalog` | **Đã nối** (CRUD + thể loại + bìa/PDF) |
| eBook / PDF | `/admin/ebooks` | **Đã nối** list + upload + preview (`ebook_router`). Chỉ hiện «Sẵn sàng» khi `has_pdf` |
| Tồn kho | `/admin/inventory` | **Đã nối** (bản sao / thanh lý) |
| Mượn / Trả | `/admin/loans` | **Đã nối** tra cứu / xuất mượn / nhận trả. Mất–hỏng tại quầy dùng chung luồng Incident (BE 13-11) |
| Thu phạt | `/admin/fines` | **Đã nối** tra một mã bạn đọc + thu đủ nợ. Không có danh sách mọi phiếu. BE gửi email biên lai sau thu |
| Báo mất / Hỏng | `/admin/incidents` | **Đã nối** `GET /api/admin/incidents` + tạo `POST /api/admin/loans/incident` |
| Người dùng | `/admin/users` | **Đã nối** list/tạo/sửa/khóa/reset/import (`/api/admin/users`) |
| Phòng học nhóm | `/admin/rooms` | **Đã nối** `GET/POST/PUT /api/admin/rooms` (2B-21) |
| Check-in phòng | `/admin/rooms/checkin` | **Đã nối** `GET …/room-bookings?booking_date=` + `POST …/checkin` |
| GD chưa khớp | `/admin/unmatched` | **Đã nối** `GET/POST /api/admin/wallet/unmatched…` |

---

## 1. Check-out (xuất mượn) — `/admin/loans`

1. Cột **Quầy Xuất Phiếu Mượn**: nhập **mã bạn đọc** → **Tra cứu** / **Enter**.
2. Xem phiếu chờ nhận nếu có. Không có phiếu chờ vẫn xuất mượn trực tiếp tại quầy.
3. Ghi chú tình trạng sách khi giao nếu cần.
4. Quét mã vạch bản **Sẵn sàng** (ô tự xóa sau mỗi lần) → thêm vào phiếu. Lấy mã ở **Tồn kho** (trạng thái Sẵn sàng).
5. **Xác nhận xuất phiếu mượn**.

### Tài khoản / mã thử (seed — không hiện trên UI)

| Thử | Mã bạn đọc | Mã vạch | Kỳ vọng |
|-----|------------|---------|---------|
| Có phiếu chờ | `SV-DEMO-007` | Bản **Sẵn sàng** khớp đầu sách phiếu (Tồn kho) | Tra cứu thấy phiếu chờ → xuất |
| Xuất trực tiếp | `SV-DEMO-001` | Bản **Sẵn sàng** bất kỳ (VD `DEMO-BC-004-01` nếu còn) | Xuất OK nếu chưa vượt hạn mức |
| Bị chặn nợ | `SV-DEMO-003` | — | Toast khóa / còn nợ — không xuất |

Mã không có trong kho → toast không tìm thấy bản sao. Sách đang giữ chỗ cho người khác → máy chủ từ chối.

---

## 2. Check-in (nhận trả) — `/admin/loans`

1. Cột **Quầy Nhận Trả Sách**: quét **mã vạch trên sách** đang mượn / quá hạn → **Enter** (ô giữ mã để xác nhận).
2. Chọn **Nguyên vẹn** hoặc **Hư hỏng / Mất sách**.
3. **Xác nhận trả sách** một lần.

**Lưu ý:** `SV-DEMO-001` là **mã bạn đọc (MSSV)**, không phải mã vạch. API trả sách tìm theo `copy_barcode` (VD `DEMO-BC-001-01`). Nếu gõ nhầm MSSV, FE sẽ tra phiếu đang mượn và đổi sang mã vạch (nếu có).

### Tài khoản đang mượn thật trên seed (sau `database_seeder`)

| Bạn đọc | Tình trạng (sau seed) | Mã vạch | Ghi chú |
|---------|----------------------|---------|---------|
| `SV-DEMO-001` | Đang mượn → có thể **đã trả** nếu demo trước đó | `DEMO-BC-001-01` | Nếu toast «không tìm thấy phiếu…» → phiếu đã `RETURNED`. Xuất lại ở quầy phải rồi trả, hoặc dùng mã khác bên dưới |
| `SV-DEMO-003` | **Quá hạn** | `DEMO-BC-002-01` | Còn nợ 55.000₫; trả có thể lỗi nếu phạt trùng |
| `SV-DEMO-011` | **Đang mượn** (fill waitlist) | `DEMO-BC-006-01` | Thường còn BORROWED sau khi `001-01` đã trả |

Cách lấy mã chắc chắn: **Tồn kho** → lọc **Đang cho mượn**, hoặc tra MSSV ở quầy xuất rồi xem `copy_barcode` phiếu `BORROWED`/`OVERDUE`.

| Thử | Cách làm | Kỳ vọng |
|-----|----------|---------|
| Trả thường | Quét mã **còn đang mượn** (`DEMO-BC-006-01` hoặc `DEMO-BC-001-01` sau khi xuất lại) | Trả thành công |
| Quá hạn | Quét `DEMO-BC-002-01` | Có thể lỗi nếu đã có phạt trùng |
| Trả lần 2 | Cùng mã sau khi đã trả | Toast: không còn phiếu đang mượn / quá hạn — **đúng nghiệp vụ**, không phải lỗi seed |

Lần trả đầu đôi khi hiện **Hệ thống gặp sự cố** dù sách đã được ghi nhận trả. Tra lại ở Tồn kho: nếu bản sao đã **Sẵn sàng** thì không trả thêm lần nữa.

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

1. Chọn **ngày** (mặc định hôm nay) — bảng từ `GET /api/admin/room-bookings?booking_date=…`.
2. Nhập **mã lượt** hoặc bấm **Check-in** trên dòng `CONFIRMED` → `POST …/checkin` `{ booking_id }`.
3. BE chỉ cho check-in trong **15 phút đầu** khung giờ; sai id / ngoài cửa sổ → toast lỗi.
4. API list lỗi thì bảng fallback mẫu (banner vàng); form check-in vẫn gọi API thật.

---

## 7. Người dùng và giao dịch chưa khớp

### `/admin/users`

Thêm, sửa, khóa/mở, đặt lại mật khẩu, import CSV/XLSX — gọi `/api/admin/users` (list/CRUD/lock/import/reset).

### `/admin/unmatched`

1. Bảng từ `GET /api/admin/wallet/unmatched` (chỉ giao dịch **chưa gán**).
2. **Gán người dùng** → nhập/chọn MSSV (`SV-DEMO-001`…) + ghi chú → `POST …/unmatched/{id}/assign`.
3. Thành công: cộng số dư ví thật; dòng biến mất khỏi list.
4. API lỗi → toast cảnh báo + fallback mẫu local (không cộng ví).

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
| Người dùng | `/admin/users` |
| Phòng (mẫu) / check-in (API) | `/admin/rooms`, `/admin/rooms/checkin` |
| Giao dịch chưa khớp (API) | `/admin/unmatched` |

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
- `GET/POST/PUT /api/admin/users`, `PATCH …/lock`, import + reset
- `GET /api/admin/room-bookings?booking_date=`, `POST /api/admin/room-bookings/checkin`
- `GET /api/admin/wallet/unmatched`, `POST /api/admin/wallet/unmatched/{id}/assign`

Swagger: http://localhost:8010/docs (đăng nhập admin lấy JWT trước khi thử).
