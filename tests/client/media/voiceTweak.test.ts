import { describe, expect, it } from "vitest";
import { applyVoiceTweak, encodeWav, isDefaultVoiceTweak } from "@/client/media/voiceTweak";

const SR = 48000;

function sine(freq: number, sec: number, amp = 0.9): Float32Array {
  const out = new Float32Array(Math.round(SR * sec));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return out;
}

/** Tần số cơ bản bằng tự tương quan chuẩn hoá (lấy đoạn giữa, bỏ mép), có nội suy parabol quanh đỉnh. */
function estimateF0(samples: Float32Array, minHz = 60, maxHz = 1000): number {
  const mid = Math.floor(samples.length / 2);
  const n = Math.min(4800, Math.floor(samples.length / 3));
  const seg = samples.subarray(mid - n / 2, mid + n / 2);
  const minLag = Math.floor(SR / maxHz);
  const maxLag = Math.ceil(SR / minHz);
  const ac = (lag: number) => {
    let s = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i + lag < seg.length; i++) {
      s += seg[i]! * seg[i + lag]!;
      e1 += seg[i]! ** 2;
      e2 += seg[i + lag]! ** 2;
    }
    return s / Math.sqrt(e1 * e2 + 1e-12);
  };
  const values: number[] = [];
  for (let lag = 0; lag <= maxLag + 1; lag++) values.push(lag >= minLag ? ac(lag) : -1);
  // đỉnh cục bộ đầu tiên vượt 0,9 (tránh bội số chu kỳ)
  let best = minLag;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (values[lag]! > 0.9 && values[lag]! >= values[lag - 1]! && values[lag]! >= values[lag + 1]!) {
      best = lag;
      break;
    }
  }
  const a = values[best - 1]!;
  const b = values[best]!;
  const c = values[best + 1]!;
  const shift = (a - c) / (2 * (a - 2 * b + c));
  return SR / (best + (Number.isFinite(shift) ? shift : 0));
}

function overShare(samples: Float32Array, limit = 1): number {
  let n = 0;
  for (const v of samples) if (Math.abs(v) > limit) n++;
  return n / Math.max(1, samples.length);
}

function hasNaN(samples: Float32Array): boolean {
  return samples.some((v) => !Number.isFinite(v));
}

describe("applyVoiceTweak", () => {
  it("mặc định (tempo 1, tông 0) trả đúng bản gốc, không đổi mẫu nào", () => {
    const input = sine(200, 0.5);
    const out = applyVoiceTweak(input, SR, { tempo: 1, pitchSemitones: 0 });
    expect(out).toBe(input);
    expect(isDefaultVoiceTweak({ tempo: 1, pitchSemitones: 0 })).toBe(true);
    expect(isDefaultVoiceTweak({ tempo: 1.1, pitchSemitones: 0 })).toBe(false);
    expect(isDefaultVoiceTweak({ tempo: 1, pitchSemitones: -0.5 })).toBe(false);
  });

  it.each([0.8, 1.25, 1.4])("tempo %s: độ dài ≈ gốc / tempo (±2%%), tông giữ nguyên (<3%%)", (tempo) => {
    const input = sine(200, 2);
    const out = applyVoiceTweak(input, SR, { tempo, pitchSemitones: 0 });
    expect(Math.abs(out.length - input.length / tempo) / (input.length / tempo)).toBeLessThan(0.02);
    expect(Math.abs(estimateF0(out) - 200) / 200).toBeLessThan(0.03);
    expect(hasNaN(out)).toBe(false);
    expect(overShare(out)).toBeLessThan(0.005);
  });

  it("+12 nửa cung: tần số ×2 (±3%), độ dài giữ nguyên (±2%)", () => {
    const input = sine(200, 2);
    const out = applyVoiceTweak(input, SR, { tempo: 1, pitchSemitones: 12 });
    expect(Math.abs(out.length - input.length) / input.length).toBeLessThan(0.02);
    expect(Math.abs(estimateF0(out) - 400) / 400).toBeLessThan(0.03);
    expect(overShare(out)).toBeLessThan(0.005);
  });

  it("−4 nửa cung kèm tempo 1,2: tông theo 2^(−4/12), độ dài theo tempo", () => {
    const input = sine(200, 2);
    const out = applyVoiceTweak(input, SR, { tempo: 1.2, pitchSemitones: -4 });
    const expected = 200 * 2 ** (-4 / 12);
    expect(Math.abs(out.length - input.length / 1.2) / (input.length / 1.2)).toBeLessThan(0.02);
    expect(Math.abs(estimateF0(out) - expected) / expected).toBeLessThan(0.03);
    expect(hasNaN(out)).toBe(false);
    expect(overShare(out)).toBeLessThan(0.005);
  });

  it("tín hiệu giống giọng (nhiều hoạ âm, biên độ đổi) không NaN, không vượt 1,0 quá 0,5% mẫu", () => {
    const input = new Float32Array(SR * 2);
    for (let i = 0; i < input.length; i++) {
      const t = i / SR;
      const f0 = 140 + 30 * Math.sin(2 * Math.PI * 1.5 * t);
      const env = 0.5 + 0.4 * Math.sin(2 * Math.PI * 3 * t);
      let v = 0;
      for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f0 * h * t) / h;
      input[i] = Math.max(-0.9, Math.min(0.9, (env * v) / 2.5));
    }
    for (const [tempo, pitchSemitones] of [[1.4, 4], [0.8, -4], [1.1, 2.5]] as const) {
      const out = applyVoiceTweak(input, SR, { tempo, pitchSemitones });
      expect(Math.abs(out.length - input.length / tempo) / (input.length / tempo)).toBeLessThan(0.02);
      expect(hasNaN(out)).toBe(false);
      expect(overShare(out)).toBeLessThan(0.005);
    }
  });

  it("im lặng và mẫu rất ngắn không lỗi", () => {
    const silent = applyVoiceTweak(new Float32Array(SR), SR, { tempo: 1.3, pitchSemitones: 3 });
    expect(silent.length).toBe(Math.round(SR / 1.3));
    expect(silent.every((v) => v === 0)).toBe(true);
    expect(applyVoiceTweak(new Float32Array(0), SR, { tempo: 1.2, pitchSemitones: 0 }).length).toBe(0);
    const tiny = applyVoiceTweak(new Float32Array([0.1, -0.2, 0.3, 0.1, 0]), SR, { tempo: 0.8, pitchSemitones: -2 });
    expect(tiny.length).toBe(6);
    expect(hasNaN(tiny)).toBe(false);
    expect(hasNaN(applyVoiceTweak(sine(200, 0.01), SR, { tempo: 1.4, pitchSemitones: 4 }))).toBe(false);
  });
});

describe("encodeWav", () => {
  it("đóng gói PCM 16-bit mono có header RIFF, kẹp biên độ", () => {
    const bytes = encodeWav(new Float32Array([0, 1, -1, 2]), SR);
    expect(bytes.length).toBe(44 + 8);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(24, true)).toBe(SR);
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32767);
    expect(view.getInt16(50, true)).toBe(32767);
  });
});
