import { expect, test } from '@playwright/test';

test.describe('Waitlist Flow (Hẹn đặt trước khi sách hết bản sao)', () => {
  test.beforeEach(async ({ page }) => {
    // Đăng nhập tài khoản sinh viên
    await page.goto('/login');
    await page.getByPlaceholder('Nhập tên đăng nhập').fill('demo_student_001');
    await page.getByPlaceholder('Nhập mật khẩu').fill('User@123');
    await page.getByRole('button', { name: 'Đăng nhập hệ thống' }).click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('Người dùng xem chi tiết sách hết bản sao và thực hiện hẹn đặt trước thành công', async ({ page }) => {
    // 1. Vào trang chi tiết sách b4 (Kinh tế vi mô - availableCopies = 0)
    await page.goto('/books/b4');
    await expect(page.getByText('Tạm thời hết bản sao trên kệ')).toBeVisible({ timeout: 5000 });

    // 2. Nút "Hẹn đặt trước" hiển thị thay vì "Đặt mượn"
    const waitlistBtn = page.getByRole('button', { name: 'Hẹn đặt trước' });
    await expect(waitlistBtn).toBeVisible();

    // 3. Nhấp "Hẹn đặt trước"
    await waitlistBtn.click();

    // 4. Modal xác nhận đặt trước xuất hiện
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Hẹn đặt trước' })).toBeVisible();

    // 5. Xác nhận hẹn đặt trước trong modal
    await dialog.getByRole('button', { name: 'Hẹn đặt trước' }).click();

    // 6. Kiểm tra toast thông báo vị trí hàng đợi thành công
    await expect(page.getByText(/Đã hẹn đặt trước\. Bạn đang ở vị trí số/i)).toBeVisible({ timeout: 5000 });
  });
});
