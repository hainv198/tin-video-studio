import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

const TEXT = "Tin nhanh hôm nay: trời Hà Nội mưa lớn. Nhiều tuyến phố ngập sâu.\nGiao thông ùn tắc kéo dài đến tối.";

async function openVoiceStudio(page: Page): Promise<void> {
  await expect(page.getByRole("combobox")).toHaveValue("vi-VN-Fake-A");
  await page.getByLabel("Nội dung cần đọc").fill(TEXT);
  await expect(page.getByTestId("dem-ky-tu")).toContainText(`Đã dùng ${TEXT.length}/10.000 ký tự`);
}

async function downloadBytes(page: Page, name: RegExp): Promise<{ fileName: string; bytes: Buffer }> {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name }).click()]);
  const path = test.info().outputPath(download.suggestedFilename());
  await download.saveAs(path);
  return { fileName: download.suggestedFilename(), bytes: readFileSync(path) };
}

test("Tạo giọng riêng: nhập văn bản, tạo giọng theo mẩu, tải WAV (và M4A)", async ({ page }) => {
  // Chậm mỗi lần gọi giọng một chút để thấy được tiến độ theo mẩu.
  await page.route("**/api/tts", async (route) => {
    await new Promise((r) => setTimeout(r, 600));
    await route.continue();
  });
  await login(page);
  await page.getByRole("link", { name: "Tạo giọng" }).click();
  await expect(page).toHaveURL(/\/doc-giong$/);
  await expect(page.getByRole("heading", { name: "Tạo giọng đọc" })).toBeVisible();
  await openVoiceStudio(page);

  await page.getByRole("button", { name: "Tạo giọng", exact: true }).click();
  await expect(page.getByText(/Đang tạo giọng mẩu \d\/2/)).toBeVisible();
  await expect(page.getByText("2 mẩu · xong 2")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Nghe thử" })).toBeVisible();

  const wav = await downloadBytes(page, /^Tải WAV$/);
  expect(wav.fileName).toMatch(/^tin-nhanh-hom-nay-troi-ha_\d{8}\.wav$/);
  const view = new DataView(wav.bytes.buffer, wav.bytes.byteOffset, wav.bytes.byteLength);
  expect(wav.bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(wav.bytes.subarray(8, 12).toString("ascii")).toBe("WAVE");
  expect(view.getUint16(20, true)).toBe(1); // PCM
  expect(view.getUint16(22, true)).toBe(1); // mono
  expect(view.getUint32(24, true)).toBe(48000);
  expect(view.getUint16(34, true)).toBe(16);
  const dataBytes = view.getUint32(40, true);
  expect(dataBytes).toBe(wav.bytes.length - 44);
  const seconds = dataBytes / 2 / 48000;
  // Giọng giả ~0,065 s/ký tự ÷ tốc độ 1,07, cộng một khoảng nghỉ 0,35 s
  expect(seconds).toBeGreaterThan(4);
  expect(seconds).toBeLessThan(10);

  // Tinh chỉnh không gọi lại máy chủ: file ngắn đi khi tăng tốc độ.
  let calls = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/tts")) calls += 1;
  });
  const tempo = page.getByRole("slider", { name: /^Tốc độ: ×/ });
  await tempo.focus();
  await tempo.press("End"); // ×1,40
  await expect(page.getByText("Tốc độ: ×1,40")).toBeVisible();
  const faster = await downloadBytes(page, /^Tải WAV$/);
  expect(faster.bytes.length).toBeLessThan(wav.bytes.length);
  expect(calls).toBe(0);

  await expect(page.getByRole("button", { name: "Tải M4A" })).toBeVisible();
  const m4a = await downloadBytes(page, /^Tải M4A$/);
  expect(m4a.fileName).toMatch(/\.m4a$/);
  expect(m4a.bytes.subarray(4, 8).toString("ascii")).toBe("ftyp");
  expect(m4a.bytes.length).toBeGreaterThan(1000);
});

test("Tạo giọng trên điện thoại 390x844: không cuộn ngang, nút đủ cao", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByLabel("Menu tài khoản").click();
  await page.getByRole("link", { name: "Tạo giọng" }).click();
  await expect(page).toHaveURL(/\/doc-giong$/);
  await openVoiceStudio(page);
  await page.getByRole("button", { name: "Tạo giọng", exact: true }).click();
  await expect(page.getByRole("button", { name: "Tải WAV" })).toBeVisible({ timeout: 30_000 });
  for (const name of ["Tạo giọng", "Nghe thử", "Tải WAV"]) {
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(44);
  }
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  await page.getByRole("link", { name: "← Về trình dựng" }).click();
  await expect(page).toHaveURL(/\/studio$/);
});
