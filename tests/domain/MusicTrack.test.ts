import { describe, expect, it } from "vitest";
import { MusicTrack } from "@/domain/MusicTrack";
import { ValidationError } from "@/domain/errors";

const make = (gainOffsetDb?: number) =>
  MusicTrack.create({ id: "m1", title: "Bản tin 1", origin: "library", uri: "/music/ban-tin-1.mp3", gainOffsetDb });

describe("MusicTrack", () => {
  it("mặc định thấp hơn giọng 15 dB", () => {
    expect(make().levelBelowVoiceDb).toBe(15);
  });

  it("chỉnh ±6 dB: tăng nhạc thì khoảng cách nhỏ lại", () => {
    expect(make(4).levelBelowVoiceDb).toBe(11);
    expect(make().withGainOffset(-6).levelBelowVoiceDb).toBe(21);
  });

  it("chặn chỉnh ngoài ±6 dB và thiếu nguồn", () => {
    expect(() => make(7)).toThrow(ValidationError);
    expect(() => MusicTrack.create({ id: "m", title: "x", origin: "upload", uri: "" })).toThrow(ValidationError);
  });
});

describe("MusicTrack snapshot / restore", () => {
  it("round trip qua structuredClone, giữ chỉnh âm lượng", () => {
    const t = MusicTrack.create({ id: "m1", title: "Bản tin 1", origin: "upload", uri: "upload-abc", gainOffsetDb: 3 });
    const s = t.snapshot();
    expect(s).toEqual({ id: "m1", title: "Bản tin 1", origin: "upload", uri: "upload-abc", gainOffsetDb: 3 });
    const back = MusicTrack.restore(structuredClone(s));
    expect(back.snapshot()).toEqual(s);
    expect(back.levelBelowVoiceDb).toBe(12);
  });

  it("origin lạ hoặc chỉnh âm lượng ngoài ±6 dB thì ném ValidationError", () => {
    const good = { id: "m1", title: "t", origin: "library", uri: "/music/a.mp3", gainOffsetDb: 0 } as const;
    expect(() => MusicTrack.restore({ ...good, origin: "web" as never })).toThrow("Bản nháp hỏng: nguồn nhạc không hợp lệ");
    expect(() => MusicTrack.restore({ ...good, gainOffsetDb: 9 })).toThrow(ValidationError);
  });
});
