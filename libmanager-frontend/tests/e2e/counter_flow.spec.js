import { expect, test } from '@playwright/test';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

test.describe('Counter Flow (Quầy thủ thư: Mượn & Trả sách)', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();

    await page.route('**/api/auth/login', async (route) => {
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

    // Tránh 401 /api/auth/me → interceptor xóa token và đá về /login
    await page.route('**/api/auth/me', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ id: 101, username: 'admin', role: 'ADMIN' }),
      });
    });

    await page.route('**/api/admin/loans/lookup**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 1,
          reader: {
            user_code: '52400001',
            full_name: 'Quý cô Phương Vũ',
            total_fines: 0,
            is_borrowing_blocked: false,
          },
          data: [
            {
              id: 101,
              loan_code: 'PM-2026-0101',
              user_code: '52400001',
              full_name: 'Quý cô Phương Vũ',
              book_id: 1,
              book_title: 'Lập Trình Web Hiện Đại với React 19',
              copy_barcode: 'BC-001-01',
              loan_type: 'PHYSICAL',
              loan_status: 'PENDING_PICKUP',
              borrow_date: '2026-10-28T09:00:00Z',
              due_date: '2026-11-11T17:00:00Z',
            },
          ],
        }),
      });
    });

    await page.route('**/api/admin/loans/active-return**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          loan_id: 101,
          user_code: '52400001',
          full_name: 'Quý cô Phương Vũ',
          book_id: 1,
          book_title: 'Lập Trình Web Hiện Đại với React 19',
          book_price: 150000,
          copy_barcode: 'BC-001-01',
          loan_status: 'BORROWED',
          due_date: '2026-11-11T17:00:00Z',
          overdue: false,
        }),
      });
    });

    // Đăng nhập tài khoản admin để vào portal thủ thư
    await page.goto('/login');
    await page.getByPlaceholder('Nhập tên đăng nhập').fill('admin');
    await page.getByPlaceholder('Nhập mật khẩu').fill('Admin@123');
    await page.getByRole('button', { name: 'Đăng nhập hệ thống' }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('Kiểm tra giao diện quầy lưu thông và tra cứu độc giả', async ({ page }) => {
    // Chờ thanh điều hướng Admin sẵn sàng rồi click vào Quản lý Mượn / Trả
    const loansNavLink = page.getByRole('link', { name: /Quản lý Mượn \/ Trả/i });
    await expect(loansNavLink).toBeVisible({ timeout: 10000 });
    await loansNavLink.click();

    await expect(page.getByRole('heading', { name: /Quản lý Mượn \/ Trả Sách/i })).toBeVisible({ timeout: 10000 });

    // 1. Kiểm tra quầy trả sách
    await expect(page.getByRole('heading', { name: 'Quầy Nhận Trả Sách' })).toBeVisible();
    const returnInput = page.getByPlaceholder(/Quét mã vạch/i);
    await expect(returnInput).toBeVisible();

    // Thử nhập mã vạch sách trả
    await returnInput.fill('BC-001-01');
    await returnInput.press('Enter');
    await expect(page.getByText(/Đang mượn|Quý cô Phương Vũ/i).first()).toBeVisible();

    // 2. Kiểm tra quầy mượn sách & tra cứu MSSV
    await expect(page.getByRole('heading', { name: 'Quầy Xuất Phiếu Mượn' })).toBeVisible();
    const mssvInput = page.getByPlaceholder(/Nhập mã bạn đọc/i);
    await expect(mssvInput).toBeVisible();

    await mssvInput.fill('52400001');
    await mssvInput.press('Enter');

    // Độc giả được tra cứu thành công
    await expect(page.getByText(/Có trong hệ thống|Quý cô Phương Vũ/i).first()).toBeVisible();
  });
});
