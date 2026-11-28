import { test, expect } from '@playwright/test';

// Chạy trên chế độ mock (MSW trả lời /api/chat), giống các luồng E2E khác.
test.describe('Chat Flow (Trợ lý thư viện)', () => {
  test('Khách mở trợ lý, hỏi gợi ý sách và mở trang chi tiết', async ({ page }) => {
    await page.goto('/catalog');
    await page.getByRole('button', { name: 'Mở trợ lý thư viện' }).click();
    const chat = page.getByRole('dialog', { name: 'Trợ lý thư viện' });

    await chat.getByRole('textbox').fill('Gợi ý sách lập trình');
    await chat.getByRole('button', { name: 'Gửi', exact: true }).click();

    await expect(chat.getByText('Đây là cuốn bạn có thể thích.')).toBeVisible();
    await chat.getByRole('link', { name: /Còn 2 bản/ }).click();
    await expect(page).toHaveURL(/\/books\//);
  });

  test('Hỏi loại sách không có thì nhận câu xin lỗi', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Mở trợ lý thư viện' }).click();
    const chat = page.getByRole('dialog', { name: 'Trợ lý thư viện' });

    await chat.getByRole('textbox').fill('Sách dạy nấu ăn');
    await chat.getByRole('button', { name: 'Gửi', exact: true }).click();

    await expect(chat.getByText('Xin lỗi, hệ thống chưa có loại sách bạn muốn tìm.')).toBeVisible();
  });

  test('Khách bấm Gặp thủ thư thì được mời đăng nhập', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Mở trợ lý thư viện' }).click();
    const chat = page.getByRole('dialog', { name: 'Trợ lý thư viện' });

    await chat.getByRole('button', { name: 'Gặp thủ thư' }).click();

    await expect(chat.getByText('Bạn cần đăng nhập để gửi yêu cầu cho thủ thư.')).toBeVisible();
  });
});
