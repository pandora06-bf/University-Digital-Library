import { expect, test } from '@playwright/test';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

test.describe('Login Flow (Xác thực đăng nhập Độc giả và Thủ thư/Admin)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept both relative and absolute paths for login
    await page.route('**/api/auth/login', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      const data = route.request().postDataJSON() || {};
      const username = (data.username || '').toLowerCase();
      const password = data.password || '';

      if (username === 'admin' && password === 'Admin@123') {
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
      }

      if (username === 'demo_student_001' && password === 'User@123') {
        return route.fulfill({
          status: 200,
          headers: CORS_HEADERS,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'mock-jwt-student-token',
            token_type: 'bearer',
            user: { id: 1, username: 'demo_student_001', role: 'STUDENT' },
          }),
        });
      }

      return route.fulfill({
        status: 401,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Sai tên đăng nhập hoặc mật khẩu' }),
      });
    });

    await page.route('**/api/auth/me', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      const auth = route.request().headers()['authorization'] || '';
      const isAdmin = /admin/i.test(auth);
      return route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify(
          isAdmin
            ? { id: 101, username: 'admin', role: 'ADMIN' }
            : { id: 1, username: 'demo_student_001', role: 'STUDENT' }
        ),
      });
    });

    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('Hiển thị thông báo lỗi khi nhập sai mật khẩu', async ({ page }) => {
    await page.getByPlaceholder('Nhập tên đăng nhập').fill('demo_student_001');
    await page.getByPlaceholder('Nhập mật khẩu').fill('WrongPassword@999');
    await page.getByRole('button', { name: 'Đăng nhập hệ thống' }).click();

    await expect(page.getByText('Sai tên đăng nhập hoặc mật khẩu')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('Đăng nhập thành công với tài khoản sinh viên và điều hướng sang trang chủ độc giả', async ({ page }) => {
    await page.getByPlaceholder('Nhập tên đăng nhập').fill('demo_student_001');
    await page.getByPlaceholder('Nhập mật khẩu').fill('User@123');
    await page.getByRole('button', { name: 'Đăng nhập hệ thống' }).click();

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText('Đăng xuất')).toBeVisible({ timeout: 5000 });
  });

  test('Đăng nhập thành công với tài khoản thủ thư/admin và chuyển hướng vào Admin Portal', async ({ page }) => {
    await page.getByPlaceholder('Nhập tên đăng nhập').fill('admin');
    await page.getByPlaceholder('Nhập mật khẩu').fill('Admin@123');
    await page.getByRole('button', { name: 'Đăng nhập hệ thống' }).click();

    await expect(page).toHaveURL(/\/admin(\/catalog)?$/);
    await expect(page.getByRole('heading', { name: 'Quản lý Danh mục Sách' })).toBeVisible({ timeout: 5000 });
  });
});
