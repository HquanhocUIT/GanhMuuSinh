import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // External map/font availability is not required for core app behavior.
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Đi một vòng');
});

test('home renders real images, responsive layout, filtering and clear empty states', async ({
  page,
}, info) => {
  await expect(page.locator('.quest-card')).toHaveCount(3);
  await expect
    .poll(() =>
      page
        .locator('.hero-photo img')
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.locator('img').evaluateAll(async (images) => {
    await Promise.all(
      images.map((image) => {
        image.loading = 'eager';
        return image.decode();
      }),
    );
  });
  await page.screenshot({
    path: `docs/screenshots/home-${info.project.name}.png`,
    fullPage: true,
    scale: 'css',
  });
  await page.screenshot({
    path: `docs/screenshots/home-${info.project.name}-fold.png`,
    scale: 'css',
  });
  await page.getByRole('combobox', { name: 'Khu vực', exact: true }).selectOption('vungtau');
  await expect(page.locator('.quest-card')).toHaveCount(1);
  await expect(page.locator('.quest-card')).toContainText('Nếm một chút nắng');
  await page.getByRole('textbox', { name: 'Tìm món hoặc hành trình' }).fill('không có món này');
  await expect(page.getByRole('heading', { name: 'Chưa tìm thấy hành trình vừa ý' })).toBeVisible();
  await page.getByRole('button', { name: 'Đặt lại bộ lọc' }).click();
  await expect(page.locator('.quest-card')).toHaveCount(3);
});

test('saved journeys persist and modal supports Escape and focus restoration', async ({ page }) => {
  await page.getByRole('button', { name: 'Lưu Một chiều lạc trong hẻm nhỏ', exact: true }).click();
  await page.getByRole('button', { name: 'Đã lưu' }).click();
  await expect(page.locator('.quest-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.quest-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Một chiều lạc trong hẻm nhỏ', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Đóng / Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Một chiều lạc trong hẻm nhỏ', exact: true }),
  ).toBeFocused();
});

test('custom planner honors exclusions and starts an active journey', async ({ page }) => {
  await page.getByRole('button', { name: 'Khẩu vị & dị ứng' }).click();
  await page.getByRole('checkbox', { name: 'Đậu phộng' }).check();
  await page.getByRole('button', { name: 'Gợi ý cho mình' }).click();
  await expect(page.getByRole('dialog')).toContainText('Một hành trình, đúng vị của bạn');
  await expect
    .poll(() =>
      page.evaluate(
        () => (visualViewport?.offsetLeft ?? 0) === 0 && (visualViewport?.offsetTop ?? 0) === 0,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page
        .getByRole('dialog')
        .evaluate((element) => element.getBoundingClientRect().right <= window.innerWidth),
    )
    .toBe(true);
  await expect(page.locator('.preview-stops')).not.toContainText('Gỏi khô bò');
  await page.getByRole('button', { name: 'Bắt đầu hành trình này' }).click();
  await expect(page).toHaveURL(/#journey$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Một hành trình');
  await expect(page.locator('.itinerary>li')).toHaveCount(4);
  await expect(page.locator('.food-map')).toBeVisible();
  await page.reload();
  await expect(page.locator('.itinerary>li')).toHaveCount(4);
});

test('ward suggestion previews, starts, scans and stamps an ordered route', async ({ page }) => {
  await page.locator('.planner-ward-search input').fill('Phường Bến Thành');
  await page.getByRole('button', { name: 'Gợi ý cho mình' }).click();
  await expect(page.locator('.ward-route-card')).toHaveCount(3);
  await page
    .locator('.ward-route-card')
    .first()
    .getByRole('button', { name: /Xem trước hành trình/ })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Vòng 1 · Phường Bến Thành');
  await page.getByRole('button', { name: 'Bắt đầu hành trình này' }).click();

  await expect(page).toHaveURL(/#ward-journey\?ward=.*&route=.*/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Phường Bến Thành');
  await expect(page.locator('.ward-itinerary > li')).toHaveCount(3);
  await expect(page.locator('.food-pin-ward')).toHaveCount(3);
  await expect(page.locator('.journey-progress')).toContainText('0/3');
  const routeUrl = page.url();
  await expect(page.getByRole('link', { name: /Chỉ đường đến điểm đầu/ })).toHaveAttribute(
    'href',
    /google\.com\/maps\/dir\/\?api=1&destination=/,
  );
  const firstPinId = await page.evaluate(
    () => JSON.parse(localStorage.getItem('gms-ward-route')!).stops[0].id,
  );
  await page
    .locator('.ward-itinerary > li')
    .first()
    .getByRole('button', { name: /Food X-Ray/ })
    .click();
  await expect(page.locator('#tool-vendor')).toHaveValue(firstPinId);
  await page.getByRole('button', { name: 'Thử trải nghiệm minh họa' }).click();
  await expect(page.locator('.scan-success')).toBeVisible();
  await page.getByRole('button', { name: 'Mở hộ chiếu' }).click();
  await expect(page.locator('.reference-passport .badge-card')).toHaveCount(1);
  await expect(page.locator('.reference-passport')).toContainText('Gánh chè cụ Mai');
  await page.goto(routeUrl);
  await expect(page.locator('.journey-progress')).toContainText('1/3');

  await page.reload();
  await expect(page.locator('.ward-itinerary > li')).toHaveCount(3);
  await expect(page.locator('.journey-progress')).toContainText('1/3');
  await page.getByRole('button', { name: 'Chọn tuyến khác' }).click();
  await expect(page.locator('.ward-route-card')).toHaveCount(3);
});

test('voice options compose a real order and phrasebook translates without AI', async ({
  page,
}) => {
  await page.goto('/#voice');
  await expect(page.getByRole('heading', { name: 'Gọi món theo ý bạn' })).toBeVisible();
  await page.getByRole('button', { name: 'No peanuts Không đậu phộng' }).click();
  await page.getByRole('button', { name: 'Less spicy Ít cay' }).click();
  await page.getByRole('button', { name: 'Take away Mang về' }).click();
  await page.getByRole('button', { name: 'Thêm một phần' }).click();
  await expect(page.locator('.order-sentence')).toContainText('2 phần');
  await expect(page.locator('.order-sentence')).toContainText('không đậu phộng');
  await expect(page.getByRole('button', { name: 'Phát lời gọi món' })).toBeEnabled();
  await page.getByRole('button', { name: 'Thử một câu mẫu' }).click();
  await page.getByRole('button', { name: 'Dịch sang tiếng Anh' }).click();
  await expect(page.locator('.translation-result')).toContainText('quail eggs');
  await expect(page.locator('.translation-result')).toContainText('bộ câu mẫu');
});

test('scan demo persists a clearly labeled passport stamp and story', async ({ page }, info) => {
  await page.goto('/#scan');
  await expect(page.getByRole('button', { name: 'Quét món bằng AI' })).toBeDisabled();
  await page.getByRole('button', { name: 'Thử trải nghiệm minh họa' }).click();
  await expect(page.locator('.scan-success')).toContainText('DẤU MINH HỌA');
  await expect(page.locator('.food-facts')).toContainText('Trứng');
  await page.screenshot({
    path: `docs/screenshots/scanner-${info.project.name}.png`,
    fullPage: true,
    scale: 'css',
  });
  await page.getByRole('button', { name: 'Nghe chuyện của gánh' }).click();
  await expect(page.getByRole('dialog')).toContainText('dữ liệu minh họa');
  await page.getByRole('button', { name: 'Đóng / Close' }).click();
  await page.getByRole('button', { name: 'Mở hộ chiếu' }).click();
  await expect(page.locator('.badge-card.unlocked')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.badge-card.unlocked')).toHaveCount(1);
  await expect(page.locator('.passport-stats')).toContainText('Dấu minh họa');
  await page.screenshot({
    path: `docs/screenshots/passport-${info.project.name}.png`,
    fullPage: true,
    scale: 'css',
  });
});

test('upload previews local photos and rejects invalid files', async ({ page }) => {
  await page.goto('/#scan');
  await page
    .getByLabel('Tải ảnh món ăn', { exact: true })
    .setInputFiles({ name: 'wrong.txt', mimeType: 'text/plain', buffer: Buffer.from('not food') });
  await expect(page.getByRole('alert')).toContainText('Chọn ảnh JPEG');
  await page
    .getByLabel('Tải ảnh món ăn', { exact: true })
    .setInputFiles('fe/public/images/banhmi.jpg');
  await expect(page.getByRole('img', { name: 'Ảnh món ăn bạn vừa chọn' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('locale toggle and skip link work without losing the page', async ({ page }) => {
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Đi một vòng');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Take a little walk');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('pages fit phone, landscape, tablet and desktop with reduced motion', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'Viewport sweep runs once.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const size of [
    { width: 320, height: 740 },
    { width: 812, height: 375 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(size);
    for (const route of ['discover', 'voice', 'passport', 'stories', 'map']) {
      await page.goto(`/#${route}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect
        .poll(
          () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          { message: `${route} at ${size.width}px has horizontal overflow` },
        )
        .toBe(true);
    }
  }
});
