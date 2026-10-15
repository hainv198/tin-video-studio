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
