import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FfmpegMissingError, measureFile } from "../scripts/measure-mp4";
import { makeSampleClip } from "../scripts/make-sample-clip";
import { edgeSharpness, grabRegion, meanAbsDiff, type Region } from "../scripts/lib/frameRegion";
import {
  autoFillFootage,
  discardDraftIfOffered,
  fillSampleAndSplit,
  generateVoices,
  goNext,
  login,
  renderAndDownload,
  uploadClip,
} from "./helpers";

const STYLE = "Bản tin Theanh28 + banner chân";
const DEFAULT_BANNER_PNG = join("public", "templates", "theanh28-banner", "banner-chan-video.png");
/** Dải banner trên khung 1080×1920. */
const BANNER: Region = { x: 0, y: 1560, w: 1080, h: 360 };
/** Vùng đo trên canvas xem trước (nằm gọn trong dải banner). */
const PREVIEW_BANNER: Region = { x: 0, y: 1600, w: 1080, h: 300 };
/** Dòng phụ đề cuối của bố cục banner (đáy 1520, dòng cao 64, chữ 52 px). */
const SUBTITLE_LINE: Region = { x: 130, y: 1460, w: 820, h: 44 };
/** Bố cục banner, video ngang 16:9 vừa khung 1080×880 tại y = 300: video cao 607,5 từ y ≈ 436. */
const ABOVE_VIDEO: Region = { x: 40, y: 310, w: 1000, h: 110 };
const VIDEO_MIDDLE: Region = { x: 40, y: 640, w: 1000, h: 120 };
const SHARP_MIN = 120;
const BLURRED_MAX = 80;
/** Banner trong MP4 so với ảnh mặc định thu về 1080×360: sai khác trung bình mỗi byte (màu sau H.264 lệch vài mức). */
const BANNER_MATCH_MAX = 14;
const SHOT_DIR = join(".superpowers", "sample");
const DIR = join("test-results", "mau-banner");

let ffmpeg = true;
let landscape = "";
let redPng = "";
let squarePng = "";
let expectedBanner: Uint8Array = new Uint8Array(0);

function ffmpegRun(args: string[]): Buffer {
  return execFileSync("ffmpeg", args, { maxBuffer: 64 * 1024 * 1024 });
}

test.beforeAll(() => {
  try {
    mkdirSync(DIR, { recursive: true });
    landscape = makeSampleClip({ out: join(DIR, "clip-ngang-1920x1080.mp4"), seconds: 8, width: 1920, height: 1080, audio: true });
    redPng = join(DIR, "banner-do-1500x500.png");
    squarePng = join(DIR, "anh-vuong-800.png");
    ffmpegRun(["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=1500x500", "-frames:v", "1", redPng]);
    ffmpegRun(["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=blue:s=800x800", "-frames:v", "1", squarePng]);
    // Banner mặc định vẽ kiểu cover: 2048×682 → 1081,06×360, căn giữa → cắt còn 1080×360.
    const raw = ffmpegRun([
      "-v", "error", "-i", DEFAULT_BANNER_PNG, "-vf", "scale=1082:360,crop=1080:360:1:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ]);
    expectedBanner = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  } catch (error) {
    if (error instanceof FfmpegMissingError || (error as { code?: string }).code === "ENOENT") {
      ffmpeg = false;
      return;
    }
    throw error;
  }
});

function saveShot(file: string, t: number, name: string): void {
  mkdirSync(SHOT_DIR, { recursive: true });
  ffmpegRun(["-v", "error", "-y", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=540:960", join(SHOT_DIR, name)]);
}

const previewCanvas = (page: Page) => page.getByTestId("xem-truoc-canvas");

async function drawCount(page: Page): Promise<number> {
  return Number(await previewCanvas(page).getAttribute("data-draw-count"));
}

/** Trung bình R, G, B (2 số lẻ) của vùng `r` trên canvas xem trước 1080×1920. */
async function previewMeans(page: Page, r: Region): Promise<{ r: number; g: number; b: number }> {
  return previewCanvas(page).evaluate((el, box) => {
    const ctx = (el as HTMLCanvasElement).getContext("2d");
    if (!ctx) return { r: -1, g: -1, b: -1 };
    const d = ctx.getImageData(box.x, box.y, box.w, box.h).data;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let i = 0; i < d.length; i += 4) {
      sr += d[i] as number;
      sg += d[i + 1] as number;
      sb += d[i + 2] as number;
    }
    const n = d.length / 4;
    const round = (v: number) => Math.round((v / n) * 100) / 100;
    return { r: round(sr), g: round(sg), b: round(sb) };
  }, r);
}

async function chooseStyle(page: Page): Promise<void> {
  await page.getByLabel("Phong cách video").selectOption({ label: STYLE });
  await expect(page.getByText(/Đang dùng banner mặc định/)).toBeVisible();
}

async function shownDuration(page: Page): Promise<number> {
  const shown = await page.getByText(/[\d.]+ giây, [\d.]+ MB/).textContent();
  return Number(shown?.match(/([\d.]+) giây/)?.[1]);
}

test("Xem trước bước 1: phong cách banner có dải banner; mượn thương hiệu; banner riêng, sai tỉ lệ bị chặn, về mặc định", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo ảnh mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  await expect.poll(() => drawCount(page), { timeout: 10_000 }).toBeGreaterThan(0);

  // Thương hiệu của phong cách gốc được mượn sang phong cách banner.
  await page.getByLabel("Tên kênh").fill("KÊNH THỬ BANNER");
  await page.getByRole("button", { name: "Lưu thương hiệu" }).click();
  await expect(page.getByText("Đã lưu trên máy này")).toBeVisible();
  const oldMeans = await previewMeans(page, PREVIEW_BANNER);

  await chooseStyle(page);
  await expect(page.getByLabel("Tên kênh")).toHaveValue("KÊNH THỬ BANNER");
  await expect.poll(() => previewMeans(page, PREVIEW_BANNER), { timeout: 10_000 }).not.toEqual(oldMeans);
  const defaultMeans = await previewMeans(page, PREVIEW_BANNER);
  mkdirSync(SHOT_DIR, { recursive: true });
  await previewCanvas(page).screenshot({ path: join(SHOT_DIR, "banner-xem-truoc-the-dau.png") });

  await page.getByLabel("Banner chân video").setInputFiles(redPng);
  await expect(page.getByText(/Đang dùng banner của bạn/)).toBeVisible();
  await expect.poll(async () => (await previewMeans(page, PREVIEW_BANNER)).r, { timeout: 10_000 }).toBeGreaterThan(200);
  const red = await previewMeans(page, PREVIEW_BANNER);
  expect(red.g).toBeLessThan(40);
  expect(red.b).toBeLessThan(40);

  await page.getByLabel("Banner chân video").setInputFiles(squarePng);
  await expect(page.getByRole("alert").filter({ hasText: "Banner phải là ảnh ngang" })).toBeVisible();
  await expect(page.getByText(/Đang dùng banner của bạn/)).toBeVisible(); // giữ banner cũ

  await page.getByRole("button", { name: "Dùng banner mặc định" }).click();
  await expect(page.getByText(/Đang dùng banner mặc định/)).toBeVisible();
  await expect.poll(() => previewMeans(page, PREVIEW_BANNER), { timeout: 10_000 }).toEqual(defaultMeans);

  const before = await drawCount(page);
  await page.getByRole("tab", { name: "Cảnh thân bài" }).click();
  await expect.poll(() => drawCount(page), { timeout: 10_000 }).toBeGreaterThan(before);
  expect(await previewMeans(page, PREVIEW_BANNER)).toEqual(defaultMeans);
  await previewCanvas(page).screenshot({ path: join(SHOT_DIR, "banner-xem-truoc-than-bai.png") });
});

test("Bản tin nhiều cảnh + banner: banner suốt video (thẻ đầu, thân bài), phụ đề nằm trên banner, âm giữ chuẩn", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để đo khung");
  await login(page);
  await discardDraftIfOffered(page);
  await chooseStyle(page);
  await fillSampleAndSplit(page);
  await goNext(page, "Chọn giọng");
  await generateVoices(page);
  await goNext(page, "Cảnh trám");
  await autoFillFootage(page);
  await goNext(page, "Nhạc nền");
  await page.getByRole("radio", { name: /Bản tin/ }).check();
  await goNext(page, "Dựng video");

  const file = await renderAndDownload(page, "test-results", "banner-tin-");
  const total = await shownDuration(page);
  const tBody = total - 1.5;
  const introBanner = grabRegion(file, 0.5, BANNER);
  const bodyBanner = grabRegion(file, tBody, BANNER);
  const sameAcross = meanAbsDiff(introBanner, bodyBanner);
  const vsDefault = meanAbsDiff(bodyBanner, expectedBanner);
  const subtitle = edgeSharpness(grabRegion(file, tBody, SUBTITLE_LINE), SUBTITLE_LINE);
  expect(sameAcross).toBeLessThan(3);
  expect(vsDefault).toBeLessThan(BANNER_MATCH_MAX);
  expect(subtitle).toBeGreaterThan(SHARP_MIN);

  const metrics = measureFile(file);
  expect(metrics.peak).toBeLessThan(0.89);
  expect(metrics.voicedRmsDb).toBeGreaterThan(-18);
  expect(metrics.voicedRmsDb).toBeLessThan(-15);
  saveShot(file, 0.5, "banner-tin-the-dau.png");
  saveShot(file, tBody, "banner-tin-than-bai.png");
  console.log(
    `[e2e banner tin] tổng ${total} s; banner thẻ đầu↔thân bài ${sameAcross.toFixed(2)}, so ảnh mặc định ${vsDefault.toFixed(2)}; phụ đề sắc ${subtitle.toFixed(1)}; giọng ${metrics.voicedRmsDb.toFixed(2)} dB, đỉnh ${metrics.peak.toFixed(3)}`,
  );
});

test("Video tải lên + banner: banner ở thẻ đầu và cả đoạn video; video ngang vừa khung 300..1180", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  await page.getByRole("radio", { name: "Video tải lên" }).check();
  await chooseStyle(page);
  await page.getByLabel("Tiêu đề video").fill("Clip ngang có banner chân");
  await page.getByRole("button", { name: "Tạo dự án" }).click();
  await goNext(page, "Video của bạn");
  await uploadClip(page, landscape, "0:08");
  await goNext(page, "Giọng tiêu đề");
  await page.getByRole("button", { name: "Tạo giọng" }).click();
  await expect(page.getByText(/✓ [\d.]+ giây/)).toHaveCount(1, { timeout: 60_000 });
  await goNext(page, "Nhạc nền");
  await page.getByRole("radio", { name: "Không dùng nhạc" }).check();
  await goNext(page, "Dựng video");

  const file = await renderAndDownload(page, "test-results", "banner-tai-len-");
  const total = await shownDuration(page);
  const tClip = total - 4;
  const sameAcross = meanAbsDiff(grabRegion(file, 0.5, BANNER), grabRegion(file, tClip, BANNER));
  const vsDefault = meanAbsDiff(grabRegion(file, tClip, BANNER), expectedBanner);
  const above = edgeSharpness(grabRegion(file, tClip, ABOVE_VIDEO), ABOVE_VIDEO);
  const middle = edgeSharpness(grabRegion(file, tClip, VIDEO_MIDDLE), VIDEO_MIDDLE);
  expect(sameAcross).toBeLessThan(3);
  expect(vsDefault).toBeLessThan(BANNER_MATCH_MAX);
  expect(above).toBeLessThan(BLURRED_MAX);
  expect(middle).toBeGreaterThan(SHARP_MIN);
  saveShot(file, 0.5, "banner-tai-len-the-dau.png");
  saveShot(file, tClip, "banner-tai-len-video.png");
  console.log(
    `[e2e banner tải lên] tổng ${total} s; banner thẻ đầu↔video ${sameAcross.toFixed(2)}, so ảnh mặc định ${vsDefault.toFixed(2)}; trên video ${above.toFixed(1)}, giữa ${middle.toFixed(1)}`,
  );
});
