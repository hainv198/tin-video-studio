# Tin Video Studio — Tuỳ chọn video (phụ đề, font, màu thumbnail đầu, Ảnh/Video) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi video có bộ tuỳ chọn riêng (phụ đề cháy cứng bật/tắt + font, font chữ tiêu đề và nhãn, màu nền và màu khối của thumbnail đầu, ưu tiên ảnh/video khi tự điền và lựa chọn Ảnh/Video từng cảnh), lưu trong bản nháp, chỉnh ở thanh bên "Tuỳ chọn video" có mặt ở mọi bước, và được bộ dựng trong worker áp dụng.

**Architecture:** Model mới `VideoOptions` (bất biến, domain) nằm trong `StudioData` cạnh dự án và được lưu vào bản nháp phiên bản 2 (bản nháp v1 vẫn mở được, thiếu tuỳ chọn thì dùng mặc định). `OptionsController` ghi vào `StudioSession` (tự lưu sẵn có). `RenderJob` mang `VideoOptionsSnapshot`; worker dựng `FrameStyle` từ `FontCatalog`, chỉ nạp font đang chọn, rồi template Theanh28 dùng `FrameStyle` để chọn font chữ, màu thumbnail đầu và vẽ phụ đề (hàm vẽ vẫn thuần theo `sceneTime`). Thuật toán chia phụ đề là hàm thuần có test.

**Tech Stack:** Như hiện tại: Next.js 16.4.1, React 19.3.1, TypeScript 5.9.3 strict (`noUncheckedIndexedAccess`), Tailwind 4, Vitest 5.0.4 (node, chỉ gom `tests/**/*.test.ts`), Playwright 1.64.1 (kênh `chrome`), mediabunny, ffmpeg cho script đo. Không thêm dependency npm. Font mới tải từ kho `google/fonts` (giấy phép SIL OFL 1.1).

**Đặc tả:** `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md` (§4.3 hợp đồng phong cách — hàm vẽ thuần theo thời gian; §4.4 bố cục Theanh28; §5 dựng phía người dùng; §12–13 số đo). Yêu cầu tính năng A–G do Hải duyệt (ghi trong phần "Ghi chú thiết kế" dưới đây).

## Global Constraints

- Thư mục dự án: `D:\Brain Hainv\ca-nhan\tools\tin-video-studio`, nhánh `feat/tuy-chon-video` (đã có, điều phối viên quản). Đường dẫn trong kế hoạch tính từ thư mục này.
- **Agent thực thi CẤM chạy mọi lệnh git.** Bỏ qua bước "Commit"; điều phối viên commit. Không đọc/sửa `.env.local`; không tạo `.env*`. Không chạy dev server (`npm run dev`); e2e tự chạy app ở cổng **3101** với `FAKE_PROVIDERS=1`.
- **RED phải đỏ thật** cho test Vitest: chạy test mới trước khi viết code và ghi dòng thất bại vào report. Test nào không đỏ thì KHÔNG sửa giá trị mong đợi, ghi "test không đỏ" + lý do. Test Playwright không có RED; chạy và ghi kết quả; không nới timeout quá giá trị kế hoạch ghi.
- Lớp: View chỉ hiển thị + gọi controller (không quy tắc nghiệp vụ, không fetch); Controller giữ trạng thái và điều phối; Model (`src/domain`) thuần TS, không React/DOM/fetch; mọi lắp ráp ở `createStudio.ts` / `container.ts`.
- **Hàm vẽ của template phải thuần theo thời gian:** cùng `ProjectFrame` + `SceneFrame` (kể cả `sceneTime`) ra cùng hình. Cache được phép nếu kết quả chỉ phụ thuộc đầu vào.
- Dựng hình chạy trong `render.worker.ts` (OffscreenCanvas); mọi dữ liệu vào worker qua `RenderJob` (dữ liệu thuần, structuredClone được).
- **Tương thích ngược:** bản nháp cũ (v1, không có `options`) phải mở được; dự án không đổi tuỳ chọn thì chữ tiêu đề/nhãn vẫn là Barlow Condensed 600/800 (chuỗi font giống hệt hiện tại), màu thumbnail đầu vẫn theo `primaryColor`. Phụ đề là tính năng mới nên mặc định **bật**, font **Phudu**.
- Hiệu năng: mốc hiện tại ≈ 0,45–0,5× thời lượng (tin 37 s dựng ≈ 15,5–18 s). Có phụ đề không được chậm hơn quá 30 % so với tắt phụ đề trên cùng dự án.
- Ngôn ngữ giao diện, thông báo lỗi, tài liệu: tiếng Việt có dấu. Tên lớp, hàm, biến: tiếng Anh. Giữ kiểu xuống dòng của file đang sửa.
- Sau mỗi task: `npx vitest run`, `npm run typecheck`, `npm run lint` sạch (0 cảnh báo). Task 5, 6, 7 chạy thêm `npm run test:e2e`; Task 7 chạy thêm `npm run build`.
- Mọi commit kết thúc bằng dòng `Co-Authored-By` do phiên chạy quy định (điều phối viên tự thêm).

## Cấu trúc file

```
src/domain/fontIds.ts                        # mới (T1): 6 id font + nhãn, mặc định phụ đề/chữ
src/domain/VideoOptions.ts                   # mới (T1): model tuỳ chọn video, snapshot/restore khoan dung
src/client/storage/ProjectDraft.ts           # sửa (T1): DRAFT_VERSION 2, options trong bản nháp
src/client/storage/DraftRepository.ts        # sửa (T1): đọc được v1 và v2
src/client/controllers/StudioSession.ts      # sửa (T1): StudioData.options, prune/restore/reset/save
src/client/controllers/OptionsController.ts  # mới (T1)
src/client/controllers/createStudio.ts       # sửa (T1): lắp OptionsController
public/fonts/<họ>/*.ttf + OFL.txt            # mới (T2): Phudu, Be Vietnam Pro, Oswald, Montserrat, Roboto Condensed
scripts/lib/ttfCmap.ts                       # mới (T2): đọc bảng cmap (Node thuần) để kiểm glyph tiếng Việt
src/templates/fonts/FontCatalog.ts           # mới (T2): danh mục font, frameStyleFor, fontFacesFor
src/templates/VideoTemplate.ts               # sửa (T2: FontStyle/FrameStyle/cssFont/ProjectFrame.style; T4: SceneFrame.voiceStart/voiceDuration)
src/templates/theanh28/TheAnh28Template.ts   # sửa (T2 font; T3 màu thumbnail; T4 phụ đề)
src/client/render/RenderJob.ts               # sửa (T2): options
src/client/controllers/RenderJobBuilder.ts   # sửa (T2): đưa options vào job
src/client/render/render.worker.ts           # sửa (T2): nạp font theo tuỳ chọn, truyền style
src/templates/Canvas2D.ts                    # sửa (T4): strokeText, lineJoin, shadow*
src/templates/theanh28/layout.ts             # sửa (T4): LAYOUT.subtitle
src/templates/theanh28/subtitles.ts          # mới (T4): chia đoạn + thời gian (thuần)
src/client/render/VideoRenderer.ts           # sửa (T4): truyền voiceStart/voiceDuration
src/views/studio/components/OptionsSidebar.tsx  # mới (T5)
src/views/studio/StudioShell.tsx             # sửa (T5): bố cục 2 cột / ngăn kéo
src/app/studio/page.tsx                      # sửa (T5): max-w-6xl
src/client/controllers/FootageSearchController.ts  # sửa (T6): loại cảnh trám
src/views/studio/steps/StepFootage.tsx       # sửa (T6): nút Ảnh | Video
scripts/lib/frameRegion.ts                   # mới (T7): cắt vùng khung bằng ffmpeg + so sai khác
e2e/helpers.ts                               # sửa (T5): đọc tuỳ chọn trong bản nháp
e2e/02-toan-luong.spec.ts                    # sửa (T5): chọn combobox "Giọng" theo tên
e2e/04-tuy-chon-video.spec.ts                # mới (T5), thêm test (T6, T7)
tests/...                                    # test tương ứng từng task
README.md, docs/superpowers/specs/...        # sửa (T7)
```

## Ghi chú thiết kế cần biết trước

- **Tuỳ chọn thuộc từng video**, không thuộc bộ thương hiệu: nằm trong `StudioData.options`, vào bản nháp (IndexedDB), về mặc định khi bấm "Dự án mới". Đổi tuỳ chọn trước khi chia cảnh vẫn giữ trong bộ nhớ (chưa lưu vì chưa có dự án); chia cảnh xong thì tự lưu như mọi thay đổi khác.
- **Bản nháp v2:** `DRAFT_VERSION = 2`, `DraftRepository.load` nhận v1 và v2. `VideoOptions.restore` khoan dung: thiếu/sai trường nào dùng mặc định trường đó, không ném (bản nháp hỏng phần tuỳ chọn không được làm mất cả dự án).
- **Font:** `FontCatalog` gán mỗi id một họ CSS riêng có tiền tố `TVS ` (tránh trùng font hệ thống) và hai mức đậm: `semiBold` (dòng nguồn, tem ngày) và `bold` (tiêu đề, tên kênh, phụ đề). Oswald chỉ tới 700 nên `bold` của Oswald = 700. Font biến thiên (Phudu, Oswald, Montserrat, Roboto Condensed) đăng ký một `FontFace` với dải weight (`"300 900"`…); Barlow giữ nguyên hai file tĩnh ở `public/templates/theanh28/fonts/`. Worker chỉ nạp font chữ + font phụ đề (nếu bật), bỏ trùng theo URL.
- **Phụ đề:** chữ thường như câu gốc (không in hoa), trắng, viền đen 10 px + bóng nhẹ, căn giữa x = 540, rộng tối đa 820 px (x 130–950, tránh cột nút TikTok bên phải), cỡ 54 px, cao dòng 68, tối đa 2 dòng/đoạn. Cảnh thân bài: đáy đoạn ở y = 1600 (vùng an toàn dưới của TikTok; dải ảnh kết thúc ở 1300, tem ngày ở 1236–1280). Cảnh mở đầu: đáy ở y = 990, tức ngay **trên** chip tên kênh (chip ở 1010), đè lên phần dưới ảnh — vì đặt dưới tiêu đề sẽ tràn vùng an toàn khi tiêu đề 3 dòng cỡ 80 (1215 + 3×98 = 1509, cộng 2 dòng phụ đề > 1640). Thời gian: đoạn i hiện từ `voiceStart + voiceDuration × (ký tự trước i / tổng ký tự)`; trước giọng hiện đoạn đầu, sau giọng giữ đoạn cuối (luôn có phụ đề suốt cảnh). Ngắt dòng dùng `wrapText` (đo chữ thật bằng `ctx.measureText`).
- **Thumbnail đầu:** `backgroundColor` thay `fillStyle` của nền toàn khung cảnh mở đầu; `blockColor` thay dải chuyển màu + khối đặc sau tiêu đề. Chip tên kênh và huy hiệu logo vẫn dùng `primaryColor`. Không đặt = theo `primaryColor` như cũ. Nút "Về mặc định" xoá cả hai.
- **Ảnh/Video:** `footageKind` ("any" | "image" | "video") là ưu tiên khi **tự điền**: loại ưu tiên không có kết quả thì lùi về loại còn lại (chỉ khi cảnh không có lựa chọn riêng). Nút "Ảnh | Video" ở thẻ cảnh là lựa chọn riêng của cảnh (`sceneFootageKinds` trong `VideoOptions`, nhớ trong bản nháp): tìm lại chỉ loại đó, không tự đổi cảnh trám đang gán; bấm lại nút đang bật thì bỏ lựa chọn (về "cả hai"). API `/api/stock/search` và `StockClient.search(query, kind)` đã có tham số `kind`; Pexels/Pixabay đã gọi endpoint ảnh và video riêng; `FakeStockProvider` trả rỗng cho video.
- **e2e với FAKE providers:** không có video giả, nên e2e chỉ kiểm được: chọn "Video" → thẻ báo không có kết quả; "Ưu tiên video" khi tự điền → vẫn lùi về ảnh đủ 6 cảnh.

---

### Task 1: Mô hình VideoOptions + bản nháp v2 + OptionsController

**Files:**
- Create: `src/domain/fontIds.ts`
- Create: `src/domain/VideoOptions.ts`
- Create: `src/client/controllers/OptionsController.ts`
- Modify: `src/client/storage/ProjectDraft.ts` (toàn bộ file)
- Modify: `src/client/storage/DraftRepository.ts:1-24`
- Modify: `src/client/controllers/StudioSession.ts:1-157` (import, `StudioData`, `EMPTY_STUDIO`, `prune`, `restore`, `doSave`)
- Modify: `src/client/controllers/createStudio.ts` (import, `Studio`, return)
- Test: `tests/domain/VideoOptions.test.ts` (mới)
- Test: `tests/client/controllers/OptionsController.test.ts` (mới)
- Test: `tests/client/storage/ProjectDraft.test.ts` (thêm describe)
- Test: `tests/client/storage/DraftRepository.test.ts` (sửa dòng 34, thêm 1 test)
- Test: `tests/client/controllers/StudioSession.test.ts` (thêm import + describe)
- Test: `tests/client/controllers/createStudio.test.ts` (thêm 1 test)

**Interfaces:**
- Consumes: `ValidationError` (`src/domain/errors.ts`), `StateController` (`src/client/controllers/StateController.ts`), `StudioSession.update/setBrand/state`.
- Produces:
  - `src/domain/fontIds.ts`: `FONT_CHOICES: readonly { id: FontId; label: string }[]` (thứ tự: phudu, be-vietnam-pro, oswald, montserrat, roboto-condensed, barlow-condensed), `type FontId`, `DEFAULT_SUBTITLE_FONT_ID: FontId = "phudu"`, `DEFAULT_TEXT_FONT_ID: FontId = "barlow-condensed"`, `isFontId(v: unknown): v is FontId`.
  - `src/domain/VideoOptions.ts`: `type FootageKindPreference = "any" | "image" | "video"`, `type SceneFootageKind = "image" | "video"`, `interface VideoOptionsSnapshot { subtitles: { enabled: boolean; fontId: FontId }; textFontId: FontId; intro: { backgroundColor?: string; blockColor?: string }; footageKind: FootageKindPreference; sceneFootageKinds: Record<string, SceneFootageKind> }`, lớp `VideoOptions` với `static defaults()`, `static restore(raw: unknown)`, getter `subtitlesEnabled`, `subtitleFontId`, `textFontId`, `introBackgroundColor: string | null`, `introBlockColor: string | null`, `footageKind`; `withSubtitlesEnabled(b)`, `withSubtitleFont(id: string)`, `withTextFont(id: string)`, `withIntroBackground(c: string | null)`, `withIntroBlock(c: string | null)`, `withoutIntroColors()`, `withFootageKind(kind: string)`, `withSceneFootageKind(sceneId, kind: SceneFootageKind | null)`, `sceneFootageKind(sceneId): SceneFootageKind | null`, `footageKindFor(sceneId): FootageKindPreference`, `keepScenes(ids: ReadonlySet<string>)`, `snapshot()`. Màu lưu chữ thường.
  - `StudioData.options: VideoOptions`; `DraftBody.options?: VideoOptionsSnapshot`; `DraftParts.options?: VideoOptions`; `RestoredDraft` (options bắt buộc); `DRAFT_VERSION = 2`; `type DraftVersion = 1 | 2`; `READABLE_DRAFT_VERSIONS`.
  - `OptionsController` (`studio.options`): `fontChoices`, `setSubtitlesEnabled(b)`, `setSubtitleFont(id)`, `setTextFont(id)`, `setIntroBackground(hex)`, `setIntroBlock(hex)`, `resetIntroColors()`, `setFootageKind(kind)`, `introColors(): { backgroundColor: string; blockColor: string; custom: boolean }` (chữ thường), state `{ error: string | null }`.

- [ ] **Step 1: Viết test model `tests/domain/VideoOptions.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { ValidationError } from "@/domain/errors";
import { FONT_CHOICES } from "@/domain/fontIds";
import { VideoOptions } from "@/domain/VideoOptions";

const DEFAULT_SNAPSHOT = {
  subtitles: { enabled: true, fontId: "phudu" },
  textFontId: "barlow-condensed",
  intro: {},
  footageKind: "any",
  sceneFootageKinds: {},
};

describe("VideoOptions", () => {
  it("danh sách font có đủ 6 họ, đúng thứ tự hiển thị", () => {
    expect(FONT_CHOICES.map((f) => f.id)).toEqual([
      "phudu",
      "be-vietnam-pro",
      "oswald",
      "montserrat",
      "roboto-condensed",
      "barlow-condensed",
    ]);
    expect(FONT_CHOICES.map((f) => f.label)).toEqual([
      "Phudu",
      "Be Vietnam Pro",
      "Oswald",
      "Montserrat",
      "Roboto Condensed",
      "Barlow Condensed",
    ]);
  });

  it("mặc định: phụ đề bật font Phudu, chữ Barlow Condensed, màu theo thương hiệu, cả ảnh và video", () => {
    expect(VideoOptions.defaults().snapshot()).toEqual(DEFAULT_SNAPSHOT);
  });

  it("đổi từng tuỳ chọn, bản cũ không đổi (bất biến)", () => {
    const a = VideoOptions.defaults();
    const b = a.withSubtitlesEnabled(false).withSubtitleFont("be-vietnam-pro").withTextFont("oswald").withFootageKind("video");
    expect(a.subtitlesEnabled).toBe(true);
    expect(b.subtitlesEnabled).toBe(false);
    expect(b.snapshot()).toMatchObject({
      subtitles: { enabled: false, fontId: "be-vietnam-pro" },
      textFontId: "oswald",
      footageKind: "video",
    });
  });

  it("font lạ hoặc loại cảnh trám lạ thì báo lỗi tiếng Việt", () => {
    const o = VideoOptions.defaults();
    expect(() => o.withSubtitleFont("comic-sans")).toThrow(ValidationError);
    expect(() => o.withTextFont("")).toThrow("Font không có trong danh sách");
    expect(() => o.withFootageKind("gif")).toThrow("Loại cảnh trám không hợp lệ");
  });

  it("màu thumbnail đầu: nhận #RRGGBB (lưu chữ thường), null là về mặc định", () => {
    const o = VideoOptions.defaults().withIntroBackground("#12AB34").withIntroBlock("#C0392B");
    expect(o.introBackgroundColor).toBe("#12ab34");
    expect(o.introBlockColor).toBe("#c0392b");
    expect(o.snapshot().intro).toEqual({ backgroundColor: "#12ab34", blockColor: "#c0392b" });
    expect(o.withIntroBackground(null).snapshot().intro).toEqual({ blockColor: "#c0392b" });
    expect(o.withoutIntroColors().snapshot().intro).toEqual({});
    expect(() => o.withIntroBlock("red")).toThrow("Màu phải có dạng #RRGGBB");
  });

  it("loại cảnh trám riêng từng cảnh: ghi đè ưu tiên chung, null là bỏ", () => {
    const o = VideoOptions.defaults().withFootageKind("video").withSceneFootageKind("s2", "image");
    expect(o.sceneFootageKind("s2")).toBe("image");
    expect(o.sceneFootageKind("s3")).toBeNull();
    expect(o.footageKindFor("s2")).toBe("image");
    expect(o.footageKindFor("s3")).toBe("video");
    expect(o.withSceneFootageKind("s2", null).sceneFootageKind("s2")).toBeNull();
  });

  it("keepScenes bỏ lựa chọn của cảnh đã mất; không đổi gì thì trả chính nó", () => {
    const o = VideoOptions.defaults().withSceneFootageKind("s2", "video").withSceneFootageKind("s3", "image");
    expect(o.keepScenes(new Set(["s1", "s2", "s3"]))).toBe(o);
    expect(o.keepScenes(new Set(["s2"])).snapshot().sceneFootageKinds).toEqual({ s2: "video" });
  });

  it("snapshot/restore round trip qua structuredClone", () => {
    const o = VideoOptions.defaults()
      .withSubtitlesEnabled(false)
      .withSubtitleFont("montserrat")
      .withTextFont("roboto-condensed")
      .withIntroBackground("#112233")
      .withFootageKind("image")
      .withSceneFootageKind("s4", "video");
    expect(VideoOptions.restore(structuredClone(o.snapshot())).snapshot()).toEqual(o.snapshot());
  });

  it("restore khoan dung: thiếu hoặc sai trường thì dùng mặc định trường đó, không ném", () => {
    expect(VideoOptions.restore(undefined).snapshot()).toEqual(DEFAULT_SNAPSHOT);
    expect(VideoOptions.restore("rác").snapshot()).toEqual(DEFAULT_SNAPSHOT);
    const o = VideoOptions.restore({
      subtitles: { enabled: false, fontId: "khong-co" },
      textFontId: 7,
      intro: { backgroundColor: "xanh", blockColor: "#ABCDEF" },
      footageKind: "gif",
      sceneFootageKinds: { s2: "video", s3: "gif" },
    });
    expect(o.snapshot()).toEqual({
      subtitles: { enabled: false, fontId: "phudu" },
      textFontId: "barlow-condensed",
      intro: { blockColor: "#abcdef" },
      footageKind: "any",
      sceneFootageKinds: { s2: "video" },
    });
  });
});
```

- [ ] **Step 2: Chạy, thấy đỏ**

Run: `npx vitest run tests/domain/VideoOptions.test.ts`
Expected: FAIL — `Failed to resolve import "@/domain/errors"`… cụ thể là không tìm thấy `@/domain/fontIds` / `@/domain/VideoOptions`.

- [ ] **Step 3: Viết `src/domain/fontIds.ts`**

```ts
/** Các họ font người dùng chọn được cho chữ trong video. Id ổn định (lưu trong bản nháp). */
export const FONT_CHOICES = [
  { id: "phudu", label: "Phudu" },
  { id: "be-vietnam-pro", label: "Be Vietnam Pro" },
  { id: "oswald", label: "Oswald" },
  { id: "montserrat", label: "Montserrat" },
  { id: "roboto-condensed", label: "Roboto Condensed" },
  { id: "barlow-condensed", label: "Barlow Condensed" },
] as const;

export type FontId = (typeof FONT_CHOICES)[number]["id"];

/** Phụ đề là tính năng mới: mặc định Phudu. */
export const DEFAULT_SUBTITLE_FONT_ID: FontId = "phudu";
/** Chữ tiêu đề và nhãn: giữ Barlow Condensed để video cũ không đổi hình ảnh. */
export const DEFAULT_TEXT_FONT_ID: FontId = "barlow-condensed";

export function isFontId(v: unknown): v is FontId {
  return FONT_CHOICES.some((f) => f.id === v);
}
```

- [ ] **Step 4: Viết `src/domain/VideoOptions.ts`**

```ts
import { ValidationError } from "./errors";
import { DEFAULT_SUBTITLE_FONT_ID, DEFAULT_TEXT_FONT_ID, isFontId, type FontId } from "./fontIds";

export type FootageKindPreference = "any" | "image" | "video";
export type SceneFootageKind = "image" | "video";

export interface VideoOptionsSnapshot {
  subtitles: { enabled: boolean; fontId: FontId };
  textFontId: FontId;
  /** Màu riêng của thumbnail đầu (cảnh mở đầu); không có khoá = theo màu chủ đạo thương hiệu. */
  intro: { backgroundColor?: string; blockColor?: string };
  /** Ưu tiên khi tự điền cảnh trám. */
  footageKind: FootageKindPreference;
  /** Lựa chọn Ảnh/Video riêng của từng cảnh (theo id cảnh). */
  sceneFootageKinds: Record<string, SceneFootageKind>;
}

interface Fields {
  subtitlesEnabled: boolean;
  subtitleFontId: FontId;
  textFontId: FontId;
  introBackgroundColor: string | null;
  introBlockColor: string | null;
  footageKind: FootageKindPreference;
  sceneKinds: ReadonlyMap<string, SceneFootageKind>;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FOOTAGE_KINDS: readonly FootageKindPreference[] = ["any", "image", "video"];

const DEFAULTS: Fields = {
  subtitlesEnabled: true,
  subtitleFontId: DEFAULT_SUBTITLE_FONT_ID,
  textFontId: DEFAULT_TEXT_FONT_ID,
  introBackgroundColor: null,
  introBlockColor: null,
  footageKind: "any",
  sceneKinds: new Map(),
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFootageKind(v: unknown): v is FootageKindPreference {
  return FOOTAGE_KINDS.includes(v as FootageKindPreference);
}

function isSceneKind(v: unknown): v is SceneFootageKind {
  return v === "image" || v === "video";
}

function checkedFont(id: string): FontId {
  if (!isFontId(id)) throw new ValidationError("Font không có trong danh sách");
  return id;
}

function checkedColor(color: string | null): string | null {
  if (color === null) return null;
  if (!HEX_COLOR.test(color)) throw new ValidationError("Màu phải có dạng #RRGGBB");
  return color.toLowerCase();
}

function restoredColor(v: unknown): string | null {
  return typeof v === "string" && HEX_COLOR.test(v) ? v.toLowerCase() : null;
}

/** Tuỳ chọn riêng của MỘT video (lưu trong bản nháp, không thuộc bộ thương hiệu). Bất biến. */
export class VideoOptions {
  private constructor(private readonly f: Fields) {}

  static defaults(): VideoOptions {
    return new VideoOptions(DEFAULTS);
  }

  get subtitlesEnabled(): boolean {
    return this.f.subtitlesEnabled;
  }

  get subtitleFontId(): FontId {
    return this.f.subtitleFontId;
  }

  get textFontId(): FontId {
    return this.f.textFontId;
  }

  get introBackgroundColor(): string | null {
    return this.f.introBackgroundColor;
  }

  get introBlockColor(): string | null {
    return this.f.introBlockColor;
  }

  get footageKind(): FootageKindPreference {
    return this.f.footageKind;
  }

  withSubtitlesEnabled(enabled: boolean): VideoOptions {
    return this.with({ subtitlesEnabled: enabled });
  }

  withSubtitleFont(fontId: string): VideoOptions {
    return this.with({ subtitleFontId: checkedFont(fontId) });
  }

  withTextFont(fontId: string): VideoOptions {
    return this.with({ textFontId: checkedFont(fontId) });
  }

  withIntroBackground(color: string | null): VideoOptions {
    return this.with({ introBackgroundColor: checkedColor(color) });
  }

  withIntroBlock(color: string | null): VideoOptions {
    return this.with({ introBlockColor: checkedColor(color) });
  }

  withoutIntroColors(): VideoOptions {
    return this.with({ introBackgroundColor: null, introBlockColor: null });
  }

  withFootageKind(kind: string): VideoOptions {
    if (!isFootageKind(kind)) throw new ValidationError("Loại cảnh trám không hợp lệ");
    return this.with({ footageKind: kind });
  }

  withSceneFootageKind(sceneId: string, kind: SceneFootageKind | null): VideoOptions {
    if (!sceneId) throw new ValidationError("Cảnh thiếu id");
    if (kind !== null && !isSceneKind(kind)) throw new ValidationError("Loại cảnh trám không hợp lệ");
    const next = new Map(this.f.sceneKinds);
    if (kind === null) next.delete(sceneId);
    else next.set(sceneId, kind);
    return this.with({ sceneKinds: next });
  }

  sceneFootageKind(sceneId: string): SceneFootageKind | null {
    return this.f.sceneKinds.get(sceneId) ?? null;
  }

  /** Loại dùng khi tự điền cảnh: lựa chọn riêng của cảnh, không có thì ưu tiên chung. */
  footageKindFor(sceneId: string): FootageKindPreference {
    return this.sceneFootageKind(sceneId) ?? this.f.footageKind;
  }

  /** Bỏ lựa chọn của cảnh không còn trong dự án; không đổi gì thì trả chính nó. */
  keepScenes(sceneIds: ReadonlySet<string>): VideoOptions {
    if ([...this.f.sceneKinds.keys()].every((id) => sceneIds.has(id))) return this;
    return this.with({ sceneKinds: new Map([...this.f.sceneKinds].filter(([id]) => sceneIds.has(id))) });
  }

  snapshot(): VideoOptionsSnapshot {
    const intro: VideoOptionsSnapshot["intro"] = {};
    if (this.f.introBackgroundColor) intro.backgroundColor = this.f.introBackgroundColor;
    if (this.f.introBlockColor) intro.blockColor = this.f.introBlockColor;
    return {
      subtitles: { enabled: this.f.subtitlesEnabled, fontId: this.f.subtitleFontId },
      textFontId: this.f.textFontId,
      intro,
      footageKind: this.f.footageKind,
      sceneFootageKinds: Object.fromEntries(this.f.sceneKinds),
    };
  }

  /** Khoan dung: dữ liệu thiếu hoặc sai ở trường nào thì trường đó dùng mặc định (bản nháp cũ không có tuỳ chọn). */
  static restore(raw: unknown): VideoOptions {
    if (!isRecord(raw)) return VideoOptions.defaults();
    const subtitles = isRecord(raw.subtitles) ? raw.subtitles : {};
    const intro = isRecord(raw.intro) ? raw.intro : {};
    const kinds = isRecord(raw.sceneFootageKinds) ? raw.sceneFootageKinds : {};
    const sceneKinds = new Map<string, SceneFootageKind>();
    for (const [sceneId, kind] of Object.entries(kinds)) if (sceneId && isSceneKind(kind)) sceneKinds.set(sceneId, kind);
    return new VideoOptions({
      subtitlesEnabled: typeof subtitles.enabled === "boolean" ? subtitles.enabled : DEFAULTS.subtitlesEnabled,
      subtitleFontId: isFontId(subtitles.fontId) ? subtitles.fontId : DEFAULTS.subtitleFontId,
      textFontId: isFontId(raw.textFontId) ? raw.textFontId : DEFAULTS.textFontId,
      introBackgroundColor: restoredColor(intro.backgroundColor),
      introBlockColor: restoredColor(intro.blockColor),
      footageKind: isFootageKind(raw.footageKind) ? raw.footageKind : DEFAULTS.footageKind,
      sceneKinds,
    });
  }

  private with(change: Partial<Fields>): VideoOptions {
    return new VideoOptions({ ...this.f, ...change });
  }
}
```

- [ ] **Step 5: Chạy, thấy xanh**

Run: `npx vitest run tests/domain/VideoOptions.test.ts`
Expected: PASS (10 test).

- [ ] **Step 6: Viết test bản nháp và session (đỏ)**

Thêm vào cuối `tests/client/storage/ProjectDraft.test.ts` (thêm `import { VideoOptions } from "@/domain/VideoOptions";` vào khối import đầu file):

```ts
describe("buildDraftBody / restoreDraft — tuỳ chọn video", () => {
  it("ghi tuỳ chọn video; không truyền thì ghi mặc định; round trip giữ nguyên", () => {
    expect(buildDraftBody(parts()).options).toEqual(VideoOptions.defaults().snapshot());
    const options = VideoOptions.defaults().withSubtitlesEnabled(false).withIntroBlock("#C0392B").withSceneFootageKind("s2", "video");
    const back = restoreDraft(structuredClone(buildDraftBody({ ...parts(), options })), sequentialIds("n"));
    expect(back.options.snapshot()).toEqual(options.snapshot());
  });

  it("bản nháp v1 (không có options) mở được với tuỳ chọn mặc định", () => {
    const body = buildDraftBody(parts());
    delete body.options;
    const back = restoreDraft(structuredClone(body), sequentialIds("n"));
    expect(back.options.snapshot()).toEqual(VideoOptions.defaults().snapshot());
  });
});
```

Sửa `tests/client/storage/DraftRepository.test.ts` dòng 34 thành:

```ts
    expect(await repo.load()).toEqual({ version: 2, savedAt: "2026-10-15T01:02:03.000Z", ...body });
```

và thêm test vào trong `describe("DraftRepository", ...)`:

```ts
  it("bản nháp v1 (trước khi có tuỳ chọn video) vẫn đọc được", async () => {
    const store = new MemoryKeyValueStore();
    await store.set("draft", { version: 1, savedAt: "2026-10-14T00:00:00.000Z", ...body });
    const loaded = await new DraftRepository(store).load();
    expect(loaded?.version).toBe(1);
    expect(loaded?.options).toBeUndefined();
  });
```

Thêm vào khối import đầu `tests/client/controllers/StudioSession.test.ts`:

```ts
import { VideoOptions } from "@/domain/VideoOptions";
```

và thêm vào cuối file:

```ts
describe("StudioSession — tuỳ chọn video", () => {
  it("mặc định có tuỳ chọn video; đổi khi chưa có dự án thì giữ trong bộ nhớ, không hẹn lưu", () => {
    const { session, sched } = makeSession();
    expect(session.state.options.snapshot()).toEqual(VideoOptions.defaults().snapshot());
    session.update((d) => ({ ...d, options: d.options.withSubtitlesEnabled(false) }));
    expect(session.state.options.subtitlesEnabled).toBe(false);
    expect(sched.pending()).toBe(0);
  });

  it("tự lưu kèm tuỳ chọn video", async () => {
    const { session, saves } = makeSessionWithProject(2);
    session.update((d) => ({ ...d, options: d.options.withTextFont("oswald").withSceneFootageKind("s2", "video") }));
    await session.flush();
    expect(saves.at(-1)?.options).toMatchObject({ textFontId: "oswald", sceneFootageKinds: { s2: "video" } });
  });

  it("restore lấy tuỳ chọn từ bản nháp; bản nháp v1 không có tuỳ chọn thì dùng mặc định", async () => {
    const a = makeSessionWithProject(2);
    a.session.update((d) => ({ ...d, options: d.options.withSubtitleFont("oswald") }));
    await a.session.flush();
    const b = makeSession();
    b.session.restore(a.saves.at(-1)!);
    expect(b.session.state.options.subtitleFontId).toBe("oswald");
    const v1 = { ...a.saves.at(-1)! };
    delete v1.options;
    const c = makeSession();
    c.session.restore(v1);
    expect(c.session.state.options.snapshot()).toEqual(VideoOptions.defaults().snapshot());
  });

  it("bỏ lựa chọn Ảnh/Video của cảnh không còn trong dự án", () => {
    const { session, project } = makeSessionWithProject(3);
    const [, s2, s3] = project.scenes;
    session.update((d) => ({
      ...d,
      options: d.options.withSceneFootageKind(s2!.id, "image").withSceneFootageKind(s3!.id, "video"),
    }));
    session.update((d) => ({ ...d, project: d.project!.mergeWithNext(s2!.id) })); // s3 biến mất
    expect(session.state.options.sceneFootageKind(s2!.id)).toBe("image");
    expect(session.state.options.sceneFootageKind(s3!.id)).toBeNull();
  });

  it("reset (dự án mới) đưa tuỳ chọn về mặc định", () => {
    const { session } = makeSessionWithProject(2);
    session.update((d) => ({ ...d, options: d.options.withSubtitlesEnabled(false) }));
    session.reset();
    expect(session.state.options.subtitlesEnabled).toBe(true);
  });
});
```

- [ ] **Step 7: Chạy, thấy đỏ**

Run: `npx vitest run tests/client/storage tests/client/controllers/StudioSession.test.ts`
Expected: FAIL — `options` không tồn tại (`Cannot read properties of undefined (reading 'snapshot')`), `expected { version: 1 … } to deeply equal { version: 2 … }`. (Test "bản nháp v1 vẫn đọc được" có thể đã xanh vì v1 đang là phiên bản hiện hành — ghi chú trong report.)

- [ ] **Step 8: Viết lại `src/client/storage/ProjectDraft.ts`**

```ts
import { FootageBoard, type FootageBoardSnapshot } from "@/domain/FootageBoard";
import { ValidationError } from "@/domain/errors";
import type { IdGenerator } from "@/domain/ids";
import { MusicTrack, type MusicTrackSnapshot } from "@/domain/MusicTrack";
import { Narration, type NarrationSnapshot } from "@/domain/Narration";
import { NewsProject, type NewsProjectSnapshot } from "@/domain/NewsProject";
import { VideoOptions, type VideoOptionsSnapshot } from "@/domain/VideoOptions";
import { VoiceSettings, type VoiceSnapshot } from "@/domain/VoiceSettings";

/** v2 thêm `options` (tuỳ chọn video). v1 vẫn đọc được: thiếu `options` thì dùng mặc định. */
export const DRAFT_VERSION = 2;
export type DraftVersion = 1 | 2;
export const READABLE_DRAFT_VERSIONS: readonly DraftVersion[] = [1, 2];

export interface DraftParts {
  project: NewsProject;
  voice: VoiceSettings | null;
  narrations: readonly Narration[];
  footage: FootageBoard;
  music: MusicTrack | null;
  /** Bỏ trống khi ghi = tuỳ chọn mặc định. */
  options?: VideoOptions;
}

export interface RestoredDraft extends DraftParts {
  options: VideoOptions;
}

export interface DraftBody {
  project: NewsProjectSnapshot;
  voice: VoiceSnapshot | null;
  narrations: NarrationSnapshot[];
  footage: FootageBoardSnapshot;
  music: MusicTrackSnapshot | null;
  /** Không có ở bản nháp v1. */
  options?: VideoOptionsSnapshot;
}

export interface ProjectDraft extends DraftBody {
  version: DraftVersion;
  savedAt: string;
}

export function buildDraftBody(parts: DraftParts): DraftBody {
  return {
    project: parts.project.snapshot(),
    voice: parts.voice?.snapshot() ?? null,
    narrations: parts.narrations.map((n) => n.snapshot()),
    footage: parts.footage.snapshot(),
    music: parts.music?.snapshot() ?? null,
    options: (parts.options ?? VideoOptions.defaults()).snapshot(),
  };
}

/** Dựng lại các đối tượng domain; mọi phần hỏng ném ValidationError (riêng tuỳ chọn video thì khoan dung). */
export function restoreDraft(draft: DraftBody, nextId: IdGenerator): RestoredDraft {
  const isObject = (v: unknown) => typeof v === "object" && v !== null;
  if (!Array.isArray(draft.narrations)) throw new ValidationError("Bản nháp hỏng: thiếu danh sách giọng đọc");
  if (!isObject(draft.footage)) throw new ValidationError("Bản nháp hỏng: dữ liệu bảng cảnh trám không hợp lệ");
  if (draft.voice != null && !isObject(draft.voice)) throw new ValidationError("Bản nháp hỏng: dữ liệu giọng đọc không hợp lệ");
  if (draft.music != null && !isObject(draft.music)) throw new ValidationError("Bản nháp hỏng: dữ liệu nhạc nền không hợp lệ");
  return {
    project: NewsProject.restore(draft.project, nextId),
    voice: draft.voice ? VoiceSettings.restore(draft.voice) : null,
    narrations: draft.narrations.map((n) => Narration.restore(n)),
    footage: FootageBoard.restore(draft.footage),
    music: draft.music ? MusicTrack.restore(draft.music) : null,
    options: VideoOptions.restore(draft.options),
  };
}
```

- [ ] **Step 9: Sửa `src/client/storage/DraftRepository.ts`**

Thay dòng import và điều kiện phiên bản:

```ts
import type { KeyValueStore } from "./KeyValueStore";
import { DRAFT_VERSION, READABLE_DRAFT_VERSIONS, type DraftBody, type DraftVersion, type ProjectDraft } from "./ProjectDraft";
```

```ts
  /** Bản nháp không đọc được hoặc sai phiên bản thì coi như chưa có (không ném). v1 và v2 đều đọc được. */
  async load(): Promise<ProjectDraft | null> {
    const value = await this.store.get<unknown>(KEY);
    if (typeof value !== "object" || value === null) return null;
    const draft = value as Partial<ProjectDraft>;
    if (!READABLE_DRAFT_VERSIONS.includes(draft.version as DraftVersion)) return null;
    if (typeof draft.project !== "object" || draft.project === null) return null;
    return draft as ProjectDraft;
  }
```

- [ ] **Step 10: Sửa `src/client/controllers/StudioSession.ts`**

Thêm import: `import { VideoOptions } from "@/domain/VideoOptions";`

`StudioData` thêm trường (sau `brand`):

```ts
  brand: BrandData;
  /** Tuỳ chọn riêng của video đang làm (vào bản nháp, về mặc định khi dự án mới). */
  options: VideoOptions;
```

`EMPTY_STUDIO` thêm `options: VideoOptions.defaults(),`.

Thay hàm `prune`:

```ts
/** Bỏ giọng, cảnh trám và lựa chọn Ảnh/Video của cảnh không còn trong dự án. */
function prune(data: StudioData): StudioData {
  if (!data.project) return data;
  const ids = new Set(data.project.scenes.map((s) => s.id));
  let narrations = data.narrations;
  if ([...narrations.keys()].some((id) => !ids.has(id))) {
    narrations = new Map([...narrations].filter(([id]) => ids.has(id)));
  }
  let footage = data.footage;
  for (const id of footage.sceneIds()) if (!ids.has(id)) footage = footage.unassign(id);
  const options = data.options.keepScenes(ids);
  return narrations === data.narrations && footage === data.footage && options === data.options
    ? data
    : { ...data, narrations, footage, options };
}
```

Trong `restore`, thêm `options: parts.options,` sau `music: parts.music,`.

Trong `doSave`:

```ts
    const { project, voice, narrations, footage, music, options } = this.current;
    if (!project) return;
    try {
      await this.deps.drafts.save(
        buildDraftBody({ project, voice, narrations: [...narrations.values()], footage, music, options }),
      );
```

(`reset()` giữ nguyên: `{ ...EMPTY_STUDIO, brand }` đã đưa tuỳ chọn về mặc định.)

- [ ] **Step 11: Chạy, thấy xanh**

Run: `npx vitest run tests/client/storage tests/client/controllers/StudioSession.test.ts`
Expected: PASS.

- [ ] **Step 12: Viết test `tests/client/controllers/OptionsController.test.ts` (đỏ) và thêm test createStudio**

```ts
import { describe, expect, it } from "vitest";
import { OptionsController } from "@/client/controllers/OptionsController";
import { flush, makeSessionWithProject } from "../../helpers/studioFixtures";

function setup() {
  const made = makeSessionWithProject(2);
  return { ...made, ctrl: new OptionsController({ session: made.session }) };
}

describe("OptionsController", () => {
  it("bật/tắt phụ đề, đổi font, đổi ưu tiên ảnh/video: ghi vào session và tự lưu", async () => {
    const { ctrl, session, saves, sched } = setup();
    ctrl.setSubtitlesEnabled(false);
    ctrl.setSubtitleFont("oswald");
    ctrl.setTextFont("montserrat");
    ctrl.setFootageKind("image");
    expect(session.state.options.snapshot()).toMatchObject({
      subtitles: { enabled: false, fontId: "oswald" },
      textFontId: "montserrat",
      footageKind: "image",
    });
    sched.runAll();
    await flush();
    expect(saves.at(-1)?.options).toMatchObject({
      subtitles: { enabled: false, fontId: "oswald" },
      textFontId: "montserrat",
      footageKind: "image",
    });
  });

  it("giá trị lạ: báo lỗi tiếng Việt, session giữ nguyên; thao tác đúng sau đó xoá lỗi", () => {
    const { ctrl, session } = setup();
    const before = session.state.options;
    ctrl.setSubtitleFont("comic-sans");
    expect(ctrl.state.error).toBe("Font không có trong danh sách");
    expect(session.state.options).toBe(before);
    ctrl.setIntroBlock("đỏ");
    expect(ctrl.state.error).toBe("Màu phải có dạng #RRGGBB");
    ctrl.setSubtitleFont("oswald");
    expect(ctrl.state.error).toBeNull();
    expect(session.state.options.subtitleFontId).toBe("oswald");
  });

  it("màu thumbnail đầu: mặc định theo màu chủ đạo thương hiệu; đặt riêng; về mặc định", () => {
    const { ctrl, session } = setup();
    expect(ctrl.introColors()).toEqual({ backgroundColor: "#1f9d55", blockColor: "#1f9d55", custom: false });
    session.setBrand({ values: { primaryColor: "#AA0000" }, logo: null });
    expect(ctrl.introColors()).toEqual({ backgroundColor: "#aa0000", blockColor: "#aa0000", custom: false });
    ctrl.setIntroBackground("#112233");
    expect(ctrl.introColors()).toEqual({ backgroundColor: "#112233", blockColor: "#aa0000", custom: true });
    ctrl.setIntroBlock("#445566");
    expect(ctrl.introColors()).toEqual({ backgroundColor: "#112233", blockColor: "#445566", custom: true });
    ctrl.resetIntroColors();
    expect(ctrl.introColors()).toEqual({ backgroundColor: "#aa0000", blockColor: "#aa0000", custom: false });
  });

  it("danh sách font cho giao diện", () => {
    const { ctrl } = setup();
    expect(ctrl.fontChoices.map((f) => f.id)).toContain("phudu");
    expect(ctrl.fontChoices).toHaveLength(6);
  });
});
```

Thêm vào `describe("createStudio", ...)` trong `tests/client/controllers/createStudio.test.ts`:

```ts
  it("có OptionsController dùng chung session", () => {
    const studio = createStudio(createClientServices(env()), { schedule: () => () => {} });
    studio.options.setTextFont("oswald");
    expect(studio.session.state.options.textFontId).toBe("oswald");
    studio.dispose();
  });
```

Run: `npx vitest run tests/client/controllers/OptionsController.test.ts tests/client/controllers/createStudio.test.ts`
Expected: FAIL — không tìm thấy `@/client/controllers/OptionsController`; `studio.options` undefined.

- [ ] **Step 13: Viết `src/client/controllers/OptionsController.ts`**

```ts
import { FONT_CHOICES } from "@/domain/fontIds";
import type { VideoOptions } from "@/domain/VideoOptions";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface OptionsPanelState {
  error: string | null;
}

export interface OptionsControllerDeps {
  session: StudioSession;
  onAuthLost?: () => void;
}

export interface IntroColors {
  backgroundColor: string;
  blockColor: string;
  /** true khi có ít nhất một màu đặt riêng (nút "Về mặc định" bật). */
  custom: boolean;
}

/** Màu chủ đạo mặc định của phong cách Theanh28, dùng khi bộ thương hiệu chưa nạp. */
const FALLBACK_PRIMARY = "#1f9d55";

/** Thanh "Tuỳ chọn video": ghi tuỳ chọn riêng của video vào session (session tự lưu bản nháp). */
export class OptionsController extends StateController<OptionsPanelState> {
  readonly fontChoices = FONT_CHOICES;

  constructor(private readonly deps: OptionsControllerDeps) {
    super({ error: null }, deps.onAuthLost);
  }

  setSubtitlesEnabled(enabled: boolean): void {
    this.apply((o) => o.withSubtitlesEnabled(enabled));
  }

  setSubtitleFont(fontId: string): void {
    this.apply((o) => o.withSubtitleFont(fontId));
  }

  setTextFont(fontId: string): void {
    this.apply((o) => o.withTextFont(fontId));
  }

  setIntroBackground(color: string): void {
    this.apply((o) => o.withIntroBackground(color));
  }

  setIntroBlock(color: string): void {
    this.apply((o) => o.withIntroBlock(color));
  }

  resetIntroColors(): void {
    this.apply((o) => o.withoutIntroColors());
  }

  setFootageKind(kind: string): void {
    this.apply((o) => o.withFootageKind(kind));
  }

  /** Màu đang dùng của thumbnail đầu (chữ thường): màu đặt riêng, không có thì màu chủ đạo thương hiệu. */
  introColors(): IntroColors {
    const { options, brand } = this.deps.session.state;
    const primary = (brand.values.primaryColor ?? FALLBACK_PRIMARY).toLowerCase();
    return {
      backgroundColor: options.introBackgroundColor ?? primary,
      blockColor: options.introBlockColor ?? primary,
      custom: options.introBackgroundColor !== null || options.introBlockColor !== null,
    };
  }

  private apply(change: (options: VideoOptions) => VideoOptions): void {
    let next: VideoOptions;
    try {
      next = change(this.deps.session.state.options);
    } catch (error) {
      this.patch({ error: this.report(error) });
      return;
    }
    this.deps.session.update((d) => ({ ...d, options: next }));
    if (this.state.error !== null) this.patch({ error: null });
  }
}
```

- [ ] **Step 14: Lắp vào `src/client/controllers/createStudio.ts`**

Thêm `import { OptionsController } from "./OptionsController";`; trong `interface Studio` thêm `options: OptionsController;` (sau `brand`); trong object trả về thêm (sau `brand: new BrandController(...)`):

```ts
    options: new OptionsController({ session, onAuthLost }),
```

- [ ] **Step 15: Chạy toàn bộ**

Run: `npx vitest run` rồi `npm run typecheck` rồi `npm run lint`
Expected: tất cả PASS, typecheck 0 lỗi, lint 0 cảnh báo.

- [ ] **Step 16: Commit (điều phối viên)**

```bash
git add src/domain/fontIds.ts src/domain/VideoOptions.ts src/client/storage/ProjectDraft.ts src/client/storage/DraftRepository.ts src/client/controllers/StudioSession.ts src/client/controllers/OptionsController.ts src/client/controllers/createStudio.ts tests/domain/VideoOptions.test.ts tests/client/controllers/OptionsController.test.ts tests/client/storage/ProjectDraft.test.ts tests/client/storage/DraftRepository.test.ts tests/client/controllers/StudioSession.test.ts tests/client/controllers/createStudio.test.ts
git commit -m "feat(tuy-chon): mô hình VideoOptions, bản nháp v2, OptionsController"
```

---

### Task 2: FontCatalog + tải font + nạp theo font chọn trong worker + font chữ theo tuỳ chọn

**Files:**
- Create: `public/fonts/phudu/Phudu-Variable.ttf`, `public/fonts/phudu/OFL.txt`
- Create: `public/fonts/be-vietnam-pro/BeVietnamPro-SemiBold.ttf`, `BeVietnamPro-ExtraBold.ttf`, `OFL.txt`
- Create: `public/fonts/oswald/Oswald-Variable.ttf`, `OFL.txt`
- Create: `public/fonts/montserrat/Montserrat-Variable.ttf`, `OFL.txt`
- Create: `public/fonts/roboto-condensed/RobotoCondensed-Variable.ttf`, `OFL.txt`
- Create: `scripts/lib/ttfCmap.ts`
- Create: `src/templates/fonts/FontCatalog.ts`
- Modify: `src/templates/VideoTemplate.ts` (thêm `FontStyle`, `FrameStyle`, `cssFont`, `ProjectFrame.style`)
- Modify: `src/templates/theanh28/TheAnh28Template.ts` (toàn bộ file)
- Modify: `src/client/render/RenderJob.ts` (thêm `options`)
- Modify: `src/client/controllers/RenderJobBuilder.ts` (đưa `options` vào job)
- Modify: `src/client/render/render.worker.ts` (toàn bộ hàm `render`)
- Test: `tests/scripts/ttfCmap.test.ts` (mới), `tests/templates/fonts/FontCatalog.test.ts` (mới)
- Test: `tests/templates/theanh28/TheAnh28Template.test.ts` (thêm describe), `tests/client/controllers/RenderJobBuilder.test.ts` (thêm test), `tests/client/render/RenderPlan.test.ts` (thêm `options` vào job mẫu)

**Interfaces:**
- Consumes (Task 1): `FontId`, `FONT_CHOICES` (`src/domain/fontIds.ts`); `VideoOptions`, `VideoOptionsSnapshot` (`src/domain/VideoOptions.ts`); `StudioData.options: VideoOptions`.
- Produces:
  - `src/templates/VideoTemplate.ts`: `interface FontStyle { family: string; semiBold: number; bold: number }`, `interface FrameStyle { textFont: FontStyle; subtitles: { enabled: boolean; font: FontStyle }; intro: { backgroundColor: string | null; blockColor: string | null } }`, `cssFont(font: FontStyle, weight: "semiBold" | "bold", px: number): string` → `` `${w} ${px}px "${family}", "Arial Narrow", sans-serif` ``, `ProjectFrame.style?: FrameStyle`.
  - `src/templates/fonts/FontCatalog.ts`: `interface FontEntry { id: FontId; label: string; style: FontStyle; faces: readonly FontFaceSpec[] }`, `FONT_CATALOG: Readonly<Record<FontId, FontEntry>>`, `frameStyleFor(o: VideoOptionsSnapshot): FrameStyle`, `fontFacesFor(o: VideoOptionsSnapshot): FontFaceSpec[]`.
  - `scripts/lib/ttfCmap.ts`: `cmapLookup(bytes: Uint8Array): (codepoint: number) => boolean`, `missingCodepoints(bytes: Uint8Array, text: string): number[]`.
  - `RenderJob.options: VideoOptionsSnapshot` (bắt buộc).
  - Template Theanh28: mọi chữ (tiêu đề, chip, tên kênh góc, chữ cái huy hiệu, tem ngày, dòng nguồn) dùng `project.style?.textFont`, không có thì Barlow 600/800 như cũ.

- [ ] **Step 1: Viết test đọc cmap `tests/scripts/ttfCmap.test.ts`**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cmapLookup, missingCodepoints } from "../../scripts/lib/ttfCmap";

const barlow = new Uint8Array(readFileSync(join(process.cwd(), "public/templates/theanh28/fonts/BarlowCondensed-ExtraBold.ttf")));

describe("ttfCmap", () => {
  it("nhận ra ký tự có và không có trong font", () => {
    const has = cmapLookup(barlow);
    expect(has(0x41)).toBe(true); // A
    expect(has(0x1ec5)).toBe(true); // ễ
    expect(has(0x4e2d)).toBe(false); // 中
    expect(has(0x1f600)).toBe(false); // 😀
  });

  it("missingCodepoints trả các mã thiếu, bỏ trùng", () => {
    expect(missingCodepoints(barlow, "Aễ中中😀")).toEqual([0x4e2d, 0x1f600]);
  });

  it("tệp không phải font thì báo lỗi", () => {
    expect(() => cmapLookup(new Uint8Array(64))).toThrow("Font không có bảng cmap");
  });
});
```

- [ ] **Step 2: Chạy, thấy đỏ**

Run: `npx vitest run tests/scripts/ttfCmap.test.ts`
Expected: FAIL — không tìm thấy `../../scripts/lib/ttfCmap`.

- [ ] **Step 3: Viết `scripts/lib/ttfCmap.ts`**

```ts
/**
 * Đọc bảng cmap của tệp TTF/OTF (định dạng 4 và 12, nền Unicode) để biết font có glyph cho ký tự nào.
 * Node thuần, không cần fonttools; dùng trong test kiểm font có đủ chữ tiếng Việt.
 */
export function cmapLookup(bytes: Uint8Array): (codepoint: number) => boolean {
  if (bytes.byteLength < 12) throw new Error("Font không có bảng cmap");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = view.getUint16(4);
  let cmap = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (rec + 16 > bytes.byteLength) break;
    const tag = String.fromCharCode(bytes[rec] ?? 0, bytes[rec + 1] ?? 0, bytes[rec + 2] ?? 0, bytes[rec + 3] ?? 0);
    if (tag === "cmap") {
      cmap = view.getUint32(rec + 8);
      break;
    }
  }
  if (cmap < 0) throw new Error("Font không có bảng cmap");

  const count = view.getUint16(cmap + 2);
  let format4 = -1;
  let format12 = -1;
  for (let i = 0; i < count; i++) {
    const rec = cmap + 4 + i * 8;
    const platform = view.getUint16(rec);
    const encoding = view.getUint16(rec + 2);
    const offset = cmap + view.getUint32(rec + 4);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    const format = view.getUint16(offset);
    if (format === 12) format12 = offset;
    else if (format === 4) format4 = offset;
  }

  if (format12 >= 0) {
    const groups = view.getUint32(format12 + 12);
    return (cp) => {
      for (let g = 0; g < groups; g++) {
        const r = format12 + 16 + g * 12;
        const start = view.getUint32(r);
        const end = view.getUint32(r + 4);
        if (cp >= start && cp <= end) return view.getUint32(r + 8) + (cp - start) !== 0;
      }
      return false;
    };
  }

  if (format4 >= 0) {
    const segX2 = view.getUint16(format4 + 6);
    const ends = format4 + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    return (cp) => {
      if (cp > 0xffff) return false;
      for (let s = 0; s < segX2; s += 2) {
        if (cp > view.getUint16(ends + s)) continue;
        const start = view.getUint16(starts + s);
        if (cp < start) return false;
        const delta = view.getInt16(deltas + s);
        const rangeOffset = view.getUint16(ranges + s);
        if (rangeOffset === 0) return ((cp + delta) & 0xffff) !== 0;
        const glyph = view.getUint16(ranges + s + rangeOffset + 2 * (cp - start));
        return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
      }
      return false;
    };
  }

  throw new Error("Font không có bảng cmap Unicode định dạng 4 hoặc 12");
}

/** Các mã ký tự (bỏ trùng, giữ thứ tự xuất hiện) mà font không có glyph. */
export function missingCodepoints(bytes: Uint8Array, text: string): number[] {
  const has = cmapLookup(bytes);
  const codepoints = [...new Set([...text].map((c) => c.codePointAt(0) as number))];
  return codepoints.filter((cp) => !has(cp));
}
```

Run: `npx vitest run tests/scripts/ttfCmap.test.ts`
Expected: PASS (3 test).

- [ ] **Step 4: Viết test danh mục font `tests/templates/fonts/FontCatalog.test.ts`**

```ts
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { FONT_CHOICES } from "@/domain/fontIds";
import { VideoOptions } from "@/domain/VideoOptions";
import { FONT_CATALOG, fontFacesFor, frameStyleFor } from "@/templates/fonts/FontCatalog";
import { missingCodepoints } from "../../../scripts/lib/ttfCmap";

const VIETNAMESE =
  "ẮẰẲẴẶắằẳẵặẤẦẨẪẬấầẩẫậĐđẾỀỂỄỆếềểễệỐỒỔỖỘốồổỗộỚỜỞỠỢớờởỡợỨỪỬỮỰứừửữựỲỴỶỸỳỵỷỹƠơƯưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĨĩŨũẠạẢảẸẹẺẻẼẽỈỉỊịỌọỎỏỤụỦủ";
const BASIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:./-,%";
const file = (url: string) => join(process.cwd(), "public", url);

describe("FontCatalog", () => {
  it("mỗi lựa chọn font có một mục, cùng nhãn, họ CSS riêng có tiền tố TVS", () => {
    for (const choice of FONT_CHOICES) {
      const entry = FONT_CATALOG[choice.id];
      expect(entry.id).toBe(choice.id);
      expect(entry.label).toBe(choice.label);
      expect(entry.style.family.startsWith("TVS ")).toBe(true);
      expect(entry.faces.length).toBeGreaterThan(0);
      for (const face of entry.faces) expect(face.family).toBe(entry.style.family);
    }
    expect(FONT_CATALOG["barlow-condensed"].style).toEqual({ family: "TVS Barlow Condensed", semiBold: 600, bold: 800 });
    expect(FONT_CATALOG.oswald.style.bold).toBe(700);
  });

  it("mọi tệp font có thật, là TrueType, có đủ chữ tiếng Việt; mỗi thư mục có OFL.txt", () => {
    for (const entry of Object.values(FONT_CATALOG)) {
      for (const face of entry.faces) {
        const path = file(face.url);
        expect(existsSync(path), path).toBe(true);
        expect(statSync(path).size).toBeGreaterThan(20_000);
        const bytes = new Uint8Array(readFileSync(path));
        expect([...bytes.subarray(0, 4)], path).toEqual([0, 1, 0, 0]);
        expect(missingCodepoints(bytes, VIETNAMESE + BASIC), `${entry.label} thiếu glyph`).toEqual([]);
        const ofl = join(dirname(path), "OFL.txt");
        expect(existsSync(ofl), ofl).toBe(true);
        expect(readFileSync(ofl, "utf8")).toContain("SIL Open Font License");
      }
    }
  });

  it("frameStyleFor: mặc định Barlow cho chữ, Phudu cho phụ đề, màu thumbnail theo thương hiệu", () => {
    expect(frameStyleFor(VideoOptions.defaults().snapshot())).toEqual({
      textFont: { family: "TVS Barlow Condensed", semiBold: 600, bold: 800 },
      subtitles: { enabled: true, font: { family: "TVS Phudu", semiBold: 600, bold: 800 } },
      intro: { backgroundColor: null, blockColor: null },
    });
    const custom = VideoOptions.defaults().withTextFont("oswald").withSubtitlesEnabled(false).withIntroBlock("#C0392B");
    expect(frameStyleFor(custom.snapshot())).toEqual({
      textFont: { family: "TVS Oswald", semiBold: 600, bold: 700 },
      subtitles: { enabled: false, font: { family: "TVS Phudu", semiBold: 600, bold: 800 } },
      intro: { backgroundColor: null, blockColor: "#c0392b" },
    });
  });

  it("fontFacesFor: chỉ nạp font chữ + font phụ đề khi bật, bỏ trùng", () => {
    const urls = (o: VideoOptions) => fontFacesFor(o.snapshot()).map((f) => f.url);
    expect(urls(VideoOptions.defaults())).toEqual([
      "/templates/theanh28/fonts/BarlowCondensed-SemiBold.ttf",
      "/templates/theanh28/fonts/BarlowCondensed-ExtraBold.ttf",
      "/fonts/phudu/Phudu-Variable.ttf",
    ]);
    expect(urls(VideoOptions.defaults().withSubtitlesEnabled(false))).toEqual([
      "/templates/theanh28/fonts/BarlowCondensed-SemiBold.ttf",
      "/templates/theanh28/fonts/BarlowCondensed-ExtraBold.ttf",
    ]);
    expect(urls(VideoOptions.defaults().withTextFont("phudu"))).toEqual(["/fonts/phudu/Phudu-Variable.ttf"]);
  });
});
```

Run: `npx vitest run tests/templates/fonts/FontCatalog.test.ts`
Expected: FAIL — không tìm thấy `@/templates/fonts/FontCatalog`.

- [ ] **Step 5: Tải font từ kho google/fonts (Git Bash)**

```bash
cd "/d/Brain Hainv/ca-nhan/tools/tin-video-studio"
G=https://raw.githubusercontent.com/google/fonts/main/ofl
mkdir -p public/fonts/phudu public/fonts/be-vietnam-pro public/fonts/oswald public/fonts/montserrat public/fonts/roboto-condensed
curl -fsSL -o public/fonts/phudu/Phudu-Variable.ttf "$G/phudu/Phudu%5Bwght%5D.ttf"
curl -fsSL -o public/fonts/phudu/OFL.txt "$G/phudu/OFL.txt"
curl -fsSL -o public/fonts/be-vietnam-pro/BeVietnamPro-SemiBold.ttf "$G/bevietnampro/BeVietnamPro-SemiBold.ttf"
curl -fsSL -o public/fonts/be-vietnam-pro/BeVietnamPro-ExtraBold.ttf "$G/bevietnampro/BeVietnamPro-ExtraBold.ttf"
curl -fsSL -o public/fonts/be-vietnam-pro/OFL.txt "$G/bevietnampro/OFL.txt"
curl -fsSL -o public/fonts/oswald/Oswald-Variable.ttf "$G/oswald/Oswald%5Bwght%5D.ttf"
curl -fsSL -o public/fonts/oswald/OFL.txt "$G/oswald/OFL.txt"
curl -fsSL -o public/fonts/montserrat/Montserrat-Variable.ttf "$G/montserrat/Montserrat%5Bwght%5D.ttf"
curl -fsSL -o public/fonts/montserrat/OFL.txt "$G/montserrat/OFL.txt"
curl -fsSL -o public/fonts/roboto-condensed/RobotoCondensed-Variable.ttf "$G/robotocondensed/RobotoCondensed%5Bwght%5D.ttf"
curl -fsSL -o public/fonts/roboto-condensed/OFL.txt "$G/robotocondensed/OFL.txt"
ls -l public/fonts/*/
```

Expected: 11 tệp; kích thước gần đúng (kiểm 2026-10-16): Phudu ≈ 129 KB, BeVietnamPro-SemiBold ≈ 137 KB, Oswald ≈ 172 KB, Montserrat ≈ 745 KB, RobotoCondensed ≈ 372 KB. Lệnh `curl -f` lỗi (404) thì DỪNG và báo NEEDS_CONTEXT kèm URL hỏng (không tự tìm nguồn khác).

Kiểm chéo glyph bằng fonttools (máy có fonttools 4.63; chỉ để ghi report, test Node ở Step 4 là chuẩn):

```bash
for f in public/fonts/*/*.ttf; do python -I -c "import sys; from fontTools.ttLib import TTFont; c=TTFont(sys.argv[1]).getBestCmap(); s='ễặữơƯĐ'; print(sys.argv[1], [ch for ch in s if ord(ch) not in c] or 'đủ')" "$f"; done
```

Expected: mỗi dòng in `đủ`.

- [ ] **Step 6: Thêm kiểu font vào `src/templates/VideoTemplate.ts`**

Thêm sau `interface FontFaceSpec`:

```ts
/** Một họ font đã nạp và hai mức đậm dùng trong video. */
export interface FontStyle {
  family: string;
  /** Dòng nguồn tin, tem ngày. */
  semiBold: number;
  /** Tiêu đề, tên kênh, phụ đề. */
  bold: number;
}

/** Tuỳ chọn riêng của video đã quy về dữ liệu vẽ. */
export interface FrameStyle {
  textFont: FontStyle;
  subtitles: { enabled: boolean; font: FontStyle };
  /** Màu riêng của cảnh mở đầu; null = theo màu chủ đạo thương hiệu. */
  intro: { backgroundColor: string | null; blockColor: string | null };
}

export function cssFont(font: FontStyle, weight: "semiBold" | "bold", px: number): string {
  return `${font[weight]} ${px}px "${font.family}", "Arial Narrow", sans-serif`;
}
```

Trong `interface ProjectFrame` thêm (sau `logo`):

```ts
  /** Tuỳ chọn riêng của video. Bỏ trống = như trước khi có tuỳ chọn (font mặc định của phong cách, không phụ đề, màu chủ đạo). */
  style?: FrameStyle;
```

- [ ] **Step 7: Viết `src/templates/fonts/FontCatalog.ts`**

```ts
import { FONT_CHOICES, type FontId } from "@/domain/fontIds";
import type { VideoOptionsSnapshot } from "@/domain/VideoOptions";
import type { FontFaceSpec, FontStyle, FrameStyle } from "../VideoTemplate";

export interface FontEntry {
  id: FontId;
  label: string;
  style: FontStyle;
  faces: readonly FontFaceSpec[];
}

function entry(id: FontId, family: string, semiBold: number, bold: number, faces: ReadonlyArray<[url: string, weight: string]>): FontEntry {
  const label = FONT_CHOICES.find((f) => f.id === id)?.label ?? id;
  return { id, label, style: { family, semiBold, bold }, faces: faces.map(([url, weight]) => ({ family, url, weight })) };
}

/** Font đóng gói trong public/ (giấy phép OFL, xem OFL.txt cạnh từng tệp). Font biến thiên khai một FontFace với dải weight. */
export const FONT_CATALOG: Readonly<Record<FontId, FontEntry>> = {
  phudu: entry("phudu", "TVS Phudu", 600, 800, [["/fonts/phudu/Phudu-Variable.ttf", "300 900"]]),
  "be-vietnam-pro": entry("be-vietnam-pro", "TVS Be Vietnam Pro", 600, 800, [
    ["/fonts/be-vietnam-pro/BeVietnamPro-SemiBold.ttf", "600"],
    ["/fonts/be-vietnam-pro/BeVietnamPro-ExtraBold.ttf", "800"],
  ]),
  oswald: entry("oswald", "TVS Oswald", 600, 700, [["/fonts/oswald/Oswald-Variable.ttf", "200 700"]]),
  montserrat: entry("montserrat", "TVS Montserrat", 600, 800, [["/fonts/montserrat/Montserrat-Variable.ttf", "100 900"]]),
  "roboto-condensed": entry("roboto-condensed", "TVS Roboto Condensed", 600, 800, [
    ["/fonts/roboto-condensed/RobotoCondensed-Variable.ttf", "100 900"],
  ]),
  "barlow-condensed": entry("barlow-condensed", "TVS Barlow Condensed", 600, 800, [
    ["/templates/theanh28/fonts/BarlowCondensed-SemiBold.ttf", "600"],
    ["/templates/theanh28/fonts/BarlowCondensed-ExtraBold.ttf", "800"],
  ]),
};

export function frameStyleFor(options: VideoOptionsSnapshot): FrameStyle {
  return {
    textFont: FONT_CATALOG[options.textFontId].style,
    subtitles: { enabled: options.subtitles.enabled, font: FONT_CATALOG[options.subtitles.fontId].style },
    intro: { backgroundColor: options.intro.backgroundColor ?? null, blockColor: options.intro.blockColor ?? null },
  };
}

/** Chỉ các font cần cho video này: font chữ + font phụ đề (khi bật), bỏ trùng theo URL. */
export function fontFacesFor(options: VideoOptionsSnapshot): FontFaceSpec[] {
  const ids: FontId[] = options.subtitles.enabled ? [options.textFontId, options.subtitles.fontId] : [options.textFontId];
  const seen = new Set<string>();
  const faces: FontFaceSpec[] = [];
  for (const id of ids) {
    for (const face of FONT_CATALOG[id].faces) {
      if (seen.has(face.url)) continue;
      seen.add(face.url);
      faces.push(face);
    }
  }
  return faces;
}
```

Run: `npx vitest run tests/templates/fonts/FontCatalog.test.ts tests/scripts/ttfCmap.test.ts`
Expected: PASS (4 + 3 test).

- [ ] **Step 8: Viết test font chữ theo tuỳ chọn trong template (đỏ)**

Thêm import vào đầu `tests/templates/theanh28/TheAnh28Template.test.ts`:

```ts
import { VideoOptions } from "@/domain/VideoOptions";
import { frameStyleFor } from "@/templates/fonts/FontCatalog";
```

Thêm describe cuối file:

```ts
describe("TheAnh28Template — font chữ theo tuỳ chọn video", () => {
  it("không có style: mọi chữ vẫn là Barlow Condensed như cũ", () => {
    const c = draw(project(), scene({ role: "intro" }));
    expect(c.ops("fillText").every((x) => x.state.font.includes('"TVS Barlow Condensed"'))).toBe(true);
    const body = draw(project(), scene({ role: "body" }));
    expect(body.ops("fillText").every((x) => x.state.font.includes('"TVS Barlow Condensed"'))).toBe(true);
  });

  it("style chọn Oswald: tiêu đề, chip, tem ngày, dòng nguồn đều dùng Oswald với mức đậm của họ font", () => {
    const style = frameStyleFor(VideoOptions.defaults().withTextFont("oswald").withSubtitlesEnabled(false).snapshot());
    const c = draw(project({ style }), scene({ role: "intro" }));
    const fonts = c.ops("fillText").map((x) => x.state.font);
    expect(fonts.every((f) => f.includes('"TVS Oswald"'))).toBe(true);
    expect(fonts.some((f) => f.startsWith("700 64px"))).toBe(true); // tiêu đề: đậm nhất của Oswald là 700
    expect(fonts.some((f) => f.startsWith("600 26px"))).toBe(true); // dòng nguồn, tem ngày
    const body = draw(project({ style }), scene({ role: "body" }));
    expect(body.ops("fillText").every((x) => x.state.font.includes('"TVS Oswald"'))).toBe(true);
  });
});
```

Run: `npx vitest run tests/templates/theanh28/TheAnh28Template.test.ts`
Expected: FAIL ở test "style chọn Oswald" (chữ vẫn Barlow).

- [ ] **Step 9: Viết lại `src/templates/theanh28/TheAnh28Template.ts` (font theo style)**

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
  type ProjectFrame,
  type SceneFrame,
  type TemplateDefaults,
} from "../VideoTemplate";
import { coverRect, kenBurnsRect, LAYOUT, withAlpha, wrapText, type Rect } from "./layout";

export const THEANH28_FONT_FAMILY = "TVS Barlow Condensed";
const DEFAULT_COLOR = "#1F9D55";
const WHITE = "#FFFFFF";
/** Font chữ khi dự án không có tuỳ chọn riêng: giữ đúng hình ảnh trước khi có tuỳ chọn video. */
const DEFAULT_TEXT_FONT: FontStyle = { family: THEANH28_FONT_FAMILY, semiBold: 600, bold: 800 };

type Weight = "semiBold" | "bold";

const upper = (s: string) => s.toLocaleUpperCase("vi");

export class TheAnh28Template extends VideoTemplate {
  readonly id = "theanh28";
  readonly name = "Bản tin kiểu Theanh28";

  readonly brandFields: readonly BrandFieldSpec[] = [
    { key: "channelName", label: "Tên kênh", type: "text", required: true, defaultValue: "TIN NHANH", maxLength: 24 },
    { key: "primaryColor", label: "Màu chủ đạo", type: "color", required: true, defaultValue: DEFAULT_COLOR },
    { key: "logo", label: "Logo", type: "image", required: false },
    { key: "titleFontPx", label: "Cỡ chữ tiêu đề mở đầu (px, 44–80)", type: "number", required: false, defaultValue: "64", min: 44, max: 80 },
  ];

  readonly defaults: TemplateDefaults = {
    width: LAYOUT.frame.width,
    height: LAYOUT.frame.height,
    fps: 30,
    timeline: DEFAULT_TIMELINE_CONFIG,
    fallbackKeyword: "news",
  };

  readonly fonts: readonly FontFaceSpec[] = [
    { family: THEANH28_FONT_FAMILY, url: "/templates/theanh28/fonts/BarlowCondensed-SemiBold.ttf", weight: "600" },
    { family: THEANH28_FONT_FAMILY, url: "/templates/theanh28/fonts/BarlowCondensed-ExtraBold.ttf", weight: "800" },
  ];

  protected drawIntro(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void {
    const color = this.color(project);
    const { width, height } = LAYOUT.frame;
    const L = LAYOUT.intro;

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    if (scene.image) this.drawClipped(ctx, scene.image, L.image, this.progress(scene));

    const gradient = ctx.createLinearGradient(0, L.gradientTop, 0, L.gradientSolid);
    gradient.addColorStop(0, withAlpha(color, 0));
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, L.gradientTop, width, L.gradientSolid - L.gradientTop);
    ctx.fillStyle = color;
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
    const { width, height } = LAYOUT.frame;
    const B = LAYOUT.body;

    if (scene.image) {
      if (scene.backdrop) {
        // nền mờ đã được thu nhỏ sẵn: phóng ra toàn khung bằng nội suy
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(scene.backdrop.source, 0, 0, width, height);
      } else {
        const full = coverRect(scene.image.width, scene.image.height, { x: 0, y: 0, w: width, h: height });
        const backdrop = kenBurnsRect(full, 1, 1, B.backdropScale);
        ctx.filter = `blur(${LAYOUT.blurPx}px)`;
        ctx.drawImage(scene.image.source, backdrop.x, backdrop.y, backdrop.w, backdrop.h);
        ctx.filter = "none";
      }
      ctx.fillStyle = `rgba(0,0,0,${B.backdropShade})`;
      ctx.fillRect(0, 0, width, height);
      this.drawClipped(ctx, scene.image, B.band, this.progress(scene));
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
    const C = LAYOUT.credit;
    // vùng cho phép của dòng nguồn tin: tới mép trái huy hiệu logo (cảnh thân bài) hoặc mép phải khung (cảnh mở đầu)
    const limit =
      (scene.role === "body" ? this.cornerLogoBox(ctx, project).badgeX - C.gapToLogo : LAYOUT.frame.width - C.rightMargin) -
      C.x;
    ctx.font = this.font(project, "semiBold", C.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const measure = (s: string) => ctx.measureText(s).width;
    const lines = project.sourceCredit ? [`THEO: ${upper(project.sourceCredit)}`, "ẢNH: TỔNG HỢP"] : ["ẢNH: TỔNG HỢP"];
    lines.forEach((line, i) => ctx.fillText(wrapText(line, limit, measure, 1)[0] ?? "", C.x, C.y + i * C.lineHeight));
    if (scene.role === "body") this.drawCornerLogo(ctx, project);
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

  private progress(scene: SceneFrame): number {
    return scene.sceneDuration > 0 ? scene.sceneTime / scene.sceneDuration : 0;
  }

  private drawClipped(ctx: Canvas2D, image: DrawableImage, box: Rect, progress: number): void {
    const target = kenBurnsRect(coverRect(image.width, image.height, box), progress);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.drawImage(image.source, target.x, target.y, target.w, target.h);
    ctx.restore();
  }

  private drawDotPattern(ctx: Canvas2D): void {
    const P = LAYOUT.intro.pattern;
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
    const K = LAYOUT.intro.chip;
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
    const D = LAYOUT.dateTag;
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
    const G = LAYOUT.logo;
    const name = this.channelName(project);
    ctx.font = this.font(project, "bold", G.fontPx);
    const textX = LAYOUT.frame.width - G.right - ctx.measureText(name).width;
    return { name, textX, badgeX: textX - G.gap - G.size };
  }

  private drawCornerLogo(ctx: Canvas2D, project: ProjectFrame): void {
    const G = LAYOUT.logo;
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

Run: `npx vitest run tests/templates`
Expected: PASS — mọi test template cũ (chuỗi font `800 64px "TVS Barlow Condensed", …` không đổi) và 2 test mới.

- [ ] **Step 10: Đưa tuỳ chọn vào RenderJob (test đỏ trước)**

Thêm vào `describe("RenderJobBuilder", ...)` trong `tests/client/controllers/RenderJobBuilder.test.ts`:

```ts
  it("job kèm tuỳ chọn video của dự án (dữ liệu thuần, structuredClone được)", async () => {
    const { builder, data } = setup();
    const options = data.options.withSubtitlesEnabled(false).withTextFont("oswald").withIntroBlock("#C0392B");
    const { job } = await builder.build({ ...data, options });
    expect(job.options).toEqual(options.snapshot());
    expect(structuredClone(job.options)).toEqual(options.snapshot());
  });
```

Trong `tests/client/render/RenderPlan.test.ts`, thêm `import { VideoOptions } from "@/domain/VideoOptions";` và thêm trường vào job mẫu (sau `origin`):

```ts
  options: VideoOptions.defaults().snapshot(),
```

Run: `npx vitest run tests/client/controllers/RenderJobBuilder.test.ts`
Expected: FAIL — `expected undefined to deeply equal {...}`.

- [ ] **Step 11: Sửa `src/client/render/RenderJob.ts` và `RenderJobBuilder.ts`**

`RenderJob.ts`: thêm `import type { VideoOptionsSnapshot } from "@/domain/VideoOptions";` và trong `interface RenderJob` (sau `videoBitrate`):

```ts
  /** Tuỳ chọn riêng của video: font chữ, phụ đề, màu thumbnail đầu. */
  options: VideoOptionsSnapshot;
```

`RenderJobBuilder.ts`: dòng destructure đổi thành
`const { project, voice, narrations, footage, music, brand, options } = data;`
và trong literal `job` thêm (sau `origin: this.deps.origin,`):

```ts
      options: options.snapshot(),
```

Run: `npx vitest run tests/client/controllers/RenderJobBuilder.test.ts tests/client/render`
Expected: PASS.

- [ ] **Step 12: Worker nạp đúng font và truyền style — sửa `src/client/render/render.worker.ts`**

Thay khối import đầu file và phần đầu hàm `render` (từ `scope.postMessage({ type: "progress", stage: "loading" });` tới `const brand = ...`) và khối `project:` khi tạo `VideoRenderer`:

```ts
import { BrandKit } from "@/domain/BrandKit";
import { VideoFootage } from "@/domain/Footage";
import { VideoOptions } from "@/domain/VideoOptions";
import { mixProgram } from "@/client/media/AudioMix";
import { loadFonts, type FontSink } from "@/client/media/FontLoader";
import { ImageFrameProvider, VideoFrameProvider } from "@/client/media/MediaFrameProvider";
import { fontFacesFor, frameStyleFor } from "@/templates/fonts/FontCatalog";
import { defaultTemplateRegistry } from "@/templates/registry";
```

(giữ nguyên các import còn lại)

```ts
async function render(job: RenderJob): Promise<void> {
  scope.postMessage({ type: "progress", stage: "loading" });
  if (!scope.fonts) throw new Error("Trình duyệt không hỗ trợ nạp font trong worker");
  const template = defaultTemplateRegistry().get(job.templateId);
  // Khoan dung: job thiếu/sai tuỳ chọn thì dùng mặc định. Chỉ nạp font video này cần.
  const options = VideoOptions.restore(job.options).snapshot();
  await loadFonts(fontFacesFor(options), scope.fonts, job.origin);
  const style = frameStyleFor(options);
  const brand = BrandKit.create(template.id, template.brandFields, job.brandValues);
```

```ts
      project: {
        ...job.project,
        brand,
        logo: logoBitmap ? { source: logoBitmap, width: logoBitmap.width, height: logoBitmap.height } : null,
        style,
      },
```

(Worker không có test Vitest — kiểm bằng e2e ở Task 5/7. `template.fonts` không còn được worker nạp; Barlow nằm trong `FONT_CATALOG` với cùng URL và họ font.)

- [ ] **Step 13: Chạy toàn bộ**

Run: `npx vitest run` rồi `npm run typecheck` rồi `npm run lint`
Expected: tất cả PASS, 0 lỗi, 0 cảnh báo.

- [ ] **Step 14: Commit (điều phối viên)**

```bash
git add public/fonts scripts/lib/ttfCmap.ts src/templates/fonts/FontCatalog.ts src/templates/VideoTemplate.ts src/templates/theanh28/TheAnh28Template.ts src/client/render/RenderJob.ts src/client/controllers/RenderJobBuilder.ts src/client/render/render.worker.ts tests/scripts/ttfCmap.test.ts tests/templates/fonts/FontCatalog.test.ts tests/templates/theanh28/TheAnh28Template.test.ts tests/client/controllers/RenderJobBuilder.test.ts tests/client/render/RenderPlan.test.ts
git commit -m "feat(tuy-chon): FontCatalog 6 font tiếng Việt, worker chỉ nạp font đang chọn, chữ theo tuỳ chọn"
```

---

### Task 3: Màu thumbnail đầu (nền + khối sau tiêu đề)

**Files:**
- Modify: `src/templates/theanh28/TheAnh28Template.ts` (hàm `drawIntro`)
- Test: `tests/templates/theanh28/TheAnh28Template.test.ts` (thêm describe)

**Interfaces:**
- Consumes (Task 2): `ProjectFrame.style?: FrameStyle` với `intro: { backgroundColor: string | null; blockColor: string | null }`; `frameStyleFor` (`src/templates/fonts/FontCatalog.ts`); `VideoOptions.withIntroBackground/withIntroBlock` (Task 1).
- Produces: cảnh mở đầu dùng `style.intro.backgroundColor ?? primaryColor` cho nền toàn khung và `style.intro.blockColor ?? primaryColor` cho dải chuyển màu + khối đặc sau tiêu đề. Chip và huy hiệu vẫn `primaryColor`.

- [ ] **Step 1: Viết test (đỏ)**

Thêm import vào đầu file test (nếu chưa có): `import { LAYOUT } from "@/templates/theanh28/layout";` (các import `VideoOptions`, `frameStyleFor` đã thêm ở Task 2). Thêm describe cuối file:

```ts
describe("TheAnh28Template — màu thumbnail đầu", () => {
  const introStyle = (bg: string | null, block: string | null) =>
    frameStyleFor(VideoOptions.defaults().withSubtitlesEnabled(false).withIntroBackground(bg).withIntroBlock(block).snapshot());
  const fills = (c: RecordingCanvas) => c.ops("fillRect");
  const solidBlock = (c: RecordingCanvas) => fills(c).find((x) => x.args[1] === LAYOUT.intro.gradientSolid);
  const gradientStops = (c: RecordingCanvas) =>
    (fills(c).find((x) => x.args[1] === LAYOUT.intro.gradientTop)?.state.fillStyle as { stops: [number, string][] }).stops;

  it("không đặt màu: nền, dải chuyển, khối đều theo màu chủ đạo (như cũ)", () => {
    const c = draw(project(), scene({ role: "intro" }));
    expect(fills(c)[0]?.state.fillStyle).toBe("#1F9D55");
    expect(fills(c)[0]?.args).toEqual([0, 0, 1080, 1920]);
    expect(solidBlock(c)?.state.fillStyle).toBe("#1F9D55");
    expect(gradientStops(c)).toEqual([
      [0, "rgba(31,157,85,0)"],
      [1, "#1F9D55"],
    ]);
  });

  it("đặt cả hai màu: nền dùng màu nền, dải chuyển và khối sau tiêu đề dùng màu khối; chip vẫn màu chủ đạo", () => {
    const c = draw(project({ style: introStyle("#112233", "#445566") }), scene({ role: "intro" }));
    expect(fills(c)[0]?.state.fillStyle).toBe("#112233");
    expect(solidBlock(c)?.state.fillStyle).toBe("#445566");
    expect(gradientStops(c)).toEqual([
      [0, "rgba(68,85,102,0)"],
      [1, "#445566"],
    ]);
    expect(c.ops("fill").some((x) => x.state.fillStyle === "#1F9D55")).toBe(true); // chip tên kênh
  });

  it("chỉ đặt màu nền: khối sau tiêu đề vẫn theo màu chủ đạo", () => {
    const c = draw(project({ style: introStyle("#112233", null) }), scene({ role: "intro" }));
    expect(fills(c)[0]?.state.fillStyle).toBe("#112233");
    expect(solidBlock(c)?.state.fillStyle).toBe("#1F9D55");
  });

  it("cảnh thân bài không đổi theo màu thumbnail", () => {
    const plain = draw(project(), scene({ role: "body", image: null }));
    const styled = draw(project({ style: introStyle("#112233", "#445566") }), scene({ role: "body", image: null }));
    const stops = (c: RecordingCanvas) => (fills(c)[0]?.state.fillStyle as { stops: [number, string][] }).stops;
    expect(stops(styled)).toEqual(stops(plain));
  });
});
```

Run: `npx vitest run tests/templates/theanh28/TheAnh28Template.test.ts`
Expected: FAIL ở 2 test "đặt cả hai màu" và "chỉ đặt màu nền" (`expected '#1F9D55' to be '#112233'`).

- [ ] **Step 2: Sửa `drawIntro` trong `src/templates/theanh28/TheAnh28Template.ts`**

Thay phần đầu `drawIntro` (từ `const color = this.color(project);` tới `ctx.fillRect(0, L.gradientSolid, width, height - L.gradientSolid);`) bằng:

```ts
    const color = this.color(project);
    // Màu riêng của thumbnail đầu (tuỳ chọn video); không đặt thì theo màu chủ đạo thương hiệu.
    const background = project.style?.intro.backgroundColor ?? color;
    const block = project.style?.intro.blockColor ?? color;
    const { width, height } = LAYOUT.frame;
    const L = LAYOUT.intro;

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
```

- [ ] **Step 3: Chạy, thấy xanh; chạy toàn bộ**

Run: `npx vitest run tests/templates/theanh28/TheAnh28Template.test.ts` → PASS.
Run: `npx vitest run` rồi `npm run typecheck` rồi `npm run lint` → sạch.

- [ ] **Step 4: Commit (điều phối viên)**

```bash
git add src/templates/theanh28/TheAnh28Template.ts tests/templates/theanh28/TheAnh28Template.test.ts
git commit -m "feat(tuy-chon): màu nền và màu khối của thumbnail đầu"
```

---

### Task 4: Phụ đề cháy cứng (thuật toán chia đoạn + vẽ + thời gian giọng đọc)

**Files:**
- Create: `src/templates/theanh28/subtitles.ts`
- Modify: `src/templates/Canvas2D.ts` (thêm `strokeText`, `lineJoin`, `shadowColor`, `shadowBlur`, `shadowOffsetY`)
- Modify: `tests/helpers/RecordingCanvas.ts` (hỗ trợ các thành phần trên)
- Modify: `src/templates/VideoTemplate.ts` (`SceneFrame.voiceStart?`, `voiceDuration?`)
- Modify: `src/templates/theanh28/layout.ts` (`LAYOUT.subtitle`)
- Modify: `src/templates/theanh28/TheAnh28Template.ts` (import, `drawOverlay`, `drawSubtitle`, `cues`)
- Modify: `src/client/render/VideoRenderer.ts` (truyền mốc giọng đọc)
- Test: `tests/templates/theanh28/subtitles.test.ts` (mới), `tests/templates/theanh28/TheAnh28Template.test.ts`, `tests/templates/theanh28/layout.test.ts`, `tests/client/render/VideoRenderer.test.ts`

**Interfaces:**
- Consumes (Task 2): `FrameStyle.subtitles: { enabled: boolean; font: FontStyle }`, `cssFont`, `frameStyleFor`; `wrapText` (`src/templates/theanh28/layout.ts`); `SceneSlot.voiceStart/voiceEnd/start` (`src/domain/Timeline.ts`).
- Produces:
  - `src/templates/theanh28/subtitles.ts`: `interface SubtitleCue { lines: string[]; start: number; end: number }`, `splitSubtitle(text: string, maxWidth: number, measure: (s: string) => number, maxLines?: number): string[][]`, `timeCues(chunks: readonly string[][], voiceStart: number, voiceDuration: number): SubtitleCue[]`, `cueAt(cues: readonly SubtitleCue[], t: number): SubtitleCue | null`.
  - `SceneFrame.voiceStart?: number` (giây tính từ đầu cảnh), `SceneFrame.voiceDuration?: number`.
  - `LAYOUT.subtitle = { centerX: 540, maxWidth: 820, fontPx: 54, lineHeight: 68, maxLines: 2, bodyBottom: 1600, introBottom: 990, strokePx: 10, shadowBlurPx: 6, shadowOffsetPx: 3 }`.

- [ ] **Step 1: Viết test thuật toán `tests/templates/theanh28/subtitles.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { cueAt, splitSubtitle, timeCues } from "@/templates/theanh28/subtitles";

const measure = (s: string) => s.length * 10; // 10 px/ký tự
const TEXT = "aaa bbb cc ddd eee fff ggg hhh iiii jjjj kkkk lll";

describe("splitSubtitle", () => {
  it("ngắt dòng theo độ rộng đo được, gom mỗi đoạn ≤ 2 dòng", () => {
    expect(splitSubtitle(TEXT, 100, measure)).toEqual([
      ["aaa bbb cc", "ddd eee"],
      ["fff ggg", "hhh iiii"],
      ["jjjj kkkk", "lll"],
    ]);
  });

  it("câu ngắn là một đoạn một dòng; chuỗi trống không có đoạn nào", () => {
    expect(splitSubtitle("Câu tin.", 100, measure)).toEqual([["Câu tin."]]);
    expect(splitSubtitle("   ", 100, measure)).toEqual([]);
  });

  it("maxLines = 1 thì mỗi dòng là một đoạn", () => {
    expect(splitSubtitle("aaa bbb cc ddd eee", 100, measure, 1)).toEqual([["aaa bbb cc"], ["ddd eee"]]);
  });
});

describe("timeCues / cueAt", () => {
  const cues = timeCues(splitSubtitle(TEXT, 100, measure), 0.3, 4.7);

  it("chia thời lượng giọng đọc theo tỉ lệ số ký tự của từng đoạn", () => {
    // ký tự: 18, 16, 13 (tổng 47) trên 4,7 s ⇒ 0,1 s/ký tự
    expect(cues.map((c) => c.start)).toEqual([0.3, expect.closeTo(2.1, 9), expect.closeTo(3.7, 9)]);
    expect(cues.map((c) => c.end)).toEqual([expect.closeTo(2.1, 9), expect.closeTo(3.7, 9), expect.closeTo(5.0, 9)]);
  });

  it("trước giọng đọc hiện đoạn đầu, sau giọng đọc giữ đoạn cuối", () => {
    expect(cueAt(cues, 0)?.lines).toEqual(["aaa bbb cc", "ddd eee"]);
    expect(cueAt(cues, 2.0)?.lines).toEqual(["aaa bbb cc", "ddd eee"]);
    expect(cueAt(cues, 2.15)?.lines).toEqual(["fff ggg", "hhh iiii"]);
    expect(cueAt(cues, 4.9)?.lines).toEqual(["jjjj kkkk", "lll"]);
    expect(cueAt(cues, 5.6)?.lines).toEqual(["jjjj kkkk", "lll"]);
  });

  it("không có đoạn nào thì không có phụ đề", () => {
    expect(cueAt([], 1)).toBeNull();
  });
});
```

Run: `npx vitest run tests/templates/theanh28/subtitles.test.ts`
Expected: FAIL — không tìm thấy `@/templates/theanh28/subtitles`.

- [ ] **Step 2: Viết `src/templates/theanh28/subtitles.ts`**

```ts
import { wrapText } from "./layout";

export interface SubtitleCue {
  lines: string[];
  /** Giây tính từ đầu cảnh. */
  start: number;
  end: number;
}

/** Chia câu thành các đoạn ≤ `maxLines` dòng, mỗi dòng không quá `maxWidth` (đo bằng chữ thật). */
export function splitSubtitle(text: string, maxWidth: number, measure: (s: string) => number, maxLines = 2): string[][] {
  const lines = wrapText(text, maxWidth, measure, Number.POSITIVE_INFINITY);
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLines) chunks.push(lines.slice(i, i + maxLines));
  return chunks;
}

/** Mốc từng đoạn theo tỉ lệ số ký tự trên thời lượng giọng đọc (không có mốc từng từ). */
export function timeCues(chunks: readonly string[][], voiceStart: number, voiceDuration: number): SubtitleCue[] {
  const weights = chunks.map((lines) => Math.max(1, lines.join(" ").length));
  const total = weights.reduce((a, b) => a + b, 0);
  let before = 0;
  return chunks.map((lines, i) => {
    const start = voiceStart + (voiceDuration * before) / total;
    before += weights[i] as number;
    return { lines: [...lines], start, end: voiceStart + (voiceDuration * before) / total };
  });
}

/** Đoạn hiện ở giây `t` của cảnh: trước giọng đọc hiện đoạn đầu, sau giọng đọc giữ đoạn cuối. */
export function cueAt(cues: readonly SubtitleCue[], t: number): SubtitleCue | null {
  let current: SubtitleCue | null = cues[0] ?? null;
  for (const cue of cues) {
    if (t < cue.start) break;
    current = cue;
  }
  return current;
}
```

Run: `npx vitest run tests/templates/theanh28/subtitles.test.ts`
Expected: PASS (6 test).

- [ ] **Step 3: Viết test bố cục, vẽ phụ đề và mốc giọng (đỏ)**

Thêm vào `tests/templates/theanh28/layout.test.ts` (trong file, import `LAYOUT` đã có; nếu chưa có thì thêm `import { LAYOUT } from "@/templates/theanh28/layout";`):

```ts
describe("LAYOUT.subtitle", () => {
  it("phụ đề nằm trong vùng an toàn TikTok, không đè dải ảnh, tem ngày, chip, tiêu đề, dòng nguồn", () => {
    const S = LAYOUT.subtitle;
    const bodyTop = S.bodyBottom - S.maxLines * S.lineHeight;
    expect(bodyTop).toBeGreaterThan(LAYOUT.body.band.y + LAYOUT.body.band.h);
    expect(bodyTop).toBeGreaterThan(LAYOUT.body.dateTag.y + LAYOUT.dateTag.h);
    expect(S.bodyBottom).toBeLessThanOrEqual(1600);
    const introTop = S.introBottom - S.maxLines * S.lineHeight;
    expect(S.introBottom).toBeLessThan(LAYOUT.intro.chip.y);
    expect(S.introBottom).toBeLessThan(LAYOUT.intro.title.y);
    expect(introTop).toBeGreaterThan(LAYOUT.credit.y + 2 * LAYOUT.credit.lineHeight);
    expect(S.centerX - S.maxWidth / 2).toBeGreaterThanOrEqual(120);
    expect(S.centerX + S.maxWidth / 2).toBeLessThanOrEqual(960);
  });
});
```

Thêm describe cuối `tests/templates/theanh28/TheAnh28Template.test.ts` (import `LAYOUT` đã thêm ở Task 3):

```ts
describe("TheAnh28Template — phụ đề", () => {
  const subtitleStyle = (enabled = true) => frameStyleFor(VideoOptions.defaults().withSubtitlesEnabled(enabled).snapshot());
  const subtitleTexts = (c: RecordingCanvas) => c.ops("fillText").filter((x) => x.state.font.includes('"TVS Phudu"'));
  const S = LAYOUT.subtitle;

  it("bật: câu ngắn vẽ giữa khung, đáy vùng phụ đề cảnh thân bài, viền đen trước rồi chữ trắng", () => {
    const c = draw(project({ style: subtitleStyle() }), scene({ text: "Câu tin." }));
    const fills = subtitleTexts(c);
    expect(fills.map((x) => x.args)).toEqual([["Câu tin.", 540, S.bodyBottom - S.lineHeight]]);
    expect(fills[0]?.state.font.startsWith("800 54px")).toBe(true);
    expect(fills[0]?.state.fillStyle).toBe("#FFFFFF");
    expect(c.ops("strokeText").map((x) => x.args)).toEqual([["Câu tin.", 540, S.bodyBottom - S.lineHeight]]);
    const strokeAt = c.calls.findIndex((x) => x.op === "strokeText");
    const fillAt = c.calls.findIndex((x) => x.op === "fillText" && x.args[0] === "Câu tin.");
    expect(strokeAt).toBeLessThan(fillAt);
  });

  it("tắt phụ đề hoặc không có style: không vẽ phụ đề", () => {
    for (const p of [project({ style: subtitleStyle(false) }), project()]) {
      const c = draw(p, scene({ text: "Câu tin." }));
      expect(c.ops("strokeText")).toHaveLength(0);
      expect(c.texts()).not.toContain("Câu tin.");
    }
  });

  it("cảnh mở đầu: phụ đề nằm trên chip tên kênh, không đè tiêu đề", () => {
    const c = draw(project({ style: subtitleStyle() }), scene({ role: "intro", text: "Tiêu đề ngắn." }));
    const y = subtitleTexts(c)[0]?.args[2] as number;
    expect(y).toBe(S.introBottom - S.lineHeight);
    expect(y + S.lineHeight).toBeLessThan(LAYOUT.intro.chip.y);
  });

  it("câu dài: chia đoạn ≤ 2 dòng và đổi đoạn theo thời gian giọng đọc (thuần theo sceneTime)", () => {
    const text = Array.from({ length: 24 }, (_, i) => `tu${String(i).padStart(2, "0")}`).join(" ");
    const at = (sceneTime: number) =>
      subtitleTexts(
        draw(project({ style: subtitleStyle() }), scene({ text, sceneTime, sceneDuration: 4.35, voiceStart: 0, voiceDuration: 4 })),
      ).map((x) => [String(x.args[0]), x.args[2]]);
    expect(at(0)).toEqual([
      ["tu00 tu01 tu02 tu03 tu04 tu05", S.bodyBottom - 2 * S.lineHeight],
      ["tu06 tu07 tu08 tu09 tu10 tu11", S.bodyBottom - S.lineHeight],
    ]);
    expect(at(2.5).map(([line]) => line)).toEqual(["tu12 tu13 tu14 tu15 tu16 tu17", "tu18 tu19 tu20 tu21 tu22 tu23"]);
    expect(at(4.3)).toEqual(at(2.5));
    expect(at(0)).toEqual(at(0)); // cùng đầu vào ra cùng hình (cache không đổi kết quả)
  });
});
```

Thêm vào test "dựng đủ khung, đúng mốc thời gian và đúng cảnh" trong `tests/client/render/VideoRenderer.test.ts` (sau dòng `expect(template.frames[14]?.sceneDuration)…`):

```ts
    expect(template.frames[0]?.voiceStart).toBeCloseTo(0.3, 9);
    expect(template.frames[0]?.voiceDuration).toBeCloseTo(0.7, 9);
    expect(template.frames[14]?.voiceStart).toBeCloseTo(0, 9);
    expect(template.frames[14]?.voiceDuration).toBeCloseTo(0.5, 9);
```

Run: `npx vitest run tests/templates tests/client/render/VideoRenderer.test.ts`
Expected: FAIL — `LAYOUT.subtitle` undefined; `voiceStart` không có trong `SceneFrame` (typecheck) và `expected undefined to be close to 0.3`; không có phụ đề.

- [ ] **Step 4: Mở rộng `Canvas2D` và `RecordingCanvas`**

`src/templates/Canvas2D.ts` — thêm vào danh sách `Pick` (sau `"lineWidth"`):

```ts
  | "strokeText"
  | "lineJoin"
  | "shadowColor"
  | "shadowBlur"
  | "shadowOffsetY"
```

`tests/helpers/RecordingCanvas.ts` — thêm thuộc tính (sau `lineWidth = 1;`):

```ts
  lineJoin: CanvasLineJoin = "miter";
  shadowColor = "rgba(0, 0, 0, 0)";
  shadowBlur = 0;
  shadowOffsetY = 0;
```

và phương thức (sau `fillText`):

```ts
  strokeText(...args: unknown[]): void { this.record("strokeText", args); }
```

- [ ] **Step 5: Thêm mốc giọng vào `SceneFrame` và `VideoRenderer`**

`src/templates/VideoTemplate.ts`, trong `interface SceneFrame` (sau `sceneDuration`):

```ts
  /** Giây (tính từ đầu cảnh) giọng đọc bắt đầu; bỏ trống = 0. */
  voiceStart?: number;
  /** Độ dài giọng đọc của cảnh; bỏ trống = cả cảnh. */
  voiceDuration?: number;
```

`src/client/render/VideoRenderer.ts`, trong lời gọi `template.drawFrame(ctx, project, { ... })` thêm sau `sceneDuration: slot.end - slot.start,`:

```ts
          voiceStart: slot.voiceStart - slot.start,
          voiceDuration: slot.voiceEnd - slot.voiceStart,
```

- [ ] **Step 6: Thêm `LAYOUT.subtitle` vào `src/templates/theanh28/layout.ts`**

Trong object `LAYOUT`, thêm sau dòng `dateTag: { h: 44, padX: 16, fontPx: 26 },`:

```ts
  /** Phụ đề: căn giữa, rộng tối đa 820 (tránh cột nút TikTok bên phải), đáy ở vùng an toàn dưới (≤ 1600). Mở đầu: ngay trên chip. */
  subtitle: {
    centerX: 540,
    maxWidth: 820,
    fontPx: 54,
    lineHeight: 68,
    maxLines: 2,
    bodyBottom: 1600,
    introBottom: 990,
    strokePx: 10,
    shadowBlurPx: 6,
    shadowOffsetPx: 3,
  },
```

- [ ] **Step 7: Vẽ phụ đề trong `src/templates/theanh28/TheAnh28Template.ts`**

Sửa import:

```ts
import {
  cssFont,
  VideoTemplate,
  type DrawableImage,
  type FontFaceSpec,
  type FontStyle,
  type FrameStyle,
  type ProjectFrame,
  type SceneFrame,
  type TemplateDefaults,
} from "../VideoTemplate";
import { coverRect, kenBurnsRect, LAYOUT, withAlpha, wrapText, type Rect } from "./layout";
import { cueAt, splitSubtitle, timeCues, type SubtitleCue } from "./subtitles";
```

Thêm thuộc tính lớp (sau `readonly fonts …`):

```ts
  /** Đoạn phụ đề đã chia, theo (font, mốc giọng, câu). Chỉ là bộ nhớ đệm: kết quả chỉ phụ thuộc đầu vào nên hàm vẽ vẫn thuần. */
  private readonly cueCache = new Map<string, SubtitleCue[]>();
```

Trong `drawOverlay`, thay dòng cuối `if (scene.role === "body") this.drawCornerLogo(ctx, project);` bằng:

```ts
    if (scene.role === "body") this.drawCornerLogo(ctx, project);
    if (project.style?.subtitles.enabled) this.drawSubtitle(ctx, project.style, scene);
```

Thêm hai phương thức private (sau `drawOverlay`):

```ts
  private drawSubtitle(ctx: Canvas2D, style: FrameStyle, scene: SceneFrame): void {
    const S = LAYOUT.subtitle;
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
      const S = LAYOUT.subtitle;
      cues = timeCues(splitSubtitle(text, S.maxWidth, (s) => ctx.measureText(s).width, S.maxLines), voiceStart, voiceDuration);
      this.cueCache.set(key, cues);
    }
    return cues;
  }
```

(`FontStyle` vẫn dùng cho `DEFAULT_TEXT_FONT`.)

- [ ] **Step 8: Chạy, thấy xanh; chạy toàn bộ**

Run: `npx vitest run tests/templates tests/client/render tests/helpers`
Expected: PASS.
Run: `npx vitest run` rồi `npm run typecheck` rồi `npm run lint` → sạch.

- [ ] **Step 9: Commit (điều phối viên)**

```bash
git add src/templates/theanh28/subtitles.ts src/templates/Canvas2D.ts src/templates/VideoTemplate.ts src/templates/theanh28/layout.ts src/templates/theanh28/TheAnh28Template.ts src/client/render/VideoRenderer.ts tests/helpers/RecordingCanvas.ts tests/templates/theanh28/subtitles.test.ts tests/templates/theanh28/TheAnh28Template.test.ts tests/templates/theanh28/layout.test.ts tests/client/render/VideoRenderer.test.ts
git commit -m "feat(tuy-chon): phụ đề cháy cứng chia đoạn theo thời gian giọng đọc"
```

---

### Task 5: Thanh bên "Tuỳ chọn video" (view) ở mọi bước

**Files:**
- Create: `src/views/studio/components/OptionsSidebar.tsx`
- Modify: `src/views/studio/StudioShell.tsx` (bố cục)
- Modify: `src/app/studio/page.tsx:22` (`max-w-4xl` → `max-w-6xl`)
- Modify: `e2e/helpers.ts` (`DraftState`, `READ_DRAFT_SCRIPT`)
- Modify: `e2e/02-toan-luong.spec.ts:11` (chọn combobox theo tên)
- Create: `e2e/04-tuy-chon-video.spec.ts`

**Interfaces:**
- Consumes (Task 1): `studio.options` (`OptionsController`: `fontChoices`, `setSubtitlesEnabled`, `setSubtitleFont`, `setTextFont`, `setIntroBackground`, `setIntroBlock`, `resetIntroColors`, `setFootageKind`, `introColors()`, state `{ error }`), `studio.session.state.options` (`VideoOptions` getters); hook `useController`.
- Produces: vùng `<aside aria-label="Tuỳ chọn video">` (role `complementary`) với: checkbox "Hiện phụ đề"; select id `tvs-font-phu-de` nhãn "Font phụ đề"; select id `tvs-font-chu` nhãn "Font chữ tiêu đề và nhãn"; input màu id `tvs-mau-nen` nhãn "Màu nền thumbnail"; id `tvs-mau-khoi` nhãn "Màu khối sau tiêu đề"; nút "Về mặc định"; radio `name="footage-kind"` nhãn "Cả ảnh và video" / "Ưu tiên ảnh" / "Ưu tiên video"; màn < 1024 px có nút "Tuỳ chọn video" (`aria-expanded`) mở/đóng nội dung. `DraftState` thêm `subtitleFontId`, `textFontId`, `sceneKindCount`.

- [ ] **Step 1: Viết `src/views/studio/components/OptionsSidebar.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { useController } from "@/views/hooks/useController";

const FOOTAGE_KINDS = [
  { id: "any", label: "Cả ảnh và video" },
  { id: "image", label: "Ưu tiên ảnh" },
  { id: "video", label: "Ưu tiên video" },
] as const;

const SELECT = "rounded-md bg-neutral-800 px-3 py-2 disabled:opacity-50";

export function OptionsSidebar({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const panel = useController(studio.options);
  const [open, setOpen] = useState(false);
  const options = data.options;
  const colors = studio.options.introColors();
  const fonts = studio.options.fontChoices;

  return (
    <aside aria-label="Tuỳ chọn video" className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="tvs-tuy-chon-video"
        className="rounded-md bg-neutral-800 px-4 py-2 text-left font-medium lg:hidden"
        onClick={() => setOpen(!open)}
      >
        Tuỳ chọn video {open ? "▲" : "▼"}
      </button>
      <div
        id="tvs-tuy-chon-video"
        className={`${open ? "flex" : "hidden"} flex-col gap-5 rounded-lg border border-neutral-800 p-4 text-sm lg:flex`}
      >
        <h2 className="hidden text-base font-semibold lg:block">Tuỳ chọn video</h2>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Phụ đề</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.subtitlesEnabled}
              onChange={(e) => studio.options.setSubtitlesEnabled(e.target.checked)}
            />
            Hiện phụ đề
          </label>
          <label htmlFor="tvs-font-phu-de" className="text-neutral-400">
            Font phụ đề
          </label>
          <select
            id="tvs-font-phu-de"
            className={SELECT}
            disabled={!options.subtitlesEnabled}
            value={options.subtitleFontId}
            onChange={(e) => studio.options.setSubtitleFont(e.target.value)}
          >
            {fonts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Font chữ tiêu đề và nhãn</legend>
          <label htmlFor="tvs-font-chu" className="sr-only">
            Font chữ tiêu đề và nhãn
          </label>
          <select
            id="tvs-font-chu"
            className={SELECT}
            value={options.textFontId}
            onChange={(e) => studio.options.setTextFont(e.target.value)}
          >
            {fonts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500">Tiêu đề mở đầu, tên kênh, dòng nguồn, tem ngày.</p>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Thumbnail đầu</legend>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="tvs-mau-nen">Màu nền thumbnail</label>
            <input
              id="tvs-mau-nen"
              type="color"
              className="h-8 w-12 cursor-pointer rounded bg-transparent"
              value={colors.backgroundColor}
              onChange={(e) => studio.options.setIntroBackground(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="tvs-mau-khoi">Màu khối sau tiêu đề</label>
            <input
              id="tvs-mau-khoi"
              type="color"
              className="h-8 w-12 cursor-pointer rounded bg-transparent"
              value={colors.blockColor}
              onChange={(e) => studio.options.setIntroBlock(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={!colors.custom}
            className="self-start rounded-md bg-neutral-800 px-3 py-1.5 disabled:opacity-40"
            onClick={() => studio.options.resetIntroColors()}
          >
            Về mặc định
          </button>
          <p className="text-xs text-neutral-500">Mặc định theo màu chủ đạo của thương hiệu.</p>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Ảnh/Video khi tự tìm</legend>
          {FOOTAGE_KINDS.map((k) => (
            <label key={k.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="footage-kind"
                value={k.id}
                checked={options.footageKind === k.id}
                onChange={() => studio.options.setFootageKind(k.id)}
              />
              {k.label}
            </label>
          ))}
        </fieldset>

        {panel.error && (
          <p role="alert" className="text-red-400">
            {panel.error}
          </p>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Bố cục 2 cột trong `src/views/studio/StudioShell.tsx`**

Thêm import `import { OptionsSidebar } from "./components/OptionsSidebar";`. Thay khối `return (...)` bằng (giữ nguyên toàn bộ nội dung bên trong cột phải như hiện tại):

```tsx
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <OptionsSidebar studio={studio} />
      <div className="flex min-w-0 flex-col gap-6">
        {wizard.resume && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-800 p-4 text-sm">
            <span>
              Có bản nháp “{wizard.resume.title}” lưu lúc {new Date(wizard.resume.savedAt).toLocaleString("vi-VN")}.
            </span>
            <button type="button" className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium" onClick={() => void studio.wizard.resume()}>
              Mở lại
            </button>
            <button type="button" className="rounded-md bg-neutral-700 px-3 py-1.5" onClick={() => void studio.wizard.discard()}>
              Bỏ bản nháp
            </button>
          </div>
        )}
        <Stepper current={wizard.step} data={data} onSelect={(id) => studio.wizard.goTo(id)} />
        {wizard.error && (
          <p role="alert" className="text-red-400">
            {wizard.error}
          </p>
        )}
        <section>{renderStep(wizard.step, studio)}</section>
        <nav className="flex flex-wrap items-center gap-3 border-t border-neutral-800 pt-4">
          <button
            type="button"
            disabled={index === 0}
            className="rounded-md bg-neutral-800 px-4 py-2 disabled:opacity-40"
            onClick={() => studio.wizard.back()}
          >
            Quay lại
          </button>
          {nextStep && (
            <button
              type="button"
              disabled={!nextEnabled}
              className="rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-40"
              onClick={() => studio.wizard.next()}
            >
              Tiếp tục: {nextStep.label}
            </button>
          )}
          {nextStep && !nextEnabled && BLOCKED_HINT[wizard.step] && (
            <span className="text-sm text-neutral-400">{BLOCKED_HINT[wizard.step]}</span>
          )}
          <button
            type="button"
            className="ml-auto rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300"
            onClick={() => {
              if (window.confirm("Bắt đầu dự án mới? Dự án hiện tại, giọng đã tạo và file tải lên sẽ bị xoá.")) {
                void studio.wizard.newProject();
              }
            }}
          >
            Dự án mới
          </button>
        </nav>
      </div>
    </div>
  );
```

`src/app/studio/page.tsx`: `<main className="mx-auto max-w-4xl p-6">` → `<main className="mx-auto max-w-6xl p-6">`.

- [ ] **Step 3: Kiểm tĩnh**

Run: `npm run typecheck` rồi `npm run lint` rồi `npx vitest run`
Expected: sạch (view không có test Vitest; kiểm bằng e2e ở bước sau).

- [ ] **Step 4: Sửa e2e có sẵn và helper**

`e2e/02-toan-luong.spec.ts` dòng 11 (combobox đầu tiên giờ là "Font phụ đề" ở thanh bên):

```ts
  await expect(page.getByRole("combobox", { name: "Giọng" })).toContainText("Fake");
```

`e2e/helpers.ts` — thay `interface DraftState` và `READ_DRAFT_SCRIPT`:

```ts
export interface DraftState {
  /** 1 nếu có bản nháp, 0 nếu không, -1 nếu không đọc được IndexedDB. */
  count: number;
  savedAt: string | null;
  narrations: number;
  /** Tuỳ chọn video trong bản nháp (null nếu không có). */
  subtitleFontId: string | null;
  textFontId: string | null;
  sceneKindCount: number;
}

// Phản chiếu src/client/storage/IdbKeyValueStore.ts: DB "tin-video-studio" v1, store "kv".
const READ_DRAFT_SCRIPT = () =>
  new Promise<{
    count: number;
    savedAt: string | null;
    narrations: number;
    subtitleFontId: string | null;
    textFontId: string | null;
    sceneKindCount: number;
  }>((resolve) => {
    const none = { savedAt: null, narrations: 0, subtitleFontId: null, textFontId: null, sceneKindCount: 0 };
    const unreadable = { count: -1, ...none };
    const r = indexedDB.open("tin-video-studio", 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("kv")) r.result.createObjectStore("kv");
    };
    r.onerror = () => resolve(unreadable);
    r.onblocked = () => resolve(unreadable);
    r.onsuccess = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("kv")) {
        db.close();
        resolve(unreadable);
        return;
      }
      try {
        const g = db.transaction("kv", "readonly").objectStore("kv").get("draft");
        g.onsuccess = () => {
          const d = g.result as
            | {
                savedAt?: string;
                narrations?: unknown[];
                options?: { subtitles?: { fontId?: string }; textFontId?: string; sceneFootageKinds?: Record<string, string> };
              }
            | undefined;
          db.close();
          resolve(
            d
              ? {
                  count: 1,
                  savedAt: d.savedAt ?? null,
                  narrations: d.narrations?.length ?? 0,
                  subtitleFontId: d.options?.subtitles?.fontId ?? null,
                  textFontId: d.options?.textFontId ?? null,
                  sceneKindCount: Object.keys(d.options?.sceneFootageKinds ?? {}).length,
                }
              : { count: 0, ...none },
          );
        };
        g.onerror = () => {
          db.close();
          resolve(unreadable);
        };
      } catch {
        db.close();
        resolve(unreadable);
      }
    };
  });
```

- [ ] **Step 5: Viết `e2e/04-tuy-chon-video.spec.ts`**

```ts
import { expect, test, type Page } from "@playwright/test";
import { discardDraftIfOffered, expectDraftSaved, fillSampleAndSplit, goNext, login, stepButton } from "./helpers";

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
```

(Ghi chú: sau "Mở lại", bước đầu chưa xong là bước 2 "Chọn giọng" vì chưa tạo giọng — `firstIncompleteStep`.)

- [ ] **Step 6: Chạy e2e**

Run: `npm run test:e2e`
Expected: 10 test (8 cũ + 2 mới) PASS. Test mới đỏ hay treo thì không nới timeout; báo lại với ảnh chụp trong `test-results/`.

- [ ] **Step 7: Commit (điều phối viên)**

```bash
git add src/views/studio/components/OptionsSidebar.tsx src/views/studio/StudioShell.tsx src/app/studio/page.tsx e2e/helpers.ts e2e/02-toan-luong.spec.ts e2e/04-tuy-chon-video.spec.ts
git commit -m "feat(tuy-chon): thanh bên Tuỳ chọn video ở mọi bước, ngăn kéo trên màn hẹp"
```

---

### Task 6: Nút "Ảnh | Video" từng cảnh + ưu tiên ảnh/video khi tự điền

**Files:**
- Modify: `src/client/controllers/FootageSearchController.ts` (import, `search`, `fillScene`, `query`, thêm `setSceneKind`)
- Modify: `src/views/studio/steps/StepFootage.tsx` (`SceneCard`)
- Modify: `e2e/04-tuy-chon-video.spec.ts` (thêm 1 test)
- Test: `tests/client/controllers/FootageSearchController.test.ts` (thêm describe)

**Interfaces:**
- Consumes (Task 1): `StudioData.options: VideoOptions` với `sceneFootageKind(sceneId)`, `footageKind`, `withSceneFootageKind(sceneId, kind | null)`; types `FootageKindPreference`, `SceneFootageKind`. `StockApi.search(query, kind: "image" | "video", { signal, perPage })` (có sẵn). Task 5: `sidebar(page)` export từ `e2e/04-tuy-chon-video.spec.ts`, radio "Ưu tiên video"; helper `DraftState.sceneKindCount`.
- Produces: `FootageSearchController.setSceneKind(sceneId: string, kind: SceneFootageKind | null): Promise<void>`; `search()` chỉ tìm loại riêng của cảnh nếu có; `autoFill()` dùng loại riêng của cảnh hoặc ưu tiên chung, ưu tiên chung không có kết quả thì lùi về loại còn lại. Giao diện: nhóm `role="group"` nhãn "Loại cảnh trám" với hai nút "Ảnh", "Video" (`aria-pressed`).

- [ ] **Step 1: Viết test (đỏ)**

Thêm describe cuối `tests/client/controllers/FootageSearchController.test.ts`:

```ts
describe("FootageSearchController — Ảnh/Video", () => {
  it("autoFill với ưu tiên video: chỉ tìm video khi có kết quả", async () => {
    const { ctrl, session, calls } = setup(
      {
        police: { image: [item("a1")], video: [item("v1", "video")] },
        news: { image: [item("n1")], video: [item("w1", "video"), item("w2", "video"), item("w3", "video")] },
      },
      { "Công an": ["police"] },
    );
    session.update((d) => ({ ...d, options: d.options.withFootageKind("video") }));
    await ctrl.autoFill();
    expect(calls.every((c) => c.startsWith("video:"))).toBe(true);
    expect(uri(session, "s1")).toBe("f-w1");
    expect(uri(session, "s2")).toBe("f-v1");
    expect(uri(session, "s3")).toBe("f-w2");
    expect(uri(session, "s4")).toBe("f-w3");
  });

  it("autoFill với ưu tiên video mà không có video: lùi về ảnh", async () => {
    const { ctrl, session, calls } = setup({ news: { image: [item("n1"), item("n2"), item("n3"), item("n4")] } });
    session.update((d) => ({ ...d, options: d.options.withFootageKind("video") }));
    await ctrl.autoFill();
    expect(calls.slice(0, 2)).toEqual(["video:news", "image:news"]);
    expect(uri(session, "s1")).toBe("f-n1");
    expect(uri(session, "s4")).toBe("f-n4");
  });

  it("autoFill: cảnh có lựa chọn riêng thì chỉ tìm loại đó, không lùi", async () => {
    const { ctrl, session, calls } = setup(
      {
        police: { image: [item("a1")], video: [item("v1", "video")] },
        news: { image: [item("n1"), item("n2"), item("n3")], video: [item("w1", "video"), item("w2", "video"), item("w3", "video")] },
      },
      { "Công an": ["police"] },
    );
    session.update((d) => ({ ...d, options: d.options.withFootageKind("video").withSceneFootageKind("s2", "image") }));
    await ctrl.autoFill();
    expect(calls).toContain("image:police");
    expect(calls).not.toContain("video:police");
    expect(uri(session, "s2")).toBe("f-a1");
  });

  it("search theo loại riêng của cảnh: chỉ gọi một loại; không có loại riêng thì tìm cả hai như cũ", async () => {
    const { ctrl, session, calls } = setup({ boat: { image: [item("b1")], video: [item("bv1", "video")] } });
    session.update((d) => ({ ...d, options: d.options.withFootageKind("image").withSceneFootageKind("s3", "video") }));
    await ctrl.search("s3", "boat");
    expect(calls).toEqual(["video:boat"]);
    expect(ctrl.state.byScene.s3?.items.map((i) => i.id)).toEqual(["bv1"]);
    calls.length = 0;
    await ctrl.search("s4", "boat");
    expect([...calls].sort()).toEqual(["image:boat", "video:boat"]);
  });

  it("setSceneKind nhớ loại của cảnh trong session và tìm lại bằng từ khoá đang có; null là bỏ", async () => {
    const { ctrl, session, calls } = setup({ boat: { image: [item("b1")], video: [item("bv1", "video")] } });
    await ctrl.search("s3", "boat");
    expect(ctrl.state.byScene.s3?.items.map((i) => i.id)).toEqual(["b1", "bv1"]);
    calls.length = 0;
    await ctrl.setSceneKind("s3", "video");
    expect(session.state.options.sceneFootageKind("s3")).toBe("video");
    expect(calls).toEqual(["video:boat"]);
    expect(ctrl.state.byScene.s3?.items.map((i) => i.id)).toEqual(["bv1"]);
    calls.length = 0;
    await ctrl.setSceneKind("s3", null);
    expect(session.state.options.sceneFootageKind("s3")).toBeNull();
    expect([...calls].sort()).toEqual(["image:boat", "video:boat"]);
  });

  it("setSceneKind khi cảnh chưa có từ khoá: dùng gợi ý từ câu (cuối cùng là từ khoá chung)", async () => {
    const { ctrl, calls } = setup({});
    await ctrl.setSceneKind("s4", "image");
    expect(calls).toEqual(["image:news"]);
    expect(ctrl.state.byScene.s4?.empty).toBe(true);
  });
});
```

Run: `npx vitest run tests/client/controllers/FootageSearchController.test.ts`
Expected: FAIL — `ctrl.setSceneKind is not a function`; các test autoFill/search gọi cả `image:` lẫn `video:`.

- [ ] **Step 2: Sửa `src/client/controllers/FootageSearchController.ts`**

Thêm import: `import type { FootageKindPreference, SceneFootageKind } from "@/domain/VideoOptions";`

Trong `search`, thay `const items = await this.query(text, signal);` bằng:

```ts
      // Cảnh có lựa chọn Ảnh/Video riêng thì chỉ tìm loại đó; không có thì tìm cả hai như trước.
      const kind = this.deps.session.state.options.sceneFootageKind(sceneId) ?? "any";
      const items = await this.query(text, signal, kind);
```

Thêm phương thức public (sau `choose`):

```ts
  /** Chọn Ảnh/Video cho một cảnh (null = bỏ chọn, tìm cả hai), nhớ trong bản nháp rồi tìm lại. Không đổi cảnh trám đang gán. */
  async setSceneKind(sceneId: string, kind: SceneFootageKind | null): Promise<void> {
    const { project } = this.deps.session.state;
    const scene = project?.scenes.find((s) => s.id === sceneId);
    if (!project || !scene) return;
    this.deps.session.update((d) => ({ ...d, options: d.options.withSceneFootageKind(sceneId, kind) }));
    const fallback = this.deps.templates.get(project.templateId).defaults.fallbackKeyword;
    const text = this.state.byScene[sceneId]?.query || this.suggester(fallback).suggest(scene.text, 1)[0] || fallback;
    await this.search(sceneId, text);
  }
```

Thay `fillScene` bằng:

```ts
  private async fillScene(sceneId: string, run: number): Promise<void> {
    if (run !== this.run) return;
    const { project, options } = this.deps.session.state;
    const scene = project?.scenes.find((s) => s.id === sceneId);
    if (!project || !scene) return;
    // cảnh người dùng đã tự tìm (đang bay hoặc đã xong) hoặc đã gán tay thì không ghi đè
    if (this.manual.has(sceneId) || this.inflight.has(sceneId) || this.deps.session.state.footage.get(sceneId)) return;
    const explicit = options.sceneFootageKind(sceneId);
    const preferred: FootageKindPreference = explicit ?? options.footageKind;
    // Ưu tiên chung (không phải lựa chọn riêng của cảnh) mà không có kết quả thì lùi về loại còn lại.
    const backup: SceneFootageKind | null =
      explicit === null && preferred !== "any" ? (preferred === "image" ? "video" : "image") : null;
    const signal = this.begin(sceneId);
    let current = scene.text;
    try {
      const fallback = this.deps.templates.get(project.templateId).defaults.fallbackKeyword;
      const phrases = this.suggester(fallback).suggest(scene.text, MAX_PHRASES);
      const first = phrases[0] ?? fallback;
      current = first;
      this.setScene(sceneId, { query: first, loading: true, items: [], error: null, empty: false });
      for (const phrase of phrases) {
        current = phrase;
        let items = await this.query(phrase, signal, preferred);
        if (!this.owns(sceneId, signal)) return;
        if (items.length === 0 && backup) {
          items = await this.query(phrase, signal, backup);
          if (!this.owns(sceneId, signal)) return;
        }
        if (items.length > 0) {
          this.setScene(sceneId, { query: phrase, loading: false, items, error: null, empty: false });
          this.pickFirstUnused(sceneId, items);
          return;
        }
      }
      this.setScene(sceneId, { query: first, loading: false, items: [], error: null, empty: true });
    } catch (error) {
      this.failScene(sceneId, signal, current, error);
    } finally {
      this.release(sceneId, signal);
    }
  }
```

Thay chữ ký và phần đầu `query`:

```ts
  /**
   * Tìm cảnh trám. `kind` = "image"/"video": chỉ một loại. "any": ảnh và video song song;
   * một nguồn lỗi thì dùng nguồn còn lại, cả hai lỗi thì ném lỗi đầu.
   */
  private async query(query: string, signal: AbortSignal, kind: FootageKindPreference): Promise<StockItemDto[]> {
    if (kind !== "any") {
      const result = await this.deps.stock.search(query, kind, { signal, perPage: MAX_CANDIDATES });
      if (result.warnings.length > 0) this.addWarnings(result.warnings);
      return result.items.slice(0, MAX_CANDIDATES);
    }
    const [images, videos] = await Promise.allSettled([
```

(phần còn lại của `query` giữ nguyên).

Run: `npx vitest run tests/client/controllers/FootageSearchController.test.ts`
Expected: PASS (test cũ + 6 test mới).

- [ ] **Step 3: Nút "Ảnh | Video" trong `src/views/studio/steps/StepFootage.tsx`**

Trong `SceneCard`, sau dòng `const pool = studio.footage.pool();` thêm:

```tsx
  const kind = data.options.sceneFootageKind(sceneId);
```

Trong `<form …>` (tìm cảnh), chèn trước `<input className="min-w-40 …"`:

```tsx
        <div role="group" aria-label="Loại cảnh trám" className="flex overflow-hidden rounded-md">
          {(["image", "video"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              disabled={state?.loading}
              title={kind === k ? "Bấm lại để tìm cả ảnh và video" : undefined}
              className={`px-3 py-1.5 disabled:opacity-50 ${kind === k ? "bg-emerald-600 font-medium" : "bg-neutral-800"}`}
              onClick={() => void studio.search.setSceneKind(sceneId, kind === k ? null : k)}
            >
              {k === "image" ? "Ảnh" : "Video"}
            </button>
          ))}
        </div>
```

Run: `npm run typecheck` rồi `npm run lint` → sạch.

- [ ] **Step 4: Thêm e2e vào `e2e/04-tuy-chon-video.spec.ts`**

Sửa import đầu file thành:

```ts
import { expect, test, type Page } from "@playwright/test";
import { autoFillFootage, discardDraftIfOffered, expectDraftSaved, fillSampleAndSplit, generateVoices, goNext, login, stepButton } from "./helpers";
```

Thêm test:

```ts
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
```

Run: `npm run test:e2e`
Expected: 11 test PASS.

- [ ] **Step 5: Chạy toàn bộ**

Run: `npx vitest run` rồi `npm run typecheck` rồi `npm run lint` → sạch.

- [ ] **Step 6: Commit (điều phối viên)**

```bash
git add src/client/controllers/FootageSearchController.ts src/views/studio/steps/StepFootage.tsx tests/client/controllers/FootageSearchController.test.ts e2e/04-tuy-chon-video.spec.ts
git commit -m "feat(tuy-chon): chọn Ảnh/Video từng cảnh, ưu tiên ảnh/video khi tự điền"
```

---

### Task 7: Kiểm chứng trên MP4 thật (e2e + so vùng khung + đo tốc độ) và tài liệu

**Files:**
- Create: `scripts/lib/frameRegion.ts`
- Test: `tests/scripts/frameRegion.test.ts` (mới)
- Modify: `e2e/04-tuy-chon-video.spec.ts` (thêm 1 test)
- Modify: `README.md` (thêm mục "Tuỳ chọn video" trước "## Deploy lên Vercel (từng bước)")
- Modify: `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md` (thêm §14 cuối file)

**Interfaces:**
- Consumes: `FfmpegMissingError` (`scripts/measure-mp4.ts`); helper e2e `renderAndDownload`, `autoFillFootage`, `generateVoices`, `goNext`, `fillSampleAndSplit`, `login`, `discardDraftIfOffered`; `sidebar(page)` (Task 5); `LAYOUT.subtitle` (Task 4: thân bài y 1464–1600, x 130–950); bố cục mở đầu (khối đặc từ y 1060).
- Produces: `scripts/lib/frameRegion.ts`: `interface Region { x: number; y: number; w: number; h: number }`, `regionArgs(file: string, t: number, r: Region): string[]`, `grabRegion(file: string, t: number, r: Region): Uint8Array` (RGB24), `meanAbsDiff(a: Uint8Array, b: Uint8Array): number`.

- [ ] **Step 1: Viết test `tests/scripts/frameRegion.test.ts` (đỏ)**

```ts
import { describe, expect, it } from "vitest";
import { meanAbsDiff, regionArgs } from "../../scripts/lib/frameRegion";

describe("frameRegion", () => {
  it("meanAbsDiff: trung bình chênh lệch tuyệt đối từng byte", () => {
    expect(meanAbsDiff(new Uint8Array([0, 10, 20]), new Uint8Array([0, 0, 30]))).toBeCloseTo(20 / 3, 9);
    expect(meanAbsDiff(new Uint8Array([5, 5]), new Uint8Array([5, 5]))).toBe(0);
  });

  it("meanAbsDiff: khác kích thước hoặc rỗng thì báo lỗi", () => {
    expect(() => meanAbsDiff(new Uint8Array(3), new Uint8Array(6))).toThrow("Hai vùng ảnh phải cùng kích thước");
    expect(() => meanAbsDiff(new Uint8Array(0), new Uint8Array(0))).toThrow("Hai vùng ảnh phải cùng kích thước");
  });

  it("regionArgs: tua tới giây t, cắt vùng, xuất RGB24 thô ra stdout", () => {
    expect(regionArgs("a.mp4", 10, { x: 130, y: 1464, w: 820, h: 136 })).toEqual([
      "-v", "error", "-ss", "10", "-i", "a.mp4", "-frames:v", "1",
      "-vf", "crop=820:136:130:1464", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ]);
  });
});
```

Run: `npx vitest run tests/scripts/frameRegion.test.ts`
Expected: FAIL — không tìm thấy `../../scripts/lib/frameRegion`.

- [ ] **Step 2: Viết `scripts/lib/frameRegion.ts`**

```ts
import { execFileSync } from "node:child_process";
import { FfmpegMissingError } from "../measure-mp4";

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Tham số ffmpeg: lấy 1 khung ở giây `t`, cắt vùng `r` (toạ độ khung 1080×1920), xuất RGB24 thô. */
export function regionArgs(file: string, t: number, r: Region): string[] {
  return [
    "-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1",
    "-vf", `crop=${r.w}:${r.h}:${r.x}:${r.y}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
  ];
}

/** Điểm ảnh RGB24 của vùng `r` ở giây `t`. Ném FfmpegMissingError nếu máy không có ffmpeg. */
export function grabRegion(file: string, t: number, r: Region): Uint8Array {
  let out: Buffer;
  try {
    out = execFileSync("ffmpeg", regionArgs(file, t, r), { maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") throw new FfmpegMissingError();
    throw error;
  }
  const expected = r.w * r.h * 3;
  if (out.byteLength !== expected) throw new Error(`ffmpeg trả ${out.byteLength} byte, cần ${expected}`);
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

/** Trung bình chênh lệch tuyệt đối từng byte (0–255) giữa hai vùng cùng kích thước. */
export function meanAbsDiff(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length || a.length === 0) throw new Error("Hai vùng ảnh phải cùng kích thước");
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs((a[i] as number) - (b[i] as number));
  return sum / a.length;
}
```

Run: `npx vitest run tests/scripts/frameRegion.test.ts`
Expected: PASS (3 test).

- [ ] **Step 3: Thêm e2e dựng 2 lần và so vùng khung**

Thêm import vào đầu `e2e/04-tuy-chon-video.spec.ts`:

```ts
import { FfmpegMissingError } from "../scripts/measure-mp4";
import { grabRegion, meanAbsDiff, type Region } from "../scripts/lib/frameRegion";
```

và thêm `renderAndDownload` vào import từ `./helpers`. Thêm vào cuối file:

```ts
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
```

- [ ] **Step 4: Chạy e2e và ghi số đo**

Run: `npm run test:e2e`
Expected: 12 test PASS. Ghi vào report các dòng `[e2e]` (thời lượng, hai thời gian dựng và tỉ lệ ×, ba mức chênh vùng).
Quy tắc hiệu năng: nếu tỉ lệ có phụ đề > 1,15 × tỉ lệ tắt phụ đề, đổi `LAYOUT.subtitle.shadowBlurPx` từ `6` về `0` (giữ `shadowOffsetPx`), chạy lại `npx vitest run tests/templates` và `npm run test:e2e`, ghi cả hai lần đo. Nếu vẫn > 1,3× thì BLOCKED, báo số đo.

- [ ] **Step 5: Ảnh so khung để người duyệt bằng mắt (điều phối viên hoặc implementer)**

Lấy hai đường dẫn MP4 từ log `[e2e]` ở Step 4:

```bash
npm run contact:sheet -- "<đường dẫn co-phu-de-….mp4>" "<đường dẫn khong-phu-de-….mp4>" .superpowers/sample/so-khung-phu-de.png 1,6,10,20
```

Expected: `Đã ghi .superpowers/sample/so-khung-phu-de.png: 4 hàng × 2 cột`. Mở ảnh (Read tool) và ghi vào report: cột trái có phụ đề trắng viền đen ở đáy cảnh thân bài (không chạm tem ngày, không chạm dải ảnh), cảnh mở đầu có phụ đề ngay trên chip, không đè tiêu đề; cột phải khối sau tiêu đề màu đỏ, không phụ đề; dòng tiếng Việt có dấu chồng (ễ, ặ, ữ) hiển thị đủ.

- [ ] **Step 6: README — thêm mục trước `## Deploy lên Vercel (từng bước)`**

```markdown
## Tuỳ chọn video (thanh bên trái)

Mỗi video có tuỳ chọn riêng, lưu trong bản nháp (không thuộc bộ thương hiệu), về mặc định khi bấm "Dự án mới":

- **Phụ đề:** bật/tắt và chọn font (mặc định bật, font Phudu). Phụ đề cháy cứng vào video, hiện từng đoạn ≤ 2 dòng ở đáy cảnh (vùng an toàn TikTok); cảnh mở đầu hiện ngay trên chip tên kênh. Đoạn đổi theo tỉ lệ số chữ trên độ dài giọng đọc (không khớp từng từ).
- **Font chữ tiêu đề và nhãn:** tiêu đề mở đầu, tên kênh, dòng nguồn, tem ngày (mặc định Barlow Condensed như trước).
- **Thumbnail đầu:** màu nền và màu khối sau tiêu đề; "Về mặc định" = theo màu chủ đạo của thương hiệu.
- **Ảnh/Video khi tự tìm:** cả hai / ưu tiên ảnh / ưu tiên video (loại ưu tiên không có kết quả thì lùi về loại còn lại). Ở bước 3, mỗi cảnh có nút "Ảnh | Video" để tìm lại chỉ một loại (bấm lại để bỏ chọn).

Font (Phudu, Be Vietnam Pro, Oswald, Montserrat, Roboto Condensed, Barlow Condensed) nằm trong `public/fonts/` và `public/templates/theanh28/fonts/`, giấy phép SIL OFL (`OFL.txt` cạnh từng họ). Khi dựng chỉ tải font đang chọn. Thêm font: tải `.ttf` từ `github.com/google/fonts` vào `public/fonts/<id>/`, thêm id vào `src/domain/fontIds.ts` và mục vào `src/templates/fonts/FontCatalog.ts`; `npm test` tự kiểm font có đủ chữ tiếng Việt.

So khung có/không phụ đề: `npm run contact:sheet -- co-phu-de.mp4 khong-phu-de.mp4 so-khung.png 1,6,10,20`.
```

- [ ] **Step 7: Đặc tả — thêm cuối `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md`**

```markdown
## 14. Tuỳ chọn video (2026-10-16)

Thay đổi so với §4.4 ("Không phụ đề"): phụ đề cháy cứng là tuỳ chọn theo từng video, mặc định bật.

- Model `VideoOptions` (domain) trong `StudioData.options`; bản nháp v2 có `options`, bản nháp v1 vẫn mở được (tuỳ chọn mặc định). `RenderJob.options` mang snapshot vào worker; worker chỉ nạp font chữ + font phụ đề đang chọn (`FontCatalog`).
- Phụ đề: rộng tối đa 820 px căn giữa, cỡ 54, cao dòng 68, ≤ 2 dòng/đoạn; thân bài đáy y 1600, mở đầu đáy y 990 (trên chip). Thời gian đoạn theo tỉ lệ ký tự trên độ dài giọng đọc của cảnh. Hàm vẽ vẫn thuần theo `sceneTime` (có bộ nhớ đệm đoạn đã chia).
- Thumbnail đầu: `backgroundColor` = nền toàn khung cảnh mở đầu, `blockColor` = dải chuyển + khối sau tiêu đề; không đặt = `primaryColor`.
- Số đo (Task 7, e2e nhà cung cấp giả): điền từ report — video … s, có phụ đề dựng … s (…×), tắt phụ đề … s (…×); chênh vùng phụ đề …, khối mở đầu …, dải ảnh ….
```

(Thay các dấu "…" bằng số đo thật của Step 4 trước khi lưu; không để "…" trong file.)

- [ ] **Step 8: Kiểm toàn bộ và build**

Run: `npx vitest run` rồi `npm run typecheck` rồi `npm run lint` rồi `npm run build`
Expected: tất cả sạch; build thành công (`prebuild` chạy `check-env`; nếu `check-env` báo thiếu biến do môi trường máy, ghi nguyên văn vào report và chạy `npx next build` để kiểm phần biên dịch).

- [ ] **Step 9: Commit (điều phối viên)**

```bash
git add scripts/lib/frameRegion.ts tests/scripts/frameRegion.test.ts e2e/04-tuy-chon-video.spec.ts README.md docs/superpowers/specs/2026-10-15-tin-video-studio-design.md
git commit -m "test(tuy-chon): kiểm phụ đề và màu thumbnail trên MP4 thật, đo tốc độ, tài liệu"
```

---

## Rủi ro và quyết định mở (cần Hải duyệt)

1. **Màu nền thumbnail gần như không thấy khi cảnh mở đầu có ảnh.** Ảnh phủ y 0–1000, khối sau tiêu đề phủ 860–1920, nên `backgroundColor` (đúng như đặc tả: thay `fillStyle` nền) chỉ lộ ra khi cảnh mở đầu dùng nền mặc định (không ảnh). Phương án khác nếu Hải muốn thấy rõ: cho `backgroundColor` tô cả chip tên kênh, hoặc phủ một lớp màu mờ lên ảnh. Kế hoạch làm đúng đặc tả; đổi sau chỉ sửa `drawIntro`.
2. **Vị trí phụ đề cảnh mở đầu:** đặt TRÊN chip (đè phần dưới ảnh, y 854–990) thay vì dưới tiêu đề, vì dưới tiêu đề tràn vùng an toàn TikTok khi tiêu đề 3 dòng cỡ lớn. Phụ đề cảnh mở đầu lặp lại đúng chữ tiêu đề (giọng đọc tiêu đề) — Hải có thể muốn tắt riêng phụ đề cảnh mở đầu. Duyệt bằng ảnh `so-khung-phu-de.png` (Task 7 Step 5).
3. **Bản nháp cũ mở lại sẽ có phụ đề** (mặc định bật cho mọi video, kể cả bản nháp v1). Chữ tiêu đề/nhãn giữ Barlow nên phần còn lại y hệt video cũ.
4. **"Ưu tiên video" lùi về ảnh** khi không có video (chỉ với ưu tiên chung); nút "Ảnh | Video" từng cảnh thì chặt (không lùi) và **không tự đổi cảnh trám đang gán** — người dùng bấm vào gợi ý để đổi. Bấm lại nút đang bật = bỏ chọn (về cả hai). Nếu Hải muốn bấm "Video" là tự gán video đầu tiên thì thêm `pickFirstUnused` vào `setSceneKind`.
5. **Font:** Oswald chỉ tới 700 nên "đậm nhất" của Oswald nhẹ hơn các font khác. Montserrat biến thiên 745 KB và Roboto Condensed 372 KB — chỉ tải khi được chọn; repo tăng ≈ 1,6 MB. Chưa có xem trước font trong giao diện (chỉ thấy khi dựng).
6. **Thời gian phụ đề theo tỉ lệ ký tự**, không có mốc từng từ: giọng ngắt nghỉ không đều sẽ lệch nhẹ. Từ quá dài (URL) không bị cắt ký tự, có thể tràn quá 820 px.
7. **Hiệu năng:** viền 10 px + bóng mờ 6 px cho 1–2 dòng mỗi khung; Task 7 đo và có quy tắc bỏ bóng mờ nếu chậm > 15 %. Đo trên nhà cung cấp giả (ảnh PNG đơn sắc); chưa đo với video thật nhiều cảnh.
8. **Bản nháp v2:** tab app bản cũ (nếu còn mở ở máy khác) đọc bản nháp v2 sẽ coi như không có bản nháp.
9. **e2e không kiểm được video thật** (FakeStockProvider không trả video): nút "Video" chỉ kiểm trạng thái rỗng; Pexels/Pixabay thật cần kiểm tay với key.
10. **Tải font từ GitHub (raw.githubusercontent.com/google/fonts)**: các URL đã kiểm trả 200 ngày 2026-10-16; nếu kho đổi tên tệp, Task 2 dừng ở Step 5 và báo lại.
