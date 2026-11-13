import { expect, test } from '@playwright/test';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

test.describe('Return Flow (Nghiệp vụ trả sách tại Quầy Lưu thông / Thủ thư)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept auth login để bảo đảm role ADMIN
    await page.route('**/api/auth/login', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      return route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-jwt-admin-token',
          token_type: 'bearer',
          user: { id: 101, username: 'admin', role: 'ADMIN' },
        }),
      });
    });

    // Đăng nhập tài khoản thủ thư/admin
    await page.goto('/login');
    await page.getByPlaceholder('Nhập tên đăng nhập').fill('admin');
    await page.getByPlaceholder('Nhập mật khẩu').fill('Admin@123');
    await page.getByRole('button', { name: 'Đăng nhập hệ thống' }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('Thủ thư tiếp nhận trả sách tại quầy lưu thông, quét barcode và xác nhận check-in', async ({ page }) => {
    // 1. Chuyển đến màn hình Quản lý mượn trả (Lưu thông quầy)
    await page.goto('/admin/loans');
    await expect(page.getByRole('heading', { name: /Quản lý Mượn \/ Trả Sách/i })).toBeVisible({ timeout: 5000 });

    // 2. Nhập mã vạch sách trả tại quầy
    const barcodeInput = page.getByPlaceholder(/DEMO-BC-100-02|Enter để nhận mã/i);
    await expect(barcodeInput).toBeVisible();
    await barcodeInput.fill('DEMO-BC-001-01');
    await barcodeInput.press('Enter');

    // 3. Nút "Xác nhận trả sách" hiển thị sau khi quét thành công
    const confirmReturnBtn = page.getByRole('button', { name: 'Xác nhận trả sách' });
    await expect(confirmReturnBtn).toBeVisible({ timeout: 5000 });
    await confirmReturnBtn.click();

    // 4. Modal xác nhận trả sách mở ra
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Xác nhận Trả sách' })).toBeVisible();

    // 5. Bấm xác nhận trả sách trong modal
    const finalConfirmBtn = modal.getByRole('button', { name: 'Xác nhận trả sách' });
    await finalConfirmBtn.click();

    // 6. Kiểm tra thông báo thành công xuất hiện
    await expect(page.getByText(/Da nhan tra sach thanh cong|Check-in thành công/i)).toBeVisible({ timeout: 5000 });
  });
});
