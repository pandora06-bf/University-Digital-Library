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

Các địa chỉ sau khi khởi động (host map mặc định **8010**, tránh đụng cổng 8000):

- API: <http://localhost:8010>
- Swagger: <http://localhost:8010/docs>
- Kiểm tra trạng thái: <http://localhost:8010/health>

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
- `GET /api/wallet`: lấy số dư ví dịch vụ của người dùng đang đăng nhập.
- `GET /api/wallet/transactions`: xem lịch sử giao dịch ví.
- `POST /api/wallet/topups`: tạo yêu cầu nạp tiền và thông tin QR.
- `GET /api/wallet/topups/{pay_code}`: xem trạng thái yêu cầu nạp tiền.
- `POST /api/webhooks/bank`: nhận thông báo giao dịch từ ngân hàng.
- `POST /api/dev/topups/{pay_code}/simulate`: giả lập ngân hàng báo có; mặc định tắt.

## Quy trình API ví và nạp tiền

### Cách chạy

Từ thư mục gốc repository, khởi động Docker Compose:

```powershell
docker compose up --build -d
```

Compose khởi động PostgreSQL, API và scheduler; API tự áp dụng Alembic migration
khi khởi động. Nếu cần chạy migration thủ công:

```powershell
docker compose exec api python -m alembic upgrade head
```

API mặc định ở `http://localhost:8010`, Swagger ở
<http://localhost:8010/docs>. Khi chạy backend trực tiếp thay vì Docker, hãy làm
theo mục [Chạy backend trực tiếp trên máy](#chạy-backend-trực-tiếp-trên-máy);
các thiết lập như `ENABLE_DEV_SIMULATE` và `BANK_WEBHOOK_KEY` được đọc từ
`back_fast_api/.env`.

### Xác thực và lấy token

Các API ví và API mô phỏng yêu cầu JWT của người dùng. Đăng nhập bằng tài khoản
đã có trong database, sau đó dùng token trong header `Authorization: Bearer`.
Các lệnh dưới đây chạy trong PowerShell:

```powershell
$baseUrl = "http://localhost:8010"
$login = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/api/auth/login" `
  -ContentType "application/json" `
  -Body (@{
    username = "ten-dang-nhap"
    password = "mat-khau"
  } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.access_token)" }
```

### 1. Xem số dư — `GET /api/wallet`

```powershell
Invoke-RestMethod -Method Get -Uri "$baseUrl/api/wallet" -Headers $headers
```

Response gồm `user_code`, `balance` (VND) và `currency`.

### 2. Xem lịch sử — `GET /api/wallet/transactions`

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/api/wallet/transactions?page=1&size=20" `
  -Headers $headers
```

`page` bắt đầu từ 1; `size` mặc định là 20 và chấp nhận từ 1 đến 100. Response
có `data`, `total`, `page`, `size`; giao dịch mới nhất được trả về trước. Số tiền
dương là tiền vào, số tiền âm là tiền trừ khỏi ví.

### 3. Tạo yêu cầu nạp — `POST /api/wallet/topups`

Số tiền nạp hợp lệ mặc định từ 10.000 đến 500.000 VND. Endpoint trả HTTP 201
cùng `pay_code`, số tiền, trạng thái `PENDING`, thời điểm hết hạn, URL QR và
thông tin tài khoản ngân hàng.

```powershell
$topup = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/api/wallet/topups" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ amount = 50000 } | ConvertTo-Json)
$topup
```

Mở `qr_url` hoặc quét QR, rồi chuyển đúng số tiền vào tài khoản được trả về.
Nhập chính xác `pay_code` làm nội dung chuyển khoản để hệ thống tự nhận diện
yêu cầu. Mỗi yêu cầu có thời hạn mặc định 15 phút.

### 4. Kiểm tra yêu cầu — `GET /api/wallet/topups/{pay_code}`

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/api/wallet/topups/$($topup.pay_code)" `
  -Headers $headers
```

Chỉ chủ sở hữu yêu cầu mới xem được. Trạng thái thường gặp là `PENDING`, `PAID`
và `EXPIRED`; yêu cầu hết hạn được trả về `EXPIRED` ngay cả khi scheduler chưa
cập nhật. Nếu ngân hàng báo có sau thời hạn, khoản tiền thực nhận vẫn được ghi
nhận cho yêu cầu đó.

### 5. Nhận webhook ngân hàng — `POST /api/webhooks/bank`

Ngân hàng gửi webhook đến API này sau khi nhận chuyển khoản. Endpoint không dùng
JWT người dùng; cần gửi khóa webhook được cấu hình trong `BANK_WEBHOOK_KEY` qua
header `x-api-key` hoặc `Authorization: Apikey <khóa>`. Ví dụ payload tương thích
với SePay:

```powershell
$webhookKey = "<BANK_WEBHOOK_KEY đã cấu hình cho backend>"
$bankHeaders = @{ Authorization = "Apikey $webhookKey" }
$event = @{
  id = "BANK-TX-001"
  transferAmount = 50000
  content = "Chuyen tien $($topup.pay_code)"
  transferType = "in"
  subAccount = "<BANK_ACCOUNT_NO hoặc VA đã cấu hình>"
}
Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/api/webhooks/bank" `
  -Headers $bankHeaders `
  -ContentType "application/json" `
  -Body ($event | ConvertTo-Json)
```

Backend chỉ xử lý giao dịch vào đúng tài khoản nhận đã cấu hình. Mã nạp được tìm
trong `code`, `content` hoặc `description`. Kết quả `MATCHED` đánh dấu yêu cầu
`PAID` và cộng số tiền thực nhận vào ví; gửi lại cùng mã giao dịch ngân hàng sẽ
trả `DUPLICATE`, không cộng tiền lần nữa. Nội dung không khớp yêu cầu được lưu
thành `UNMATCHED`; giao dịch chuyển ra hoặc sai tài khoản được `IGNORED`. Webhook
hợp lệ trả HTTP 200 để ngân hàng không retry vô ích.

### 6. Giả lập nạp tiền — `POST /api/dev/topups/{pay_code}/simulate`

Chỉ dùng cho phát triển/kiểm thử; endpoint mặc định bị tắt. Khi dùng Docker
Compose, thêm `ENABLE_DEV_SIMULATE=true` vào file `.env` ở thư mục gốc rồi tạo
lại container API:

```powershell
docker compose up -d --force-recreate api
```

Khi chạy backend trực tiếp, đặt `ENABLE_DEV_SIMULATE=true` trong
`back_fast_api/.env` rồi khởi động lại backend. Sau khi tạo yêu cầu nạp như bước
3, gọi:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/api/dev/topups/$($topup.pay_code)/simulate" `
  -Headers $headers
```

Endpoint cần JWT của đúng người sở hữu yêu cầu, không nhận body. Nó gọi cùng
luồng xử lý với webhook thật nhưng không yêu cầu chuyển khoản; gọi lại sẽ trả
`DUPLICATE`. Đặt lại `ENABLE_DEV_SIMULATE=false` sau khi kiểm thử và không bật
endpoint này trên môi trường thật.

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

## Cổng riêng của bản Nhất 05/10

Để tránh xung đột với backend khác đang dùng cổng 8000, khi chạy trực tiếp có thể dùng:

```powershell
python -m uvicorn app.main:app --reload --port 8010
```

Swagger: <http://127.0.0.1:8010/docs>

Khi chạy toàn bộ bằng Docker Compose, bản này mặc định dùng host ports 8010 (API), 5174 (frontend), 5433 (PostgreSQL). Có thể đổi bằng `.env` ở thư mục gốc, xem `RUN_NHAT.md`.
