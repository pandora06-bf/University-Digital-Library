import { expect, test } from '@playwright/test';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

test.describe('Pay Fine Flow (Quản lý và thu nợ / phí phạt tại quầy)', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.route(/\/api\/auth\/login/, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      await route.fulfill({
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

    await page.route(/\/api\/admin\/fines\/lookup/, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
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

    await page.route(/\/api\/admin\/fines\/collect/, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Đã thu đủ tiền phạt' }),
      });
    });

    // Đăng nhập quyền thủ thư / admin
    await page.goto('/login');
    await page.getByPlaceholder('Nhập tên đăng nhập').fill('admin');
    await page.getByPlaceholder('Nhập mật khẩu').fill('Admin@123');
    await page.getByRole('button', { name: 'Đăng nhập hệ thống' }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('Thủ thư tra cứu nợ phạt của độc giả, mở modal và xác nhận thu tiền thành công', async ({ page }) => {
    // Chờ thanh điều hướng Admin sẵn sàng rồi click vào Thu phạt & Công nợ (điều hướng client-side SPA)
    const finesNavLink = page.getByRole('link', { name: /Thu phạt & Công nợ/i });
    await expect(finesNavLink).toBeVisible({ timeout: 10000 });
    await finesNavLink.click();
    await expect(page.getByRole('heading', { name: /Quản lý Thu phạt & Công nợ/i })).toBeVisible({ timeout: 10000 });

    // 1. Tra cứu MSSV có nợ phạt
    const searchInput = page.getByPlaceholder(/Nhập MSSV/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('SV-DEMO-001');
    await page.getByRole('button', { name: /^Tra cứu$/i }).click();

    // 2. Bảng có khoản chưa thu (tránh khớp <option>Chưa thu</option> trong filter)
    const collectBtn = page.getByRole('button', { name: /Thu tiền/i }).first();
    await expect(collectBtn).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText('Chưa thu').first()).toBeVisible();
    await collectBtn.click();

    // 3. Modal xác nhận thu phí phạt hiện lên
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/Xác nhận thu phí phạt/i)).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/Số tiền cần thu/i)).toBeVisible();

    // 4. Bấm "Xác nhận Đã Thu"
    const confirmCollectBtn = page.getByRole('dialog').getByRole('button', { name: /Xác nhận Đã Thu/i });
    await expect(confirmCollectBtn).toBeVisible();
    await confirmCollectBtn.click();

    // 5. Toast thông báo đã thu đủ tiền phạt xuất hiện
    await expect(page.getByText(/Đã thu đủ/i).first()).toBeVisible({ timeout: 10000 });
  });
});
