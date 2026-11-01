# Tài Liệu Triển Khai Hệ Thống Cloud (Task 4-12)
## Supabase (Database) + Render (FastAPI Backend) + Vercel (React Frontend)

> **Người thực hiện:** Lợi (L)  
> **Dự án:** University Digital Library (ULMS)  
> **Cập nhật:** Sprint 3 (Chuẩn bị và kiểm thử triển khai Cloud)

---

## 1. Kiến Trúc & Danh Sách URL Mẫu Triển Khai

Hệ thống được thiết kế theo kiến trúc 3 lớp độc lập:

```
[ Người dùng / Trình duyệt ]
             │
             ▼
   [ Vercel CDN Frontend ]
   https://<ten-du-an-nhom>.vercel.app
             │  (REST API calls qua HTTPS)
             ▼
   [ Render Web Service (FastAPI) ]
   https://<ten-api-nhom>.onrender.com
             │  (PostgreSQL Connection Pool qua SSL)
             ▼
   [ Supabase Managed Database (PostgreSQL 15) ]
   aws-0-ap-southeast-1.pooler.supabase.com:6543 / db.<project-ref>.supabase.co:5432
```

### Bảng Thông Số Endpoint (Mẫu cấu hình khi nhóm đăng ký):

| Thành phần | Nền tảng Cloud | Địa chỉ URL / Hostname Mẫu | Cổng | Ghi chú trạng thái |
|---|---|---|---|---|
| **Frontend Web** | **Vercel** | `https://<ten-du-an-nhom>.vercel.app` | 443 | Sẵn sàng liên kết repo GitHub |
| **Backend API** | **Render** | `https://<ten-api-nhom>.onrender.com` | 443 | Web Service (Python 3) |
| **API Docs (Swagger)** | **Render** | `https://<ten-api-nhom>.onrender.com/docs` | 443 | Tự động sinh từ FastAPI |
| **Database Pooler** | **Supabase** | `aws-0-ap-southeast-1.pooler.supabase.com` | 6543 | Transaction Pooler (Session mode) |
| **Database Direct** | **Supabase** | `db.<project-ref>.supabase.co` | 5432 | Direct connection (Cần IPv6/SSL) |

---

## 2. Template Cấu Hình Biến Môi Trường (Placeholder An Toàn)

> [!IMPORTANT]
> **Quy định bảo mật:** Không lưu bất kỳ mật khẩu thật, khóa bí mật (Secret Key) hay thông tin tài khoản SMTP thật nào vào kho mã nguồn (Git Repository). Mọi giá trị nhạy cảm dưới đây đều sử dụng **Placeholder** làm khuôn mẫu. Người quản trị sẽ điền trực tiếp vào giao diện quản lý biến môi trường của từng nền tảng Cloud.

### A. Backend FastAPI (Cấu hình trên Render Dashboard -> Environment)
```bash
# Kết nối PostgreSQL Supabase với SSL bắt buộc (sử dụng mật khẩu DB do nhóm đặt)
DATABASE_URL=postgresql+psycopg2://postgres.<project-ref>:[YOUR-SUPABASE-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require

# Khóa bí mật ký phát hành JWT Token (tạo chuỗi ngẫu nhiên dài trên 32 ký tự)
SECRET_KEY=[GENERATE-LONG-RANDOM-SECRET-KEY]

# CORS Whitelist cho phép Frontend Vercel và Localhost gọi API
FRONTEND_ORIGINS=https://<ten-du-an-nhom>.vercel.app,http://localhost:5173,http://localhost:5174

# Tài khoản Quản trị viên khởi tạo
ADMIN_USERNAME=admin
ADMIN_PASSWORD=[YOUR-STRONG-ADMIN-PASSWORD]
RESET_ADMIN_PASSWORD=false

# Cấu hình Webhook bí mật (Dành cho cổng thanh toán / nạp tiền)
WEBHOOK_SECRET_KEY=[YOUR-WEBHOOK-SECRET-TOKEN]

# Cấu hình SMTP gửi email nhắc hẹn trả sách (JOB-03)
# (Để trống SMTP_HOST nếu chưa kích hoạt dịch vụ gửi mail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=[YOUR-EMAIL-SERVICE@gmail.com]
SMTP_PASSWORD=[YOUR-APP-SPECIFIC-PASSWORD]
SMTP_FROM=[YOUR-EMAIL-SERVICE@gmail.com]
SMTP_SSL=false
```

### B. Frontend ReactJS (Cấu hình trên Vercel Dashboard -> Settings -> Environment Variables)
```bash
# URL Backend Production trên Render
VITE_API_URL=https://<ten-api-nhom>.onrender.com

# Chế độ chạy thật với Backend API (hoặc true nếu bật mock dự phòng)
VITE_USE_MOCK=false

# Kích hoạt tính năng đặt phòng trực tiếp qua API backend khi sẵn sàng
VITE_ROOM_BOOKING_API=false
```

---

## 3. Quy Trình Chạy Migration & Seeder Khi Triển Khai Lên Supabase

Sau khi nhóm tạo Database trên Supabase và Web Service trên Render:

1. **Khởi tạo và nâng cấp cấu trúc bảng (Alembic):**
   ```bash
   cd back_fast_api
   export DATABASE_URL="postgresql+psycopg2://postgres.<project-ref>:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
   alembic upgrade head
   ```

2. **Khởi tạo tài khoản quản trị:**
   ```bash
   python app/bootstrap_admin.py
   ```

3. **Nạp 100 đầu sách demo và bộ dữ liệu 16 Use Cases:**
   ```bash
   python database_seeder.py
   ```
   *Lưu ý:* Seeder sẽ đọc dữ liệu sách từ `data/books_seed.csv` và gán ảnh bìa từ `/static/covers/book_xxx.jpg`.

---

## 4. Ghi Chú Đánh Giá Trạng Thái Triển Khai (Sprint 3)
- Các file cấu hình mẫu và tài liệu kiến trúc đã được thiết lập đầy đủ, an toàn, không chứa thông tin nhạy cảm.
- Khi nhóm thống nhất tài khoản Cloud chính thức (Supabase / Render / Vercel), nhóm có thể chạy các lệnh trên để hoàn tất việc đưa hệ thống lên mạng Internet phục vụ đánh giá cuối kỳ.
