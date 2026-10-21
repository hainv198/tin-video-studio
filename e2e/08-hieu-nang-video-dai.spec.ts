import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { decodeFileAudio } from "../scripts/measure-mp4";
import { makeSampleClip } from "../scripts/make-sample-clip";
import { toneRmsDb } from "../scripts/lib/audioMetrics";
import { discardDraftIfOffered, goNext, login, startUploadProject, uploadClip } from "./helpers";

/** Chỉ chạy khi PERF_CLIP=1 (lâu: tạo video 1080p 60 s và 300 s rồi dựng). Số đo ghi vào đặc tả §15. */
const CASES = [
  { seconds: 60, clock: "1:00", factor: 1.0, slackSec: 15 },
  { seconds: 300, clock: "5:00", factor: 1.2, slackSec: 30 },
] as const;

for (const c of CASES) {
  test(`hiệu năng: video tải lên 1080p ${c.seconds} s`, async ({ page }) => {
    test.skip(process.env.PERF_CLIP !== "1", "đặt PERF_CLIP=1 để đo");
    test.setTimeout(20 * 60_000);
    const clip = makeSampleClip({ out: join("test-results", "hieu-nang", `clip-${c.seconds}.mp4`), seconds: c.seconds, width: 1920, height: 1080, audio: true });
    await login(page);
    await discardDraftIfOffered(page);
    await startUploadProject(page, `Đo hiệu năng ${c.seconds} giây`);
    await uploadClip(page, clip, c.clock);
    await goNext(page, "Giọng tiêu đề");
    await page.getByRole("button", { name: "Tạo giọng" }).click();
    await expect(page.getByText(/✓ [\d.]+ giây/)).toHaveCount(1, { timeout: 60_000 });
    await goNext(page, "Nhạc nền");
    await page.getByRole("radio", { name: /Bản tin/ }).check();
    await goNext(page, "Dựng video");
    await page.getByRole("radio", { name: /Nhẹ/ }).check();

    const started = Date.now();
    await page.getByRole("button", { name: "Dựng video", exact: true }).click();
    await expect(page.getByTestId("ket-qua")).toBeVisible({ timeout: 15 * 60_000 });
    const elapsed = (Date.now() - started) / 1000;
    const shown = await page.getByText(/[\d.]+ giây, [\d.]+ MB/).textContent();
    const total = Number(shown?.match(/([\d.]+) giây/)?.[1]);
    const sizeMb = Number(shown?.match(/([\d.]+) MB/)?.[1]);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /^Tải MP4/ }).click()]);
    const file = test.info().outputPath(download.suggestedFilename());
    await download.saveAs(file);
    const audio = decodeFileAudio(file);
    const mid = toneRmsDb(audio.channels, audio.sampleRate, total - c.seconds / 2 - 1, total - c.seconds / 2 + 1, 440);
    console.log(`[perf] video ${c.seconds} s: tổng ${total} s, dựng ${elapsed.toFixed(1)} s (${(elapsed / total).toFixed(2)}×), ${sizeMb} MB, tiếng gốc giữa bài ${mid.toFixed(2)} dB`);
    expect(Math.abs(total - c.seconds) < 15).toBe(true);
    expect(elapsed).toBeLessThan(total * c.factor + c.slackSec);
    expect(mid).toBeGreaterThan(20 * Math.log10(0.125 / Math.SQRT2) - 1.5);
  });
}
