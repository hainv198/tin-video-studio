import { describe, expect, it } from "vitest";
import { applyLimiter, dbToGain, MIX_DEFAULTS, mixProgram, rmsDb } from "@/client/media/AudioMix";

const SR = 1000;
const sine = (seconds: number, amp: number, freq = 50) =>
  Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / SR));
const slice = (a: Float32Array, fromSec: number, toSec: number) => a.slice(Math.round(fromSec * SR), Math.round(toSec * SR));

describe("dbToGain / rmsDb", () => {
  it("chuyển dB và đo RMS có cổng", () => {
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    const s = new Float32Array(2000);
    s.set(sine(1, 0.5), 0);
    expect(rmsDb(s)).toBeCloseTo(20 * Math.log10(0.5 / Math.SQRT2), 0);
    expect(rmsDb(new Float32Array(100))).toBe(-Infinity);
  });
});

describe("mixProgram", () => {
  it("đặt giọng đúng vị trí theo mẫu", () => {
    const voice = new Float32Array([0.1, 0.1, 0.1]);
    const out = mixProgram([{ startSec: 0.5, samples: voice }], null, { sampleRate: SR, durationSec: 1 });
    expect(out.left.length).toBe(1000);
    expect(out.left[499]).toBe(0);
    expect(out.left[500]).not.toBe(0);
    expect(out.left[503]).toBe(0);
    expect(Array.from(out.left)).toEqual(Array.from(out.right));
  });

  it("chuẩn hoá giọng về -16.5 dB phần có tiếng", () => {
    const out = mixProgram([{ startSec: 0, samples: sine(2, 0.05) }], null, { sampleRate: SR, durationSec: 3 });
    // cổng -45 dB loại các mẫu gần 0 nên lệch vài phần mười dB là bình thường
    expect(rmsDb(slice(out.left, 0, 2))).toBeCloseTo(MIX_DEFAULTS.voiceTargetDb, 0);
  });

  it("nhạc thấp hơn giọng đúng số dB, lặp khi ngắn hơn video", () => {
    const out = mixProgram(
      [],
      { channels: [sine(1, 0.3)], levelBelowVoiceDb: 15 },
      { sampleRate: SR, durationSec: 10 },
    );
    expect(rmsDb(slice(out.left, 3, 7), -60)).toBeCloseTo(MIX_DEFAULTS.voiceTargetDb - 15, 0);
    expect(rmsDb(slice(out.right, 3, 7), -60)).toBeCloseTo(MIX_DEFAULTS.voiceTargetDb - 15, 0);
  });

  it("fade in đầu và fade out cuối", () => {
    const out = mixProgram([], { channels: [new Float32Array(SR).fill(0.2)], levelBelowVoiceDb: 15 }, {
      sampleRate: SR,
      durationSec: 6,
    });
    expect(out.left[0]).toBe(0);
    expect(Math.abs(out.left[750] ?? 0)).toBeLessThan(Math.abs(out.left[3000] ?? 0));
    expect(Math.abs(out.left[5999] ?? 1)).toBeLessThan(0.001);
  });

  it("không vượt trần đỉnh", () => {
    const loud = new Float32Array(1000).fill(0.9);
    const out = mixProgram(
      [{ startSec: 0, samples: loud }],
      { channels: [new Float32Array(1000).fill(0.9)], levelBelowVoiceDb: 0 },
      // giọng chuẩn hoá về 0 dB + nhạc 0 dB ⇒ tổng ≈ 2, buộc bộ giới hạn phải làm việc
      { sampleRate: SR, durationSec: 1, fadeInSec: 0, fadeOutSec: 0, voiceTargetDb: 0 },
    );
    const peak = Math.max(...Array.from(out.left).map(Math.abs));
    expect(peak).toBeLessThanOrEqual(MIX_DEFAULTS.ceiling + 1e-6);
    expect(peak).toBeGreaterThan(MIX_DEFAULTS.ceiling - 1e-3);
  });

  it("nhạc stereo giữ hai kênh riêng", () => {
    const out = mixProgram([], { channels: [sine(1, 0.3), sine(1, 0.3, 80)], levelBelowVoiceDb: 15 }, {
      sampleRate: SR,
      durationSec: 4,
    });
    expect(Array.from(out.left)).not.toEqual(Array.from(out.right));
  });
});

describe("applyLimiter", () => {
  const sr = 1000; // cửa sổ nhìn trước = 5 mẫu
  const quiet = (n: number, v = 0.1) => new Float32Array(n).fill(v);

  it("một đỉnh vọt chỉ hạ độ lợi quanh đỉnh, phần còn lại giữ nguyên", () => {
    const left = quiet(2000);
    const right = quiet(2000);
    left[1000] = 1.5;
    right[1000] = 1.5;
    const reductionDb = applyLimiter(left, right, sr, 0.89);
    expect(reductionDb).toBeCloseTo(20 * Math.log10(0.89 / 1.5), 2);
    expect(Math.abs(left[1000] ?? 0)).toBeLessThanOrEqual(0.89 + 1e-6);
    expect(left[995]).toBeCloseTo(0.1, 7);
    expect(left[1005]).toBeCloseTo(0.1, 7);
    expect(left[0]).toBeCloseTo(0.1, 7);
    expect(left[1999]).toBeCloseTo(0.1, 7);
    // độ lợi giảm dần vào đỉnh (không cắt đột ngột)
    expect(left[998] ?? 0).toBeLessThan(0.1);
    expect(left[998] ?? 0).toBeGreaterThan(0.1 * (0.89 / 1.5));
    expect(Array.from(left)).toEqual(Array.from(right));
  });

  it("kênh phải vọt thì cả hai kênh cùng hạ (giữ hình ảnh âm thanh nổi)", () => {
    const left = quiet(500, 0.3);
    const right = quiet(500, 0.3);
    right[250] = 1.2;
    applyLimiter(left, right, sr, 0.89);
    const gain = (left[250] ?? 0) / 0.3;
    expect(gain).toBeLessThan(1);
    expect(Math.abs(right[250] ?? 0)).toBeLessThanOrEqual(0.89 + 1e-6);
    expect(gain).toBeCloseTo((right[250] ?? 0) / 1.2, 6);
  });

  it("đỉnh ở sát đầu và cuối đoạn vẫn không vượt trần", () => {
    const left = quiet(200);
    const right = quiet(200);
    left[0] = 2;
    left[199] = 2;
    applyLimiter(left, right, sr, 0.89);
    expect(Math.abs(left[0] ?? 0)).toBeLessThanOrEqual(0.89 + 1e-6);
    expect(Math.abs(left[199] ?? 0)).toBeLessThanOrEqual(0.89 + 1e-6);
  });

  it("không có mẫu nào vượt trần thì không đổi gì và trả 0 dB", () => {
    const left = quiet(300, 0.5);
    const right = quiet(300, -0.4);
    const before = Array.from(left);
    expect(applyLimiter(left, right, sr, 0.89)).toBe(0);
    expect(Array.from(left)).toEqual(before);
  });
});

describe("mixProgram với bộ giới hạn", () => {
  it("báo độ lợi giảm lớn nhất; chương trình êm thì là 0 dB", () => {
    const quietMix = mixProgram([{ startSec: 0, samples: sine(1, 0.05) }], null, { sampleRate: SR, durationSec: 1 });
    expect(quietMix.limiterGainDb).toBe(0);
    const loud = mixProgram(
      [{ startSec: 0, samples: new Float32Array(1000).fill(0.9) }],
      { channels: [new Float32Array(1000).fill(0.9)], levelBelowVoiceDb: 0 },
      { sampleRate: SR, durationSec: 1, fadeInSec: 0, fadeOutSec: 0, voiceTargetDb: 0 },
    );
    expect(loud.limiterGainDb).toBeLessThan(0);
  });

  it("giọng có đỉnh vọt vẫn giữ mức −16,5 dB ở phần còn lại", () => {
    const voice = sine(20, 0.05); // đủ dài để một đỉnh không làm lệch phép chuẩn hoá RMS quá 0,2 dB
    voice[10000] = 1; // đỉnh cao gấp 20 lần biên độ thường (crest factor lớn)
    const out = mixProgram([{ startSec: 0, samples: voice }], null, { sampleRate: SR, durationSec: 20 });
    const peak = Math.max(...Array.from(out.left).map(Math.abs));
    expect(peak).toBeLessThanOrEqual(MIX_DEFAULTS.ceiling + 1e-6);
    expect(out.limiterGainDb).toBeLessThan(-10); // đỉnh sau chuẩn hoá ≈ 4,2 → hạ khoảng 13 dB, chỉ quanh đỉnh
    // phần xa đỉnh giữ nguyên mức chuẩn hoá (trước đây cả bài bị hạ theo đỉnh)
    expect(rmsDb(slice(out.left, 0, 8))).toBeCloseTo(MIX_DEFAULTS.voiceTargetDb, 0);
  });
});
