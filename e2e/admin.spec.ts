import { test, expect, type Page } from '@playwright/test';

async function loginAdmin(page: Page) {
  await page.goto('/#admin');
  await page.getByLabel('Email', { exact: true }).fill('admin@e2e.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('E2E-only-password-2026');
  await page.getByRole('button', { name: 'Vào khu quản trị', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hôm nay, mình chăm gánh nào?' })).toBeVisible();
}

test('admin login, navigation and mobile layout', async ({ page }, info) => {
  await loginAdmin(page);
  await expect(page.locator('.admin-metric')).toHaveCount(4);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({
    path: `docs/screenshots/admin-${info.project.name}.png`,
    fullPage: true,
    scale: 'css',
  });
  await page.getByRole('link', { name: 'Nguồn tham khảo', exact: true }).click();
  await expect(page.locator('.admin-reference-card')).toHaveCount(130);
  await page.screenshot({
    path: `docs/screenshots/admin-sources-${info.project.name}.png`,
    fullPage: true,
    scale: 'css',
  });
  await page.reload();
  await expect(page.locator('.admin-reference-card')).toHaveCount(130);
});

test('reference draft stays private and editing has clear required publication fields', async ({
  page,
}) => {
  await loginAdmin(page);
  await page.getByRole('link', { name: 'Nguồn tham khảo', exact: true }).click();
  const card = page.locator('.admin-reference-card').first();
  await card.getByRole('button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Tên gánh hàng *', exact: true })).toHaveValue(
    'Gánh chè cụ Mai',
  );
  await expect(page.getByRole('spinbutton', { name: 'Giá tham khảo (đ)' })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Trạng thái', exact: true })).toHaveValue(
    'draft',
  );
  await page.getByRole('button', { name: 'Lưu gánh hàng', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const result = await page.request.get('/api/catalog');
  expect(
    (await result.json()).vendors.some((v: { name: string }) => v.name === 'Gánh chè cụ Mai'),
  ).toBe(false);
});

test('admin creates and edits a draft vendor, and creates a draft quest', async ({
  page,
}, info) => {
  await loginAdmin(page);
  await page.getByRole('button', { name: 'Thêm gánh hàng', exact: true }).click();
  const name = `Gánh thử UI ${info.project.name}`;
  await page.getByRole('textbox', { name: 'Tên gánh hàng *', exact: true }).fill(name);
  await page.getByRole('textbox', { name: 'Món / mặt hàng' }).fill('Bánh thử');
  await page.getByRole('button', { name: 'Lưu gánh hàng', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Gánh hàng & câu chuyện', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tìm nội dung quản trị' }).fill(name);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: `Sửa ${name}`, exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Câu chuyện (chỉ đăng khi được đồng ý)' })
    .fill('Câu chuyện nhập trong kiểm thử, không phải nhân vật thực tế.');
  await page.getByRole('button', { name: 'Lưu gánh hàng', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Hành trình khám phá', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm hành trình', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Tên hành trình' })
    .fill(`Hành trình nháp ${info.project.name}`);
  await page.getByRole('checkbox', { name: 'Bột chiên cô Ba Đang hiển thị' }).check();
  await page.getByRole('checkbox', { name: 'Chè dì Sáu Đang hiển thị' }).check();
  await page.getByRole('button', { name: 'Lưu hành trình', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('tbody')).toContainText(`Hành trình nháp ${info.project.name}`);
});

test('user signup, contribution, forbidden admin and review status round-trip', async ({
  page,
}, info) => {
  const email = `explorer-${info.project.name}@e2e.test`;
  await page.goto('/#account');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await page.getByLabel('Tên của bạn', { exact: true }).fill('Người khám phá');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('E2E-user-password-2026');
  await page.getByRole('button', { name: 'Tạo tài khoản & bắt đầu', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Chào Người khám phá');
  await page.goto('/#admin');
  await expect(
    page.getByRole('heading', { name: 'Góc này dành cho người giữ gánh.' }),
  ).toBeVisible();
  expect((await page.request.get('/api/admin/users')).status()).toBe(403);
  await page.goto('/#contribute');
  const name = `Gánh cộng đồng UI ${info.project.name}`;
  await page.getByRole('textbox', { name: 'Tên gánh hàng' }).fill(name);
  await page.getByRole('textbox', { name: 'Món / mặt hàng' }).fill('Chè đậu');
  await page
    .getByRole('textbox', { name: 'Địa chỉ / mô tả vị trí' })
    .fill('Góc đường cần xác minh trong kiểm thử');
  await page
    .getByRole('textbox', { name: 'Bạn đã thấy gì?' })
    .fill('Đây là nội dung kiểm thử. Giờ bán và vị trí cần được rà soát.');
  await page.getByRole('button', { name: 'Gửi để quản trị viên xem xét' }).click();
  await expect(page.getByRole('heading', { name: 'Một địa chỉ đã được gửi đi.' })).toBeVisible();
  await page.getByRole('button', { name: 'Theo dõi đóng góp' }).click();
  await expect(page.locator('.contribution-history')).toContainText('Chờ xem xét');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await loginAdmin(page);
  await page.getByRole('link', { name: /Đóng góp chờ duyệt/ }).click();
  await page.getByRole('button', { name: `Xem xét ${name}`, exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Phản hồi cho người đóng góp' })
    .fill('Đã tiếp nhận, cần khảo sát lại giờ bán.');
  await page.getByRole('button', { name: 'Tiếp nhận & tạo bản nháp' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/#account');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('E2E-user-password-2026');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.contribution-history')).toContainText('Đã tiếp nhận vào bản nháp');
  await expect(page.locator('.contribution-history')).toContainText(
    'Đã tiếp nhận, cần khảo sát lại giờ bán.',
  );
});
