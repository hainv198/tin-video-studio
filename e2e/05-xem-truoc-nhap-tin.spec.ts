import { expect, test, type Page } from "@playwright/test";
import { discardDraftIfOffered, login } from "./helpers";

const canvas = (page: Page) => page.getByTestId("xem-truoc-canvas");

async function drawCount(page: Page): Promise<number> {
  return Number(await canvas(page).getAttribute("data-draw-count"));
}

async function snapshot(page: Page): Promise<string> {
  return canvas(page).evaluate((el) => (el as HTMLCanvasElement).toDataURL("image/png"));
}

/** Chờ preview vẽ thêm ít nhất một lần so với `before`. */
async function waitRedraw(page: Page, before: number): Promise<void> {
  await expect.poll(() => drawCount(page), { timeout: 10_000 }).toBeGreaterThan(before);
}

test.describe("Bước 1 — xem trước sống", () => {
  test("canvas xem trước hiện, đổi tiêu đề thì khung đổi, chuyển tab được", async ({ page }) => {
    await login(page);
    await discardDraftIfOffered(page);

    await expect(canvas(page)).toBeVisible();
    await expect.poll(() => drawCount(page), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.getByText("Đang dùng nội dung mẫu")).toBeVisible();

    const before = await snapshot(page);
    const count = await drawCount(page);
    await page.getByLabel("Tiêu đề (để trống thì lấy câu đầu tiên)").fill("Tin thử xem trước");
    await waitRedraw(page, count);
    expect(await snapshot(page)).not.toBe(before);

    const introShot = await snapshot(page);
    const beforeTab = await drawCount(page);
    await page.getByRole("tab", { name: "Cảnh thân bài" }).click();
    await expect(page.getByRole("tab", { name: "Cảnh thân bài" })).toHaveAttribute("aria-selected", "true");
    await waitRedraw(page, beforeTab);
    expect(await snapshot(page)).not.toBe(introShot);

    await page.getByRole("tab", { name: "Thumbnail đầu" }).click();
    await expect(page.getByRole("tab", { name: "Thumbnail đầu" })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: "Điền tin mẫu" }).click();
    await expect(page.getByText("Đang dùng nội dung mẫu")).toBeHidden();
  });
});
