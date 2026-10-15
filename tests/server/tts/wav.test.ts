import { describe, expect, it } from "vitest";
import { pcm16ToWav } from "@/server/tts/wav";

describe("pcm16ToWav", () => {
  it("ghi header RIFF/WAVE 44 byte rồi tới dữ liệu PCM", () => {
    const pcm = Uint8Array.from([1, 0, 2, 0, 3, 0]);
    const wav = pcm16ToWav(pcm, 24000);
    const view = new DataView(wav.buffer);
    const text = (o: number, n: number) => String.fromCharCode(...wav.slice(o, o + n));
    expect(wav.length).toBe(44 + 6);
    expect(text(0, 4)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(36 + 6);
    expect(text(8, 4)).toBe("WAVE");
    expect(text(12, 4)).toBe("fmt ");
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint32(28, true)).toBe(48000);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(6);
    expect(Array.from(wav.slice(44))).toEqual([1, 0, 2, 0, 3, 0]);
  });

  it("hỗ trợ nhiều kênh", () => {
    const wav = pcm16ToWav(new Uint8Array(4), 16000, 2);
    const view = new DataView(wav.buffer);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(28, true)).toBe(64000);
    expect(view.getUint16(32, true)).toBe(4);
  });
});
