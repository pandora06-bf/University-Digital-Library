# Backend LibManager — FastAPI

Backend của hệ thống quản lý thư viện LibManager, dùng FastAPI, SQLAlchemy,
PostgreSQL và Alembic.

## Chức năng hiện có

- API kiểm tra trạng thái và các router mẫu cho xác thực, sách, người dùng, phiếu mượn.
- Đăng nhập bằng tài khoản trong bảng `accounts`; mật khẩu được băm bằng bcrypt.
- Cấp JWT có thời hạn 120 phút và xác thực qua header Bearer.
- Dependency kiểm tra tài khoản đang hoạt động và chặn API theo role.
- `GET /api/users` yêu cầu role `ADMIN`; `GET /api/auth/me` yêu cầu token hợp lệ.
- API sách và phiếu mượn hiện là mẫu, chưa kết nối dữ liệu nghiệp vụ.

## Cấu trúc thư mục

```text
back_fast_api/
├── alembic/                 # Migration tạo và cập nhật schema
├── app/
│   ├── cli.py                # Tạo tài khoản và nhập dữ liệu mock
│   ├── main.py               # Khởi tạo FastAPI, CORS và router
│   ├── core/
│   │   ├── config.py         # Cấu hình, DATABASE_URL, khóa JWT
│   │   ├── database.py       # SQLAlchemy engine và session
│   │   ├── dependencies.py   # Xác thực JWT và kiểm tra role
│   │   └── security.py       # Băm/xác minh bcrypt và tạo/đọc JWT
│   ├── models/               # Model tài khoản, bạn đọc, sách, phiếu mượn, tiền phạt
│   ├── routers/              # Endpoint theo nghiệp vụ
│   └── schemas/              # Dữ liệu request/response
└── requirements.txt
```

## Chạy bằng Docker Compose

Mở Docker Desktop. Tại thư mục gốc repository, chạy trong CMD hoặc PowerShell:

```console
docker compose up --build
```

Các địa chỉ sau khi khởi động:

- API: <http://localhost:8000>
- Swagger: <http://localhost:8000/docs>
- Kiểm tra trạng thái: <http://localhost:8000/health>

Nếu lệnh `docker` chưa có trong PATH của CMD, thêm đường dẫn Docker Desktop cho
cửa sổ hiện tại rồi chạy Compose:

```cmd
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin"
docker compose up --build
```

Trong PowerShell, dùng:

```powershell
$env:Path += ";$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin"
docker compose up --build
```

## Chạy backend trực tiếp trên máy

Yêu cầu Python 3.11 trở lên và PostgreSQL đang chạy. Mở terminal tại thư mục
`back_fast_api`:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Tạo file `back_fast_api/.env` với cấu hình phù hợp:

```dotenv
DATABASE_URL=postgresql+psycopg2://postgres:mat_khau@localhost:5432/libmanager_db
SECRET_KEY=thay-bang-khoa-bi-mat-dai-va-ngau-nhien
```

Áp dụng migration và chạy server:

```powershell
python -m alembic upgrade head
uvicorn app.main:app --reload
```

## Đổ dữ liệu vào database Auth

### Dùng dữ liệu mock hiện có

File `mocks/users_mock.json` chứa hồ sơ bạn đọc/nhân viên, **không có mật khẩu**.
Khi nạp mock, công cụ sẽ tạo tài khoản trong `accounts`, tạo hồ sơ tương ứng
trong `users`, liên kết hai bản ghi và hỏi một mật khẩu demo dùng chung. Mật khẩu
chỉ được lưu dưới dạng bcrypt hash.

1. Đảm bảo các container đang chạy và migration đã áp dụng:

   ```cmd
   docker compose up -d
   docker compose exec api alembic upgrade head
   ```

2. Từ thư mục gốc repository, nạp mock users:

   ```cmd
   docker compose exec -it api python -m app.cli seed-mock-users --source /data/mocks/users_mock.json
   ```

3. Nhập mật khẩu khi được hỏi. Có thể dùng `12345678` cho môi trường demo để
   khớp với tài khoản mẫu frontend. Lệnh tạo username từ email trong JSON.
   Ví dụ đăng nhập bằng `sinhvien@tdtu.edu.vn` và mật khẩu đã chọn.

Lệnh seed từ chối chạy nếu một tài khoản hoặc hồ sơ trong file đã tồn tại; không
xóa dữ liệu cũ. Để kiểm tra số tài khoản đã nạp:

```cmd
docker compose exec db psql -U lib_user -d libmanager_db -c "SELECT username, role FROM accounts ORDER BY id;"
```

### Nạp dữ liệu từ PostgreSQL thật

Có thể thay database mà không sửa các hàm đăng nhập, nếu database đích dùng schema
tương thích với model và migration của dự án:

1. Tạo file `.env` ở **thư mục gốc**, cạnh `docker-compose.yml`:

   ```dotenv
   DATABASE_URL=postgresql+psycopg2://app_user:mat_khau_da_url_encode@ten-may-chu:5432/library_db
   ```

   Nếu PostgreSQL chạy trên máy host Windows và API chạy trong Docker, dùng
   `host.docker.internal` làm `ten-may-chu`. Nếu database cũng là service trong
   Compose, dùng tên service làm hostname.

2. Khởi động lại API để nhận URL mới và áp dụng migration:

   ```cmd
   docker compose up -d --force-recreate api
   docker compose exec api alembic upgrade head
   ```

3. Nạp dữ liệu tài khoản và hồ sơ vào đúng bảng/cột. Auth yêu cầu:

   - `accounts.username`: tên đăng nhập; dự án mock dùng email.
   - `accounts.password`: bcrypt hash, tuyệt đối không phải mật khẩu rõ.
   - `accounts.role`: `STUDENT`, `LECTURER` hoặc `ADMIN`.
   - `accounts.is_active`: `true` để cho phép đăng nhập.
   - `users.account_id`: ID của bản ghi `accounts` tương ứng.
   - `users.user_code` và `users.email`: mã và email duy nhất của hồ sơ.

   Nạp dữ liệu giữ nguyên quan hệ `accounts.id` → `users.account_id`. Nếu mật
   khẩu nguồn đang ở dạng rõ hoặc dùng thuật toán hash khác, phải chuyển sang
   bcrypt trước khi nạp. Không đưa mật khẩu vào file mock, log hoặc repository.

Nếu database nguồn có tên bảng/cột hoặc quan hệ khác, hãy ánh xạ dữ liệu một lần
sang schema trên trước khi chạy ứng dụng. Khi schema và dữ liệu đã tương thích,
các hàm Auth có thể tiếp tục dùng nguyên trạng.

## API xác thực và phân quyền

### Đăng nhập

`POST /api/auth/login` nhận JSON:

```json
{
  "username": "sinhvien@tdtu.edu.vn",
  "password": "mat-khau-da-chon"
}
```

Response gồm `access_token`, `token_type` và thông tin tài khoản. Gửi token cho
các API cần xác thực trong header:

```http
Authorization: Bearer <access_token>
```

- `GET /api/auth/me`: cần token của tài khoản đang hoạt động.
- `GET /api/users`: cần token có role `ADMIN`.
- Không có token hoặc token sai/hết hạn: `401 Unauthorized`.
- Token hợp lệ nhưng role không đủ: `403 Forbidden`.

Khóa `SECRET_KEY` phải được đặt riêng cho từng môi trường và giữ kín. Không dùng
khóa mẫu trong môi trường thật.

## Danh sách endpoint

- `GET /`: thông tin backend và đường dẫn Swagger.
- `GET /health`: kiểm tra trạng thái API.
- `GET /api/auth/test`: kiểm tra router Auth.
- `POST /api/auth/login`: đăng nhập và nhận JWT.
- `GET /api/auth/me`: lấy tài khoản từ JWT hiện tại.
- `GET /api/books`: API sách mẫu, hiện trả danh sách rỗng.
- `GET /api/users`: API người dùng mẫu, chỉ role `ADMIN` truy cập.
- `GET /api/loans`: API phiếu mượn mẫu, hiện trả danh sách rỗng.

## CORS

Backend hiện cho phép các origin frontend sau:

- `http://localhost:3000`
- `http://localhost:5173`

## Migration database

Chạy trong thư mục `back_fast_api` (hoặc trong container API từ thư mục gốc):

```bash
python -m alembic upgrade head
```

Tạo migration sau khi model thay đổi:

```bash
python -m alembic revision --autogenerate -m "mo_ta_thay_doi"
```

Hoàn tác một migration gần nhất:

```bash
python -m alembic downgrade -1
```
