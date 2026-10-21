import { describe, expect, it } from "vitest";
import { audioMetrics, rmsDbBetween, toneRmsDb } from "../../scripts/lib/audioMetrics";

const SR = 48000;
function tone(sec: number, amp: number, freq = 220): Float32Array {
  const out = new Float32Array(Math.round(sec * SR));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return out;
}
function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

describe("audioMetrics", () => {
  it("giọng to xen nhạc nhỏ: tách được mức có tiếng và mức lúc nghỉ", () => {
    // 2 s nhạc nhỏ (−30 dB RMS ≈ biên độ 0,0447), 2 s giọng (−16,5 dB ≈ 0,211), 2 s nhạc nhỏ
    const music = tone(2, 0.0447);
    const voice = tone(2, 0.211, 180);
    const mono = concat([music, voice, music]);
    const m = audioMetrics([mono, mono], SR);
    expect(m.durationSec).toBeCloseTo(6, 3);
    expect(m.voicedRmsDb).toBeCloseTo(-16.5, 0);
    expect(m.quietRmsDb).toBeCloseTo(-30, 0);
    expect(m.peak).toBeCloseTo(0.211, 2);
    expect(m.voicedWindows).toBeGreaterThan(15);
    expect(m.voicedWindows).toBeLessThan(25);
  });

  it("toàn lặng: không có cửa sổ có tiếng, quietRmsDb là NaN", () => {
    const m = audioMetrics([new Float32Array(SR)], SR);
    expect(m.voicedWindows).toBe(0);
    expect(Number.isNaN(m.voicedRmsDb)).toBe(true);
    expect(Number.isNaN(m.quietRmsDb)).toBe(true);
    expect(m.peak).toBe(0);
  });

  it("đỉnh lấy trên mọi kênh", () => {
    const l = new Float32Array(SR); l[100] = 0.3;
    const r = new Float32Array(SR); r[200] = -0.9;
    expect(audioMetrics([l, r], SR).peak).toBeCloseTo(0.9, 6);
  });
});

describe("đo theo khoảng thời gian", () => {
  const SR = 8000;
  const tone = (freq: number, sec: number, amp: number) =>
    Float32Array.from({ length: Math.round(SR * sec) }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / SR));

  it("rmsDbBetween: RMS năng lượng của đoạn [from, to)", () => {
    const a = new Float32Array(SR * 2);
    a.set(tone(440, 1, 0.5), SR);
    expect(rmsDbBetween([a], SR, 1, 2)).toBeCloseTo(20 * Math.log10(0.5 / Math.SQRT2), 2);
    expect(rmsDbBetween([a], SR, 0, 1)).toBeLessThan(-100);
    expect(Number.isNaN(rmsDbBetween([a], SR, 3, 4))).toBe(true);
  });

  it("toneRmsDb: tách đúng thành phần 440 Hz, bỏ qua 230 Hz", () => {
    const mixed = tone(440, 1, 0.25).map((v, i) => v + 0.5 * Math.sin((2 * Math.PI * 230 * i) / SR));
    expect(toneRmsDb([mixed], SR, 0, 1, 440)).toBeCloseTo(20 * Math.log10(0.25 / Math.SQRT2), 1);
    expect(toneRmsDb([tone(230, 1, 0.5)], SR, 0, 1, 440)).toBeLessThan(-45);
  });
});
