import { describe, expect, it } from "vitest";
import { SourceAudioAssembler } from "@/client/media/SourceAudioAssembler";

const ramp = (n: number, start = 1) => Float32Array.from({ length: n }, (_, i) => start + i);

describe("SourceAudioAssembler", () => {
  it("đặt mẩu theo mốc so với khung đầu; thiếu thì lặng; độ dài đúng durationSec", () => {
    const asm = new SourceAudioAssembler({ targetRate: 10, originSec: 0.5, durationSec: 1, channelCount: 1 });
    asm.add({ timestampSec: 0.7, sampleRate: 10, channels: [ramp(3)] });
    const [mono] = asm.finish();
    expect(Array.from(mono ?? [])).toEqual([0, 0, 1, 2, 3, 0, 0, 0, 0, 0]);
  });

  it("mẩu trước khung đầu (mốc âm) bị cắt; mẩu vượt độ dài bị cắt", () => {
    const asm = new SourceAudioAssembler({ targetRate: 10, originSec: 0, durationSec: 0.5, channelCount: 1 });
    asm.add({ timestampSec: -0.2, sampleRate: 10, channels: [ramp(4)] });
    asm.add({ timestampSec: 0.3, sampleRate: 10, channels: [ramp(5, 10)] });
    expect(Array.from(asm.finish()[0] ?? [])).toEqual([3, 4, 0, 10, 11]);
  });

  it("stereo giữ hai kênh; mẩu mono vào bộ 2 kênh thì nhân đôi", () => {
    const asm = new SourceAudioAssembler({ targetRate: 10, originSec: 0, durationSec: 0.3, channelCount: 2 });
    asm.add({ timestampSec: 0, sampleRate: 10, channels: [ramp(1), ramp(1, 5)] });
    asm.add({ timestampSec: 0.1, sampleRate: 10, channels: [ramp(2, 7)] });
    const [l, r] = asm.finish();
    expect(Array.from(l ?? [])).toEqual([1, 7, 8]);
    expect(Array.from(r ?? [])).toEqual([5, 7, 8]);
  });

  it("không có mẩu nào: trả lặng đúng độ dài", () => {
    const asm = new SourceAudioAssembler({ targetRate: 48000, originSec: 0, durationSec: 2, channelCount: 2 });
    const out = asm.finish();
    expect(out.map((c) => c.length)).toEqual([96000, 96000]);
  });

  it("tần số gốc khác đích: lấy mẫu lại, độ dài round(durationSec × targetRate)", () => {
    const asm = new SourceAudioAssembler({ targetRate: 48000, originSec: 0, durationSec: 1.5, channelCount: 1 });
    asm.add({ timestampSec: 0, sampleRate: 44100, channels: [new Float32Array(44100 * 2).fill(0.25)] });
    const [mono] = asm.finish();
    expect(mono?.length).toBe(72000);
    expect(mono?.[36000]).toBeCloseTo(0.25, 5);
  });

  it("đổi tần số giữa chừng hoặc số kênh lạ thì ném", () => {
    const asm = new SourceAudioAssembler({ targetRate: 48000, originSec: 0, durationSec: 1, channelCount: 1 });
    asm.add({ timestampSec: 0, sampleRate: 44100, channels: [new Float32Array(10)] });
    expect(() => asm.add({ timestampSec: 0.1, sampleRate: 48000, channels: [new Float32Array(10)] })).toThrow(
      "Âm thanh gốc đổi tần số mẫu giữa chừng",
    );
    expect(() => new SourceAudioAssembler({ targetRate: 48000, originSec: 0, durationSec: 1, channelCount: 3 })).toThrow(
      "Chỉ ghép 1 hoặc 2 kênh",
    );
  });
});
