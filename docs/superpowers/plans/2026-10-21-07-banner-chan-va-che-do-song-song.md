# Tin Video Studio — Phong cách "Bản tin Theanh28 + banner chân" và cách ghép "Đọc tiêu đề đè trên video" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (A) Thêm phong cách video thứ hai "Bản tin Theanh28 + banner chân" (id `theanh28-banner`): mọi nội dung đẩy lên trên dải đáy y = 1560..1920, dải đó là ảnh banner (mặc định đi kèm hoặc ảnh người dùng tải ở phần Thương hiệu), có ở mọi khung của cả hai kiểu video. (B) Thêm "Cách ghép" cho kiểu "Video tải lên": ngoài "Thẻ tiêu đề rồi video" (mặc định, giữ nguyên) có "Đọc tiêu đề đè trên video" — video chạy từ giây 0, giọng tiêu đề phát sau khoảng nghỉ đầu, khối tiêu đề kiểu Theanh28 đè dưới video rồi thu gọn mượt 0,4 s, tiếng gốc tự nhỏ lại 12 dB trong lúc đọc; tổng độ dài = đúng độ dài video.

**Architecture:** `TheAnh28Template` nhận bố cục qua hàm dựng (`TheAnh28Layout`, mặc định `LAYOUT` cũ → hình cũ y hệt); `TheAnh28BannerTemplate` kế thừa, truyền `BANNER_LAYOUT` và vẽ banner sau cùng. Banner đi vào khung qua `ProjectFrame.banner`; job mang `RenderJob.banner?` (ảnh riêng) — thiếu thì worker tải ảnh mặc định của phong cách (`VideoTemplate.footerBanner.defaultUrl`). Cách ghép nằm trong `VideoOptions.uploadComposition` (bản nháp v3 giữ nguyên, khoá chỉ có khi khác mặc định). Chế độ đè dùng `Timeline.overlay()` (một khe dài đúng video, giọng ở `leadInSec`), `SceneFrame.titleOverlay` (mốc bắt đầu thu gọn) và `SourceBed.duck` (đường cong cosin nâng trên biên độ). Không chọn phong cách mới / cách ghép mới thì mọi đường code cũ chạy như trước.

**Tech Stack:** Như hiện tại: Next.js 16.4.1, React 19.3.1, TypeScript 5.9.3 strict (`noUncheckedIndexedAccess`), Tailwind 4, Vitest 5.0.4 (node, chỉ gom `tests/**/*.test.ts`), Playwright 1.64.1 (kênh `chrome`, cổng 3101, `FAKE_PROVIDERS=1`), mediabunny 1.61.4, ffmpeg (chỉ cho script/e2e). Không thêm dependency npm.

**Đặc tả:** `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md` (§4.3 hàm vẽ thuần theo thời gian, §4.4 bố cục Theanh28, §14 tuỳ chọn video, §15 kiểu Video tải lên). Task 7 thêm §16. Kế hoạch trước: `docs/superpowers/plans/2026-10-21-06-video-tai-len.md` (mọi ràng buộc ở đó vẫn áp dụng).

## Global Constraints

- Thư mục dự án: `D:\Brain Hainv\ca-nhan\tools\tin-video-studio`, nhánh `feat/banner-chan-va-doc-de` (điều phối viên tạo từ `main`). Đường dẫn trong kế hoạch tính từ thư mục này.
- **Agent thực thi CẤM chạy mọi lệnh git.** Bỏ qua bước "Commit" (điều phối viên commit). Không đọc/sửa `.env.local`; không tạo `.env*`. Không chạy dev server (`npm run dev`); e2e tự chạy app ở cổng **3101** với `FAKE_PROVIDERS=1`.
- **RED phải đỏ thật** cho test Vitest: chạy test mới trước khi viết code và ghi dòng thất bại vào report. Test không đỏ thì KHÔNG sửa giá trị mong đợi; ghi "test không đỏ" + lý do. Test Playwright không có RED; chạy và ghi kết quả; không nới timeout/ngưỡng quá giá trị kế hoạch ghi — đỏ thì ghi số đo và báo lại.
- Lớp: View chỉ hiển thị + gọi controller (không quy tắc nghiệp vụ, không fetch); Controller giữ trạng thái và điều phối; Model (`src/domain`) thuần TS, không React/DOM/fetch/mediabunny; lắp ráp ở `createStudio.ts` / `container.ts`.
- **Hàm vẽ của template phải thuần theo thời gian:** cùng `ProjectFrame` + `SceneFrame` ra cùng chuỗi lệnh vẽ (hoạt ảnh thu gọn chỉ phụ thuộc `sceneTime`).
- Dựng hình chạy trong `render.worker.ts` (OffscreenCanvas); mọi dữ liệu vào worker qua `RenderJob` (structuredClone được; Blob được phép).
- **Tương thích ngược tuyệt đối:** phong cách `theanh28` với cả "Bản tin nhiều cảnh" và "Video tải lên / Thẻ tiêu đề rồi video" phải ra cùng timeline, cùng chuỗi lệnh vẽ, cùng mẫu âm như trước (so từng mẫu: bằng nhau tuyệt đối khi không có `duck`). Số đo e2e 02 giữ: giọng **−16,51 dB**, đỉnh **0,358** (dung sai ±0,05 dB / ±0,005). Mọi test Vitest và e2e cũ phải xanh. Test cũ được sửa duy nhất: `tests/templates/registry.test.ts` (danh sách phong cách thêm `theanh28-banner`, Task 1 ghi rõ).
- `VideoOptionsSnapshot` của video mặc định KHÔNG có khoá mới (`uploadComposition` chỉ xuất hiện khi khác mặc định). `DRAFT_VERSION` giữ **3**. `BrandData` / `StoredBrand` / `BrandPanelState` chỉ có khoá `banner` khi có ảnh riêng (không có `banner: null`).
- Khung 1080×1920. Phong cách banner: dải banner **y = 1560..1920 (1080×360)**; mọi chữ (tiêu đề, phụ đề, dòng nguồn, tên kênh, ngày đăng, khối tiêu đề đè) và mọi khung ảnh/video có đáy **≤ 1560**.
- Banner tải lên: **PNG/JPG/WebP, ≤ 5 MB, rộng ≥ 720 px, tỉ lệ rộng/cao 2–5**; vẽ kiểu **cover** vào dải 1080×360 (cắt phần thừa, căn giữa). Banner mặc định: `public/templates/theanh28-banner/banner-chan-video.png` (2048×682, 1,95 MB) — không sửa, không nén lại.
- Chế độ đè: tổng = **đúng `durationSec` của video**; giọng bắt đầu ở `leadInSec`; giọng (kể cả nghỉ đầu) dài hơn video → **báo lỗi tiếng Việt** (không cắt). Thu gọn khối tiêu đề bắt đầu ở `voiceEnd + gapSec`, kéo dài **0,4 s**, smoothstep. Ducking tiếng gốc: **−12 dB**, vào **0,2 s** (kết thúc đúng lúc giọng bắt đầu), ra **0,25 s** (bắt đầu đúng lúc giọng hết), đường cosin nâng nội suy trên **biên độ tuyến tính**. Nhạc nền không duck (giữ quy tắc §15).
- Âm: `RENDER_SAMPLE_RATE = 48000`; trần đỉnh 0,89; giọng −16,5 dB; số đo giữ phương pháp cũ (cửa sổ 100 ms, cổng −45 dB).
- Ngôn ngữ giao diện, thông báo lỗi, tài liệu: tiếng Việt có dấu. Tên lớp, hàm, biến: tiếng Anh. Mọi file đang sửa dùng **LF** — giữ LF; file mới LF.
- Sau mỗi task: `npx vitest run`, `npm run typecheck`, `npm run lint` sạch (0 cảnh báo). Task có e2e chạy thêm spec được chỉ định; Task 7 chạy toàn bộ `npm run test:e2e` và `npm run build`.
- Mọi commit kết thúc bằng dòng `Co-Authored-By` do phiên chạy quy định (điều phối viên tự thêm).

## Ghi chú thiết kế (đề xuất kỹ thuật; điểm cần duyệt ở cuối kế hoạch)

- **D1. Một lớp, hai bố cục.** Không nhân bản `TheAnh28Template`: thêm `TheAnh28Layout` (kiểu của `LAYOUT`), lớp gốc nhận bố cục trong hàm dựng; mọi chỗ đọc `LAYOUT.` đổi thành `this.layout.`. `TheAnh28BannerTemplate` chỉ khai id/tên/bố cục/banner và vẽ banner sau `super.drawFrame`. Phong cách cũ giữ id `theanh28`, vẫn là mục đầu của ô "Phong cách video" (mặc định).
- **D2. Bố cục banner** (`BANNER_LAYOUT`, so với `LAYOUT`):

  | Phần | Theanh28 (cũ) | Theanh28 + banner |
  |---|---|---|
  | Mở đầu — ảnh | 0..1000 | 0..900 |
  | Mở đầu — dải chuyển màu | 860..1060 | 760..960 |
  | Mở đầu — chip / tem ngày / tiêu đề | 1010 / 1150 / 1215 | 910 / 1040 / 1100 |
  | Mở đầu — hoa văn chấm | 1450..1920 | 1340..1560 |
  | Mở đầu — đáy phụ đề | 990 | 890 |
  | Thân bài — khung ảnh/video | 380..1300 (1080×920) | 300..1180 (1080×880) |
  | Thân bài — tem ngày | 1236 | 1116 |
  | Thân bài — phụ đề | đáy 1600, 54/68 px | đáy 1520, 52/64 px |
  | Dòng nguồn / logo góc | 240 / 250 | 200 / 210 |
  | Khối tiêu đề đè (Task 5) | 1060..1920, tiêu đề 60/72 px tại 1300 | 980..1560, tiêu đề 56/68 px tại 1206 |
  | Banner | — | 1560..1920 |

  Kiểm chứng số: tiêu đề mở đầu lớn nhất (80 px, 3 dòng, giãn 98) đáy 1100 + 2·98 + 80 = 1376; phụ đề thân bài đỉnh 1520 − 2·64 = 1392 (dưới khung 1180); khối đè: tiêu đề 3 dòng đáy 1206 + 2·68 + 56 = 1398.
- **D3. Banner là trường thương hiệu thứ hai** (`key: "banner"`, `type: "image"`), chỉ phong cách banner có. Lưu cạnh logo trong `BrandRepository` (`brand:theanh28-banner`), vào session qua `BrandData.banner?`, vào job qua `RenderJob.banner?`. Chưa tải → dùng banner mặc định; nút "Dùng banner mặc định" xoá ảnh riêng. Kiểm khi chọn file: định dạng (dùng `classifyUpload`), ≤ 5 MB, đo kích thước (`createImageBitmap`, tiêm được để test), rộng ≥ 720, tỉ lệ 2–5.
- **D4. Thương hiệu mượn từ phong cách gốc.** Phong cách banner chưa lưu thương hiệu riêng thì `BrandController.load` mượn tên kênh, màu, cỡ chữ, logo của `theanh28` (khai bằng `VideoTemplate.brandFallbackId`), trạng thái "chưa lưu"; bấm "Lưu thương hiệu" thì lưu riêng cho `theanh28-banner`. Tránh bắt người dùng nhập lại tên kênh/logo.
- **D5. Cách ghép là tuỳ chọn của video** (`VideoOptions.uploadComposition`: `"intro-then-clip"` mặc định | `"title-over-clip"`), không phải kiểu dự án: chọn được ở bước 1 (trước "Tạo dự án") và đổi được ở bước "Video của bạn"; đổi không làm giọng thành cũ. Bản nháp v3 đọc/ghi khoan dung như mọi tuỳ chọn khác.
- **D6. Thời gian chế độ đè:** khe duy nhất `source-clip` = [0, D]; giọng [leadIn, leadIn + giọng]; khối tiêu đề hiện từ giây 0, giữ tới `voiceEnd + gapSec` (thanh "Nghỉ sau tiêu đề" đổi nhãn thành "Giữ tiêu đề sau khi đọc"), thu gọn 0,4 s (trượt xuống + mờ dần, smoothstep) rồi còn tên kênh/logo góc, ngày đăng, dòng nguồn như cảnh thân bài. Video kết thúc trước khi thu gọn xong thì khung cuối còn khối đang thu (chấp nhận). Không phụ đề (như §15).
- **D7. Giọng dài hơn video → báo lỗi, không cắt.** Cắt ngang câu tiêu đề cho video tệ hơn là chặn: bước Giọng hiện cảnh báo sớm (ước lượng = độ dài giọng thô ÷ tempo), bước Dựng chặn bằng độ dài thật (đã cắt lặng, đã chỉnh tempo) qua `ValidationError` — RenderController đã hiện `role="alert"`. Câu báo gợi ý: rút gọn tiêu đề, giảm nghỉ đầu, tăng tốc độ đọc, hoặc chọn "Thẻ tiêu đề rồi video".
- **D8. Ducking** (`duckGain`): độ lợi tuyến tính g(t) = 1 − (1 − 10^(−12/20))·a(t), a(t) cosin nâng 0→1 trong [voiceStart − 0,2, voiceStart], = 1 trong [voiceStart, voiceEnd], 1→0 trong [voiceEnd, voiceEnd + 0,25]. Nhân thêm vào hệ số tiếng gốc (sau vuốt 20 ms). Mức tiếng gốc dùng cho quy tắc nhạc nền vẫn tính trên tín hiệu chưa duck (nhạc giữ mức cố định cả bài).

## Cấu trúc file

```
src/templates/theanh28/layout.ts              # sửa (T1): interface TheAnh28Layout; (T5) titleOverlay
src/templates/theanh28/bannerLayout.ts        # mới (T1): BANNER_LAYOUT, FOOTER_BANNER_BOX; (T5) titleOverlay
src/templates/theanh28/TheAnh28Template.ts    # sửa (T1): bố cục qua hàm dựng; (T5) khối tiêu đề đè
src/templates/theanh28/TheAnh28BannerTemplate.ts # mới (T1): phong cách banner; (T2) trường banner, brandFallbackId
src/templates/VideoTemplate.ts                # sửa (T1): ProjectFrame.banner, footerBanner; (T2) brandFallbackId; (T5) TitleOverlay
src/templates/titleOverlay.ts                 # mới (T5): TITLE_COLLAPSE_SEC, titleCollapseProgress
src/templates/registry.ts                     # sửa (T1)
src/domain/FooterBanner.ts                    # mới (T2): giới hạn + checkFooterBanner
src/domain/UploadComposition.ts               # mới (T4): kiểu, nhãn, quy tắc độ dài giọng
src/domain/VideoOptions.ts                    # sửa (T4): uploadComposition
src/domain/Timeline.ts                        # sửa (T5): Timeline.overlay
src/client/storage/BrandRepository.ts         # sửa (T2): banner
src/client/controllers/StudioSession.ts       # sửa (T2): BrandData.banner, sameBrand
src/client/controllers/BrandController.ts     # sửa (T2): setBanner/clearBanner, mượn thương hiệu
src/client/controllers/OptionsController.ts   # sửa (T4): setUploadComposition
src/client/controllers/readiness.ts           # sửa (T4): titleOverlayWarning
src/client/controllers/renderSummary.ts       # sửa (T4): câu tóm tắt chế độ đè
src/client/controllers/RenderJobBuilder.ts    # sửa (T2 banner, T5 composition + kiểm độ dài)
src/client/render/RenderJob.ts                # sửa (T2 banner, T5 composition)
src/client/render/RenderPlan.ts               # sửa (T5): nhánh overlay, titleOverlayFor
src/client/render/VideoRenderer.ts            # sửa (T5): RenderScene.titleOverlay → SceneFrame
src/client/render/render.worker.ts            # sửa (T2 banner, T5 overlay, T6 duck) — không test Vitest
src/client/media/AudioMix.ts                  # sửa (T6): DuckWindow, duckGain, SourceBed.duck
src/client/preview/PreviewFrameBuilder.ts     # sửa (T3 banner, T5 khung đè)
src/client/preview/PreviewController.ts       # sửa (T3): nạp banner (riêng / mặc định)
src/views/studio/components/BrandPanel.tsx    # sửa (T2)
src/views/studio/components/PreviewPanel.tsx  # sửa (T3 loadImageUrl, T5 nhãn tab)
src/views/studio/components/CompositionPicker.tsx # mới (T4)
src/views/studio/components/OptionsSidebar.tsx# sửa (T4): nhãn nhịp đọc ở chế độ đè
src/views/studio/steps/StepNews.tsx           # sửa (T4)
src/views/studio/steps/StepClip.tsx           # sửa (T4)
src/views/studio/steps/StepVoice.tsx          # sửa (T4)
scripts/lib/frameRegion.ts                    # sửa (T3): edgeSharpness
e2e/09-phong-cach-banner.spec.ts              # mới (T3)
e2e/10-doc-tieu-de-de-video.spec.ts           # mới (T7)
README.md, docs/superpowers/specs/...design.md# sửa (T7): §16
```

Thứ tự phụ thuộc: **T1 → T2 → T3** (banner) và **T4** (mô hình cách ghép) → **T5 → T6** (chế độ đè) → **T7**. T4 không chung file với T1–T3 nên giao song song được (agent riêng). T5 cần T1 (`TheAnh28Layout`), T3 (cùng sửa `PreviewFrameBuilder.ts`, `PreviewPanel.tsx`) và T4 (`UploadComposition`) nên chạy sau cả ba. Mỗi task chỉ dựa vào khối **Interfaces → Produces** của task trước.

### Phần không kiểm được bằng Vitest (ghi rõ để report không bỏ sót)

- `src/client/render/render.worker.ts` (OffscreenCanvas, `createImageBitmap`, mediabunny, fetch): chỉ kiểm bằng `typecheck` + `lint` ở T2, T5, T6; kiểm thật bằng e2e ở T3 và T7. Logic quyết định đã tách ra hàm thuần có test (`planRender`, `titleOverlayFor`, `Timeline.overlay`, `duckGain`, `mixProgram`, template).
- Các file `.tsx` (`BrandPanel`, `PreviewPanel`, `CompositionPicker`, `StepNews`, `StepClip`, `StepVoice`, `OptionsSidebar`): kiểm bằng `typecheck` + `lint` + e2e (T3, T7). Quy tắc hiển thị nằm ở controller có test (`titleOverlayWarning`, `renderSummary`).
- Đo kích thước ảnh mặc định (`createImageBitmap` trong `BrandController`) và `loadImageUrl` của `PreviewPanel`: tiêm được; bản thật chỉ kiểm bằng e2e 09.

---

### Task 1: Bố cục tham số hoá + phong cách "Bản tin Theanh28 + banner chân"

**Files:**
- Modify: `src/templates/theanh28/layout.ts` (thêm `TheAnh28Layout`, `LAYOUT … as const satisfies TheAnh28Layout`)
- Create: `src/templates/theanh28/bannerLayout.ts`
- Modify: `src/templates/theanh28/TheAnh28Template.ts` (toàn file, bố cục qua hàm dựng)
- Create: `src/templates/theanh28/TheAnh28BannerTemplate.ts`
- Modify: `src/templates/VideoTemplate.ts` (`ProjectFrame.banner`, `FooterBannerSpec`, `VideoTemplate.footerBanner`)
- Modify: `src/templates/registry.ts`
- Test: `tests/templates/theanh28/TheAnh28BannerTemplate.test.ts` (mới)
- Modify test (được phép, duy nhất): `tests/templates/registry.test.ts`

**Interfaces:**
- Consumes: không (task đầu).
- Produces:
  - `src/templates/theanh28/layout.ts`: `export interface TheAnh28Layout { frame; intro; body; credit; logo; dateTag; subtitle; kenBurns; blurPx }` (đúng hình dạng `LAYOUT` hiện tại); `LAYOUT` giữ nguyên số.
  - `src/templates/theanh28/bannerLayout.ts`: `export const FOOTER_BANNER_BOX: Rect` = `{ x: 0, y: 1560, w: 1080, h: 360 }`; `export const BANNER_LAYOUT: TheAnh28Layout`.
  - `src/templates/VideoTemplate.ts`: `ProjectFrame.banner?: DrawableImage | null`; `export interface FooterBannerSpec { defaultUrl: string; box: { x: number; y: number; w: number; h: number } }`; `VideoTemplate.footerBanner: FooterBannerSpec | null` (mặc định `null`).
  - `src/templates/theanh28/TheAnh28Template.ts`: `export const THEANH28_BRAND_FIELDS: readonly BrandFieldSpec[]`; `class TheAnh28Template { constructor(layout?: TheAnh28Layout); protected readonly layout: TheAnh28Layout; readonly id: string; readonly name: string }`.
  - `src/templates/theanh28/TheAnh28BannerTemplate.ts`: `export const THEANH28_BANNER_ID = "theanh28-banner"`; `export const DEFAULT_FOOTER_BANNER_URL = "/templates/theanh28-banner/banner-chan-video.png"`; `class TheAnh28BannerTemplate extends TheAnh28Template` (tên "Bản tin Theanh28 + banner chân").
  - `defaultTemplateRegistry().list()` = `[{ id: "theanh28", … }, { id: "theanh28-banner", name: "Bản tin Theanh28 + banner chân" }]`.

- [ ] **Step 1: Viết test đỏ**

`tests/templates/theanh28/TheAnh28BannerTemplate.test.ts`:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BrandKit } from "@/domain/BrandKit";
import { VideoOptions } from "@/domain/VideoOptions";
import { frameStyleFor } from "@/templates/fonts/FontCatalog";
import { BANNER_LAYOUT, FOOTER_BANNER_BOX } from "@/templates/theanh28/bannerLayout";
import { DEFAULT_FOOTER_BANNER_URL, TheAnh28BannerTemplate } from "@/templates/theanh28/TheAnh28BannerTemplate";
import { TheAnh28Template } from "@/templates/theanh28/TheAnh28Template";
import { coverRect, LAYOUT } from "@/templates/theanh28/layout";
import { SOURCE_CLIP_MEDIA, type DrawableImage, type ProjectFrame, type SceneFrame } from "@/templates/VideoTemplate";
import { RecordingCanvas, type DrawCall } from "../../helpers/RecordingCanvas";

const t = new TheAnh28BannerTemplate();
const photo: DrawableImage = { source: { tag: "img" } as unknown as CanvasImageSource, width: 1600, height: 900 };
const banner: DrawableImage = { source: { tag: "banner" } as unknown as CanvasImageSource, width: 2048, height: 682 };
const LONG =
  "Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã vì lạm quyền, tự ý bán trụ sở làm việc và nhiều sai phạm nghiêm trọng khác";

const project = (over: Partial<ProjectFrame> = {}): ProjectFrame => ({
  displayTitle: LONG,
  sourceCredit: "Đức Phong - VietNamNet",
  publishDateText: "14/10/2026",
  brand: BrandKit.create(t.id, t.brandFields, { channelName: "28 News", titleFontPx: "80" }),
  logo: null,
  banner,
  style: frameStyleFor(VideoOptions.defaults().snapshot()), // phụ đề bật
  ...over,
});
const scene = (over: Partial<SceneFrame> = {}): SceneFrame => ({
  role: "body",
  text: LONG,
  image: photo,
  sceneTime: 0,
  sceneDuration: 4,
  ...over,
});
const draw = (tpl: TheAnh28Template, p: ProjectFrame, s: SceneFrame) => {
  const c = new RecordingCanvas();
  tpl.drawFrame(c.asCanvas(), p, s);
  return c;
};
const fontPx = (c: DrawCall) => Number(/(\d+(?:\.\d+)?)px/.exec(c.state.font)?.[1] ?? 0);
/** Đáy (bảo thủ) của mọi dòng chữ: y + cỡ chữ (với baseline "middle" còn dư nửa cỡ chữ). */
const textBottoms = (c: RecordingCanvas) =>
  c.calls.filter((x) => x.op === "fillText" || x.op === "strokeText").map((x) => Number(x.args[2]) + fontPx(x));
const isBannerRect = (x: DrawCall) =>
  x.args[0] === FOOTER_BANNER_BOX.x && x.args[1] === FOOTER_BANNER_BOX.y && x.args[2] === FOOTER_BANNER_BOX.w && x.args[3] === FOOTER_BANNER_BOX.h;

describe("TheAnh28BannerTemplate — khai báo", () => {
  it("id, tên, cùng trường thương hiệu và font với Theanh28, có banner mặc định", () => {
    expect(t.id).toBe("theanh28-banner");
    expect(t.name).toBe("Bản tin Theanh28 + banner chân");
    expect(t.fonts).toEqual(new TheAnh28Template().fonts);
    expect(t.defaults).toMatchObject({ width: 1080, height: 1920, fps: 30, fallbackKeyword: "news" });
    expect(t.footerBanner).toEqual({ defaultUrl: DEFAULT_FOOTER_BANNER_URL, box: FOOTER_BANNER_BOX });
    expect(existsSync(join(process.cwd(), "public", DEFAULT_FOOTER_BANNER_URL))).toBe(true);
  });

  it("phong cách cũ không có banner; bố cục mặc định vẫn là LAYOUT", () => {
    expect(new TheAnh28Template().footerBanner).toBeNull();
    expect(new TheAnh28Template().id).toBe("theanh28");
  });

  it("bố cục banner: khung thân bài, phụ đề, hoa văn đều kết thúc trên dải banner", () => {
    const L = BANNER_LAYOUT;
    expect(FOOTER_BANNER_BOX).toEqual({ x: 0, y: 1560, w: 1080, h: 360 });
    expect(L.body.band.y + L.body.band.h).toBeLessThanOrEqual(1560);
    expect(L.subtitle.bodyBottom).toBeLessThanOrEqual(1560);
    expect(L.intro.pattern.y + L.intro.pattern.h).toBeLessThanOrEqual(1560);
    expect(L.frame).toEqual(LAYOUT.frame);
  });
});

describe("TheAnh28BannerTemplate — mọi nội dung nằm trên y = 1560", () => {
  for (const role of ["intro", "body"] as const) {
    it(`${role}: chữ (cả tiêu đề 80 px, phụ đề) có đáy ≤ 1560; khung cắt ảnh không xuống dải banner`, () => {
      const c = draw(t, project(), scene({ role, sceneTime: 1 }));
      expect(c.texts().length).toBeGreaterThan(3);
      expect(Math.max(...textBottoms(c))).toBeLessThanOrEqual(1560);
      for (const r of c.ops("rect").filter((x) => !isBannerRect(x))) {
        expect(Number(r.args[1]) + Number(r.args[3])).toBeLessThanOrEqual(1560);
      }
    });
  }

  it("video tải lên (contain) dùng khung thân bài 1080×880 tại y = 300", () => {
    const c = draw(t, project(), scene({ text: "", media: SOURCE_CLIP_MEDIA }));
    expect(c.ops("rect").some((x) => x.args.join() === "0,300,1080,880")).toBe(true);
  });
});

describe("TheAnh28BannerTemplate — vẽ banner", () => {
  it("banner vẽ SAU CÙNG, kiểu cover vào dải 1080×360, trong vùng cắt của dải", () => {
    for (const role of ["intro", "body"] as const) {
      const c = draw(t, project(), scene({ role }));
      const images = c.ops("drawImage");
      const last = images.at(-1);
      expect(last?.args[0]).toBe(banner.source);
      const r = coverRect(2048, 682, FOOTER_BANNER_BOX);
      expect(last?.args.slice(1)).toEqual([r.x, r.y, r.w, r.h]);
      expect(Number(last?.args[2])).toBeCloseTo(1560, 6);
      expect(Number(last?.args[4])).toBeCloseTo(360, 6);
      expect(c.ops("rect").some(isBannerRect)).toBe(true);
      const lastIndex = c.calls.lastIndexOf(last as DrawCall);
      expect(c.calls.slice(lastIndex + 1).every((x) => x.op === "restore")).toBe(true);
    }
  });

  it("không có ảnh banner (null) thì tô đen dải đáy, không vẽ ảnh", () => {
    const c = draw(t, project({ banner: null }), scene());
    expect(c.ops("drawImage").some((x) => x.args[0] === banner.source)).toBe(false);
    const black = c.ops("fillRect").filter((x) => x.args.join() === "0,1560,1080,360");
    expect(black).toHaveLength(1);
    expect(black[0]?.state.fillStyle).toBe("#000000");
  });

  it("thuần theo thời gian: cùng đầu vào ra cùng chuỗi lệnh", () => {
    const a = draw(t, project(), scene({ sceneTime: 1.25 }));
    const b = draw(t, project(), scene({ sceneTime: 1.25 }));
    expect(a.calls).toEqual(b.calls);
  });

  it("phong cách cũ bỏ qua project.banner (khung cũ y hệt)", () => {
    const old = new TheAnh28Template();
    const withBanner = draw(old, project(), scene());
    const without = draw(old, project({ banner: undefined }), scene());
    expect(withBanner.calls).toEqual(without.calls);
    expect(withBanner.ops("drawImage").some((x) => x.args[0] === banner.source)).toBe(false);
  });
});
```

`tests/templates/registry.test.ts` — sửa đúng giá trị mong đợi (thay dòng `expect(...).toEqual([...])` cũ):

```ts
    expect(defaultTemplateRegistry().list()).toEqual([
      { id: "theanh28", name: "Bản tin kiểu Theanh28" },
      { id: "theanh28-banner", name: "Bản tin Theanh28 + banner chân" },
    ]);
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run tests/templates`
Expected: FAIL — `Cannot find package '@/templates/theanh28/bannerLayout'` / `TheAnh28BannerTemplate`; registry: `expected [ { id: 'theanh28', … } ] to deeply equal [ …(2) ]`. Các test `TheAnh28Template.test.ts` cũ vẫn PASS.

- [ ] **Step 3: `layout.ts` — thêm kiểu bố cục**

Trong `src/templates/theanh28/layout.ts`, ngay sau `interface Rect`, thêm:

```ts
/** Toạ độ một bố cục Theanh28 (khung 1080×1920). `LAYOUT` là bố cục gốc; phong cách con truyền bố cục riêng. */
export interface TheAnh28Layout {
  frame: { width: number; height: number };
  intro: {
    image: Rect;
    gradientTop: number;
    gradientSolid: number;
    chip: { x: number; y: number; h: number; padX: number; logoSize: number; gap: number; fontPx: number };
    dateTag: { x: number; y: number };
    title: { x: number; y: number; maxWidth: number; fontPx: number; lineHeight: number; maxLines: number };
    pattern: Rect & { spacing: number; radius: number; alpha: number };
  };
  body: { band: Rect; dateTag: { x: number; y: number }; backdropScale: number; backdropShade: number };
  credit: { x: number; y: number; lineHeight: number; fontPx: number; rightMargin: number; gapToLogo: number };
  logo: { right: number; y: number; size: number; gap: number; fontPx: number };
  dateTag: { h: number; padX: number; fontPx: number };
  subtitle: {
    centerX: number;
    maxWidth: number;
    fontPx: number;
    lineHeight: number;
    maxLines: number;
    bodyBottom: number;
    introBottom: number;
    strokePx: number;
    shadowBlurPx: number;
    shadowOffsetPx: number;
  };
  kenBurns: { from: number; to: number };
  blurPx: number;
}
```

Đổi dòng kết thúc của `LAYOUT` từ `} as const;` thành:

```ts
} as const satisfies TheAnh28Layout;
```

(Không đổi bất kỳ số nào trong `LAYOUT`.)

- [ ] **Step 4: `bannerLayout.ts` (mới)**

```ts
import { LAYOUT, type Rect, type TheAnh28Layout } from "./layout";

/** Dải banner chân video: đáy khung 1080×1920, cao 360 (ảnh 3:1). */
export const FOOTER_BANNER_BOX: Rect = { x: 0, y: 1560, w: 1080, h: 360 };

/**
 * Bố cục Theanh28 khi có banner chân: mọi nội dung đẩy lên trên y = 1560 (xem bảng D2 trong kế hoạch 07).
 * Chỉ đổi các toạ độ dọc và cỡ phụ đề; bề ngang, font, hiệu ứng giữ như LAYOUT.
 */
export const BANNER_LAYOUT: TheAnh28Layout = {
  ...LAYOUT,
  intro: {
    ...LAYOUT.intro,
    image: { x: 0, y: 0, w: 1080, h: 900 },
    gradientTop: 760,
    gradientSolid: 960,
    chip: { ...LAYOUT.intro.chip, y: 910 },
    dateTag: { x: 96, y: 1040 },
    title: { ...LAYOUT.intro.title, y: 1100 },
    pattern: { ...LAYOUT.intro.pattern, y: 1340, h: 220 },
  },
  body: { ...LAYOUT.body, band: { x: 0, y: 300, w: 1080, h: 880 }, dateTag: { x: 96, y: 1116 } },
  credit: { ...LAYOUT.credit, y: 200 },
  logo: { ...LAYOUT.logo, y: 210 },
  subtitle: { ...LAYOUT.subtitle, fontPx: 52, lineHeight: 64, bodyBottom: 1520, introBottom: 890 },
};
```

- [ ] **Step 5: `VideoTemplate.ts` — banner trong khung và trong phong cách**

Trong `interface ProjectFrame`, thêm sau `mediaCredit?: string;`:

```ts
  /** Ảnh banner chân (phong cách có banner); null/bỏ trống = phong cách tự xử lý (tô đen dải). Phong cách khác bỏ qua. */
  banner?: DrawableImage | null;
```

Trước `export abstract class VideoTemplate`, thêm:

```ts
/** Phong cách có banner chân: ảnh mặc định (URL tương đối trong public/) và dải vẽ trên khung. */
export interface FooterBannerSpec {
  defaultUrl: string;
  box: { x: number; y: number; w: number; h: number };
}
```

Trong lớp `VideoTemplate`, sau `abstract readonly fonts…`, thêm:

```ts
  /** Có thì worker/xem trước nạp ảnh banner (riêng của thương hiệu, không có thì `defaultUrl`) vào `ProjectFrame.banner`. */
  readonly footerBanner: FooterBannerSpec | null = null;
```

- [ ] **Step 6: `TheAnh28Template.ts` — bố cục qua hàm dựng (thay toàn file)**

```ts
import type { BrandFieldSpec } from "@/domain/BrandKit";
import { DEFAULT_TIMELINE_CONFIG } from "@/domain/Timeline";
import type { Canvas2D } from "../Canvas2D";
import {
  cssFont,
  VideoTemplate,
  type DrawableImage,
  type FontFaceSpec,
  type FontStyle,
  type FrameStyle,
  type ProjectFrame,
  type SceneFrame,
  type SceneMedia,
  type TemplateDefaults,
} from "../VideoTemplate";
import { containRect, coverRect, kenBurnsRect, LAYOUT, withAlpha, wrapText, type Rect, type TheAnh28Layout } from "./layout";
import { cueAt, splitSubtitle, timeCues, type SubtitleCue } from "./subtitles";

export const THEANH28_FONT_FAMILY = "TVS Barlow Condensed";
const DEFAULT_COLOR = "#1F9D55";
const WHITE = "#FFFFFF";
/** Font chữ khi dự án không có tuỳ chọn riêng: giữ đúng hình ảnh trước khi có tuỳ chọn video. */
const DEFAULT_TEXT_FONT: FontStyle = { family: THEANH28_FONT_FAMILY, semiBold: 600, bold: 800 };

/** Trường thương hiệu của Theanh28 (phong cách con dùng lại rồi thêm trường riêng). */
export const THEANH28_BRAND_FIELDS: readonly BrandFieldSpec[] = [
  { key: "channelName", label: "Tên kênh", type: "text", required: true, defaultValue: "TIN NHANH", maxLength: 24 },
  { key: "primaryColor", label: "Màu chủ đạo", type: "color", required: true, defaultValue: DEFAULT_COLOR },
  { key: "logo", label: "Logo", type: "image", required: false },
  { key: "titleFontPx", label: "Cỡ chữ tiêu đề mở đầu (px, 44–80)", type: "number", required: false, defaultValue: "64", min: 44, max: 80 },
];

type Weight = "semiBold" | "bold";

const upper = (s: string) => s.toLocaleUpperCase("vi");

export class TheAnh28Template extends VideoTemplate {
  readonly id: string = "theanh28";
  readonly name: string = "Bản tin kiểu Theanh28";
  readonly brandFields: readonly BrandFieldSpec[] = THEANH28_BRAND_FIELDS;
  readonly defaults: TemplateDefaults;

  readonly fonts: readonly FontFaceSpec[] = [
    { family: THEANH28_FONT_FAMILY, url: "/templates/theanh28/fonts/BarlowCondensed-SemiBold.ttf", weight: "600" },
    { family: THEANH28_FONT_FAMILY, url: "/templates/theanh28/fonts/BarlowCondensed-ExtraBold.ttf", weight: "800" },
  ];

  /** Toạ độ khung. Gán trong hàm dựng (không dùng tham số-thuộc-tính: trường lớp khởi tạo trước khi tham số được gán). */
  protected readonly layout: TheAnh28Layout;

  /** Đoạn phụ đề đã chia, theo (font, mốc giọng, câu). Chỉ là bộ nhớ đệm: kết quả chỉ phụ thuộc đầu vào nên hàm vẽ vẫn thuần. */
  private readonly cueCache = new Map<string, SubtitleCue[]>();

  /** `layout` bỏ trống = bố cục Theanh28 gốc (hình y hệt trước khi tham số hoá). */
  constructor(layout: TheAnh28Layout = LAYOUT) {
    super();
    this.layout = layout;
    this.defaults = {
      width: layout.frame.width,
      height: layout.frame.height,
      fps: 30,
      timeline: DEFAULT_TIMELINE_CONFIG,
      fallbackKeyword: "news",
    };
  }

  protected drawIntro(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void {
    const color = this.color(project);
    // Màu riêng của thumbnail đầu (tuỳ chọn video); không đặt thì theo màu chủ đạo thương hiệu.
    const background = project.style?.intro.backgroundColor ?? color;
    const block = project.style?.intro.blockColor ?? color;
    const { width, height } = this.layout.frame;
    const L = this.layout.intro;

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    if (scene.image) this.drawClipped(ctx, scene.image, L.image, this.progress(scene));

    const gradient = ctx.createLinearGradient(0, L.gradientTop, 0, L.gradientSolid);
    gradient.addColorStop(0, withAlpha(block, 0));
    gradient.addColorStop(1, block);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, L.gradientTop, width, L.gradientSolid - L.gradientTop);
    ctx.fillStyle = block;
    ctx.fillRect(0, L.gradientSolid, width, height - L.gradientSolid);

    this.drawDotPattern(ctx);
    this.drawChip(ctx, project);
    this.drawDateTag(ctx, project, project.publishDateText, L.dateTag.x, L.dateTag.y);

    const fontPx = Number(project.brand.get("titleFontPx") ?? L.title.fontPx);
    const lineHeight = Math.round(fontPx * (L.title.lineHeight / L.title.fontPx));
    ctx.font = this.font(project, "bold", fontPx);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const lines = wrapText(upper(project.displayTitle), L.title.maxWidth, (s) => ctx.measureText(s).width, L.title.maxLines);
    lines.forEach((line, i) => ctx.fillText(line, L.title.x, L.title.y + i * lineHeight));
  }

  protected drawBody(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void {
    const color = this.color(project);
    const { width, height } = this.layout.frame;
    const B = this.layout.body;

    if (scene.image) {
      if (scene.backdrop) {
        // nền mờ đã được thu nhỏ sẵn: phóng ra toàn khung bằng nội suy
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(scene.backdrop.source, 0, 0, width, height);
      } else {
        const full = coverRect(scene.image.width, scene.image.height, { x: 0, y: 0, w: width, h: height });
        const backdrop = kenBurnsRect(full, 1, 1, B.backdropScale);
        ctx.filter = `blur(${this.layout.blurPx}px)`;
        ctx.drawImage(scene.image.source, backdrop.x, backdrop.y, backdrop.w, backdrop.h);
        ctx.filter = "none";
      }
      ctx.fillStyle = `rgba(0,0,0,${B.backdropShade})`;
      ctx.fillRect(0, 0, width, height);
      this.drawClipped(ctx, scene.image, B.band, this.progress(scene), scene.media);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "#0B0F0D");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    this.drawDateTag(ctx, project, project.publishDateText, B.dateTag.x, B.dateTag.y);
  }

  protected drawOverlay(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void {
    const C = this.layout.credit;
    // vùng cho phép của dòng nguồn tin: tới mép trái huy hiệu logo (cảnh thân bài) hoặc mép phải khung (cảnh mở đầu)
    const limit =
      (scene.role === "body" ? this.cornerLogoBox(ctx, project).badgeX - C.gapToLogo : this.layout.frame.width - C.rightMargin) -
      C.x;
    ctx.font = this.font(project, "semiBold", C.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const measure = (s: string) => ctx.measureText(s).width;
    const mediaCredit = project.mediaCredit ?? "ẢNH: TỔNG HỢP";
    const lines = project.sourceCredit ? [`THEO: ${upper(project.sourceCredit)}`, mediaCredit] : [mediaCredit];
    lines.forEach((line, i) => ctx.fillText(wrapText(line, limit, measure, 1)[0] ?? "", C.x, C.y + i * C.lineHeight));
    if (scene.role === "body") this.drawCornerLogo(ctx, project);
    if (project.style?.subtitles.enabled) this.drawSubtitle(ctx, project.style, scene);
  }

  private drawSubtitle(ctx: Canvas2D, style: FrameStyle, scene: SceneFrame): void {
    const S = this.layout.subtitle;
    ctx.save();
    ctx.font = cssFont(style.subtitles.font, "bold", S.fontPx);
    const voiceStart = scene.voiceStart ?? 0;
    const voiceDuration = scene.voiceDuration ?? scene.sceneDuration;
    const cue = cueAt(this.cues(ctx, scene.text, voiceStart, voiceDuration), scene.sceneTime);
    if (cue) {
      const bottom = scene.role === "intro" ? S.introBottom : S.bodyBottom;
      const top = bottom - cue.lines.length * S.lineHeight;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineJoin = "round";
      ctx.lineWidth = S.strokePx;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = S.shadowBlurPx;
      ctx.shadowOffsetY = S.shadowOffsetPx;
      cue.lines.forEach((line, i) => ctx.strokeText(line, S.centerX, top + i * S.lineHeight));
      ctx.shadowColor = "rgba(0,0,0,0)";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = WHITE;
      cue.lines.forEach((line, i) => ctx.fillText(line, S.centerX, top + i * S.lineHeight));
    }
    ctx.restore();
  }

  private cues(ctx: Canvas2D, text: string, voiceStart: number, voiceDuration: number): SubtitleCue[] {
    const key = `${ctx.font}|${voiceStart}|${voiceDuration}|${text}`;
    let cues = this.cueCache.get(key);
    if (!cues) {
      if (this.cueCache.size >= 64) this.cueCache.clear();
      const S = this.layout.subtitle;
      cues = timeCues(splitSubtitle(text, S.maxWidth, (s) => ctx.measureText(s).width, S.maxLines), voiceStart, voiceDuration);
      this.cueCache.set(key, cues);
    }
    return cues;
  }

  private font(project: ProjectFrame, weight: Weight, px: number): string {
    return cssFont(project.style?.textFont ?? DEFAULT_TEXT_FONT, weight, px);
  }

  private color(project: ProjectFrame): string {
    return project.brand.get("primaryColor") ?? DEFAULT_COLOR;
  }

  private channelName(project: ProjectFrame): string {
    return upper(project.brand.get("channelName") ?? "TIN NHANH");
  }

  /** Tiến độ Ken Burns theo thời gian cảnh trám (cả nhóm đoạn dùng chung), không theo từng đoạn. */
  private progress(scene: SceneFrame): number {
    const time = scene.footageTime ?? scene.sceneTime;
    const duration = scene.footageDuration ?? scene.sceneDuration;
    return duration > 0 ? time / duration : 0;
  }

  private drawClipped(ctx: Canvas2D, image: DrawableImage, box: Rect, progress: number, media?: SceneMedia): void {
    const base = media?.fit === "contain" ? containRect(image.width, image.height, box) : coverRect(image.width, image.height, box);
    const K = this.layout.kenBurns;
    const target = media?.motion === false ? base : kenBurnsRect(base, progress, K.from, K.to);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.drawImage(image.source, target.x, target.y, target.w, target.h);
    ctx.restore();
  }

  private drawDotPattern(ctx: Canvas2D): void {
    const P = this.layout.intro.pattern;
    ctx.save();
    ctx.globalAlpha = P.alpha;
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    for (let y = P.y + P.spacing / 2; y < P.y + P.h; y += P.spacing) {
      for (let x = P.x + P.spacing / 2; x < P.x + P.w; x += P.spacing) {
        ctx.rect(x - P.radius, y - P.radius, P.radius * 2, P.radius * 2);
      }
    }
    ctx.fill();
    ctx.restore();
  }

  private drawLogoBadge(ctx: Canvas2D, project: ProjectFrame, x: number, y: number, size: number): void {
    const color = this.color(project);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    if (project.logo) {
      const r = coverRect(project.logo.width, project.logo.height, { x, y, w: size, h: size });
      ctx.drawImage(project.logo.source, r.x, r.y, r.w, r.h);
    } else {
      ctx.fillStyle = WHITE;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = color;
      ctx.font = this.font(project, "bold", Math.round(size * 0.55));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.channelName(project).charAt(0), x + size / 2, y + size / 2);
    }
    ctx.restore();
  }

  private drawChip(ctx: Canvas2D, project: ProjectFrame): void {
    const K = this.layout.intro.chip;
    const name = this.channelName(project);
    ctx.font = this.font(project, "bold", K.fontPx);
    const textW = ctx.measureText(name).width;
    const w = K.padX + K.logoSize + K.gap + textW + K.padX;
    ctx.fillStyle = this.color(project);
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(K.x, K.y, w, K.h, K.h / 2);
    ctx.fill();
    ctx.stroke();
    this.drawLogoBadge(ctx, project, K.x + K.padX, K.y + (K.h - K.logoSize) / 2, K.logoSize);
    ctx.font = this.font(project, "bold", K.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(name, K.x + K.padX + K.logoSize + K.gap, K.y + K.h / 2);
  }

  private drawDateTag(ctx: Canvas2D, project: ProjectFrame, dateText: string, x: number, y: number): void {
    const D = this.layout.dateTag;
    const text = `NGÀY ĐĂNG: ${dateText}`;
    ctx.font = this.font(project, "semiBold", D.fontPx);
    const w = ctx.measureText(text).width + D.padX * 2;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, y, w, D.h);
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + D.padX, y + D.h / 2);
  }

  /** Vị trí huy hiệu logo và chữ tên kênh ở góc trên phải (cảnh thân bài). Đặt font của ctx về font tên kênh. */
  private cornerLogoBox(ctx: Canvas2D, project: ProjectFrame): { name: string; textX: number; badgeX: number } {
    const G = this.layout.logo;
    const name = this.channelName(project);
    ctx.font = this.font(project, "bold", G.fontPx);
    const textX = this.layout.frame.width - G.right - ctx.measureText(name).width;
    return { name, textX, badgeX: textX - G.gap - G.size };
  }

  private drawCornerLogo(ctx: Canvas2D, project: ProjectFrame): void {
    const G = this.layout.logo;
    const { name, textX, badgeX } = this.cornerLogoBox(ctx, project);
    this.drawLogoBadge(ctx, project, badgeX, G.y, G.size);
    ctx.font = this.font(project, "bold", G.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(name, textX, G.y + G.size / 2);
  }
}
```

(Ghi chú cho implementer: so với file cũ chỉ đổi `LAYOUT.` → `this.layout.`, thêm `THEANH28_BRAND_FIELDS`, hàm dựng, kiểu `string` cho `id`/`name`, và truyền `from/to` Ken Burns tường minh — cùng giá trị mặc định nên số giống hệt.)

- [ ] **Step 7: `TheAnh28BannerTemplate.ts` (mới)**

```ts
import type { Canvas2D } from "../Canvas2D";
import type { DrawableImage, FooterBannerSpec, ProjectFrame, SceneFrame } from "../VideoTemplate";
import { BANNER_LAYOUT, FOOTER_BANNER_BOX } from "./bannerLayout";
import { coverRect } from "./layout";
import { TheAnh28Template } from "./TheAnh28Template";

export const THEANH28_BANNER_ID = "theanh28-banner";
export const DEFAULT_FOOTER_BANNER_URL = "/templates/theanh28-banner/banner-chan-video.png";

/** Theanh28 + banner chân 1080×360: nội dung dời lên trên y = 1560, banner hiện suốt video (cả thẻ đầu). */
export class TheAnh28BannerTemplate extends TheAnh28Template {
  readonly id: string = THEANH28_BANNER_ID;
  readonly name: string = "Bản tin Theanh28 + banner chân";
  readonly footerBanner: FooterBannerSpec | null = { defaultUrl: DEFAULT_FOOTER_BANNER_URL, box: FOOTER_BANNER_BOX };

  constructor() {
    super(BANNER_LAYOUT);
  }

  drawFrame(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void {
    super.drawFrame(ctx, project, scene);
    this.drawFooterBanner(ctx, project.banner ?? null);
  }

  /** Banner phủ kín dải (cover, căn giữa, cắt phần thừa). Chưa có ảnh thì tô đen để bố cục không đổi. */
  private drawFooterBanner(ctx: Canvas2D, banner: DrawableImage | null): void {
    const B = FOOTER_BANNER_BOX;
    ctx.save();
    if (banner) {
      const r = coverRect(banner.width, banner.height, B);
      ctx.beginPath();
      ctx.rect(B.x, B.y, B.w, B.h);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(banner.source, r.x, r.y, r.w, r.h);
    } else {
      ctx.fillStyle = "#000000";
      ctx.fillRect(B.x, B.y, B.w, B.h);
    }
    ctx.restore();
  }
}
```

- [ ] **Step 8: `registry.ts`**

```ts
import { TemplateRegistry } from "./TemplateRegistry";
import { TheAnh28BannerTemplate } from "./theanh28/TheAnh28BannerTemplate";
import { TheAnh28Template } from "./theanh28/TheAnh28Template";

/** Thứ tự = thứ tự trong ô "Phong cách video"; mục đầu là mặc định. */
export function defaultTemplateRegistry(): TemplateRegistry {
  return new TemplateRegistry([new TheAnh28Template(), new TheAnh28BannerTemplate()]);
}
```

- [ ] **Step 9: Chạy test, xác nhận xanh**

Run: `npx vitest run tests/templates`
Expected: PASS toàn bộ (gồm mọi test `TheAnh28Template.test.ts` cũ — bằng chứng hình cũ không đổi).

Run: `npx vitest run; npm run typecheck; npm run lint`
Expected: tất cả sạch. (Ô "Phong cách video" ở bước 1 giờ có 2 mục; phong cách mới chưa có trường banner — thêm ở Task 2; dựng với phong cách mới lúc này cho dải đen vì worker chưa nạp banner.)

- [ ] **Step 10: Commit** (điều phối viên) — `feat: phong cách Theanh28 + banner chân (bố cục tham số hoá)`

---

### Task 2: Banner mặc định + trường banner tuỳ chọn trong Thương hiệu (lưu, kiểm, nạp trong worker)

**Files:**
- Create: `src/domain/FooterBanner.ts`
- Modify: `src/templates/VideoTemplate.ts` (`brandFallbackId`)
- Modify: `src/templates/theanh28/TheAnh28BannerTemplate.ts` (trường `banner`, `brandFallbackId`)
- Modify: `src/client/storage/BrandRepository.ts`
- Modify: `src/client/controllers/StudioSession.ts` (`BrandData.banner?`, `sameBrand`)
- Modify: `src/client/controllers/BrandController.ts` (toàn file)
- Modify: `src/client/render/RenderJob.ts` (`RenderJob.banner?`)
- Modify: `src/client/controllers/RenderJobBuilder.ts` (gửi banner riêng khi phong cách có banner)
- Modify: `src/client/render/render.worker.ts` (nạp banner riêng/mặc định — **không test Vitest**)
- Modify: `src/views/studio/components/BrandPanel.tsx` (toàn file — **không test Vitest**, kiểm ở e2e 09 Task 3)
- Test: `tests/domain/FooterBanner.test.ts` (mới); thêm khối mới (không sửa test cũ) vào `tests/client/storage/BrandRepository.test.ts`, `tests/client/controllers/BrandController.test.ts`, `tests/client/controllers/StudioSession.test.ts`, `tests/client/controllers/RenderJobBuilder.test.ts`, `tests/templates/theanh28/TheAnh28BannerTemplate.test.ts`.

**Interfaces:**
- Consumes (Task 1): `TheAnh28BannerTemplate`, `THEANH28_BANNER_ID`, `THEANH28_BRAND_FIELDS`, `VideoTemplate.footerBanner`, `ProjectFrame.banner`.
- Produces:
  - `src/domain/FooterBanner.ts`: `FOOTER_BANNER_LIMITS = { maxBytes: 5 MiB, minWidth: 720, minRatio: 2, maxRatio: 5 }`; `checkFooterBanner(width: number, height: number): void` (ném `ValidationError`).
  - `VideoTemplate.brandFallbackId: string | null` (mặc định `null`; phong cách banner = `"theanh28"`).
  - `BrandRepository.save(templateId, values, logo, banner?: Blob | null)`; `StoredBrand.banner?: Blob`.
  - `BrandData.banner?: Blob` (StudioSession); `BrandPanelState.banner?: Blob`.
  - `BrandController.setBanner(file: File): Promise<void>`, `BrandController.clearBanner(): void`; dep tuỳ chọn `measureImage?: (blob: Blob) => Promise<{ width: number; height: number }>`.
  - `RenderJob.banner?: Blob` — chỉ có khi phong cách có `footerBanner` VÀ người dùng đã tải banner riêng.
  - Worker: `ProjectFrame.banner` = ảnh riêng; không có thì tải `template.footerBanner.defaultUrl`.

- [ ] **Step 1: Viết test đỏ**

`tests/domain/FooterBanner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ValidationError } from "@/domain/errors";
import { checkFooterBanner, FOOTER_BANNER_LIMITS } from "@/domain/FooterBanner";

describe("checkFooterBanner", () => {
  it("nhận ảnh ngang tỉ lệ 2–5, rộng ≥ 720 (banner mặc định 2048×682 hợp lệ)", () => {
    expect(() => checkFooterBanner(2048, 682)).not.toThrow();
    expect(() => checkFooterBanner(1080, 360)).not.toThrow();
    expect(() => checkFooterBanner(1440, 720)).not.toThrow(); // đúng 2
    expect(() => checkFooterBanner(2500, 500)).not.toThrow(); // đúng 5
    expect(FOOTER_BANNER_LIMITS).toEqual({ maxBytes: 5 * 1024 * 1024, minWidth: 720, minRatio: 2, maxRatio: 5 });
  });

  it("ảnh vuông/dọc hoặc quá dài bị từ chối, câu báo có tỉ lệ thật", () => {
    expect(() => checkFooterBanner(800, 800)).toThrow(
      "Banner phải là ảnh ngang, tỉ lệ rộng/cao từ 2 đến 5 (ảnh này 1,00). Khuyên dùng 3:1, ví dụ 2048×682.",
    );
    expect(() => checkFooterBanner(3000, 500)).toThrow(/ảnh này 6,00/);
    expect(() => checkFooterBanner(800, 800)).toThrow(ValidationError);
  });

  it("ảnh quá nhỏ hoặc kích thước hỏng bị từ chối", () => {
    expect(() => checkFooterBanner(600, 200)).toThrow("Banner quá nhỏ: cần rộng ít nhất 720 px (ảnh này 600 px)");
    expect(() => checkFooterBanner(0, 100)).toThrow("Không đọc được kích thước ảnh banner");
    expect(() => checkFooterBanner(Number.NaN, 100)).toThrow("Không đọc được kích thước ảnh banner");
  });
});
```

Thêm vào cuối `tests/templates/theanh28/TheAnh28BannerTemplate.test.ts`:

```ts
describe("TheAnh28BannerTemplate — thương hiệu", () => {
  it("trường thương hiệu = Theanh28 + banner (ảnh, không bắt buộc); mượn thương hiệu của theanh28", () => {
    expect(t.brandFields.map((f) => f.key)).toEqual(["channelName", "primaryColor", "logo", "titleFontPx", "banner"]);
    expect(t.brandFields.at(-1)).toEqual({ key: "banner", label: "Banner chân video", type: "image", required: false });
    expect(t.brandFallbackId).toBe("theanh28");
    expect(new TheAnh28Template().brandFallbackId).toBeNull();
    expect(new TheAnh28Template().brandFields.map((f) => f.key)).toEqual(["channelName", "primaryColor", "logo", "titleFontPx"]);
  });
});
```

Thêm vào cuối `tests/client/storage/BrandRepository.test.ts`:

```ts
describe("BrandRepository — banner chân", () => {
  it("lưu và nạp banner cạnh logo; không truyền banner thì bản lưu không có khoá banner", async () => {
    const store = new MemoryKeyValueStore();
    const repo = new BrandRepository(store);
    const banner = new Blob(["banner"], { type: "image/png" });
    await repo.save("theanh28-banner", { channelName: "A" }, null, banner);
    expect((await repo.load("theanh28-banner"))?.banner?.size).toBe(6);
    await repo.save("theanh28", { channelName: "A" }, null);
    const raw = await store.get<Record<string, unknown>>("brand:theanh28");
    expect(raw !== null && raw !== undefined && "banner" in raw).toBe(false);
    expect((await repo.load("theanh28"))?.banner).toBeUndefined();
  });

  it("banner quá 5 MB thì ném ValidationError", async () => {
    const repo = new BrandRepository(new MemoryKeyValueStore());
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]);
    await expect(repo.save("t", {}, null, big)).rejects.toThrow("Banner tối đa 5 MB");
  });
});
```

Thêm vào cuối `tests/client/controllers/BrandController.test.ts`:

```ts
describe("BrandController — banner chân", () => {
  function bannerSetup(size = { width: 2048, height: 682 }) {
    const { session } = makeSession();
    const brands = new BrandRepository(new MemoryKeyValueStore());
    const measured: Blob[] = [];
    const ctrl = new BrandController({
      session,
      templates: defaultTemplateRegistry(),
      brands,
      measureImage: async (blob) => {
        measured.push(blob);
        return size;
      },
    });
    return { session, brands, ctrl, measured };
  }
  const png = (bytes = 10, name = "banner.png") => new File([new Uint8Array(bytes)], name, { type: "image/png" });

  it("chưa lưu thương hiệu riêng: mượn tên kênh, màu, logo của theanh28; chưa có banner; trạng thái chưa lưu", async () => {
    const { ctrl, brands, session } = bannerSetup();
    const logo = new Blob(["logo"]);
    await brands.save("theanh28", { channelName: "KÊNH GỐC", primaryColor: "#112233" }, logo);
    await ctrl.load("theanh28-banner");
    expect(ctrl.state.values.channelName).toBe("KÊNH GỐC");
    expect(ctrl.state.values.primaryColor).toBe("#112233");
    expect(ctrl.state.logo).toBe(logo);
    expect(ctrl.state.banner).toBeUndefined();
    expect(ctrl.state.saved).toBe(false);
    expect(session.state.brand.values.channelName).toBe("KÊNH GỐC");
    expect(session.state.brand.logo).toBe(logo);
    expect("banner" in session.state.brand).toBe(false);
  });

  it("đã lưu riêng thì dùng bản riêng (kể cả banner), không mượn", async () => {
    const { ctrl, brands, session } = bannerSetup();
    const banner = new Blob(["b"]);
    await brands.save("theanh28", { channelName: "KÊNH GỐC" }, null);
    await brands.save("theanh28-banner", { channelName: "KÊNH RIÊNG" }, null, banner);
    await ctrl.load("theanh28-banner");
    expect(ctrl.state.values.channelName).toBe("KÊNH RIÊNG");
    expect(ctrl.state.banner).toBe(banner);
    expect(ctrl.state.saved).toBe(true);
    expect(session.state.brand.banner).toBe(banner);
  });

  it("setBanner hợp lệ: đo kích thước, vào session; lưu thì kho có banner; clearBanner về mặc định", async () => {
    const { ctrl, brands, session, measured } = bannerSetup();
    await ctrl.load("theanh28-banner");
    const file = png();
    await ctrl.setBanner(file);
    expect(measured).toEqual([file]);
    expect(ctrl.state.error).toBeNull();
    expect(ctrl.state.banner).toBe(file);
    expect(session.state.brand.banner).toBe(file);
    expect(await ctrl.save()).toBe(true);
    expect((await brands.load("theanh28-banner"))?.banner?.size).toBe(10);
    ctrl.clearBanner();
    expect(ctrl.state.banner).toBeUndefined();
    expect(session.state.brand.banner).toBeUndefined();
    expect(ctrl.state.saved).toBe(false);
  });

  it("banner sai tỉ lệ, quá lớn, sai định dạng, hoặc không đọc được thì báo lỗi và giữ banner cũ", async () => {
    const square = bannerSetup({ width: 800, height: 800 });
    await square.ctrl.load("theanh28-banner");
    await square.ctrl.setBanner(png());
    expect(square.ctrl.state.error).toBe(
      "Banner phải là ảnh ngang, tỉ lệ rộng/cao từ 2 đến 5 (ảnh này 1,00). Khuyên dùng 3:1, ví dụ 2048×682.",
    );
    expect(square.ctrl.state.banner).toBeUndefined();

    const ok = bannerSetup();
    await ok.ctrl.load("theanh28-banner");
    await ok.ctrl.setBanner(png(5 * 1024 * 1024 + 1));
    expect(ok.ctrl.state.error).toBe("Banner tối đa 5 MB");
    await ok.ctrl.setBanner(new File(["x"], "a.mp4", { type: "video/mp4" }));
    expect(ok.ctrl.state.error).toBe("Không nhận file video ở đây");
    expect(ok.measured).toHaveLength(0);

    const { session } = makeSession();
    const broken = new BrandController({
      session,
      templates: defaultTemplateRegistry(),
      brands: new BrandRepository(new MemoryKeyValueStore()),
      measureImage: async () => {
        throw new Error("decode");
      },
    });
    await broken.load("theanh28-banner");
    await broken.setBanner(png());
    expect(broken.state.error).toBe("Không đọc được ảnh banner");
    expect(broken.state.banner).toBeUndefined();
  });
});
```

Thêm vào cuối `tests/client/controllers/StudioSession.test.ts` (nếu file chưa import `makeSession` thì thêm vào dòng import từ `../../helpers/studioFixtures`):

```ts
describe("StudioSession — banner trong bộ thương hiệu", () => {
  it("cùng giá trị, cùng logo nhưng đổi banner thì báo; cùng banner thì không", () => {
    const { session } = makeSession();
    let notified = 0;
    session.subscribe(() => notified++);
    const banner = new Blob(["b"]);
    session.setBrand({ values: { a: "1" }, logo: null });
    session.setBrand({ values: { a: "1" }, logo: null, banner });
    expect(notified).toBe(2);
    expect(session.state.brand.banner).toBe(banner);
    session.setBrand({ values: { a: "1" }, logo: null, banner });
    expect(notified).toBe(2);
    session.setBrand({ values: { a: "1" }, logo: null });
    expect(notified).toBe(3);
    expect(session.state.brand.banner).toBeUndefined();
  });
});
```

Thêm vào cuối `tests/client/controllers/RenderJobBuilder.test.ts`:

```ts
describe("RenderJobBuilder — banner chân", () => {
  it("phong cách banner + banner riêng: job mang banner (cả kiểu tin và kiểu tải lên)", async () => {
    const { builder, data, uploads } = setup();
    const banner = new Blob(["banner"]);
    const project = data.project!.withMeta({ templateId: "theanh28-banner" });
    const { job } = await builder.build({ ...data, project, brand: { ...data.brand, banner } });
    expect(job.templateId).toBe("theanh28-banner");
    expect(job.banner).toBe(banner);

    const upload = makeUploadProject().withMeta({ templateId: "theanh28-banner" });
    const meta = await uploads.put(new Blob(["mp4"]), { name: "c.mp4", kind: "video" });
    const built = await builder.build({
      ...EMPTY_STUDIO,
      kind: "upload",
      project: upload,
      voice: VOICE,
      narrations: new Map([[upload.introScene.id, fakeNarration(upload.introScene)]]),
      brand: { values: {}, logo: null, banner },
      sourceClip: makeClip({ uploadId: meta.id }),
    });
    expect(built.job.banner).toBe(banner);
  });

  it("phong cách banner chưa có banner riêng, hoặc phong cách cũ: job không có khoá banner", async () => {
    const { builder, data } = setup();
    const project = data.project!.withMeta({ templateId: "theanh28-banner" });
    expect("banner" in (await builder.build({ ...data, project })).job).toBe(false);
    expect("banner" in (await builder.build({ ...data, brand: { ...data.brand, banner: new Blob(["x"]) } })).job).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run tests/domain/FooterBanner.test.ts tests/templates/theanh28 tests/client/storage/BrandRepository.test.ts tests/client/controllers/BrandController.test.ts tests/client/controllers/StudioSession.test.ts tests/client/controllers/RenderJobBuilder.test.ts`
Expected: FAIL — `Cannot find package '@/domain/FooterBanner'`; brandFields thiếu `banner`; `brandFallbackId` undefined; "Banner tối đa 5 MB" không ném; `ctrl.setBanner is not a function`; `notified` 1 thay vì 2; `job.banner` undefined. Ghi các dòng đỏ vào report.

- [ ] **Step 3: `src/domain/FooterBanner.ts` (mới)**

```ts
import { ValidationError } from "./errors";

/** Ảnh banner chân người dùng tải lên: ≤ 5 MB, rộng ≥ 720 px, ngang tỉ lệ 2–5 (dải vẽ 1080×360 = 3:1, vẽ kiểu cover). */
export const FOOTER_BANNER_LIMITS = { maxBytes: 5 * 1024 * 1024, minWidth: 720, minRatio: 2, maxRatio: 5 } as const;

const ratioText = (n: number) => n.toFixed(2).replace(".", ",");

export function checkFooterBanner(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ValidationError("Không đọc được kích thước ảnh banner");
  }
  const L = FOOTER_BANNER_LIMITS;
  const ratio = width / height;
  if (ratio < L.minRatio || ratio > L.maxRatio) {
    throw new ValidationError(
      `Banner phải là ảnh ngang, tỉ lệ rộng/cao từ ${L.minRatio} đến ${L.maxRatio} (ảnh này ${ratioText(ratio)}). Khuyên dùng 3:1, ví dụ 2048×682.`,
    );
  }
  if (width < L.minWidth) throw new ValidationError(`Banner quá nhỏ: cần rộng ít nhất ${L.minWidth} px (ảnh này ${Math.round(width)} px)`);
}
```

(Thứ tự kiểm: tỉ lệ trước, cỡ sau — `600×200` có tỉ lệ 3 nên rơi vào câu "quá nhỏ".)

- [ ] **Step 4: `VideoTemplate.ts` + `TheAnh28BannerTemplate.ts`**

`src/templates/VideoTemplate.ts`, ngay sau dòng `readonly footerBanner…` của Task 1:

```ts
  /** Chưa lưu thương hiệu riêng thì mượn thương hiệu của phong cách này (id); null = không mượn. */
  readonly brandFallbackId: string | null = null;
```

`src/templates/theanh28/TheAnh28BannerTemplate.ts` — thay dòng `import { TheAnh28Template } from "./TheAnh28Template";` bằng:

```ts
import type { BrandFieldSpec } from "@/domain/BrandKit";
import { THEANH28_BRAND_FIELDS, TheAnh28Template } from "./TheAnh28Template";
```

và trong lớp, ngay sau `readonly name…`:

```ts
  readonly brandFields: readonly BrandFieldSpec[] = [
    ...THEANH28_BRAND_FIELDS,
    { key: "banner", label: "Banner chân video", type: "image", required: false },
  ];
  readonly brandFallbackId: string | null = "theanh28";
```

- [ ] **Step 5: `BrandRepository.ts` (thay toàn file)**

```ts
import { ValidationError } from "@/domain/errors";
import { FOOTER_BANNER_LIMITS } from "@/domain/FooterBanner";
import type { KeyValueStore } from "./KeyValueStore";

export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export interface StoredBrand {
  values: Record<string, string>;
  logo: Blob | null;
  /** Banner chân riêng (phong cách có banner); không có khoá = dùng banner mặc định. */
  banner?: Blob;
  updatedAt: string;
}

export class BrandRepository {
  constructor(
    private readonly store: KeyValueStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async save(templateId: string, values: Record<string, string>, logo: Blob | null, banner: Blob | null = null): Promise<void> {
    if (!templateId) throw new ValidationError("Chưa chọn phong cách video");
    if (logo && logo.size > MAX_LOGO_BYTES) throw new ValidationError("Logo tối đa 5 MB");
    if (banner && banner.size > FOOTER_BANNER_LIMITS.maxBytes) throw new ValidationError("Banner tối đa 5 MB");
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) if (typeof value === "string") clean[key] = value;
    const stored: StoredBrand = { values: clean, logo, ...(banner ? { banner } : {}), updatedAt: this.now().toISOString() };
    await this.store.set(`brand:${templateId}`, stored);
  }

  async load(templateId: string): Promise<StoredBrand | null> {
    const value = await this.store.get<unknown>(`brand:${templateId}`);
    if (typeof value !== "object" || value === null) return null;
    const brand = value as Partial<StoredBrand>;
    if (typeof brand.values !== "object" || brand.values === null) return null;
    const values: Record<string, string> = {};
    for (const [key, v] of Object.entries(brand.values)) if (typeof v === "string") values[key] = v;
    return {
      values,
      logo: brand.logo instanceof Blob ? brand.logo : null,
      ...(brand.banner instanceof Blob ? { banner: brand.banner } : {}),
      updatedAt: typeof brand.updatedAt === "string" ? brand.updatedAt : "",
    };
  }
}
```

- [ ] **Step 6: `StudioSession.ts` — `BrandData.banner?` và `sameBrand`**

```ts
export interface BrandData {
  values: Record<string, string>;
  logo: Blob | null;
  /** Banner chân riêng; không có = phong cách dùng banner mặc định (chỉ phong cách có banner mới đọc). */
  banner?: Blob;
}
```

```ts
/** Cùng logo, cùng banner (tham chiếu) và cùng giá trị từng khoá. */
function sameBrand(a: BrandData, b: BrandData): boolean {
  if (a.logo !== b.logo || a.banner !== b.banner) return false;
  const keys = Object.keys(a.values);
  return keys.length === Object.keys(b.values).length && keys.every((k) => a.values[k] === b.values[k]);
}
```

- [ ] **Step 7: `BrandController.ts` (thay toàn file)**

```ts
import { BrandKit, type BrandFieldSpec } from "@/domain/BrandKit";
import { ValidationError } from "@/domain/errors";
import { checkFooterBanner, FOOTER_BANNER_LIMITS } from "@/domain/FooterBanner";
import { classifyUpload } from "@/client/media/UploadValidator";
import { MAX_LOGO_BYTES, type BrandRepository } from "@/client/storage/BrandRepository";
import type { TemplateRegistry } from "@/templates/TemplateRegistry";
import type { VideoTemplate } from "@/templates/VideoTemplate";
import { StateController } from "./StateController";
import type { BrandData, StudioSession } from "./StudioSession";

export interface BrandPanelState {
  templateId: string;
  specs: readonly BrandFieldSpec[];
  values: Record<string, string>;
  logo: Blob | null;
  /** Banner chân riêng; không có = banner mặc định của phong cách. */
  banner?: Blob;
  error: string | null;
  saved: boolean;
}

export interface BrandControllerDeps {
  session: StudioSession;
  templates: TemplateRegistry;
  brands: Pick<BrandRepository, "load" | "save">;
  onAuthLost?: () => void;
  /** Đo kích thước ảnh (mặc định createImageBitmap của trình duyệt); tiêm được để test. */
  measureImage?: (blob: Blob) => Promise<{ width: number; height: number }>;
}

async function measureWithBitmap(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

/** Bộ thương hiệu của một phong cách: tên kênh, màu, logo, banner chân (nếu phong cách có). */
export class BrandController extends StateController<BrandPanelState> {
  private loadToken = 0;
  private bannerToken = 0;

  constructor(private readonly deps: BrandControllerDeps) {
    super({ templateId: "", specs: [], values: {}, logo: null, error: null, saved: false }, deps.onAuthLost);
  }

  async load(templateId: string): Promise<void> {
    if (this.state.templateId === templateId && this.state.specs.length > 0 && !this.state.error) {
      // Đã nạp phong cách này: giữ nguyên chỉnh sửa chưa lưu, chỉ đảm bảo session có giá trị hiện tại.
      this.push();
      return;
    }
    const token = ++this.loadToken;
    let template: VideoTemplate;
    try {
      template = this.deps.templates.get(templateId);
    } catch (error) {
      this.set({ templateId, specs: [], values: {}, logo: null, error: this.report(error), saved: false });
      this.deps.session.setBrand({ values: {}, logo: null });
      return;
    }
    const specs = template.brandFields;
    try {
      const own = await this.deps.brands.load(templateId);
      // Chưa lưu riêng: mượn tên kênh, màu, logo của phong cách gốc (vẫn tính là chưa lưu; banner không mượn).
      const fallbackId = template.brandFallbackId;
      const stored = own ?? (fallbackId ? await this.deps.brands.load(fallbackId) : null);
      if (token !== this.loadToken) return;
      const defaults = Object.fromEntries(specs.flatMap((s) => (s.defaultValue ? [[s.key, s.defaultValue]] : [])));
      const values = { ...defaults, ...(stored?.values ?? {}) };
      const banner = own?.banner;
      this.set({ templateId, specs, values, logo: stored?.logo ?? null, ...(banner ? { banner } : {}), error: null, saved: own !== null });
      if (!this.push()) {
        // Giá trị đã lưu sai: panel giữ nguyên để sửa, session dùng mặc định của phong cách này.
        const kit = BrandKit.create(templateId, specs, {});
        this.deps.session.setBrand({ values: kit.toJSON().values, logo: null });
      }
    } catch (error) {
      if (token !== this.loadToken) return;
      this.patch({ error: this.report(error) });
    }
  }

  setValue(key: string, value: string): void {
    this.patch({ values: { ...this.state.values, [key]: value }, saved: false });
    this.push();
  }

  setLogo(file: File): void {
    try {
      if (file.size > MAX_LOGO_BYTES) throw new ValidationError("Logo tối đa 5 MB");
      classifyUpload(file, ["image"]);
    } catch (error) {
      this.patch({ error: this.report(error) });
      return;
    }
    this.patch({ logo: file, saved: false });
    this.push();
  }

  clearLogo(): void {
    this.patch({ logo: null, saved: false });
    this.push();
  }

  /** Banner chân riêng: kiểm định dạng, dung lượng, kích thước/tỉ lệ (đọc ảnh), rồi mới nhận. Lỗi thì giữ banner cũ. */
  async setBanner(file: File): Promise<void> {
    const token = ++this.bannerToken;
    try {
      if (file.size > FOOTER_BANNER_LIMITS.maxBytes) throw new ValidationError("Banner tối đa 5 MB");
      classifyUpload(file, ["image"]);
      const measure = this.deps.measureImage ?? measureWithBitmap;
      const size = await measure(file).catch((): never => {
        throw new ValidationError("Không đọc được ảnh banner");
      });
      checkFooterBanner(size.width, size.height);
    } catch (error) {
      if (token === this.bannerToken) this.patch({ error: this.report(error) });
      return;
    }
    if (token !== this.bannerToken) return;
    this.patch({ banner: file, saved: false });
    this.push();
  }

  /** "Dùng banner mặc định": bỏ banner riêng. */
  clearBanner(): void {
    this.bannerToken += 1;
    this.patch({ banner: undefined, saved: false });
    this.push();
  }

  async save(): Promise<boolean> {
    try {
      const kit = this.validate();
      await this.deps.brands.save(this.state.templateId, kit.toJSON().values, this.state.logo, this.state.banner ?? null);
      this.patch({ error: null, saved: true });
      return true;
    } catch (error) {
      this.patch({ error: this.report(error) });
      return false;
    }
  }

  private validate(): BrandKit {
    return BrandKit.create(this.state.templateId, this.state.specs, this.state.values);
  }

  /** Đưa giá trị hợp lệ vào session để dựng; giá trị sai chỉ hiện lỗi, session giữ bản hợp lệ gần nhất. */
  private push(): boolean {
    try {
      const kit = this.validate();
      const brand: BrandData = {
        values: kit.toJSON().values,
        logo: this.state.logo,
        ...(this.state.banner ? { banner: this.state.banner } : {}),
      };
      this.deps.session.setBrand(brand);
      this.patch({ error: null });
      return true;
    } catch (error) {
      this.patch({ error: this.report(error), saved: false });
      return false;
    }
  }
}
```

Ghi chú: `BrandKit.create` chỉ duyệt `specs`; trường `image` (logo, banner) không có giá trị chuỗi nên bị bỏ qua — không đổi `BrandKit`. Test cũ "phong cách không tồn tại" so `toEqual` trạng thái không có khoá `banner` — `set()` thay toàn bộ trạng thái nên khớp. `createStudio.ts` không cần sửa (`measureImage` có mặc định).

- [ ] **Step 8: `RenderJob.ts` + `RenderJobBuilder.ts`**

`src/client/render/RenderJob.ts`, trong `interface RenderJob` ngay sau `logo: Blob | null;`:

```ts
  /** Banner chân riêng (phong cách có banner); bỏ trống = worker dùng banner mặc định của phong cách. */
  banner?: Blob;
```

`src/client/controllers/RenderJobBuilder.ts`:
- Đổi `import type { StudioData } from "./StudioSession";` thành `import type { BrandData, StudioData } from "./StudioSession";`.
- Trong CẢ HAI object `job` (`build` và `buildUpload`), thêm ngay sau dòng `logo: brand.logo,`:

```ts
      ...this.bannerOf(project.templateId, brand),
```

- Thêm phương thức riêng (đặt trước `narrationInput`):

```ts
  /** Banner riêng chỉ gửi cho phong cách có banner chân; không có thì worker tự tải banner mặc định. */
  private bannerOf(templateId: string, brand: BrandData): { banner?: Blob } {
    return brand.banner && this.deps.templates.get(templateId).footerBanner ? { banner: brand.banner } : {};
  }
```

- [ ] **Step 9: `render.worker.ts` — nạp banner (không test Vitest)**

Thêm hàm ngay sau `blobOf`:

```ts
/** Ảnh banner chân: banner riêng trong job, không có thì tải ảnh mặc định của phong cách. */
async function loadBanner(job: RenderJob, defaultUrl: string): Promise<ImageBitmap> {
  let blob = job.banner ?? null;
  if (!blob) {
    const response = await fetch(new URL(defaultUrl, job.origin));
    if (!response.ok) throw new Error(`Không tải được banner mặc định (${response.status})`);
    blob = await response.blob();
  }
  try {
    return await createImageBitmap(blob);
  } catch (error) {
    throw new Error("Không đọc được ảnh banner chân video. Hãy tải lại ảnh ở phần Thương hiệu hoặc bấm “Dùng banner mặc định”.", {
      cause: error,
    });
  }
}
```

Trong `render()`:
- cạnh `let logoBitmap: ImageBitmap | null = null;` thêm `let bannerBitmap: ImageBitmap | null = null;`
- ngay sau dòng `logoBitmap = job.logo ? await createImageBitmap(job.logo) : null;` thêm:

```ts
    bannerBitmap = template.footerBanner ? await loadBanner(job, template.footerBanner.defaultUrl) : null;
```

- trong object `project` truyền cho `VideoRenderer`, ngay sau dòng `logo: logoBitmap ? … : null,` thêm:

```ts
        ...(bannerBitmap ? { banner: { source: bannerBitmap, width: bannerBitmap.width, height: bannerBitmap.height } } : {}),
```

- trong `finally`, sau `logoBitmap?.close();` thêm `bannerBitmap?.close();`

Phong cách `theanh28`: `footerBanner` null → không fetch, `project` không có khoá `banner` → khung y hệt cũ.

- [ ] **Step 10: `BrandPanel.tsx` (thay toàn file; không test Vitest)**

```tsx
"use client";

import { useEffect } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import type { BrandFieldSpec } from "@/domain/BrandKit";
import { useController } from "@/views/hooks/useController";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
const kb = (blob: Blob) => Math.round(blob.size / 1024);

export function BrandPanel({ studio, templateId }: { studio: Studio; templateId: string }) {
  const brand = useController(studio.brand);

  useEffect(() => {
    void studio.brand.load(templateId);
  }, [studio, templateId]);

  if (brand.templateId !== templateId) return null;

  const imageField = (spec: BrandFieldSpec) => {
    const banner = spec.key === "banner";
    return (
      <div key={spec.key} className="flex min-w-0 flex-col gap-1 text-sm">
        {spec.label}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            className="max-w-full"
            aria-label={spec.label}
            accept={IMAGE_ACCEPT}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (banner) void studio.brand.setBanner(file);
                else studio.brand.setLogo(file);
              }
              e.target.value = "";
            }}
          />
          {!banner && brand.logo && (
            <button type="button" className="min-h-11 sm:min-h-0 rounded-md bg-neutral-800 px-3 py-1" onClick={() => studio.brand.clearLogo()}>
              Bỏ logo ({kb(brand.logo)} KB)
            </button>
          )}
          {banner && brand.banner && (
            <button type="button" className="min-h-11 sm:min-h-0 rounded-md bg-neutral-800 px-3 py-1" onClick={() => studio.brand.clearBanner()}>
              Dùng banner mặc định
            </button>
          )}
        </div>
        {banner && (
          <p className="text-xs text-neutral-500">
            {brand.banner
              ? `Đang dùng banner của bạn (${kb(brand.banner)} KB).`
              : "Đang dùng banner mặc định (US Pickleball × US Recovery)."}{" "}
            Ảnh ngang PNG/JPG/WebP, tối đa 5 MB, tỉ lệ 2:1 đến 5:1 (khuyên 3:1, ví dụ 2048×682); phần thừa bị cắt cho vừa dải 1080×360.
          </p>
        )}
      </div>
    );
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-neutral-800 p-4">
      <legend className="px-2 text-sm text-neutral-400">Thương hiệu của phong cách này</legend>
      {brand.specs.map((spec) =>
        spec.type === "image" ? (
          imageField(spec)
        ) : (
          <label key={spec.key} className="flex flex-col gap-1 text-sm">
            {spec.label}
            <input
              type={spec.type === "color" ? "color" : spec.type === "number" ? "number" : "text"}
              maxLength={spec.maxLength}
              min={spec.min}
              max={spec.max}
              step={spec.type === "number" ? 1 : undefined}
              className="rounded-md bg-neutral-800 px-3 py-2"
              value={brand.values[spec.key] ?? ""}
              onChange={(e) => studio.brand.setValue(spec.key, e.target.value)}
            />
          </label>
        ),
      )}
      {brand.error && (
        <p role="alert" className="text-sm text-red-400">
          {brand.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="min-h-11 sm:min-h-0 rounded-md bg-neutral-700 px-3 py-1.5 text-sm"
          onClick={() => void studio.brand.save()}
        >
          Lưu thương hiệu
        </button>
        {brand.saved && <span className="text-sm text-emerald-400">Đã lưu trên máy này</span>}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 11: Chạy test, xác nhận xanh**

Run: lệnh ở Step 2 → Expected: PASS.
Run: `npx vitest run; npm run typecheck; npm run lint` → Expected: sạch.
Worker và `BrandPanel` chỉ kiểm bằng typecheck + lint ở task này; kiểm thật ở e2e 09 (Task 3).

- [ ] **Step 12: Commit** (điều phối viên) — `feat: banner chân tuỳ chọn trong thương hiệu (lưu, kiểm, nạp trong worker)`

---

### Task 3: Xem trước có banner + e2e/ảnh chụp phong cách banner ở cả hai kiểu video

**Files:**
- Modify: `src/client/preview/PreviewFrameBuilder.ts` (`PreviewInput.banner?` → `ProjectFrame.banner`)
- Modify: `src/client/preview/PreviewController.ts` (nạp banner riêng / mặc định, giữ giữa các lượt vẽ)
- Create: `src/client/media/loadImageUrl.ts` (chỉ trình duyệt — **không test Vitest**)
- Modify: `src/views/studio/components/PreviewPanel.tsx` (truyền `loadImageUrl` — **không test Vitest**)
- Modify: `scripts/lib/frameRegion.ts` (`edgeSharpness`)
- Create: `e2e/09-phong-cach-banner.spec.ts`
- Test: thêm khối mới vào `tests/client/preview/PreviewController.test.ts`, `tests/client/preview/PreviewFrameBuilder.test.ts`, `tests/scripts/frameRegion.test.ts`.

**Interfaces:**
- Consumes (Task 1–2): `ProjectFrame.banner`, `VideoTemplate.footerBanner.defaultUrl`, `BrandData.banner?`, `BrandController.setBanner/clearBanner`, nút "Dùng banner mặc định", dòng "Đang dùng banner mặc định…" / "Đang dùng banner của bạn…", nhãn input "Banner chân video", câu lỗi tỉ lệ của `checkFooterBanner`.
- Produces:
  - `PreviewInput.banner?: DrawableImage | null` (`buildPreviewFrames` đặt `project.banner` chỉ khi có ảnh).
  - `PreviewControllerDeps.loadImageUrl?: (url: string) => Promise<DecodedImage>`; lỗi nạp banner → `state.error = "Không nạp được ảnh banner, xem trước để trống dải banner"`.
  - `src/client/media/loadImageUrl.ts`: `loadImageUrl(url: string, origin: string): Promise<DecodedImage>`.
  - `scripts/lib/frameRegion.ts`: `edgeSharpness(pixels: Uint8Array, r: Region): number`.

- [ ] **Step 1: Viết test đỏ**

Thêm vào cuối `tests/scripts/frameRegion.test.ts` (sửa dòng import thành `import { edgeSharpness, meanAbsDiff, regionArgs } from "../../scripts/lib/frameRegion";`):

```ts
describe("edgeSharpness", () => {
  it("trung bình theo hàng của chênh lệch lớn nhất giữa hai điểm ảnh kề ngang (RGB24)", () => {
    // 2 hàng × 3 điểm ảnh: hàng 1 có bậc 0 → 200 ở kênh đỏ, hàng 2 phẳng
    const px = new Uint8Array([0, 0, 0, 200, 0, 0, 200, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 50]);
    expect(edgeSharpness(px, { x: 0, y: 0, w: 3, h: 2 })).toBe(100);
  });
});
```

Thêm vào cuối `tests/client/preview/PreviewFrameBuilder.test.ts` (thêm import nếu chưa có: `import { defaultTemplateRegistry } from "@/templates/registry";`, `import { VideoOptions } from "@/domain/VideoOptions";`, `import { buildPreviewFrames } from "@/client/preview/PreviewFrameBuilder";`, `import type { DrawableImage } from "@/templates/VideoTemplate";`):

```ts
describe("buildPreviewFrames — banner chân", () => {
  const banner: DrawableImage = { source: { tag: "banner" } as unknown as CanvasImageSource, width: 2048, height: 682 };
  const input = (kind: "news" | "upload", withBanner: boolean) => ({
    form: { text: "Câu một. Câu hai.", title: "Tiêu đề", sourceCredit: "A", publishDateText: "2026-10-17", templateId: "theanh28-banner", kind },
    template: defaultTemplateRegistry().get("theanh28-banner"),
    brandValues: {},
    options: VideoOptions.defaults().snapshot(),
    logo: null,
    image: null,
    ...(withBanner ? { banner } : {}),
  });

  it("có banner thì project.banner là ảnh đó ở cả hai kiểu video", () => {
    expect(buildPreviewFrames(input("news", true)).project.banner).toBe(banner);
    expect(buildPreviewFrames(input("upload", true)).project.banner).toBe(banner);
  });

  it("không có banner thì project không có khoá banner (khung cũ y hệt)", () => {
    expect("banner" in buildPreviewFrames(input("news", false)).project).toBe(false);
    expect("banner" in buildPreviewFrames(input("upload", false)).project).toBe(false);
  });
});
```

Thêm vào cuối `tests/client/preview/PreviewController.test.ts`:

```ts
describe("PreviewController — banner chân", () => {
  const DEFAULT_URL = "/templates/theanh28-banner/banner-chan-video.png";

  function bannerSetup(opts: { failDefault?: boolean } = {}) {
    const { session } = makeSession();
    const sched = manualScheduler();
    const urls: string[] = [];
    const decoded: Blob[] = [];
    const disposed: string[] = [];
    const ctrl = new PreviewController({
      session,
      templates: defaultTemplateRegistry(),
      schedule: sched.schedule,
      loadFonts: async () => {},
      decodeImage: async (blob): Promise<DecodedImage> => {
        decoded.push(blob);
        return {
          image: { source: { tag: "own", blob } as unknown as CanvasImageSource, width: 1500, height: 500 },
          dispose: () => disposed.push("own"),
        };
      },
      loadImageUrl: async (url): Promise<DecodedImage> => {
        urls.push(url);
        if (opts.failDefault) throw new Error("404");
        return {
          image: { source: { tag: "default", url } as unknown as CanvasImageSource, width: 2048, height: 682 },
          dispose: () => disposed.push("default"),
        };
      },
    });
    return { session, sched, ctrl, canvas: new RecordingCanvas(), urls, decoded, disposed };
  }
  const lastImageTag = (c: RecordingCanvas) => (c.ops("drawImage").at(-1)?.args[0] as { tag?: string } | undefined)?.tag;

  it("phong cách banner: tải banner mặc định một lần, vẽ sau cùng; vẽ lại không tải lại", async () => {
    const { ctrl, sched, canvas, urls } = bannerSetup();
    ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    ctrl.setForm(form({ templateId: "theanh28-banner" }));
    await settle(sched);
    expect(urls).toEqual([DEFAULT_URL]);
    expect(lastImageTag(canvas)).toBe("default");
    ctrl.setForm(form({ templateId: "theanh28-banner", title: "Tiêu đề khác" }));
    await settle(sched);
    expect(ctrl.state.drawCount).toBe(2);
    expect(urls).toHaveLength(1);
    expect(lastImageTag(canvas)).toBe("default");
  });

  it("banner riêng: giải mã blob đó thay banner mặc định; bỏ banner riêng thì nhả nó và quay về mặc định", async () => {
    const { ctrl, sched, canvas, urls, decoded, disposed, session } = bannerSetup();
    const own = new Blob(["b"]);
    session.setBrand({ values: {}, logo: null, banner: own });
    ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    ctrl.setForm(form({ templateId: "theanh28-banner" }));
    await settle(sched);
    expect(decoded).toEqual([own]);
    expect(urls).toEqual([]);
    expect(lastImageTag(canvas)).toBe("own");
    session.setBrand({ values: {}, logo: null });
    await settle(sched);
    expect(urls).toEqual([DEFAULT_URL]);
    expect(disposed).toEqual(["own"]);
    expect(lastImageTag(canvas)).toBe("default");
  });

  it("phong cách cũ: không tải, không vẽ banner (kể cả khi thương hiệu có banner)", async () => {
    const { ctrl, sched, canvas, urls, decoded, session } = bannerSetup();
    session.setBrand({ values: {}, logo: null, banner: new Blob(["b"]) });
    ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    ctrl.setForm(form());
    await settle(sched);
    expect(urls).toEqual([]);
    expect(decoded).toEqual([]);
    expect(canvas.ops("drawImage").some((c) => (c.args[0] as { tag?: string }).tag === "default")).toBe(false);
  });

  it("tải banner mặc định lỗi: vẫn vẽ (dải đen) và báo lỗi nhẹ", async () => {
    const { ctrl, sched, canvas } = bannerSetup({ failDefault: true });
    ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    ctrl.setForm(form({ templateId: "theanh28-banner" }));
    await settle(sched);
    expect(ctrl.state.drawCount).toBe(1);
    expect(ctrl.state.error).toBe("Không nạp được ảnh banner, xem trước để trống dải banner");
    expect(canvas.ops("fillRect").some((c) => c.args.join() === "0,1560,1080,360")).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run tests/client/preview tests/scripts/frameRegion.test.ts`
Expected: FAIL — `edgeSharpness is not a function`; `project.banner` undefined; `urls` rỗng / `lastImageTag` khác "default"; lỗi nạp không được báo.

- [ ] **Step 3: `scripts/lib/frameRegion.ts` — thêm `edgeSharpness`**

Thêm cuối file:

```ts
/**
 * Độ sắc của mép trong vùng RGB24 `r`: mỗi hàng lấy chênh lệch lớn nhất giữa hai điểm ảnh kề ngang (mọi kênh màu),
 * rồi trung bình các hàng. Mép hình sắc ≈ 170–250; nền mờ (blur 48 px) ≈ 30–45; chữ trắng viền đen > 150.
 */
export function edgeSharpness(pixels: Uint8Array, r: Region): number {
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
```

- [ ] **Step 4: `PreviewFrameBuilder.ts` — banner vào khung**

Trong `interface PreviewInput`, sau `image: DrawableImage | null;`:

```ts
  /** Ảnh banner chân đã giải mã (phong cách có banner); bỏ trống = không có khoá banner trong khung. */
  banner?: DrawableImage | null;
```

Trong `buildUploadFrames`, object `project` thêm dòng cuối (sau `mediaCredit: MEDIA_CREDIT.upload,`):

```ts
    ...(input.banner ? { banner: input.banner } : {}),
```

Trong `buildPreviewFrames`, object `project` thêm dòng cuối (sau `style: frameStyleFor(options),`):

```ts
    ...(input.banner ? { banner: input.banner } : {}),
```

- [ ] **Step 5: `PreviewController.ts` — nạp banner**

1. Thêm vào `PreviewControllerDeps` (sau `decodeImage`):

```ts
  /** Tải ảnh theo URL tương đối của trang (banner mặc định của phong cách). Bỏ trống = không vẽ banner mặc định. */
  loadImageUrl?: (url: string) => Promise<DecodedImage>;
```

2. Hằng (cạnh `FONT_ERROR`):

```ts
const BANNER_ERROR = "Không nạp được ảnh banner, xem trước để trống dải banner";
```

3. Trường lớp (cạnh `private logo…`):

```ts
  private lastBannerBlob: Blob | null = null;
  /** Banner đã giải mã, theo blob riêng hoặc URL mặc định (giữ lại giữa các lượt vẽ). */
  private banner: { key: Blob | string; decoded: DecodedImage } | null = null;
```

4. Trong `detach()`, sau `this.logo = null;`:

```ts
    this.dropBanner();
```

5. Trong `draw()`:
- Thay dòng `if (key === this.lastKey && brand.logo === this.lastLogoBlob) return;` bằng:

```ts
    const bannerBlob = brand.banner ?? null;
    if (key === this.lastKey && brand.logo === this.lastLogoBlob && bannerBlob === this.lastBannerBlob) return;
```

- Ngay sau `if (logo === undefined) return;` thêm:

```ts
    const banner = await this.bannerFor(template.footerBanner?.defaultUrl ?? null, bannerBlob, live);
    if (banner === undefined) return;
    if (banner.failed && error === null) error = BANNER_ERROR;
```

- Dòng dựng `frames` đổi thành:

```ts
    const frames = buildPreviewFrames({
      form,
      template,
      brandValues: brand.values,
      options: snapshot,
      logo,
      image: this.image ?? surface.placeholder,
      ...(banner.image ? { banner: banner.image } : {}),
    });
```

- Sau `this.lastLogoBlob = brand.logo;` thêm `this.lastBannerBlob = bannerBlob;`

6. Thêm hai phương thức riêng (sau `logoFor`):

```ts
  /**
   * Banner của phong cách (null khi phong cách không có banner): ảnh riêng trong thương hiệu, không có thì ảnh mặc định.
   * `undefined` = lượt vẽ đã bị bỏ. Lỗi nạp không giữ vào bộ đệm (lượt sau thử lại).
   */
  private async bannerFor(
    defaultUrl: string | null,
    blob: Blob | null,
    live: () => boolean,
  ): Promise<{ image: DrawableImage | null; failed: boolean } | undefined> {
    if (!defaultUrl) {
      this.dropBanner();
      return { image: null, failed: false };
    }
    const key: Blob | string = blob ?? defaultUrl;
    if (this.banner?.key === key) return { image: this.banner.decoded.image, failed: false };
    const loadUrl = this.deps.loadImageUrl;
    const loader = blob ? () => this.deps.decodeImage(blob) : loadUrl ? () => loadUrl(defaultUrl) : null;
    let decoded: DecodedImage | null = null;
    if (loader) {
      try {
        decoded = await loader();
      } catch {
        decoded = null;
      }
      if (!live()) {
        decoded?.dispose();
        return undefined;
      }
    }
    this.dropBanner();
    if (decoded) this.banner = { key, decoded };
    return { image: decoded?.image ?? null, failed: loader !== null && decoded === null };
  }

  private dropBanner(): void {
    this.banner?.decoded.dispose();
    this.banner = null;
  }
```

- [ ] **Step 6: `src/client/media/loadImageUrl.ts` (mới, chỉ trình duyệt) + `PreviewPanel.tsx`**

```ts
import type { DecodedImage } from "@/client/preview/PreviewController";

/** Tải một ảnh tĩnh của app (URL tương đối) và giải mã thành ImageBitmap; dispose() nhả bộ nhớ ảnh. */
export async function loadImageUrl(url: string, origin: string): Promise<DecodedImage> {
  const response = await fetch(new URL(url, origin));
  if (!response.ok) throw new Error(`Không tải được ảnh (${response.status})`);
  const bitmap = await createImageBitmap(await response.blob());
  return { image: { source: bitmap, width: bitmap.width, height: bitmap.height }, dispose: () => bitmap.close() };
}
```

`src/views/studio/components/PreviewPanel.tsx`: thêm import `import { loadImageUrl } from "@/client/media/loadImageUrl";` và trong deps của `new PreviewController({...})`, sau `decodeImage: …,` thêm:

```ts
        loadImageUrl: (url) => loadImageUrl(url, window.location.origin),
```

- [ ] **Step 7: Chạy test Vitest, xác nhận xanh**

Run: `npx vitest run tests/client/preview tests/scripts/frameRegion.test.ts` → PASS.
Run: `npx vitest run; npm run typecheck; npm run lint` → sạch.

- [ ] **Step 8: e2e `e2e/09-phong-cach-banner.spec.ts` (mới)**

```ts
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
let expectedBanner = new Uint8Array(0);

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
  await expect(page.getByRole("alert")).toContainText("Banner phải là ảnh ngang");
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
```

- [ ] **Step 9: Chạy e2e mới và e2e hồi quy liên quan**

Run: `npm run test:e2e -- e2e/09-phong-cach-banner.spec.ts e2e/05-xem-truoc-nhap-tin.spec.ts e2e/02-toan-luong.spec.ts`
Expected: tất cả PASS; ghi các dòng `[e2e banner …]` và `[e2e] âm: có tiếng …` (02 phải còn −16,51 dB / đỉnh 0,358 ± dung sai Global Constraints) vào report. Ảnh: `.superpowers/sample/banner-xem-truoc-the-dau.png`, `banner-xem-truoc-than-bai.png`, `banner-tin-the-dau.png`, `banner-tin-than-bai.png`, `banner-tai-len-the-dau.png`, `banner-tai-len-video.png` — mở ra xem bằng mắt (chữ không bị banner che, banner không méo) và ghi nhận xét vào report.
Nếu `vsDefault` ≥ 14 hoặc `sameAcross` ≥ 3: KHÔNG nới ngưỡng; ghi số đo, đính kèm ảnh, báo lại.

- [ ] **Step 10: Commit** (điều phối viên) — `feat: xem trước có banner chân; e2e phong cách banner`

---

### Task 4: Mô hình "Cách ghép" (VideoOptions, bản nháp tương thích ngược) + UI chọn + cảnh báo độ dài giọng

**Files:**
- Create: `src/domain/UploadComposition.ts`
- Modify: `src/domain/VideoOptions.ts` (`uploadComposition`)
- Modify: `src/client/controllers/OptionsController.ts` (`setUploadComposition`)
- Modify: `src/client/controllers/readiness.ts` (`titleOverlayWarning`)
- Modify: `src/client/controllers/renderSummary.ts` (câu tóm tắt chế độ đè)
- Create: `src/views/studio/components/CompositionPicker.tsx` (**không test Vitest**)
- Modify: `src/views/studio/steps/StepNews.tsx`, `src/views/studio/steps/StepClip.tsx`, `src/views/studio/steps/StepVoice.tsx`, `src/views/studio/components/OptionsSidebar.tsx` (**không test Vitest**; kiểm ở e2e Task 7)
- Test: `tests/domain/UploadComposition.test.ts` (mới); thêm khối mới vào `tests/domain/VideoOptions.test.ts`, `tests/client/controllers/OptionsController.test.ts`, `tests/client/controllers/readiness.test.ts`, `tests/client/controllers/renderSummary.test.ts`, `tests/client/storage/ProjectDraft.test.ts`.

**Interfaces:**
- Consumes: không phụ thuộc Task 1–3 (giao song song được với T2/T3).
- Produces:
  - `src/domain/UploadComposition.ts`: `type UploadComposition = "intro-then-clip" | "title-over-clip"`; `UPLOAD_COMPOSITIONS`; `DEFAULT_UPLOAD_COMPOSITION = "intro-then-clip"`; `UPLOAD_COMPOSITION_LABELS`; `UPLOAD_COMPOSITION_HINTS`; `isUploadComposition(v: unknown): v is UploadComposition`; `titleOverlayOverrunSec(leadInSec: number, voiceSec: number, clipSec: number): number` (> 0 = quá dài, làm tròn ms); `titleOverlayTooLongMessage(leadInSec, voiceSec, clipSec): string`.
  - `VideoOptions.uploadComposition: UploadComposition`; `VideoOptions.withUploadComposition(v: string): VideoOptions` (ném "Cách ghép không hợp lệ"); `VideoOptionsSnapshot.uploadComposition?: UploadComposition` (chỉ có khi khác mặc định).
  - `OptionsController.setUploadComposition(v: string): void`.
  - `readiness.ts`: `titleOverlayWarning(data: StudioData): string | null`.
  - Nhãn UI: radio "Thẻ tiêu đề rồi video" / "Đọc tiêu đề đè trên video" trong fieldset "Cách ghép"; `renderSummary` chế độ đè bắt đầu bằng "Đọc tiêu đề đè trên video".

- [ ] **Step 1: Viết test đỏ**

`tests/domain/UploadComposition.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_UPLOAD_COMPOSITION,
  isUploadComposition,
  titleOverlayOverrunSec,
  titleOverlayTooLongMessage,
  UPLOAD_COMPOSITION_LABELS,
  UPLOAD_COMPOSITIONS,
} from "@/domain/UploadComposition";

describe("UploadComposition", () => {
  it("hai cách ghép, mặc định giữ kiểu cũ, nhãn tiếng Việt", () => {
    expect(UPLOAD_COMPOSITIONS).toEqual(["intro-then-clip", "title-over-clip"]);
    expect(DEFAULT_UPLOAD_COMPOSITION).toBe("intro-then-clip");
    expect(UPLOAD_COMPOSITION_LABELS).toEqual({
      "intro-then-clip": "Thẻ tiêu đề rồi video",
      "title-over-clip": "Đọc tiêu đề đè trên video",
    });
    expect(isUploadComposition("title-over-clip")).toBe(true);
    expect(isUploadComposition("khac")).toBe(false);
    expect(isUploadComposition(undefined)).toBe(false);
  });

  it("độ vượt = nghỉ đầu + giọng − video (ms); vừa khít là 0", () => {
    expect(titleOverlayOverrunSec(0.3, 9, 8)).toBe(1.3);
    expect(titleOverlayOverrunSec(0.3, 7.7, 8)).toBeCloseTo(0, 9); // có thể là −0 do số thực; quy tắc dùng "> 0"
    expect(titleOverlayOverrunSec(0.3, 7.7, 8) > 0).toBe(false);
    expect(titleOverlayOverrunSec(0.3, 2, 8)).toBe(-5.7);
  });

  it("câu báo lỗi nêu số thật và cách xử lý", () => {
    expect(titleOverlayTooLongMessage(0.3, 9, 8)).toBe(
      "Giọng đọc tiêu đề (kể cả nghỉ đầu) dài 9,3 giây, video chỉ 8,0 giây. Hãy rút gọn tiêu đề, giảm nghỉ đầu, tăng tốc độ đọc hoặc chọn “Thẻ tiêu đề rồi video”.",
    );
  });
});
```

Thêm vào cuối `tests/domain/VideoOptions.test.ts`:

```ts
describe("VideoOptions — cách ghép video tải lên", () => {
  it("mặc định 'Thẻ tiêu đề rồi video'; snapshot mặc định KHÔNG có khoá mới", () => {
    const o = VideoOptions.defaults();
    expect(o.uploadComposition).toBe("intro-then-clip");
    expect("uploadComposition" in o.snapshot()).toBe(false);
  });

  it("đổi sang đè: có trong snapshot, khôi phục được; giá trị lạ bị từ chối", () => {
    const o = VideoOptions.defaults().withUploadComposition("title-over-clip");
    expect(o.uploadComposition).toBe("title-over-clip");
    expect(o.snapshot().uploadComposition).toBe("title-over-clip");
    expect(VideoOptions.restore(o.snapshot()).uploadComposition).toBe("title-over-clip");
    expect(() => o.withUploadComposition("khac")).toThrow("Cách ghép không hợp lệ");
    expect("uploadComposition" in o.withUploadComposition("intro-then-clip").snapshot()).toBe(false);
  });

  it("khoan dung khi khôi phục: thiếu hoặc sai thì về mặc định", () => {
    expect(VideoOptions.restore({}).uploadComposition).toBe("intro-then-clip");
    expect(VideoOptions.restore({ uploadComposition: 5 }).uploadComposition).toBe("intro-then-clip");
  });
});
```

Thêm vào cuối `tests/client/storage/ProjectDraft.test.ts` (thêm import `import { makeClip, makeUploadProject } from "../../helpers/studioFixtures";` nếu chưa có):

```ts
describe("bản nháp — cách ghép", () => {
  it("v3 giữ cách ghép đè qua lưu/khôi phục; bản nháp không có khoá thì về mặc định", () => {
    const project = makeUploadProject();
    const options = VideoOptions.defaults().withUploadComposition("title-over-clip");
    const body = buildDraftBody({ project, voice: null, narrations: [], footage: FootageBoard.empty(), music: null, options, sourceClip: makeClip() });
    expect(body.options?.uploadComposition).toBe("title-over-clip");
    expect(restoreDraft(body, sequentialIds("r")).options.uploadComposition).toBe("title-over-clip");
    const old = { ...body, options: { ...body.options } as Record<string, unknown> };
    delete old.options.uploadComposition;
    expect(restoreDraft(old as typeof body, sequentialIds("r")).options.uploadComposition).toBe("intro-then-clip");
  });
});
```

(Nếu file chưa import `buildDraftBody`/`restoreDraft` thì thêm từ `@/client/storage/ProjectDraft`.)

Thêm vào cuối `tests/client/controllers/OptionsController.test.ts`:

```ts
describe("OptionsController — cách ghép", () => {
  it("đổi được cả khi chưa có dự án; giá trị sai báo lỗi, không đổi", () => {
    const { session } = makeSession();
    const ctrl = new OptionsController({ session });
    ctrl.setUploadComposition("title-over-clip");
    expect(session.state.options.uploadComposition).toBe("title-over-clip");
    ctrl.setUploadComposition("khac");
    expect(ctrl.state.error).toBe("Cách ghép không hợp lệ");
    expect(session.state.options.uploadComposition).toBe("title-over-clip");
  });
});
```

(Thêm `makeSession` vào dòng import từ `../../helpers/studioFixtures`.)

Thêm vào cuối `tests/client/controllers/readiness.test.ts` (thêm `titleOverlayWarning` vào dòng import từ `@/client/controllers/readiness`):

```ts
describe("titleOverlayWarning", () => {
  const upload = (voiceSec: number, composition: "intro-then-clip" | "title-over-clip", tempo = 1) => {
    const project = makeUploadProject();
    let options = EMPTY_STUDIO.options.withUploadComposition(composition);
    if (tempo !== 1) options = options.withTempo(tempo);
    return {
      ...EMPTY_STUDIO,
      kind: "upload" as const,
      project,
      voice: VOICE,
      narrations: new Map([[project.introScene.id, fakeNarration(project.introScene, VOICE, voiceSec)]]),
      sourceClip: makeClip({ durationSec: 8 }),
      options,
    };
  };

  it("chế độ đè, giọng + nghỉ đầu dài hơn video: cảnh báo có số; vừa thì không", () => {
    expect(titleOverlayWarning(upload(9, "title-over-clip"))).toBe(
      "Giọng đọc tiêu đề (kể cả nghỉ đầu) dài 9,3 giây, video chỉ 8,0 giây. Hãy rút gọn tiêu đề, giảm nghỉ đầu, tăng tốc độ đọc hoặc chọn “Thẻ tiêu đề rồi video”.",
    );
    expect(titleOverlayWarning(upload(7, "title-over-clip"))).toBeNull();
  });

  it("ước lượng theo tốc độ tinh chỉnh: 9 s ở tempo 1,25 còn 7,2 s → vừa", () => {
    expect(titleOverlayWarning(upload(9, "title-over-clip", 1.25))).toBeNull();
  });

  it("thẻ tiêu đề rồi video, kiểu tin, chưa có giọng hoặc chưa có video: không cảnh báo", () => {
    expect(titleOverlayWarning(upload(20, "intro-then-clip"))).toBeNull();
    expect(titleOverlayWarning({ ...upload(20, "title-over-clip"), narrations: new Map() })).toBeNull();
    expect(titleOverlayWarning({ ...upload(20, "title-over-clip"), sourceClip: null })).toBeNull();
    expect(titleOverlayWarning(withProject())).toBeNull();
  });
});
```

Thêm vào cuối `tests/client/controllers/renderSummary.test.ts`:

```ts
describe("renderSummary — đọc tiêu đề đè trên video", () => {
  it("nêu cách ghép, độ dài video, giọng, tiếng gốc tự nhỏ lại khi đọc", () => {
    const project = makeUploadProject();
    const d = {
      ...EMPTY_STUDIO,
      kind: "upload" as const,
      project,
      voice: VOICE,
      narrations: new Map([["s1", fakeNarration(project.introScene, VOICE, 2.4)]]),
      sourceClip: makeClip({ durationSec: 65, volumePercent: 80 }),
      options: EMPTY_STUDIO.options.withUploadComposition("title-over-clip"),
    };
    expect(renderSummary(d)).toBe(
      "Đọc tiêu đề đè trên video 1:05 (giọng khoảng 2.4 giây; tiếng gốc 80%, tự nhỏ lại khi đọc), không phụ đề, nhạc: không dùng.",
    );
    expect(renderSummary({ ...d, sourceClip: makeClip({ hasAudio: false }) })).toContain("(giọng khoảng 2.4 giây; không có tiếng gốc)");
    expect(renderSummary({ ...d, sourceClip: makeClip({ volumePercent: 0 }) })).toContain("; tắt tiếng gốc)");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run tests/domain/UploadComposition.test.ts tests/domain/VideoOptions.test.ts tests/client/storage/ProjectDraft.test.ts tests/client/controllers/OptionsController.test.ts tests/client/controllers/readiness.test.ts tests/client/controllers/renderSummary.test.ts`
Expected: FAIL — `Cannot find package '@/domain/UploadComposition'`; `withUploadComposition is not a function`; `setUploadComposition is not a function`; `titleOverlayWarning is not a function`; câu tóm tắt vẫn là "Thẻ tiêu đề …".

- [ ] **Step 3: `src/domain/UploadComposition.ts` (mới)**

```ts
/** Cách ghép tiêu đề với video tải lên. "intro-then-clip": thẻ tiêu đề rồi video (kiểu gốc). "title-over-clip": đọc tiêu đề đè trên video. */
export type UploadComposition = "intro-then-clip" | "title-over-clip";

export const UPLOAD_COMPOSITIONS: readonly UploadComposition[] = ["intro-then-clip", "title-over-clip"];

export const DEFAULT_UPLOAD_COMPOSITION: UploadComposition = "intro-then-clip";

export const UPLOAD_COMPOSITION_LABELS: Record<UploadComposition, string> = {
  "intro-then-clip": "Thẻ tiêu đề rồi video",
  "title-over-clip": "Đọc tiêu đề đè trên video",
};

export const UPLOAD_COMPOSITION_HINTS: Record<UploadComposition, string> = {
  "intro-then-clip": "Thẻ tiêu đề có giọng đọc, sau đó chạy nguyên video. Tổng = thẻ đầu + video.",
  "title-over-clip":
    "Video chạy ngay từ đầu; giọng đọc tiêu đề phát đè lên video, khối tiêu đề hiện dưới video rồi thu gọn; tiếng gốc tự nhỏ lại khi đọc. Tổng = đúng độ dài video.",
};

export function isUploadComposition(v: unknown): v is UploadComposition {
  return v === "intro-then-clip" || v === "title-over-clip";
}

const ms = (n: number) => Math.round(n * 1000) / 1000;
const sec = (n: number) => n.toFixed(1).replace(".", ",");

/** Giây giọng tiêu đề (tính cả nghỉ đầu) vượt quá video; ≤ 0 là vừa. */
export function titleOverlayOverrunSec(leadInSec: number, voiceSec: number, clipSec: number): number {
  return ms(leadInSec + voiceSec - clipSec);
}

export function titleOverlayTooLongMessage(leadInSec: number, voiceSec: number, clipSec: number): string {
  return `Giọng đọc tiêu đề (kể cả nghỉ đầu) dài ${sec(leadInSec + voiceSec)} giây, video chỉ ${sec(clipSec)} giây. Hãy rút gọn tiêu đề, giảm nghỉ đầu, tăng tốc độ đọc hoặc chọn “Thẻ tiêu đề rồi video”.`;
}
```

- [ ] **Step 4: `VideoOptions.ts`**

1. Import: `import { DEFAULT_UPLOAD_COMPOSITION, isUploadComposition, type UploadComposition } from "./UploadComposition";`
2. `VideoOptionsSnapshot` thêm cuối:

```ts
  /** Cách ghép của kiểu Video tải lên; chỉ có khoá khi khác mặc định "intro-then-clip" (giữ nguyên hình dạng bản nháp cũ). */
  uploadComposition?: UploadComposition;
```

3. `interface Fields` thêm `uploadComposition: UploadComposition;`; `DEFAULTS` thêm `uploadComposition: DEFAULT_UPLOAD_COMPOSITION,`.
4. Trong lớp, sau `withoutVoiceTweak()`:

```ts
  get uploadComposition(): UploadComposition {
    return this.f.uploadComposition;
  }

  withUploadComposition(value: string): VideoOptions {
    if (!isUploadComposition(value)) throw new ValidationError("Cách ghép không hợp lệ");
    return this.with({ uploadComposition: value });
  }
```

5. `snapshot()`: thêm vào cuối object trả về:

```ts
      ...(this.f.uploadComposition !== DEFAULT_UPLOAD_COMPOSITION ? { uploadComposition: this.f.uploadComposition } : {}),
```

6. `restore()`: trong `new VideoOptions({...})` thêm:

```ts
      uploadComposition: isUploadComposition(raw.uploadComposition) ? raw.uploadComposition : DEFAULTS.uploadComposition,
```

- [ ] **Step 5: `OptionsController.ts`**

Sau `resetVoiceTweak()`:

```ts
  /** Cách ghép của kiểu Video tải lên (chọn ở bước 1 hoặc bước Video của bạn); không làm giọng thành cũ. */
  setUploadComposition(value: string): void {
    this.apply((o) => o.withUploadComposition(value));
  }
```

- [ ] **Step 6: `readiness.ts` — cảnh báo sớm**

Thêm import `import { titleOverlayOverrunSec, titleOverlayTooLongMessage } from "@/domain/UploadComposition";` và cuối file:

```ts
/**
 * Cảnh báo sớm ở bước Giọng (ước lượng = độ dài giọng thô ÷ tempo, chưa cắt lặng): kiểu đọc tiêu đề đè trên video
 * mà nghỉ đầu + giọng dài hơn video. Không chặn bước; bước Dựng kiểm lại bằng độ dài thật (RenderJobBuilder).
 */
export function titleOverlayWarning(data: StudioData): string | null {
  const { project, sourceClip, options } = data;
  if (!project || project.kind !== "upload" || !sourceClip || options.uploadComposition !== "title-over-clip") return null;
  const narration = data.narrations.get(project.introScene.id);
  if (!narration) return null;
  const voiceSec = narration.durationSec / options.voiceTweak.tempo;
  return titleOverlayOverrunSec(options.leadInSec, voiceSec, sourceClip.durationSec) > 0
    ? titleOverlayTooLongMessage(options.leadInSec, voiceSec, sourceClip.durationSec)
    : null;
}
```

- [ ] **Step 7: `renderSummary.ts`**

Trong nhánh `if (project.kind === "upload")`, thay dòng `return \`Thẻ tiêu đề …\`` bằng:

```ts
    if (data.options.uploadComposition === "title-over-clip") {
      const ducked = clip.hasAudio && clip.volumePercent > 0 ? `${audio}, tự nhỏ lại khi đọc` : audio;
      return `Đọc tiêu đề đè trên video ${formatClock(clip.durationSec)} (giọng khoảng ${voiceSec.toFixed(1)} giây; ${ducked}), không phụ đề, nhạc: ${music}.`;
    }
    return `Thẻ tiêu đề (giọng khoảng ${voiceSec.toFixed(1)} giây) + video ${formatClock(clip.durationSec)} (${audio}), không phụ đề, nhạc: ${music}.`;
```

- [ ] **Step 8: Chạy test, xác nhận xanh**

Run: lệnh ở Step 2 → PASS. Toàn bộ test `VideoOptions`, `ProjectDraft`, `DraftRepository` cũ phải còn xanh (snapshot mặc định không đổi).

- [ ] **Step 9: UI (không test Vitest)**

`src/views/studio/components/CompositionPicker.tsx` (mới):

```tsx
"use client";

import type { Studio } from "@/client/controllers/createStudio";
import { UPLOAD_COMPOSITION_HINTS, UPLOAD_COMPOSITION_LABELS, UPLOAD_COMPOSITIONS } from "@/domain/UploadComposition";
import { useController } from "@/views/hooks/useController";

/** Ô chọn "Cách ghép" của kiểu Video tải lên (bước 1 và bước Video của bạn). */
export function CompositionPicker({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const current = data.options.uploadComposition;
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 rounded-lg border border-neutral-800 p-3 text-sm">
      <legend className="px-1 font-medium">Cách ghép</legend>
      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-6">
        {UPLOAD_COMPOSITIONS.map((c) => (
          <label key={c} className="flex min-h-11 items-center gap-2 sm:min-h-0">
            <input type="radio" name="cach-ghep" value={c} checked={current === c} onChange={() => studio.options.setUploadComposition(c)} />
            {UPLOAD_COMPOSITION_LABELS[c]}
          </label>
        ))}
      </div>
      <p className="text-xs text-neutral-500">{UPLOAD_COMPOSITION_HINTS[current]}</p>
    </fieldset>
  );
}
```

`src/views/studio/steps/StepNews.tsx`:
- import `import { CompositionPicker } from "../components/CompositionPicker";`
- trong nhánh `if (!project)`, ngay SAU `<label>` "Tiêu đề video / Tiêu đề (để trống…)" thêm:

```tsx
          {upload && <CompositionPicker studio={studio} />}
```

- sửa `KIND_HINT.upload` thành `"Chỉ nhập tiêu đề; giọng đọc tiêu đề trên thẻ đầu rồi chạy video, hoặc đọc đè ngay trên video (chọn ở Cách ghép)."`

`src/views/studio/steps/StepClip.tsx`:
- import `import { CompositionPicker } from "../components/CompositionPicker";`
- ngay sau `<h2 className="text-lg font-semibold">Video của bạn</h2>` thêm `<CompositionPicker studio={studio} />`.

`src/views/studio/steps/StepVoice.tsx`:
- import `titleOverlayWarning` từ `@/client/controllers/readiness` (cạnh `staleSceneIds`).
- sau `const upload = project.kind === "upload";` thêm:

```tsx
  const overlay = upload && data.options.uploadComposition === "title-over-clip";
  const tooLong = titleOverlayWarning(data);
```

- thay khối `{upload && (<p …>Kiểu Video tải lên chỉ đọc câu tiêu đề trên thẻ đầu; phần video giữ tiếng gốc.</p>)}` bằng:

```tsx
      {upload && (
        <p className="text-sm text-neutral-400">
          {overlay
            ? "Giọng đọc tiêu đề phát đè lên video (sau khoảng nghỉ đầu); tiếng gốc tự nhỏ lại trong lúc đọc."
            : "Kiểu Video tải lên chỉ đọc câu tiêu đề trên thẻ đầu; phần video giữ tiếng gốc."}
        </p>
      )}
      {tooLong && (
        <p role="status" className="text-sm text-amber-400">
          {tooLong}
        </p>
      )}
```

`src/views/studio/components/OptionsSidebar.tsx`:
- sau `const upload = projectKind(data) === "upload";` thêm `const overlay = upload && options.uploadComposition === "title-over-clip";`
- nhãn nghỉ giữa: `{overlay ? "Giữ tiêu đề sau khi đọc" : upload ? "Nghỉ sau tiêu đề" : "Nghỉ giữa các câu"}: …`
- nhãn nghỉ đầu: `{overlay ? "Chờ trước khi đọc tiêu đề" : "Nghỉ đầu video"}: …`
- legend "Thumbnail đầu" → `{overlay ? "Khối tiêu đề" : "Thumbnail đầu"}`; dòng gợi ý dưới nút "Về mặc định" giữ nguyên.

- [ ] **Step 10: Kiểm tra toàn bộ**

Run: `npx vitest run; npm run typecheck; npm run lint` → sạch.
Run: `npm run test:e2e -- e2e/07-video-tai-len.spec.ts e2e/03-ban-nhap-va-phien.spec.ts` → PASS (mặc định "Thẻ tiêu đề rồi video" không đổi gì; nhãn "Video tải lên" của radio kiểu video không trùng nhãn radio cách ghép).
(Lúc này chọn "Đọc tiêu đề đè trên video" vẫn dựng như kiểu cũ — bộ dựng ở Task 5.)

- [ ] **Step 11: Commit** (điều phối viên) — `feat: tuỳ chọn cách ghép video tải lên (mô hình, bản nháp, giao diện)`

---

### Task 5: Timeline / RenderPlan / worker / template cho chế độ "Đọc tiêu đề đè trên video" + khối tiêu đề thu gọn

**Files:**
- Modify: `src/domain/Timeline.ts` (`Timeline.overlay`)
- Modify: `src/templates/VideoTemplate.ts` (`TitleOverlay`, `SceneFrame.titleOverlay?`)
- Create: `src/templates/titleOverlay.ts` (`TITLE_COLLAPSE_SEC`, `titleCollapseProgress`)
- Modify: `src/templates/theanh28/layout.ts` (`TheAnh28Layout.titleOverlay`, `LAYOUT.titleOverlay`)
- Modify: `src/templates/theanh28/bannerLayout.ts` (`BANNER_LAYOUT.titleOverlay`)
- Modify: `src/templates/theanh28/TheAnh28Template.ts` (`drawChip(x, y)`, `drawTitleOverlay`)
- Modify: `src/client/render/RenderJob.ts` (`SourceClipInput.composition?`)
- Modify: `src/client/render/RenderPlan.ts` (nhánh đè, `titleOverlayFor`)
- Modify: `src/client/render/VideoRenderer.ts` (`RenderScene.titleOverlay?` → `SceneFrame`)
- Modify: `src/client/controllers/RenderJobBuilder.ts` (đặt `composition`, chặn giọng dài hơn video)
- Modify: `src/client/render/render.worker.ts` (**không test Vitest**)
- Modify: `src/client/preview/PreviewFrameBuilder.ts` (khung xem trước kiểu đè)
- Modify: `src/views/studio/components/PreviewPanel.tsx` (nhãn tab — **không test Vitest**)
- Test: `tests/templates/titleOverlay.test.ts` (mới), `tests/templates/theanh28/titleOverlayDraw.test.ts` (mới); thêm khối mới vào `tests/domain/Timeline.test.ts`, `tests/client/render/RenderPlan.test.ts`, `tests/client/render/VideoRenderer.test.ts`, `tests/client/controllers/RenderJobBuilder.test.ts`, `tests/client/preview/PreviewFrameBuilder.test.ts`.

**Interfaces:**
- Consumes: Task 1 (`TheAnh28Layout`, `BANNER_LAYOUT`, `this.layout`), Task 3 (`PreviewInput.banner?` và các dòng `...(input.banner ? …)` đã có trong `PreviewFrameBuilder.ts`; `PreviewPanel.tsx` đã có `loadImageUrl`), Task 4 (`UploadComposition`, `titleOverlayOverrunSec`, `titleOverlayTooLongMessage`, `VideoOptions.uploadComposition`, `VideoOptionsSnapshot.uploadComposition?`).
- Produces:
  - `Timeline.overlay(sceneId: string, clipSec: number, voiceSec: number, config?: TimelineConfig): Timeline`.
  - `src/templates/VideoTemplate.ts`: `interface TitleOverlay { collapseAtSec: number }`; `SceneFrame.titleOverlay?: TitleOverlay` (giây tính từ đầu cảnh).
  - `src/templates/titleOverlay.ts`: `TITLE_COLLAPSE_SEC = 0.4`; `titleCollapseProgress(sceneTime: number, overlay: TitleOverlay): number` (0..1, smoothstep).
  - `SourceClipInput.composition?: UploadComposition` (builder chỉ đặt khi `"title-over-clip"`).
  - `RenderPlan.ts`: `titleOverlayFor(slot: SceneSlot, config: TimelineConfig): TitleOverlay`; với job đè: `planRender` trả 1 khe `SOURCE_CLIP_SCENE_ID` [0, D], `voices = [{ startSec: leadIn, samples }]`, `clipSlot` = khe đó (Task 6 dùng `clipSlot.voiceStart/voiceEnd` cho ducking).
  - `RenderScene.titleOverlay?: TitleOverlay`.
  - Xem trước: với cách ghép đè, `PreviewFrames.intro` = khung video đang đọc (role "body" + `titleOverlay`), `PreviewFrames.body` = sau khi thu gọn; nhãn tab "Đang đọc tiêu đề" / "Sau khi đọc".

- [ ] **Step 1: Viết test đỏ**

`tests/templates/titleOverlay.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TITLE_COLLAPSE_SEC, titleCollapseProgress } from "@/templates/titleOverlay";

describe("titleCollapseProgress", () => {
  it("0 trước mốc, smoothstep trong 0,4 s, đúng 1 từ mốc + 0,4 s", () => {
    const o = { collapseAtSec: 3 };
    expect(TITLE_COLLAPSE_SEC).toBe(0.4);
    expect(titleCollapseProgress(0, o)).toBe(0);
    expect(titleCollapseProgress(3, o)).toBe(0);
    expect(titleCollapseProgress(3.1, o)).toBeCloseTo(0.15625, 9);
    expect(titleCollapseProgress(3.2, o)).toBeCloseTo(0.5, 9);
    expect(titleCollapseProgress(3.4, o)).toBe(1);
    expect(titleCollapseProgress(9, o)).toBe(1);
  });
});
```

`tests/templates/theanh28/titleOverlayDraw.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BrandKit } from "@/domain/BrandKit";
import { BANNER_LAYOUT } from "@/templates/theanh28/bannerLayout";
import { LAYOUT, type TheAnh28Layout } from "@/templates/theanh28/layout";
import { TheAnh28BannerTemplate } from "@/templates/theanh28/TheAnh28BannerTemplate";
import { TheAnh28Template } from "@/templates/theanh28/TheAnh28Template";
import { SOURCE_CLIP_MEDIA, type DrawableImage, type ProjectFrame, type SceneFrame } from "@/templates/VideoTemplate";
import { RecordingCanvas, type DrawCall } from "../../helpers/RecordingCanvas";

const frame: DrawableImage = { source: { tag: "video" } as unknown as CanvasImageSource, width: 1920, height: 1080 };
const cases: Array<[TheAnh28Template, TheAnh28Layout, number]> = [
  [new TheAnh28Template(), LAYOUT, 1600], // đáy vùng an toàn TikTok
  [new TheAnh28BannerTemplate(), BANNER_LAYOUT, 1560], // đỉnh dải banner
];
const project = (t: TheAnh28Template): ProjectFrame => ({
  displayTitle: "Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã vì lạm quyền, tự ý bán trụ sở làm việc",
  sourceCredit: "Đức Phong - VietNamNet",
  publishDateText: "14/10/2026",
  brand: BrandKit.create(t.id, t.brandFields, { channelName: "28 News" }),
  logo: null,
  mediaCredit: "VIDEO: TỔNG HỢP",
});
const scene = (sceneTime: number, withOverlay = true): SceneFrame => ({
  role: "body",
  text: "",
  image: frame,
  sceneTime,
  sceneDuration: 8,
  footageTime: sceneTime,
  footageDuration: 8,
  voiceStart: 0.3,
  voiceDuration: 2.35,
  media: SOURCE_CLIP_MEDIA,
  ...(withOverlay ? { titleOverlay: { collapseAtSec: 3 } } : {}),
});
const draw = (t: TheAnh28Template, s: SceneFrame) => {
  const c = new RecordingCanvas();
  t.drawFrame(c.asCanvas(), project(t), s);
  return c;
};
const titleCalls = (c: RecordingCanvas, L: TheAnh28Layout) =>
  c.ops("fillText").filter((x) => x.state.font.startsWith(`800 ${L.titleOverlay.title.fontPx}px`));
const fontPx = (c: DrawCall) => Number(/(\d+(?:\.\d+)?)px/.exec(c.state.font)?.[1] ?? 0);

describe("Khối tiêu đề đè dưới video", () => {
  for (const [t, L, safeBottom] of cases) {
    it(`${t.id}: lúc đang đọc có chip tên kênh, ngày đăng, tiêu đề in hoa; vẫn có logo góc và dòng nguồn`, () => {
      const c = draw(t, scene(1.5));
      const titles = titleCalls(c, L);
      expect(titles.length).toBeGreaterThanOrEqual(2);
      expect(titles[0]?.args.slice(0, 3)).toEqual([titles[0]?.args[0], L.titleOverlay.title.x, L.titleOverlay.title.y]);
      expect(titles.map((x) => String(x.args[0])).join(" ")).toMatch(/^PHÚ THỌ: KHỞI TỐ NGUYÊN/);
      expect(c.texts().filter((s) => s === "28 NEWS")).toHaveLength(2); // chip + góc phải
      expect(c.texts().filter((s) => s === "NGÀY ĐĂNG: 14/10/2026")).toHaveLength(2); // thân bài (bị khối che) + khối
      expect(c.texts()).toEqual(expect.arrayContaining(["THEO: ĐỨC PHONG - VIETNAMNET", "VIDEO: TỔNG HỢP"]));
      const bottoms = c.calls.filter((x) => x.op === "fillText").map((x) => Number(x.args[2]) + fontPx(x));
      expect(Math.max(...bottoms)).toBeLessThanOrEqual(safeBottom);
      expect(titles.every((x) => x.state.globalAlpha === 1)).toBe(true);
    });

    it(`${t.id}: giữa lúc thu gọn (mốc + 0,2 s) khối trượt xuống nửa quãng và mờ 50 %`, () => {
      const c = draw(t, scene(3.2));
      const first = titleCalls(c, L)[0];
      const shift = (L.titleOverlay.bottom - L.titleOverlay.gradientTop) * 0.5;
      expect(Number(first?.args[2])).toBeCloseTo(L.titleOverlay.title.y + shift, 6);
      expect(first?.state.globalAlpha).toBeCloseTo(0.5, 6);
      expect(c.ops("rect").some((x) => x.args.join() === `0,0,1080,${L.titleOverlay.bottom}`)).toBe(true);
    });

    it(`${t.id}: thu gọn xong thì khung y hệt cảnh thân bài không có khối tiêu đề`, () => {
      const after = draw(t, scene(3.4));
      expect(titleCalls(after, L)).toHaveLength(0);
      expect(after.calls).toEqual(draw(t, scene(3.4, false)).calls);
      expect(after.texts().filter((s) => s === "NGÀY ĐĂNG: 14/10/2026")).toHaveLength(1);
    });

    it(`${t.id}: thuần theo thời gian`, () => {
      expect(draw(t, scene(3.13)).calls).toEqual(draw(t, scene(3.13)).calls);
    });
  }
});
```

Thêm vào cuối `tests/domain/Timeline.test.ts`:

```ts
describe("Timeline.overlay — đọc tiêu đề đè trên video", () => {
  const config = { leadInSec: 0.3, gapSec: 0.35, tailSec: 0.6 };

  it("một khe dài đúng video, giọng từ nghỉ đầu; tổng = độ dài video", () => {
    const t = Timeline.overlay("source-clip", 8, 2.5, config);
    expect(t.slots).toEqual([{ sceneId: "source-clip", index: 0, start: 0, voiceStart: 0.3, voiceEnd: 2.8, end: 8 }]);
    expect(t.totalDuration).toBe(8);
    expect(t.frameCount(30)).toBe(240);
    expect(t.slotAt(7.99).sceneId).toBe("source-clip");
  });

  it("vừa khít (nghỉ đầu + giọng = video) vẫn được; dài hơn thì báo lỗi tiếng Việt", () => {
    expect(Timeline.overlay("c", 8, 7.7, config).slots[0]?.voiceEnd).toBe(8);
    expect(() => Timeline.overlay("c", 8, 9, config)).toThrow(
      "Giọng đọc tiêu đề (kể cả nghỉ đầu) dài 9,3 giây, video chỉ 8,0 giây. Hãy rút gọn tiêu đề, giảm nghỉ đầu, tăng tốc độ đọc hoặc chọn “Thẻ tiêu đề rồi video”.",
    );
  });

  it("độ dài video hoặc giọng không hợp lệ", () => {
    expect(() => Timeline.overlay("c", 0, 1, config)).toThrow("Đoạn c có độ dài không hợp lệ");
    expect(() => Timeline.overlay("c", 8, Number.NaN, config)).toThrow("Cảnh c chưa có độ dài giọng");
  });
});
```

Thêm vào cuối `tests/client/render/RenderPlan.test.ts` (thêm `titleOverlayFor` vào dòng import từ `@/client/render/RenderPlan`):

```ts
describe("planRender — đọc tiêu đề đè trên video", () => {
  const samples = new Float32Array(5);
  const overlayJob = (voiceSec: number, composition?: "title-over-clip"): RenderJob => ({
    ...job([{ sceneId: "s1", durationSec: voiceSec, samples }]),
    scenes: [{ sceneId: "s1", role: "intro", text: "T", footage: { kind: "fallback" } }],
    sourceClip: {
      blob: new Blob(["v"]),
      durationSec: 8,
      hasAudio: true,
      gain: 1,
      thumbnailSec: 1,
      ...(composition ? { composition } : {}),
    },
  });

  it("một khe video dài đúng video; giọng ở nghỉ đầu; clipSlot là khe đó", () => {
    const plan = planRender(overlayJob(2, "title-over-clip"), DEFAULT_TIMELINE_CONFIG);
    expect(plan.timeline.slots.map((s) => s.sceneId)).toEqual([SOURCE_CLIP_SCENE_ID]);
    expect(plan.timeline.totalDuration).toBe(8);
    expect(plan.voices).toEqual([{ startSec: 0.3, samples }]);
    expect(plan.clipSlot).toEqual({ sceneId: SOURCE_CLIP_SCENE_ID, index: 0, start: 0, voiceStart: 0.3, voiceEnd: 2.3, end: 8 });
  });

  it("titleOverlayFor: thu gọn ở voiceEnd + gapSec, tính từ đầu khe", () => {
    const config = { leadInSec: 0.5, gapSec: 0.4, tailSec: 0.6 };
    const plan = planRender(overlayJob(2, "title-over-clip"), config);
    expect(titleOverlayFor(plan.clipSlot!, config).collapseAtSec).toBeCloseTo(2.9, 9);
  });

  it("giọng dài hơn video thì báo lỗi; không có composition thì như cũ (thẻ đầu + video)", () => {
    expect(() => planRender(overlayJob(9, "title-over-clip"), DEFAULT_TIMELINE_CONFIG)).toThrow(/video chỉ 8,0 giây/);
    const plain = planRender(overlayJob(2), DEFAULT_TIMELINE_CONFIG);
    expect(plain.timeline.slots.map((s) => s.sceneId)).toEqual(["s1", SOURCE_CLIP_SCENE_ID]);
  });
});
```

Thêm vào cuối `tests/client/render/VideoRenderer.test.ts`:

```ts
describe("VideoRenderer — khối tiêu đề đè", () => {
  it("truyền titleOverlay của cảnh vào mọi khung; cảnh không có thì undefined", async () => {
    const template = new LogTemplate();
    const frames = new CountingFrames();
    const timeline = Timeline.overlay("clip", 0.5, 0.2, { leadInSec: 0.1, gapSec: 0.1, tailSec: 0 });
    const overlay = { collapseAtSec: 0.4 };
    const scenes = new Map<string, RenderScene>([
      ["clip", { sceneId: "clip", role: "body", text: "", playback: { mode: "clip", sourceDurationSec: 0.5 }, frames, media: SOURCE_CLIP_MEDIA, titleOverlay: overlay }],
    ]);
    await new VideoRenderer({ template, ctx: new RecordingCanvas().asCanvas(), project, timeline, scenes, fps: 10, sink: new Sink() }).render();
    expect(template.frames).toHaveLength(5);
    expect(template.frames.every((f) => f.titleOverlay === overlay)).toBe(true);
    expect(template.frames[0]?.voiceStart).toBeCloseTo(0.1, 9);
    expect(template.frames[0]?.voiceDuration).toBeCloseTo(0.2, 9);
    expect(frames.asked[0]).toBe(0); // video chạy từ giây 0, không có thẻ đầu
  });
});
```

Thêm vào cuối `tests/client/controllers/RenderJobBuilder.test.ts`:

```ts
describe("RenderJobBuilder — đọc tiêu đề đè trên video", () => {
  async function overlaySetup(clipSec = 8) {
    const base = setup();
    const project = makeUploadProject();
    const meta = await base.uploads.put(new Blob(["mp4"]), { name: "c.mp4", kind: "video" });
    const data: StudioData = {
      ...EMPTY_STUDIO,
      kind: "upload",
      project,
      voice: VOICE,
      narrations: new Map([[project.introScene.id, fakeNarration(project.introScene)]]),
      brand: base.data.brand,
      sourceClip: makeClip({ uploadId: meta.id, durationSec: clipSec }),
      options: EMPTY_STUDIO.options.withUploadComposition("title-over-clip"),
    };
    return { ...base, data };
  }

  it("job mang composition 'title-over-clip'; vẫn một cảnh tiêu đề + giọng; không phụ đề", async () => {
    const { builder, data } = await overlaySetup();
    const { job } = await builder.build(data);
    expect(job.sourceClip?.composition).toBe("title-over-clip");
    expect(job.options.uploadComposition).toBe("title-over-clip");
    expect(job.scenes.map((s) => s.role)).toEqual(["intro"]);
    expect(job.narrations).toHaveLength(1);
    expect(job.options.subtitles.enabled).toBe(false);
  });

  it("cách ghép mặc định: sourceClip không có khoá composition (job như cũ)", async () => {
    const { builder, data } = await overlaySetup();
    const { job } = await builder.build({ ...data, options: EMPTY_STUDIO.options });
    expect("composition" in (job.sourceClip ?? {})).toBe(false);
  });

  it("giọng (đã cắt lặng ≈ 1,08 s) + nghỉ đầu 0,3 s dài hơn video 1 s: báo lỗi tiếng Việt ở bước Dựng", async () => {
    const { builder, data } = await overlaySetup(1);
    await expect(builder.build(data)).rejects.toThrow(/^Giọng đọc tiêu đề \(kể cả nghỉ đầu\) dài 1,4 giây, video chỉ 1,0 giây\./);
  });
});
```

Thêm vào cuối `tests/client/preview/PreviewFrameBuilder.test.ts` (import như Task 3):

```ts
describe("buildPreviewFrames — đọc tiêu đề đè trên video", () => {
  const input = (overlay: boolean) => ({
    form: { text: "", title: "Tiêu đề thử", sourceCredit: "", publishDateText: "2026-10-17", templateId: "theanh28", kind: "upload" as const },
    template: defaultTemplateRegistry().get("theanh28"),
    brandValues: {},
    options: (overlay ? VideoOptions.defaults().withUploadComposition("title-over-clip") : VideoOptions.defaults()).snapshot(),
    logo: null,
    image: null,
  });

  it("tab đầu = khung video đang đọc tiêu đề; tab sau = đã thu gọn; cả hai là cảnh thân bài", () => {
    const f = buildPreviewFrames(input(true));
    // nghỉ đầu 0,3 + giọng ước lượng max(1, 11/15) = 1 + giữ 0,35
    expect(f.intro.titleOverlay?.collapseAtSec).toBeCloseTo(1.65, 9);
    expect(f.intro.role).toBe("body");
    expect(f.body.role).toBe("body");
    expect(f.intro.sceneTime).toBeLessThan(1.65);
    expect(f.intro.sceneTime).toBeGreaterThan(0.3);
    expect(f.body.sceneTime).toBeGreaterThanOrEqual(1.65 + 0.4);
    expect(f.body.titleOverlay).toEqual(f.intro.titleOverlay);
  });

  it("cách ghép mặc định: như cũ (thẻ đầu role intro, không có titleOverlay)", () => {
    const f = buildPreviewFrames(input(false));
    expect(f.intro.role).toBe("intro");
    expect("titleOverlay" in f.intro).toBe(false);
    expect("titleOverlay" in f.body).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run tests/templates tests/domain/Timeline.test.ts tests/client/render tests/client/controllers/RenderJobBuilder.test.ts tests/client/preview/PreviewFrameBuilder.test.ts`
Expected: FAIL — `Cannot find package '@/templates/titleOverlay'`; `Timeline.overlay is not a function`; `titleOverlayFor is not a function`; `LAYOUT.titleOverlay` undefined; `job.sourceClip.composition` undefined; build không ném; `f.intro.role` là "intro".

- [ ] **Step 3: `Timeline.overlay`**

`src/domain/Timeline.ts` — thêm import `import { titleOverlayOverrunSec, titleOverlayTooLongMessage } from "./UploadComposition";` và phương thức tĩnh ngay sau `build(...)`:

```ts
  /**
   * Kiểu "đọc tiêu đề đè trên video": một khe dài đúng `clipSec` (video chạy từ giây 0, không thẻ đầu, không đuôi),
   * giọng tiêu đề từ `leadInSec`. Nghỉ đầu + giọng dài hơn video thì ném ValidationError (không cắt giọng).
   */
  static overlay(sceneId: string, clipSec: number, voiceSec: number, config: TimelineConfig = DEFAULT_TIMELINE_CONFIG): Timeline {
    if (!Number.isFinite(clipSec) || clipSec <= 0) throw new ValidationError(`Đoạn ${sceneId} có độ dài không hợp lệ`);
    if (!Number.isFinite(voiceSec) || voiceSec <= 0) throw new ValidationError(`Cảnh ${sceneId} chưa có độ dài giọng`);
    if (titleOverlayOverrunSec(config.leadInSec, voiceSec, clipSec) > 0) {
      throw new ValidationError(titleOverlayTooLongMessage(config.leadInSec, voiceSec, clipSec));
    }
    const end = ms(clipSec);
    const slot: SceneSlot = {
      sceneId,
      index: 0,
      start: 0,
      voiceStart: ms(config.leadInSec),
      voiceEnd: Math.min(end, ms(config.leadInSec + voiceSec)),
      end,
    };
    return new Timeline([slot], end);
  }
```

- [ ] **Step 4: `VideoTemplate.ts` + `titleOverlay.ts`**

`src/templates/VideoTemplate.ts` — trước `export interface SceneFrame` thêm:

```ts
/** Khối tiêu đề đè dưới video (kiểu "đọc tiêu đề đè trên video"): hiện từ đầu cảnh, thu gọn từ `collapseAtSec`. */
export interface TitleOverlay {
  /** Giây (tính từ đầu cảnh) bắt đầu thu gọn = hết giọng + "Giữ tiêu đề sau khi đọc". */
  collapseAtSec: number;
}
```

và trong `SceneFrame`, sau `media?: SceneMedia;`:

```ts
  /** Có thì phong cách vẽ khối tiêu đề đè dưới video và thu gọn theo thời gian; bỏ trống = cảnh thân bài thường. */
  titleOverlay?: TitleOverlay;
```

`src/templates/titleOverlay.ts` (mới):

```ts
import type { TitleOverlay } from "./VideoTemplate";

/** Thời gian thu gọn khối tiêu đề (giây). */
export const TITLE_COLLAPSE_SEC = 0.4;

/** Tiến độ thu gọn 0 → 1 (smoothstep), thuần theo `sceneTime`. Sai số số thực sát cuối được làm tròn thành đúng 1. */
export function titleCollapseProgress(sceneTime: number, overlay: TitleOverlay): number {
  const x = (sceneTime - overlay.collapseAtSec) / TITLE_COLLAPSE_SEC;
  if (x <= 0) return 0;
  if (x >= 1 - 1e-9) return 1;
  return x * x * (3 - 2 * x);
}
```

- [ ] **Step 5: Bố cục khối tiêu đề đè**

`src/templates/theanh28/layout.ts` — trong `interface TheAnh28Layout`, thêm trước `kenBurns`:

```ts
  /** Khối tiêu đề đè dưới video (kiểu "đọc tiêu đề đè trên video"); thu gọn = trượt xuống tới `bottom` và mờ dần. */
  titleOverlay: {
    gradientTop: number;
    solidTop: number;
    bottom: number;
    chip: { x: number; y: number };
    dateTag: { x: number; y: number };
    title: { x: number; y: number; maxWidth: number; fontPx: number; lineHeight: number; maxLines: number };
  };
```

Trong `LAYOUT`, thêm trước `kenBurns`:

```ts
  /** Đè lên phần dưới khung thân bài (dải video 380..1300); chữ cuối ≤ 1504, trong vùng an toàn 1600. */
  titleOverlay: {
    gradientTop: 1060,
    solidTop: 1140,
    bottom: 1920,
    chip: { x: 40, y: 1110 },
    dateTag: { x: 96, y: 1236 },
    title: { x: 96, y: 1300, maxWidth: 888, fontPx: 60, lineHeight: 72, maxLines: 3 },
  },
```

`src/templates/theanh28/bannerLayout.ts` — trong `BANNER_LAYOUT`, thêm (sau `subtitle`):

```ts
  /** Đè lên phần dưới khung video (300..1180), dừng ở mép banner; tiêu đề 3 dòng đáy 1398. */
  titleOverlay: {
    gradientTop: 980,
    solidTop: 1060,
    bottom: 1560,
    chip: { x: 40, y: 1030 },
    dateTag: { x: 96, y: 1146 },
    title: { x: 96, y: 1206, maxWidth: 888, fontPx: 56, lineHeight: 68, maxLines: 3 },
  },
```

- [ ] **Step 6: `TheAnh28Template.ts` — chip theo toạ độ + vẽ khối đè**

1. Import: thêm `type TitleOverlay` vào import từ `"../VideoTemplate"` và `import { titleCollapseProgress } from "../titleOverlay";`.
2. Trong `drawIntro`, đổi `this.drawChip(ctx, project);` thành `this.drawChip(ctx, project, L.chip.x, L.chip.y);`.
3. Thay toàn bộ phương thức `drawChip` bằng:

```ts
  private drawChip(ctx: Canvas2D, project: ProjectFrame, x: number, y: number): void {
    const K = this.layout.intro.chip;
    const name = this.channelName(project);
    ctx.font = this.font(project, "bold", K.fontPx);
    const textW = ctx.measureText(name).width;
    const w = K.padX + K.logoSize + K.gap + textW + K.padX;
    ctx.fillStyle = this.color(project);
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, K.h, K.h / 2);
    ctx.fill();
    ctx.stroke();
    this.drawLogoBadge(ctx, project, x + K.padX, y + (K.h - K.logoSize) / 2, K.logoSize);
    ctx.font = this.font(project, "bold", K.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(name, x + K.padX + K.logoSize + K.gap, y + K.h / 2);
  }
```

4. Cuối `drawBody`, sau dòng `this.drawDateTag(ctx, project, project.publishDateText, B.dateTag.x, B.dateTag.y);` thêm:

```ts
    if (scene.titleOverlay) this.drawTitleOverlay(ctx, project, scene.sceneTime, scene.titleOverlay);
```

5. Thêm phương thức riêng (sau `drawBody`):

```ts
  /**
   * Khối tiêu đề kiểu Theanh28 đè phần dưới video: dải chuyển màu + khối màu, chip tên kênh, tem ngày, tiêu đề in hoa.
   * Thu gọn TITLE_COLLAPSE_SEC: trượt xuống tới `bottom` (bị cắt ở đó) và mờ dần; xong thì không vẽ gì (khung = thân bài thường).
   */
  private drawTitleOverlay(ctx: Canvas2D, project: ProjectFrame, sceneTime: number, overlay: TitleOverlay): void {
    const p = titleCollapseProgress(sceneTime, overlay);
    if (p >= 1) return;
    const O = this.layout.titleOverlay;
    const { width } = this.layout.frame;
    const block = project.style?.intro.blockColor ?? this.color(project);
    const shift = (O.bottom - O.gradientTop) * p;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, O.bottom);
    ctx.clip();
    ctx.globalAlpha = 1 - p;
    const gradient = ctx.createLinearGradient(0, O.gradientTop + shift, 0, O.solidTop + shift);
    gradient.addColorStop(0, withAlpha(block, 0));
    gradient.addColorStop(1, block);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, O.gradientTop + shift, width, O.solidTop - O.gradientTop);
    ctx.fillStyle = block;
    ctx.fillRect(0, O.solidTop + shift, width, O.bottom - O.solidTop);
    this.drawChip(ctx, project, O.chip.x, O.chip.y + shift);
    this.drawDateTag(ctx, project, project.publishDateText, O.dateTag.x, O.dateTag.y + shift);
    ctx.font = this.font(project, "bold", O.title.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const lines = wrapText(upper(project.displayTitle), O.title.maxWidth, (s) => ctx.measureText(s).width, O.title.maxLines);
    lines.forEach((line, i) => ctx.fillText(line, O.title.x, O.title.y + shift + i * O.title.lineHeight));
    ctx.restore();
  }
```

(Màu khối = "Màu khối sau tiêu đề" của thanh Tuỳ chọn nếu đặt, không thì màu chủ đạo — cùng quy tắc thumbnail đầu. Hoạt ảnh chỉ phụ thuộc `sceneTime` → thuần.)

- [ ] **Step 7: Job, kế hoạch dựng, bộ dựng hình**

`src/client/render/RenderJob.ts` — import `import type { UploadComposition } from "@/domain/UploadComposition";`; trong `SourceClipInput` thêm:

```ts
  /** "title-over-clip": đọc tiêu đề đè trên video (không thẻ đầu); bỏ trống = thẻ tiêu đề rồi video. */
  composition?: UploadComposition;
```

`src/client/render/RenderPlan.ts`:
- import `import type { TitleOverlay } from "@/templates/VideoTemplate";`
- trong `planRender`, ngay sau dòng `const bySceneId = …`:

```ts
  if (job.sourceClip?.composition === "title-over-clip") {
    // Đọc tiêu đề đè trên video: một khe video dài đúng video, giọng tiêu đề đặt ở nghỉ đầu.
    const intro = job.scenes[0];
    const narration = intro ? bySceneId.get(intro.sceneId) : undefined;
    if (!intro || !narration) throw new Error("Thiếu giọng đọc tiêu đề");
    const timeline = Timeline.overlay(SOURCE_CLIP_SCENE_ID, job.sourceClip.durationSec, narration.durationSec, timelineConfig);
    const slot = timeline.slots[0] as SceneSlot;
    return { timeline, voices: [{ startSec: slot.voiceStart, samples: narration.samples }], clipSlot: slot };
  }
```

- thêm hàm cuối file:

```ts
/** Mốc thu gọn khối tiêu đề (giây tính từ đầu khe): hết giọng + "Giữ tiêu đề sau khi đọc" (gapSec). */
export function titleOverlayFor(slot: SceneSlot, config: TimelineConfig): TitleOverlay {
  return { collapseAtSec: slot.voiceEnd - slot.start + config.gapSec };
}
```

`src/client/render/VideoRenderer.ts`:
- import thêm `type TitleOverlay` từ `@/templates/VideoTemplate`;
- trong `interface RenderScene`, sau `media?: SceneMedia;`:

```ts
  /** Khối tiêu đề đè (kiểu đọc tiêu đề đè trên video); bỏ trống = cảnh thường. */
  titleOverlay?: TitleOverlay;
```

- trong lời gọi `template.drawFrame(...)`, sau `media: scene.media,` thêm `titleOverlay: scene.titleOverlay,`.

`src/client/controllers/RenderJobBuilder.ts` (`buildUpload`):
- import `import { titleOverlayOverrunSec, titleOverlayTooLongMessage } from "@/domain/UploadComposition";`
- ngay sau `const introNarration = await this.narrationInput(intro.id, narration, videoOptions);` thêm:

```ts
    const overlay = videoOptions.uploadComposition === "title-over-clip";
    if (overlay && titleOverlayOverrunSec(videoOptions.leadInSec, introNarration.durationSec, sourceClip.durationSec) > 0) {
      // Kiểm bằng độ dài thật (đã cắt lặng, đã chỉnh tempo); bước Giọng chỉ cảnh báo theo ước lượng.
      throw new ValidationError(titleOverlayTooLongMessage(videoOptions.leadInSec, introNarration.durationSec, sourceClip.durationSec));
    }
```

- trong object `clipInput`, sau `thumbnailSec: sourceClip.thumbnailSec,` thêm:

```ts
      ...(overlay ? { composition: "title-over-clip" as const } : {}),
```

- [ ] **Step 8: `render.worker.ts` (không test Vitest)**

- import: thêm `titleOverlayFor` vào import từ `"./RenderPlan"`.
- thay `const { timeline, voices, clipSlot } = planRender(job, timelineConfigFor(template.defaults.timeline, options));` bằng:

```ts
    const timelineConfig = timelineConfigFor(template.defaults.timeline, options);
    const { timeline, voices, clipSlot } = planRender(job, timelineConfig);
```

- trong khối `if (job.sourceClip) { … }`: sau `const clip = job.sourceClip;` thêm `const overlay = clip.composition === "title-over-clip";`; đổi điều kiện `if (intro && intro.role === "intro")` thành `if (!overlay && intro && intro.role === "intro")`; trong object `scenes.set(SOURCE_CLIP_SCENE_ID, {...})` thêm cuối:

```ts
        ...(overlay && clipSlot ? { titleOverlay: titleOverlayFor(clipSlot, timelineConfig) } : {}),
```

(Ở chế độ đè, vòng lặp `job.scenes` đầu hàm vẫn tạo một cảnh "intro" không có hình cho id tiêu đề; timeline không có khe đó nên nó không bao giờ được vẽ — giữ nguyên để không đụng nhánh kiểu tin.)

- [ ] **Step 9: Xem trước kiểu đè**

`src/client/preview/PreviewFrameBuilder.ts`:
- import `import { TITLE_COLLAPSE_SEC } from "@/templates/titleOverlay";`
- trong `buildUploadFrames`, ngay TRƯỚC `return { project, intro, body, usingSample };` thêm:

```ts
  if (options.uploadComposition === "title-over-clip") {
    // Không có thẻ đầu: tab đầu = khung video lúc đang đọc tiêu đề, tab sau = sau khi khối tiêu đề thu gọn.
    const collapseAtSec = leadInSec + introVoice + gapSec;
    const span = collapseAtSec + TITLE_COLLAPSE_SEC + 1;
    const overlayFrame = (sceneTime: number): SceneFrame => ({
      ...body,
      sceneTime,
      sceneDuration: span,
      footageTime: sceneTime,
      footageDuration: span,
      voiceStart: leadInSec,
      voiceDuration: introVoice,
      titleOverlay: { collapseAtSec },
    });
    return { project, intro: overlayFrame(leadInSec + introVoice / 2), body: overlayFrame(collapseAtSec + TITLE_COLLAPSE_SEC + 0.1), usingSample };
  }
```

`src/views/studio/components/PreviewPanel.tsx`:
- thêm hằng:

```ts
const OVERLAY_TABS: { id: PreviewTab; label: string }[] = [
  { id: "intro", label: "Đang đọc tiêu đề" },
  { id: "body", label: "Sau khi đọc" },
];
```

- trong component, sau `const state = useController(controller);` thêm:

```ts
  const data = useController(studio.session);
  const overlay = form.kind === "upload" && data.options.uploadComposition === "title-over-clip";
```

- đổi `const tabs = kind === "upload" ? UPLOAD_TABS : TABS;` thành `const tabs = overlay ? OVERLAY_TABS : kind === "upload" ? UPLOAD_TABS : TABS;`
- `aria-label` của canvas: `overlay ? (state.tab === "intro" ? "Xem trước lúc đọc tiêu đề" : "Xem trước sau khi đọc") : <biểu thức cũ>`.

- [ ] **Step 10: Chạy test, xác nhận xanh**

Run: lệnh ở Step 2 → PASS (mọi test template, Timeline, RenderPlan, VideoRenderer, RenderJobBuilder, PreviewFrameBuilder cũ còn xanh).
Run: `npx vitest run; npm run typecheck; npm run lint` → sạch.
Run: `npm run test:e2e -- e2e/07-video-tai-len.spec.ts e2e/02-toan-luong.spec.ts` → PASS; số đo `[e2e upload]` và `[e2e] âm` bằng lần trước (kiểu cũ không đổi).
(Âm ở chế độ đè lúc này chưa duck — Task 6.)

- [ ] **Step 11: Commit** (điều phối viên) — `feat: dựng kiểu đọc tiêu đề đè trên video (timeline, khối tiêu đề thu gọn, xem trước)`

---

### Task 6: Trộn âm — ducking tiếng gốc trong lúc đọc tiêu đề

**Files:**
- Modify: `src/client/media/AudioMix.ts` (`MIX_DEFAULTS.duck*`, `DuckWindow`, `duckGain`, `SourceBed.duck?`, vòng cộng tiếng gốc)
- Modify: `src/client/render/render.worker.ts` (truyền `duck` khi chế độ đè — **không test Vitest**)
- Test: thêm khối mới vào `tests/client/media/AudioMix.test.ts` (không sửa test cũ).

**Interfaces:**
- Consumes (Task 5): `SourceClipInput.composition`, `planRender(...).clipSlot` với `voiceStart`/`voiceEnd` tính trên toàn video.
- Produces:
  - `MIX_DEFAULTS.duckDb = 12`, `MIX_DEFAULTS.duckAttackSec = 0.2`, `MIX_DEFAULTS.duckReleaseSec = 0.25`.
  - `interface DuckWindow { startSec: number; endSec: number; depthDb?: number; attackSec?: number; releaseSec?: number }` (giây trên toàn chương trình).
  - `duckGain(tSec: number, duck: DuckWindow): number` (hệ số biên độ tuyến tính, 10^(−depth/20)..1).
  - `SourceBed.duck?: DuckWindow`.

- [ ] **Step 1: Viết test đỏ**

Thêm `duckGain` vào dòng import đầu `tests/client/media/AudioMix.test.ts` (`import { applyLimiter, dbToGain, duckGain, MIX_DEFAULTS, mixProgram, rmsDb } from "@/client/media/AudioMix";`) và thêm cuối file:

```ts
describe("duckGain — tiếng gốc nhỏ lại khi đọc tiêu đề", () => {
  const duck = { startSec: 1, endSec: 2 };
  const floor = dbToGain(-12);

  it("mặc định −12 dB, vào 0,2 s trước giọng, ra 0,25 s sau giọng", () => {
    expect([MIX_DEFAULTS.duckDb, MIX_DEFAULTS.duckAttackSec, MIX_DEFAULTS.duckReleaseSec]).toEqual([12, 0.2, 0.25]);
    expect(duckGain(0, duck)).toBe(1);
    expect(duckGain(0.8, duck)).toBe(1);
    expect(duckGain(0.9, duck)).toBeCloseTo(1 - (1 - floor) * 0.5, 9); // giữa pha vào (cosin nâng = 0,5)
    expect(duckGain(1, duck)).toBeCloseTo(floor, 9); // giọng bắt đầu: đã hạ đủ
    expect(duckGain(1.5, duck)).toBeCloseTo(floor, 9);
    expect(duckGain(2, duck)).toBeCloseTo(floor, 9);
    expect(duckGain(2.125, duck)).toBeCloseTo(1 - (1 - floor) * 0.5, 9); // giữa pha ra
    expect(duckGain(2.25, duck)).toBe(1);
    expect(duckGain(9, duck)).toBe(1);
  });

  it("đường cong mượt: giảm đều trong pha vào, tăng đều trong pha ra", () => {
    for (let t = 0.8; t < 1; t += 0.01) expect(duckGain(t + 0.01, duck)).toBeLessThanOrEqual(duckGain(t, duck) + 1e-12);
    for (let t = 2; t < 2.25; t += 0.01) expect(duckGain(t + 0.01, duck)).toBeGreaterThanOrEqual(duckGain(t, duck) - 1e-12);
  });

  it("tham số riêng: sâu 18 dB, vào/ra 0,1 s", () => {
    const d = { startSec: 1, endSec: 2, depthDb: 18, attackSec: 0.1, releaseSec: 0.1 };
    expect(duckGain(1.5, d)).toBeCloseTo(dbToGain(-18), 9);
    expect(duckGain(0.9, d)).toBe(1);
    expect(duckGain(2.1, d)).toBe(1);
  });
});

describe("mixProgram — ducking tiếng gốc", () => {
  const src = sine(4, 0.2, 47);
  const opts = { sampleRate: SR, durationSec: 4 };

  it("trong lúc đọc tiếng gốc thấp đúng 12 dB; ngoài cửa sổ vào/ra trùng từng mẫu với bản không duck", () => {
    const plain = mixProgram([], null, opts, { channels: [src], startSec: 0, gain: 1 });
    const ducked = mixProgram([], null, opts, { channels: [src], startSec: 0, gain: 1, duck: { startSec: 1.5, endSec: 2.5 } });
    const drop = rmsDb(slice(ducked.left, 1.5, 2.5), -120) - rmsDb(slice(plain.left, 1.5, 2.5), -120);
    expect(drop).toBeCloseTo(-12, 1);
    expect(Array.from(slice(ducked.left, 0, 1.3))).toEqual(Array.from(slice(plain.left, 0, 1.3)));
    expect(Array.from(slice(ducked.left, 2.75, 4))).toEqual(Array.from(slice(plain.left, 2.75, 4)));
    expect(Array.from(slice(ducked.right, 1.5, 2.5))).toEqual(Array.from(slice(ducked.left, 1.5, 2.5)));
  });

  it("mốc duck tính trên thời gian chương trình (tiếng gốc bắt đầu ở giây 1)", () => {
    const bed = { channels: [sine(3, 0.2, 47)], startSec: 1, gain: 1 };
    const plain = mixProgram([], null, opts, bed);
    const ducked = mixProgram([], null, opts, { ...bed, duck: { startSec: 2, endSec: 3 } });
    expect(rmsDb(slice(ducked.left, 2, 3), -120) - rmsDb(slice(plain.left, 2, 3), -120)).toBeCloseTo(-12, 1);
    expect(Array.from(slice(ducked.left, 0, 1.8))).toEqual(Array.from(slice(plain.left, 0, 1.8)));
  });

  it("giọng giữ −16,5 dB; nhạc nền giữ mức cố định theo tiếng gốc chưa duck", () => {
    const voice = { startSec: 1.5, samples: sine(1, 0.3, 230) };
    const music = { channels: [sine(4, 0.5, 30)], levelBelowVoiceDb: 15 };
    const o = { ...opts, fadeInSec: 0, fadeOutSec: 0 };
    const bed = { channels: [src], startSec: 0, gain: 1 };
    const duck = { startSec: 1.5, endSec: 2.5 };
    const musicOf = (withDuck: boolean) => {
      const b = withDuck ? { ...bed, duck } : bed;
      const all = mixProgram([voice], music, o, b);
      const none = mixProgram([voice], null, o, b);
      return all.left.map((v, i) => v - (none.left[i] ?? 0));
    };
    expect(rmsDb(musicOf(true), -120)).toBeCloseTo(rmsDb(musicOf(false), -120), 6);
    // Giọng không bị duck: lấy bản trộn có duck trừ phần tiếng gốc đã duck → còn đúng giọng ở −16,5 dB (cùng cổng −45 dB như chuẩn hoá).
    const full = mixProgram([voice], null, o, { ...bed, duck });
    const srcOnly = mixProgram([], null, o, { ...bed, duck });
    const voiceOnly = full.left.map((v, i) => v - (srcOnly.left[i] ?? 0));
    expect(rmsDb(slice(voiceOnly, 1.5, 2.5))).toBeCloseTo(MIX_DEFAULTS.voiceTargetDb, 1);
  });

  it("không có duck: trùng từng mẫu với lời gọi cũ (bảo vệ hồi quy — test này không đỏ)", () => {
    const a = mixProgram([], null, opts, { channels: [src], startSec: 0.5, gain: 0.8 });
    const b = mixProgram([], null, opts, { channels: [src], startSec: 0.5, gain: 0.8, duck: undefined });
    expect(Array.from(a.left)).toEqual(Array.from(b.left));
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npx vitest run tests/client/media/AudioMix.test.ts`
Expected: FAIL — `duckGain is not a function` / `MIX_DEFAULTS.duckDb` undefined; `drop` ≈ 0 thay vì −12. Test "không có duck" xanh sẵn (ghi "test không đỏ — bảo vệ hồi quy").

- [ ] **Step 3: `AudioMix.ts`**

1. `MIX_DEFAULTS` thêm (trước `} as const;`):

```ts
  /** Ducking tiếng gốc trong lúc đọc tiêu đề đè trên video: sâu (dB), vào trước giọng, ra sau giọng (giây). */
  duckDb: 12,
  duckAttackSec: 0.2,
  duckReleaseSec: 0.25,
```

2. Sau `interface SourceBed` (và thêm trường vào nó):

```ts
/** Cửa sổ hạ tiếng gốc, mốc theo giây trên toàn chương trình (không phải theo tiếng gốc). */
export interface DuckWindow {
  startSec: number;
  endSec: number;
  depthDb?: number;
  attackSec?: number;
  releaseSec?: number;
}
```

trong `interface SourceBed`, sau `gain: number;`:

```ts
  /** Hạ tiếng gốc trong cửa sổ này (giọng đọc tiêu đề đè trên video); bỏ trống = không hạ. */
  duck?: DuckWindow;
```

3. Hàm (đặt sau `rmsDb`):

```ts
const raisedCosine = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));

/**
 * Hệ số biên độ tuyến tính của tiếng gốc ở giây `tSec`: 1 ngoài cửa sổ, 10^(−depth/20) trong lúc đọc; vào trong
 * `attackSec` trước `startSec` và ra trong `releaseSec` sau `endSec` theo cosin nâng (nội suy trên biên độ).
 */
export function duckGain(tSec: number, duck: DuckWindow): number {
  const attack = duck.attackSec ?? MIX_DEFAULTS.duckAttackSec;
  const release = duck.releaseSec ?? MIX_DEFAULTS.duckReleaseSec;
  if (tSec <= duck.startSec - attack || tSec >= duck.endSec + release) return 1;
  const floor = dbToGain(-(duck.depthDb ?? MIX_DEFAULTS.duckDb));
  let amount = 1;
  if (tSec < duck.startSec) amount = attack > 0 ? raisedCosine((tSec - (duck.startSec - attack)) / attack) : 1;
  else if (tSec > duck.endSec) amount = release > 0 ? 1 - raisedCosine((tSec - duck.endSec) / release) : 0;
  return 1 - (1 - floor) * amount;
}
```

4. Trong `mixProgram`, khối cộng tiếng gốc — thay vòng `for` hiện có:

```ts
    const duck = source.duck;
    for (let j = 0; j < len; j++) {
      // Không duck thì d = 1: nhân 1 là phép tính chính xác, mẫu trùng tuyệt đối với trước.
      const d = duck ? duckGain((start + j) / sr, duck) : 1;
      const g = source.gain * Math.min(1, j / edge, (len - 1 - j) / edge) * d;
      left[start + j] = (left[start + j] ?? 0) + (srcL[j] ?? 0) * g;
      right[start + j] = (right[start + j] ?? 0) + (srcR[j] ?? 0) * g;
    }
```

(Dòng `const level = rmsDb(srcL);` sau vòng giữ nguyên — mức nhạc nền theo tiếng gốc chưa duck.)

- [ ] **Step 4: `render.worker.ts` (không test Vitest)**

Trong khối âm, thay `if (channels) source = { channels, startSec: clipSlot.start, gain: clip.gain };` bằng:

```ts
      if (channels) {
        source = {
          channels,
          startSec: clipSlot.start,
          gain: clip.gain,
          // Đọc tiêu đề đè trên video: tiếng gốc nhỏ lại đúng lúc giọng đọc (mốc trên toàn video).
          ...(clip.composition === "title-over-clip" ? { duck: { startSec: clipSlot.voiceStart, endSec: clipSlot.voiceEnd } } : {}),
        };
      }
```

- [ ] **Step 5: Chạy test, xác nhận xanh**

Run: `npx vitest run tests/client/media/AudioMix.test.ts` → PASS (mọi test `applyLimiter`/`mixProgram` cũ còn xanh, kể cả `toBeCloseTo(…, 7)`).
Run: `npx vitest run; npm run typecheck; npm run lint` → sạch.
Đo nhanh (script tạm trong scratchpad, KHÔNG thêm vào repo; xoá sau khi đo): `mixProgram` 300 s tiếng gốc stereo 48 kHz có `duck` vs không → ghi chênh thời gian vào report (kỳ vọng thêm < 0,1 s vì ngoài cửa sổ `duckGain` trả sớm).
Run: `npm run test:e2e -- e2e/02-toan-luong.spec.ts e2e/07-video-tai-len.spec.ts` → PASS, số đo như trước.

- [ ] **Step 6: Commit** (điều phối viên) — `feat: tiếng gốc tự nhỏ lại khi đọc tiêu đề đè trên video`

---

### Task 7: E2E cả hai tính năng + điện thoại + đo hiệu năng + README + đặc tả §16

**Files:**
- Create: `e2e/10-doc-tieu-de-de-video.spec.ts`
- Modify: `README.md` (mục mới sau mục "Kiểu "Video tải lên"")
- Modify: `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md` (thêm §16 cuối file)
- Không có test Vitest mới (task này chỉ e2e + tài liệu); RED không áp dụng.

**Interfaces:**
- Consumes: mọi Produces của Task 1–6 — nhãn UI: radio "Video tải lên", "Đọc tiêu đề đè trên video"; select "Phong cách video" có "Bản tin Theanh28 + banner chân"; dòng "Đang dùng banner mặc định"; câu tóm tắt "Đọc tiêu đề đè trên video m:ss (…)"; câu lỗi "… video chỉ 8,0 giây …"; bố cục `LAYOUT.titleOverlay` (tiêu đề y 1300, 60 px) và `BANNER_LAYOUT.titleOverlay` (y 1206, 56 px); ducking −12 dB; giọng giả "vi-VN-Fake-A" là sin 230 Hz.
- Produces: số đo e2e + hiệu năng ghi vào report và §16; ảnh mẫu `.superpowers/sample/doc-de-*.png`, `.superpowers/mobile/doc-de-*.png`.

- [ ] **Step 1: Hồi quy trước khi thêm spec**

Run: `npm run test:e2e`
Expected: mọi spec 01–09 PASS (08 bỏ qua khi không đặt `PERF_CLIP`). Ghi dòng `[e2e] âm: có tiếng …` của 02: phải còn **−16,51 dB / đỉnh 0,358** (± dung sai Global Constraints). Đỏ ở đây là lỗi của Task 1–6: dừng, ghi lại, báo điều phối viên.

- [ ] **Step 2: `e2e/10-doc-tieu-de-de-video.spec.ts` (mới)**

```ts
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
```

- [ ] **Step 3: Chạy e2e mới**

Run: `npm run test:e2e -- e2e/10-doc-tieu-de-de-video.spec.ts`
Expected: 5 test PASS, 1 bỏ qua (hiệu năng). Ghi các dòng `[e2e đọc đè …]` vào report. Mở ảnh `.superpowers/sample/doc-de-*-dang-doc.png` / `…-sau-khi-doc.png` và `.superpowers/mobile/doc-de-*.png`, nhận xét bằng mắt (khối tiêu đề không đè banner, thu gọn sạch, không tràn ngang).
Nếu tiếng gốc khi đọc lệch quá ±1,5 dB so với −33,07 dB hoặc khối tiêu đề không qua ngưỡng: KHÔNG nới ngưỡng — ghi số đo, đính kèm ảnh, báo lại.

- [ ] **Step 4: Đo hiệu năng**

Run (PowerShell): `$env:PERF_CLIP = "1"; npm run test:e2e -- e2e/10-doc-tieu-de-de-video.spec.ts e2e/08-hieu-nang-video-dai.spec.ts`
Expected: test hiệu năng của 10 PASS (dựng < 1,0 × tổng + 15 s); 08 vẫn PASS (60 s ≤ 76,9 s; 300 s ≤ 392 s — số chặng trước 40,7 s / 187,7 s). Ghi dòng `[perf …]` vào report. So `[perf đọc đè]` với `[perf] video 60 s` của 08 (chênh do vẽ khối tiêu đề + banner mỗi khung) và ghi phần trăm chênh.

- [ ] **Step 5: README**

Thêm vào `README.md`, ngay TRƯỚC dòng `## Tạo giọng riêng`:

```markdown
## Phong cách "Bản tin Theanh28 + banner chân"

Ở bước 1, ô **Phong cách video** có thêm **Bản tin Theanh28 + banner chân** (phong cách cũ vẫn là mặc định). Phong cách này dời toàn bộ nội dung (khung ảnh/video, tiêu đề, phụ đề, dòng nguồn, tên kênh, ngày đăng) lên trên, chừa dải đáy 1080×360 (y 1560–1920) cho ảnh banner. Banner hiện suốt video, kể cả thẻ tiêu đề, ở cả "Bản tin nhiều cảnh" và "Video tải lên".

- **Banner mặc định:** `public/templates/theanh28-banner/banner-chan-video.png` (2048×682, quảng cáo US Pickleball × US Recovery).
- **Banner riêng:** phần **Thương hiệu của phong cách này → Banner chân video**: ảnh ngang PNG/JPG/WebP, tối đa 5 MB, rộng ≥ 720 px, tỉ lệ 2:1 đến 5:1 (khuyên 3:1, ví dụ 2048×682). Ảnh được phủ kín dải (cắt phần thừa, căn giữa). Nút **Dùng banner mặc định** bỏ ảnh riêng. Bấm **Lưu thương hiệu** để giữ trên máy này.
- Lần đầu chọn phong cách này, tên kênh, màu và logo được mượn từ thương hiệu của phong cách Theanh28 (chưa tính là đã lưu).

## Cách ghép "Đọc tiêu đề đè trên video" (kiểu Video tải lên)

Ở bước 1 (hoặc bước **Video của bạn**), mục **Cách ghép** có hai lựa chọn:

1. **Thẻ tiêu đề rồi video** (mặc định, như trước): thẻ tiêu đề có giọng đọc, rồi chạy nguyên video. Tổng = thẻ đầu + video.
2. **Đọc tiêu đề đè trên video**: video chạy ngay từ giây 0; giọng đọc tiêu đề bắt đầu sau **Chờ trước khi đọc tiêu đề** (thanh "Nghỉ đầu video"); khối tiêu đề kiểu Theanh28 hiện ở phần dưới video, giữ thêm **Giữ tiêu đề sau khi đọc** rồi thu gọn mượt trong 0,4 giây; tiếng gốc tự nhỏ lại 12 dB trong lúc đọc (vào 0,2 s, ra 0,25 s) rồi trở lại mức đã chỉnh. **Tổng = đúng độ dài video.** Không phụ đề. Dùng được với cả hai phong cách.

Nếu giọng đọc tiêu đề (cộng nghỉ đầu) dài hơn video, bước Giọng hiện cảnh báo và bước Dựng dừng với câu báo: rút gọn tiêu đề, giảm nghỉ đầu, tăng tốc độ đọc, hoặc chuyển sang "Thẻ tiêu đề rồi video".

Kiểm thử: `npm run test:e2e -- e2e/09-phong-cach-banner.spec.ts e2e/10-doc-tieu-de-de-video.spec.ts` (cần ffmpeg); đo hiệu năng: `$env:PERF_CLIP="1"; npm run test:e2e -- e2e/10-doc-tieu-de-de-video.spec.ts`.
```

- [ ] **Step 6: Đặc tả §16**

Thêm cuối `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md`:

```markdown
## 16. Phong cách banner chân và cách ghép "Đọc tiêu đề đè trên video" (2026-10-21)

- **Phong cách `theanh28-banner`** ("Bản tin Theanh28 + banner chân"): lớp `TheAnh28BannerTemplate` kế thừa `TheAnh28Template`; lớp gốc nhận `TheAnh28Layout` qua hàm dựng (mặc định `LAYOUT`, hình cũ không đổi). `BANNER_LAYOUT`: ảnh mở đầu 0–900, chip 910, tem ngày 1040, tiêu đề 1100; khung thân bài 1080×880 tại y 300; phụ đề đáy 1520 (52/64 px); dòng nguồn 200, logo góc 210. Banner vẽ sau cùng, kiểu cover vào dải `FOOTER_BANNER_BOX` 0,1560,1080,360; thiếu ảnh thì tô đen.
- **Banner:** trường thương hiệu `banner` (ảnh, không bắt buộc), lưu trong `BrandRepository` cạnh logo; kiểm PNG/JPG/WebP, ≤ 5 MB, rộng ≥ 720, tỉ lệ 2–5. `RenderJob.banner?` chỉ có khi có ảnh riêng; worker tải `footerBanner.defaultUrl` khi không có. Phong cách banner chưa lưu thương hiệu riêng thì mượn của `theanh28` (`brandFallbackId`).
- **Cách ghép** (`VideoOptions.uploadComposition`, mặc định `intro-then-clip`; khoá chỉ có trong bản nháp khi khác mặc định, `DRAFT_VERSION` giữ 3): `title-over-clip` = `Timeline.overlay` (một khe [0, độ dài video], giọng [nghỉ đầu, nghỉ đầu + giọng]); `SceneFrame.titleOverlay.collapseAtSec` = hết giọng + `gapSec`; thu gọn 0,4 s smoothstep (trượt xuống tới đáy khối + mờ dần). Khối đè: Theanh28 1060–1920 (tiêu đề 60/72 px tại 1300), banner 980–1560 (56/68 px tại 1206). Giọng + nghỉ đầu dài hơn video → `ValidationError` ở bước Dựng (cảnh báo ước lượng ở bước Giọng); không cắt giọng.
- **Ducking:** `SourceBed.duck` = [voiceStart, voiceEnd] trên toàn video; `duckGain` cosin nâng trên biên độ, −12 dB, vào 0,2 s trước giọng, ra 0,25 s sau giọng. Nhạc nền giữ mức cố định theo tiếng gốc chưa duck.
- **Số đo e2e** (Chrome headless, nhà cung cấp giả, video 8 s 1280×720 + sin 440 Hz): Theanh28 — tổng …, giọng … s, tiếng gốc khi đọc … dB (mong −33,07), sau … dB (mong −21,07); banner — tổng …, banner lúc đọc↔sau … ; tin nhiều cảnh + banner — banner thẻ đầu↔thân bài …, so ảnh mặc định …, giọng … dB, đỉnh ….
- **Hiệu năng** (PERF_CLIP=1, 1080p 60 s, Nhẹ, đọc đè + banner): tổng …, dựng … (…×), … MB; so với §15 (0,66×).
```

Thay từng dấu `…` ở hai dòng số đo cuối bằng số thật lấy từ các dòng `[e2e banner …]` (Task 3, chạy lại ở Step 1), `[e2e đọc đè …]` (Step 3) và `[perf đọc đè]` (Step 4); không để lại dấu `…` nào.

- [ ] **Step 7: Kiểm tra cuối**

Run: `npx vitest run; npm run typecheck; npm run lint; npm run test:e2e; npm run build`
Expected: tất cả sạch; e2e toàn bộ PASS (08 và test hiệu năng của 10 bỏ qua khi không đặt `PERF_CLIP`); build thành công. Nếu có dev server khác đang chạy trong thư mục (build ghi `.next`), ghi lại và để điều phối viên chạy `npm run build`.

- [ ] **Step 8: Commit** (điều phối viên) — `test: e2e banner chân và đọc tiêu đề đè; đo hiệu năng; README, đặc tả §16`

---

## Rủi ro

1. **Giao diện TikTok/Reels che dải đáy.** Ứng dụng đặt chú thích, tên tài khoản, nút nhạc ở khoảng 250–400 px dưới cùng của khung 1920 — trùng dải banner 1560–1920. Banner vẫn có trong file nhưng người xem trên app có thể chỉ thấy một phần. Không xử lý được trong code; cần Hải xem bản đăng thử (xem quyết định 1).
2. **Khung thân bài nhỏ đi** (920 → 880 px cao; phụ đề 54 → 52 px) ở phong cách banner: video ngang 16:9 không đổi kích thước (bị giới hạn bởi bề ngang), video dọc/vuông bị cắt nhiều hơn một chút.
3. **Màu banner sau mã hoá H.264** lệch vài mức so với PNG gốc; ngưỡng e2e `BANNER_MATCH_MAX = 14` là ước lượng chưa đo — nếu đỏ chỉ vì ngưỡng thì báo lại, không tự nới.
4. **Giọng dài hơn video** ở chế độ đè bị chặn ở bước Dựng; cảnh báo ở bước Giọng chỉ là ước lượng (độ dài thô ÷ tempo, chưa cắt lặng) nên có thể báo thừa ~0,1 s ở trường hợp sát nút.
5. **Video kết thúc trước khi khối tiêu đề thu gọn xong** (video rất ngắn, nghỉ "Giữ tiêu đề" dài): khung cuối còn khối đang thu — chấp nhận, không lỗi.
6. **Ducking đè lên lời nói quan trọng** trong video gốc ở 0,3 s đầu + thời gian đọc tiêu đề: người dùng chỉnh bằng thanh "Chờ trước khi đọc tiêu đề" (tối đa 1 s). Không có thanh chỉnh độ sâu duck (cố định 12 dB).
7. **Banner riêng lưu trong IndexedDB** (≤ 5 MB/phong cách) cạnh logo; dữ liệu hỏng → `load` bỏ qua ảnh, dùng banner mặc định.
8. **Banner mặc định là quảng cáo cụ thể** (US Pickleball × US Recovery) nằm trong `public/` — ai dùng app cũng thấy và mặc định dựng kèm khi chọn phong cách này.
9. **Test cũ phải sửa:** đúng một chỗ, `tests/templates/registry.test.ts` (danh sách phong cách). Nếu bất kỳ test `TheAnh28Template.test.ts` cũ đỏ sau Task 1 thì đó là lỗi tham số hoá bố cục — sửa code, không sửa test.
10. **Worker không có test Vitest** (nạp banner, nhánh đè, truyền duck): chỉ được bảo vệ bởi typecheck, lint và e2e 09/10.

## Quyết định cần Hải duyệt (trước khi giao Task 1)

1. **Vị trí banner y 1560–1920 (đáy khung).** Đây là vùng TikTok/Reels hay đặt chú thích và nút. Giữ đáy như yêu cầu, hay dời banner lên (ví dụ 1400–1760) để tránh UI ứng dụng?
2. **Banner tải lên vẽ kiểu cover** (phủ kín dải, cắt phần thừa), nhận tỉ lệ 2:1–5:1, rộng ≥ 720 px. Phương án khác: co theo bề ngang giữ trọn ảnh (dải trống trên/dưới tô đen). Đồng ý cover?
3. **Mượn thương hiệu:** lần đầu chọn phong cách banner thì tự lấy tên kênh, màu, logo đã lưu của Theanh28 (chưa tính là đã lưu). Đồng ý, hay để mặc định trống như một phong cách hoàn toàn mới?
4. **Giọng dài hơn video → báo lỗi** (không cắt). Đồng ý, hay muốn tự cắt giọng/kéo dài khung cuối?
5. **Thời điểm thu gọn khối tiêu đề = hết giọng + thanh "Giữ tiêu đề sau khi đọc"** (dùng lại thanh nghỉ, mặc định 0,35 s), thu gọn 0,4 s bằng trượt xuống + mờ dần. Đồng ý kiểu hoạt ảnh này?
6. **Ducking −12 dB, vào 0,2 s, ra 0,25 s, nhạc nền không duck.** Có cần thanh chỉnh độ sâu (ví dụ 6–18 dB) không?
7. **Cỡ chữ tiêu đề của khối đè cố định** (60 px phong cách cũ, 56 px phong cách banner) — không theo trường "Cỡ chữ tiêu đề mở đầu". Đồng ý?
8. **Màu khối tiêu đề đè** = "Màu khối sau tiêu đề" của thanh Tuỳ chọn (nhãn đổi thành "Khối tiêu đề" khi chọn đè), mặc định màu chủ đạo. Đồng ý?
9. **Cách ghép là tuỳ chọn của video** (đổi được ở bước Video của bạn cả sau khi đã tạo giọng, không phải tạo lại giọng), không khoá như "Kiểu video". Đồng ý?
10. **Giữ thứ tự phong cách:** Theanh28 cũ là mặc định, phong cách banner là mục thứ hai. Hay muốn phong cách banner thành mặc định?
