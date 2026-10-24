# Bàn giao nhiệm vụ Nhất — 16/10/2026

## Phạm vi theo file Phân công, dòng 15
- 2B-10: tách ảnh bìa public và PDF private, MIME/đuôi + xác minh PDF, tối đa 20 MiB; upload admin giữ nguyên API.
- 3-03: xem trước 10 trang PDF trả Response PDF; sách miễn phí đọc toàn bộ qua preview; mượn eBook kiểm tra khóa/nợ/hạn mức; token JWT thời hạn đúng due_date; stream kiểm tra JWT + người dùng sở hữu + phiếu còn hiệu lực; trả thu hồi quyền.
- 3-05.a: worker APScheduler riêng, múi giờ Asia/Ho_Chi_Minh; JOB-01, JOB-03, JOB-05; đăng ký động JOB-04/06/07 khi code tương ứng được ghép.

## Khởi chạy (thư mục gốc repo)
1. Thiết lập `SECRET_KEY` bí mật, dài và khó đoán trong `.env` (Docker Compose) và đồng bộ API/worker; DB phải đã migrate.
2. `docker compose up --build -d` (có dịch vụ `scheduler`).
3. Nếu dữ liệu PDF cũ nằm trong `back_fast_api/static/ebooks`, chạy **trước khi xóa thư mục cũ**: `docker compose exec api python -m scripts.migrate_legacy_ebooks`. Sau đó xác nhận không còn PDF public.
4. Mở `http://localhost:8010/docs`, login lấy bearer token. Upload admin: `POST /api/admin/books/{book_id}/upload-pdf` (File field `file`; query `is_free=false`).
5. Mượn: `POST /api/loans/ebook/borrow` JSON `{ "book_id": 1 }`; nhận `loan_id`, `read_token`, `due_date`. Đọc: `GET /api/ebooks/1/stream?read_token=<token>` đồng thời gửi Bearer access_token. Xem trước: `GET /api/ebooks/1/preview`. Trả: `POST /api/loans/{loan_id}/return-ebook`.

## Kiểm thử
`cd back_fast_api && pip install -r requirements.txt && python -m pytest -q tests/test_upload_service.py tests/test_fine_job.py`
Mã nguồn đã qua `compileall` nhưng **chưa chạy được pytest tích hợp** tại môi trường tạo gói do không cài được APScheduler từ mạng bị giới hạn; cần chạy lại trong môi trường Docker có internet. Chưa xác nhận chạy DB PostgreSQL thật, Swagger end-to-end, hoặc gửi email thật.

## Phần phải tích hợp từ các thành viên khác
- JOB-03 hiện phát hiện phiếu đến hạn và ghi log, **chưa gửi email** vì kênh email/template đang thuộc phần của thành viên khác.
- JOB-04 (giữ chỗ), JOB-06 (QR), JOB-07 (ví/nạp tiền) **chưa có logic chủ UC** trong ZIP đầu vào. Worker tự đăng ký khi module/hàm đúng tên có mặt: `app.services.waitlist_logic.run_hold_expiry_job`, `app.services.qr_service.run_qr_expiry_job`, `app.services.wallet_service.run_topup_expiry_job`.
- Hạn mức/phạt hiện dựa trên schema ban đầu. Cần thống nhất với migration mới của Hiền (đặc biệt cột trạng thái/loan type).
- File PDF đã xem khi được cấp quyền không thể ngăn chụp ảnh màn hình hoặc lưu từ client.
- Trước khi production: buộc cấu hình SECRET_KEY mạnh, HTTPS, rate limiting, giới hạn đồng thời, kiểm thử tải/DB; rà soát frontend viewer về bearer + read_token.


## Bản cập nhật đối chiếu đặc tả `new.docx` (12/10/2026)
- 2B-10: PDF trong `private_storage/ebooks`; `/static` chỉ mount ảnh bìa; xác nhận magic + pypdf, giới hạn 20 MiB.
- 3-03 (REQ-LIB-04): preview số trang cấu hình 5–10 (`preview_pages`, mặc định 10); sách miễn phí xem trọn vẹn; mượn trả cấp/thu hồi read_token; thời hạn theo thuộc tính eBook `borrow_days` (mặc định 14).
- Admin POST `/api/admin/books/{id}/upload-pdf`: thêm query `preview_pages` 5–10 và `borrow_days` 1–365. Chạy `alembic upgrade head` trước khi dùng bản mới.
- 3-05.a / JOB-01: chạy 00:00 Asia/Ho_Chi_Minh, tính ngày trễ theo múi giờ VN, chỉ tính chênh lệch công nợ từng lần để tránh cộng trùng.
- JOB-03: SMTP nhắc hạn khi còn 1–2 ngày; lưu `email_notices` tránh gửi trùng cùng phiếu và due_date; gửi lại nếu thất bại; chạy bù lúc khởi động. Khai báo `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SSL` trong file `.env` ở thư mục repo; **không đưa mật khẩu thật lên GitHub**.
- JOB-05: khóa eBook hết hạn mỗi 5 phút, `/stream` đồng thời kiểm tra hạn tại thời điểm request.
- API và scheduler cùng lấy `SECRET_KEY` từ Docker Compose `.env`; **thay giá trị mặc định** bằng chuỗi mạnh trước khi demo.

## Báo cáo kiểm thử lần này
- `python -m pytest -q tests/test_upload_service.py tests/test_reminder_email.py`: **7 passed**.
- `python -m alembic heads`: `16oct_email_notices (head)`.
- `python -m compileall -q app alembic tests`: không lỗi cú pháp.
- **CHƯA xác nhận 100% nghiệm thu** vì không có PostgreSQL/Docker/SMTP có cấu hình thực để chạy end-to-end; môi trường dựng gói thiếu APScheduler và không truy cập được PyPI. Vì vậy `tests/test_fine_job.py` chưa chạy, không suy diễn là pass.
- JOB-04/06/07 vẫn đợi module nghiệp vụ tương ứng từ các thành viên khác; scheduler có hook tự đăng ký sau khi nhóm tích hợp. Không thể kiểm thử các job này khi source chưa được cung cấp.
- Cảnh báo kỹ thuật: JavaScript/browser có thể lưu nội dung PDF đã được stream; chặn menu chuột, Ctrl+S/P chỉ là biện pháp UX, không bảo vệ tuyệt đối bản quyền. Viewer React cần bổ sung kiểm tra UI và trình duyệt.

## Lệnh xác minh trên máy người dùng (Windows + Docker Desktop)
```powershell
docker compose up --build -d
docker compose exec api python -m alembic current
docker compose exec api python -m pytest -q tests/test_upload_service.py tests/test_reminder_email.py tests/test_fine_job.py
docker compose logs --tail 100 scheduler
```
Nếu có PDF đời cũ trong `/static/ebooks`, hãy chạy migration script theo hướng dẫn bên trên rồi kiểm tra không còn PDF public.
