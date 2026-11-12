import { expect, test } from '@playwright/test';

test.describe('Checkout Flow (Tra cứu & Mượn sách trực tuyến)', () => {
  test.beforeEach(async ({ page }) => {
    // Đăng nhập tài khoản sinh viên
    await page.goto('/login');
    await page.getByPlaceholder('Nhập tên đăng nhập').fill('demo_student_001');
    await page.getByPlaceholder('Nhập mật khẩu').fill('User@123');
    await page.getByRole('button', { name: 'Đăng nhập hệ thống' }).click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('Người dùng tra cứu sách trong danh mục, xem chi tiết và thực hiện đặt mượn', async ({ page }) => {
    // 1. Vào danh mục sách
    await page.goto('/catalog');
    await expect(page.getByRole('heading', { name: 'Danh mục Thư viện' })).toBeVisible({ timeout: 5000 });

    // 2. Tìm kiếm sách có sẵn chưa được mượn (b1 hoặc b2 hoặc b3)
    const searchInput = page.getByPlaceholder(/Nhập tên sách, tác giả/i);
    await searchInput.fill('Lập trình Web hiện đại');
    await page.waitForTimeout(500);

    // 3. Chọn xem chi tiết sách
    const detailLink = page.getByRole('link', { name: /Chi tiết/i }).first();
    await detailLink.click();

    // 4. Kiểm tra trang chi tiết sách
    await expect(page).toHaveURL(/\/books\/(?:b1|1)/);
    await expect(page.getByRole('button', { name: 'Đặt mượn' })).toBeVisible();

    // 5. Bấm Đặt mượn và mở modal xác nhận
    await page.getByRole('button', { name: 'Đặt mượn' }).click();
    await expect(page.getByText('Xác nhận đặt mượn')).toBeVisible();

    // 6. Xác nhận đặt mượn
    await page.getByRole('button', { name: 'Đặt mượn' }).last().click();

    // 7. Modal Đặt mượn thành công hiển thị mã phiếu mượn
    await expect(page.getByText('Đặt mượn thành công')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Mã mượn:/i)).toBeVisible();

    // 8. Chuyển sang trang "Sách của tôi" để xem phiếu
    await page.getByRole('button', { name: 'Xem Sách của tôi' }).click();
    await expect(page).toHaveURL(/\/my-books/);
    await expect(page.getByRole('heading', { name: 'Sách của tôi' })).toBeVisible();
  });
});
