import { describe, expect, it } from "vitest";
import { FallbackFootage, ImageFootage, VideoFootage, footageFromSnapshot } from "@/domain/Footage";
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

describe("Footage snapshot / restore", () => {
  const source = { origin: "pexels" as const, uri: "https://x/1.jpg", credit: "An", pageUrl: "https://p/1" };

  it("ảnh, video, nền dự phòng đều round trip qua structuredClone", () => {
    for (const f of [
      new ImageFootage("f1", source, 1600, 900),
      new VideoFootage("f2", source, 1920, 1080, 12.5),
      new FallbackFootage("f3"),
    ]) {
      const s = f.snapshot();
      expect(structuredClone(s)).toEqual(s);
      const back = footageFromSnapshot(structuredClone(s));
      expect(back.kind).toBe(f.kind);
      expect(back.snapshot()).toEqual(s);
    }
  });

  it("snapshot ảnh chứa đủ nguồn và kích thước; video có độ dài", () => {
    expect(new ImageFootage("f1", source, 1600, 900).snapshot()).toEqual({
      kind: "image",
      id: "f1",
      source,
      width: 1600,
      height: 900,
    });
    expect(new VideoFootage("f2", source, 1920, 1080, 12.5).snapshot()).toMatchObject({ kind: "video", durationSec: 12.5 });
  });

  it("snapshot không dùng chung đối tượng nguồn với bản gốc", () => {
    const f = new ImageFootage("f1", { ...source }, 10, 10);
    const s = f.snapshot();
    if (s.kind !== "image") throw new Error("kiểu sai");
    s.source.uri = "https://khac";
    expect(f.snapshot()).toMatchObject({ source: { uri: "https://x/1.jpg" } });
  });

  it("loại lạ hoặc dữ liệu hỏng thì ném ValidationError", () => {
    expect(() => footageFromSnapshot({ kind: "gif", id: "x" } as never)).toThrow(
      "Bản nháp hỏng: loại cảnh trám không hợp lệ",
    );
    expect(() => footageFromSnapshot({ kind: "video", id: "x", source, width: 10, height: 10, durationSec: 0 })).toThrow(
      ValidationError,
    );
  });
});

describe("Footage restore: dữ liệu hỏng không rõ kiểu", () => {
  const source = { origin: "pexels" as const, uri: "https://x/1.jpg" };
  const good = { kind: "image" as const, id: "f1", source, width: 10, height: 10 };
  const run = (v: unknown) => () => footageFromSnapshot(v as never);

  it("ném ValidationError thay vì TypeError", () => {
    expect(run(null)).toThrow(ValidationError);
    expect(run("x")).toThrow(ValidationError);
    expect(run({ ...good, id: 7 })).toThrow(ValidationError);
    expect(run({ ...good, source: undefined })).toThrow(ValidationError);
    expect(run({ ...good, source: { origin: "web", uri: "https://x" } })).toThrow(ValidationError);
    expect(run({ ...good, source: { origin: "pexels", uri: 5 } })).toThrow(ValidationError);
    expect(run({ ...good, width: "10" })).toThrow(ValidationError);
    expect(run({ kind: "video", id: "f2", source, width: 10, height: 10, durationSec: "3" })).toThrow(ValidationError);
  });
});
