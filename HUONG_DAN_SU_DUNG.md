# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG LIBMANAGER (CỔNG ĐỘC GIẢ & COMPONENT LAB)

Tài liệu này hướng dẫn chi tiết cách khởi động, đăng nhập trải nghiệm các tính năng của Cổng Độc giả (User Portal), kiểm thử bộ 3 component dùng chung và quan sát các hiệu ứng chuyển động (Motion) theo đúng chuẩn Figma.

---

## 1. Cách khởi động Dự án

### Bước 1: Mở Terminal tại thư mục `libmanager-frontend`
Nếu đang ở thư mục gốc workspace, hãy gõ:
```bash
cd University-Digital-Library/libmanager-frontend
```

### Bước 2: Chạy Dev Server
```bash
npm run dev
```
Hệ thống sẽ chạy máy chủ phát triển tại: **[http://localhost:5173/](http://localhost:5173/)**

*(Ghi chú: Nếu Dev Server đã đang chạy sẵn trên máy của bạn, bạn có thể mở trực tiếp link trên trình duyệt mà không cần chạy lại).*

---

## 2. Tài khoản Đăng nhập Demo

Truy cập vào trang đăng nhập: **[http://localhost:5173/login](http://localhost:5173/login)**

Đăng nhập gọi API backend. Trên màn hình có nút **1-click điền** tài khoản ADMIN mẫu:

| Vai trò | Username | Mật khẩu | Chức năng chính |
| :--- | :--- | :--- | :--- |
| **Thủ thư / Admin** | `admin` | `Admin@123` | Cổng Quản trị (`/admin`) — tài khoản bootstrap backend / Docker `.env`. |

*(Các tài khoản `sinhvien@…` / `thuthu@…` trong mock cũ không còn dùng cho form login hiện tại.)*

> [!TIP]
> Bạn có thể bấm vào biểu tượng **Con mắt** ở ô mật khẩu để kiểm tra tính năng hiển thị/ẩn mật khẩu bằng nút bấm chuẩn tiếp cận (accessibility).

---

## 3. Hướng dẫn trải nghiệm các tính năng chính

### 3.1. Trang Chủ (Home Page) — `http://localhost:5173/`
- **Banner Hero (1344×320px):**
  - Di chuột qua vùng banner màu chàm-cyan để trải nghiệm **hiệu ứng gợn sóng con trỏ (Cursor Ripple)** lan tỏa mềm mại.
  - Quan sát cụm thẻ bài minh họa bên phải trôi nhẹ theo hướng chuột (**Hero Parallax**).
- **Thao tác mượn sách nhanh:**
  - Tại mục *"Tài liệu mới cập nhật"* hoặc *"Được mượn nhiều nhất"*, bấm nút **"Mượn sách"**.
  - Thông báo Toast màu xanh lá sẽ xuất hiện xác nhận mượn thành công. Số lượng bản sao còn lại trên thẻ sẽ tự động giảm đi 1 cuốn ngay lập tức.

---

### 3.2. Danh mục Thư viện (Catalog Page) — `http://localhost:5173/catalog`
- **Tìm kiếm thời gian thực:** Nhập từ khóa vào ô tìm kiếm (ví dụ: `React`, `Thuật toán`, `BC-2026`).
- **Bộ lọc thể loại (Chips):** Bấm chọn nhanh các chuyên ngành: *Công nghệ thông tin*, *Giáo trình ĐH*, *Kinh tế & Quản lý*, *Khoa học Công nghệ*, *Ngoại ngữ*.
- **Lọc sách có sẵn:** Tích chọn *"Chỉ hiện sách có sẵn"* để ẩn những cuốn đã hết bản sao.
- **Trang Chi tiết Sách:** Bấm nút **"Chi tiết"** trên bất kỳ thẻ sách nào để sang trang chi tiết (`/books/:id`), xem tóm tắt nội dung, mã ISBN, năm xuất bản và vị trí kệ sách trong thư viện.

---

### 3.3. Sách của tôi (My Books Page) — `http://localhost:5173/my-books`
- **Bảng Phiếu mượn cá nhân:**
  - Hiển thị danh sách các tài liệu bạn vừa mượn.
  - Sử dụng component `Table` với các cột tùy biến (Mã phiếu, Tên tài liệu, Ngày mượn, Hạn trả 14 ngày, Trạng thái).
- **Đọc sách trực tuyến:** Bấm nút **"Đọc online"** để chuyển sang giao diện trình đọc PDF.
- **Hoàn trả tài liệu:** Bấm nút **"Trả sách"** màu đỏ để hoàn trả. Trạng thái phiếu sẽ chuyển sang *"Đã trả"*, và số lượng sách trong kho thư viện sẽ tự động được cộng trả lại.

---

### 3.4. Trình đọc Sách PDF (PDF Reader) — `http://localhost:5173/reader/sample`
- **Giao diện đọc sách số:** Khung đọc toàn màn hình nền tối chuyên nghiệp.
- **Toolbar điều khiển:**
  - Nút chuyển trang (Trang trước / Trang sau) kèm hiển thị số trang hiện tại.
  - Bộ điều khiển thu phóng (Zoom In `+` / Zoom Out `-`).
  - Watermark chìm bảo vệ bản quyền số nội bộ của Đại học Tôn Đức Thắng.
  - Nút *"Quay lại"* đưa bạn trở về trang Sách của tôi.

---

## 4. Trang Lab Kiểm thử Component (`/dev/ui-kit`)

Đường dẫn trực tiếp: **[http://localhost:5173/dev/ui-kit](http://localhost:5173/dev/ui-kit)**  
*(Có thể bấm vào nút "UI-Kit Lab" trên thanh menu đầu trang)*

Trang này dùng để bạn và Vân kiểm tra kỹ thuật độc lập:
1. **Kiểm tra `Button`:**
   - Đầy đủ 4 biến thể: `primary`, `outline`, `ghost`, `danger` và alias `secondary`.
   - 3 kích thước: `sm` (36px), `md` (48px — chữ 18px), `lg` (56px).
   - **Nút bấm thử Loading:** Bấm nút *"Click thử Loading (2s)"* để thấy spinner quay mượt mà và nút tự động khóa chống spam click.
2. **Kiểm tra `Input`:**
   - Thử nghiệm click vào `label` xem có tự focus vào ô nhập không (nhờ cơ chế tự sinh ID qua `useId`).
   - Kiểm tra ô nhập có icon trái, icon phải, hiển thị lỗi màu đỏ (`error`) và dòng ghi chú (`helperText`).
3. **Kiểm tra `Table`:**
   - **Trường hợp 1:** Bảng Phiếu mượn của User (sử dụng prop `columns` tùy biến). Bấm nút *"Toggle Loading"* để xem trạng thái đang tải dữ liệu.
   - **Trường hợp 2:** Preset 7 cột tồn kho mặc định của Vân (gồm mã barcode, vị trí kệ, nút Sửa/Xóa).
   - **Trường hợp 3:** Bảng rỗng (Empty State an toàn).

---

## 5. Trải nghiệm Giao diện Di động (Mobile 390px)

1. Mở DevTools trên trình duyệt (phím `F12` hoặc chuột phải chọn *Inspect*).
2. Bật chế độ giả lập thiết bị (phím tắt `Ctrl + Shift + M`).
3. Chọn thiết bị **iPhone 14 / 15** hoặc chỉnh kích thước về **390 × 844 px**:
   - **Trang Đăng nhập:** Quan sát phần banner trên cao 320px và form đăng nhập đè lên 72px chuẩn Figma.
   - **Thanh Bottom Navigation:** Xuất hiện cố định ở đáy màn hình với chiều cao chuẩn 84px tại các trang Danh mục và Sách của tôi.
   - **Bảng mượn sách:** Tự động chuyển đổi mượt mà từ dạng Bảng sang danh sách Thẻ (Card list) dễ vuốt chạm trên điện thoại.

---

## 6. Các lệnh kiểm tra Mã nguồn

```bash
# Kiểm tra lỗi lint cú pháp (yêu cầu 0 error)
npm run lint

# Thử nghiệm đóng gói sản phẩm (Build production)
npm run build
```
Mọi thắc mắc hoặc cần bổ sung thêm chi tiết, bạn có thể xem thêm tại file [docs/UI_HANDOFF_DAT_VAN.md](docs/UI_HANDOFF_DAT_VAN.md) và [README.md](../README.md).
