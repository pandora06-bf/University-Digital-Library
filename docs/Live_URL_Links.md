# Tài Liệu Triển Khai Hệ Thống Cloud (Task 4-12)
## Supabase (Database) + Render (FastAPI Backend) + Vercel (React Frontend)

> **Người thực hiện:** Lợi (L): kiến trúc & tài liệu Sprint 3; Đạt: triển khai thật Sprint 4  
> **Dự án:** University Digital Library (ULMS)  
> **Cập nhật:** 27/11/2026: đã triển khai thật (Supabase + Render + Vercel)

---

## 1. Kiến Trúc & URL Triển Khai

Hệ thống được thiết kế theo kiến trúc 3 lớp độc lập:

```
[ Người dùng / Trình duyệt ]
             │
             ▼
   [ Vercel CDN Frontend ]
   https://libmanager-ecru.vercel.app
             │  (REST API calls qua HTTPS)
             ▼
   [ Render Web Service (FastAPI) ]
   https://libmanager-api-zvuf.onrender.com
             │  (PostgreSQL Connection Pool qua SSL)
             ▼
   [ Supabase Managed Database (PostgreSQL 17) ]
   aws-1-ap-south-1.pooler.supabase.com:5432 (Session pooler, IPv4)
```

### Bảng URL thật (đã triển khai ngày 27/11/2026)

| Thành phần | Nền tảng Cloud | URL / Hostname | Ghi chú |
|---|---|---|---|
| **Frontend Web** | **Vercel** (Hobby) | https://libmanager-ecru.vercel.app | Tự deploy bằng GitHub Actions (`deploy-frontend.yml`) khi `main` đổi `libmanager-frontend/` |
| **Backend API** | **Render** (Free, Singapore) | https://libmanager-api-zvuf.onrender.com | Docker, tạo từ `render.yaml`; tự deploy khi merge vào `main` |
| **API Docs (Swagger)** | **Render** | https://libmanager-api-zvuf.onrender.com/docs | Tự sinh từ FastAPI |
| **Health check** | **Render** | https://libmanager-api-zvuf.onrender.com/health | `keep-alive.yml` gọi 10 phút/lần để gói Free không ngủ |
| **Database** | **Supabase** (Free, PostgreSQL 17) | `aws-1-ap-south-1.pooler.supabase.com:5432` | **Session pooler** (IPv4). Database chính duy nhất, local Docker cũng dùng chung |
| **Lưu trữ PDF eBook** | **Cloudflare R2** | bucket private | API cấp link đọc, PDF không công khai |

> Scheduler (JOB-01 tính phạt … JOB-09 cảnh báo quá hạn) chạy **bên trong API** (`RUN_SCHEDULER=true`) vì Render Free không có Background Worker. **Không chạy thêm scheduler ở máy local** kẻo gửi email trùng.

---

## 2. Biến môi trường (chỉ placeholder, giá trị thật nằm trên Dashboard)

> [!IMPORTANT]
> **Quy định bảo mật:** Không lưu bất kỳ mật khẩu thật, khóa bí mật hay thông tin SMTP/R2/ngân hàng nào vào Git. Giá trị thật chỉ điền trên Render / Vercel / GitHub Secrets.

### A. Backend FastAPI (Render → `libmanager-api` → Environment)
Các biến không bí mật đã khai báo sẵn trong `render.yaml`. Cần tự điền:
```bash
# Supabase → Connect → Session pooler. Đổi "postgresql://" thành "postgresql+psycopg2://".
# Mật khẩu chỉ nên gồm chữ và số (ký tự @ # / ? làm hỏng chuỗi kết nối).
DATABASE_URL=postgresql+psycopg2://postgres.<project-ref>:<PASSWORD>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres

FRONTEND_ORIGINS=https://libmanager-ecru.vercel.app,http://localhost:5174,http://localhost:5173
LIBRARY_URL=https://libmanager-ecru.vercel.app      # link trong email, bắt buộc https

ADMIN_PASSWORD=<mật khẩu admin mạnh>
RESET_ADMIN_PASSWORD=false   # đặt true MỘT lần để ghi đè mật khẩu admin trong DB bằng ADMIN_PASSWORD, rồi trả về false

R2_ENDPOINT=...  R2_ACCESS_KEY_ID=...  R2_SECRET_ACCESS_KEY=...  R2_BUCKET=...
SMTP_HOST=...  SMTP_USER=...  SMTP_PASSWORD=...  SMTP_FROM=...
BANK_BIN=...  BANK_ACCOUNT_NO=...  BANK_ACCOUNT_NAME=...  BANK_WEBHOOK_KEY=...
```
Đặt sẵn trong `render.yaml`: `UVICORN_RELOAD=false`, `RUN_SCHEDULER=true`, `STORAGE_BACKEND=r2`, `TZ`, `SECRET_KEY` (Render tự sinh). **`RUN_SEEDER` phải là `false`**.

Webhook SePay: `https://libmanager-api-zvuf.onrender.com/api/webhooks/bank`.

### B. Frontend React (Vercel → project `libmanager` → Settings → Environment Variables)
```bash
VITE_USE_MOCK=false
VITE_API_URL=https://libmanager-api-zvuf.onrender.com
```

### C. GitHub (repo → Settings → Secrets and variables → Actions)
| Loại | Tên | Dùng cho |
|---|---|---|
| Secret | `VERCEL_TOKEN` | `deploy-frontend.yml`. **Hết hạn sau 90 ngày**, tạo token mới tại vercel.com/account/settings/tokens |
| Secret | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | `deploy-frontend.yml` |
| Variable | `API_HEALTH_URL` | `keep-alive.yml` |

---

## 3. Dữ liệu & migration

- Migration chạy **tự động** mỗi lần Render khởi động (`docker-entrypoint.sh` → `alembic upgrade head`).
- Dữ liệu trên Supabase là bản đã dọn sạch (100 sách, tài khoản MSSV, 61 eBook trên R2), nạp từ database local ngày 27/11/2026.
- **Không chạy `database_seeder.py` vào database chính**: seeder dành cho máy dev/kiểm thử; nó đặt lại số dư ví và các phiếu mẫu về trạng thái ban đầu, làm mất thao tác thật.
- Sao lưu thủ công (cần Docker, dùng image `postgres:17` vì Supabase là PostgreSQL 17):
  ```bash
  docker run --rm -e SUPABASE_DB_URL postgres:17-alpine sh -c 'pg_dump "$SUPABASE_DB_URL" -n public --no-owner --no-privileges' > backup.sql
  ```
  (`SUPABASE_DB_URL` dạng `postgresql://…`, không có `+psycopg2`.)

---

## 4. Giới hạn gói miễn phí
- Render Free: nếu ngủ, request đầu chờ khoảng 1 phút; `keep-alive.yml` giữ thức. GitHub tắt workflow theo lịch nếu repo 60 ngày không có commit.
- Supabase Free: tạm dừng project sau 7 ngày không hoạt động (API + scheduler truy vấn thường xuyên nên không bị).
- Vercel Hobby: deploy qua GitHub Actions + token nên commit của mọi thành viên đều deploy được.
