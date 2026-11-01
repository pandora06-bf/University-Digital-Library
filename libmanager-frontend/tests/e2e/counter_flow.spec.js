import { expect, test } from '@playwright/test';

test.describe('Counter Flow (Quầy thủ thư: Mượn & Trả sách)', () => {
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

    await page.route('**/api/admin/loans/lookup*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_code: 'SV-DEMO-001',
          data: [
            {
              id: 101,
              loan_code: 'PM-2026-0101',
              user_code: 'SV-DEMO-001',
              book_id: 1,
              book_title: 'Lập Trình Web Hiện Đại với React 19',
              copy_barcode: 'DEMO-BC-001-01',
              loan_type: 'PHYSICAL',
              loan_status: 'PENDING_PICKUP',
              borrow_date: '2026-10-28T09:00:00Z',
              due_date: '2026-11-11T17:00:00Z',
            },
          ],
        }),
      });
    });

    // Đăng nhập tài khoản admin để vào portal thủ thư
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

  test('Kiểm tra giao diện quầy lưu thông và tra cứu độc giả', async ({ page }) => {
    await page.goto('/admin/loans');
    await expect(page.getByRole('heading', { name: 'Quản lý Mượn / Trả Sách' })).toBeVisible();

    // 1. Kiểm tra quầy trả sách
    await expect(page.getByRole('heading', { name: 'Quầy Nhận Trả Sách Nhanh' })).toBeVisible();
    const returnInput = page.getByPlaceholder(/Quét Barcode sách trả/i);
    await expect(returnInput).toBeVisible();

    // Thử nhập mã vạch sách trả
    await returnInput.fill('DEMO-BC-001-01');
    await returnInput.press('Enter');
    await expect(page.getByText(/Bản sao đã quét/i)).toBeVisible();

    // 2. Kiểm tra quầy mượn sách & tra cứu MSSV
    await expect(page.getByRole('heading', { name: 'Quầy Xuất Phiếu Mượn' })).toBeVisible();
    const mssvInput = page.getByPlaceholder(/Nhập và nhấn phím Enter/i);
    await expect(mssvInput).toBeVisible();

    await mssvInput.fill('SV-DEMO-001');
    await mssvInput.press('Enter');

    // Độc giả được tra cứu thành công
    await expect(page.getByText(/Người mượn/i)).toBeVisible();
  });
});
