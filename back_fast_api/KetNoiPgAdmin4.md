# Hướng Dẫn Kết Nối Database PostgreSQL Docker Với pgAdmin 4

Tài liệu này hướng dẫn chi tiết cách kết nối cơ sở dữ liệu PostgreSQL đang chạy trong môi trường **Docker / Docker Compose** với công cụ quản trị **pgAdmin 4**.

---

## 1. Xác Định Thông Số Kết Nối Từ Docker

Kiểm tra cấu hình container database trong file `docker-compose.yml` hoặc file cấu hình môi trường `.env`.

### Các thông số điển hình

| Thông số | Giá trị mặc định phổ biến | Ghi chú |
| :--- | :--- | :--- |
| **Host Name / Address** | `localhost` hoặc `127.0.0.1` | Nếu pgAdmin cài trên máy thật |
| **Port ngoài (Host Port)** | `5432` (hoặc `5433`, `5434` tùy port map) | Cổng bên trái trong `ports: "5432:5432"` |
| **Maintenance Database** | `libmanager_db` (hoặc `postgres`) | Tên database trong `POSTGRES_DB` |
| **Username** | `postgres` (hoặc cấu hình riêng) | Khai báo ở `POSTGRES_USER` |
| **Password** | `postgres` (hoặc cấu hình riêng) | Khai báo ở `POSTGRES_PASSWORD` |

**Cách kiểm tra port đang map thực tế qua Terminal/PowerShell:**

```bash
docker ps
```

Tìm cột **PORTS** của container postgres. Ví dụ: `0.0.0.0:5432->5432/tcp` nghĩa là cổng kết nối ngoài máy thật là `5432`.

---

## 2. Trường Hợp 1: Dùng pgAdmin 4 Cài Trực Tiếp Trên Máy Tính (Desktop App)

Đây là trường hợp bạn cài phần mềm pgAdmin 4 trực tiếp trên Windows, macOS hoặc Linux.

### Các bước thực hiện

1. **Mở pgAdmin 4** trên máy tính.
2. Tại cây điều hướng bên trái:
   - Chuột phải vào **Servers** → chọn **Register** → **Server...**
3. **Tab `General`:**
   - **Name**: Đặt tên gợi nhớ cho kết nối (ví dụ: `Docker - Library DB`).
4. **Tab `Connection`:**
   - **Host name/address**: Điền `localhost` hoặc `127.0.0.1`.
   - **Port**: Điền cổng đã map ra máy host (thường là `5432`).
   - **Maintenance database**: Điền tên database của dự án (ví dụ: `libmanager_db` hoặc `postgres`).
   - **Username**: Điền tài khoản quản trị (ví dụ: `postgres`).
   - **Password**: Điền mật khẩu database.
   - Tích chọn **Save password?** để không phải nhập lại mỗi lần mở.
5. Nhấn **Save** để lưu và hoàn tất kết nối.

---

## 3. Trường Hợp 2: Dùng pgAdmin 4 Chạy Bằng Docker Container

Nếu bạn chạy pgAdmin 4 dưới dạng một container trong cùng file `docker-compose.yml` với database:

### Lưu ý quan trọng về Hostname

- **KHÔNG** dùng `localhost` hay `127.0.0.1` (vì trong container pgAdmin, `localhost` trỏ về chính nó).
- **PHẢI DÙNG** **tên service của database** trong `docker-compose.yml` (ví dụ: `db` hoặc `postgres`).

### Các bước cấu hình

1. Mở trình duyệt và truy cập pgAdmin container (thường là `http://localhost:5050` hoặc `http://localhost:8080`).
2. Đăng nhập bằng tài khoản pgAdmin (theo biến môi trường `PGADMIN_DEFAULT_EMAIL` và `PGADMIN_DEFAULT_PASSWORD`).
3. Chuột phải vào **Servers** → **Register** → **Server...**
4. **Tab `General`:**
   - **Name**: Đặt tên kết nối (ví dụ: `Docker Network DB`).
5. **Tab `Connection`:**
   - **Host name/address**: Điền tên container/service database (ví dụ: `db`).
   - **Port**: Điền cổng nội bộ container: `5432`.
   - **Maintenance database**: Tên database (ví dụ: `libmanager_db`).
   - **Username**: `postgres`.
   - **Password**: Mật khẩu database.
6. Nhấn **Save**.

---

## 4. Xử Lý Các Sự Cố Thường Gặp (Troubleshooting)

### 4.1. Lỗi: `Connection refused` hoặc `Unable to connect to server`

- **Nguyên nhân:** Container postgres chưa chạy hoặc chưa expose port ra máy host.
- **Cách khắc phục:**

  1. Kiểm tra trạng thái container:

     ```bash
     docker ps
     ```

  2. Đảm bảo file `docker-compose.yml` đã mở cổng ra ngoài:

     ```yaml
     ports:
       - "5432:5432"
     ```

  3. Nếu cổng `5432` trên máy đã bị chiếm bởi một phiên bản PostgreSQL cài sẵn khác:
     - Đổi port map trong `docker-compose.yml` thành `"5433:5432"`.
     - Khi cấu hình pgAdmin, điền **Port** là `5433`.

### 4.2. Lỗi: `FATAL: password authentication failed for user "postgres"`

- **Nguyên nhân:** Sai mật khẩu hoặc volume cũ chưa cập nhật mật khẩu mới.
- **Cách khắc phục:**
  - Kiểm tra đúng giá trị trong file `.env` hoặc `docker-compose.yml`.
  - Nếu trước đó từng tạo volume data cũ, PostgreSQL sẽ không tự đổi mật khẩu theo biến môi trường mới trừ khi xóa volume:

    ```bash
    docker-compose down -v
    docker-compose up -d
    ```

    *(Lưu ý: Thao tác này sẽ xóa toàn bộ dữ liệu database.)*

### 4.3. Lỗi: `database "libmanager_db" does not exist`

- **Cách khắc phục:**
  - Tại tab **Connection**, đổi ô **Maintenance database** tạm thời thành `postgres`.
  - Sau khi kết nối thành công, chuột phải vào **Databases** → **Create** → **Database...** để tạo mới database với tên mong muốn.