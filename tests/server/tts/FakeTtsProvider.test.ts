import { describe, expect, it } from "vitest";
import { FakeTtsProvider, makeToneWav } from "@/server/tts/FakeTtsProvider";

describe("makeToneWav", () => {
  it("tạo WAV PCM 16-bit mono đúng độ dài", () => {
    const wav = makeToneWav(1, 220, 8000);
    const view = new DataView(wav.buffer);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe("WAVE");
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint32(40, true)).toBe(16000);
    expect(wav.byteLength).toBe(44 + 16000);
  });
});

describe("FakeTtsProvider", () => {
  it("độ dài giọng tỉ lệ với số ký tự và tốc độ", async () => {
    const p = new FakeTtsProvider();
    const slow = await p.synthesize({ text: "x".repeat(100), voiceName: "vi-VN-Fake-A", speakingRate: 1 });
    const fast = await p.synthesize({ text: "x".repeat(100), voiceName: "vi-VN-Fake-A", speakingRate: 1.3 });
    expect(slow.mimeType).toBe("audio/wav");
    expect(slow.audio.byteLength).toBeGreaterThan(fast.audio.byteLength);
  });

  it("có 2 giọng giả nam / nữ", async () => {
    expect((await new FakeTtsProvider().listVoices()).map((v) => v.gender)).toEqual(["FEMALE", "MALE"]);
  });
});
