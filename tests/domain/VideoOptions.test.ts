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
  pacing: { gapSec: 0.35, leadInSec: 0.3 },
  voiceTweak: { tempo: 1, pitchSemitones: 0 },
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
      .withGapSec(0.8)
      .withLeadInSec(0.45)
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
      pacing: { gapSec: 0.35, leadInSec: 0.3 },
      voiceTweak: { tempo: 1, pitchSemitones: 0 },
    });
  });

  it("nhịp đọc: mặc định đúng hiện trạng, đổi được, bất biến", () => {
    const a = VideoOptions.defaults();
    expect(a.gapSec).toBe(0.35);
    expect(a.leadInSec).toBe(0.3);
    const b = a.withGapSec(0.6).withLeadInSec(0.5);
    expect(b.snapshot().pacing).toEqual({ gapSec: 0.6, leadInSec: 0.5 });
    expect(a.gapSec).toBe(0.35);
    expect(a.withGapSec(0.1).gapSec).toBe(0.1);
    expect(a.withGapSec(1).gapSec).toBe(1);
    expect(a.withLeadInSec(0.1).leadInSec).toBe(0.1);
    expect(a.withLeadInSec(1).leadInSec).toBe(1);
  });

  it("nhịp đọc ngoài khoảng hoặc không phải số: ValidationError", () => {
    const o = VideoOptions.defaults();
    expect(() => o.withGapSec(0.05)).toThrow(ValidationError);
    expect(() => o.withGapSec(1.2)).toThrow("Khoảng nghỉ giữa các câu phải từ 0,10 đến 1,00 giây");
    expect(() => o.withGapSec(Number.NaN)).toThrow(ValidationError);
    expect(() => o.withLeadInSec(0)).toThrow("Khoảng nghỉ đầu video phải từ 0,1 đến 1,0 giây");
    expect(() => o.withLeadInSec(2)).toThrow(ValidationError);
  });

  it("restore nhịp đọc: thiếu = mặc định, ngoài khoảng bị kẹp, không phải số = mặc định", () => {
    expect(VideoOptions.restore({ pacing: { gapSec: 0.7, leadInSec: 0.2 } }).snapshot().pacing).toEqual({ gapSec: 0.7, leadInSec: 0.2 });
    expect(VideoOptions.restore({ pacing: { gapSec: 9, leadInSec: -3 } }).snapshot().pacing).toEqual({ gapSec: 1, leadInSec: 0.1 });
    expect(VideoOptions.restore({ pacing: { gapSec: "x", leadInSec: null } }).snapshot().pacing).toEqual({ gapSec: 0.35, leadInSec: 0.3 });
    expect(VideoOptions.restore({ pacing: 5 }).snapshot().pacing).toEqual({ gapSec: 0.35, leadInSec: 0.3 });
    // bản nháp cũ (v1/v2) không có khối pacing
    expect(VideoOptions.restore({ subtitles: { enabled: false }, footageKind: "image" }).snapshot().pacing).toEqual({ gapSec: 0.35, leadInSec: 0.3 });
  });

  it("tinh chỉnh giọng: mặc định tempo 1, tông 0; đổi được, làm tròn theo bước, bất biến", () => {
    const a = VideoOptions.defaults();
    expect(a.voiceTweak).toEqual({ tempo: 1, pitchSemitones: 0 });
    const b = a.withTempo(1.234).withPitchSemitones(2.4);
    expect(b.voiceTweak).toEqual({ tempo: 1.23, pitchSemitones: 2.5 });
    expect(b.snapshot().voiceTweak).toEqual({ tempo: 1.23, pitchSemitones: 2.5 });
    expect(a.voiceTweak).toEqual({ tempo: 1, pitchSemitones: 0 });
    expect(a.withTempo(0.8).voiceTweak.tempo).toBe(0.8);
    expect(a.withTempo(1.4).voiceTweak.tempo).toBe(1.4);
    expect(a.withPitchSemitones(-4).voiceTweak.pitchSemitones).toBe(-4);
    expect(b.withoutVoiceTweak().voiceTweak).toEqual({ tempo: 1, pitchSemitones: 0 });
  });

  it("tinh chỉnh giọng ngoài khoảng hoặc không phải số: ValidationError", () => {
    const o = VideoOptions.defaults();
    expect(() => o.withTempo(0.7)).toThrow("Tốc độ tinh chỉnh phải từ 0,80 đến 1,40");
    expect(() => o.withTempo(1.5)).toThrow(ValidationError);
    expect(() => o.withTempo(Number.NaN)).toThrow(ValidationError);
    expect(() => o.withPitchSemitones(4.5)).toThrow("Tông giọng phải từ −4 đến +4 nửa cung");
    expect(() => o.withPitchSemitones(Number.POSITIVE_INFINITY)).toThrow(ValidationError);
  });

  it("restore tinh chỉnh giọng: thiếu = mặc định, ngoài khoảng bị kẹp, không phải số = mặc định", () => {
    expect(VideoOptions.restore({ voiceTweak: { tempo: 1.2, pitchSemitones: -1.5 } }).voiceTweak).toEqual({ tempo: 1.2, pitchSemitones: -1.5 });
    expect(VideoOptions.restore({ voiceTweak: { tempo: 9, pitchSemitones: -9 } }).voiceTweak).toEqual({ tempo: 1.4, pitchSemitones: -4 });
    expect(VideoOptions.restore({ voiceTweak: { tempo: "x", pitchSemitones: null } }).voiceTweak).toEqual({ tempo: 1, pitchSemitones: 0 });
    expect(VideoOptions.restore({ voiceTweak: 3 }).voiceTweak).toEqual({ tempo: 1, pitchSemitones: 0 });
    expect(VideoOptions.restore({ pacing: { gapSec: 0.5 } }).voiceTweak).toEqual({ tempo: 1, pitchSemitones: 0 });
  });
});
