import { describe, expect, it } from "vitest";
import { Narration } from "@/domain/Narration";
import { Scene } from "@/domain/Scene";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { ValidationError } from "@/domain/errors";

const voice = VoiceSettings.create("vi-VN-Neural2-A", 1.07);
const scene = Scene.create("s1", "Câu tin.", "body");
const make = (over: Partial<Parameters<typeof Narration.create>[0]> = {}) =>
  Narration.create({
    sceneId: "s1",
    text: "Câu tin.",
    audio: new Uint8Array([1, 2, 3]),
    mimeType: "audio/mpeg",
    durationSec: 2.4,
    voice,
    ...over,
  });

describe("Narration", () => {
  it("tạo được khi dữ liệu hợp lệ", () => {
    expect(make().durationSec).toBe(2.4);
  });

  it("chặn độ dài không dương, audio rỗng, mime sai", () => {
    expect(() => make({ durationSec: 0 })).toThrow(ValidationError);
    expect(() => make({ audio: new Uint8Array() })).toThrow(ValidationError);
    expect(() => make({ mimeType: "text/plain" })).toThrow(ValidationError);
  });

  it("cũ khi đổi chữ, đổi giọng hoặc khác cảnh", () => {
    const n = make();
    expect(n.isStaleFor(scene, voice)).toBe(false);
    expect(n.isStaleFor(scene.withText("Câu khác."), voice)).toBe(true);
    expect(n.isStaleFor(scene, voice.withRate(1.2))).toBe(true);
    expect(n.isStaleFor(Scene.create("s2", "Câu tin.", "body"), voice)).toBe(true);
  });
});

describe("Narration snapshot / restore", () => {
  it("round trip qua structuredClone, giữ giọng và độ dài", () => {
    const n = make({ audio: new Uint8Array([1, 2, 3]) });
    const s = n.snapshot();
    expect(s.voice).toEqual({ voiceName: "vi-VN-Neural2-A", speakingRate: 1.07 });
    const back = Narration.restore(structuredClone(s));
    expect(back.sceneId).toBe("s1");
    expect(back.durationSec).toBe(2.4);
    expect(Array.from(back.audio)).toEqual([1, 2, 3]);
    expect(back.isStaleFor(scene, voice)).toBe(false);
  });

  it("snapshot sao chép audio: sửa bản chụp không đổi đối tượng gốc", () => {
    const n = make({ audio: new Uint8Array([1, 2, 3]) });
    const s = n.snapshot();
    s.audio[0] = 9;
    expect(n.audio[0]).toBe(1);
  });

  it("snapshot hỏng thì ném ValidationError", () => {
    const s = make().snapshot();
    expect(() => Narration.restore({ ...s, audio: new Uint8Array() })).toThrow(ValidationError);
    expect(() => Narration.restore({ ...s, voice: { voiceName: "x", speakingRate: 1 } })).toThrow(ValidationError);
  });
});

describe("Narration restore: dữ liệu hỏng không rõ kiểu", () => {
  const good = () => make().snapshot();
  const run = (v: unknown) => () => Narration.restore(v as never);

  it("ném ValidationError thay vì TypeError", () => {
    const g = good();
    expect(run(null)).toThrow(ValidationError);
    expect(run("x")).toThrow(ValidationError);
    expect(run({ ...g, audio: undefined })).toThrow(ValidationError);
    expect(run({ ...g, audio: [1, 2, 3] })).toThrow(ValidationError);
    expect(run({ ...g, sceneId: 7 })).toThrow(ValidationError);
    expect(run({ ...g, text: null })).toThrow(ValidationError);
    expect(run({ ...g, mimeType: undefined })).toThrow(ValidationError);
    expect(run({ ...g, durationSec: "2" })).toThrow(ValidationError);
    expect(run({ ...g, voice: null })).toThrow(ValidationError);
  });
});
