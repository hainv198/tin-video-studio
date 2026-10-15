import { statSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { autoFillFootage, discardDraftIfOffered, fillSampleAndSplit, generateVoices, goNext, login, renderAndDownload } from "./helpers";

test("đi trọn 5 bước với nhà cung cấp giả và tải về MP4", async ({ page }) => {
  await login(page);
  await discardDraftIfOffered(page);
  await fillSampleAndSplit(page);
  await goNext(page, "Chọn giọng");
  await expect(page.getByRole("combobox").first()).toContainText("Fake");
  await generateVoices(page);
  await goNext(page, "Cảnh trám");
  await autoFillFootage(page);
  await goNext(page, "Nhạc nền");
  await page.getByRole("radio", { name: /Bản tin/ }).check();
  await goNext(page, "Dựng video");
  await expect(page.getByText("Hãy dùng Chrome hoặc Edge")).toHaveCount(0);

  const started = Date.now();
  const file = await renderAndDownload(page);
  const elapsedSec = (Date.now() - started) / 1000;
  const sizeMb = statSync(file).size / 1024 / 1024;
  expect(file).toMatch(/phu-tho-.*_20261014\.mp4$/);
  expect(sizeMb).toBeGreaterThan(0.5);
  const shown = await page.getByText(/[\d.]+ giây, [\d.]+ MB/).textContent();
  const durationSec = Number(shown?.match(/([\d.]+) giây/)?.[1]);
  expect(durationSec).toBeGreaterThan(20);
  expect(elapsedSec).toBeLessThan(durationSec * 1.5 + 10);
  console.log(`[e2e] dựng ${durationSec} s mất ${elapsedSec.toFixed(1)} s, ${sizeMb.toFixed(1)} MB → ${file}`);

  // Đo âm nếu có ffmpeg (giọng giả là sóng sin nên chỉ kiểm giới hạn rộng)
  const { measureFile } = await import("../scripts/measure-mp4");
  let metrics: ReturnType<typeof measureFile> | null = null;
  try {
    metrics = measureFile(file);
  } catch {
    console.log("[e2e] bỏ qua đo âm (không có ffmpeg)");
  }
  if (metrics) {
    expect(metrics.peak).toBeLessThan(0.89);
    expect(metrics.voicedRmsDb).toBeGreaterThan(-19);
    expect(metrics.voicedRmsDb).toBeLessThan(-14);
    expect(Math.abs(metrics.durationSec - durationSec)).toBeLessThan(0.5);
    console.log(`[e2e] âm: có tiếng ${metrics.voicedRmsDb.toFixed(2)} dB, đỉnh ${metrics.peak.toFixed(3)}, nghỉ ${metrics.quietRmsDb.toFixed(2)} dB`);
  }
});

test("huỷ giữa chừng rồi dựng lại", async ({ page }) => {
  await login(page);
  await discardDraftIfOffered(page);
  await fillSampleAndSplit(page);
  await goNext(page, "Chọn giọng");
  await generateVoices(page);
  await goNext(page, "Cảnh trám");
  await goNext(page, "Nhạc nền");
  await goNext(page, "Dựng video");
  await page.getByRole("button", { name: "Dựng video", exact: true }).click();
  await expect(page.getByText(/Dựng hình \d+%/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Huỷ" }).click();
  await expect(page.getByRole("button", { name: "Dựng video", exact: true })).toBeEnabled();
  await expect(page.getByTestId("ket-qua")).toHaveCount(0);
  await renderAndDownload(page, "test-results", "huy-roi-dung-lai-"); // tên khác để không đè file của bài trên
});
