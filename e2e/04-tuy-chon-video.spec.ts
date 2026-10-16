import { expect, test, type Page } from "@playwright/test";
import { discardDraftIfOffered, expectDraftSaved, fillSampleAndSplit, goNext, login, stepButton } from "./helpers";

export const sidebar = (page: Page) => page.getByRole("complementary", { name: "Tuỳ chọn video" });

test("thanh Tuỳ chọn video hiện ở mọi bước và được nhớ trong bản nháp", async ({ page }) => {
  await login(page);
  await discardDraftIfOffered(page);
  const side = sidebar(page);
  await expect(side).toBeVisible();
  const subtitles = side.getByRole("checkbox", { name: "Hiện phụ đề" });
  await expect(subtitles).toBeChecked();
  await expect(side.getByLabel("Font phụ đề")).toHaveValue("phudu");
  await expect(side.getByLabel("Font chữ tiêu đề và nhãn")).toHaveValue("barlow-condensed");
  await expect(side.getByLabel("Màu nền thumbnail")).toHaveValue("#1f9d55");
  await expect(side.getByRole("radio", { name: "Cả ảnh và video" })).toBeChecked();
  await subtitles.uncheck();
  await expect(side.getByLabel("Font phụ đề")).toBeDisabled();
  await subtitles.check();
  await expect(side.getByLabel("Font phụ đề")).toBeEnabled();

  await fillSampleAndSplit(page);
  await side.getByLabel("Font phụ đề").selectOption("be-vietnam-pro");
  await side.getByLabel("Font chữ tiêu đề và nhãn").selectOption("oswald");
  await side.getByLabel("Màu nền thumbnail").fill("#123456");
  await side.getByLabel("Màu khối sau tiêu đề").fill("#c0392b");
  await side.getByRole("radio", { name: "Ưu tiên ảnh" }).check();
  await goNext(page, "Chọn giọng");
  await expect(side).toBeVisible();
  await expectDraftSaved(page, (d) => d.subtitleFontId === "be-vietnam-pro" && d.textFontId === "oswald");

  await page.reload();
  await page.getByRole("button", { name: "Mở lại" }).click();
  await expect(stepButton(page, 2)).toHaveAttribute("aria-current", "step");
  await expect(side.getByLabel("Font phụ đề")).toHaveValue("be-vietnam-pro");
  await expect(side.getByLabel("Font chữ tiêu đề và nhãn")).toHaveValue("oswald");
  await expect(side.getByLabel("Màu nền thumbnail")).toHaveValue("#123456");
  await expect(side.getByLabel("Màu khối sau tiêu đề")).toHaveValue("#c0392b");
  await expect(side.getByRole("radio", { name: "Ưu tiên ảnh" })).toBeChecked();
  await side.getByRole("button", { name: "Về mặc định" }).click();
  await expect(side.getByLabel("Màu nền thumbnail")).toHaveValue("#1f9d55");
  await expect(side.getByLabel("Màu khối sau tiêu đề")).toHaveValue("#1f9d55");
  await expect(side.getByRole("button", { name: "Về mặc định" })).toBeDisabled();
});

test("màn hẹp: tuỳ chọn thu gọn thành ngăn kéo phía trên các bước", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 });
  await login(page);
  await discardDraftIfOffered(page);
  const side = sidebar(page);
  const toggle = side.getByRole("button", { name: /Tuỳ chọn video/ });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(side.getByRole("checkbox", { name: "Hiện phụ đề" })).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(side.getByRole("checkbox", { name: "Hiện phụ đề" })).toBeVisible();
  const sideBox = await side.boundingBox();
  const stepBox = await stepButton(page, 1).boundingBox();
  expect(sideBox && stepBox && sideBox.y < stepBox.y).toBe(true);
});
