import { expect, test } from "@playwright/test";
import { discardDraftIfOffered, fillSampleAndSplit, login, stepButton } from "./helpers";

test.describe("Bước 1 — nhập tin", () => {
  test("đăng nhập, điền tin mẫu, chia 6 cảnh, các bước sau còn khoá", async ({ page }) => {
    await login(page);
    await discardDraftIfOffered(page);
    await expect(stepButton(page, 2)).toBeDisabled();
    await fillSampleAndSplit(page);
    await expect(stepButton(page, 2)).toBeEnabled();
    await expect(stepButton(page, 3)).toBeDisabled();
    await expect(page.getByText("Cảnh mở đầu (tiêu đề)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gộp với câu sau" })).toHaveCount(5);
  });

  test("gộp và tách cảnh đổi số cảnh", async ({ page }) => {
    await login(page);
    await discardDraftIfOffered(page);
    await fillSampleAndSplit(page);
    await page.getByRole("button", { name: "Gộp với câu sau" }).first().click();
    await expect(page.getByRole("heading", { name: /^Các cảnh \(5\)$/ })).toBeVisible();
    const textarea = page.locator("textarea").nth(1);
    await textarea.click();
    await textarea.evaluate((el) => {
      const t = el as HTMLTextAreaElement;
      const at = t.value.indexOf(" ", 40);
      t.setSelectionRange(at, at);
    });
    await page.getByRole("button", { name: "Tách tại con trỏ" }).first().click();
    await expect(page.getByRole("heading", { name: /^Các cảnh \(6\)$/ })).toBeVisible();
  });

  test("chưa đăng nhập thì /studio chuyển về trang đăng nhập", async ({ page }) => {
    await page.goto("/studio");
    await expect(page).toHaveURL(/\/dang-nhap\?next=%2Fstudio$/);
  });
});
