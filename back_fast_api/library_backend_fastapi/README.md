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
library_backend_fastapi/
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
