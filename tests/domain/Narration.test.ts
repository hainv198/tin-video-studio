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
