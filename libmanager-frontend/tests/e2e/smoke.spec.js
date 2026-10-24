import { expect, test } from '@playwright/test';

test('homepage and catalog are available', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/LibManager|Thư viện/i);
  await page.getByRole('link', { name: 'Danh mục', exact: true }).first().click();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByText('Danh mục Thư viện')).toBeVisible();
});

test('mock login routes an admin account into the admin portal', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Nhập tên đăng nhập').fill('admin');
  await page.getByPlaceholder('Nhập mật khẩu').fill('Admin@123');
  await page.getByRole('button', { name: 'Đăng nhập hệ thống' }).click();
  await expect(page).toHaveURL(/\/admin$/);
});
