# Bàn giao mẫu email 3-23 cho Nhất (3-06)

Bốn mẫu độc lập, HTML dạng bảng, CSS inline, UTF-8, không dùng JavaScript,
ảnh từ xa hoặc font cần tải. Đuôi `.htm` theo yêu cầu bàn giao; Jinja2 đọc được
cả `.htm` và `.html`. Không cần ghép thêm layout.

- `receipt.htm`: biên lai Check-out; `receipt_id`, `borrow_date`, `due_date`,
  `books` (danh sách có `title`, `author`, `loan_code`), `my_books_url`.
- `due_reminder.htm`: nhắc tới hạn; `book_title`, `loan_code`, `due_date`, `my_books_url`.
- `hold_24h.htm`: thông báo giữ chỗ; `book_title`, `hold_code`, `pickup_deadline`,
  `pickup_location`, `pickup_url`. Backend tính `pickup_deadline` đúng 24 giờ
  sau thời điểm bắt đầu giữ chỗ; không tính mốc này trong template.
- `top_up.htm`: xác nhận nạp thành công; `transaction_id`, `pay_code`, `amount`
  (số tiền **thực nhận**), `paid_at`, `balance_after`, `wallet_url`.

Biến dùng chung: `user_name`, `library_name`, `support_email`, `library_url`.
Ngày giờ phải được backend đổi sang Asia/Ho_Chi_Minh và định dạng trước khi
render; số tiền định dạng VNĐ. URL phải do backend tạo từ domain thư viện đáng
tin cậy, chỉ cho phép HTTPS (HTTP localhost cho dev). Không đưa `read_token`,
mật khẩu hoặc link PDF riêng tư vào email.

## Đường dẫn trong dự án hiện tại

Backend thực tế là `back_fast_api/`. Thư mục template giữ đúng vị trí sản phẩm
`backend/templates/email/` trong yêu cầu. Trong module
`back_fast_api/app/services/email_notifier.py`, cấu hình đường dẫn bằng:

```python
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

template_dir = Path(__file__).resolve().parents[3] / "backend" / "templates" / "email"
environment = Environment(
    loader=FileSystemLoader(template_dir),
    autoescape=select_autoescape(["html", "htm", "xml"]),
    undefined=StrictUndefined,
)
html = environment.get_template("receipt.htm").render(**context)
```

Khi đóng gói Docker chỉ với build context `back_fast_api/`, cần copy thư mục
template vào image hoặc mount nó và cấu hình lại đường dẫn. SMTP, retry và
BackgroundTasks thuộc 3-06; các mẫu này chưa gửi thư tự động.

## Xem trước và kiểm tra Gmail

`sample_context.json` chứa dữ liệu giả. Trên môi trường Python có Jinja2:

```sh
python -m pip install "Jinja2>=3.1,<4"
python backend/templates/email/render_preview.py
```

Thư mục `preview/` có bốn bản HTML đã gắn dữ liệu để kiểm tra trực tiếp.
Các bản hiện tại được tạo từ dữ liệu mẫu để xem trước; cần chạy lệnh trên
trên môi trường backend để xác nhận với runtime Jinja2 thật.

Kiểm tra Gmail vẫn **chưa thực hiện**: phiên làm việc hiện tại chưa có Gmail
kết nối và trình duyệt khả dụng. Không coi kiểm tra mã HTML hoặc bản preview
trong trình duyệt là bằng chứng email đã render đúng trong Gmail.

Khi có hộp thư thử nghiệm được cho phép gửi, gửi từng bản qua SMTP với MIME
`text/html; charset=utf-8`, kèm nội dung `text/plain`. Kiểm tra Gmail web và
Gmail điện thoại: dấu tiếng Việt, tiêu đề dài xuống dòng, nút CTA, link hỗ trợ,
không cuộn ngang ở 320/375 px, chế độ tối, không xuất hiện biến Jinja còn sót.
Thử cả biên lai có nhiều sách. Lưu ảnh kiểm tra và thời điểm thực hiện.

Các thuộc tính CSS được đối chiếu với [tài liệu CSS chính thức của Gmail](https://developers.google.com/workspace/gmail/design/css);
việc đối chiếu này chưa thay thế kiểm tra hiển thị thực tế.
