# Bàn giao mẫu email 3-23 cho Nhất (3-06)

Bốn mẫu độc lập, HTML dạng bảng, CSS inline, UTF-8, không dùng JavaScript,
ảnh từ xa hoặc font cần tải. Đuôi `.html` theo bảng phân công (3-23). Không cần
ghép thêm layout.

- `receipt.html`: biên lai Check-out; `receipt_id`, `borrow_date`, `due_date`,
  `books` (danh sách có `title`, `author`, `loan_code`), `my_books_url`.
- `due_reminder.html`: nhắc tới hạn; `book_title`, `loan_code`, `due_date`, `my_books_url`.
- `hold_notice.html`: thông báo giữ chỗ; `book_title`, `hold_code`, `pickup_deadline`,
  `pickup_location`, `pickup_url`. Backend tính `pickup_deadline` đúng 48 giờ (SRS BR-08)
  sau thời điểm bắt đầu giữ chỗ; không tính mốc này trong template.
- `top_up.html`: xác nhận nạp thành công; `transaction_id`, `pay_code`, `amount`
  (số tiền **thực nhận**), `paid_at`, `balance_after`, `wallet_url`.

Biến dùng chung: `user_name`, `library_name`, `support_email`, `library_url`.
Ngày giờ phải được backend đổi sang Asia/Ho_Chi_Minh và định dạng trước khi
render; số tiền định dạng VNĐ. URL phải do backend tạo từ domain thư viện đáng
tin cậy, chỉ cho phép HTTPS (HTTP localhost cho dev). Không đưa `read_token`,
mật khẩu hoặc link PDF riêng tư vào email.

## Đường dẫn trong dự án hiện tại

Template nằm trong backend thật: `back_fast_api/templates/email/` (bảng phân công
ghi `/backend/templates/email/`; nhóm thống nhất đặt trong `back_fast_api/` để
Docker có sẵn template). Trong module `back_fast_api/app/services/email_notifier.py`,
cấu hình đường dẫn bằng:

```python
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

template_dir = Path(__file__).resolve().parents[2] / "templates" / "email"
environment = Environment(
    loader=FileSystemLoader(template_dir),
    autoescape=select_autoescape(["html", "xml"]),
    undefined=StrictUndefined,
)
html = environment.get_template("receipt.html").render(**context)
```

Container `api` build từ `back_fast_api/` và mount thư mục này vào `/app`, nên
template có sẵn tại `/app/templates/email/` mà không cần cấu hình thêm. Backend
gửi `top_up.html` sau khi webhook hoặc giả lập xác nhận nạp tiền thành công.

## Xem trước và kiểm tra Gmail

`sample_context.json` chứa dữ liệu giả. Trên môi trường Python có Jinja2:

```sh
python -m pip install "Jinja2>=3.1,<4"
python back_fast_api/templates/email/render_preview.py
```

Thư mục `preview/` có bốn bản HTML đã gắn dữ liệu để kiểm tra trực tiếp.
Các bản hiện tại được tạo từ dữ liệu mẫu để xem trước; cần chạy lệnh trên
trên môi trường backend để xác nhận với runtime Jinja2 thật.

### Kết quả kiểm tra Gmail: **đã thực hiện, 4/4 mẫu đạt**

- **Thời điểm:** 21/10/2026, gửi lúc 13:48, kiểm tra trên điện thoại lúc 14:29.
- **Cách gửi:** gửi thật qua SMTP Gmail (`smtp.gmail.com`), MIME
  `multipart/alternative` gồm `text/plain` và `text/html; charset=utf-8`,
  nội dung là 4 bản trong `preview/` (render từ `sample_context.json`).
- **Môi trường:** Gmail app iOS ở chế độ tối; Gmail web trên Chrome ở giao diện sáng.

| Tiêu chí | Kết quả |
|---|---|
| Dấu tiếng Việt | Đạt |
| Không sót biến Jinja | Đạt |
| Tiêu đề dài xuống dòng | Đạt (sách có tiêu đề dài trong biên lai) |
| Biên lai nhiều sách | Đạt (2 sách hiển thị 2 khung riêng) |
| Nút CTA có màu, link gắn đúng địa chỉ | Đạt |
| Không cuộn ngang trên điện thoại | Đạt |
| Đọc được ở chế độ tối | Đạt |

Link trong bản preview dùng tên miền mẫu `example.edu.vn` nên không mở ra trang
thật. Đã xác nhận nút và link hỗ trợ trỏ đúng địa chỉ; backend (3-06) thay bằng
domain thư viện thật. Ảnh chụp màn hình lưu trong thư mục bằng chứng
`Bang_chung_3-23` (nộp kèm báo cáo, không đưa vào repo).

Các thuộc tính CSS được đối chiếu với [tài liệu CSS chính thức của Gmail](https://developers.google.com/workspace/gmail/design/css);
việc đối chiếu này chưa thay thế kiểm tra hiển thị thực tế.
