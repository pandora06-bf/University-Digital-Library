# Huong dan chay docker

> **Du an:** University Digital Library  
> Tai lieu nay huong dan toan bo cach **khoi chay he thong bang Docker**, ket noi database, bom du lieu mau va hieu CI/CD pipeline.

---

## Checklist truoc khi bat dau

Dam bao may ban da co du cac cong cu sau:

| # | Cong cu | Kiem tra | Tai ve neu chua co |
|---|---|---|---|
| 1 | **Docker Desktop** | Mo app, thay bieu tuong ca voi o taskbar | https://www.docker.com/products/docker-desktop |
| 2 | **Git** | Go `git --version` trong terminal | https://git-scm.com |
| 3 | **Terminal** | PowerShell / CMD / Git Bash deu duoc | Co san tren Windows |

> **Quan trong:** Docker Desktop phai dang **chay** (trang thai xanh) truoc khi thuc hien bat ky lenh nao ben duoi.

---

## So do he thong

```
May tinh ban (host)
|
|-> localhost:5173  -->  [Container: libmanager_web]   ReactJS / Vite
|                               | goi API qua VITE_API_URL
|-> localhost:8000  -->  [Container: libmanager_api]   FastAPI / Uvicorn
|                               | ket noi DB qua DATABASE_URL
|-> localhost:5432  -->  [Container: libmanager_db]    PostgreSQL 15
```

Ba container nay duoc **Docker khoi dong va quan ly dependency giua chung** (api phu thuoc db, web phu thuoc api). Tuy nhien, api co the can vai giay de cho db san sang hoan toan.

---

## Cach chay he thong (Sprint 1)

### Buoc 1 – Lay code ve may

Mo terminal, chay lan luot:

```bash
git clone <URL_REPO_NHOM>
cd University-Digital-Library
```

> Thay `<URL_REPO_NHOM>` bang link GitHub thuc te cua nhom.

---

### Buoc 2 – Khoi dong toan bo he thong

Van trong thu muc `University-Digital-Library` (noi co file `docker-compose.yml`), chay:

```bash
docker compose up --build
```

**Chuyen gi xay ra luc nay?**
- Docker doc file `docker-compose.yml`
- Tu dong **tai image** PostgreSQL 15 tu Docker Hub
- Tu dong **build image** cho FastAPI va ReactJS tu cac `Dockerfile` trong repo
- Khoi dong 3 container theo dung thu tu

**Lan dau chay** mat khoang **3–8 phut** (tuy toc do mang).  
Cac lan sau chi mat **vai giay** vi Docker da co cache.

Khi terminal hien log nhu the nay la thanh cong:

```
libmanager_db   | database system is ready to accept connections
libmanager_api  | INFO:     Application startup complete.
libmanager_web  | VITE v5.x.x  ready in 300 ms
libmanager_web  | ->  Local:   http://localhost:5173/
```

> **Muon chay nen** (de terminal lam viec khac)? Them `-d`:
> ```bash
> docker compose up --build -d
> ```

---

### Buoc 3 – Mo trinh duyet va kiem tra

Sau khi chay thanh cong, truy cap cac dia chi sau:

| Dia chi | Xem gi |
|---|---|
| **http://localhost:5173** | Giao dien Web (ReactJS) |
| **http://localhost:8000** | API root (FastAPI) |
| **http://localhost:8000/docs** | Swagger UI – thu API truc tiep |
| **http://localhost:8000/redoc** | Tai lieu API dang dep hon |

> **Luu y:** Swagger UI (`/docs`) **khong phai container rieng** – FastAPI tu dong tao ra trang nay ben trong container `api`. Chi can container `api` dang chay la vao duoc.

---

### Buoc 4 – Ket noi Database (de xem du lieu)

Dung bat ky cong cu quan ly DB nao ban thich:

#### Thong tin ket noi (dung cho moi cong cu)

```
Host:      localhost
Port:      5432
Database:  libmanager_db
Username:  lib_user
Password:  lib_password
```

#### Ket noi bang DBeaver (pho bien nhat)

1. Mo DBeaver -> **New Database Connection**
2. Chon **PostgreSQL**
3. Dien thong tin nhu bang tren -> **Test Connection** -> **Finish**

#### Ket noi bang pgAdmin

1. Mo pgAdmin -> chuot phai **Servers** -> **Register -> Server**
2. Tab **General**: dat ten tuy y (vd: `LibManager Local`)
3. Tab **Connection**: dien thong tin nhu bang tren -> **Save**

#### Ket noi bang terminal (psql)

```bash
# Ket noi thang vao container DB
docker compose exec db psql -U lib_user -d libmanager_db

# Sau khi vao psql, thu vai lenh:
\dt          -- liet ke tat ca bang
\d users     -- xem cau truc bang users
SELECT * FROM books LIMIT 5;
\q           -- thoat
```

---

### Buoc 5 – Dung he thong

```bash
# Dung, giu nguyen du lieu (thuong dung)
docker compose down

# Dung + xoa toan bo du lieu, bat dau tu dau (dung khi muon reset)
docker compose down -v
```

---

## Du lieu gia tinh – `/mocks` (Sprint 1)

Thu muc `/mocks` chua **5 ban ghi mau** cho moi loai, dang JSON, de cac TV xem cau truc du lieu ma **khong can chay DB**:

### `mocks/books_mock.json`

```json
{
  "id": 1,
  "title": "React va Lap trinh Frontend Hien Dai",
  "author": "Robert C. Martin",
  "book_type": "PRINTED",
  "available_stock": 5,
  "category_id": 1,
  "subject_code": "IT",
  "created_at": "2023-10-01T10:00:00Z"
}
```

Truong `book_type` nhan 1 trong 3 gia tri: `PRINTED` | `EBOOK` | `BOTH`

### `mocks/users_mock.json`

```json
{
  "user_code": "SV20210001",
  "full_name": "Sinh Vien Demo",
  "user_type": "STUDENT",
  "max_borrow_limit": 3,
  "max_borrow_days": 14,
  "is_borrowing_blocked": false
}
```

**Tom tat 3 loai user:**

| `user_type` | Vai tro | Han muon | So sach toi da |
|---|---|---|---|
| `STUDENT` | Sinh vien | 14 ngay | 3 cuon |
| `LECTURER` | Giang vien | 30 ngay | 5 cuon |
| `ADMIN` | Thu thu | 30 ngay | 10 cuon |

> File `/mocks` **chi de tham khao cau truc**, khong tu import vao DB. Dung **Seeder** o duoi de bom du lieu that.

---

## Bom du lieu that vao Database – Seeder (Sprint 2)

`database_seeder.py` dung thu vien **Faker** (tieng Viet) de tao ngau nhien:
- **100 nguoi dung** (mix STUDENT / LECTURER)
- **100 cuon sach** + ban sao vat ly (BookCopy) voi ma barcode

### Cach chay Seeder (Khuyen nghi – chay trong Docker)

```bash
# Buoc 1: Dam bao he thong dang chay
docker compose up -d

# Buoc 2: Cho khoang 5 giay de DB san sang, roi chay seeder
docker compose exec api python database_seeder.py
```

**Ket qua thanh cong trong nhu the nay:**

```
Seeding Users...
Seeding Books...
Database seeded successfully with 100 users and 100 books!
```

### Du lieu tao ra

| Loai du lieu | So luong | Ghi chu |
|---|---|---|
| Nguoi dung (`Account` + `User`) | 100 | Mat khau mac dinh: `123456` |
| Sach (`Book`) | 100 | Loai PRINTED / EBOOK / BOTH ngau nhien |
| Ban sao sach (`BookCopy`) | ~300–500 | Ma barcode dang `BC-{id}-{copy}-{random}` |
| Danh muc (`Category`) | 5 | Khoa hoc, Van hoc, Lich su, Toan hoc, CNTT |
| Mon hoc (`Subject`) | 5 | IT, MATH, PHYS, CHEM, BIO |

> Seeder **an toan khi chay nhieu lan** – co kiem tra trung lap, khong tao du lieu thua.

---

## CI/CD Pipeline tu dong – GitHub Actions (Sprint 2)

File: `.github/workflows/ci-pipeline.yml`

Pipeline nay **tu dong chay** moi khi co `push` hoac `pull request` len nhanh `main` / `develop`, giup phat hien loi cu phap som truoc khi merge code.

### Pipeline gom 2 job chay song song

```
Khi push code len GitHub
        |
        |-> lint-backend  -> Kiem tra Python bang flake8
        |
        |-> lint-frontend -> Kiem tra React bang ESLint
```

### Job 1: Lint Backend (Python – flake8)

Kiem tra thu muc `./back_fast_api`:
- **Loi nghiem trong** (`E9`, `F63`, `F7`, `F82`): cu phap sai, import khong ton tai -> **Fail pipeline; co the chan merge neu repository cau hinh required status checks**
- **Canh bao** (dong > 120 ky tu, ham phuc tap): in ra de biet nhung **khong fail**

### Job 2: Lint Frontend (React – ESLint)

Kiem tra thu muc `./libmanager-frontend` voi Node.js 20 LTS.

### Xem ket qua pipeline

Vao **GitHub repo -> tab "Actions"** -> click vao lan chay gan nhat de xem chi tiet.

### Chay lint thu cong tren may (kiem tra truoc khi push)

**Backend:**
```bash
cd back_fast_api
pip install flake8
flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
```

**Frontend:**
```bash
cd libmanager-frontend
npm install
npm run lint
```

---

## Xu ly su co thuong gap

### Loi: `bind: address already in use` hoac `port is already allocated`

**Nguyen nhan:** Cong 5173, 8000 hoac 5432 dang bi ung dung khac chiem.

```bash
# Windows – tim PID dang dung cong 8000
netstat -ano | findstr :8000
# Ghi lai so PID, roi chay:
taskkill /PID <so_PID> /F

# Linux/Mac
lsof -ti :8000 | xargs kill -9
```

Sau do chay lai `docker compose up --build`.

---

### Loi: Vao `localhost:8000` thay "Connection refused"

**Nguyen nhan:** Container API chua khoi dong kip hoac bi loi.

```bash
# Xem log thuc te cua container api
docker compose logs api --tail=50

# Thu restart lai container api
docker compose restart api

# Xem tat ca container co dang chay khong
docker compose ps
```

---

### Loi: `ModuleNotFoundError: No module named 'faker'` khi chay seeder

**Nguyen nhan:** Thu vien `faker` hoac `bcrypt` chua co trong `requirements.txt` hoac chua duoc build vao image.
Cach fix dung chuan nhat la ban nen them `faker` vao file `back_fast_api/requirements.txt`, sau do build lai container:
```bash

docker compose build api
docker compose up -d
```
Hoac neu muon fix tam thoi ngay trong container:
```bash
docker compose exec api pip install faker bcrypt

docker compose exec api python database_seeder.py
```

---

### Muon xoa sach du lieu va bat dau lai tu dau

```bash
# CANH BAO: Lenh nay xoa TOAN BO du lieu trong DB
docker compose down -v

# Khoi dong lai he thong
docker compose up --build -d

# Bom du lieu moi
docker compose exec api python database_seeder.py
```

---

### Thay doi code nhung khong thay cap nhat

Backend (FastAPI) va Frontend (React) duoc cau hinh mount volumes va su dung lenh chay co ho tro hot-reload (`--reload` voi uvicorn va Vite dev server). Thay doi code tren may that se tu cap nhat.   
Neu khong thay cap nhat, thu:

```bash
# Theo doi log api lien tuc (Ctrl+C de thoat)
docker compose logs api -f

# Theo doi log web lien tuc
docker compose logs web -f
```
