# Prompt triển khai CNPM trong Antigravity — Đạt, Frontend User

Bản cập nhật 2 — dựa trên `CNPM(1).zip`, sau khi Đạt đồng bộ component Vân đã push lên Git. Dùng nội dung này thay cho prompt dựa trên `CNPM.zip` trước đó.

Bạn là agent phát triển frontend đang làm việc trong dự án CNPM của tôi. Tôi tên Đạt, phụ trách Frontend User. Vân phụ trách Frontend Admin và cùng tôi sử dụng bộ component, typography, màu sắc, spacing thống nhất.

Hãy đọc mã nguồn hiện tại, rồi trực tiếp triển khai theo ba chặng A → B → C dưới đây. Kiểm tra và sửa lỗi của mỗi chặng trước khi chuyển tiếp. Chặng A giải quyết các việc còn thiếu của P0; chặng B và C là phần mở rộng giao diện và hiệu ứng, không phải điều kiện để kết luận P0 khởi tạo dự án đã hoàn thành.

**Ba component của Vân đã có triển khai thật. Tiếp tục phát triển trên chính các file này, giữ named export/default export và các props đang sử dụng.** Các thay đổi được yêu cầu là tích hợp, sửa lỗi và mở rộng tương thích; không tạo một bộ Button/Input/Table khác cho User.

## 1. Nguồn tham chiếu và thứ tự ưu tiên

- Dự án frontend: `CNPM/libmanager-frontend`, hoặc thư mục hiện tại nếu tôi đã mở trực tiếp `libmanager-frontend`. Xác định bằng `package.json`; không tạo thêm một dự án Vite lồng bên trong.
- Backend đã có tại `CNPM/back_fast_api/library_backend_fastapi`. Đọc các router liên quan để hiểu hợp đồng hiện tại; nhiệm vụ triển khai lần này tập trung vào frontend và tài liệu tích hợp.
- Figma: [CNPM — User Portal](https://www.figma.com/design/6pJL328lnfKQyDaDxpgvWo/CNPM---User-Portal-Wireframe---Dat?node-id=13-7).
- Video: `docs/references/motion-reference.mp4` nếu có; file gốc có tên `1789318889364_180887867826163877_3719137712887627450.mp4`. Chỉ tìm trong project và các tệp tôi đính kèm cho cuộc trò chuyện này.
- Figma quyết định bố cục, nội dung, typography, màu sắc và component. Trang 06 của Figma quyết định các thông số motion đã ghi rõ. Video dùng để hiểu cách chuyển động, độ liên tục và cảm giác tương tác.
- Giao diện vẫn là cổng thư viện LibManager/TDTU với hệ màu chàm–cyan. Dùng nội dung, hình minh họa và nhận diện của Figma.

Nếu có quyền truy cập Figma qua MCP, hãy lấy design context và ảnh tham chiếu của từng màn hình trước khi triển khai, đọc component và variable liên quan. Chuyển reference code thành React JSX phù hợp dự án; dùng layout flex/grid responsive. Tải asset cần thiết về project vì URL xuất tạm thời có thể hết hạn. Các khung bìa sách trống có chủ đích trong wireframe có thể giữ theo thiết kế.

Nếu không đọc được Figma hoặc video, báo rõ nguồn nào chưa truy cập được. Tiếp tục những phần đã đủ dữ liệu trong prompt này. Chỉ kết luận mức độ giống thiết kế đối với màn hình đã thực sự đối chiếu; liệt kê chính xác các ảnh hoặc quyền truy cập còn thiếu.

### Node Figma đã xác định

File key: `6pJL328lnfKQyDaDxpgvWo`. Với link trực tiếp, dùng `?node-id=46-2` tương ứng node `46:2`, và tương tự cho các node khác.

| Nội dung | Node |
| --- | --- |
| Nền tảng: màu, spacing, typography | `19:2` |
| Button component set | `31:2` |
| Input component set | `38:2` |
| NavItem component set | `39:11` |
| StatusChip component set | `40:20` |
| BookCard component set | `44:24` |
| Table component set | `137:135` |
| Tài liệu Table | `130:8` |
| Desktop Login / Home / Catalog | `46:2` / `46:3` / `46:4` |
| Desktop Book Detail / My Books / PDF Viewer | `46:5` / `46:6` / `46:7` |
| Mobile Login / Home / Catalog / My Books | `66:2` / `66:3` / `66:4` / `66:5` |
| Tài liệu hiệu ứng và prototype | `76:2`, thuộc page `13:9` |

## 2. Hiện trạng đã kiểm tra trong CNPM(1).zip

Các thông tin sau là baseline của ZIP. Hãy kiểm tra lại project đang mở và giữ những tiến bộ mới hơn nếu tôi đã sửa code sau khi xuất ZIP.

| Hạng mục | Hiện trạng trong ZIP |
| --- | --- |
| Stack theo lockfile mới | React/React DOM 19.3.0; Vite 8.3.0; Tailwind CSS và @tailwindcss/vite 4.3.3; React Router DOM 7.18.3; lucide-react 1.44.0 |
| Vite + Tailwind | `vite.config.js` có `react()` và `tailwindcss()`; `src/index.css` có `@import "tailwindcss"` |
| Button.jsx | Đã có 4 variant `primary/outline/ghost/danger`, 3 size `sm/md/lg`, disabled, icon, fullWidth, type và các trạng thái tương tác; chưa có loading riêng |
| Input.jsx | Đã có forwardRef, label, error, helperText, leftIcon/rightIcon và disabled; cần bổ sung ID tự sinh và liên kết ARIA |
| Table.jsx | Đã có bảng tồn kho 7 cột, 4 dòng mock mặc định, StatusBadge, onEdit/onDelete, toolbar và empty state; nhận `columns` nhưng chưa dùng để render; chưa có loading hoặc phân trang thực |
| App.jsx | Đã import và hiển thị ví dụ thử ba component trong màn hình sau đăng nhập; các menu vẫn dùng `href="#"`; chưa cấu hình router |
| Login và control nghiệp vụ | Login.jsx chưa đổi so với ZIP trước, vẫn dùng input/button trực tiếp. Search, logout và nút mượn ở App cũng chưa tái sử dụng component chung |
| Bố cục Login | Nền ảnh và card giữa màn hình, khác bố cục hai vùng của Figma |
| Role | Suy ra admin bằng `email.includes('admin')`; cả hai role vẫn vào cùng giao diện App |
| Tương tác | Search, filter, mượn sách chưa có xử lý nghiệp vụ tương ứng |
| Font | CSS khai báo Inter nhưng source chưa tải font Inter |
| Animation | Chưa cài `motion` hoặc `framer-motion`; hiện chủ yếu có CSS hover/transition |
| Backend | Có FastAPI app, CORS, health và router mẫu. Auth chỉ có `GET /api/auth/test`; books/users/loans trả danh sách rỗng. Chưa có endpoint login hoặc tạo phiếu mượn trong router đã đọc |
| Kiểm tra trên bản sao Linux/Node 24.19.0 | `npm ci --ignore-scripts --no-audit --no-fund` thành công; `npm run build` thành công; Vite dev trả HTTP 200 |
| Lint | 6 lỗi `no-unused-vars`: import mặc định `React` không dùng tại App, Login, Button, Input, Table; prop `columns` chưa dùng trong Table |

Kiểm tra render HTML trực tiếp từ component đã xác nhận:

- Input chỉ truyền label, không truyền id/name, hiện không có cặp `label for` ↔ `input id`; error chưa tự tạo `aria-invalid`/`aria-describedby`.
- Truyền một custom column cho Table vẫn nhận bảng 7 cột tồn kho. `data=[]` hiển thị empty state; `data=null` gây lỗi ở footer khi đọc `.length`.
- Button `size="md"` hiện dùng `text-base` (16px ở cấu hình mặc định), trong khi Figma User dùng 18px. Truyền `variant="secondary"` hiện rơi về giao diện primary, vì key này chưa được hỗ trợ.

Các kiểm tra HTML trên chưa phải kiểm tra trực quan bằng trình duyệt. Build/HTTP 200 cũng chưa chứng minh luồng thao tác hoạt động đúng; cần kiểm tra chúng sau khi triển khai.

`package.json` vẫn dùng các khoảng phiên bản bắt đầu bằng `^`, còn lockfile đã phân giải sang các phiên bản mới trong bảng. Dùng lockfile hiện tại; không hạ phiên bản về các số đã ghi trong prompt cũ.

Giữ React + JavaScript JSX + Vite + Tailwind v4. Bắt đầu từ code hiện có. Giữ dependency/lockfile phù hợp; chỉ thêm thư viện có nhiệm vụ rõ ràng. Tailwind v4 hiện đã được cấu hình, vì vậy không chạy lại quy trình khởi tạo Tailwind v3 hoặc thay bằng framework khác. Nếu dùng Git, đọc status/diff trước khi sửa và giữ các thay đổi đang có của tôi.

## A. Hoàn thiện phần còn thiếu của P0

### A1. Nền dự án

1. Kiểm tra Node/npm theo engines trong lockfile; Vite hiện yêu cầu Node `^20.19.0 || >=22.12.0`.
2. Sửa 5 import mặc định React không dùng, giữ `useState`, `forwardRef` và các hook thực sự cần. Với lỗi `columns`, triển khai việc render theo columns ở A3 thay vì xóa prop. Giữ lint hoạt động.
3. Kiểm tra các cấu hình Vite/Tailwind đang có. Khi cần cài lại dependency, dùng lockfile và môi trường hiện tại. ZIP chứa node_modules với native binary Windows, nên không coi thư mục đó là bản cài dùng được trên mọi hệ điều hành.
4. Chỉnh `index.html` thành ngôn ngữ tiếng Việt và tiêu đề phù hợp sản phẩm.
5. Tổ chức `src/components`, `src/pages`, `src/layouts`, `src/styles`, `src/mocks` theo nhu cầu thực tế. Tái sử dụng file đã có; chỉ tạo module khi có nhiệm vụ cụ thể.

Cấu hình `@tailwindcss/vite` và `@import "tailwindcss"` đang có phù hợp với [hướng dẫn Tailwind chính thức cho Vite](https://tailwindcss.com/docs/installation/using-vite).

### A2. Hệ thông số dùng chung với Vân

Tạo nguồn token tập trung, ví dụ `src/styles/tokens.css`, tích hợp với Tailwind v4 bằng CSS theme variables hoặc utility dùng lại được. Tải Inter thật, hỗ trợ tiếng Việt và các weight 400/500/600/700. Kiểm tra font thực tế trong trình duyệt, không chỉ kiểm tra tên khai báo trong CSS.

Đây là thông số từ lần đọc Figma cho hồ sơ CNPM này; bản ZIP mới thay đổi code, không phải nguồn để tự suy ra thông số thiết kế. Size, line-height và tracking trong bảng là CSS px ở mức zoom mặc định; có thể quy đổi sang rem với mốc 16px và vẫn tôn trọng cỡ chữ của trình duyệt.

| Style | Font size | Line height | Weight | Letter spacing | Class thống nhất đề xuất |
| --- | ---: | ---: | ---: | ---: | --- |
| Display/Large | 48 | 56 | 600 | -1 | `text-display-lg` |
| Headline/Large | 32 | 40 | 600 | -0.4 | `text-headline-lg` |
| Title/Large | 24 | 32 | 600 | 0 | `text-title-lg` |
| Title/Medium | 18 | 24 | 600 | 0 | `text-title-md` |
| Body/Large | 16 | 24 | 400 | 0 | `text-body-lg` |
| Body/Medium | 14 | 20 | 400 | 0 | `text-body-md` |
| Label/Medium | 12 | 16 | 500 | +0.3 | `text-label-md` |

Mỗi class phải áp dụng đủ bốn thông số, không chỉ font-size. Tên class là đề xuất triển khai; giá trị là dữ liệu đã đọc từ Figma.

- H1 và section heading desktop: 32/40/600. Hero desktop: 48/56/600.
- Tiêu đề BookCard hiện trong Figma là **24/32/600**. Đây là điểm cần sửa so với bảng gán Title/Medium cho tên sách trong báo cáo PDF trước đó.
- Button chuẩn `md` và NavItem: 18/24/600. Giữ các size `sm/lg` của Vân và ghi rõ thông số biến thể trong tài liệu. Body chính: 16/24/400. Body phụ, input value và helper: 14/20/400. Label: 12/16/500.
- Mobile hero: 32/40/600; tiêu đề card Login: 24/32/600. Đối chiếu từng màn hình để chọn style, không giảm toàn bộ chữ theo một tỷ lệ chung.
- Weight 700 dành cho các ngoại lệ thương hiệu/avatar có trong Figma; dùng 600 cho heading tiêu chuẩn.

| Token CSS | Giá trị |
| --- | --- |
| `--color-bg-canvas` | `#F6F8FC` |
| `--color-bg-surface` | `#FFFFFF` |
| `--color-bg-subtle` | `#EEF2F7` |
| `--color-bg-brand` | `#4F46E5` |
| `--color-bg-brand-hover` | `#3730A3` |
| `--color-bg-brand-soft` | `#EEF2FF` |
| `--color-text-primary` | `#172033` |
| `--color-text-secondary` | `#5B6B82` |
| `--color-text-muted` | `#667085` |
| `--color-text-brand` | `#3730A3` |
| `--color-text-on-brand` | `#FFFFFF` |
| `--color-border-default` | `#D9E2EE` |
| `--color-border-focus` | `#3B82F6` |
| `--color-text-success` / `--color-bg-success-soft` | `#047857` / `#ECFDF5` |
| `--color-text-warning` / `--color-bg-warning-soft` | `#B45309` / `#FFF7E6` |
| `--color-text-danger` / `--color-bg-danger-soft` | `#BE123C` / `#FFF1F2` |
| `--color-border-danger` | `#BE123C` |

- Gradient thương hiệu dùng ba màu `#312E81`, `#4F46E5`, `#0E7490`; lấy hướng gradient đúng từ từng frame.
- Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px.
- Radius token: sm 4, md 8, lg 12, xl 16, 2xl 20, 3xl 28, full 999px.
- Component có kích thước riêng lấy theo frame, ví dụ Login mobile dùng radius 24px. Ghi nhận ngoại lệ thay vì đổi toàn bộ hệ token.

### A3. Component dùng chung

Mở rộng `src/components/Button.jsx`, `Input.jsx`, `Table.jsx` hiện có. Giữ cả named export và default export. App hiện đang dùng named import; các nơi khác của nhóm có thể đang dùng default import.

| Component | Hợp đồng cần giữ |
| --- | --- |
| Button | `children`, `variant`, `size`, `disabled`, `fullWidth`, `icon`, `className`, `type`, `onClick`, các HTML props còn lại |
| Input | `forwardRef`, `label`, `type`, `placeholder`, `value`, `onChange`, `disabled`, `error` boolean/string, `leftIcon`, `rightIcon`, `helperText`, `className`, `containerClassName`, `id`, `name`, `required`, các HTML props còn lại |
| Table | `data`, `columns`, `onEdit`, `onDelete`, `className`, `title`, `subtitle`, `actions`; chế độ cột tồn kho mặc định khi không truyền columns |

Các props mới phải có mặc định phù hợp để các lời gọi hiện tại tiếp tục chạy. Điều chỉnh style tại nguồn component/token, tránh chồng các utility trái nhau qua className ở từng page rồi giả định class đứng sau luôn thắng.

**Button.jsx**

- Giữ các variant `primary`, `outline`, `ghost`, `danger`. Dùng `outline` để ánh xạ nút Secondary của Figma; không đổi key outline thành secondary. Nếu thêm alias secondary, phải ánh xạ tường minh và giữ outline hoạt động.
- Giữ size `sm/md/lg`, chiều cao lần lượt 36/48/56px, cùng icon/fullWidth/type/disabled. Chuẩn hóa `md` từ 16px sang **18/24/600** để dùng chung User/Admin theo Figma; cập nhật các token màu và trạng thái liên quan. Đây là thay đổi hiển thị cần kiểm tra lại độ rộng nút và ghi rõ cho Vân.
- `outline` ánh xạ surface trắng, chữ text-brand, viền border-focus theo Figma; primary dùng bg-brand và bg-brand-hover. Ghost/danger tiếp tục phục vụ tác vụ Admin, dùng token phù hợp với ý nghĩa hiện có.
- Giữ mặc định type="button"; Login truyền type="submit". Bổ sung prop `loading=false`, xử lý nội bộ, kết hợp disabled để khóa gửi lặp, có aria-busy và giữ chiều rộng nút. Không chuyển prop loading tùy biến xuống DOM.
- Giữ hover/active/disabled đã có; chuẩn hóa focus-visible và reduced-motion. Với icon-only button, nơi sử dụng truyền tên truy cập được. Rộng 176px chỉ là mẫu Figma; fullWidth và chiều rộng theo nội dung vẫn dùng được.

**Input.jsx**

- Giữ forwardRef, leftIcon/rightIcon và phân biệt `className` cho input với `containerClassName` cho wrapper. Giữ controlled/uncontrolled, defaultValue và các HTML props tương ứng.
- Giữ id do caller truyền; khi không có id, dùng ID ổn định và duy nhất qua `useId`, kể cả khi không có name hoặc hai input cùng name xuất hiện ở hai form. Label phải liên kết đúng control.
- Thêm ID cho helper/error, `aria-invalid` và `aria-describedby` phù hợp; gộp với mô tả từ caller nếu có. Giữ error boolean/string: string hiển thị thông báo, boolean vẫn phản ánh lỗi qua ARIA. Không làm mất ref của caller.
- Control giữ cao 48px và radius 12px. Chuẩn hóa label từ font-semibold sang **12/16/500, tracking 0.3px**; helper/error từ 12px sang **14/20px**; value 14/20/400; gap chuẩn 8px theo Figma. Đổi màu/focus/error qua token chung.
- Kiểm tra không icon, icon trái, icon phải và hai icon. Làm rõ padding trái/phải trong từng trường hợp; nội dung không chồng lên icon.
- Login dùng lại Input với rightIcon là nút hiện/ẩn mật khẩu có type="button", tên truy cập được và trạng thái phù hợp. Input vẫn là component nền, không gắn cứng logic đăng nhập hoặc barcode vào nó.

**Table.jsx**

- Triển khai prop `columns` thật: mỗi cột có `key`, `header`, tùy chọn `render(value, row, rowIndex)` và `align`. Cả thead và tbody phải lấy từ cùng một cấu hình. Custom columns dùng được cho phiếu mượn của User mà không hiện cột tồn kho hoặc nút Sửa/Xóa ngoài yêu cầu.
- Khi không truyền columns, giữ preset 7 cột tồn kho của Vân và các callback onEdit/onDelete. Có thể chuyển preset sang module cấu hình nhưng giữ cách gọi Table hiện tại. Bổ sung chế độ cột tùy biến trên cùng component, không tạo TableUser/TableAdmin với mã nguồn sao chép.
- Tách 4 dòng DEFAULT_MOCK_DATA sang `src/mocks` khi tổ chức lại. Giữ lời gọi demo cũ hoạt động; dùng dữ liệu mẫu mặc định chỉ cho nhánh preset cũ. Các trang User mới truyền data/columns tường minh; custom columns không tự nhận bốn dòng tồn kho khi thiếu data.
- Chuẩn hóa data null thành mảng rỗng trước khi render và tính footer. Giữ empty state đã hoạt động với data=[]; thêm `emptyMessage` nếu cần tùy biến. Default data bị bỏ qua khi caller truyền null hoặc [] tường minh.
- Thêm `rowKey` có mặc định tương thích id/barcode, giữ id=0 hợp lệ; thêm `loading=false` với loading state theo Figma. Empty/loading dùng colSpan tính từ số cột đang hiển thị, không hardcode 7.
- Footer hiện chỉ đếm data.length; đây chưa phải phân trang. Nếu màn cần phân trang, triển khai hợp đồng rõ ràng và thao tác đổi trang thật. Ghi rõ component hay caller chịu trách nhiệm cắt dữ liệu; tránh cắt hai lần. Dòng “Dữ liệu thử nghiệm cục bộ” thuộc trang dev hoặc footer được truyền vào, không cố định trong mọi bảng người dùng.
- Giữ title/subtitle/actions toolbar, StatusBadge và semantics table/thead/tbody/th/td. Chuyển style qua token; có thể tách StatusBadge để dùng lại nhưng giữ cách hiển thị trạng thái của bảng tồn kho. Table cell dùng typography của bảng, không áp cỡ 24px của BookCard lên tên sách trong mọi ô.
- Tái sử dụng Button cho hành động thích hợp; preset chỉ hiển thị hoặc bật action khi có callback tương ứng. Custom action nằm trong render của cột. Giữ các callbacks nhận row như hiện tại.
- Mẫu Figma rộng 1040px, hàng tham chiếu 56px; tên sách dài được phép xuống dòng và tăng chiều cao. Cuộn ngang nằm trong vùng bảng, tránh làm toàn trang tràn ngang. My Books mobile theo frame riêng.

**Di chuyển phần xem thử đã có trong App:** đưa ba khối “Kiểm tra Button/Input/Table Component” sang trang dev, ví dụ `/dev/ui-kit` chỉ đăng ký khi `import.meta.env.DEV`. Giữ các ví dụ của Vân và bổ sung trường hợp thiếu. App/User Home hiển thị nội dung Figma; menu người dùng không chứa trang xem thử.

Viết `docs/UI_HANDOFF_DAT_VAN.md` có token, typography, API giữ lại/API bổ sung, ví dụ import, mapping Figma Secondary → Button outline, và bảng thông số trước → sau. Kiểm tra các nơi sử dụng có trong repo; nếu chưa có source Admin, ghi rõ phần kiểm tra layout Admin cần Vân thực hiện, không tự kết luận cả Admin đã được xác minh.

**Tiêu chí xong chặng A:** build/dev/lint thành công; Inter tải thật; reuse cả ba component; variant/size/ref/callback cũ hoạt động; Table custom columns, null/empty/loading và Input label/error hoạt động; trang dev và tài liệu bàn giao đầy đủ. P0 tạo ba file component đã có tiến độ từ Vân; kết luận phần còn lại là hoàn thiện/tích hợp/kiểm tra, không ghi là tạo mới từ đầu.

## B. Đưa giao diện User về đúng Figma

Chặng này triển khai UI và tương tác bằng mock data để kiểm tra luồng. Việc tích hợp API/auth thật và trình đọc PDF thuộc các sprint sau; ghi rõ ranh giới đó trong tài liệu bàn giao.

Khung FastAPI mới có `GET /api/books?limit=...&offset=...`, `GET /api/users`, `GET /api/loans` trả data rỗng, cùng `GET /api/auth/test`. File schema LoginRequest/TokenResponse không chứng minh endpoint đăng nhập đã được triển khai. Tách data adapter/mock mode để nối API sau; không tự gọi một POST login/borrow chưa tồn tại, không chuyển lỗi API thành mock success âm thầm. Ghi các endpoint cần bổ sung trong tài liệu tích hợp; giữ source backend của nhóm trong phạm vi hiện tại.

### B1. Cấu trúc và điều hướng

- Chuyển phần màn hình đang gộp trong App.jsx thành các page; App điều phối router và provider cần thiết.
- Tích hợp Button/Input đã mở rộng vào Login, search header, logout và các CTA mượn. Dùng Table với custom columns cho My Books desktop khi phù hợp; không hiển thị bảng tồn kho preset vào cổng User.
- Dùng React Router đã có với các route: `/login`, `/` (Home), `/catalog`, `/books/:bookId`, `/my-books`, `/reader/:loanId` và trang không tìm thấy. Dùng Link/NavLink, hỗ trợ Back/Forward và refresh route.
- Dùng UserLayout dùng chung cho các trang phù hợp. Reader có layout riêng theo Figma. Chỉ đặt layout ở các route cần nó.
- Tách mock books, loans và mock auth ra khỏi JSX. Search/filter phải thay đổi dữ liệu hiển thị; có empty state. Mượn sách cập nhật kho mock dùng chung để My Books phản ánh đúng hành động; xử lý sách không có sẵn và tránh mượn trùng.
- Dùng mock account/role minh bạch, tập trung trong module phục vụ phát triển; bỏ cách suy ra quyền bằng chuỗi `admin` trong email. README ghi tài khoản demo và giới hạn mock. Không lưu mật khẩu vào localStorage hoặc log.
- Giữ điểm tích hợp role Admin cho Vân. Khi chưa có Admin app, không báo rằng Admin đã được triển khai chỉ vì role được gán. Phần giao diện sản xuất Admin không thuộc phạm vi này.
- Login dùng chung; tài khoản do nhà trường cấp, không có đăng ký. Bỏ hộp hướng dẫn lập trình thử role khỏi giao diện người dùng; hướng dẫn demo nằm trong README hoặc trang dev.

### B2. Các mốc bố cục cần giữ

- Desktop tham chiếu rộng 1440px. Login cao 900px; các frame còn lại cao 1024px. Đây là kích thước kiểm tra, không phải kích thước cố định khóa website.
- Desktop Login: brand panel trái rộng 720px ở viewport 1440; card phải rộng 430px, padding 40px, radius 28px; input/button rộng theo vùng trong card, khoảng 350px. Heading card 32/40/600. Giữ bố cục hai vùng gradient và form theo node `46:2`.
- Mobile Login 390×844: brand phía trên cao tham chiếu 320px; form card rộng 358px, margin ngang 16px, padding 24px; card bắt đầu tại y≈248px trong frame, tức chồng lên brand khoảng 72px. Dùng flow và khoảng chồng có kiểm soát, vẫn cuộn được khi hiện lỗi hoặc bàn phím mở.
- Desktop User header tham chiếu cao 128px; main margin ngang 48px. Home hero 1344×320px tại viewport 1440, radius 28px; cụm hình bên phải khoảng 440×240px. Nội dung và bố cục theo node `46:3`.
- BookCard mẫu 280×448px, padding 16px, radius 20px. Dùng grid và flex thích ứng; tên sách dài được hiển thị hợp lý, các nút cuối card thẳng hàng. Không chép lỗi tràn/cắt nội dung nếu gặp trong frame tĩnh.
- Mobile tham chiếu rộng 390px; nội dung thường margin 16px, header 72px. Catalog và My Books có bottom navigation cao tham chiếu 84px; đối chiếu riêng Home vì frame Home hiện không có bottom navigation giống hai màn kia. Bù vùng an toàn và khoảng cuối trang để navigation không che nội dung.
- Tablet chưa có frame riêng: nội suy bố cục từ desktop/mobile, kiểm tra ở 768px và 1024px. Ghi rõ các quyết định responsive bổ sung.
- Mobile Book Detail và PDF Viewer chưa có frame riêng trong bộ đã kiểm tra: tạo bố cục thích ứng từ desktop khi cần, ghi là đề xuất triển khai, không khẳng định có thiết kế gốc tương ứng.

### B3. Những chi tiết luồng cần hoàn thiện

- Figma có link Login → Home, Home CTA → Catalog, một card trên Home → Detail, Detail → My Books, My Books → Reader và Reader → My Books.
- Các liên kết Catalog → Detail và điều hướng header chưa được xác minh có reaction trong lần kiểm tra này. Hãy triển khai chúng thành điều hướng hoạt động theo nghiệp vụ và route ở trên; không chỉ chép các hotspot hiện có.
- BookCard không được chứa button tương tác bên trong một link bao toàn bộ card. Tổ chức vùng link chi tiết và button mượn riêng để đúng bàn phím và tránh hành động kép.
- PDF Viewer trong chặng này là phần khung giao diện theo Figma. Nếu có tài liệu mẫu hợp lệ, nối vào viewer theo khả năng hiện có; nếu chưa có, hiển thị trạng thái chưa có tài liệu rõ ràng và vô hiệu hóa các điều khiển không dùng được. Ghi riêng việc tích hợp react-pdf/API ở sprint sau. Không mô tả ẩn nút tải/in hoặc chặn chuột phải là bảo vệ PDF hoàn chỉnh.

**Tiêu chí xong chặng B:** 6 route màn hình desktop và 4 bố cục mobile có tham chiếu được triển khai; đường dẫn và mock interactions hoạt động; các phần chưa có thiết kế/backend được ghi rõ; Login và Home đã đối chiếu ảnh với Figma trước khi thêm motion.

## C. Hiệu ứng dựa trên Figma và video

### C1. Những gì quan sát được trong video

Mốc thời gian gần đúng, tính từ đầu video khoảng 30 giây:

| Đoạn | Quan sát | Áp dụng vào CNPM |
| --- | --- | --- |
| 2.5–7.5s và 23–25.5s | Các vòng gợn xuất hiện nối tiếp theo đường đi con trỏ, lan rộng rồi mờ trên hero | Lớp ripple nhẹ trong brand panel Login và hero Home |
| 7.5–8.5s | Các con số tăng dần khi khối thống kê xuất hiện | Chỉ dùng nếu phần thiết kế đang làm đã có số thống kê; không tự thêm section |
| 8.5–11.5s | Ảnh/nội dung lần lượt đi vào vùng nhìn khi cuộn, tạo cảm giác nhiều lớp | Reveal và parallax nhẹ cho nội dung phù hợp |
| 12–15s | Dải card dịch ngang trong khi phần đó vẫn nằm trên màn hình | Tham khảo cho carousel nếu sau này cần; không thay grid Catalog hiện tại |

Video quay màn hình không đủ để xác định thư viện gốc, kỹ thuật shader, trigger chính xác của dải card hay toàn bộ thời lượng/easing. Không coi độ hạt nhìn thấy trên màn hình là bằng chứng chắc chắn có noise shader. Các số bên dưới lấy từ tài liệu Figma, không phải số đo chính xác từ video.

### C2. Thông số motion đã có trong trang 06 Figma

Lần kiểm tra này, dữ liệu keyframe xuất từ Login/Home trả về danh sách rỗng; trang 06 có đặc tả bằng chữ, còn các hotspot desktop có Smart Animate 250ms. Cần lập trình motion cho web theo đặc tả, không coi link prototype là mã animation tự chạy trong React.

| Hiệu ứng | Trigger | Thông số Figma | Phạm vi |
| --- | --- | --- | --- |
| Cursor ripple | Di chuyển/nhấn con trỏ | scale 0.4 → 1; opacity 0.18 → 0; 420ms; ease-out | Hero/brand panel; bìa sách chỉ bật khi vẫn rõ nội dung |
| Hero parallax | Con trỏ hoặc cuộn | Dịch lớp hình 6–12px; phản hồi khoảng 240ms; spring nhẹ | Cụm hình hero desktop |
| Scroll reveal | Khoảng 15% phần tử vào viewport | y 24 → 0px; opacity 0 → 1; 480ms; ease-out | Tiêu đề và hàng sách |
| Stagger + hover lift | Nhóm thẻ xuất hiện / hover | Delay giữa thẻ 60ms; hover y=-4px; 220ms; ease-out | Nhóm BookCard |
| Sticky storytelling | Cuộn section giải thích | Chữ bám vị trí; nền surface → brand-soft; tài liệu ghi top 64px | Chỉ khi section tương ứng thực sự có trong màn triển khai |
| Chuyển màn | Điều hướng | Desktop 250ms, mobile 220ms | Vùng nội dung route |

Chi tiết triển khai bổ sung được đề xuất, không phải số đã đo trong Figma:

- Reveal chạy một lần khi vào vùng nhìn; state nội dung vẫn hiện khi giảm chuyển động hoặc animation bị tắt.
- Route transition dùng fade hoặc dịch nhẹ tối đa 8px, giữ header ổn định. Không kéo dài thời gian chờ thao tác để đợi animation.
- Ripple chỉ nằm bên dưới chữ, form và CTA. Lớp trang trí có `pointer-events: none` và không có trong accessibility tree. Giữ con trỏ hệ thống bình thường.
- Tạo một ripple khi con trỏ đã đi thêm khoảng 16–24px và cách lần phát trước tối thiểu 50–80ms; giới hạn khoảng 12 ripple đồng thời. Đây là mức khởi đầu để tối ưu, được phép tinh chỉnh sau khi quan sát. Không tạo phần tử mới cho mọi pointer event.
- Dùng tọa độ theo container để ripple đúng vị trí khi cuộn/resize. Không phát ripple khi nhập vào input hoặc thao tác với control ở phía trên.
- Với parallax, đặt giới hạn 6–12px như Figma và dùng spring của thư viện; khoảng 240ms là mục tiêu cảm nhận, không phải bằng chứng đã có đủ stiffness/damping từ Figma. Ghi cấu hình spring thực tế đã chọn.
- Sticky top phải tính theo header đang dùng. Nếu header fixed/sticky cao 128px, không đặt nội dung ở top 64px khiến bị che; dùng offset thực tế cộng khoảng cách phù hợp. Không thêm section mới chỉ để minh họa sticky.

### C3. Công cụ và chất lượng

- Kiểm tra thư viện đang có. Nếu vẫn chưa có motion library, thêm duy nhất `motion` khi cần cho reveal/parallax/route transition và import từ `motion/react`; dùng CSS cho hover/focus đơn giản. Giữ JSX và cập nhật lockfile tương ứng. Tham khảo [scroll animation của Motion](https://motion.dev/docs/react-scroll-animations) cho reveal và parallax.
- Tách phần dùng lại được, ví dụ `src/components/motion/Reveal.jsx`, `CursorRipple.jsx`, `HeroParallax.jsx` và một nơi khai báo motion constants. Tên file có thể điều chỉnh theo cấu trúc thực tế.
- Dùng wrapper riêng cho transform bố cục và transform animation. Hero collage có thể là asset SVG xuất gộp: chỉ dịch cả asset nếu chưa có các lớp xuất riêng, không tự vẽ lại minh họa để giả vờ có nhiều lớp.
- Tránh setState liên tục cho vị trí con trỏ. Dùng motion values/ref hoặc [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) khi thực sự cần; dọn listener, observer, timer/RAF khi unmount, chạy đúng dưới React StrictMode.
- Giữ cuộn trang native. Các animation tập trung vào transform/opacity; chỉ cấp tài nguyên cho phần đang hiện. Tránh gắn `will-change` cho toàn bộ ứng dụng.
- Với `prefers-reduced-motion: reduce`: tắt ripple và parallax; bỏ stagger/hover lift; reveal chỉ đổi opacity ngắn hoặc hiển thị ngay; chuyển route gần như tức thì. Nội dung và thao tác luôn dùng được. Có thể dùng [useReducedMotion của Motion](https://motion.dev/docs/react-use-reduced-motion) để đáp ứng thiết lập này.
- Mobile/touch tắt hiệu ứng bám con trỏ; giữ phản hồi chạm và reveal nhẹ. Layout hoạt động ở 390px, cả khi bàn phím mở. Không áp dụng ripple/parallax lên bảng nghiệp vụ hoặc vùng đọc PDF.
- Bản ripple này tái hiện các vòng lan và vệt theo con trỏ. Nếu cần mức biến dạng nền/khúc xạ như nước, ghi thành phần mở rộng riêng dùng kỹ thuật phù hợp và kiểm tra thiết bị. Không gọi vòng tròn CSS là bản sao chính xác của một mô phỏng nước.

**Tiêu chí xong chặng C:** quan sát được ripple theo con trỏ trên desktop, reveal khi cuộn, parallax có giới hạn, hover card và chuyển màn đúng thời lượng; reduced-motion hoạt động; các input/button/link vẫn thao tác được; có bản quay màn hình ngắn nếu môi trường hỗ trợ.

## 3. Kiểm tra và kết quả phải trả lại

1. Chạy `npm run lint`, `npm run build` và khởi động dev server. Sửa lỗi do thay đổi gây ra. Chỉ báo pass cho lệnh thực sự đã chạy.
2. Kiểm tra bằng trình duyệt: Login, hiện/ẩn mật khẩu, validation, điều hướng, search/filter, mượn mock, My Books, Back/Forward, refresh route và logout. Kiểm tra component loading/disabled/error/empty. Không tạo test chỉ để khẳng định file tồn tại.

3. So ảnh Login/Home/Catalog/My Books ở 1440px và 390px với Figma; kiểm tra 768px và 1024px cho responsive. Đợi font tải xong và animation ổn định khi chụp ảnh so sánh.
4. Quan sát riêng motion trên Login/Home: con trỏ di chuyển, cuộn vào hàng sách, hover, chuyển route, chế độ giảm chuyển động. Nếu môi trường không xem được animation, ghi là chưa kiểm chứng trực quan.
5. Báo cáo theo ba chặng: đã làm gì, file quan trọng thay đổi, dependency mới và lý do, lệnh kiểm tra/kết quả, khác biệt còn lại với Figma/video; nêu riêng những chỉnh sửa trong component Vân đã viết.
6. Cập nhật README hướng dẫn chạy và demo, cùng `docs/UI_HANDOFF_DAT_VAN.md`. Ghi rõ các chức năng đang dùng mock, khung FastAPI đã có/endpoint còn thiếu, phần giao diện Reader, phần Admin do Vân phụ trách và các việc tích hợp sprint sau.
7. Tách kết luận: P0 khởi tạo của Đạt; P0 component chung Đạt + Vân; giao diện mock theo Figma; motion. Không gộp build thành công với kết luận đã hoàn tất toàn bộ nghiệp vụ.

Các trường hợp hồi quy bắt buộc đối với component của Vân: cả named/default import dùng được; 4 variant và 3 size Button giữ được; Input thiếu id/name vẫn có label liên kết đúng và ref hoạt động; Table preset gọi lại onEdit/onDelete đúng row; custom columns chỉ hiện cột được truyền; data=[]/null đều an toàn; loading/empty không lệch colSpan. Thực hiện trong trang dev và/hoặc công cụ test phù hợp hiện có, sửa lỗi thực tế thay vì cài thêm nhiều framework kiểm thử.

Hãy bắt đầu bằng việc kiểm tra project đang mở và triển khai chặng A, sau đó tiếp tục B và C theo thứ tự trên.
