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
  readonly image: DrawableImage = { source: {} as CanvasImageSource, width: 10, height: 10 };
  async frameAt(t: number) {
    this.asked.push(t);
    return this.image;
  }
  dispose(): void {}
}

class Sink implements VideoFrameSink {
  readonly stamps: number[] = [];
  async add(ts: number, dur: number) {
    this.stamps.push(ts);
    expect(dur).toBeCloseTo(1 / 10, 9);
  }
}

const project: ProjectFrame = {
  displayTitle: "T",
  sourceCredit: "",
  publishDateText: "14/10/2026",
  brand: BrandKit.create("log", [], {}),
  logo: null,
};

function setup(signal?: AbortSignal) {
  // a: 0 → 0.3+0.7+0.35 = 1.35 ; b: 1.35 → 1.35+0.5+0.6 = 2.45  ⇒ 25 khung ở 10 fps
  const timeline = Timeline.build([
    { sceneId: "a", durationSec: 0.7 },
    { sceneId: "b", durationSec: 0.5 },
  ]);
  const videoFrames = new CountingFrames();
  const scenes = new Map<string, RenderScene>([
    ["a", { sceneId: "a", role: "intro", text: "A", playback: { mode: "still" }, frames: new CountingFrames() }],
    ["b", { sceneId: "b", role: "body", text: "B", playback: { mode: "loop", sourceDurationSec: 0.4 }, frames: videoFrames }],
  ]);
  const template = new LogTemplate();
  const sink = new Sink();
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
    signal,
  });
  return { renderer, template, sink, progress, videoFrames };
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
    const { renderer } = setup(controller.signal);
    await expect(renderer.render()).rejects.toBeInstanceOf(RenderCancelledError);
  });
});
