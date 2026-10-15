# Tin Video Studio — Chặng 3A: Bộ dựng bền hơn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa các điểm yếu của bộ dựng mà review chặng 2 đã nêu (bộ giải mã sống suốt lần dựng, nền mờ tốn, bộ giới hạn đỉnh hạ cả bản trộn, thiếu kiểm tra worker, khoảng lặng đầu/cuối giọng, dòng nguồn tin đè logo) và đo lại tốc độ dựng.

**Architecture:** Giữ nguyên kiến trúc chặng 2 (templates thuần → VideoRenderer thuần → worker). Thêm một dịch vụ `BackdropMaker` để template không phải blur toàn khung mỗi khung hình, thêm `release()` cho `FrameProvider`, thay bộ giới hạn toàn cục bằng bộ giới hạn có nhìn trước, thêm thông điệp `probe` cho worker, hàm cắt lặng thuần, và giới hạn bề ngang dòng nguồn tin trong template.

**Tech Stack:** Như chặng 2 (Next.js 16, TypeScript 5.9, Vitest 5, mediabunny 1.61.4). Không thêm thư viện mới.

**Đặc tả:** `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md` (mục 4.4, 5, 12). **Lộ trình:** `docs/superpowers/plans/2026-10-15-00-lo-trinh.md`.

## Global Constraints

- Thư mục dự án: `D:\Brain Hainv\ca-nhan\tools\tin-video-studio`, nhánh `feat/chang-3a-bo-dung` (điều phối viên tạo từ `main`). Đường dẫn tính từ thư mục này.
- **Agent thực thi CẤM chạy mọi lệnh git.** Bỏ qua bước "Commit"; điều phối viên commit. Không chạy dev server; không tạo `.env*`; không đọc/sửa `.env.local`.
- **RED phải đỏ thật:** chạy test mới trước khi viết code và ghi lại dòng thất bại. Test nào không đỏ trên code cũ thì KHÔNG sửa kỳ vọng, báo lại trong report.
- Khung hình 1080×1920, 30 fps; H.264 8 Mbps; AAC 192 kbps 48 kHz stereo (không đổi so với chặng 2).
- Trộn âm: giọng −16,5 dB RMS (cổng −45 dB); nhạc thấp hơn giọng `MusicTrack.levelBelowVoiceDb` (mặc định 15 dB); trần đỉnh **0,89**.
- `src/domain` không import gì ngoài `src/domain`. `src/templates` chỉ import `src/domain` và chính nó, không import `mediabunny`. Hàm vẽ của template phải thuần theo thời gian.
- Ngôn ngữ giao diện và thông báo lỗi: tiếng Việt có dấu. Tên lớp, hàm, biến: tiếng Anh.
- Mọi commit kết thúc bằng dòng `Co-Authored-By` do phiên chạy quy định (điều phối viên tự thêm).
- Sau mỗi task: `npx vitest run`, `npm run typecheck`, `npm run lint` đều sạch (0 cảnh báo).

## Cấu trúc file chặng 3A

```
src/client/render/VideoRenderer.ts            # sửa: release(), backdrop
src/client/render/BackdropMaker.ts            # mới
src/client/render/workerProbe.ts              # mới
src/client/render/RenderJob.ts                # sửa: thông điệp probe
src/client/render/RenderClient.ts             # sửa: probe(), xử lý thông điệp tường minh
src/client/render/render.worker.ts            # sửa: backdrop, probe
src/client/media/MediaFrameProvider.ts        # sửa: release()
src/client/media/AudioMix.ts                  # sửa: bộ giới hạn có nhìn trước
src/client/media/audioTrim.ts                 # mới
src/templates/Canvas2D.ts                     # sửa: thêm imageSmoothing*
src/templates/VideoTemplate.ts                # sửa: SceneFrame.backdrop
src/templates/theanh28/TheAnh28Template.ts    # sửa: backdrop, giới hạn dòng nguồn tin
src/templates/theanh28/layout.ts              # sửa: LAYOUT.credit
tests/helpers/RecordingCanvas.ts              # sửa: imageSmoothing*
tests/client/render/VideoRenderer.test.ts     # thay toàn bộ
tests/client/render/BackdropMaker.test.ts     # mới
tests/client/render/workerProbe.test.ts       # mới
tests/client/render/RenderClient.test.ts      # thêm test
tests/client/media/AudioMix.test.ts           # thêm test
tests/client/media/audioTrim.test.ts          # mới
tests/templates/theanh28/TheAnh28Template.test.ts  # thêm test
```

---

### Task 1: Nhả bộ giải mã video theo cảnh (`FrameProvider.release`)

**Vấn đề (review chặng 2):** mọi `VideoFrameProvider` được mở trước vòng lặp và bộ giải mã chỉ được giải phóng ở `finally` sau khi dựng xong. Tin dài có nhiều cảnh video sẽ giữ nhiều `VideoDecoder` cùng lúc (Chrome giới hạn số bộ giải mã đồng thời).

**Files:**
- Modify: `src/client/render/VideoRenderer.ts`, `src/client/media/MediaFrameProvider.ts`
- Test: `tests/client/render/VideoRenderer.test.ts` (thay toàn bộ)

**Interfaces:**
- Consumes: `FrameProvider`, `RenderScene`, `VideoRenderer` (chặng 2).
- Produces: `FrameProvider.release(): void` — nhả tài nguyên nặng khi hết cảnh, **gọi `frameAt` sau đó vẫn dùng được** (tự mở lại); `dispose()` vẫn là nhả toàn bộ. `VideoRenderer.render()` gọi `release()` của cảnh trước khi sang cảnh kế, và của cảnh đang chạy ở cuối (kể cả khi huỷ hoặc lỗi).

- [ ] **Step 1: Thay toàn bộ `tests/client/render/VideoRenderer.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { BrandKit } from "@/domain/BrandKit";
import { DEFAULT_TIMELINE_CONFIG, Timeline } from "@/domain/Timeline";
import { RenderCancelledError } from "@/client/render/errors";
import { VideoRenderer, type FrameProvider, type RenderScene, type VideoFrameSink } from "@/client/render/VideoRenderer";
import { VideoTemplate, type DrawableImage, type ProjectFrame, type SceneFrame } from "@/templates/VideoTemplate";
import { RecordingCanvas } from "../../helpers/RecordingCanvas";

class LogTemplate extends VideoTemplate {
  readonly id = "log";
  readonly name = "Log";
  readonly brandFields = [];
  readonly fonts = [];
  readonly defaults = { width: 1080, height: 1920, fps: 30, timeline: DEFAULT_TIMELINE_CONFIG, fallbackKeyword: "news" };
  readonly frames: SceneFrame[] = [];
  protected drawIntro(_c: unknown, _p: ProjectFrame, s: SceneFrame): void {
    this.frames.push(s);
  }
  protected drawBody(_c: unknown, _p: ProjectFrame, s: SceneFrame): void {
    this.frames.push(s);
  }
}

class CountingFrames implements FrameProvider {
  readonly asked: number[] = [];
  releases = 0;
  readonly image: DrawableImage = { source: {} as CanvasImageSource, width: 10, height: 10 };
  async frameAt(t: number) {
    this.asked.push(t);
    return this.image;
  }
  release(): void {
    this.releases++;
  }
  dispose(): void {}
}

class Sink implements VideoFrameSink {
  readonly stamps: number[] = [];
  constructor(private readonly onAdd?: (count: number) => void) {}
  async add(ts: number, dur: number) {
    this.stamps.push(ts);
    expect(dur).toBeCloseTo(1 / 10, 9);
    this.onAdd?.(this.stamps.length);
  }
}

const project: ProjectFrame = {
  displayTitle: "T",
  sourceCredit: "",
  publishDateText: "14/10/2026",
  brand: BrandKit.create("log", [], {}),
  logo: null,
};

function setup(opts: { signal?: AbortSignal; onAdd?: (count: number) => void } = {}) {
  // a: 0 → 0.3+0.7+0.35 = 1.35 ; b: 1.35 → 1.35+0.5+0.6 = 2.45  ⇒ 25 khung ở 10 fps
  const timeline = Timeline.build([
    { sceneId: "a", durationSec: 0.7 },
    { sceneId: "b", durationSec: 0.5 },
  ]);
  const introFrames = new CountingFrames();
  const videoFrames = new CountingFrames();
  const scenes = new Map<string, RenderScene>([
    ["a", { sceneId: "a", role: "intro", text: "A", playback: { mode: "still" }, frames: introFrames }],
    ["b", { sceneId: "b", role: "body", text: "B", playback: { mode: "loop", sourceDurationSec: 0.4 }, frames: videoFrames }],
  ]);
  const template = new LogTemplate();
  const sink = new Sink(opts.onAdd);
  const progress: number[] = [];
  const renderer = new VideoRenderer({
    template,
    ctx: new RecordingCanvas().asCanvas(),
    project,
    timeline,
    scenes,
    fps: 10,
    sink,
    onProgress: (p) => progress.push(p.frame),
    signal: opts.signal,
  });
  return { renderer, template, sink, progress, introFrames, videoFrames };
}

describe("VideoRenderer", () => {
  it("dựng đủ khung, đúng mốc thời gian và đúng cảnh", async () => {
    const { renderer, template, sink } = setup();
    expect(await renderer.render()).toBe(25);
    expect(sink.stamps).toHaveLength(25);
    expect(sink.stamps[0]).toBe(0);
    expect(sink.stamps[24]).toBeCloseTo(2.4, 9);
    expect(template.frames[0]?.role).toBe("intro");
    expect(template.frames[13]?.role).toBe("intro");
    expect(template.frames[14]?.role).toBe("body");
    expect(template.frames[14]?.sceneTime).toBeCloseTo(0.05, 9);
    expect(template.frames[14]?.sceneDuration).toBeCloseTo(1.1, 9);
  });

  it("video lặp lấy khung theo thời gian lặp", async () => {
    const { renderer, videoFrames } = setup();
    await renderer.render();
    expect(videoFrames.asked[0]).toBeCloseTo(0.05, 9);
    expect(videoFrames.asked[5]).toBeCloseTo(0.15, 9);
  });

  it("báo tiến độ mỗi 15 khung và khung cuối", async () => {
    const { renderer, progress } = setup();
    await renderer.render();
    expect(progress).toEqual([15, 25]);
  });

  it("huỷ giữa chừng ném RenderCancelledError", async () => {
    const controller = new AbortController();
    controller.abort();
    const { renderer } = setup({ signal: controller.signal });
    await expect(renderer.render()).rejects.toBeInstanceOf(RenderCancelledError);
  });

  it("nhả bộ giải mã của mỗi cảnh đúng một lần khi hết cảnh", async () => {
    const { renderer, introFrames, videoFrames } = setup();
    await renderer.render();
    expect(introFrames.releases).toBe(1);
    expect(videoFrames.releases).toBe(1);
  });

  it("cảnh trước được nhả TRƯỚC khi cảnh sau lấy khung đầu tiên", async () => {
    const { renderer, introFrames, videoFrames } = setup();
    let releasesWhenSecondSceneStarted = -1;
    const original = videoFrames.frameAt.bind(videoFrames);
    videoFrames.frameAt = async (t: number) => {
      if (videoFrames.asked.length === 0) releasesWhenSecondSceneStarted = introFrames.releases;
      return original(t);
    };
    await renderer.render();
    expect(releasesWhenSecondSceneStarted).toBe(1);
  });

  it("huỷ giữa cảnh đầu vẫn nhả cảnh đang chạy, không đụng cảnh chưa tới", async () => {
    const controller = new AbortController();
    const { renderer, introFrames, videoFrames } = setup({
      signal: controller.signal,
      onAdd: (count) => {
        if (count === 3) controller.abort();
      },
    });
    await expect(renderer.render()).rejects.toBeInstanceOf(RenderCancelledError);
    expect(introFrames.releases).toBe(1);
    expect(videoFrames.releases).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi**

Run: `npx vitest run tests/client/render/VideoRenderer.test.ts`
Expected: FAIL — 3 test mới (`releases` là 0 chứ không phải 1) và lỗi kiểu nếu typecheck. Ghi lại dòng lỗi.

- [ ] **Step 3: Sửa `src/client/render/VideoRenderer.ts`**

Thay interface `FrameProvider`:
```ts
export interface FrameProvider {
  frameAt(sourceTime: number): Promise<DrawableImage | null>;
  /** Nhả tài nguyên nặng (bộ giải mã) khi hết cảnh. Gọi `frameAt` sau đó vẫn dùng được (tự mở lại). */
  release(): void;
  /** Nhả toàn bộ, kể cả bộ đọc tệp. Gọi một lần khi bỏ provider. */
  dispose(): void;
}
```

Thay toàn bộ phương thức `render()` bằng:
```ts
  async render(): Promise<number> {
    const { template, ctx, project, timeline, scenes, fps, sink, onProgress, signal } = this.input;
    const total = timeline.frameCount(fps);
    let currentSceneId: string | null = null;
    const releaseCurrent = () => {
      if (currentSceneId !== null) scenes.get(currentSceneId)?.frames?.release();
    };
    try {
      for (let i = 0; i < total; i++) {
        if (signal?.aborted) throw new RenderCancelledError();
        const t = i / fps;
        const slot = timeline.slotAt(t);
        const scene = scenes.get(slot.sceneId);
        if (!scene) throw new Error(`Thiếu dữ liệu cảnh ${slot.sceneId}`);
        if (slot.sceneId !== currentSceneId) {
          releaseCurrent();
          currentSceneId = slot.sceneId;
        }
        const sceneTime = t - slot.start;
        const sourceTime = sourceTimeFor(scene.playback, sceneTime);
        const image = sourceTime === null || !scene.frames ? null : await scene.frames.frameAt(sourceTime);
        template.drawFrame(ctx, project, {
          role: scene.role,
          text: scene.text,
          image,
          sceneTime,
          sceneDuration: slot.end - slot.start,
        });
        await sink.add(t, 1 / fps);
        const frame = i + 1;
        if (frame % PROGRESS_EVERY === 0 || frame === total) onProgress?.({ frame, totalFrames: total });
      }
    } finally {
      releaseCurrent();
    }
    return total;
  }
```

- [ ] **Step 4: Sửa `src/client/media/MediaFrameProvider.ts`**

Trong `ImageFrameProvider` thêm (trước `dispose`):
```ts
  release(): void {}
```

Trong `VideoFrameProvider` thay `dispose()` bằng:
```ts
  /** Nhả bộ giải mã và canvas giữ trong bộ đệm; `frameAt` sau đó tự mở lại bộ đọc. */
  release(): void {
    void this.iterator?.return();
    this.iterator = null;
    this.current = null;
    this.upcoming = null;
    this.lastTime = -1;
  }

  dispose(): void {
    this.release();
    this.input.dispose();
  }
```

- [ ] **Step 5: Chạy test, typecheck, lint**

Run: `npx vitest run` → PASS. `npm run typecheck`, `npm run lint` → sạch.
> Nếu `FrameProvider` còn được cài ở file khác (tìm bằng `grep -rn "implements FrameProvider\|FrameProvider = {" src tests`), thêm `release()` ở đó và báo trong report.

- [ ] **Step 6: Commit** (điều phối viên) — `feat(render): nhả bộ giải mã video khi hết cảnh`

---

### Task 2: Nền mờ chuẩn bị sẵn (`BackdropMaker`) thay cho blur 48 px mỗi khung

**Vấn đề (review chặng 2):** template vẽ lại blur 48 px trên toàn khung 1080×1920 ở mỗi khung hình — chi phí lớn nhất khi dựng (đo 2,7× thời lượng), và Safari bỏ qua `ctx.filter`. Cách sửa: thu nhỏ ảnh về 135×240 rồi phóng to ra toàn khung khi vẽ (nội suy song tuyến cho ra nền mờ, rẻ hơn khoảng 50 lần, không cần `ctx.filter`).

**Files:**
- Create: `src/client/render/BackdropMaker.ts`
- Modify: `src/templates/Canvas2D.ts`, `src/templates/VideoTemplate.ts`, `src/templates/theanh28/TheAnh28Template.ts`, `src/client/render/VideoRenderer.ts`, `src/client/render/render.worker.ts`, `tests/helpers/RecordingCanvas.ts`
- Test: `tests/client/render/BackdropMaker.test.ts`, `tests/client/render/VideoRenderer.test.ts` (thêm), `tests/templates/theanh28/TheAnh28Template.test.ts` (thêm)

**Interfaces:**
- Consumes: `DrawableImage`, `Canvas2D`, `VideoRenderer` (Task 1).
- Produces:
  - `interface BackdropMaker { make(image: DrawableImage): DrawableImage }` — trả `DrawableImage` trỏ tới **một canvas dùng lại**; người gọi phải vẽ ngay trước khi gọi `make` lần sau.
  - `interface BackdropSurface { canvas: CanvasImageSource; ctx: Canvas2D }`, `class CanvasBackdropMaker implements BackdropMaker { constructor(createSurface: (width: number, height: number) => BackdropSurface, width = 135, height = 240) }`
  - `SceneFrame.backdrop?: DrawableImage | null`
  - `VideoRenderInput.backdrop?: BackdropMaker` — `VideoRenderer` gọi `make(image)` cho cảnh `body` có ảnh và đưa kết quả vào `SceneFrame.backdrop`.
  - `Canvas2D` thêm `imageSmoothingEnabled`, `imageSmoothingQuality`.

- [ ] **Step 1: Sửa helper test `tests/helpers/RecordingCanvas.ts`**

Thêm hai trường vào lớp `RecordingCanvas` (cạnh `letterSpacing`):
```ts
  imageSmoothingEnabled = true;
  imageSmoothingQuality: "low" | "medium" | "high" = "low";
```
và thêm `imageSmoothingEnabled: boolean; imageSmoothingQuality: string` vào kiểu `state` của `DrawCall` rồi ghi chúng trong `record()`:
```ts
      state: {
        fillStyle: this.fillStyle,
        font: this.font,
        globalAlpha: this.globalAlpha,
        filter: this.filter,
        imageSmoothingEnabled: this.imageSmoothingEnabled,
        imageSmoothingQuality: this.imageSmoothingQuality,
      },
```

- [ ] **Step 2: Viết test `tests/client/render/BackdropMaker.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { CanvasBackdropMaker } from "@/client/render/BackdropMaker";
import type { DrawableImage } from "@/templates/VideoTemplate";
import { RecordingCanvas } from "../../helpers/RecordingCanvas";

const canvasToken = { tag: "backdrop-canvas" } as unknown as CanvasImageSource;
const make = () => {
  const rec = new RecordingCanvas();
  const calls: Array<[number, number]> = [];
  const maker = new CanvasBackdropMaker((w, h) => {
    calls.push([w, h]);
    return { canvas: canvasToken, ctx: rec.asCanvas() };
  });
  return { rec, calls, maker };
};

describe("CanvasBackdropMaker", () => {
  it("tạo một bề mặt 135×240 duy nhất", () => {
    const { calls } = make();
    expect(calls).toEqual([[135, 240]]);
  });

  it("phủ ảnh ngang kín khung nhỏ (cover, căn giữa) với nội suy chất lượng cao", () => {
    const { rec, maker } = make();
    const image: DrawableImage = { source: { tag: "img" } as unknown as CanvasImageSource, width: 1600, height: 900 };
    const out = maker.make(image);
    expect(out).toEqual({ source: canvasToken, width: 135, height: 240 });
    const draw = rec.ops("drawImage")[0];
    expect(draw?.args[0]).toBe(image.source);
    expect(Number(draw?.args[1])).toBeCloseTo((135 - (1600 * 240) / 900) / 2, 6);
    expect(Number(draw?.args[2])).toBeCloseTo(0, 6);
    expect(Number(draw?.args[3])).toBeCloseTo((1600 * 240) / 900, 6);
    expect(Number(draw?.args[4])).toBeCloseTo(240, 6);
    expect(draw?.state.imageSmoothingEnabled).toBe(true);
    expect(draw?.state.imageSmoothingQuality).toBe("high");
  });

  it("tô nền đen trước khi vẽ để ảnh trong suốt không để lại hình cũ", () => {
    const { rec, maker } = make();
    maker.make({ source: {} as CanvasImageSource, width: 100, height: 100 });
    const ops = rec.calls.map((c) => c.op);
    expect(ops.indexOf("fillRect")).toBeLessThan(ops.indexOf("drawImage"));
    expect(rec.ops("fillRect")[0]?.args).toEqual([0, 0, 135, 240]);
  });

  it("ảnh dọc phủ kín theo chiều ngang", () => {
    const { rec, maker } = make();
    maker.make({ source: {} as CanvasImageSource, width: 900, height: 1600 });
    const draw = rec.ops("drawImage")[0];
    expect(Number(draw?.args[3])).toBeCloseTo(135, 6);
    expect(Number(draw?.args[2])).toBeCloseTo((240 - (1600 * 135) / 900) / 2, 6);
  });
});
```

Thêm vào cuối `tests/client/render/VideoRenderer.test.ts` (trong `describe("VideoRenderer", ...)`, trước dấu `});` cuối), và thêm `import type { BackdropMaker } from "@/client/render/BackdropMaker";` ở đầu file:
```ts
  it("tạo nền mờ cho khung thân bài có ảnh, không tạo cho cảnh mở đầu", async () => {
    const made: DrawableImage[] = [];
    const sentinel: DrawableImage = { source: {} as CanvasImageSource, width: 1, height: 1 };
    const backdrop: BackdropMaker = {
      make(image) {
        made.push(image);
        return sentinel;
      },
    };
    const timeline = Timeline.build([
      { sceneId: "a", durationSec: 0.7 },
      { sceneId: "b", durationSec: 0.5 },
    ]);
    const frames = new CountingFrames();
    const template = new LogTemplate();
    const scenes = new Map<string, RenderScene>([
      ["a", { sceneId: "a", role: "intro", text: "A", playback: { mode: "still" }, frames }],
      ["b", { sceneId: "b", role: "body", text: "B", playback: { mode: "still" }, frames }],
    ]);
    await new VideoRenderer({
      template,
      ctx: new RecordingCanvas().asCanvas(),
      project,
      timeline,
      scenes,
      fps: 10,
      sink: new Sink(),
      backdrop,
    }).render();
    expect(made).toHaveLength(11);
    expect(template.frames[0]?.backdrop ?? null).toBeNull();
    expect(template.frames[14]?.backdrop).toBe(sentinel);
  });

  it("cảnh không có ảnh thì không tạo nền mờ", async () => {
    let calls = 0;
    const timeline = Timeline.build([{ sceneId: "b", durationSec: 0.5 }]);
    const template = new LogTemplate();
    await new VideoRenderer({
      template,
      ctx: new RecordingCanvas().asCanvas(),
      project,
      timeline,
      scenes: new Map<string, RenderScene>([
        ["b", { sceneId: "b", role: "body", text: "B", playback: { mode: "none" }, frames: null }],
      ]),
      fps: 10,
      sink: new Sink(),
      backdrop: {
        make() {
          calls++;
          return { source: {} as CanvasImageSource, width: 1, height: 1 };
        },
      },
    }).render();
    expect(calls).toBe(0);
  });
```

Thêm vào cuối `tests/templates/theanh28/TheAnh28Template.test.ts` (dùng các helper `project`, `scene`, `draw`, `image` đã có ở đầu file):
```ts
describe("TheAnh28Template — nền mờ chuẩn bị sẵn", () => {
  const backdrop: DrawableImage = { source: { tag: "backdrop" } as unknown as CanvasImageSource, width: 135, height: 240 };

  it("có backdrop: phóng nền nhỏ ra toàn khung với nội suy cao, không dùng ctx.filter", () => {
    const c = draw(project(), scene({ backdrop }));
    const calls = c.ops("drawImage");
    expect(calls[0]?.args.slice(0, 5)).toEqual([backdrop.source, 0, 0, 1080, 1920]);
    expect(calls[0]?.state.imageSmoothingQuality).toBe("high");
    expect(c.calls.every((x) => !x.state.filter.startsWith("blur"))).toBe(true);
    // ảnh rõ trong dải vẫn được vẽ sau nền
    expect(calls.some((x) => x.args[0] === image.source)).toBe(true);
  });

  it("không có backdrop: giữ cách cũ (blur 48px) để tương thích", () => {
    const c = draw(project(), scene());
    expect(c.ops("drawImage")[0]?.state.filter).toBe("blur(48px)");
  });
});
```
(và thêm `type DrawableImage` vào dòng import từ `@/templates/VideoTemplate` nếu chưa có.)

- [ ] **Step 3: Chạy để thấy lỗi**

Run: `npx vitest run tests/client/render tests/templates`
Expected: FAIL — không tìm thấy `@/client/render/BackdropMaker`; test `backdrop` của template/renderer thất bại. Ghi lại.

- [ ] **Step 4: Viết code**

`src/templates/Canvas2D.ts`: thêm `"imageSmoothingEnabled"` và `"imageSmoothingQuality"` vào danh sách `Pick<…>`.

`src/templates/VideoTemplate.ts`: trong `SceneFrame` thêm
```ts
  /** Nền mờ đã chuẩn bị sẵn (thu nhỏ); template phóng ra toàn khung. Không có thì template tự làm mờ. */
  backdrop?: DrawableImage | null;
```

`src/client/render/BackdropMaker.ts`:
```ts
import type { Canvas2D } from "@/templates/Canvas2D";
import type { DrawableImage } from "@/templates/VideoTemplate";

export interface BackdropMaker {
  /** Trả ảnh nền mờ (nhỏ). Canvas được dùng lại: phải vẽ ngay trước khi gọi `make` lần sau. */
  make(image: DrawableImage): DrawableImage;
}

export interface BackdropSurface {
  canvas: CanvasImageSource;
  ctx: Canvas2D;
}

/** Nền mờ bằng cách thu nhỏ rồi để template phóng to: rẻ hơn blur toàn khung và chạy được cả khi trình duyệt bỏ qua ctx.filter. */
export class CanvasBackdropMaker implements BackdropMaker {
  private readonly surface: BackdropSurface;

  constructor(
    createSurface: (width: number, height: number) => BackdropSurface,
    private readonly width = 135,
    private readonly height = 240,
  ) {
    this.surface = createSurface(width, height);
  }

  make(image: DrawableImage): DrawableImage {
    const { canvas, ctx } = this.surface;
    const scale = Math.max(this.width / image.width, this.height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image.source, (this.width - w) / 2, (this.height - h) / 2, w, h);
    return { source: canvas, width: this.width, height: this.height };
  }
}
```

`src/client/render/VideoRenderer.ts`: thêm `import type { BackdropMaker } from "./BackdropMaker";`; trong `VideoRenderInput` thêm `backdrop?: BackdropMaker;`; trong `render()` lấy `backdrop` từ `this.input` (thêm vào danh sách destructure) và đổi lời gọi `template.drawFrame` thành:
```ts
        const backdropImage = image && scene.role === "body" && backdrop ? backdrop.make(image) : null;
        template.drawFrame(ctx, project, {
          role: scene.role,
          text: scene.text,
          image,
          backdrop: backdropImage,
          sceneTime,
          sceneDuration: slot.end - slot.start,
        });
```

`src/templates/theanh28/TheAnh28Template.ts`: thay toàn bộ phương thức `drawBody` bằng:
```ts
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
    this.drawDateTag(ctx, project.publishDateText, B.dateTag.x, B.dateTag.y);
  }
```

`src/client/render/render.worker.ts`: thêm `import { CanvasBackdropMaker } from "./BackdropMaker";`; ngay sau khi tạo `ctx` (sau `if (!ctx) throw …`) thêm:
```ts
    const backdrop = new CanvasBackdropMaker((w, h) => {
      const surface = new OffscreenCanvas(w, h);
      const surfaceCtx = surface.getContext("2d");
      if (!surfaceCtx) throw new Error("Trình duyệt không cấp được canvas 2D");
      return { canvas: surface, ctx: surfaceCtx };
    });
```
và truyền `backdrop,` vào đối tượng khởi tạo `new VideoRenderer({ … })`.

- [ ] **Step 5: Chạy test, typecheck, lint, build**

Run: `npx vitest run` → PASS. `npm run typecheck`, `npm run lint` → sạch. `npm run build` → thành công.

- [ ] **Step 6: Commit** (điều phối viên) — `perf(render): nền mờ thu nhỏ rồi phóng thay cho blur 48px mỗi khung`

> Đo tốc độ thật sau task này ở Task 7.

---

### Task 3: Bộ giới hạn đỉnh có nhìn trước (thay cho hạ cả bản trộn)

**Vấn đề (review chặng 2):** khi có đỉnh vượt 0,89, `mixProgram` nhân **cả bản trộn** với `trần/đỉnh`. Giọng người thật có crest factor cao (đỉnh 1,2–1,5 khi RMS −16,5 dB) nên cả bài bị hạ 3–4,5 dB và mục tiêu −16,5 dB mất ý nghĩa. Giải pháp: bộ giới hạn có nhìn trước 5 ms, chỉ hạ độ lợi quanh các đỉnh.

**Files:**
- Modify: `src/client/media/AudioMix.ts`
- Test: `tests/client/media/AudioMix.test.ts` (thêm)

**Interfaces:**
- Consumes: `mixProgram`, `StereoMix`, `MIX_DEFAULTS` (chặng 2).
- Produces:
  - `applyLimiter(left: Float32Array, right: Float32Array, sampleRate: number, ceiling: number): number` — sửa **tại chỗ**, trả độ lợi giảm lớn nhất (dB, ≤ 0; 0 nếu không đỉnh nào vượt trần). Bảo đảm mọi mẫu sau xử lý `≤ ceiling` (sai số số thực ≤ 1e-6) và mẫu cách đỉnh hơn 2 cửa sổ nhìn trước giữ nguyên.
  - `StereoMix.limiterGainDb: number` (kết quả của `applyLimiter`).
  - Hằng `LIMITER_LOOKAHEAD_SEC = 0.005` (export).

- [ ] **Step 1: Thêm test vào `tests/client/media/AudioMix.test.ts`**

Thêm `applyLimiter` vào dòng import từ `@/client/media/AudioMix`, rồi thêm cuối file:
```ts
describe("applyLimiter", () => {
  const sr = 1000; // cửa sổ nhìn trước = 5 mẫu
  const quiet = (n: number, v = 0.1) => new Float32Array(n).fill(v);

  it("một đỉnh vọt chỉ hạ độ lợi quanh đỉnh, phần còn lại giữ nguyên", () => {
    const left = quiet(2000);
    const right = quiet(2000);
    left[1000] = 1.5;
    right[1000] = 1.5;
    const reductionDb = applyLimiter(left, right, sr, 0.89);
    expect(reductionDb).toBeCloseTo(20 * Math.log10(0.89 / 1.5), 2);
    expect(Math.abs(left[1000] ?? 0)).toBeLessThanOrEqual(0.89 + 1e-6);
    expect(left[995]).toBeCloseTo(0.1, 7);
    expect(left[1005]).toBeCloseTo(0.1, 7);
    expect(left[0]).toBeCloseTo(0.1, 7);
    expect(left[1999]).toBeCloseTo(0.1, 7);
    // độ lợi giảm dần vào đỉnh (không cắt đột ngột)
    expect(left[998] ?? 0).toBeLessThan(0.1);
    expect(left[998] ?? 0).toBeGreaterThan(0.1 * (0.89 / 1.5));
    expect(Array.from(left)).toEqual(Array.from(right));
  });

  it("kênh phải vọt thì cả hai kênh cùng hạ (giữ hình ảnh âm thanh nổi)", () => {
    const left = quiet(500, 0.3);
    const right = quiet(500, 0.3);
    right[250] = 1.2;
    applyLimiter(left, right, sr, 0.89);
    const gain = (left[250] ?? 0) / 0.3;
    expect(gain).toBeLessThan(1);
    expect(Math.abs(right[250] ?? 0)).toBeLessThanOrEqual(0.89 + 1e-6);
    expect(gain).toBeCloseTo((right[250] ?? 0) / 1.2, 6);
  });

  it("đỉnh ở sát đầu và cuối đoạn vẫn không vượt trần", () => {
    const left = quiet(200);
    const right = quiet(200);
    left[0] = 2;
    left[199] = 2;
    applyLimiter(left, right, sr, 0.89);
    expect(Math.abs(left[0] ?? 0)).toBeLessThanOrEqual(0.89 + 1e-6);
    expect(Math.abs(left[199] ?? 0)).toBeLessThanOrEqual(0.89 + 1e-6);
  });

  it("không có mẫu nào vượt trần thì không đổi gì và trả 0 dB", () => {
    const left = quiet(300, 0.5);
    const right = quiet(300, -0.4);
    const before = Array.from(left);
    expect(applyLimiter(left, right, sr, 0.89)).toBe(0);
    expect(Array.from(left)).toEqual(before);
  });
});

describe("mixProgram với bộ giới hạn", () => {
  it("báo độ lợi giảm lớn nhất; chương trình êm thì là 0 dB", () => {
    const quietMix = mixProgram([{ startSec: 0, samples: sine(1, 0.05) }], null, { sampleRate: SR, durationSec: 1 });
    expect(quietMix.limiterGainDb).toBe(0);
    const loud = mixProgram(
      [{ startSec: 0, samples: new Float32Array(1000).fill(0.9) }],
      { channels: [new Float32Array(1000).fill(0.9)], levelBelowVoiceDb: 0 },
      { sampleRate: SR, durationSec: 1, fadeInSec: 0, fadeOutSec: 0, voiceTargetDb: 0 },
    );
    expect(loud.limiterGainDb).toBeLessThan(0);
  });

  it("giọng có đỉnh vọt vẫn giữ mức −16,5 dB ở phần còn lại", () => {
    const voice = sine(20, 0.05); // đủ dài để một đỉnh không làm lệch phép chuẩn hoá RMS quá 0,2 dB
    voice[10000] = 1; // đỉnh cao gấp 20 lần biên độ thường (crest factor lớn)
    const out = mixProgram([{ startSec: 0, samples: voice }], null, { sampleRate: SR, durationSec: 20 });
    const peak = Math.max(...Array.from(out.left).map(Math.abs));
    expect(peak).toBeLessThanOrEqual(MIX_DEFAULTS.ceiling + 1e-6);
    expect(out.limiterGainDb).toBeLessThan(-10); // đỉnh sau chuẩn hoá ≈ 4,2 → hạ khoảng 13 dB, chỉ quanh đỉnh
    // phần xa đỉnh giữ nguyên mức chuẩn hoá (trước đây cả bài bị hạ theo đỉnh)
    expect(rmsDb(slice(out.left, 0, 8))).toBeCloseTo(MIX_DEFAULTS.voiceTargetDb, 0);
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi**

Run: `npx vitest run tests/client/media/AudioMix.test.ts`
Expected: FAIL — `applyLimiter` không được export / `limiterGainDb` undefined.

- [ ] **Step 3: Sửa `src/client/media/AudioMix.ts`**

Thêm sau `fadeGain`:
```ts
export const LIMITER_LOOKAHEAD_SEC = 0.005;

/** Giá trị nhỏ nhất của `gain[j .. j+w-1]` cho mọi j (cửa sổ nhìn về phía trước), O(n). */
function slidingMinAhead(gain: Float32Array, w: number): Float32Array {
  const n = gain.length;
  const out = new Float32Array(n);
  const deque: number[] = [];
  let head = 0;
  for (let j = n - 1; j >= 0; j--) {
    while (deque.length > head && (gain[deque[deque.length - 1] as number] as number) >= (gain[j] as number)) deque.pop();
    deque.push(j);
    while ((deque[head] as number) > j + w - 1) head++;
    out[j] = gain[deque[head] as number] as number;
  }
  return out;
}

/**
 * Bộ giới hạn đỉnh có nhìn trước: độ lợi cần thiết tại mỗi đỉnh được lấy min trong 5 ms phía trước rồi làm mượt
 * bằng trung bình 5 ms, nên độ lợi giảm dần vào đỉnh và hồi lại ngay sau đó, phần còn lại của bài không bị hạ.
 * Sửa tại chỗ; trả độ lợi giảm lớn nhất (dB, ≤ 0).
 */
export function applyLimiter(left: Float32Array, right: Float32Array, sampleRate: number, ceiling: number): number {
  const n = left.length;
  const need = new Float32Array(n);
  let anyOver = false;
  for (let i = 0; i < n; i++) {
    const peak = Math.max(Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0));
    if (peak > ceiling) {
      need[i] = ceiling / peak;
      anyOver = true;
    } else {
      need[i] = 1;
    }
  }
  if (!anyOver) return 0;

  const w = Math.max(1, Math.round(LIMITER_LOOKAHEAD_SEC * sampleRate));
  const ahead = slidingMinAhead(need, w);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = (prefix[i] as number) + (ahead[i] as number);
  const first = ahead[0] as number;

  let minGain = 1;
  for (let i = 0; i < n; i++) {
    const from = i - w + 1;
    const inside = (prefix[i + 1] as number) - (prefix[Math.max(0, from)] as number);
    const padded = from < 0 ? -from * first : 0;
    const gain = (inside + padded) / w;
    left[i] = (left[i] ?? 0) * gain;
    right[i] = (right[i] ?? 0) * gain;
    if (gain < minGain) minGain = gain;
  }
  return 20 * Math.log10(minGain);
}
```

Thêm `limiterGainDb: number;` vào `interface StereoMix`. Trong `mixProgram` thay khối "let peak = 0; … return { left, right, sampleRate: sr };" (từ dòng `let peak = 0;` đến hết hàm) bằng:
```ts
  const limiterGainDb = applyLimiter(left, right, sr, ceiling);
  return { left, right, sampleRate: sr, limiterGainDb };
```

- [ ] **Step 4: Chạy test, typecheck, lint**

Run: `npx vitest run` → PASS (kể cả 7 test AudioMix cũ, đặc biệt "không vượt trần đỉnh"). `npm run typecheck`, `npm run lint` → sạch.
> Nếu test cũ "không vượt trần đỉnh" hoặc "nhạc stereo giữ hai kênh riêng" thất bại, KHÔNG sửa kỳ vọng: báo số thực tế và chẩn đoán.

- [ ] **Step 5: Commit** (điều phối viên) — `feat(media): bộ giới hạn đỉnh có nhìn trước thay cho hạ cả bản trộn`

---

### Task 4: Kiểm tra khả năng của worker trước khi tạo giọng (`probe`)

**Vấn đề (review chặng 2):** `BrowserSupport` chỉ kiểm ở luồng chính; thiếu `self.fonts` hay canvas 2D trong worker chỉ lộ ra sau khi đã gọi đủ lệnh TTS tốn tiền. Thêm thông điệp `probe` để giao diện hỏi worker trước.

**Files:**
- Create: `src/client/render/workerProbe.ts`
- Modify: `src/client/render/RenderJob.ts`, `src/client/render/RenderClient.ts`, `src/client/render/render.worker.ts`
- Test: `tests/client/render/workerProbe.test.ts`, `tests/client/render/RenderClient.test.ts` (thêm)

**Interfaces:**
- Consumes: `WorkerLike`, `RenderClient` (chặng 2).
- Produces:
  - `probeWorkerScope(scope: { fonts?: unknown; OffscreenCanvas?: unknown }, create2dContext: () => unknown): string[]` — danh sách thứ còn thiếu (tiếng Việt: `"Nạp font trong worker"`, `"OffscreenCanvas"`, `"Canvas 2D trong worker"`), rỗng nếu đủ.
  - `WorkerRequest = { type: "start"; job } | { type: "probe" }`; `WorkerMessage` thêm `{ type: "probe-result"; missing: string[] }`.
  - `RenderClient.probe(): Promise<string[]>` — tạo worker riêng, hỏi, đóng worker. Lỗi nạp worker → reject `Error("Lỗi bộ dựng: …")`.

- [ ] **Step 1: Viết test**

`tests/client/render/workerProbe.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { probeWorkerScope } from "@/client/render/workerProbe";

const ctx = () => ({});

describe("probeWorkerScope", () => {
  it("đủ khả năng thì không thiếu gì", () => {
    expect(probeWorkerScope({ fonts: {}, OffscreenCanvas: class {} }, ctx)).toEqual([]);
  });

  it("thiếu fonts", () => {
    expect(probeWorkerScope({ OffscreenCanvas: class {} }, ctx)).toEqual(["Nạp font trong worker"]);
  });

  it("thiếu OffscreenCanvas thì không thử tạo canvas", () => {
    let called = false;
    const missing = probeWorkerScope({ fonts: {} }, () => {
      called = true;
      return {};
    });
    expect(missing).toEqual(["OffscreenCanvas"]);
    expect(called).toBe(false);
  });

  it("không cấp được context 2D (null hoặc ném lỗi)", () => {
    expect(probeWorkerScope({ fonts: {}, OffscreenCanvas: class {} }, () => null)).toEqual(["Canvas 2D trong worker"]);
    expect(
      probeWorkerScope({ fonts: {}, OffscreenCanvas: class {} }, () => {
        throw new Error("x");
      }),
    ).toEqual(["Canvas 2D trong worker"]);
  });

  it("thiếu nhiều thứ thì liệt kê đủ", () => {
    expect(probeWorkerScope({}, ctx)).toEqual(["Nạp font trong worker", "OffscreenCanvas"]);
  });
});
```

Thêm vào cuối `describe("RenderClient", …)` trong `tests/client/render/RenderClient.test.ts` (dùng `FakeWorker` và `job` đã có):
```ts
  it("probe: gửi yêu cầu, trả danh sách thiếu và đóng worker", async () => {
    const w = new FakeWorker();
    const promise = new RenderClient(() => w).probe();
    expect(w.sent).toEqual([{ type: "probe" }]);
    w.emit({ type: "probe-result", missing: ["Nạp font trong worker"] });
    await expect(promise).resolves.toEqual(["Nạp font trong worker"]);
    expect(w.terminated).toBe(true);
  });

  it("probe: lỗi nạp worker thì reject và đóng worker", async () => {
    const w = new FakeWorker();
    const promise = new RenderClient(() => w).probe();
    w.onerror?.({ message: "không nạp được" });
    await expect(promise).rejects.toThrow("Lỗi bộ dựng: không nạp được");
    expect(w.terminated).toBe(true);
  });

  it("probe không làm hỏng lần dựng đang chạy: thông điệp probe-result lạ bị bỏ qua", async () => {
    const w = new FakeWorker();
    const promise = new RenderClient(() => w).render(job);
    w.emit({ type: "probe-result", missing: [] });
    const blob = new Blob(["x"]);
    w.emit({ type: "done", blob, durationSec: 1 });
    await expect(promise).resolves.toEqual({ blob, durationSec: 1 });
  });
```

- [ ] **Step 2: Chạy để thấy lỗi**

Run: `npx vitest run tests/client/render/workerProbe.test.ts tests/client/render/RenderClient.test.ts`
Expected: FAIL — không tìm thấy module / `probe` không tồn tại. Ghi lại.

- [ ] **Step 3: Viết code**

`src/client/render/workerProbe.ts`:
```ts
export interface ProbeScope {
  fonts?: unknown;
  OffscreenCanvas?: unknown;
}

/** Danh sách khả năng mà worker dựng video cần nhưng trình duyệt chưa có (rỗng nếu đủ). */
export function probeWorkerScope(scope: ProbeScope, create2dContext: () => unknown): string[] {
  const missing: string[] = [];
  if (!scope.fonts) missing.push("Nạp font trong worker");
  if (typeof scope.OffscreenCanvas === "undefined") {
    missing.push("OffscreenCanvas");
    return missing;
  }
  let context: unknown = null;
  try {
    context = create2dContext();
  } catch {
    context = null;
  }
  if (!context) missing.push("Canvas 2D trong worker");
  return missing;
}
```

`src/client/render/RenderJob.ts`: đổi
```ts
export type WorkerRequest = { type: "start"; job: RenderJob } | { type: "probe" };
```
và thêm một nhánh vào `WorkerMessage`:
```ts
  | { type: "probe-result"; missing: string[] }
```

`src/client/render/RenderClient.ts`: trong `render()` thay phần nhánh cuối của `worker.onmessage` để xử lý tường minh:
```ts
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === "progress") onProgress?.(m);
        else if (m.type === "done") {
          finish();
          resolve({ blob: m.blob, durationSec: m.durationSec });
        } else if (m.type === "error") {
          finish();
          reject(new Error(m.message));
        }
      };
```
(giữ nguyên các phần `onerror`, `onmessageerror`, `postMessage` đang có), rồi thêm phương thức:
```ts
  probe(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const worker = this.createWorker();
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === "probe-result") {
          worker.terminate();
          resolve(m.missing);
        } else if (m.type === "error") {
          worker.terminate();
          reject(new Error(m.message));
        }
      };
      worker.onerror = (e) => {
        worker.terminate();
        reject(new Error(`Lỗi bộ dựng: ${e.message ?? "không rõ"}`));
      };
      try {
        worker.postMessage({ type: "probe" });
      } catch {
        worker.terminate();
        reject(new Error("Không gửi được dữ liệu cho bộ dựng"));
      }
    });
  }
```

`src/client/render/render.worker.ts`: thêm `import { probeWorkerScope, type ProbeScope } from "./workerProbe";` và thay khối `scope.onmessage = …` cuối file bằng:
```ts
scope.onmessage = (event) => {
  if (event.data.type === "probe") {
    scope.postMessage({
      type: "probe-result",
      missing: probeWorkerScope(globalThis as unknown as ProbeScope, () => new OffscreenCanvas(1, 1).getContext("2d")),
    });
    return;
  }
  if (event.data.type !== "start") return;
  render(event.data.job).catch((error: unknown) => {
    scope.postMessage({ type: "error", message: error instanceof Error ? error.message : "Dựng video thất bại" });
  });
};
```

- [ ] **Step 4: Chạy test, typecheck, lint, build**

Run: `npx vitest run` → PASS. `npm run typecheck`, `npm run lint`, `npm run build` → sạch.
> `render.worker.ts` không test được trên Node; chỉ typecheck + build. Nói rõ trong report.

- [ ] **Step 5: Commit** (điều phối viên) — `feat(render): probe khả năng của worker trước khi tạo giọng`

---

### Task 5: Cắt khoảng lặng đầu/cuối của giọng đọc (`trimSilence`)

**Vấn đề (review chặng 2):** mỗi câu TTS có độ trễ đầu của bộ mã MP3 và khoảng lặng đuôi, cộng thêm vào khoảng nghỉ 0,35 s nên nhịp chậm hơn video mẫu. Cần hàm thuần cắt lặng để lấy độ dài giọng thật cho `Timeline`.

**Files:**
- Create: `src/client/media/audioTrim.ts`
- Test: `tests/client/media/audioTrim.test.ts`

**Interfaces:**
- Consumes: `dbToGain` (từ `AudioMix.ts`).
- Produces:
  - `interface TrimResult { samples: Float32Array; leadTrimSec: number; tailTrimSec: number }`
  - `interface TrimOptions { thresholdDb?: number; padSec?: number }` (mặc định `−45` dB và `0.04` s)
  - `trimSilence(samples: Float32Array, sampleRate: number, options?: TrimOptions): TrimResult` — `samples` trả về là **bản sao gọn** (`slice`, không phải `subarray`) để gửi worker không kéo theo cả bộ đệm gốc. Không có mẫu nào vượt ngưỡng (toàn lặng) → trả nguyên mảng gốc, hai số cắt bằng 0.

- [ ] **Step 1: Viết test `tests/client/media/audioTrim.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { trimSilence } from "@/client/media/audioTrim";

const SR = 1000;
function clip(leadSec: number, voiceSec: number, tailSec: number, amp = 0.3): Float32Array {
  const a = new Float32Array(Math.round((leadSec + voiceSec + tailSec) * SR));
  for (let i = Math.round(leadSec * SR); i < Math.round((leadSec + voiceSec) * SR); i++) a[i] = amp * Math.sin(i);
  return a;
}

describe("trimSilence", () => {
  it("cắt lặng đầu/cuối, chừa 40 ms mỗi đầu", () => {
    const r = trimSilence(clip(0.5, 1, 0.8), SR);
    expect(r.samples.length).toBe(Math.round((1 + 0.08) * SR));
    expect(r.leadTrimSec).toBeCloseTo(0.5 - 0.04, 3);
    expect(r.tailTrimSec).toBeCloseTo(0.8 - 0.04, 3);
  });

  it("không có lặng thì không cắt", () => {
    const original = clip(0, 1, 0);
    const r = trimSilence(original, SR);
    expect(r.samples.length).toBe(original.length);
    expect(r.leadTrimSec).toBe(0);
    expect(r.tailTrimSec).toBe(0);
  });

  it("lặng ít hơn phần chừa thì cắt tối đa phần có thể", () => {
    const r = trimSilence(clip(0.02, 1, 0.02), SR);
    expect(r.samples.length).toBe(Math.round(1.04 * SR));
    expect(r.leadTrimSec).toBe(0);
    expect(r.tailTrimSec).toBe(0);
  });

  it("toàn lặng thì trả nguyên mảng gốc", () => {
    const silent = new Float32Array(500);
    const r = trimSilence(silent, SR);
    expect(r.samples).toBe(silent);
    expect(r.leadTrimSec).toBe(0);
    expect(r.tailTrimSec).toBe(0);
  });

  it("kết quả là bản sao gọn, không dùng chung bộ đệm với mảng gốc", () => {
    const original = clip(0.5, 1, 0.5);
    const r = trimSilence(original, SR);
    expect(r.samples.buffer).not.toBe(original.buffer);
    expect(r.samples.byteLength).toBe(r.samples.buffer.byteLength);
  });

  it("tôn trọng ngưỡng: tiếng nhỏ hơn ngưỡng mặc định bị coi là toàn lặng, hạ ngưỡng xuống thì cắt đúng", () => {
    const quietVoice = clip(0.3, 1, 0.3, 0.003); // ≈ −50 dB, thấp hơn ngưỡng mặc định −45 dB
    expect(trimSilence(quietVoice, SR).samples).toBe(quietVoice); // không mẫu nào qua ngưỡng → trả nguyên gốc
    expect(trimSilence(quietVoice, SR, { thresholdDb: -40 }).samples).toBe(quietVoice);
    const lowered = trimSilence(quietVoice, SR, { thresholdDb: -60 }); // ngưỡng 0,001 < biên độ 0,003
    expect(lowered.leadTrimSec).toBeCloseTo(0.3 - 0.04, 2);
    expect(lowered.tailTrimSec).toBeCloseTo(0.3 - 0.04, 2);
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/media/audioTrim.test.ts` → FAIL (không tìm thấy module).

- [ ] **Step 3: Viết `src/client/media/audioTrim.ts`**

```ts
import { dbToGain } from "./AudioMix";

export interface TrimOptions {
  thresholdDb?: number;
  padSec?: number;
}

export interface TrimResult {
  samples: Float32Array;
  leadTrimSec: number;
  tailTrimSec: number;
}

const DEFAULT_THRESHOLD_DB = -45;
const DEFAULT_PAD_SEC = 0.04;

/** Cắt khoảng lặng đầu/cuối (mẫu dưới ngưỡng), chừa `padSec` mỗi đầu. Trả bản sao gọn để gửi worker không kéo theo bộ đệm gốc. */
export function trimSilence(samples: Float32Array, sampleRate: number, options: TrimOptions = {}): TrimResult {
  const gate = dbToGain(options.thresholdDb ?? DEFAULT_THRESHOLD_DB);
  const pad = Math.round((options.padSec ?? DEFAULT_PAD_SEC) * sampleRate);

  let first = -1;
  let last = -1;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i] ?? 0) >= gate) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return { samples, leadTrimSec: 0, tailTrimSec: 0 };

  const from = Math.max(0, first - pad);
  const to = Math.min(samples.length, last + 1 + pad);
  if (from === 0 && to === samples.length) return { samples: samples.slice(), leadTrimSec: 0, tailTrimSec: 0 };
  return {
    samples: samples.slice(from, to),
    leadTrimSec: from / sampleRate,
    tailTrimSec: (samples.length - to) / sampleRate,
  };
}
```

- [ ] **Step 4: Chạy test, typecheck, lint** — `npx vitest run` → PASS; sạch.
> Test "không có lặng thì không cắt" kỳ vọng `samples.length` bằng gốc và hai số cắt 0 (hàm trả `slice()` khi không cắt gì).

- [ ] **Step 5: Commit** (điều phối viên) — `feat(media): cắt khoảng lặng đầu/cuối giọng đọc`

---

### Task 6: Dòng nguồn tin không đè logo góc phải

**Vấn đề (review chặng 2):** dòng "THEO: …" không có giới hạn bề ngang; nguồn tin dài đè lên logo kênh ở góc phải của cảnh thân bài.

**Files:**
- Modify: `src/templates/theanh28/layout.ts`, `src/templates/theanh28/TheAnh28Template.ts`
- Test: `tests/templates/theanh28/TheAnh28Template.test.ts` (thêm)

**Interfaces:**
- Consumes: `wrapText`, `LAYOUT`, `TheAnh28Template` (chặng 2).
- Produces: `LAYOUT.credit.rightMargin = 40`, `LAYOUT.credit.gapToLogo = 24`; dòng nguồn tin bị cắt có dấu `…` để không vượt: cảnh mở đầu `1080 − 40 − 110 = 930 px`; cảnh thân bài `(trái huy hiệu logo) − 24 − 110 px`.

- [ ] **Step 1: Thêm test vào cuối `tests/templates/theanh28/TheAnh28Template.test.ts`** (dùng `project`, `scene`, `draw` ở đầu file; `RecordingCanvas.measureText` = số ký tự × cỡ chữ × 0,5 nên chữ 26 px rộng 13 px/ký tự)

```ts
describe("TheAnh28Template — dòng nguồn tin dài", () => {
  const longCredit = Array.from({ length: 40 }, (_, i) => `Báo${i}`).join(" ");
  const creditText = (c: ReturnType<typeof draw>) =>
    String(c.ops("fillText").find((x) => String(x.args[0]).startsWith("THEO:"))?.args[0]);

  it("cảnh thân bài: cắt bằng dấu … và không chạm logo góc phải", () => {
    // tên kênh "28 NEWS" (7 ký tự × 46 × 0,5 = 161 px) → chữ bắt đầu x=823, huy hiệu x=745 → vùng cho phép 745 − 24 − 110 = 611 px
    const text = creditText(draw(project({ sourceCredit: longCredit }), scene()));
    expect(text.endsWith("…")).toBe(true);
    expect(text.length * 13).toBeLessThanOrEqual(611);
    expect(text.length * 13).toBeGreaterThan(611 - 100);
  });

  it("cảnh mở đầu: rộng hơn (không có logo góc phải), tối đa 930 px", () => {
    const text = creditText(draw(project({ sourceCredit: longCredit }), scene({ role: "intro" })));
    expect(text.endsWith("…")).toBe(true);
    expect(text.length * 13).toBeLessThanOrEqual(930);
    expect(text.length * 13).toBeGreaterThan(930 - 100);
  });

  it("nguồn tin ngắn giữ nguyên, dòng ẢNH: TỔNG HỢP không bị đổi", () => {
    const c = draw(project(), scene());
    expect(creditText(c)).toBe("THEO: ĐỨC PHONG - VIETNAMNET");
    expect(c.texts()).toContain("ẢNH: TỔNG HỢP");
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/templates/theanh28/TheAnh28Template.test.ts` → FAIL (chuỗi dài không có `…`).

- [ ] **Step 3: Sửa `layout.ts`**: trong `LAYOUT.credit` thêm hai trường (giữ các trường cũ):
```ts
  credit: { x: 110, y: 240, lineHeight: 40, fontPx: 26, rightMargin: 40, gapToLogo: 24 },
```

- [ ] **Step 4: Sửa `TheAnh28Template.ts`**

Thay toàn bộ `drawOverlay` và `drawCornerLogo` bằng ba phương thức dưới (xoá `drawCornerLogo` cũ):
```ts
  protected drawOverlay(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void {
    const C = LAYOUT.credit;
    // vùng cho phép của dòng nguồn tin: tới mép trái huy hiệu logo (cảnh thân bài) hoặc mép phải khung (cảnh mở đầu)
    const limit =
      (scene.role === "body" ? this.cornerLogoBox(ctx, project).badgeX - C.gapToLogo : LAYOUT.frame.width - C.rightMargin) -
      C.x;
    ctx.font = font(600, C.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const measure = (s: string) => ctx.measureText(s).width;
    const lines = project.sourceCredit ? [`THEO: ${upper(project.sourceCredit)}`, "ẢNH: TỔNG HỢP"] : ["ẢNH: TỔNG HỢP"];
    lines.forEach((line, i) => ctx.fillText(wrapText(line, limit, measure, 1)[0] ?? "", C.x, C.y + i * C.lineHeight));
    if (scene.role === "body") this.drawCornerLogo(ctx, project);
  }

  /** Vị trí huy hiệu logo và chữ tên kênh ở góc trên phải (cảnh thân bài). Đặt font của ctx về font tên kênh. */
  private cornerLogoBox(ctx: Canvas2D, project: ProjectFrame): { name: string; textX: number; badgeX: number } {
    const G = LAYOUT.logo;
    const name = this.channelName(project);
    ctx.font = font(800, G.fontPx);
    const textX = LAYOUT.frame.width - G.right - ctx.measureText(name).width;
    return { name, textX, badgeX: textX - G.gap - G.size };
  }

  private drawCornerLogo(ctx: Canvas2D, project: ProjectFrame): void {
    const G = LAYOUT.logo;
    const { name, textX, badgeX } = this.cornerLogoBox(ctx, project);
    this.drawLogoBadge(ctx, project, badgeX, G.y, G.size);
    ctx.font = font(800, G.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(name, textX, G.y + G.size / 2);
  }
```

- [ ] **Step 5: Chạy test, typecheck, lint** — `npx vitest run` → PASS (các test cũ về `THEO:`/`ẢNH:` và logo góc phải vẫn đạt); sạch.
> `wrapText` không cắt được một từ đơn dài hơn vùng cho phép (chỉ ngắt ở khoảng trắng). Ghi trong report nếu thấy; không xử lý thêm (YAGNI).

- [ ] **Step 6: Commit** (điều phối viên) — `fix(templates): dòng nguồn tin không đè logo góc phải`

---

### Task 7: Kiểm thật và đo lại tốc độ (điều phối viên tự làm, không giao agent)

**Files:** không sửa code (trừ khi đo ra vấn đề). Ghi số đo vào `.superpowers/sdd/task-7-report.md` và đặc tả mục 12.

- [ ] **Step 1: Chuẩn bị**
  - `rm -rf .next`, mở dev server bằng `preview_start` tên `tin-video-studio`.
  - **Dựng trong một tab riêng** (`tabs_create` rồi `navigate` tới `/dev/dung-thu`): khung xem trước của ứng dụng đôi khi tự quay về `/studio` giữa lúc dựng. Đăng nhập bằng tài khoản `hai` (mật khẩu ở dòng `DEV_LOGIN` trong `.env.local`).
  - `.env.local` có `EDGE_TTS_DEV=1`, `EDGE_TTS_BIN=C:/Python314/Scripts/edge-tts.exe`. Nếu danh sách giọng vẫn là giọng giả, chạy `fetch('/api/tts/voices',{cache:'reload'})` rồi tải lại trang.
- [ ] **Step 2: Đo thời gian dựng.** Trong tab, ghi `t0 = performance.now()` ngay khi bấm "Dựng video"; khi `[data-testid=ket-qua]` xuất hiện ghi `t1`. Trừ thời gian tạo giọng (đọc từ log server hoặc đo riêng): thời gian dựng hình = từ lúc nhãn đổi sang "Dựng hình" đến khi xong. Baseline chặng 2: **37 s video mất ~100 s (≈ 2,7×, ≈ 11 khung/s)**. Mục tiêu chặng 3A: **≤ 1,5× thời lượng**. Ghi số đo thật.
- [ ] **Step 3: Kiểm hình.** Tua tới cảnh mở đầu, một cảnh ảnh thân bài, một cảnh video thân bài: nền mờ phía sau phải **nhìn mờ mượt** (không vỡ ô vuông), dải ảnh rõ, logo và dòng nguồn tin không chồng nhau. Chụp màn hình các mốc.
- [ ] **Step 4: Kiểm âm.** Dùng đoạn đo RMS trong `javascript_tool` (decode `fetch(video.src)` bằng `OfflineAudioContext(2,1,48000)`): giọng thật (Hoài My) phải ≈ −16,5…−17,5 dB ở phần có tiếng; đỉnh < 0,89. So với chặng 2 (−17,3 dB, đỉnh 0,72).
- [ ] **Step 5: Kiểm huỷ và dựng lại** (như chặng 2).
- [ ] **Step 6: `probe` chưa kiểm trên trình duyệt thật.** Chặng 3C mới gọi `RenderClient.probe()` từ giao diện; ghi rõ điều này trong báo cáo và nhắc kiểm ở 3C (chỉ có test đơn vị với worker giả và typecheck/build ở 3A).
- [ ] **Step 7: Nếu chưa đạt ≤ 1,5×:** đo chi phí từng phần (tắt vẽ hoạ tiết chấm, hạ bitrate 8 → 5 Mbps, hạ `maxSide` video về 720) bằng cách sửa tạm rồi hoàn lại; ghi số đo và đề xuất, KHÔNG tự đổi ràng buộc. Báo cho Hải quyết.
- [ ] **Step 8: Ghi số đo vào đặc tả mục 12** (thêm đoạn "Kết quả đo chặng 3A") và commit (điều phối viên).

---

## Hoàn thành chặng 3A khi

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` sạch.
- Task 7 có số đo thật; tốc độ dựng ghi rõ so với baseline 2,7× (đạt hoặc có đề xuất cụ thể).
- Hải duyệt. Sau đó thực thi chặng 3B (lớp dữ liệu + dịch vụ; kế hoạch `2026-10-15-03b-chang-3b-lop-du-lieu.md`) và viết kế hoạch 3C (5 bước giao diện) từ code thật.

## Rủi ro đã biết

- Nền mờ thu nhỏ rồi phóng có thể trông kém mượt hơn blur 48 px ở vài ảnh; nếu vậy tăng kích thước bề mặt lên 270×480 (chỉ đổi hai tham số của `CanvasBackdropMaker`).
- `OffscreenCanvasRenderingContext2D.imageSmoothingQuality` có thể bị trình duyệt bỏ qua; nội suy mặc định vẫn cho nền mờ chấp nhận được.
- Bộ giới hạn nhìn trước làm mượt bằng trung bình hộp 5 ms: đỉnh nhọn cực ngắn vẫn được đảm bảo không vượt trần, nhưng giọng có nhiều đỉnh dồn dập sẽ bị hạ nhẹ thêm; đo lại với giọng thật (Google/MiniMax) khi có key.
