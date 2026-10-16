import { expect, test, type Page } from "@playwright/test";
import { autoFillFootage, discardDraftIfOffered, expectDraftSaved, fillSampleAndSplit, generateVoices, goNext, login, renderAndDownload, stepButton } from "./helpers";
import { FfmpegMissingError } from "../scripts/measure-mp4";
import { grabRegion, meanAbsDiff, type Region } from "../scripts/lib/frameRegion";

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

test("Ảnh | Video ở từng cảnh: chỉ hiện loại đã chọn và được nhớ; ưu tiên video vẫn tự điền bằng ảnh khi thiếu video", async ({ page }) => {
  await login(page);
  await discardDraftIfOffered(page);
  await fillSampleAndSplit(page);
  await sidebar(page).getByRole("radio", { name: "Ưu tiên video" }).check();
  await goNext(page, "Chọn giọng");
  await generateVoices(page);
  await goNext(page, "Cảnh trám");
  await autoFillFootage(page); // nguồn giả không có video ⇒ lùi về ảnh, đủ 6 cảnh

  const card = () => page.getByRole("listitem").filter({ hasText: /^Cảnh 1:/ });
  const kindButton = (name: "Ảnh" | "Video") =>
    card().getByRole("group", { name: "Loại cảnh trám" }).getByRole("button", { name, exact: true });
  await kindButton("Video").click();
  await expect(kindButton("Video")).toHaveAttribute("aria-pressed", "true");
  await expect(card().getByText(/^Không tìm ra kết quả/)).toBeVisible();
  await expect(card().getByRole("img", { name: "Cảnh trám đang chọn" })).toBeVisible(); // không tự đổi cảnh đang gán
  await kindButton("Ảnh").click();
  await expect(kindButton("Ảnh")).toHaveAttribute("aria-pressed", "true");
  await expect(card().getByRole("img", { name: "Ảnh gợi ý" }).first()).toBeVisible();
  await expect(card().getByRole("img", { name: "Video gợi ý" })).toHaveCount(0);
  await expectDraftSaved(page, (d) => d.sceneKindCount === 1);

  await page.reload();
  await page.getByRole("button", { name: "Mở lại" }).click();
  await stepButton(page, 3).click();
  await expect(kindButton("Ảnh")).toHaveAttribute("aria-pressed", "true");
  await expect(kindButton("Video")).toHaveAttribute("aria-pressed", "false");
  await expect(sidebar(page).getByRole("radio", { name: "Ưu tiên video" })).toBeChecked();
});

test("bỏ tick \"Có cảnh trám riêng\": đoạn thu gọn, dùng tiếp cảnh đoạn trước; nút nhanh gộp/đặt lại", async ({ page }) => {
  await login(page);
  await discardDraftIfOffered(page);
  await fillSampleAndSplit(page);
  await goNext(page, "Chọn giọng");
  await generateVoices(page);
  await goNext(page, "Cảnh trám");

  const card = (label: string) => page.getByRole("listitem").filter({ hasText: new RegExp(`^${label}:`) });
  await expect(card("Mở đầu").getByRole("checkbox", { name: "Có cảnh trám riêng" })).toHaveCount(0);
  const own = card("Cảnh 2").getByRole("checkbox", { name: "Có cảnh trám riêng" });
  await expect(own).toBeChecked();
  await own.uncheck();
  await expect(card("Cảnh 2").getByText("Dùng tiếp cảnh của Cảnh 1")).toBeVisible();
  await expect(card("Cảnh 2").getByLabel("Từ khoá tìm cảnh trám")).toHaveCount(0);

  await page.getByRole("button", { name: "Tự tìm cảnh còn trống" }).click();
  await expect(page.getByRole("button", { name: "Tự tìm cảnh còn trống" })).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole("img", { name: "Cảnh trám đang chọn" })).toHaveCount(5); // đoạn dùng tiếp không có cảnh riêng

  await page.getByRole("button", { name: "Mỗi đoạn một cảnh" }).click();
  await expect(card("Cảnh 2").getByRole("checkbox", { name: "Có cảnh trám riêng" })).toBeChecked();
  await page.getByRole("button", { name: "Gộp: mỗi 2 đoạn một cảnh" }).click();
  await expect(page.getByText(/^Dùng tiếp cảnh của/)).toHaveCount(2);
});

const SUBTITLE_BODY: Region = { x: 130, y: 1464, w: 820, h: 136 }; // vùng phụ đề cảnh thân bài
const INTRO_BLOCK: Region = { x: 0, y: 1700, w: 1080, h: 200 }; // khối đặc sau tiêu đề (cảnh mở đầu)
const BODY_BAND: Region = { x: 0, y: 400, w: 1080, h: 800 }; // dải ảnh cảnh thân bài (đối chứng: không đổi)

async function rerenderAndDownload(page: Page, prefix: string): Promise<string> {
  await page.getByRole("button", { name: "Dựng lại", exact: true }).click();
  await expect(page.getByTestId("ket-qua")).toHaveCount(0);
  await expect(page.getByTestId("ket-qua")).toBeVisible({ timeout: 150_000 });
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /^Tải MP4/ }).click()]);
  const path = test.info().outputPath(prefix + download.suggestedFilename());
  await download.saveAs(path);
  return path;
}

test("phụ đề và màu khối thumbnail có trong MP4; tắt phụ đề thì mất; tốc độ dựng không giảm đáng kể", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);
  await discardDraftIfOffered(page);
  await fillSampleAndSplit(page);
  await goNext(page, "Chọn giọng");
  await generateVoices(page);
  await goNext(page, "Cảnh trám");
  await autoFillFootage(page);
  await goNext(page, "Nhạc nền");
  await goNext(page, "Dựng video");
  const side = sidebar(page);
  await expect(side.getByRole("checkbox", { name: "Hiện phụ đề" })).toBeChecked();

  let started = Date.now();
  const withSubs = await renderAndDownload(page, "test-results", "co-phu-de-");
  const withSubsSec = (Date.now() - started) / 1000;
  const shown = await page.getByText(/[\d.]+ giây, [\d.]+ MB/).textContent();
  const durationSec = Number(shown?.match(/([\d.]+) giây/)?.[1]);

  await side.getByRole("checkbox", { name: "Hiện phụ đề" }).uncheck();
  await side.getByLabel("Màu khối sau tiêu đề").fill("#c0392b");
  await expect(page.getByText(/Kết quả này không còn khớp/)).toBeVisible(); // đổi tuỳ chọn ⇒ kết quả cũ
  started = Date.now();
  const noSubs = await rerenderAndDownload(page, "khong-phu-de-");
  const noSubsSec = (Date.now() - started) / 1000;

  console.log(
    `[e2e] video ${durationSec} s: có phụ đề dựng ${withSubsSec.toFixed(1)} s (${(withSubsSec / durationSec).toFixed(2)}×), ` +
      `tắt phụ đề ${noSubsSec.toFixed(1)} s (${(noSubsSec / durationSec).toFixed(2)}×)\n[e2e] ${withSubs}\n[e2e] ${noSubs}`,
  );
  expect(withSubsSec).toBeLessThan(durationSec * 1.5 + 10);
  expect(withSubsSec).toBeLessThan(noSubsSec * 1.3 + 5);

  try {
    const subtitleDiff = meanAbsDiff(grabRegion(withSubs, 10, SUBTITLE_BODY), grabRegion(noSubs, 10, SUBTITLE_BODY));
    const blockDiff = meanAbsDiff(grabRegion(withSubs, 1, INTRO_BLOCK), grabRegion(noSubs, 1, INTRO_BLOCK));
    const bandDiff = meanAbsDiff(grabRegion(withSubs, 10, BODY_BAND), grabRegion(noSubs, 10, BODY_BAND));
    console.log(`[e2e] chênh vùng: phụ đề ${subtitleDiff.toFixed(1)}, khối mở đầu ${blockDiff.toFixed(1)}, dải ảnh ${bandDiff.toFixed(1)}`);
    expect(subtitleDiff).toBeGreaterThan(8); // có phụ đề ↔ không
    expect(blockDiff).toBeGreaterThan(40); // xanh #1F9D55 ↔ đỏ #C0392B
    expect(bandDiff).toBeLessThan(6); // vùng không liên quan giữ nguyên
  } catch (error) {
    if (!(error instanceof FfmpegMissingError)) throw error;
    test.info().annotations.push({ type: "skip-frames", description: "không có ffmpeg" });
    console.log("[e2e] bỏ qua so khung (không có ffmpeg)");
  }
});
