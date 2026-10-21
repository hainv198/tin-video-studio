import { describe, expect, it } from "vitest";
import { BrandKit } from "@/domain/BrandKit";
import { DEFAULT_TIMELINE_CONFIG, Timeline } from "@/domain/Timeline";
import type { BackdropMaker } from "@/client/render/BackdropMaker";
import { RenderCancelledError } from "@/client/render/errors";
import { VideoRenderer, type FrameProvider, type RenderScene, type VideoFrameSink } from "@/client/render/VideoRenderer";
import {
  NATIVE_PORTRAIT_MEDIA,
  SOURCE_CLIP_MEDIA,
  VideoTemplate,
  type DrawableImage,
  type ProjectFrame,
  type SceneFrame,
  type SceneMedia,
} from "@/templates/VideoTemplate";
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
    expect(template.frames[0]?.voiceStart).toBeCloseTo(0.3, 9);
    expect(template.frames[0]?.voiceDuration).toBeCloseTo(0.7, 9);
    expect(template.frames[14]?.voiceStart).toBeCloseTo(0, 9);
    expect(template.frames[14]?.voiceDuration).toBeCloseTo(0.5, 9);
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

  it("mặc định: thời gian cảnh trám trùng thời gian đoạn", async () => {
    const { renderer, template } = setup();
    await renderer.render();
    for (const f of template.frames) {
      expect(f.footageTime).toBe(f.sceneTime);
      expect(f.footageDuration).toBe(f.sceneDuration);
    }
  });

  describe("đoạn dùng tiếp cảnh đoạn trước", () => {
    // a: 0 → 1,35 ; b: 1,35 → 2,2 ; c: 2,2 → 3,3 (33 khung ở 10 fps)
    function shared(ownerPlayback: RenderScene["playback"]) {
      const timeline = Timeline.build([
        { sceneId: "a", durationSec: 0.7 },
        { sceneId: "b", durationSec: 0.5 },
        { sceneId: "c", durationSec: 0.5 },
      ]);
      const ownerFrames = new CountingFrames();
      const otherFrames = new CountingFrames();
      const scenes = new Map<string, RenderScene>([
        ["a", { sceneId: "a", role: "body", text: "A", playback: ownerPlayback, frames: ownerFrames }],
        ["b", { sceneId: "b", role: "body", text: "B", playback: { mode: "none" }, frames: null, footageFrom: "a" }],
        ["c", { sceneId: "c", role: "body", text: "C", playback: { mode: "still" }, frames: otherFrames }],
      ]);
      const template = new LogTemplate();
      const renderer = new VideoRenderer({ template, ctx: new RecordingCanvas().asCanvas(), project, timeline, scenes, fps: 10, sink: new Sink() });
      return { renderer, template, ownerFrames, otherFrames, timeline };
    }

    it("dùng chung ảnh của chủ cảnh; thời gian cảnh trám liên tục qua biên đoạn, phụ đề/thời gian đoạn vẫn theo từng đoạn", async () => {
      const { renderer, template, ownerFrames } = shared({ mode: "still" });
      await renderer.render();
      const atBoundary = template.frames[13]!; // t = 1,3 (đoạn a)
      const after = template.frames[14]!; // t = 1,4 (đoạn b)
      expect(after.text).toBe("B");
      expect(after.image).toBe(ownerFrames.image);
      expect(after.sceneTime).toBeCloseTo(0.05, 9);
      expect(after.sceneDuration).toBeCloseTo(0.85, 9);
      expect(after.footageTime).toBeCloseTo(1.4, 9);
      expect(after.footageDuration).toBeCloseTo(2.2, 9);
      expect(atBoundary.footageDuration).toBeCloseTo(2.2, 9);
      const group = template.frames.slice(0, 22).map((f) => (f.footageTime ?? 0) / (f.footageDuration ?? 1));
      for (let i = 1; i < group.length; i++) expect(group[i]!).toBeGreaterThan(group[i - 1]!);
      expect(template.frames[22]!.footageTime).toBeCloseTo(0, 9); // đoạn c có cảnh riêng: bắt đầu lại
      expect(template.frames[22]!.image).not.toBe(ownerFrames.image);
    });

    it("video của chủ cảnh đọc khung tiếp nối theo thời gian nhóm, không tua về đầu; chỉ nhả khi hết nhóm", async () => {
      const { renderer, ownerFrames, otherFrames } = shared({ mode: "clip", sourceDurationSec: 10 });
      let releasesWhenCStarted = -1;
      const original = otherFrames.frameAt.bind(otherFrames);
      otherFrames.frameAt = async (t: number) => {
        if (otherFrames.asked.length === 0) releasesWhenCStarted = ownerFrames.releases;
        return original(t);
      };
      await renderer.render();
      expect(ownerFrames.asked).toHaveLength(22);
      for (let i = 1; i < ownerFrames.asked.length; i++) expect(ownerFrames.asked[i]!).toBeGreaterThan(ownerFrames.asked[i - 1]!);
      expect(ownerFrames.asked[14]).toBeCloseTo(1.4, 9);
      expect(releasesWhenCStarted).toBe(1);
      expect(ownerFrames.releases).toBe(1);
    });
  });
});

describe("VideoRenderer — media của cảnh", () => {
  it("truyền media của cảnh vào khung vẽ; cảnh không có media thì undefined", async () => {
    const template = new LogTemplate();
    const frames = new CountingFrames();
    const timeline = Timeline.build([{ sceneId: "a", durationSec: 0.2 }, { sceneId: "clip", durationSec: 0.3, silent: true }], {
      leadInSec: 0,
      gapSec: 0,
      tailSec: 0,
    });
    const scenes = new Map<string, RenderScene>([
      ["a", { sceneId: "a", role: "intro", text: "T", playback: { mode: "still", stillAtSec: 0.1 }, frames }],
      ["clip", { sceneId: "clip", role: "body", text: "", playback: { mode: "clip", sourceDurationSec: 0.3 }, frames, media: SOURCE_CLIP_MEDIA }],
    ]);
    await new VideoRenderer({ template, ctx: new RecordingCanvas().asCanvas(), project, timeline, scenes, fps: 10, sink: new Sink() }).render();
    expect(template.frames[0]?.media).toBeUndefined();
    expect(template.frames.at(-1)?.media).toEqual(SOURCE_CLIP_MEDIA);
    expect(frames.asked[0]).toBeCloseTo(0.1, 9); // ảnh tĩnh thẻ đầu tại stillAtSec
    expect(frames.asked.at(-1)).toBeCloseTo(0.2, 9); // khung cuối của video: 0,2 s sau khi bắt đầu
  });

  it("video 9:16 gốc (phủ toàn khung): không tạo nền mờ mỗi khung; video khổ khác vẫn tạo", async () => {
    const renderWith = async (media: SceneMedia) => {
      let made = 0;
      const template = new LogTemplate();
      const timeline = Timeline.build([{ sceneId: "clip", durationSec: 0.3, silent: true }], { leadInSec: 0, gapSec: 0, tailSec: 0 });
      await new VideoRenderer({
        template,
        ctx: new RecordingCanvas().asCanvas(),
        project,
        timeline,
        scenes: new Map<string, RenderScene>([
          ["clip", { sceneId: "clip", role: "body", text: "", playback: { mode: "clip", sourceDurationSec: 0.3 }, frames: new CountingFrames(), media }],
        ]),
        fps: 10,
        sink: new Sink(),
        backdrop: {
          make() {
            made++;
            return { source: {} as CanvasImageSource, width: 1, height: 1 };
          },
        },
      }).render();
      return { made, backdrops: template.frames.map((f) => f.backdrop ?? null) };
    };
    const full = await renderWith(NATIVE_PORTRAIT_MEDIA);
    expect(full.made).toBe(0);
    expect(full.backdrops.every((b) => b === null)).toBe(true);
    expect((await renderWith(SOURCE_CLIP_MEDIA)).made).toBe(3);
  });
});

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
