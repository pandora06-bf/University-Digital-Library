# Library Management Backend - FastAPI

Bộ khung Backend cho đồ án Công nghệ Phần mềm.

## Chức năng hiện có
- FastAPI app
- CORS cho ReactJS/Vite
- Cấu trúc `routers`, `schemas`, `core`, `models`, `services`
- Health-check API
- Router mẫu: Auth, Books, Users, Loans
- Cấu hình sẵn cho PostgreSQL, JWT và token 2 giờ

## Cấu trúc

```text
back_fast_api/
├── alembic/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   └── security.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── books.py
│   │   ├── users.py
│   │   └── loans.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── book.py
│   │   ├── user.py
│   │   └── loan.py
│   ├── models/
│   └── services/
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

## Cách chạy

### 1. Tạo môi trường ảo
```bash
python -m venv venv
```

Windows:
```bash
venv\Scripts\activate
```

### 2. Cài thư viện
```bash
pip install -r requirements.txt
```

### 3. Tạo file `.env`
Sao chép `.env.example` thành `.env`.

### 4. Chạy server
```bash
uvicorn app.main:app --reload
```

### 5. Kiểm tra
- API: http://127.0.0.1:8000
- Swagger: http://127.0.0.1:8000/docs
- Health Check: http://127.0.0.1:8000/health

## API mẫu
- `GET /`
- `GET /health`
- `GET /api/auth/test`
- `GET /api/books`
- `GET /api/users`
- `GET /api/loans`

## CORS
Đã cho phép:
- `http://localhost:3000`
- `http://localhost:5173`

## CƠ SỞ DỮ LIỆU
### 1. Khởi tạo và quản lý CSDL

Dự án sử dụng Alembic để đồng bộ cấu trúc bảng tự động:
* Áp dụng toàn bộ migration vào Database (Chạy lệnh này sau khi clone code về):
```bash
python -m alembic upgrade head
```
* **Tạo migration mới khi có cập nhật trong `app/models/`:**
```bash
python -m alembic revision --autogenerate -m "ten_mo_ta_thay_doi"
```
* **Quay lui (Rollback) 1 phiên bản migration gần nhất:**
```bash
python -m alembic downgrade -1
```
### 2. Cấu trúc CSDL
Thư mục app/models/ tổ chức theo 4 phân hệ nghiệp vụ chính:
* Users & Auth (user.py): Quản lý tài khoản đăng nhập (accounts) và thông tin chi tiết bạn đọc/nhân viên (users).
* Books & Inventory (book.py): Quản lý danh mục (categories), chủ đề (subjects), đầu sách (books), sách điện tử (ebooks) và bản sao sách vật lý (book_copies).
* Loans & Waitlists (loan.py): Quản lý quá trình mượn - trả sách (loans) và danh sách hàng đợi đặt trước (waitlists).
* Fines & Payments (fine.py): Quản lý phạt quá hạn/hư hỏng (fines) và lịch sử thanh toán tiền phạt (fine_payments).
