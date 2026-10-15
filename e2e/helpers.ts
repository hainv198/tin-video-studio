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
  return page.getByRole("button", { name: new RegExp(`^${n}\. `) });
}
