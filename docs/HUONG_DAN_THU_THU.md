# Hướng dẫn nhanh Thủ thư — LibManager

| | |
|---|---|
| **Cập nhật** | 28/11/2026 — số liệu theo database chính (Supabase), thay tài khoản mẫu kiểu cũ bằng MSSV |
| **Người biên soạn** | Vân (FE Admin); Đạt cập nhật dữ liệu mẫu |
| **Ứng dụng** | Cổng Quản trị LibManager |
| **Web (cloud)** | https://libmanager-ecru.vercel.app |
| **API (cloud)** | https://libmanager-api-zvuf.onrender.com · Swagger `/docs` |
| **Docker local** | FE http://127.0.0.1:5174 · API http://127.0.0.1:8010 (dùng chung database chính) |
| **Đăng nhập** | `admin` / mật khẩu do nhóm quản lý (không ghi trong tài liệu) |
| **File nguồn** | `docs/HUONG_DAN_THU_THU.md` |

Tài liệu ca trực trên cổng Admin. Sidebar đủ mục quản trị (không có trang Tổng quan riêng).

**Quy ước chung**

- Ô quầy (mượn / trả / phạt / người dùng) nhận **mã bạn đọc**: sinh viên là MSSV (`52400011`), giảng viên là `GV0004`.
- Sinh viên mẫu mang mã **lẻ** (`52400001`, `52400003`…), giảng viên mẫu mang mã **chẵn** (`GV0002`, `GV0004`…). Không có `52400002`.
- **Barcode** là mã từng bản in, dạng `BC-<mã sách>-<số bản>` (`BC-005-02`). File eBook không có barcode.
- Thẻ thống kê trên nhiều trang **bấm được** để lọc bảng.
- Máy quét: ô quét tự focus → quét hoặc gõ rồi **Enter**. Toast giữa phía trên.
- ⚠️ Web cloud và Docker local **dùng chung database thật**. Thử an toàn: mở modal / tra cứu rồi **Hủy**. **Xác nhận trả / thu phạt / gán ví / check-in / lập mất** sẽ đổi dữ liệu thật.
- Phạt quá hạn tăng **5.000 ₫/ngày** (JOB-01 lúc 00:00), nên số tiền ở các bảng dưới là tại ngày **28/11/2026**.

Script thuyết trình chi tiết: `docs/SCRIPT_THUYET_TRINH_ADMIN_FE.md`.

---

## 1. Tài khoản mẫu

Mật khẩu chung của bạn đọc mẫu: `User@123`. Tên đăng nhập của sinh viên là MSSV; của giảng viên là mã viết thường (`gv0004`).

| Vai trò | Đăng nhập | Mã quầy · Họ tên | Trạng thái (28/11/2026) |
|---------|-----------|------------------|--------------------------|
| Admin / Thủ thư | `admin` | — | Vào `/admin/catalog` |
| SV sạch, đang mượn | `52400001` | `52400001` Quý cô Phương Vũ | Không nợ; đang mượn *Clean Code* (`BC-001-01`); ví 280.000 ₫ |
| SV quá hạn + nợ | `52400003` | `52400003` Bà Ngọc Lê | Nợ **65.000 ₫**, khóa; quá hạn *The Pragmatic Programmer* (`BC-002-01`) |
| SV mất sách | `52400005` | `52400005` Bác Nhiên Bùi | Nợ **280.000 ₫**, khóa; bản `BC-003-01` **LOST** (đã lập biên bản) |
| SV quá hạn + nợ | `52400007` | `52400007` Kim Bùi | Nợ **45.000 ₫**, khóa; quá hạn *Refactoring* (`BC-004-01`) |
| SV quá hạn + nợ + hàng chờ | `52400009` | `52400009` Anh Tùng Mai | Nợ **55.000 ₫**, khóa; quá hạn *Introduction to Algorithms* (`BC-005-01`); đứng đầu hàng chờ sách #6 |
| SV sạch, có phiếu chờ | `52400011` | `52400011` Cô Kim Dương | Nợ 0; phạt 50.000 ₫ **đã thu**; phiếu `REQUESTED` *Introduction to Algorithms*; đang mượn *Artificial Intelligence* |
| SV sạch, chưa mượn | `52400013` | `52400013` Bảo Vũ | Không nợ, không phiếu |
| GV đọc eBook | `gv0002` | `GV0002` Anh Tú Hoàng | Không nợ; đang mượn eBook *Clean Code* |
| GV | `gv0004` | `GV0004` Dương Nguyễn | Không nợ; ví 30.000 ₫ (đã hoàn tiền phòng) |

### Gợi ý theo trang

| Trang | Mã / ID thử | Việc nên làm |
|-------|-------------|--------------|
| Login | `admin` | Vào cổng quản trị |
| Danh mục | `admin` | **100** đầu sách; lọc Vật lý / eBook / Cả hai; cột bản sao = sẵn sàng / tổng bản in |
| eBook | `admin` | **61** cuốn (eBook + Cả hai), tất cả **đã có PDF** (lưu trên Cloudflare R2) |
| Tồn kho | ID `1`, `2`, `3`, `5`, `6` | `1` Clean Code; `2` Pragmatic (1 bản quá hạn); `3` Design Patterns có bản **Báo mất**; `5` Algorithms; `6` AI **hết bản** (có hàng chờ) |
| Xuất mượn | `52400001`, `52400013` hoặc `GV0004` | Không nợ. Quét `BC-005-02` hoặc `BC-005-03` (sẵn sàng). **Không** nhập mã phiếu vào ô mã vạch |
| Xuất bị chặn | `52400003` / `005` / `007` / `009` | Tra được hồ sơ, không xuất vì nợ / khóa |
| Nhận trả | `52400009` hoặc `BC-005-01` | Đang quá hạn *Introduction to Algorithms* |
| Thu phạt chưa thu | `52400003` **65.000** · `005` **280.000** · `007` **45.000** · `009` **55.000** | Tra mã bạn đọc → lọc Chưa thu / loại **Mất·hỏng** hoặc **Trễ hạn** → mở Thu tiền rồi **Hủy** |
| Thu phạt đã thu | `52400011` | Lọc **Đã hoàn tất** → Chi tiết (50.000 ₫, trả bằng ví) |
| Báo mất | Xem `52400005` | Lập mới: phiếu **#5** · `52400009` · mã `BC-005-01` rồi **Hủy**. Có giá bìa → bồi thường theo giá (không chỉnh tay) |
| Người dùng | Các mã trên | Khóa+nợ: 52400003/005/007/009. Sạch: 52400001/011/013, `GV0002`, `GV0004` |
| Phòng | `admin` | 4 phòng; CRUD phòng; ngừng phòng còn lịch → toast nghiệp vụ |
| Check-in phòng | Lượt đặt mới hôm nay | Chỉ trong **15 phút đầu** slot; ngoài cửa sổ → từ chối |
| Chưa khớp | `FT26_UNMATCHED_001`, `002` | Chưa khớp: mở Gán rồi **Hủy**. Đã khớp: `FT26_UNMATCHED_003` → `52400011` |

---

## 2. Trạng thái nối máy chủ

| Màn hình | Đường dẫn | Ghi chú |
|----------|-----------|---------|
| Danh mục sách | `/admin/catalog` | CRUD đầu sách, thể loại, bìa/PDF; soft-delete `is_active`; cấu hình eBook có thể lưu không cần upload lại PDF |
| eBook / PDF | `/admin/ebooks` | List + upload + xem trước; **Lưu cấu hình** (trang xem trước / ngày mượn / miễn phí) không bắt buộc file mới |
| Tồn kho | `/admin/inventory` · `/admin/books/:id` | Bản sao, vị trí kệ; **Thanh lý** ≠ **Xóa cứng**; mất/hỏng khi đang mượn → quầy Sự cố / Trả |
| Mượn / Trả | `/admin/loans` | Lookup + checkout + check-in; không có bảng list phiếu |
| Thu phạt | `/admin/fines` | Tra từng mã bạn đọc (SV/GV); thu đủ một lần; lọc loại Trễ hạn / Mất·hỏng / Phạt khác |
| Báo mất / Hỏng | `/admin/incidents` | List + lập biên bản; bồi thường theo giá bìa nếu sách có giá; thu tiền tại Thu phạt |
| Người dùng | `/admin/users` | List / tạo (mã bạn đọc 3–50 cho SV/GV/thủ thư, username tuỳ chọn) / khóa / reset / import |
| Phòng học nhóm | `/admin/rooms` | CRUD phòng; nút **Check-in mã đặt** sang màn check-in |
| Check-in phòng | `/admin/rooms/checkin` | Vào từ Phòng (hoặc search header); theo ngày; cửa sổ 15 phút |
| GD chưa khớp | `/admin/unmatched` | Lọc Chưa khớp / Đã khớp / Tất cả |

---

## 3. Quầy xuất mượn — `/admin/loans` (phải)

1. Nhập **mã bạn đọc** → **Tra cứu** / Enter.  
2. Xem phiếu chờ (`REQUESTED` / `PENDING_PICKUP`) nếu có. Không có phiếu chờ vẫn xuất trực tiếp.  
3. Quét **mã vạch bản Sẵn sàng** (không nhập mã phiếu).  
4. Ghi chú tình trạng khi giao (tuỳ chọn) → **Xác nhận xuất phiếu mượn**.

| Thử | Mã | Kỳ vọng |
|-----|-----|---------|
| Sạch, xuất được | `52400013` + `BC-005-02` hoặc `BC-005-03` | Thêm vào phiếu → xuất OK |
| Có phiếu chờ nhận | `52400011` | Thấy *Introduction to Algorithms* chờ nhận (`REQUESTED`) |
| Bị chặn | `52400003` | Toast nợ / khóa — không xuất |
| Nhầm mã phiếu | Gõ `5` vào ô mã vạch | Báo đây là mã phiếu; gợi ý bản sẵn sàng |

Bạn đọc nợ hoặc `is_borrowing_blocked` → không xuất. Bản không `AVAILABLE` → từ chối.

---

## 4. Quầy nhận trả — `/admin/loans` (trái)

1. Quét **mã vạch sách đang mượn / quá hạn**, hoặc nhập mã bạn đọc nếu FE tra được phiếu active → Enter.  
2. Chọn **Nguyên vẹn** hoặc **Hư hỏng / Mất sách**.  
3. **Xác nhận trả sách** một lần.

| Thử | Mã | Kỳ vọng |
|-----|-----|---------|
| Quá hạn | `52400009` / `BC-005-01` | Thẻ trả; xác nhận sẽ chốt phạt quá hạn |
| Không mượn | `BC-001-02` (đang AVAILABLE) | Không có phiếu đang mượn |
| Đã báo mất | `BC-003-01` | Bản **LOST**, không trả thường |

Trả lần 2 cùng mã → toast không còn phiếu — đúng nghiệp vụ. Mất/hỏng nặng: lập biên bản ở **Báo mất / Hỏng**, thu tiền ở **Thu phạt**.

---

## 5. Thu phạt — `/admin/fines`

1. Nhập đúng **mã bạn đọc** (SV/GV) → **Tra cứu**. Bảng trống đến khi tra.  
2. Lọc **Chưa thu** / **Đã hoàn tất**.  
3. Lọc loại vi phạm (nếu cần): **Trễ hạn trả sách** · **Mất / hỏng sách** · **Phạt khác** (BE gắn loại theo biên bản sự cố, không đoán tay trên UI).  
4. **Thu tiền** → xác nhận tiền mặt **đủ toàn bộ** nợ một lần (không thu một phần).

| Mã bạn đọc | Trạng thái (28/11/2026) |
|------|------|
| `52400003` | Chưa thu **65.000 ₫** (trễ hạn, tăng 5.000 ₫/ngày) |
| `52400005` | Chưa thu **280.000 ₫** (bồi thường mất sách) |
| `52400007` | Chưa thu **45.000 ₫** (trễ hạn, tăng 5.000 ₫/ngày) |
| `52400009` | Chưa thu **55.000 ₫** (trễ hạn, tăng 5.000 ₫/ngày) |
| `52400011` | Đã hoàn tất **50.000 ₫** |
| `52400001` | Không có khoản phạt |
| `52400002` | Không tồn tại |

Sau thu: `total_fines = 0`, mở khóa mượn (trừ khi còn sách quá hạn chưa trả — toast cảnh báo).

---

## 6. Báo mất / hỏng — `/admin/incidents`

1. Bảng list + lọc **Tất cả / Mất sách / Hỏng nặng**. Trạng thái ghi nhận luôn **Đã ghi nhận** (không workflow PENDING).  
2. **Lập biên bản** → tra **mã bạn đọc (SV hoặc GV) / mã phiếu / barcode** phiếu đang `BORROWED`/`OVERDUE` rồi Enter hoặc **Tra cứu** (UC15: người mượn có thể là giảng viên).  
3. Chọn mất hoặc hỏng → mô tả → Lưu.  
   - Sách **có giá bìa**: khoản bồi thường theo giá (± quá hạn) — form **không** cho sửa tay số tiền.  
   - Sách **thiếu giá**: bắt buộc nhập số bồi thường thủ công.  
4. Hệ thống cộng phạt, khóa mượn; mất → copy `LOST`, hỏng → copy `RETIRED`.  
5. Thu tiền sang `/admin/fines?mssv=…`.  

Không dùng form **sửa tồn kho** để “báo mất” thay cho bước này.

**Biên bản đã ghi nhận:** `52400005` (mất `BC-003-01`, *Design Patterns*) — không lập lại trên phiếu này.

**Lập biên bản mới** chỉ được trên phiếu đang `BORROWED` / `OVERDUE` và còn mã vạch:

| Phiếu | Bạn đọc | Mã sách (barcode) | Đầu sách | Trạng thái |
|-------|---------|-------------------|----------|------------|
| **#5** | `52400009` Anh Tùng Mai | **`BC-005-01`** | *Introduction to Algorithms* (id `5`) | OVERDUE |
| **#2** | `52400003` Bà Ngọc Lê | `BC-002-01` | *The Pragmatic Programmer* (id `2`) | OVERDUE |
| **#1** | `52400001` Quý cô Phương Vũ | `BC-001-01` | *Clean Code* (id `1`) | BORROWED |

Cách làm: **Lập biên bản** → nhập `52400009` hoặc `5` hoặc `BC-005-01` (nếu form hỗ trợ) → chọn Mất / Hỏng → mở form rồi **Hủy** (giữ dữ liệu). Lưu thật sẽ khóa bạn đọc và cộng phạt.

---

## 7. Danh mục · Tồn kho · eBook

### `/admin/catalog`

- Tìm + debounce ~0,35s + phân trang server 10.  
- Lọc thể loại / NXB / định dạng (Vật lý, eBook, Cả hai — khớp đúng loại).  
- Cột **Số bản sao (sẵn sàng)** = bản `AVAILABLE` / tổng bản in.  
- **Mã học phần** phải chọn mã hợp lệ trong danh mục (không nhập tự do ngoài danh sách).  
- Thêm / sửa / **Vô hiệu hóa đầu sách** (`is_active=false`, không xóa cứng; bản sao barcode vẫn còn trong kho).  
- Sửa đầu sách đã có PDF: đổi trang xem trước / ngày mượn / miễn phí rồi **Lưu** — không bắt buộc chọn PDF mới.  
- Thẻ **Thể loại** → CRUD thể loại.

### `/admin/inventory`

- Ô trên: **mã đầu sách hoặc tên** (một kết quả mở ngay; nhiều kết quả → gợi ý). Sau khi mở đầu sách, lọc barcode / vị trí kệ / trạng thái lưu thông trong bảng.  
- Trạng thái lưu thông (Tiếng Việt): Sẵn sàng · Đang cho mượn · Đã thanh lý · Hư hỏng · Báo mất.  
- **Trạng thái** = lưu thông (`AVAILABLE` / `BORROWED` / `LOST`…). **Tình trạng** = vật lý (Nguyên vẹn / Hư hỏng / Báo mất / Đã thanh lý) — không lấy từ ghi chú `[Thanh lý]…`.  
- Bản **Đang cho mượn** có thể mở quầy theo barcode (`/admin/loans?barcode=…`) để xem phiếu active.  
- **Thanh lý**: ngừng lưu thông, giữ barcode; không thanh lý bản đang mượn; sau thanh lý / mất / hỏng **không** đưa lại Sẵn sàng.  
- **Xóa cứng**: chỉ bản **Sẵn sàng** chưa từng có lịch sử mượn; khác Thanh lý.  
- Thêm bản sao mới luôn **Sẵn sàng**. Sửa bản sẵn sàng: chỉ Sẵn sàng hoặc Thanh lý kho — **không** chọn tay Báo mất / Hư hỏng (làm ở Sự cố / Trả sách).

| ID | Đầu sách | Mã mẫu | Trạng thái |
|----|----------|--------|------------|
| `1` | Clean Code | `BC-001-01` BORROWED · `BC-001-02` AVAILABLE | |
| `2` | The Pragmatic Programmer | `BC-002-01` BORROWED (quá hạn) · `002-02`, `002-03` AVAILABLE | |
| `3` | Design Patterns | `BC-003-01` | LOST |
| `5` | Introduction to Algorithms | `BC-005-01` BORROWED (quá hạn) · `005-02`, `005-03` AVAILABLE | |
| `6` | Artificial Intelligence | `BC-006-01`, `006-02` BORROWED | Hết bản → hàng chờ |

Hiện kho có 207 bản in: 200 Sẵn sàng · 6 Đang cho mượn · 1 Báo mất; chưa có bản Đã thanh lý / Hư hỏng.

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

Các lượt đặt có sẵn (`RB-001`…`RB-006`, ngày 23–27/11/2026) đều đã kết thúc (COMPLETED / CANCELLED / NO_SHOW). Muốn thử check-in: đăng nhập cổng bạn đọc (vd. `52400013`), đặt một slot sắp bắt đầu, rồi check-in trong **15 phút đầu** slot.

---

## 9. Người dùng · Giao dịch chưa khớp

### `/admin/users`

Thêm / sửa / khóa–mở (có lý do khóa) / đặt lại mật khẩu / import CSV·XLSX.  
- Mã bạn đọc (MSSV / mã GV / mã thủ thư): **3–50** ký tự.  
- **Username** đăng nhập (tuỳ chọn) khi tạo; để trống → hệ thống tạo `sv{mã}`.  
- **Đặt lại mật khẩu** (icon chìa khóa):
  1. Bấm icon → modal **Cấp mật khẩu tạm mới?** (cảnh báo: mật khẩu cũ **không đăng nhập được ngay**; gửi email mật khẩu mới cho người dùng).
  2. **Hủy** = không đổi gì. **Xác nhận cấp mật khẩu tạm** = hệ thống ghi đè mật khẩu.
  3. Modal **Mật khẩu tạm thời** hiện chuỗi mới **một lần** trên màn hình (Copy & đóng). Cùng chuỗi đó được gửi email cho user.
  4. API reset theo **Account.id**, không theo mã bạn đọc.

### `/admin/unmatched`

1. Thẻ / lọc: **Chưa khớp** · **Đã khớp** · Tất cả.  
2. **Gán** chọn mã bạn đọc → cộng ví thật; chỉ gán khi chưa có `assigned_user_code`.  
3. Thử: mở Gán trên `FT26_UNMATCHED_002` (75.000 ₫) rồi **Hủy**.  
4. `FT26_UNMATCHED_001` (100.000 ₫) và `002` đang **Chưa khớp**. `FT26_UNMATCHED_003` (50.000 ₫) đã gán cho `52400011`.

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

- `GET /api/admin/loans/lookup` — mã bạn đọc hoặc id phiếu (+ `reader`)
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

Swagger: https://libmanager-api-zvuf.onrender.com/docs (cloud) hoặc http://127.0.0.1:8010/docs (Docker local) — đăng nhập admin lấy JWT trước khi thử.
