# Hướng dẫn chạy Library Management bằng Docker

## 1. Yêu cầu

- Windows 10/11 với Docker Desktop đã cài đặt và đang chạy.
- Mở PowerShell hoặc CMD tại thư mục gốc dự án (thư mục có `docker-compose.yml`).
- Kiểm tra Docker CLI:

```powershell
docker --version
docker compose version
```

Nếu lệnh `docker` không được nhận diện, hãy mở/cài Docker Desktop, đợi Docker Engine chạy, rồi mở terminal mới. Nếu vẫn lỗi, kiểm tra Docker Desktop đã được thêm vào PATH hoặc cài lại Docker Desktop; không tự thêm đường dẫn Docker vào PATH nếu chưa xác định đúng thư mục cài đặt.

## 2. Tạo cấu hình môi trường

Chỉ làm bước này nếu chưa có file `.env`:

```powershell
Copy-Item .env.example .env
```

Cấu hình mặc định trong `.env`:

| Thành phần | Địa chỉ từ máy tính |
|---|---|
| Giao diện web | http://localhost:5174 |
| API FastAPI | http://localhost:8010 |
| Swagger | http://localhost:8010/docs |
| PostgreSQL | `localhost:5433` |

Tài khoản ADMIN phát triển mặc định: `admin` / `Admin@123`. Đổi mật khẩu trong `.env` nếu cần. Không dùng mật khẩu mẫu này khi triển khai thật.

## 3. Khởi động

Chạy ở thư mục gốc dự án:

```powershell
docker compose up --build
```

Muốn chạy nền:

```powershell
docker compose up --build -d
```

Lần đầu Docker cần tải image và cài dependencies. API sẽ đợi PostgreSQL, chạy migration Alembic và tạo tài khoản ADMIN trước khi phục vụ request. Sau đó mở các địa chỉ ở bảng trên.

## 4. Kiểm tra trạng thái và log

```powershell
docker compose ps
docker compose logs -f api
docker compose logs -f db
docker compose logs -f web
```

Nhấn `Ctrl+C` để thoát theo dõi log. Kiểm tra nhanh API tại http://localhost:8010/health; kết quả mong đợi là `{"status":"ok"}`.

Tên container API là `libmanager_api`. Các lệnh Docker Compose vẫn dùng tên service `api`:

```powershell
docker compose exec api python -m app.bootstrap_admin
docker compose exec db psql -U lib_user -d libmanager_db
```

## 5. Đăng nhập Swagger và gọi API quản trị

1. Mở http://localhost:8010/docs.
2. Gọi `POST /api/auth/login` với JSON:

```json
{
  "username": "admin",
  "password": "Admin@123"
}
```

3. Sao chép `access_token` từ phản hồi.
4. Bấm **Authorize** ở phía trên Swagger, dán token rồi xác nhận.
5. Gọi API cần quyền ADMIN. CRUD danh mục nằm ở `/api/admin/categories`:
   - `POST` tạo;
   - `GET` danh sách;
   - `GET /{category_id}` xem chi tiết;
   - `PUT /{category_id}` cập nhật;
   - `DELETE /{category_id}` xóa.

### CRUD tồn kho sách

Các API bản sao sách theo danh sách dự án và cũng cần token ADMIN:

| Phương thức | Đường dẫn | Chức năng |
|---|---|---|
| `POST` | `/api/admin/books/{book_id}/copies` | Thêm bản sao bằng `copy_barcode`, `zone`, `floor`, `shelf` |
| `GET` | `/api/admin/books/{book_id}/copies` | Liệt kê bản sao của đầu sách; hỗ trợ lọc `status`, `skip`, `limit` |
| `GET` | `/api/admin/copies/{copy_id}` | Xem chi tiết bản sao (`copy_id` là barcode/RFID) |
| `PATCH` | `/api/admin/copies/{copy_id}/condition` | Cập nhật vị trí, trạng thái hoặc ghi chú hư hỏng |
| `DELETE` | `/api/admin/copies/{copy_id}` | Xóa bản sao chưa có lịch sử mượn |

Trạng thái hợp lệ: `AVAILABLE`, `BORROWED`, `DAMAGED`, `LOST`. API tự cập nhật `books.available_stock` khi bản sao chuyển vào/ra trạng thái `AVAILABLE`. Bản sao đã có lịch sử mượn không thể xóa; hãy chuyển trạng thái thay vì xóa.

## 6. Kết nối PostgreSQL

Dùng DBeaver/pgAdmin với cấu hình:

```text
Host: localhost
Port: 5433
Database: libmanager_db
Username: lib_user
Password: lib_password
```

Hoặc mở psql trong container:

```powershell
docker compose exec db psql -U lib_user -d libmanager_db
```

Trong psql, dùng `\dt` để liệt kê bảng và `\q` để thoát. Dữ liệu PostgreSQL được lưu trong Docker volume `postgres_data_nhat`, vì vậy vẫn còn sau khi dừng rồi khởi động lại container.

## 7. Dừng và xóa dữ liệu

Dừng các dịch vụ, giữ dữ liệu database:

```powershell
docker compose down
```

Xóa cả volume PostgreSQL và toàn bộ dữ liệu database:

```powershell
docker compose down -v
```

Chỉ chạy lệnh có `-v` khi thực sự muốn xóa database. Khởi động lại sau đó bằng `docker compose up --build`.

## 8. Xử lý lỗi thường gặp

### `docker` không được nhận diện

Docker Desktop chưa cài, chưa chạy, hoặc terminal chưa nhận PATH mới. Mở Docker Desktop, chờ Engine sẵn sàng rồi mở terminal mới và thử `docker --version`.

### Cổng đã được sử dụng

Đổi `BACKEND_PORT`, `FRONTEND_PORT` hoặc `POSTGRES_PORT` trong `.env`, rồi chạy lại:

```powershell
docker compose up --build -d
```

Nếu đổi `BACKEND_PORT`, cập nhật `VITE_API_URL` trong `.env` theo cổng mới, ví dụ `http://localhost:8011`.

### API không khởi động

Xem log API và database:

```powershell
docker compose logs --tail=100 api
docker compose logs --tail=100 db
```

Sau khi sửa cấu hình hoặc dependencies, build lại:

```powershell
docker compose up --build -d
```

### Muốn kiểm tra dữ liệu tài khoản

```powershell
docker compose exec db psql -U lib_user -d libmanager_db -c "SELECT id, username, role FROM accounts;"
```

Mật khẩu không được lưu dưới dạng văn bản thuần; database lưu chuỗi hash.
