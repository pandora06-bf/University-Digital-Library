# Kịch bản demo và dữ liệu mẫu ULMS

Sprint 2C | Task 4-21 | Cập nhật 28/11/2026 (đổi tên dữ liệu mẫu theo MSSV, tên sách giữ nguyên)

> Tài liệu này mô tả dữ liệu **ngay sau khi chạy seeder trên một database mới** (máy dev / kiểm thử).
> Database chính trên cloud đã có người thao tác nên số liệu khác; trạng thái hiện tại xem `docs/HUONG_DAN_THU_THU.md`.
> **Không chạy seeder vào database chính.**

## Khởi tạo môi trường thử nghiệm

Chạy migration trước rồi chạy `python database_seeder.py` trong `back_fast_api`. Seeder tạo dữ liệu theo khóa cố định nên chạy lại không nhân đôi bản ghi. Khi chạy lại, các bản ghi mẫu và số dư ví do seeder quản lý sẽ được đồng bộ về trạng thái ban đầu; không chạy lại trên database đang dùng để thao tác thủ công. Để lặp lại ca đã làm thay đổi trạng thái (trả sách, thu phạt, hủy phòng), tạo database thử nghiệm mới.

| Vai trò / dữ liệu | Đăng nhập / mã | Mật khẩu / trạng thái |
|---|---|---|
| Admin | `admin` | Lấy từ `ADMIN_PASSWORD` (máy dev mặc định `Admin@123`; trên cloud là mật khẩu riêng của nhóm) |
| Sinh viên | `52400001` | `User@123`; dư ví mẫu 280.000₫, đang mượn sách |
| Sinh viên nợ phạt | `52400003` | `User@123`; Fine chưa trả 55.000₫, đang bị khóa |
| Sinh viên báo mất | `52400005` | `User@123`; Incident bồi thường bằng đúng `books.price`, đang bị khóa |
| Sinh viên chờ nhận | `52400007` | `User@123`; có phiếu `REQUESTED`, có TopUp `PENDING` |
| Sinh viên hàng đợi | `52400009` | `User@123`; hàng đợi `WAITING`, có giao dịch ngân hàng đã gán |
| Giảng viên đọc eBook | `gv0002` / `GV0002` | `User@123`; có phiếu mượn eBook |
| Giảng viên giữ chỗ | `gv0004` / `GV0004` | `User@123`; hàng đợi `HELD`, có lượt đặt phòng đã hủy và hoàn ví |
| Sinh viên lịch sử phạt | `52400011` | `User@123`; khoản Fine 50.000₫ đã thanh toán bằng ví |

Seeder tạo 100 sách (giữ nguyên tên sách thật, mã `1`–`100` theo thứ tự trong `data/books_seed.csv`), 1–3 bản sao/barcode `BC-<mã sách>-<số bản>` mỗi sách, cả sách in và eBook; 100 hồ sơ cộng admin cố định: số lẻ là sinh viên `52400001`, `52400003`…; số chẵn là giảng viên `GV0002` (đăng nhập `gv0002`)…; 4 phòng. Tồn kho đầu sách bằng số bản sao `AVAILABLE`; bản sao gắn với khoản mượn đang hoạt động chuyển sang `BORROWED`, mất sách chuyển sang `RETIRED`. Sách có `WAITING` được làm hết tồn; `HELD` giữ chỗ theo logic hàng đợi và hạn 24 giờ.

### Dữ liệu nghiệp vụ cần khớp

- Ví 52400001: nạp 100.000 + 200.000 − thanh toán phòng 20.000 = **280.000₫**.
- Ví 52400003: nạp 150.000 − thanh toán phòng 30.000 = **120.000₫**; khoản Fine 55.000₫ vẫn chưa trả.
- Ví GV0004: nạp 30.000, thanh toán phòng 30.000 rồi hoàn 30.000 = **30.000₫**; ledger không âm tại bất kỳ bước nào.
- Ví 52400009: giao dịch `FT26_UNMATCHED_003` được gán và cộng 50.000₫; hai giao dịch `UNRESOLVED` không cộng vào ví.
- Ví 52400011: nạp 100.000 − khoản phạt đã trả 50.000 = **50.000₫**; FinePayment `WALLET` khớp Fine 50.000₫, trạng thái `PAID`.
- TopUp `PAID` có WalletTxn `TOPUP` cùng số tiền/mã; `PENDING` và `EXPIRED` không có giao dịch cộng ví.
- Room booking mẫu gồm `COMPLETED`, `CHECKED_IN`, `CONFIRMED`, `CANCELLED`, `NO_SHOW`. Giao dịch phòng dùng mã `RB-*` để truy vết đặt phòng/thanh toán/hoàn tiền.

## Kịch bản 16 Use Case

| UC | Tài khoản / dữ liệu | Các bước trình diễn và kết quả mong đợi |
|---|---|---|
| 01 Đăng nhập | `52400001` | Đăng nhập → thấy hồ sơ STUDENT; đăng nhập `admin` để vào khu quản trị. |
| 02 Tra cứu sách | `52400001` | Tìm *Clean Code* hoặc từ khóa/tác giả → xem đầu sách, thể loại, môn học, giá, tồn và vị trí bản sao. |
| 03 Hồ sơ cá nhân | `52400001` | Mở hồ sơ để kiểm tra mã SV, vai trò và hạn mức. Đối chiếu số dư ví 280.000₫ bằng SQL hoặc màn/API ví sau khi được tích hợp; `/api/users/me` hiện chưa trả `service_balance`. |
| 04 eBook | `gv0002` | Fixture có phiếu mượn eBook `BORROWED` và hạn trả. Seeder chưa cấp `ebook_access_token`, và router eBook chưa được đăng ký trong `app/main.py`; chỉ trình diễn luồng đọc có bảo vệ sau khi tích hợp và cấp token. |
| 05 Mượn sách | `52400007` | Xem phiếu REQUESTED trên *Introduction to Algorithms*; thử checkout tại quầy sau khi gán bản sao → chuyển BORROWED, bản sao BORROWED, tồn giảm một. Tài khoản `52400003` phải bị chặn vì nợ phạt. |
| 06 Gia hạn | `52400001` | Mở phiếu BORROWED *Clean Code* → thử gia hạn theo điều kiện của hệ thống; kiểm tra hạn mới và giới hạn số lần. |
| 07 Hàng đợi | `52400009` | Mở sách *Artificial Intelligence* (mã 6) đã hết bản AVAILABLE → thấy WAITING; `gv0004` có HELD đến thời điểm hết hạn. |
| 08 Trả sách | `admin` + `52400001` | Check-in barcode của bản sao đang BORROWED → loan RETURNED, bản sao AVAILABLE, tồn tăng; kiểm tra Fine nếu trả muộn. |
| 09 Tìm kiếm nâng cao | `52400001` | Kết hợp từ khóa, `subject_code`, thể loại/năm và phân trang → kết quả chỉ chứa sách khớp bộ lọc. |
| 10 Thu phạt tại quầy | `admin` + `52400003` | Xem Fine chưa trả 55.000₫ rồi thu CASH → FinePayment CASH; nợ còn lại cập nhật và mở khóa nếu đã hết nợ. Chạy ca này trên database thử nghiệm riêng nếu cần giữ nguyên UC11/UC16. |
| 11 Tính phạt tự động | `52400003` | Kiểm tra loan OVERDUE (quá hạn 11 ngày) và Fine 55.000₫. Chạy JOB-01 qua scheduler theo môi trường tích hợp; chạy lặp không được cộng trùng. Seeder chỉ tạo fixture, không tự chạy job. |
| 12 Tác vụ nền | `admin` | Kiểm tra dữ liệu có thể dùng cho các job: REQUESTED có hạn nhận 24h, HELD có hạn 24h, TopUp PENDING hết hạn sau 15 phút, booking NO_SHOW và ebook có hạn. Gọi scheduler/job theo cấu hình môi trường; không giả định endpoint dev riêng. |
| 13 Quản lý người dùng | `admin` | Tìm hồ sơ `52400003`, xem trạng thái khóa. Kiểm tra tạo/khóa/mở khóa/đặt lại mật khẩu hoặc import CSV khi API 2B-08 được tích hợp. |
| 14 Đặt phòng | `52400001` / `admin` | Xem các phòng và booking; đối chiếu COMPLETED/CHECKED_IN/CONFIRMED/CANCELLED/NO_SHOW. Kiểm tra giao dịch `RB-001`, `RB-002`, `RB-004` tương ứng thanh toán/hoàn tiền. |
| 15 Báo mất/hỏng | `admin` + `52400005` | Mở loan LOST và Incident BOOK_LOST → penalty bằng giá sách, bản sao RETIRED, tổng nợ và trạng thái khóa khớp. Thao tác báo mất mới cần dùng loan BORROWED khác. |
| 16 Ví và giao dịch chưa khớp | `admin` / người dùng mẫu | Xem lịch sử TOPUP, BOOKING_PAYMENT, REFUND; TopUp PAID/PENDING/EXPIRED. Admin xem 2 UnmatchedTx UNRESOLVED và một ASSIGNED (`FT26_UNMATCHED_003`); kiểm tra chỉ giao dịch đã gán mới cộng ví. |

> Một số thao tác UC phụ thuộc API/UI do thành viên khác phụ trách. Kịch bản này chỉ dùng route và job sau khi chúng được tích hợp; seeder chuẩn bị dữ liệu đối chiếu và không tự tạo endpoint.

## SQL đối chiếu nhanh bằng PostgreSQL (`psql`)

Các câu dưới đây là SQL để dán vào dấu nhắc `psql`, không phải lệnh CMD. Với database test ở hướng dẫn, mở kết nối bằng:

```cmd
docker exec -it libmanager_db_nhat psql -U lib_user -d libmanager_sprint2c_check
```

Khi `psql` hiện dấu nhắc `libmanager_sprint2c_check=#`, dán từng truy vấn bên dưới. Truy vấn tồn kho không có dòng kết quả nghĩa là không có mismatch.

```sql
-- Bản sao AVAILABLE phải khớp available_stock cho mọi đầu sách
SELECT b.id, b.title, b.available_stock,
       count(c.copy_barcode) FILTER (WHERE c.status = 'AVAILABLE') AS available_copies
FROM books b LEFT JOIN book_copies c ON c.book_id = b.id
GROUP BY b.id, b.title, b.available_stock
HAVING b.available_stock <> count(c.copy_barcode) FILTER (WHERE c.status = 'AVAILABLE');

-- Trạng thái đặt phòng được sinh
SELECT status, count(*) FROM room_bookings
WHERE notes LIKE 'RB-%' GROUP BY status ORDER BY status;

-- Kiểm tra các loại giao dịch ví
SELECT txn_type, count(*) FROM wallet_txns
WHERE reference_id LIKE 'PAY-%' OR reference_id LIKE 'RB-%'
   OR reference_id LIKE 'FT26_UNMATCHED_%' OR reference_id LIKE 'FINE-PAID-%'
GROUP BY txn_type ORDER BY txn_type;
```
