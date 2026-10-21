import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FfmpegMissingError, decodeFileAudio, type DecodedFileAudio } from "../scripts/measure-mp4";
import { makeSampleClip } from "../scripts/make-sample-clip";
import { toneRmsDb } from "../scripts/lib/audioMetrics";
import { edgeSharpness, grabRegion, meanAbsDiff, type Region } from "../scripts/lib/frameRegion";
import { discardDraftIfOffered, goNext, login, renderAndDownload, uploadClip } from "./helpers";

const CLIP_SEC = 8;
/** Sin lavfi mặc định biên độ 1/8 → RMS −21,07 dB. */
const SINE_DB = 20 * Math.log10(0.125 / Math.SQRT2);
const DUCK_DB = 12;
/** Giọng giả "vi-VN-Fake-A" là sin 230 Hz. */
const VOICE_HZ = 230;
const STYLE_BANNER = "Bản tin Theanh28 + banner chân";
const SHARP_MIN = 120;
const BLURRED_MAX = 80;
const DIR = join("test-results", "mau-doc-de");
const SHOT_DIR = join(".superpowers", "sample");
/** Dòng đầu tiêu đề của khối đè: Theanh28 y 1300 (60 px), banner y 1206 (56 px); cả hai nằm dưới dải video. */
const TITLE_THEANH28: Region = { x: 96, y: 1302, w: 880, h: 54 };
const TITLE_BANNER: Region = { x: 96, y: 1208, w: 880, h: 50 };
const BANNER: Region = { x: 0, y: 1560, w: 1080, h: 360 };

let ffmpeg = true;
let withAudio = "";
let longClip = "";

test.beforeAll(() => {
  try {
    withAudio = makeSampleClip({ out: join(DIR, "clip-440-1280x720.mp4"), seconds: CLIP_SEC, width: 1280, height: 720, audio: true });
    if (process.env.PERF_CLIP === "1") {
      longClip = makeSampleClip({ out: join("test-results", "hieu-nang", "clip-doc-de-60.mp4"), seconds: 60, width: 1920, height: 1080, audio: true });
    }
  } catch (error) {
    if (!(error instanceof FfmpegMissingError)) throw error;
    ffmpeg = false;
  }
});

/** Bước 1: kiểu Video tải lên + cách ghép đè (+ phong cách), tạo dự án, sang "Video của bạn". */
async function startOverlayProject(page: Page, title: string, style?: string): Promise<void> {
  await page.getByRole("radio", { name: "Video tải lên" }).check();
  await page.getByRole("radio", { name: "Đọc tiêu đề đè trên video" }).check();
  if (style) {
    await page.getByLabel("Phong cách video").selectOption({ label: style });
    await expect(page.getByText(/Đang dùng banner mặc định/)).toBeVisible();
  }
  await page.getByLabel("Tiêu đề video").fill(title);
  await page.getByRole("button", { name: "Tạo dự án" }).click();
  await goNext(page, "Video của bạn");
  await expect(page.getByRole("radio", { name: "Đọc tiêu đề đè trên video" })).toBeChecked();
}

async function voiceAndGoRender(page: Page, music: "none" | "library"): Promise<void> {
  await goNext(page, "Giọng tiêu đề");
  await page.getByRole("button", { name: "Tạo giọng" }).click();
  await expect(page.getByText(/✓ [\d.]+ giây/)).toHaveCount(1, { timeout: 60_000 });
  await goNext(page, "Nhạc nền");
  if (music === "none") await page.getByRole("radio", { name: "Không dùng nhạc" }).check();
  else await page.getByRole("radio", { name: /Bản tin/ }).check();
  await goNext(page, "Dựng video");
}

async function shownDuration(page: Page): Promise<number> {
  const shown = await page.getByText(/[\d.]+ giây, [\d.]+ MB/).textContent();
  return Number(shown?.match(/([\d.]+) giây/)?.[1]);
}

function videoDurationSec(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "csv=p=0", file]);
  return Number(out.toString().trim());
}

/** Khoảng có giọng giả (230 Hz), cửa sổ 50 ms, ngưỡng −35 dB. */
function voiceSpan(audio: DecodedFileAudio): { start: number; end: number } {
  const total = (audio.channels[0]?.length ?? 0) / audio.sampleRate;
  let start = -1;
  let end = -1;
  for (let t = 0; t + 0.05 <= total; t += 0.05) {
    if (toneRmsDb(audio.channels, audio.sampleRate, t, t + 0.05, VOICE_HZ) > -35) {
      if (start < 0) start = t;
      end = t + 0.05;
    }
  }
  return { start, end };
}

function saveShot(file: string, t: number, name: string): void {
  mkdirSync(SHOT_DIR, { recursive: true });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=540:960", join(SHOT_DIR, name)]);
}

/** Kiểm chung: tổng = video, giọng từ nghỉ đầu 0,3 s, tiếng gốc −12 dB khi đọc rồi trở lại, khối tiêu đề có rồi thu gọn. */
async function checkOverlayFile(file: string, total: number, titleZone: Region, label: string) {
  expect(Math.abs(total - CLIP_SEC)).toBeLessThan(0.15);
  expect(Math.abs(videoDurationSec(file) - CLIP_SEC)).toBeLessThan(0.15);
  const audio = decodeFileAudio(file);
  const { start, end } = voiceSpan(audio);
  expect(start).toBeGreaterThan(0.15);
  expect(start).toBeLessThan(0.5);
  expect(end).toBeLessThan(CLIP_SEC - 2);
  const duringDb = toneRmsDb(audio.channels, audio.sampleRate, start + 0.1, end - 0.1, 440);
  const afterDb = toneRmsDb(audio.channels, audio.sampleRate, end + 0.4, CLIP_SEC - 0.3, 440);
  expect(duringDb).toBeGreaterThan(SINE_DB - DUCK_DB - 1.5);
  expect(duringDb).toBeLessThan(SINE_DB - DUCK_DB + 1.5);
  expect(afterDb).toBeGreaterThan(SINE_DB - 1.5);
  expect(afterDb).toBeLessThan(SINE_DB + 1.5);

  const tRead = (start + end) / 2;
  // hết giọng + giữ 0,35 s + thu gọn 0,4 s + dư 0,5 s
  const tAfter = Math.min(CLIP_SEC - 0.3, end + 0.35 + 0.4 + 0.5);
  const reading = edgeSharpness(grabRegion(file, tRead, titleZone), titleZone);
  const after = edgeSharpness(grabRegion(file, tAfter, titleZone), titleZone);
  expect(reading).toBeGreaterThan(SHARP_MIN);
  expect(after).toBeLessThan(BLURRED_MAX);
  saveShot(file, tRead, `doc-de-${label}-dang-doc.png`);
  saveShot(file, tAfter, `doc-de-${label}-sau-khi-doc.png`);
  console.log(
    `[e2e đọc đè ${label}] tổng ${total} s; giọng ${start.toFixed(2)}–${end.toFixed(2)} s; tiếng gốc khi đọc ${duringDb.toFixed(2)} dB (mong ${(SINE_DB - DUCK_DB).toFixed(2)}), sau ${afterDb.toFixed(2)} dB (mong ${SINE_DB.toFixed(2)}); khối tiêu đề sắc ${reading.toFixed(1)} → ${after.toFixed(1)}`,
  );
  return { tRead, tAfter };
}

test("Đọc tiêu đề đè trên video (Theanh28): tổng = video, giọng từ nghỉ đầu, tiếng gốc −12 dB khi đọc, khối tiêu đề thu gọn", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  await startOverlayProject(page, "Clip đọc đè thử");
  await uploadClip(page, withAudio, "0:08");
  await voiceAndGoRender(page, "none");
  await expect(page.getByText(/Đọc tiêu đề đè trên video 0:08/)).toBeVisible();
  await expect(page.getByLabel("Hiện phụ đề")).toBeDisabled();
  const file = await renderAndDownload(page, "test-results", "doc-de-");
  await checkOverlayFile(file, await shownDuration(page), TITLE_THEANH28, "theanh28");
});

test("Đọc tiêu đề đè trên video + banner chân: banner cố định suốt video, khối tiêu đề trên banner", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  await startOverlayProject(page, "Clip đọc đè có banner", STYLE_BANNER);
  await uploadClip(page, withAudio, "0:08");
  // Không nhạc: lúc duck tiếng gốc còn −33 dB, nhạc thư viện (≈ −33 dB) có thể lẫn năng lượng ở 440 Hz làm sai số đo.
  await voiceAndGoRender(page, "none");
  const file = await renderAndDownload(page, "test-results", "doc-de-banner-");
  const { tRead, tAfter } = await checkOverlayFile(file, await shownDuration(page), TITLE_BANNER, "banner");
  const bannerDiff = meanAbsDiff(grabRegion(file, tRead, BANNER), grabRegion(file, tAfter, BANNER));
  expect(bannerDiff).toBeLessThan(3);
  console.log(`[e2e đọc đè banner] banner lúc đọc↔sau khi đọc ${bannerDiff.toFixed(2)}`);
});

test("Đọc đè: giọng tiêu đề dài hơn video → cảnh báo ở bước Giọng, chặn ở bước Dựng bằng câu tiếng Việt", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  // 160 ký tự → giọng giả ≈ 10,4 s / 1,07 ≈ 9,7 s > video 8 s
  await startOverlayProject(page, "Tiêu đề rất dài để thử ".repeat(7).trim());
  await uploadClip(page, withAudio, "0:08");
  await goNext(page, "Giọng tiêu đề");
  await page.getByRole("button", { name: "Tạo giọng" }).click();
  await expect(page.getByText(/✓ [\d.]+ giây/)).toHaveCount(1, { timeout: 60_000 });
  await expect(page.getByText(/video chỉ 8,0 giây/)).toBeVisible();
  await goNext(page, "Nhạc nền");
  await page.getByRole("radio", { name: "Không dùng nhạc" }).check();
  await goNext(page, "Dựng video");
  await page.getByRole("button", { name: "Dựng video", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /video chỉ 8,0 giây/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("ket-qua")).toHaveCount(0);
});

for (const width of [360, 390] as const) {
  test(`Điện thoại ${width} px: cách ghép + phong cách banner không cuộn ngang`, async ({ page }) => {
    test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
    await page.setViewportSize({ width, height: 800 });
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
    await page.getByRole("radio", { name: "Đọc tiêu đề đè trên video" }).check();
    await page.getByLabel("Phong cách video").selectOption({ label: STYLE_BANNER });
    await expect(page.getByText(/Đang dùng banner mặc định/)).toBeVisible();
    await noHorizontalScroll("bước 1 (cách ghép + banner)");
    const radio = await page.getByText("Đọc tiêu đề đè trên video", { exact: true }).boundingBox();
    expect(radio?.height ?? 0).toBeGreaterThanOrEqual(44);
    if (width === 390) {
      mkdirSync(join(".superpowers", "mobile"), { recursive: true });
      await page.screenshot({ path: join(".superpowers", "mobile", "doc-de-buoc-1.png"), fullPage: true });
    }
    await page.getByLabel("Tiêu đề video").fill("Clip điện thoại");
    await page.getByRole("button", { name: "Tạo dự án" }).click();
    await goNext(page, "Video của bạn");
    await noHorizontalScroll("video của bạn (trước khi tải)");
    await uploadClip(page, withAudio, "0:08");
    await noHorizontalScroll("video của bạn (đã tải)");
    if (width === 390) await page.screenshot({ path: join(".superpowers", "mobile", "doc-de-video-cua-ban.png"), fullPage: true });
  });
}

test("hiệu năng: đọc đè + banner, video 1080p 60 s", async ({ page }) => {
  test.skip(process.env.PERF_CLIP !== "1" || !ffmpeg, "đặt PERF_CLIP=1 để đo (cần ffmpeg)");
  test.setTimeout(10 * 60_000);
  await login(page);
  await discardDraftIfOffered(page);
  await startOverlayProject(page, "Đo hiệu năng đọc đè", STYLE_BANNER);
  await uploadClip(page, longClip, "1:00");
  await voiceAndGoRender(page, "library");
  await page.getByRole("radio", { name: /Nhẹ/ }).check();
  const started = Date.now();
  await page.getByRole("button", { name: "Dựng video", exact: true }).click();
  await expect(page.getByTestId("ket-qua")).toBeVisible({ timeout: 8 * 60_000 });
  const elapsed = (Date.now() - started) / 1000;
  const total = await shownDuration(page);
  const shown = await page.getByText(/[\d.]+ giây, [\d.]+ MB/).textContent();
  const sizeMb = Number(shown?.match(/([\d.]+) MB/)?.[1]);
  console.log(`[perf đọc đè] video 60 s + banner: tổng ${total} s, dựng ${elapsed.toFixed(1)} s (${(elapsed / total).toFixed(2)}×), ${sizeMb} MB`);
  expect(Math.abs(total - 60)).toBeLessThan(0.2);
  expect(elapsed).toBeLessThan(total * 1.0 + 15);
});
