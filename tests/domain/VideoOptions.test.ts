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
