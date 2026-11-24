# Hướng dẫn nhanh Thủ thư — LibManager

| | |
|---|---|
| **Cập nhật** | 24/11/2026 (tối) — seed live + chỉnh quầy/tồn kho/eBook/phạt sau polish Admin |
| **Người biên soạn** | Vân (FE Admin) |
| **Ứng dụng** | Cổng Quản trị LibManager |
| **FE local** | http://127.0.0.1:5173 |
| **FE Docker** | http://127.0.0.1:5174 |
| **API** | http://127.0.0.1:8010 · Swagger `/docs` |
| **Đăng nhập** | `admin` / `Admin@123` |
| **File nguồn** | `docs/HUONG_DAN_THU_THU.md` |

Tài liệu ca trực trên cổng Admin. Sidebar đủ mục quản trị (không có trang Tổng quan riêng).

**Quy ước chung**

- Ô quầy (mượn / trả / phạt / người dùng) nhận **mã bạn đọc** (`SV-DEMO-…` / `GV-DEMO-…`), không nhận username `demo_student_…`.
- Sinh viên demo số **lẻ** (`001`, `003`…). Giảng viên demo số **chẵn** (`002`, `004`…). Không có `SV-DEMO-002`.
- **Barcode** là mã từng bản in (`DEMO-BC-005-01`). File eBook không có barcode.
- Thẻ thống kê trên nhiều trang **bấm được** để lọc bảng.
- Máy quét: ô quét tự focus → quét hoặc gõ rồi **Enter**. Toast giữa phía trên.
- Demo an toàn: mở modal / tra cứu rồi **Hủy**. **Xác nhận trả / thu phạt / gán ví / check-in / lập mất** sẽ đổi seed.

Script thuyết trình chi tiết: `docs/SCRIPT_THUYET_TRINH_ADMIN_FE.md`.

---

## 1. Tài khoản demo

| Vai trò | Login cổng bạn đọc | Mã quầy | Mật khẩu | Trạng thái live |
|---------|-------------------|---------|----------|-----------------|
| Admin / Thủ thư | `admin` | — | `Admin@123` | Vào `/admin/catalog` |
| SV khóa + nợ | `demo_student_001` | `SV-DEMO-001` Quý cô Phương Vũ | `User@123` | Nợ **89.000 ₫**, khóa mượn |
| SV khóa + nợ mất sách | `demo_student_003` | `SV-DEMO-003` Bà Ngọc Lê | `User@123` | Nợ **250.000 ₫**, khóa; bản `DEMO-BC-002-01` **LOST** |
| SV khóa + mất sách | `demo_student_005` | `SV-DEMO-005` Bác Nhiên Bùi | `User@123` | Nợ **280.000 ₫**, khóa; `DEMO-BC-003-01` **LOST** |
| SV sạch | `demo_student_007` | `SV-DEMO-007` Kim Bùi | `User@123` | Không nợ, không khóa; phạt 35.000 ₫ **đã thu** |
| SV quá hạn + nợ | `demo_student_009` | `SV-DEMO-009` Anh Tùng Mai | `User@123` | Nợ **45.000 ₫**; đang mượn quá hạn `DEMO-BC-005-02` |
| SV sạch + đã thu | `demo_student_011` | `SV-DEMO-011` Cô Kim Dương | `User@123` | Nợ 0; phạt 50.000 ₫ **đã thu**; phiếu chờ nhận *Refactoring* |
| SV chờ nhận | `demo_student_013` | `SV-DEMO-013` Bảo Vũ | `User@123` | `PENDING_PICKUP` |
| GV | `demo_lecturer_002` | `GV-DEMO-002` Anh Tú Hoàng | `User@123` | Không nợ |

### Gợi ý theo trang

| Trang | Mã / ID thử | Việc nên làm |
|-------|-------------|--------------|
| Login | `admin` / `Admin@123` | Vào cổng quản trị |
| Danh mục | `admin` | 201 đầu sách; lọc Vật lý / eBook / Cả hai; cột bản sao = sẵn sàng / tổng bản in |
| eBook | `admin` | 131 cuốn (eBook + Cả hai); thẻ Đã có PDF / Chưa có PDF |
| Tồn kho | ID `206`, `207`, `210`, `212`, `304` | `206` Clean Code sẵn sàng; `207` Báo mất; `210` Algorithms; `212` Đã thanh lý; `304` Hư hỏng |
| Xuất mượn | `SV-DEMO-007` hoặc `SV-DEMO-011` | Không nợ. Quét `DEMO-BC-005-01` hoặc `DEMO-BC-005-03` (sẵn sàng). **Không** nhập mã phiếu vào ô mã vạch |
| Xuất bị chặn | `SV-DEMO-001` / `003` / `005` / `009` | Tra được hồ sơ, không xuất vì nợ / khóa |
| Nhận trả | `SV-DEMO-009` hoặc `DEMO-BC-005-02` | Đang quá hạn *Introduction to Algorithms* |
| Thu phạt chưa thu | `SV-DEMO-003` **250.000** · `005` **280.000** · `009` **45.000** · `001` **89.000** | Tra MSSV → lọc Chưa thu / loại **Mất·hỏng** hoặc **Trễ hạn** → mở Thu tiền rồi **Hủy** |
| Thu phạt đã thu | `SV-DEMO-011` · `SV-DEMO-007` | Lọc **Đã hoàn tất** → Chi tiết |
| Báo mất | Xem `SV-DEMO-005`, `003` | Lập mới: phiếu **#15** · `SV-DEMO-009` · mã `DEMO-BC-005-02` rồi **Hủy**. Có giá bìa → bồi thường theo giá (không chỉnh tay) |
| Người dùng | Các mã trên | Khóa+nợ: 001/003/005/009. Sạch: 007/011/`GV-DEMO-002` |
| Phòng | `admin` | CRUD phòng; ngừng phòng còn lịch → toast nghiệp vụ |
| Check-in phòng | Ngày đặt trên seed | Chỉ trong **15 phút đầu** slot; ngoài cửa sổ → từ chối |
| Chưa khớp | `FT26_UNMATCHED_002`…`007` | Chưa khớp: mở Gán rồi **Hủy**. Đã khớp: `FT26_UNMATCHED_001` → `SV-DEMO-003` |

---

## 2. Trạng thái nối máy chủ

| Màn hình | Đường dẫn | Ghi chú |
|----------|-----------|---------|
| Danh mục sách | `/admin/catalog` | CRUD đầu sách, thể loại, bìa/PDF; soft-delete `is_active`; cấu hình eBook có thể lưu không cần upload lại PDF |
| eBook / PDF | `/admin/ebooks` | List + upload + xem trước; **Lưu cấu hình** (trang xem trước / ngày mượn / miễn phí) không bắt buộc file mới |
| Tồn kho | `/admin/inventory` · `/admin/books/:id` | Bản sao, vị trí kệ; **Thanh lý** ≠ **Xóa cứng**; mất/hỏng khi đang mượn → quầy Sự cố / Trả |
| Mượn / Trả | `/admin/loans` | Lookup + checkout + check-in; không có bảng list phiếu |
| Thu phạt | `/admin/fines` | Tra từng MSSV; thu đủ một lần; lọc loại Trễ hạn / Mất·hỏng / Phạt khác |
| Báo mất / Hỏng | `/admin/incidents` | List + lập biên bản; bồi thường theo giá bìa nếu sách có giá |
| Người dùng | `/admin/users` | List / tạo (MSSV 3–50, username tuỳ chọn) / khóa / reset / import |
| Phòng học nhóm | `/admin/rooms` | CRUD phòng; nút **Check-in mã đặt** sang màn check-in |
| Check-in phòng | `/admin/rooms/checkin` | Vào từ Phòng (hoặc search header); theo ngày; cửa sổ 15 phút |
| GD chưa khớp | `/admin/unmatched` | Lọc Chưa khớp / Đã khớp / Tất cả |

---

## 3. Quầy xuất mượn — `/admin/loans` (phải)

1. Nhập **MSSV** → **Tra cứu** / Enter.  
2. Xem phiếu chờ (`REQUESTED` / `PENDING_PICKUP`) nếu có. Không có phiếu chờ vẫn xuất trực tiếp.  
3. Quét **mã vạch bản Sẵn sàng** (không nhập mã phiếu).  
4. Ghi chú tình trạng khi giao (tuỳ chọn) → **Xác nhận xuất phiếu mượn**.

| Thử | Mã | Kỳ vọng |
|-----|-----|---------|
| Sạch, xuất được | `SV-DEMO-007` + `DEMO-BC-005-01` hoặc `005-03` | Thêm vào phiếu → xuất OK |
| Có phiếu chờ nhận | `SV-DEMO-011` | Thấy *Refactoring* chờ nhận |
| Bị chặn | `SV-DEMO-003` | Toast nợ / khóa — không xuất |
| Nhầm mã phiếu | Gõ `5` vào ô mã vạch | Báo đây là mã phiếu; gợi ý bản sẵn sàng |

Bạn đọc nợ hoặc `is_borrowing_blocked` → không xuất. Bản không `AVAILABLE` → từ chối.

---

## 4. Quầy nhận trả — `/admin/loans` (trái)

1. Quét **mã vạch sách đang mượn / quá hạn**, hoặc nhập MSSV nếu FE tra được phiếu active → Enter.  
2. Chọn **Nguyên vẹn** hoặc **Hư hỏng / Mất sách**.  
3. **Xác nhận trả sách** một lần.

| Thử | Mã | Kỳ vọng |
|-----|-----|---------|
| Quá hạn | `SV-DEMO-009` / `DEMO-BC-005-02` | Thẻ trả; xác nhận sẽ chốt phạt quá hạn |
| Đã trả / không mượn | `DEMO-BC-001-01` (đang AVAILABLE) | Không còn phiếu đang mượn |
| Báo mất seed | `DEMO-BC-002-01` | Bản **LOST**, không trả thường |

Trả lần 2 cùng mã → toast không còn phiếu — đúng nghiệp vụ. Mất/hỏng nặng: lập biên bản ở **Báo mất / Hỏng**, thu tiền ở **Thu phạt**.

---

## 5. Thu phạt — `/admin/fines`

1. Nhập đúng **MSSV** → **Tra cứu**. Bảng trống đến khi tra.  
2. Lọc **Chưa thu** / **Đã hoàn tất**.  
3. Lọc loại vi phạm (nếu cần): **Trễ hạn trả sách** · **Mất / hỏng sách** · **Phạt khác** (BE gắn loại theo biên bản sự cố, không đoán tay trên UI).  
4. **Thu tiền** → xác nhận tiền mặt **đủ toàn bộ** nợ một lần (không thu một phần).

| MSSV | Live |
|------|------|
| `SV-DEMO-003` | Chưa thu **250.000 ₫** |
| `SV-DEMO-005` | Chưa thu **280.000 ₫** |
| `SV-DEMO-009` | Chưa thu **45.000 ₫** |
| `SV-DEMO-001` | Chưa thu **89.000 ₫** |
| `SV-DEMO-011` | Đã hoàn tất **50.000 ₫** |
| `SV-DEMO-007` | Đã hoàn tất **35.000 ₫** |
| `SV-DEMO-002` | Không tồn tại |

Sau thu: `total_fines = 0`, mở khóa mượn (trừ khi còn sách quá hạn chưa trả — toast cảnh báo).

---

## 6. Báo mất / hỏng — `/admin/incidents`

1. Bảng list + lọc **Tất cả / Mất sách / Hỏng nặng**. Trạng thái ghi nhận luôn **Đã ghi nhận** (không workflow PENDING).  
2. **Lập biên bản** → tra **MSSV / mã phiếu / barcode** phiếu đang `BORROWED`/`OVERDUE` rồi Enter hoặc **Tra cứu**.  
3. Chọn mất hoặc hỏng → mô tả → Lưu.  
   - Sách **có giá bìa**: khoản bồi thường theo giá (± quá hạn) — form **không** cho sửa tay số tiền.  
   - Sách **thiếu giá**: bắt buộc nhập số bồi thường thủ công.  
4. Hệ thống cộng phạt, khóa mượn; mất → copy `LOST`, hỏng → copy `RETIRED`.  
5. Thu tiền sang `/admin/fines?mssv=…`.  

Không dùng form **sửa tồn kho** để “báo mất” thay cho bước này.

**Xem biên bản seed (đã ghi nhận):** `SV-DEMO-005` (mất `DEMO-BC-003-01`), `SV-DEMO-003` (mất `DEMO-BC-002-01`) — không lập lại trên các phiếu này.

**Lập biên bản mới** chỉ được trên phiếu đang `BORROWED` / `OVERDUE` và còn mã vạch:

| Phiếu | Bạn đọc | Mã sách (barcode) | Đầu sách | Trạng thái |
|-------|---------|-------------------|----------|------------|
| **#15** | `SV-DEMO-009` Anh Tùng Mai | **`DEMO-BC-005-02`** | `[DEMO-005] Introduction to Algorithms` (id `210`) | OVERDUE |

Cách làm: **Lập biên bản** → nhập `SV-DEMO-009` hoặc `15` hoặc `DEMO-BC-005-02` (nếu form hỗ trợ) → chọn Mất / Hỏng → mở form rồi **Hủy** (giữ seed). Lưu thật sẽ khóa bạn đọc và cộng phạt.

---

## 7. Danh mục · Tồn kho · eBook

### `/admin/catalog`

- Tìm (ô search rộng trên desktop) + debounce ~0,35s + phân trang server 10.  
- Lọc thể loại / NXB / định dạng (Vật lý, eBook, Cả hai — khớp đúng loại).  
- Cột **Số bản sao (sẵn sàng)** = bản `AVAILABLE` / tổng bản in.  
- Thêm / sửa / **Vô hiệu hóa đầu sách** (`is_active=false`, không xóa cứng; bản sao barcode vẫn còn trong kho).  
- Sửa đầu sách đã có PDF: đổi trang xem trước / ngày mượn / miễn phí rồi **Lưu** — không bắt buộc chọn PDF mới.  
- Thẻ **Thể loại** → CRUD thể loại.

### `/admin/inventory`

- Ô trên: **mã đầu sách hoặc tên** (một kết quả mở ngay; nhiều kết quả → gợi ý). Sau khi mở đầu sách, lọc barcode trong bảng.  
- Trạng thái filter (Tiếng Việt): Sẵn sàng · Đang cho mượn · Cần xử lý · Đã thanh lý · Hư hỏng · Báo mất.  
- Cột **Trạng thái** = lưu thông (`AVAILABLE` / `BORROWED` / `LOST`…). Cột **Tình trạng** = vật lý (Nguyên vẹn / Hư hỏng / Báo mất / Đã thanh lý) — theo status, không bị ghi chú `[Thanh lý]…` đè thành “Hư hỏng”.  
- **Thanh lý** (icon Archive): ngừng lưu thông, giữ barcode; không thanh lý bản đang mượn; sau thanh lý / mất / hỏng **không** đưa lại Sẵn sàng.  
- **Xóa cứng** (icon thùng rác): chỉ bản **Sẵn sàng** chưa từng có lịch sử mượn; khác Thanh lý.  
- Thêm bản sao mới luôn **Sẵn sàng**. Sửa bản sẵn sàng: chỉ Sẵn sàng hoặc Thanh lý kho — **không** chọn tay Báo mất / Hư hỏng (làm ở Sự cố / Trả sách).

| ID | Đầu sách | Mã mẫu | Trạng thái |
|----|----------|--------|------------|
| `206` | Clean Code | `DEMO-BC-001-01` | AVAILABLE |
| `207` | The Pragmatic Programmer | `DEMO-BC-002-01` | LOST |
| `210` | Introduction to Algorithms | `DEMO-BC-005-01` / `005-03` AVAILABLE; `005-02` BORROWED | |
| `212` | Computer Networks | `DEMO-BC-007-01` | RETIRED |
| `304` | English Vocabulary… | `DEMO-BC-099-01` | DAMAGED |

### `/admin/ebooks`

- List eBook + Cả hai; badge loại cạnh tên.  
- Thẻ: Tất cả / Đã có PDF / Chưa có PDF.  
- Tải / thay PDF; xem trước khi đã có file.  
- Modal cập nhật: chọn PDF mới **hoặc** chỉ sửa trang xem trước (5–10) / ngày mượn / miễn phí → **Lưu cấu hình**.

---

## 8. Phòng học nhóm

### `/admin/rooms`

Xem / thêm / sửa / ngừng phòng. Ngừng phòng còn lịch tương lai → toast nghiệp vụ.  
Nút **Check-in mã đặt** → `/admin/rooms/checkin` (không có mục riêng trên sidebar).

### `/admin/rooms/checkin`

1. Chọn **ngày** → list booking ngày đó.  
2. Check-in dòng `CONFIRMED` trong **15 phút đầu** khung giờ.  
3. Ngoài cửa sổ / sai id → từ chối.

Seed ngày **24/11/2026** (đã qua cửa sổ buổi tối): đã vào `SV-DEMO-003`, `SV-DEMO-011`, `GV-DEMO-010`; còn `CONFIRMED` các slot 14:54 / 16:00 / 18:00 / 20:00. Demo ngày mới: chọn đúng ngày còn slot trong 15 phút đầu.

---

## 9. Người dùng · Giao dịch chưa khớp

### `/admin/users`

Thêm / sửa / khóa–mở (có lý do khóa) / reset mật khẩu / import CSV·XLSX.  
- MSSV / mã: **3–50** ký tự.  
- **Username** đăng nhập (tuỳ chọn) khi tạo; để trống → hệ thống tạo `sv{mã}`.  
- Reset mật khẩu theo **Account**, không theo MSSV. Mật khẩu tạm chỉ hiện **một lần**.

### `/admin/unmatched`

1. Thẻ / lọc: **Chưa khớp** · **Đã khớp** · Tất cả.  
2. **Gán** chọn MSSV → cộng ví thật; chỉ gán khi chưa có `assigned_user_code`.  
3. Demo: mở Gán trên `FT26_UNMATCHED_002` rồi **Hủy**.  
4. `FT26_UNMATCHED_001` đã gán `SV-DEMO-003`. `FT26_UNMATCHED_003` vẫn ở chưa khớp vì chưa có mã người nhận.

---

## 10. Sơ đồ ca trực

| Việc | Đường dẫn |
|------|-----------|
| Danh mục / thể loại | `/admin/catalog` |
| eBook / PDF | `/admin/ebooks` |
| Tồn kho / barcode | `/admin/inventory` |
| Mượn–trả | `/admin/loans` |
| Thu phạt | `/admin/fines` |
| Mất–hỏng | `/admin/incidents` |
| Người dùng | `/admin/users` |
| Phòng / check-in | `/admin/rooms`, `/admin/rooms/checkin` |
| Giao dịch chưa khớp | `/admin/unmatched` |

---

## 11. API quầy đã gắn

- `GET /api/admin/loans/lookup` — MSSV hoặc id phiếu (+ `reader`)
- `GET /api/admin/loans/copy?barcode=` — tra bản trước xuất
- `GET /api/admin/loans/active-return?barcode=` — thẻ đang mượn
- `POST /api/admin/loans/checkout` · `POST /api/admin/loans/checkin`
- `GET /api/admin/fines/lookup?include_paid=` (kèm `fine_type` / `has_incident`) · `POST /api/admin/fines/collect`
- `GET /api/admin/incidents` · `POST /api/admin/loans/incident` (`loan_id` số)
- `GET /api/books/search` — `exact_format`, `exact_publisher`, `total_copies`, `available_copies`
- Sách / thể loại / tồn kho · `PATCH /api/admin/books/{id}/ebook-config` · eBook preview
- `GET|POST|PUT /api/admin/users`, lock, import, reset
- `GET /api/admin/room-bookings?booking_date=` · `POST …/checkin`
- `GET /api/admin/wallet/unmatched?status=unresolved|assigned|all` · `POST …/assign`

Swagger: http://127.0.0.1:8010/docs (đăng nhập admin lấy JWT trước khi thử).
