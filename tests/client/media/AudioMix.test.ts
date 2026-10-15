import { describe, expect, it } from "vitest";
import { dbToGain, MIX_DEFAULTS, mixProgram, rmsDb } from "@/client/media/AudioMix";

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
