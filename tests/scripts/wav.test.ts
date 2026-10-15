import { describe, expect, it } from "vitest";
import { parseWav } from "../../scripts/lib/wav";
import { makeToneWav } from "@/server/tts/FakeTtsProvider";

describe("parseWav", () => {
  it("đọc WAV PCM16 mono do FakeTtsProvider sinh", () => {
    const wav = makeToneWav(0.5, 440, 24000);
    const parsed = parseWav(wav);
    expect(parsed.sampleRate).toBe(24000);
    expect(parsed.channels).toHaveLength(1);
    expect(parsed.channels[0]!.length).toBe(12000);
    const peak = Math.max(...Array.from(parsed.channels[0]!).map(Math.abs));
    expect(peak).toBeGreaterThan(0.15);
    expect(peak).toBeLessThan(0.2); // 6000/32768 ≈ 0.183
  });

  it("đọc WAV float32 stereo tự dựng", () => {
    const n = 100;
    const buf = new ArrayBuffer(44 + n * 2 * 4);
    const v = new DataView(buf);
    const txt = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    txt(0, "RIFF"); v.setUint32(4, 36 + n * 8, true); txt(8, "WAVE"); txt(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 3, true); v.setUint16(22, 2, true);
    v.setUint32(24, 48000, true); v.setUint32(28, 48000 * 8, true); v.setUint16(32, 8, true); v.setUint16(34, 32, true);
    txt(36, "data"); v.setUint32(40, n * 8, true);
    for (let i = 0; i < n; i++) { v.setFloat32(44 + i * 8, 0.25, true); v.setFloat32(48 + i * 8, -0.5, true); }
    const parsed = parseWav(new Uint8Array(buf));
    expect(parsed.sampleRate).toBe(48000);
    expect(parsed.channels[0]![10]).toBeCloseTo(0.25, 6);
    expect(parsed.channels[1]![10]).toBeCloseTo(-0.5, 6);
  });

  it("không phải WAV thì ném lỗi tiếng Việt", () => {
    expect(() => parseWav(new Uint8Array([1, 2, 3]))).toThrow(/WAV không hợp lệ/);
  });
});
