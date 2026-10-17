import { expect, test, type Locator, type Page } from "@playwright/test";
import { autoFillFootage, discardDraftIfOffered, generateVoices, goNext, login } from "./helpers";

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const;
/** Ảnh chụp hiện trạng để người xem duyệt bằng mắt (chỉ chụp ở 390 px, sau các khẳng định). */
const SHOT_WIDTH = 390;
const SHOT_DIR = ".superpowers/mobile/";

async function expectNoHorizontalScroll(page: Page, screen: string): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `${screen}: cuộn ngang toàn trang`).toBeLessThanOrEqual(innerWidth);
}

async function expectTapHeight(button: Locator): Promise<void> {
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
}

/** Thanh điều hướng dính đáy: hiện ở mép dưới màn hình ngay cả khi trang đang ở đầu. */
async function expectStickyNav(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  const nav = page.getByRole("navigation", { name: "Điều hướng bước" });
  await expect(nav).toBeVisible();
  const box = await nav.boundingBox();
  const height = page.viewportSize()?.height ?? 0;
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
  expect(box!.y + box!.height).toBeGreaterThan(height - 4);
}

async function check(page: Page, screen: string, width: number): Promise<void> {
  await expectNoHorizontalScroll(page, screen);
  if (width === SHOT_WIDTH) await page.screenshot({ path: `${SHOT_DIR}${screen}.png`, fullPage: true });
}

for (const vp of VIEWPORTS) {
  test(`điện thoại ${vp.width}x${vp.height}: không cuộn ngang, nút đủ cao, thanh điều hướng dính đáy`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto("/dang-nhap");
    await expectTapHeight(page.getByRole("button", { name: "Đăng nhập" }));
    await check(page, "0-dang-nhap", vp.width);

    await login(page);
    await discardDraftIfOffered(page);

    // Đầu trang: menu thu gọn chứa lời chào và liên kết
    await page.getByLabel("Menu tài khoản").click();
    await expect(page.getByRole("link", { name: "Cấu hình" })).toBeVisible();
    await expectTapHeight(page.getByRole("button", { name: "Đăng xuất" }));
    await page.getByLabel("Menu tài khoản").click();
    await expect(page.getByRole("link", { name: "Cấu hình" })).toBeHidden();

    // Ngăn kéo Tuỳ chọn video: mở, đóng bằng nút Đóng
    const side = page.getByRole("complementary", { name: "Tuỳ chọn video" });
    const toggle = side.getByRole("button", { name: /Tuỳ chọn video/ });
    await expectTapHeight(toggle);
    await toggle.click();
    await expect(side.getByRole("checkbox", { name: "Hiện phụ đề" })).toBeVisible();
    await side.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(side.getByRole("checkbox", { name: "Hiện phụ đề" })).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await page.getByRole("button", { name: "Điền tin mẫu" }).click();
    await expectTapHeight(page.getByRole("button", { name: "Chia cảnh" }));
    await expectStickyNav(page);
    await expect(page.getByText("Hãy chia cảnh từ tin của bạn trước.")).toBeVisible();
    await check(page, "1a-nhap-tin", vp.width);

    await page.getByRole("button", { name: "Chia cảnh" }).click();
    await expect(page.getByRole("heading", { name: /^Các cảnh \(6\)$/ })).toBeVisible();
    await expectTapHeight(page.getByRole("button", { name: "Tiếp tục: Chọn giọng" }));
    await check(page, "1b-sau-chia-canh", vp.width);

    await goNext(page, "Chọn giọng");
    await expectTapHeight(page.getByRole("button", { name: "Tạo giọng" }));
    await generateVoices(page);
    await expectStickyNav(page);
    await check(page, "2-giong", vp.width);

    await goNext(page, "Cảnh trám");
    await autoFillFootage(page);
    await expectStickyNav(page);
    await check(page, "3-canh-tram", vp.width);

    await goNext(page, "Nhạc nền");
    await expect(page.getByRole("radio", { name: "Epic Dramatic Trailer" })).toBeVisible();
    await check(page, "4-nhac", vp.width);

    await goNext(page, "Dựng video");
    await expectTapHeight(page.getByRole("button", { name: "Dựng video", exact: true }));
    await check(page, "5-dung", vp.width);

    await page.goto("/cai-dat");
    await expect(page.getByRole("heading", { name: "Cấu hình", exact: true })).toBeVisible();
    await check(page, "6-cai-dat", vp.width);

    await page.goto("/tai-khoan");
    await expect(page.getByRole("heading", { name: "Tài khoản", exact: true })).toBeVisible();
    await expectTapHeight(page.getByRole("button", { name: "Đổi mật khẩu" }).first());
    await check(page, "7-tai-khoan", vp.width);
  });
}
