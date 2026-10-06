# BÁO CÁO TIẾN ĐỘ TRIỂN KHAI CNPM — FRONTEND USER (ĐẠT)

**Cập nhật lần cuối:** 16/09/2026  
**Tham chiếu:** `docs/Prompt_Antigravity_CNPM_Dat.md`  
**Nhánh Git:** `main` | **Frontend:** `libmanager-frontend/` | **Dev Server:** `http://localhost:5173/`

---

## 1. Tóm tắt tiến độ tổng thể

| Chặng | Hạng mục | Trạng thái | Ghi chú |
| :--- | :--- | :---: | :--- |
| **Chặng A** | Hoàn thiện phần còn thiếu của P0 & Component dùng chung | **HOÀN THÀNH (100%)** | Đã sửa sạch lỗi lint, chuẩn hóa token, tải font Inter thật, nâng cấp Button, Input, Table giữ 100% hợp đồng cũ; trang Dev UI Kit sẵn sàng |
| **Chặng B** | Đưa giao diện User về đúng Figma & Mock Interactions | **HOÀN THÀNH (100%)** | Hoàn thiện 6 route chính (Login, Home, Catalog, Book Detail, My Books, Reader) + 404 + Dev UI Kit. Mock Store hoạt động thời gian thực |
| **Chặng C** | Hiệu ứng Motion theo Figma & Video tham chiếu | **HOÀN THÀNH (100%)** | Đã cài `motion`, triển khai `CursorRipple`, `HeroParallax`, `ScrollReveal`, `PageTransition`, hỗ trợ `prefers-reduced-motion` |

---

## 2. Chi tiết từng hạng mục

### Chặng A: Nền tảng P0 & Bộ 3 Component dùng chung của Vân
- [x] **A1. Nền dự án & Cấu hình:**
  - Cập nhật `index.html`: ngôn ngữ tiếng Việt (`lang="vi"`), tiêu đề `LibManager — Cổng Thư viện Số TDTU`.
  - Tải Google Fonts Inter thật (weights 400, 500, 600, 700) hỗ trợ tiếng Việt.
  - Cấu trúc thư mục: `components/`, `components/motion/`, `layouts/`, `mocks/`, `pages/`, `styles/`.
- [x] **A2. Hệ thông số dùng chung (Tokens & Typography):**
  - Tạo `src/styles/tokens.css` tích hợp Tailwind v4 với biến CSS Figma: màu nền canvas/surface/subtle, màu chữ primary/secondary/muted/brand, dải gradient thương hiệu chàm-cyan (`#312E81`, `#4F46E5`, `#0E7490`).
  - Lớp typography chuẩn hóa: `text-display-lg` (48/56/600), `text-headline-lg` (32/40/600), `text-title-lg` (24/32/600), `text-title-md` (18/24/600), `text-body-lg` (16/24/400), `text-body-md` (14/20/400), `text-label-md` (12/16/500).
- [x] **A3. Nâng cấp 3 Component của Vân (Giữ 100% hợp đồng cũ):**
  - `Button.jsx`: Giữ named/default export, 4 variant (primary, outline, ghost, danger), alias `secondary` -> `outline`, chuẩn hóa size `md` thành 48px với font 18/24/600 theo Figma, bổ sung prop `loading`, `aria-busy`, vô hiệu hóa click chống submit kép.
  - `Input.jsx`: Dùng `useId()` tự sinh ID duy nhất, liên kết `label htmlFor`, hỗ trợ `aria-invalid`, `aria-describedby`, padding tính toán chuẩn xác cho các vị trí icon, typography 12/16/500 cho label và 14/20px cho helper/error.
  - `Table.jsx`: Triển khai prop `columns` thật hỗ trợ Custom Columns cho User Portal, giữ nguyên Preset 7 cột tồn kho của Vân khi không truyền `columns`, tách `DEFAULT_MOCK_DATA` sang `src/mocks/tableMock.js`, an toàn tuyệt đối với `data = null/[]`, bổ sung prop `loading`, `emptyMessage`, `colSpan` động.
- [x] **A4. Trang Dev UI Kit & Tài liệu bàn giao:**
  - Đã tạo `src/pages/dev/UiKitPage.jsx` (đường dẫn `/dev/ui-kit`) kiểm thử đầy đủ các trạng thái của 3 component.
  - Đã lập tài liệu bàn giao chi tiết `docs/UI_HANDOFF_DAT_VAN.md`.

---

### Chặng B: Giao diện User theo Figma & Mock Interactions
- [x] **B1. Cấu trúc nền & Mock Data:**
  - Mock Store tập trung: `src/mocks/auth.js`, `src/mocks/books.js`, `src/mocks/loans.js` (đồng bộ `sessionStorage`).
  - Component `BookCard.jsx`: padding 16px, radius 20px, font tiêu đề 24/32/600, tách biệt link xem chi tiết và nút mượn sách.
  - `UserLayout.jsx`: Header desktop 128px, responsive mobile 72px, bottom navigation 84px cho mobile.
- [x] **B2. Hoàn thiện các Màn hình (Pages):**
  - `Login.jsx`: Chuẩn Figma 2 vùng (Desktop 1440 panel trái 720px + card phải 430px radius 28px; Mobile 390 banner trên 320px + card dưới 358px đè 72px radius 24px).
  - `HomePage.jsx`: Hero 1344×320px gradient chàm-cyan, Sách mới, Sách mượn nhiều nhất, thao tác mượn sách realtime kèm toast notification.
  - `CatalogPage.jsx`: Tìm kiếm realtime, bộ lọc thể loại chips, lọc sách có sẵn, grid sách thích ứng.
  - `BookDetailPage.jsx`: Thông số chi tiết sách, ISBN, vị trí kệ, bản sao, tóm tắt nội dung và nút mượn sách.
  - `MyBooksPage.jsx`: Bảng phiếu mượn dùng `Table` custom columns cho desktop và danh sách thẻ cho mobile, nút đọc trực tuyến, hoàn trả sách.
  - `PdfReaderPage.jsx`: Giao diện đọc PDF mô phỏng chuẩn bảo vệ bản quyền, toolbar điều hướng, chuyển trang, zoom, watermark số.
  - Cấu hình Router hoàn chỉnh trong `App.jsx`.

---

### Chặng C: Hiệu ứng Motion theo Figma & Video tham chiếu
- [x] Cài đặt gói `motion` (`npm install motion`).
- [x] `constants.js`: Khai báo thông số motion chuẩn hóa theo Figma trang 06.
- [x] `CursorRipple.jsx`: scale 0.4 → 1, opacity 0.18 → 0, 420ms ease-out, giới hạn 12 ripple, throttle 60ms / 20px, tích hợp trên Login brand panel và Home Hero banner.
- [x] `HeroParallax.jsx`: Dịch chuyển nhẹ cụm hình collage 440×240px 6–10px với spring physics mượt mà.
- [x] `ScrollReveal.jsx`: Kích hoạt khi 15% phần tử vào viewport, y 24 → 0px, opacity 0 → 1, 480ms ease-out.
- [x] Stagger (delay 50-60ms) cho các nhóm BookCard trên Home và Catalog.
- [x] `PageTransition.jsx`: Chuyển trang fade + dịch nhẹ (desktop 250ms, mobile 220ms).
- [x] Hỗ trợ tiếp cận `prefers-reduced-motion: reduce` trên toàn bộ component motion.

---

## 3. Kết quả Kiểm tra Kỹ thuật

- **`npm run lint`**: **0 errors, 0 warnings** (PASS)
- **`npm run build`**: **Biên dịch thành công trong ~590ms** (PASS)
- **Dev Server**: Đang hoạt động ổn định tại `http://localhost:5173/` (HTTP 200)
