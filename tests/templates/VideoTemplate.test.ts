import { describe, expect, it } from "vitest";
import { BrandKit } from "@/domain/BrandKit";
import { DEFAULT_TIMELINE_CONFIG } from "@/domain/Timeline";
import type { Canvas2D } from "@/templates/Canvas2D";
import { isNativePortrait, NATIVE_PORTRAIT_MEDIA, SOURCE_CLIP_MEDIA, sourceClipMediaFor, VideoTemplate, type ProjectFrame, type SceneFrame } from "@/templates/VideoTemplate";
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

describe("isNativePortrait — hình 9:16 gốc (rộng/cao ≈ 0,5625, dung sai ±6%)", () => {
  it("9:16 chính xác và các cỡ 9:16 thường gặp", () => {
    expect(isNativePortrait(9, 16)).toBe(true);
    expect(isNativePortrait(1080, 1920)).toBe(true);
    expect(isNativePortrait(720, 1280)).toBe(true);
    expect(isNativePortrait(1079, 1920)).toBe(true);
  });

  it("lệch +5% còn trong dung sai, lệch ±8% ra ngoài", () => {
    expect(isNativePortrait(1134, 1920)).toBe(true); // 1080 × 1,05
    expect(isNativePortrait(1026, 1920)).toBe(true); // 1080 × 0,95
    expect(isNativePortrait(1166, 1920)).toBe(false); // ≈ 1080 × 1,08
    expect(isNativePortrait(994, 1920)).toBe(false); // ≈ 1080 × 0,92
  });

  it("khổ khác (vuông, ngang, 4:3, dọc 3:4/4:5, rất thon) không phải 9:16 gốc", () => {
    expect(isNativePortrait(1080, 1080)).toBe(false);
    expect(isNativePortrait(1920, 1080)).toBe(false);
    expect(isNativePortrait(1440, 1080)).toBe(false);
    expect(isNativePortrait(1080, 1440)).toBe(false);
    expect(isNativePortrait(1080, 1350)).toBe(false);
    expect(isNativePortrait(400, 1920)).toBe(false);
  });

  it("kích thước không hợp lệ: không phải 9:16 gốc", () => {
    expect(isNativePortrait(0, 1920)).toBe(false);
    expect(isNativePortrait(1080, 0)).toBe(false);
    expect(isNativePortrait(Number.NaN, 1920)).toBe(false);
  });
});

describe("sourceClipMediaFor — đặt video tải lên vào khung thân bài", () => {
  it("9:16 gốc: phủ toàn khung 1080×1920, không nền mờ, không zoom", () => {
    expect(NATIVE_PORTRAIT_MEDIA).toEqual({ fit: "fullFrame", motion: false });
    for (const [w, h] of [[1080, 1920], [720, 1280], [1079, 1920], [1134, 1920]] as const) {
      expect(sourceClipMediaFor(w, h)).toEqual(NATIVE_PORTRAIT_MEDIA);
    }
  });

  it("mọi khổ khác: vừa khung (contain) trên nền mờ, không zoom", () => {
    expect(SOURCE_CLIP_MEDIA).toEqual({ fit: "contain", motion: false });
    for (const [w, h] of [[1920, 1080], [1080, 1080], [1440, 1080], [1080, 1440], [1080, 1350], [1166, 1920], [400, 1920]] as const) {
      expect(sourceClipMediaFor(w, h)).toEqual(SOURCE_CLIP_MEDIA);
    }
  });
});
