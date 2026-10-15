import { expect, test } from "@playwright/test";
import { discardDraftIfOffered, expectDraftStored, fillSampleAndSplit, generateVoices, goNext, login, stepButton } from "./helpers";

test("tải lại trang thì được mời mở lại bản nháp, mở lại giữ giọng", async ({ page }) => {
  await login(page);
  await discardDraftIfOffered(page);
  await fillSampleAndSplit(page);
  await goNext(page, "Chọn giọng");
  await generateVoices(page);
  await expectDraftStored(page, 1); // chờ tự lưu (800 ms)
  await page.reload();
  await expect(page.getByText(/^Có bản nháp/)).toBeVisible();
  await page.getByRole("button", { name: "Mở lại" }).click();
  await expect(stepButton(page, 5)).toHaveAttribute("aria-current", "step");
  await stepButton(page, 2).click();
  await expect(page.getByText(/✓ [\d.]+ giây/)).toHaveCount(6);
});

test("hết phiên: API trả 401 thì về trang đăng nhập và bản nháp còn", async ({ page, context }) => {
  await login(page);
  await discardDraftIfOffered(page);
  await fillSampleAndSplit(page);
  await expectDraftStored(page, 1);
  await context.clearCookies();
  await goNext(page, "Chọn giọng"); // bước 2 gọi /api/tts/voices → 401 → về trang đăng nhập ngay
  await expect(page).toHaveURL(/\/dang-nhap\?next=%2Fstudio$/, { timeout: 15_000 });
  await login(page);
  await expect(page.getByText(/^Có bản nháp/)).toBeVisible();
});

test("dự án mới xoá bản nháp", async ({ page }) => {
  await login(page);
  await discardDraftIfOffered(page);
  await fillSampleAndSplit(page);
  await expectDraftStored(page, 1); // đối chứng dương: bản nháp đã lưu
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Dự án mới" }).click();
  await expect(page.getByRole("button", { name: "Chia cảnh" })).toBeVisible();
  await expectDraftStored(page, 0);
});
