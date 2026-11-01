import { expect, test } from '@playwright/test';

test.describe('Pay Fine Flow (Quản lý và thu nợ / phí phạt tại quầy)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-jwt-admin-token',
          token_type: 'bearer',
          user: { id: 101, username: 'admin', role: 'ADMIN' },
        }),
      });
    });

    await page.route('**/api/admin/fines/lookup*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_code: 'SV-DEMO-001',
          full_name: 'Nguyễn Văn Đạt',
          total_fines: 50000,
          fines: [
            {
              fine_id: 1,
              loan_id: 101,
              overdue_days: 5,
              total_amount: 50000,
              created_at: '2026-10-25T08:00:00Z',
            },
          ],
        }),
      });
    });

    await page.route('**/api/admin/fines/collect', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Đã thu đủ tiền phạt' }),
      });
    });

    // Đăng nhập quyền thủ thư / admin
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.getByPlaceholder('Nhập tên đăng nhập').fill('admin');
    await page.getByPlaceholder('Nhập mật khẩu').fill('Admin@123');
    await page.getByRole('button', { name: 'Đăng nhập hệ thống' }).click();
    await expect(page).toHaveURL(/\/admin(\/catalog)?$/);
  });

  test('Thủ thư tra cứu nợ phạt của độc giả, mở modal và xác nhận thu tiền thành công', async ({ page }) => {
    await page.goto('/admin/fines');
    await expect(page.getByRole('heading', { name: 'Quản lý Thu phạt & Công nợ' })).toBeVisible();

    // 1. Tra cứu MSSV có nợ phạt
    const searchInput = page.getByPlaceholder(/Tìm MSSV/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('SV-DEMO-001');
    await searchInput.press('Enter');

    // 2. Kiểm tra bảng hiển thị danh sách khoản phạt và bấm "Thu tiền"
    await expect(page.getByText(/FINE-/i).first()).toBeVisible({ timeout: 10000 });
    const collectBtn = page.getByRole('button', { name: /Thu tiền/i }).first();
    await expect(collectBtn).toBeVisible();
    await collectBtn.click();

    // 3. Modal xác nhận thu phí phạt hiện lên
    await expect(page.getByText(/Xác nhận thu phí phạt/i)).toBeVisible();
    await expect(page.getByText(/Số tiền cần thu/i)).toBeVisible();

    // 4. Bấm "Xác nhận Đã Thu"
    const confirmCollectBtn = page.getByRole('button', { name: /Xác nhận Đã Thu/i });
    await expect(confirmCollectBtn).toBeVisible();
    await confirmCollectBtn.click();

    // 5. Toast thông báo đã thu đủ tiền phạt xuất hiện
    await expect(page.getByText(/Đã thu đủ/i)).toBeVisible({ timeout: 10000 });
  });
});
