import { expect, test } from '@playwright/test';

test.describe('Topup Flow (Nạp tiền giả lập vào ví dịch vụ)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-jwt-student-token',
          token_type: 'bearer',
          user: { id: 1, username: 'demo_student_001', role: 'STUDENT' },
        }),
      });
    });

    // Đăng nhập tài khoản sinh viên
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.getByPlaceholder('Nhập tên đăng nhập').fill('demo_student_001');
    await page.getByPlaceholder('Nhập mật khẩu').fill('User@123');
    await page.getByRole('button', { name: 'Đăng nhập hệ thống' }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText('Đăng xuất')).toBeVisible();
  });

  test('Người dùng truy cập trang nạp tiền và thực hiện nạp giả lập thành công', async ({ page }) => {
    await page.goto('/wallet/top-up');
    await expect(page.getByRole('heading', { name: 'Nạp tiền thử nghiệm' })).toBeVisible();

    // Chọn mức nạp tiền 100.000 ₫
    const topupBtn100k = page.getByRole('button', { name: /^100\.000/i });
    await expect(topupBtn100k).toBeVisible();
    await topupBtn100k.click();

    // Nhấn nút nạp tiền
    const submitBtn = page.getByRole('button', { name: /Nạp.*tiền thử/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Thông báo thành công hiển thị
    await expect(page.getByText(/Đã nạp tiền thử/i)).toBeVisible({ timeout: 10000 });
  });
});
