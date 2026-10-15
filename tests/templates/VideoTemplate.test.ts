import { describe, expect, it } from "vitest";
import { BrandKit } from "@/domain/BrandKit";
import { DEFAULT_TIMELINE_CONFIG } from "@/domain/Timeline";
import type { Canvas2D } from "@/templates/Canvas2D";
import { VideoTemplate, type ProjectFrame, type SceneFrame } from "@/templates/VideoTemplate";
import { RecordingCanvas } from "../helpers/RecordingCanvas";

class SpyTemplate extends VideoTemplate {
  readonly id = "spy";
  readonly name = "Spy";
  readonly brandFields = [];
  readonly fonts = [];
  readonly defaults = { width: 1080, height: 1920, fps: 30, timeline: DEFAULT_TIMELINE_CONFIG, fallbackKeyword: "news" };
  readonly seen: string[] = [];
  protected drawIntro(ctx: Canvas2D): void {
    this.seen.push("intro");
    ctx.fillRect(0, 0, 1, 1);
  }
  protected drawBody(): void {
    this.seen.push("body");
  }
  protected drawOverlay(_ctx: Canvas2D, _p: ProjectFrame, scene: SceneFrame): void {
    this.seen.push(`overlay:${scene.role}`);
  }
}

const project: ProjectFrame = {
  displayTitle: "Tiêu đề",
  sourceCredit: "",
  publishDateText: "14/10/2026",
  brand: BrandKit.create("spy", [], {}),
  logo: null,
};
const scene = (role: "intro" | "body"): SceneFrame => ({ role, text: "x", image: null, sceneTime: 0, sceneDuration: 1 });

describe("VideoTemplate.drawFrame", () => {
  it("cảnh mở đầu gọi drawIntro rồi overlay, bọc trong save/restore", () => {
    const t = new SpyTemplate();
    const c = new RecordingCanvas();
    t.drawFrame(c.asCanvas(), project, scene("intro"));
    expect(t.seen).toEqual(["intro", "overlay:intro"]);
    expect(c.calls.map((x) => x.op)).toEqual(["save", "fillRect", "restore"]);
  });

  it("cảnh thân bài gọi drawBody rồi overlay", () => {
    const t = new SpyTemplate();
    t.drawFrame(new RecordingCanvas().asCanvas(), project, scene("body"));
    expect(t.seen).toEqual(["body", "overlay:body"]);
  });
});
