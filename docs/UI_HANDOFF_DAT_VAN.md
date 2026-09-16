# TÀI LIỆU BÀN GIAO GIAO DIỆN & COMPONENT DÙNG CHUNG (ĐẠT ↔ VÂN)

**Dự án:** LibManager — Hệ thống Thư viện Số  
**Người lập:** Đạt (Phụ trách Frontend User)  
**Người nhận:** Vân (Phụ trách Frontend Admin)  
**Ngày cập nhật:** 15/09/2026  
**Trạng thái:** Hoàn thiện Chặng A (P0 & Shared Components)

---

## 1. Tổng quan & Nguyên tắc đồng bộ

Để đảm bảo giao diện thống nhất giữa Cổng Người dùng (User Portal) và Cổng Quản trị (Admin Portal), toàn bộ mã nguồn của 3 component nền tảng mà Vân đã xây dựng (`Button.jsx`, `Input.jsx`, `Table.jsx`) đã được giữ nguyên cấu trúc, kiểu export (`named` và `default`), đồng thời mở rộng tính năng và chuẩn hóa theo hệ thống Design Tokens và Figma.

> [!IMPORTANT]
> **Không tạo bộ component riêng:** Đạt và Vân cùng sử dụng chung `src/components/Button.jsx`, `src/components/Input.jsx` và `src/components/Table.jsx`. Mọi nâng cấp đều tương thích ngược 100% với code Admin hiện tại của Vân.

---

## 2. Hệ thông số Design Tokens & Typography

File định nghĩa tập trung: `src/styles/tokens.css` (được import vào `src/index.css`).

### 2.1. Bảng màu chuẩn (Color Tokens)

| Token CSS | Giá trị Hex | Ứng dụng |
| :--- | :--- | :--- |
| `--color-bg-canvas` | `#F6F8FC` | Nền tổng thể toàn trang |
| `--color-bg-surface` | `#FFFFFF` | Nền thẻ (Card), Bảng (Table), Modal |
| `--color-bg-subtle` | `#EEF2F7` | Nền phụ, hover nhẹ, border nhạt |
| `--color-bg-brand` | `#4F46E5` | Màu thương hiệu chính (Indigo-600) |
| `--color-bg-brand-hover` | `#3730A3` | Hover nút thương hiệu |
| `--color-bg-brand-soft` | `#EEF2FF` | Nền tag, badge, highlight nhẹ |
| `--color-text-primary` | `#172033` | Chữ chính (đậm, tương phản cao) |
| `--color-text-secondary` | `#5B6B82` | Chữ phụ, nhãn (Label), mô tả |
| `--color-text-muted` | `#667085` | Chữ gợi ý, placeholder, ghi chú |
| `--color-text-brand` | `#3730A3` | Chữ mang màu thương hiệu |
| `--color-border-default` | `#D9E2EE` | Đường viền mặc định cho card, input, table |
| `--color-border-focus` | `#3B82F6` | Viền khi focus (Blue-500) |
| `--gradient-brand` | `linear-gradient(135deg, #312E81 0%, #4F46E5 52%, #0E7490 100%)` | Dải màu thương hiệu Hero / Login |

### 2.2. Bảng Typography chuẩn hóa theo Figma

| Class Utility | Font size | Line height | Weight | Letter spacing | Vị trí sử dụng |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `text-display-lg` | 48px | 56px | 600 | -1.0px | Tiêu đề Hero Desktop |
| `text-headline-lg` | 32px | 40px | 600 | -0.4px | Tiêu đề trang, H1 section, Mobile Hero |
| `text-title-lg` | 24px | 32px | 600 | 0px | Tiêu đề BookCard, Card tiêu đề |
| `text-title-md` | 18px | 24px | 600 | 0px | **Button size `md`**, NavItem, Subheading |
| `text-body-lg` | 16px | 24px | 400 | 0px | Nội dung bài viết, tóm tắt sách chính |
| `text-body-md` | 14px | 20px | 400 | 0px | Input value, helper text, table data |
| `text-label-md` | 12px | 16px | 500 | +0.3px | **Input Label**, StatusChip, Badge nhỏ |

---

## 3. Chi tiết thay đổi trên từng Component dùng chung

### 3.1. `Button.jsx`

#### Bảng so sánh Trước ↔ Sau nâng cấp:
| Thuộc tính | Trước nâng cấp (Vân) | Sau nâng cấp (Đạt hoàn thiện) | Lưu ý cho Vân |
| :--- | :--- | :--- | :--- |
| **Size `md` font** | `text-base` (16px) | `text-[18px] leading-6 font-semibold` | Đồng bộ chuẩn Figma 18/24/600 cho cả User và Admin. Chiều cao vẫn giữ nguyên 48px (`h-12`). |
| **Figma Secondary** | Chưa hỗ trợ `secondary` | Hỗ trợ alias `variant="secondary"` tự động trỏ về `outline` | Nút `outline` nền trắng, viền `#3B82F6`, chữ `#3730A3` |
| **Prop `loading`** | Chưa có | Bổ sung `loading={true/false}` | Tự hiện SVG spinner quay, tự động kích hoạt `disabled` và `aria-busy`, chống spam click |
| **Import React** | `import React from 'react'` (gây lỗi lint) | Đã gỡ bỏ import thừa | Sạch lint `no-unused-vars` |
| **Xuất Component** | Có cả named và default | Vẫn giữ cả named (`export const Button`) và default (`export default Button`) | Không ảnh hưởng bất kỳ file import nào của Vân |

#### Ví dụ sử dụng:
```jsx
import { Button } from './components/Button';
// hoặc: import Button from './components/Button';

// Nút Primary
<Button variant="primary" size="md">Lưu dữ liệu</Button>

// Nút Secondary theo Figma (ánh xạ vào outline)
<Button variant="outline" size="md">Hủy bỏ</Button>
<Button variant="secondary" size="md">Hủy bỏ</Button>

// Nút Đang xử lý (Loading)
<Button variant="primary" loading={isSubmitting}>Đang lưu...</Button>
```

---

### 3.2. `Input.jsx`

#### Bảng so sánh Trước ↔ Sau nâng cấp:
| Thuộc tính | Trước nâng cấp (Vân) | Sau nâng cấp (Đạt hoàn thiện) | Lưu ý cho Vân |
| :--- | :--- | :--- | :--- |
| **ID & Label htmlFor** | Cần truyền `id` thủ công, nếu thiếu sẽ không liên kết | Sử dụng React `useId()` tự sinh ID duy nhất và ổn định | Bấm vào label sẽ tự động focus vào input ngay cả khi không truyền `id` |
| **Typography** | `text-xs font-semibold` | Chuẩn hóa `text-[12px] leading-[16px] font-medium tracking-[0.3px]` theo Figma | Giao diện thanh lịch, chuyên nghiệp hơn |
| **Aria Accessibility** | Chưa có | Tự động sinh `aria-invalid` và `aria-describedby` liên kết error/helper | Đáp ứng chuẩn tiếp cận WCAG |
| **Padding icons** | Cơ bản | Tính toán độc lập cho 4 trường hợp: không icon, icon trái, icon phải, cả 2 icon | Chữ không bao giờ bị đè lên icon |

#### Ví dụ sử dụng:
```jsx
import { Input } from './components/Input';

<Input
  label="Mã sách barcode"
  placeholder="BC-2026-..."
  required
  error={formError}
  helperText="Quét barcode hoặc nhập bằng tay"
  leftIcon={<Search className="w-4 h-4" />}
/>
```

---

### 3.3. `Table.jsx`

#### Bảng so sánh Trước ↔ Sau nâng cấp:
| Thuộc tính | Trước nâng cấp (Vân) | Sau nâng cấp (Đạt hoàn thiện) | Lưu ý cho Vân |
| :--- | :--- | :--- | :--- |
| **Cột tùy biến (`columns`)** | Nhận `columns` nhưng không dùng, luôn hiện 7 cột tồn kho | Triển khai prop `columns` thật: `{ key, header, render, align }` | User Portal có thể render bảng phiếu mượn với số cột tùy biến |
| **Preset 7 cột gốc của Vân** | Cố định | **Vẫn giữ nguyên 100%**: Khi không truyền `columns`, bảng tự động hiển thị 7 cột tồn kho kèm nút Sửa/Xóa của Vân | Các trang Admin của Vân gọi `<Table onEdit={...} onDelete={...} />` vẫn hoạt động nguyên vẹn |
| **Dữ liệu mẫu (`DEFAULT_MOCK_DATA`)** | Viết cứng trong file component | Tách sang `src/mocks/tableMock.js` | Giữ code gọn gàng, tránh tải thừa data khi User dùng bảng khác |
| **An toàn dữ liệu** | `data=null` gây crash `data.length` | Chuẩn hóa `null/undefined` thành `[]` an toàn | Không bao giờ bị crash trắng trang |
| **Trạng thái Loading** | Chưa có | Thêm prop `loading={true/false}` kèm spinner và `colSpan` động | Trải nghiệm mượt mà khi fetch dữ liệu từ API |

#### Ví dụ sử dụng:
```jsx
import { Table, StatusBadge } from './components/Table';

// 1. Dành cho Vân (Admin giữ nguyên cách dùng cũ):
<Table
  title="Danh sách đầu sách trong kho"
  onEdit={(row) => handleEdit(row)}
  onDelete={(row) => handleDelete(row)}
/>

// 2. Dành cho Đạt (User Portal với cột tùy biến):
const myColumns = [
  { key: 'code', header: 'Mã phiếu' },
  { key: 'bookTitle', header: 'Tên tài liệu' },
  { key: 'status', header: 'Trạng thái', render: (val) => <StatusBadge status={val} type="success" /> }
];

<Table
  title="Sách đang mượn"
  columns={myColumns}
  data={userLoans}
  loading={isLoading}
/>
```

---

## 4. Kiểm thử và Môi trường Dev UI-Kit

Đạt đã xây dựng trang xem thử toàn diện tại đường dẫn:
👉 **`/dev/ui-kit`** (chỉ hiển thị ở chế độ phát triển `DEV`).

Tại trang này, Vân có thể trực tiếp kiểm tra:
1. Tất cả các biến thể và kích thước của `Button` (bao gồm hiệu ứng click thử `loading`).
2. Tất cả các trường hợp của `Input` (label, helper, error, disabled, icon).
3. Cả 2 chế độ của `Table` (Preset 7 cột của Vân và Custom columns của User, kèm trạng thái Loading và Bảng rỗng).

---

## 5. Lưu ý cho Vân khi tích hợp Trang Admin

1. **Kiểm tra Layout Admin:** Do mã nguồn các trang quản trị chuyên sâu của Admin chưa được push vào repo này, Vân hãy kiểm tra lại layout các trang Admin khi kéo bản cập nhật này về để đảm bảo độ rộng các nút `size="md"` (do font tăng lên 18px theo Figma) hiển thị cân đối.
2. **Preset Table:** Toàn bộ dữ liệu 4 dòng mẫu và 7 cột của Vân vẫn được giữ nguyên mặc định. Vân có thể chuyển dần sang truyền `data` thực tế từ API backend bất cứ lúc nào.
