import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

export const E2E_USER = "e2e";

export function e2ePassword(): string {
  const p = process.env.E2E_PASSWORD;
  if (!p) throw new Error("Thiếu E2E_PASSWORD (global-setup chưa chạy hoặc chạy trên bản deploy mà chưa đặt biến)");
  return p;
}

export async function login(page: Page): Promise<void> {
  await page.goto("/dang-nhap?next=%2Fstudio");
  await page.getByRole("textbox").first().fill(process.env.E2E_USER ?? E2E_USER);
  await page.locator('input[type="password"]').fill(e2ePassword());
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole("button", { name: "1. Nhập tin" })).toBeVisible();
}

/** Nếu còn bản nháp cũ thì bỏ, để mỗi test bắt đầu sạch. */
export async function discardDraftIfOffered(page: Page): Promise<void> {
  const discard = page.getByRole("button", { name: "Bỏ bản nháp" });
  if (await discard.isVisible({ timeout: 1500 }).catch(() => false)) await discard.click();
}

export async function fillSampleAndSplit(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Điền tin mẫu" }).click();
  await page.getByRole("button", { name: "Chia cảnh" }).click();
  await expect(page.getByRole("heading", { name: /^Các cảnh \(6\)$/ })).toBeVisible();
}

export async function goNext(page: Page, label: string): Promise<void> {
  const next = page.getByRole("button", { name: `Tiếp tục: ${label}` });
  await expect(next).toBeEnabled();
  await next.click();
}

export function stepButton(page: Page, n: 1 | 2 | 3 | 4 | 5) {
  return page.getByRole("button", { name: new RegExp(`^${n}\\. `) });
}

export async function generateVoices(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Tạo giọng" }).click();
  await expect(page.getByText(/✓ [\d.]+ giây/)).toHaveCount(6, { timeout: 60_000 });
}

export async function autoFillFootage(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Tự tìm cảnh còn trống" }).click();
  await expect(page.getByRole("button", { name: "Tự tìm cảnh còn trống" })).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole("img", { name: "Cảnh trám đang chọn" })).toHaveCount(6);
}

export async function renderAndDownload(page: Page, dir = "test-results", prefix = ""): Promise<string> {
  // exact: true vì nút bước "5. Dựng video" cũng chứa chữ này
  await page.getByRole("button", { name: "Dựng video", exact: true }).click();
  await expect(page.getByTestId("ket-qua")).toBeVisible({ timeout: 150_000 });
  mkdirSync(dir, { recursive: true });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /^Tải MP4/ }).click(),
  ]);
  const path = join(dir, prefix + download.suggestedFilename());
  await download.saveAs(path);
  return path;
}
