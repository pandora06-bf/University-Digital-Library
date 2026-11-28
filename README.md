# LibManager — Cổng Thư viện Số Đại học Tôn Đức Thắng (TDTU)

Dự án phát triển Hệ thống Quản lý Thư viện Số (LibManager) phục vụ học phần Công nghệ Phần mềm (CNPM).

- **Frontend User (Cổng Độc giả):** Đạt phụ trách
- **Frontend Admin (Cổng Quản trị):** Vân phụ trách
- **Backend:** FastAPI (`back_fast_api/library_backend_fastapi/`)

---

## 1. Hướng dẫn cài đặt & Khởi chạy Frontend

### Yêu cầu môi trường:
- Node.js: `^20.19.0 || >=22.12.0`
- Quản lý gói: `npm`

### Các bước thực hiện:
```bash
# 1. Di chuyển vào thư mục frontend
cd libmanager-frontend

# 2. Cài đặt các gói phụ thuộc (nếu chưa cài)
npm install

# 3. Khởi động máy chủ phát triển (Dev Server)
npm run dev
```
Truy cập ứng dụng tại: **[http://localhost:5173/](http://localhost:5173/)**

### Các lệnh kiểm tra chất lượng mã nguồn:
```bash
# Kiểm tra lỗi linting (ESLint)
npm run lint

# Biên dịch sản xuất (Production Build)
npm run build
```

---

## 2. Tài khoản đăng nhập

Web chạy thật: **https://libmanager-ecru.vercel.app** (dữ liệu dùng chung với Docker local).

| Vai trò | Tên đăng nhập | Mật khẩu | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Sinh viên** | `52400011` (hoặc MSSV mẫu khác: `52400001`, `52400013`…) | `User@123` | Không nợ; có phiếu chờ nhận và ví 120.000 ₫ |
| **Giảng viên** | `gv0004` (hoặc `gv0002`…) | `User@123` | Hạn mức 5 cuốn |
| **Thủ thư / Admin** | `admin` | Do nhóm quản lý (không ghi trong tài liệu) | Vào cổng `/admin` |

Danh sách đầy đủ tài khoản mẫu và trạng thái từng tài khoản: `docs/HUONG_DAN_THU_THU.md` (mục 1).
Chế độ mock (`VITE_USE_MOCK=true`, chỉ dùng cho CI/E2E): nhập tên bất kỳ; tên có chữ `admin`/`thuthu` vào cổng Admin.

---

## 3. Bản đồ các Tuyến đường (Routes)

- `/login`: Màn hình Đăng nhập chuẩn 2 vùng theo Figma Node `46:2` (desktop) & `66:2` (mobile).
- `/`: Trang chủ (Home Page) — Hero banner 1344×320px, Sách mới, Sách mượn nhiều nhất.
- `/catalog`: Danh mục Thư viện — Tìm kiếm thời gian thực, lọc theo thể loại, lọc sách có sẵn.
- `/books/:bookId`: Chi tiết sách — Tóm tắt nội dung, thông số ISBN, bản sao, vị trí kệ và thao tác mượn sách.
- `/my-books`: Sách của tôi — Bảng phiếu mượn (Desktop Table custom columns / Mobile Card list), nút đọc trực tuyến, trả sách.
- `/reader/:loanId`: Giao diện đọc PDF mô phỏng chuẩn bảo vệ bản quyền, watermark số, chuyển trang, zoom.
- `/dev/ui-kit`: **Trang kiểm thử Component Lab** (chỉ hiển thị ở chế độ DEV) để Đạt & Vân kiểm tra Button, Input, Table.

---

## 4. Bàn giao & Tài liệu kỹ thuật

- **Tài liệu bàn giao cho Vân:** [docs/UI_HANDOFF_DAT_VAN.md](docs/UI_HANDOFF_DAT_VAN.md)
  - Hệ thông số Design Tokens: `src/styles/tokens.css`
  - Typography Figma: Display-lg, Headline-lg, Title-lg, Title-md, Body-lg, Body-md, Label-md
  - Chi tiết nâng cấp 3 component dùng chung: `Button.jsx`, `Input.jsx`, `Table.jsx`
- **Báo cáo tiến độ chi tiết:** [docs/TIEN_DO.md](docs/TIEN_DO.md)

---

## 5. Ranh giới Tích hợp & Kế hoạch Sprint sau

1. **Backend FastAPI (`back_fast_api/`):**
   - `POST /api/auth/login` xác thực tài khoản bằng mật khẩu bcrypt và trả JWT; `GET /api/auth/me` yêu cầu Bearer token.
   - `GET /api/users` yêu cầu token của role `ADMIN`. Các dependency phân quyền nằm trong `app/core/dependencies.py`.
   - Chạy migration bằng `python -m alembic upgrade head`, sau đó tạo tài khoản qua `python -m app.cli create-account --username admin --role ADMIN` (nhập mật khẩu tương tác).
   - `GET /api/books` và `GET /api/loans` vẫn là API mẫu trả về danh sách rỗng.
2. **Mock Store thời gian thực (`src/mocks/`):**
   - Frontend hiện sử dụng `sessionStorage` đồng bộ các thao tác mượn sách, trả sách và tìm kiếm.
3. **Kế hoạch Sprint sau:**
   - Hoàn thiện endpoint `POST /api/loans` và kết nối luồng đăng nhập Frontend với Backend.
   - Nối thư viện `react-pdf` đọc file PDF thật từ server bảo mật.
