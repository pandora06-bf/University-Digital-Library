# HƯỚNG DẪN CHẠY BÀI NHẤT - DEADLINE 05/10

## 1. Phạm vi đúng yêu cầu

### CRUD quản trị danh mục
- `POST /api/admin/categories` - tạo danh mục.
- `GET /api/admin/categories` - xem danh sách.
- `GET /api/admin/categories/{category_id}` - xem chi tiết.
- `PUT /api/admin/categories/{category_id}` - cập nhật.
- `DELETE /api/admin/categories/{category_id}` - xóa.

Tất cả endpoint quản trị danh mục được bảo vệ bằng quyền `ADMIN`.

### Pydantic schema danh mục
File `back_fast_api/app/schemas/category.py` gồm `CategoryCreate`, `CategoryUpdate`, `CategoryResponse`:
- tên không được rỗng;
- tối đa 100 ký tự;
- tự chuẩn hóa khoảng trắng, ví dụ `"  Công   nghệ  "` -> `"Công nghệ"`.

### Xử lý lỗi
- ID không tồn tại -> HTTP `404`.
- Tên trùng -> HTTP `409` (so sánh không phân biệt hoa/thường ở tầng API).
- Danh mục đang được sách sử dụng -> HTTP `409`; API không cho xóa dù FK của model đang là `ON DELETE SET NULL`.

### Static files
- Ảnh bìa: `/static/covers/...`
- PDF eBook: `/static/ebooks/...`

`GET /api/books` vẫn giữ nguyên theo source nhóm; không được dùng thay CRUD danh mục.

---

## 2. Cổng mặc định tránh xung đột

- Frontend: `5174`
- Backend: `8010`
- PostgreSQL host: `5433`

Nếu cổng bận, copy `.env.example` thành `.env` rồi đổi đồng bộ. Ví dụ backend đổi sang 8011 thì `VITE_API_URL` cũng phải là `http://localhost:8011`.

---

## 3. Chạy bằng Docker - cách khuyến nghị

### Bước 1: vào đúng thư mục có `docker-compose.yml`
Nếu ZIP giải nén thành thư mục ngoài rồi mới tới `University-Digital-Library-main`, hãy `cd` vào `University-Digital-Library-main` trước.

### Bước 2: tạo `.env`
CMD:
```cmd
copy .env.example .env
```
PowerShell:
```powershell
Copy-Item .env.example .env
```

### Bước 3: khởi động
```cmd
docker compose up --build
```

Bản này tự động:
1. chờ PostgreSQL sẵn sàng;
2. chạy `alembic upgrade head`;
3. tạo tài khoản ADMIN phát triển nếu chưa có;
4. chạy FastAPI;
5. chỉ khởi động frontend sau khi API health-check thành công.

Không cần chạy migration thủ công khi dùng Docker.

### Địa chỉ
- Frontend: http://localhost:5174
- Swagger: http://localhost:8010/docs
- Health: http://localhost:8010/health

### ADMIN mặc định để test Swagger
- Username: `admin`
- Password: `Admin@123`

Có thể đổi bằng `ADMIN_USERNAME`, `ADMIN_PASSWORD` trong `.env` trước lần chạy đầu.

### Dừng
```cmd
docker compose down
```

Nếu cần xóa luôn database test để chạy sạch từ đầu:
```cmd
docker compose down -v
```
Sau đó:
```cmd
docker compose up --build
```

---

## 4. Test đăng nhập và Authorize Swagger

1. Mở `http://localhost:8010/docs`.
2. Chạy `POST /api/auth/login` với:
```json
{
  "username": "admin",
  "password": "Admin@123"
}
```
3. Response đúng trả `access_token`.
4. Bấm `Authorize` ở góc trên Swagger.
5. Với security kiểu `HTTPBearer`, dán **chỉ chuỗi token `eyJ...`**, không cần tự thêm chữ `Bearer`.
6. Bấm `Authorize`, rồi `Close`.
7. Test các API `/api/admin/categories`.

Sai username/password phải trả `401`, không còn lỗi `500`. Nếu database chưa sẵn sàng, login trả `503` với thông báo rõ thay vì `500`.

---

## 5. Test CRUD danh mục

### Tạo
`POST /api/admin/categories`
```json
{
  "category_name": "Công nghệ thông tin"
}
```
Kỳ vọng: `201`.

### Chuẩn hóa khoảng trắng
```json
{
  "category_name": "   Kinh   tế   "
}
```
Kết quả lưu: `Kinh tế`.

### Tên rỗng
```json
{
  "category_name": "    "
}
```
Kỳ vọng: `422`.

### Tên trùng
Tạo lại `Công nghệ thông tin` -> `409`.

### Danh sách
`GET /api/admin/categories` -> `200`.

### Chi tiết
`GET /api/admin/categories/{id}` -> `200`; ID không có -> `404`.

### Cập nhật
`PUT /api/admin/categories/{id}`:
```json
{
  "category_name": "Khoa học máy tính"
}
```
Tên trùng danh mục khác -> `409`.

### Xóa
`DELETE /api/admin/categories/{id}`:
- chưa có sách dùng -> `204`;
- đang có sách dùng -> `409`.

---

## 6. Chạy backend trực tiếp không Docker

Cần PostgreSQL đang chạy và DATABASE_URL đúng.

```powershell
cd back_fast_api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m alembic upgrade head
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="Admin@123"
python -m app.bootstrap_admin
python -m uvicorn app.main:app --reload --port 8010
```

Swagger: `http://127.0.0.1:8010/docs`.

---

## 7. Kiểm tra cổng

CMD:
```cmd
netstat -ano | findstr :8010
netstat -ano | findstr :5174
netstat -ano | findstr :5433
```

Nếu cổng bận, đổi trong `.env`; không cần sửa code.

---

## 8. File chính của nhiệm vụ Nhất

```text
back_fast_api/app/routers/admin_category_router.py
back_fast_api/app/schemas/category.py
back_fast_api/app/routers/admin_book_router.py
back_fast_api/app/services/upload_service.py
back_fast_api/app/main.py
```

Các file hỗ trợ chạy ổn định:
```text
back_fast_api/app/bootstrap_admin.py
back_fast_api/docker-entrypoint.sh
back_fast_api/Dockerfile
docker-compose.yml
.env.example
```

---

## 9. Cách nhanh nhất trên Windows - tự tránh xung đột cổng

Chỉ cần chạy:
```text
START_NHAT.cmd
```
Script sẽ tự tìm cổng đang trống cho frontend/backend/PostgreSQL, tạo `.env` đồng bộ và chạy `docker compose up --build`.

Nếu muốn xóa database test cũ rồi chạy lại từ đầu:
```text
RESET_DOCKER_NHAT.cmd
```
sau đó chạy lại `START_NHAT.cmd`.
