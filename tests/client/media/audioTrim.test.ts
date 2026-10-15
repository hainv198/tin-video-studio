import { describe, expect, it } from "vitest";
import { trimSilence } from "@/client/media/audioTrim";

const SR = 1000;
function clip(leadSec: number, voiceSec: number, tailSec: number, amp = 0.3): Float32Array {
  const a = new Float32Array(Math.round((leadSec + voiceSec + tailSec) * SR));
  for (let i = Math.round(leadSec * SR); i < Math.round((leadSec + voiceSec) * SR); i++) a[i] = amp * Math.sin(i);
  return a;
}

describe("trimSilence", () => {
  it("cắt lặng đầu/cuối, chừa 40 ms mỗi đầu", () => {
    const r = trimSilence(clip(0.5, 1, 0.8), SR);
    expect(r.samples.length).toBe(Math.round((1 + 0.08) * SR));
    expect(r.leadTrimSec).toBeCloseTo(0.5 - 0.04, 3);
    expect(r.tailTrimSec).toBeCloseTo(0.8 - 0.04, 3);
  });

  it("không có lặng thì không cắt", () => {
    const original = clip(0, 1, 0);
    const r = trimSilence(original, SR);
    expect(r.samples.length).toBe(original.length);
    expect(r.leadTrimSec).toBe(0);
    expect(r.tailTrimSec).toBe(0);
  });

  it("lặng ít hơn phần chừa thì cắt tối đa phần có thể", () => {
    const r = trimSilence(clip(0.02, 1, 0.02), SR);
    expect(r.samples.length).toBe(Math.round(1.04 * SR));
    expect(r.leadTrimSec).toBe(0);
    expect(r.tailTrimSec).toBe(0);
  });

  it("toàn lặng thì trả nguyên mảng gốc", () => {
    const silent = new Float32Array(500);
    const r = trimSilence(silent, SR);
    expect(r.samples).toBe(silent);
    expect(r.leadTrimSec).toBe(0);
    expect(r.tailTrimSec).toBe(0);
  });

  it("kết quả là bản sao gọn, không dùng chung bộ đệm với mảng gốc", () => {
    const original = clip(0.5, 1, 0.5);
    const r = trimSilence(original, SR);
    expect(r.samples.buffer).not.toBe(original.buffer);
    expect(r.samples.byteLength).toBe(r.samples.buffer.byteLength);
  });

  it("tôn trọng ngưỡng: tiếng nhỏ hơn ngưỡng mặc định bị coi là toàn lặng, hạ ngưỡng xuống thì cắt đúng", () => {
    const quietVoice = clip(0.3, 1, 0.3, 0.003); // ≈ −50 dB, thấp hơn ngưỡng mặc định −45 dB
    expect(trimSilence(quietVoice, SR).samples).toBe(quietVoice); // không mẫu nào qua ngưỡng → trả nguyên gốc
    expect(trimSilence(quietVoice, SR, { thresholdDb: -40 }).samples).toBe(quietVoice);
    const lowered = trimSilence(quietVoice, SR, { thresholdDb: -60 }); // ngưỡng 0,001 < biên độ 0,003
    expect(lowered.leadTrimSec).toBeCloseTo(0.3 - 0.04, 2);
    expect(lowered.tailTrimSec).toBeCloseTo(0.3 - 0.04, 2);
  });
});
