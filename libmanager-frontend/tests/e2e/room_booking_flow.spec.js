import { expect, test } from '@playwright/test';

test.describe('Room Booking Flow (Đặt phòng học nhóm & tra cứu phòng)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-jwt-student-token',
          token_type: 'bearer',
          user: { id: 1, username: '52400001', role: 'STUDENT' },
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
    await page.getByPlaceholder('Nhập tên đăng nhập').fill('52400001');
    await page.getByPlaceholder('Nhập mật khẩu').fill('User@123');
    await page.getByRole('button', { name: 'Đăng nhập hệ thống' }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText('Đăng xuất')).toBeVisible();
  });

  test('Người dùng xem danh sách phòng, chọn khung giờ còn trống và xác nhận đặt phòng thành công', async ({ page }) => {
    await page.goto('/rooms');
    await expect(page.getByRole('heading', { name: 'Đặt phòng thư viện' })).toBeVisible();
    await expect(page.getByText(/Số dư của tôi/i)).toBeVisible();

    // 1. Chọn ngày mai để luôn có khung giờ trống bất kể thời điểm chạy test trong ngày
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dateInput = page.getByLabel('Ngày sử dụng phòng');
    await dateInput.fill(tomorrow);

    // 2. Kiểm tra danh sách phòng được hiển thị
    await expect(page.getByRole('heading', { name: /Phòng học nhóm/i }).first()).toBeVisible();

    // 3. Tìm một slot còn trống trên giao diện
    const availableSlot = page.locator('button:not([disabled])').filter({ hasText: /\d{2}:\d{2}–\d{2}:\d{2}|\d{2}:\d{2}-\d{2}:\d{2}/ }).first();
    await expect(availableSlot).toBeVisible({ timeout: 10000 });
    await availableSlot.click();

    // 4. Thanh thông tin lựa chọn xuất hiện kèm nút "Đặt khung giờ này"
    const bookSlotBtn = page.getByRole('button', { name: /Đặt khung giờ này/i });
    await expect(bookSlotBtn).toBeVisible();
    await bookSlotBtn.click();

    // 5. Modal / Dialog xác nhận hiện lên
    await expect(page.getByText(/Xác nhận đặt phòng/i)).toBeVisible();
    const confirmBtn = page.getByRole('button', { name: /Xác nhận đặt/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 6. Toast thông báo đặt phòng thành công
    await expect(page.getByText(/Đặt phòng thành công/i)).toBeVisible({ timeout: 10000 });
  });
});
