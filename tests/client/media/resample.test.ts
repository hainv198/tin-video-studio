import { describe, expect, it } from "vitest";
import { resample } from "@/client/media/resample";

const sine = (rate: number, freq: number, seconds: number, amp = 0.5) =>
  Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / rate));
const rmsDb = (a: Float32Array, from: number, to: number) => {
  let s = 0;
  for (let i = from; i < to; i++) s += (a[i] ?? 0) ** 2;
  return 10 * Math.log10(s / (to - from));
};

describe("resample", () => {
  it("cùng tần số: trả nguyên mảng", () => {
    const a = new Float32Array([1, 2, 3]);
    expect(resample(a, 48000, 48000)).toBe(a);
  });

  it("44,1 → 48 kHz: đúng độ dài, giữ cao độ (sai số < 1e-4 với sin lý tưởng)", () => {
    const out = resample(sine(44100, 440, 1), 44100, 48000);
    expect(out.length).toBe(48000);
    let err = 0;
    for (let i = 1000; i < out.length - 1000; i++) err = Math.max(err, Math.abs((out[i] ?? 0) - 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48000)));
    expect(err).toBeLessThan(1e-4);
  });

  it("96 → 48 kHz: chặn chồng phổ (30 kHz) ≥ 60 dB, dải thông 1 kHz lệch < 0,05 dB", () => {
    const hi = sine(96000, 30000, 1);
    const hiOut = resample(hi, 96000, 48000);
    expect(rmsDb(hiOut, 2000, hiOut.length - 2000) - rmsDb(hi, 2000, hi.length - 2000)).toBeLessThan(-60);
    const lo = sine(96000, 1000, 1);
    const loOut = resample(lo, 96000, 48000);
    expect(Math.abs(rmsDb(loOut, 2000, loOut.length - 2000) - rmsDb(lo, 2000, lo.length - 2000))).toBeLessThan(0.05);
  });

  it("giữ mức một chiều (DC)", () => {
    const out = resample(new Float32Array(44100).fill(0.5), 44100, 48000);
    expect(out[24000]).toBeCloseTo(0.5, 5);
  });

  it("tỉ lệ lạ (quá 4096 pha) dùng nội suy tuyến tính, vẫn đúng độ dài và gần đúng", () => {
    const out = resample(sine(44101, 440, 1), 44101, 48000);
    expect(out.length).toBe(Math.floor((44101 * 48000) / 44101));
    expect(Math.abs((out[24000] ?? 0) - 0.5 * Math.sin((2 * Math.PI * 440 * 24000) / 48000))).toBeLessThan(1e-2);
  });

  it("tần số không hợp lệ thì ném", () => {
    expect(() => resample(new Float32Array(4), 0, 48000)).toThrow("Tần số mẫu không hợp lệ");
    expect(() => resample(new Float32Array(4), 44100.5, 48000)).toThrow("Tần số mẫu không hợp lệ");
  });
});
