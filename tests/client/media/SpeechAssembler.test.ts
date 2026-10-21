import { describe, expect, it } from "vitest";
import { joinWithPauses, SpeechAssembler } from "@/client/media/SpeechAssembler";

const SR = 48000;
const filled = (length: number, value = 0.5) => new Float32Array(length).fill(value);

describe("joinWithPauses", () => {
  it("độ dài = tổng các mẩu + (n−1) khoảng nghỉ; khoảng nghỉ là lặng; giữ thứ tự", () => {
    const out = joinWithPauses([filled(100, 0.1), filled(50, 0.2), filled(10, 0.3)], 1000, 0.35);
    expect(out.length).toBe(100 + 50 + 10 + 2 * 350);
    expect(out[0]).toBeCloseTo(0.1);
    expect(out[100]).toBe(0);
    expect(out[449]).toBe(0);
    expect(out[450]).toBeCloseTo(0.2);
    expect(out[out.length - 1]).toBeCloseTo(0.3);
  });

  it("một mẩu thì không có khoảng nghỉ; không mẩu thì rỗng", () => {
    expect(joinWithPauses([filled(7)], SR, 1).length).toBe(7);
    expect(joinWithPauses([], SR, 1).length).toBe(0);
  });
});

describe("SpeechAssembler", () => {
  const assembler = new SpeechAssembler();

  it("prepare gộp về mono và cắt lặng đầu/cuối", () => {
    const left = new Float32Array(SR); // 1 giây
    const right = new Float32Array(SR);
    left.fill(0.5, 24000, 24480); // 10 ms có tiếng ở giữa
    right.fill(0.5, 24000, 24480);
    const out = assembler.prepare([left, right], SR);
    // còn 10 ms tiếng + đệm 40 ms mỗi đầu
    expect(out.length).toBe(480 + 2 * Math.round(0.04 * SR));
  });

  it("assemble mặc định: đúng bằng ghép + khoảng nghỉ", () => {
    const out = assembler.assemble([filled(1000), filled(2000)], SR, { pauseSec: 0.1, tweak: { tempo: 1, pitchSemitones: 0 } });
    expect(out.length).toBe(3000 + 4800);
  });

  it("assemble có tinh chỉnh: mỗi mẩu co theo tempo, khoảng nghỉ giữ nguyên", () => {
    const out = assembler.assemble([filled(4800), filled(9600)], SR, { pauseSec: 0.5, tweak: { tempo: 1.2, pitchSemitones: 2 } });
    expect(out.length).toBe(4000 + 8000 + 24000);
  });

  it("toWav: RIFF/WAVE, PCM 16-bit mono 48 kHz, độ dài dữ liệu đúng", () => {
    const bytes = assembler.toWav(filled(480, 0.25), SR);
    const view = new DataView(bytes.buffer);
    const text = (from: number) => String.fromCharCode(...bytes.slice(from, from + 4));
    expect(text(0)).toBe("RIFF");
    expect(text(8)).toBe("WAVE");
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint32(28, true)).toBe(48000 * 2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(480 * 2);
    expect(bytes.length).toBe(44 + 960);
    expect(view.getInt16(44, true)).toBe(Math.round(0.25 * 32767));
  });
});
