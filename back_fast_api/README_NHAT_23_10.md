# Bàn giao Nhất – 23/10/2026 (3-04.a)

## Phạm vi
- POST `/api/waitlists` JSON `{ "book_id": 1 }` (Bearer token)
- GET `/api/waitlists/my-waitlists` (Bearer token)
- DELETE `/api/waitlists/{waitlist_id}` (Bearer token)
- `app/services/waitlist_logic.py`: enqueue, remove, compact_queue, promote_waitlist, expire_holds.
- `app/services/job_hold_expiry.py`: hàm JOB-04 để đăng ký scheduler (không tự chạy trong web worker).

## Nghiệp vụ
- Chỉ đặt trước nếu `books.available_stock == 0`, người dùng không khóa/không nợ, chưa đạt hạn mức và chưa có mục ACTIVE cùng sách.
- `WAITING` đánh số từ 1; xóa sẽ sắp lại hàng đợi.
- Khi Check-in thay đổi stock, sau khi cập nhật số lượng, gọi `promote_waitlist(db, book_id)` **trước commit**.
- `HELD` đến `hold_expires_at` sau 24 giờ UTC; JOB-04 `job_hold_expiry()` xóa giữ chỗ hết hạn và cấp lại.
- **Quan trọng:** lúc giao bản sách cho người HELD, kiểm tra đúng người giữ chỗ, tiêu thụ quyền giữ và giảm tồn kho trong cùng transaction.

## Tích hợp còn phụ thuộc
- 3-07 Check-in do thành viên khác phát triển chưa có trong bản ZIP, vì vậy chỉ cung cấp hook `promote_waitlist`.
- 3-05 scheduler_worker.py chưa có trong bản ZIP: cần đăng ký `job_hold_expiry` với APScheduler tại 1 worker duy nhất, chạy định kỳ (khuyến nghị 1 phút).
- 3-06 Email nền hạn 30/10: chưa có `email_notifier.py`. Để gửi sau commit, dùng `hold_24h.htm` với biến **đúng README**: `book_title`, `hold_code`, `pickup_deadline`, `pickup_location`, `pickup_url`, cộng `user_name`, `library_name`, `support_email`, `library_url`.
- Cần xác nhận chính sách giữ chỗ ở tồn kho: code hiện xem `available_stock` là lượng bản vật lý AVAILABLE; HELD được trừ logic khi nâng hàng, không ghi đè số lượng vật lý. Kiểm thử E2E với Check-in/Check-out trước merge.

## Chạy
`cd back_fast_api && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8010`.
Endpoints trong `/docs`. Database PostgreSQL đang có bảng waitlists từ model hiện tại.

## Kiểm tra
`python -m compileall -q app`; cần PostgreSQL của nhóm để chạy test tích hợp thật.
