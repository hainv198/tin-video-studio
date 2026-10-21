import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FfmpegMissingError, decodeFileAudio } from "../scripts/measure-mp4";
import { makeSampleClip } from "../scripts/make-sample-clip";
import { toneRmsDb } from "../scripts/lib/audioMetrics";
import { grabRegion, type Region } from "../scripts/lib/frameRegion";
import { discardDraftIfOffered, goNext, login, renderAndDownload, startUploadProject, stepButton, uploadClip } from "./helpers";

const CLIP_SEC = 8;
/** Sin lavfi mặc định biên độ 1/8 → RMS −21,07 dB. */
const SINE_DB = 20 * Math.log10(0.125 / Math.SQRT2);
const DIR = join("test-results", "mau-video-tai-len");
let withAudio = "";
let silent = "";
let portrait = "";
let landscape = "";
let square = "";
let ffmpeg = true;

test.beforeAll(() => {
  try {
    withAudio = makeSampleClip({ out: join(DIR, "clip-440.mp4"), seconds: CLIP_SEC, width: 1280, height: 720, audio: true });
    silent = makeSampleClip({ out: join(DIR, "clip-im.mp4"), seconds: CLIP_SEC, width: 720, height: 1280, audio: false });
    portrait = makeSampleClip({ out: join(DIR, "clip-doc-1080x1920.mp4"), seconds: CLIP_SEC, width: 1080, height: 1920, audio: true });
    landscape = makeSampleClip({ out: join(DIR, "clip-ngang-1920x1080.mp4"), seconds: CLIP_SEC, width: 1920, height: 1080, audio: true });
    square = makeSampleClip({ out: join(DIR, "clip-vuong-1080x1080.mp4"), seconds: CLIP_SEC, width: 1080, height: 1080, audio: false });
  } catch (error) {
    if (!(error instanceof FfmpegMissingError)) throw error;
    ffmpeg = false;
  }
});

async function toRender(page: Page, music: "none" | "library"): Promise<void> {
  await goNext(page, "Giọng tiêu đề");
  await page.getByRole("button", { name: "Tạo giọng" }).click();
  await expect(page.getByText(/✓ [\d.]+ giây/)).toHaveCount(1, { timeout: 60_000 });
  await goNext(page, "Nhạc nền");
  if (music === "none") await page.getByRole("radio", { name: "Không dùng nhạc" }).check();
  else await page.getByRole("radio", { name: /Bản tin/ }).check();
  await goNext(page, "Dựng video");
  await expect(page.getByLabel("Hiện phụ đề")).toBeDisabled();
  await expect(page.getByText(/không phụ đề/)).toBeVisible();
}

async function shownDuration(page: Page): Promise<number> {
  const shown = await page.getByText(/[\d.]+ giây, [\d.]+ MB/).textContent();
  return Number(shown?.match(/([\d.]+) giây/)?.[1]);
}

/** Độ dài track hình (ffprobe), giây. */
function videoDurationSec(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "csv=p=0", file]);
  return Number(out.toString().trim());
}

/**
 * Độ sắc của mép: mỗi hàng lấy chênh lệch lớn nhất giữa hai điểm ảnh kề ngang (RGB24), rồi lấy trung bình các hàng.
 * Mép vạch màu testsrc2 sắc ≈ 170–250; nền mờ (blur 48 px) ≈ 40; chữ phụ đề trắng viền đen sẽ > 150.
 */
function sharpness(pixels: Uint8Array, r: Region): number {
  let sum = 0;
  for (let y = 0; y < r.h; y++) {
    let max = 0;
    for (let x = 0; x + 1 < r.w; x++) {
      const i = (y * r.w + x) * 3;
      for (let c = 0; c < 3; c++) max = Math.max(max, Math.abs((pixels[i + c] as number) - (pixels[i + 3 + c] as number)));
    }
    sum += max;
  }
  return sum / r.h;
}

const SHARP_MIN = 120;
const BLURRED_MAX = 80;

/** Độ sáng trung bình (0–255) — phân biệt nền mờ có màu với khoảng đen trống. */
function meanLevel(pixels: Uint8Array): number {
  let sum = 0;
  for (const v of pixels) sum += v;
  return sum / pixels.length;
}

/** Dải đầu khung thân bài (y 380–536 là phần trống trên/dưới khi video 16:9 vừa khung 1080×920). */
const BAND_TOP: Region = { x: 40, y: 392, w: 1000, h: 120 };
/** Giữa khung thân bài: luôn là nội dung video. */
const BAND_MIDDLE: Region = { x: 40, y: 760, w: 1000, h: 160 };
/** Vùng phụ đề thân bài (đáy 1600, 2 dòng × 68 px). */
const SUBTITLE_ZONE: Region = { x: 130, y: 1460, w: 820, h: 140 };
/** Nửa dưới khung (dưới dải thân bài cũ khi video phủ toàn khung): 9:16 gốc là hình video; khổ khác là nền mờ. */
const LOWER_FRAME: Region = { x: 40, y: 900, w: 1000, h: 600 };
/** Dưới dải thân bài 380..1300 (tránh tem ngày 1236..1280): nền mờ khi video vừa khung. */
const BELOW_BAND: Region = { x: 40, y: 1320, w: 1000, h: 130 };
const SHOT_DIR = join(".superpowers", "sample");

function saveShot(file: string, t: number, name: string): void {
  mkdirSync(SHOT_DIR, { recursive: true });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=540:960", join(SHOT_DIR, name)]);
}

test("Video tải lên: thẻ tiêu đề rồi video 8 s, tiếng gốc 100 %, không phụ đề", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  await startUploadProject(page, "Clip thử video tải lên");
  await expect(stepButton(page, 3)).toBeDisabled();
  await uploadClip(page, withAudio, "0:08");
  await expect(page.getByTestId("video-tai-len")).toContainText("có tiếng gốc");
  await expect(page.getByLabel(/Âm thanh gốc: 100%/)).toBeEnabled();
  await toRender(page, "none");

  const started = Date.now();
  const file = await renderAndDownload(page, "test-results", "tai-len-");
  const elapsed = (Date.now() - started) / 1000;
  const total = await shownDuration(page);
  const intro = total - CLIP_SEC;
  expect(intro).toBeGreaterThan(1);
  expect(intro).toBeLessThan(10);
  expect(elapsed).toBeLessThan(total * 1.5 + 10);

  const audio = decodeFileAudio(file);
  const audioSec = (audio.channels[0]?.length ?? 0) / audio.sampleRate;
  expect(Math.abs(audioSec - total)).toBeLessThan(0.15);
  const clipDb = toneRmsDb(audio.channels, audio.sampleRate, intro + 0.5, total - 0.5, 440);
  const introDb = toneRmsDb(audio.channels, audio.sampleRate, 0, intro - 0.05, 440);
  expect(clipDb).toBeGreaterThan(SINE_DB - 1.5);
  expect(clipDb).toBeLessThan(SINE_DB + 1.5);
  expect(introDb).toBeLessThan(-45); // thẻ đầu không có tiếng gốc
  console.log(`[e2e upload] tổng ${total} s (thẻ ${intro.toFixed(2)} s + video ${CLIP_SEC} s), dựng ${elapsed.toFixed(1)} s; tiếng gốc ${clipDb.toFixed(2)} dB (mong ${SINE_DB.toFixed(2)}), thẻ đầu ${introDb.toFixed(1)} dB`);
});

test("Video tải lên: tiếng gốc 50 % + nhạc nền", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  await startUploadProject(page, "Clip tiếng gốc một nửa");
  await uploadClip(page, withAudio, "0:08");
  await page.getByLabel(/Âm thanh gốc/).fill("50");
  await expect(page.getByLabel(/Âm thanh gốc: 50%/)).toBeVisible();
  await toRender(page, "library");
  await expect(page.getByText(/tiếng gốc 50%/)).toBeVisible();
  const file = await renderAndDownload(page, "test-results", "tai-len-50-");
  const total = await shownDuration(page);
  const audio = decodeFileAudio(file);
  const clipDb = toneRmsDb(audio.channels, audio.sampleRate, total - CLIP_SEC + 0.5, total - 0.5, 440);
  const expected = SINE_DB + 20 * Math.log10(0.5);
  expect(clipDb).toBeGreaterThan(expected - 1.5);
  expect(clipDb).toBeLessThan(expected + 1.5);
  console.log(`[e2e upload 50%] tiếng gốc ${clipDb.toFixed(2)} dB (mong ${expected.toFixed(2)})`);
});

test("Video tải lên: video không tiếng (dọc 720×1280) vẫn dựng, có cảnh báo; mở lại bản nháp", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  await startUploadProject(page, "Clip không tiếng");
  await uploadClip(page, silent, "0:08");
  await expect(page.getByTestId("video-tai-len")).toContainText("không có tiếng gốc");
  await expect(page.getByLabel(/Âm thanh gốc/)).toBeDisabled();

  // Bản nháp giữ dự án upload và video: tải lại trang rồi mở lại.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole("button", { name: "Mở lại" }).click();
  await expect(page.getByRole("button", { name: /^3\. Giọng tiêu đề/ })).toHaveAttribute("aria-current", "step");
  await stepButton(page, 2).click();
  await expect(page.getByTestId("video-tai-len")).toContainText("0:08");

  await toRender(page, "none");
  const file = await renderAndDownload(page, "test-results", "tai-len-im-");
  await expect(page.getByText("Video tải lên không có tiếng gốc")).toBeVisible();
  const total = await shownDuration(page);
  const audio = decodeFileAudio(file);
  expect(toneRmsDb(audio.channels, audio.sampleRate, total - CLIP_SEC + 0.5, total - 0.5, 440)).toBeLessThan(-45);
});

test("Video tải lên trên điện thoại 390 px: không cuộn ngang", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await page.setViewportSize({ width: 390, height: 844 });
  const noHorizontalScroll = async (screen: string) => {
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth, `${screen}: cuộn ngang toàn trang`).toBeLessThanOrEqual(innerWidth);
  };
  await login(page);
  await discardDraftIfOffered(page);
  await page.getByRole("radio", { name: "Video tải lên" }).check();
  await noHorizontalScroll("nhập tiêu đề");
  await page.getByLabel("Tiêu đề video").fill("Clip trên điện thoại");
  await page.getByRole("button", { name: "Tạo dự án" }).click();
  await noHorizontalScroll("sau tạo dự án");
  await goNext(page, "Video của bạn");
  await uploadClip(page, withAudio, "0:08");
  await noHorizontalScroll("video của bạn");
  await goNext(page, "Giọng tiêu đề");
  await noHorizontalScroll("giọng tiêu đề");
});

test("Video tải lên 9:16 gốc 1080×1920: phủ toàn khung, không nền mờ, không phụ đề, tiếng gốc đúng mức", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  await startUploadProject(page, "Clip dọc phủ toàn khung");
  await uploadClip(page, portrait, "0:08");
  await expect(page.getByTestId("video-tai-len")).toContainText("1080×1920");
  await toRender(page, "none");
  const file = await renderAndDownload(page, "test-results", "tai-len-doc-");
  const total = await shownDuration(page);
  const intro = total - CLIP_SEC;
  expect(Math.abs(videoDurationSec(file) - total)).toBeLessThan(0.15);

  const t = intro + CLIP_SEC / 2;
  const topSharp = sharpness(grabRegion(file, t, BAND_TOP), BAND_TOP);
  const middleSharp = sharpness(grabRegion(file, t, BAND_MIDDLE), BAND_MIDDLE);
  const lowerSharp = sharpness(grabRegion(file, t, LOWER_FRAME), LOWER_FRAME);
  // Phủ toàn khung: cả nửa dưới (trước đây là nền mờ) cũng là hình video sắc như phía trên.
  expect(topSharp).toBeGreaterThan(SHARP_MIN);
  expect(middleSharp).toBeGreaterThan(SHARP_MIN);
  expect(lowerSharp).toBeGreaterThan(SHARP_MIN);
  expect(lowerSharp).toBeGreaterThan(middleSharp * 0.7);
  saveShot(file, t, "916-theanh28-video.png");

  const audio = decodeFileAudio(file);
  const clipDb = toneRmsDb(audio.channels, audio.sampleRate, intro + 0.5, total - 0.5, 440);
  expect(clipDb).toBeGreaterThan(SINE_DB - 1.5);
  expect(clipDb).toBeLessThan(SINE_DB + 1.5);
  console.log(`[e2e upload 9:16] tổng ${total} s (thẻ ${intro.toFixed(2)} s); sắc nét trên ${topSharp.toFixed(1)}, giữa ${middleSharp.toFixed(1)}, nửa dưới ${lowerSharp.toFixed(1)}; tiếng gốc ${clipDb.toFixed(2)} dB`);
});

test("Video tải lên vuông 1080×1080: vừa khung trên nền mờ (không phủ kín)", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  await startUploadProject(page, "Clip vuông nền mờ");
  await uploadClip(page, square, "0:08");
  await expect(page.getByTestId("video-tai-len")).toContainText("1080×1080");
  await toRender(page, "none");
  const file = await renderAndDownload(page, "test-results", "tai-len-vuong-");
  const total = await shownDuration(page);
  const t = total - CLIP_SEC / 2;
  const middleSharp = sharpness(grabRegion(file, t, BAND_MIDDLE), BAND_MIDDLE);
  const below = grabRegion(file, t, BELOW_BAND);
  const belowSharp = sharpness(below, BELOW_BAND);
  expect(middleSharp).toBeGreaterThan(SHARP_MIN);
  expect(belowSharp).toBeLessThan(BLURRED_MAX);
  expect(meanLevel(below)).toBeGreaterThan(15);
  saveShot(file, t, "916-vuong-nen-mo.png");
  console.log(`[e2e upload vuông] giữa ${middleSharp.toFixed(1)}, dưới dải ${belowSharp.toFixed(2)} (sáng ${meanLevel(below).toFixed(0)})`);
});

test("Video tải lên ngang 1920×1080: vừa khung trên nền mờ, tiếng gốc kéo về 0 thì im", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  await startUploadProject(page, "Clip ngang nền mờ");
  await uploadClip(page, landscape, "0:08");
  await expect(page.getByTestId("video-tai-len")).toContainText("1920×1080");
  await page.getByLabel(/Âm thanh gốc/).fill("0");
  await expect(page.getByLabel(/Âm thanh gốc: Tắt/)).toBeVisible();
  await toRender(page, "none");
  await expect(page.getByText(/tắt tiếng gốc/)).toBeVisible();
  const file = await renderAndDownload(page, "test-results", "tai-len-ngang-");
  const total = await shownDuration(page);
  const intro = total - CLIP_SEC;
  expect(Math.abs(videoDurationSec(file) - total)).toBeLessThan(0.15);

  const t = intro + CLIP_SEC / 2;
  const top = grabRegion(file, t, BAND_TOP);
  const middle = grabRegion(file, t, BAND_MIDDLE);
  const subtitle = grabRegion(file, t, SUBTITLE_ZONE);
  const topSharp = sharpness(top, BAND_TOP);
  const middleSharp = sharpness(middle, BAND_MIDDLE);
  const subtitleSharp = sharpness(subtitle, SUBTITLE_ZONE);
  // Vừa khung 16:9: phía trên video là nền mờ có màu (không phải khoảng đen), giữa là hình sắc nét.
  expect(topSharp).toBeLessThan(BLURRED_MAX);
  expect(meanLevel(top)).toBeGreaterThan(15);
  expect(middleSharp).toBeGreaterThan(SHARP_MIN);
  expect(subtitleSharp).toBeLessThan(BLURRED_MAX);
  // Khổ khác 9:16: nửa dưới khung vẫn là nền mờ.
  expect(sharpness(grabRegion(file, t, BELOW_BAND), BELOW_BAND)).toBeLessThan(BLURRED_MAX);
  saveShot(file, t, "916-ngang-nen-mo.png");

  const audio = decodeFileAudio(file);
  const clipDb = toneRmsDb(audio.channels, audio.sampleRate, intro + 0.5, total - 0.5, 440);
  expect(clipDb).toBeLessThan(-45);
  console.log(`[e2e upload ngang 0%] tổng ${total} s (thẻ ${intro.toFixed(2)} s); sắc nét nền trên ${topSharp.toFixed(2)} (sáng ${meanLevel(top).toFixed(0)}), giữa ${middleSharp.toFixed(1)}, vùng phụ đề ${subtitleSharp.toFixed(2)}; tiếng gốc ${clipDb.toFixed(1)} dB`);
});
