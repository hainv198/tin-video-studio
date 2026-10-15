import { describe, expect, it } from "vitest";
import { FallbackFootage, ImageFootage, VideoFootage } from "@/domain/Footage";
import { ValidationError } from "@/domain/errors";

const src = { origin: "pexels" as const, uri: "https://images.pexels.com/1.jpg", credit: "A" };

describe("Footage", () => {
  it("ảnh luôn đứng yên (zoom do phong cách lo)", () => {
    const f = new ImageFootage("f1", src, 1600, 900);
    expect(f.kind).toBe("image");
    expect(f.playbackFor(5)).toEqual({ mode: "still" });
    expect(f.aspectRatio).toBeCloseTo(1.7778, 3);
  });

  it("video dài hơn cảnh thì cắt, ngắn hơn thì lặp", () => {
    const v = new VideoFootage("f2", src, 1920, 1080, 4);
    expect(v.playbackFor(3)).toEqual({ mode: "clip", sourceDurationSec: 4 });
    expect(v.playbackFor(4)).toEqual({ mode: "clip", sourceDurationSec: 4 });
    expect(v.playbackFor(6)).toEqual({ mode: "loop", sourceDurationSec: 4 });
  });

  it("chặn kích thước và độ dài không hợp lệ", () => {
    expect(() => new ImageFootage("f", src, 0, 10)).toThrow(ValidationError);
    expect(() => new VideoFootage("f", src, 10, 10, 0)).toThrow(ValidationError);
    expect(() => new ImageFootage("f", { ...src, uri: "" }, 10, 10)).toThrow(ValidationError);
  });

  it("nền dự phòng không phát gì", () => {
    expect(new FallbackFootage("fb").playbackFor(3)).toEqual({ mode: "none" });
  });
});
