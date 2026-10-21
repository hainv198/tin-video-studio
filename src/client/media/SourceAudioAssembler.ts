import { resample } from "./resample";

export interface AssemblerOptions {
  /** Tần số mẫu của bản trộn (RENDER_SAMPLE_RATE). */
  targetRate: number;
  /** Mốc (giây, trong file) của khung hình đầu: âm đặt theo mốc này để khớp hình. */
  originSec: number;
  /** Độ dài video (giây, từ khung đầu): âm ngắn hơn thì phần thiếu lặng, dài hơn thì cắt. */
  durationSec: number;
  /** 1 (mono) hoặc 2 (stereo). */
  channelCount: number;
}

export interface DecodedChunk {
  timestampSec: number;
  sampleRate: number;
  /** Mỗi kênh một mảng Float32 (planar). Ít kênh hơn `channelCount` thì kênh cuối được dùng lại. */
  channels: Float32Array[];
}

/**
 * Ghép các mẩu âm đã giải mã (ở tần số gốc — lấy từ mẩu đầu, vì HE-AAC có thể báo tần số track bằng nửa thực tế)
 * vào bộ đệm dài đúng `durationSec`, rồi lấy mẫu lại MỘT lần cả kênh (tránh tiếng tách ở biên mẩu).
 */
export class SourceAudioAssembler {
  private nativeRate = 0;
  private buffers: Float32Array[] = [];

  constructor(private readonly o: AssemblerOptions) {
    if (o.channelCount !== 1 && o.channelCount !== 2) throw new RangeError("Chỉ ghép 1 hoặc 2 kênh");
  }

  get channelCount(): number {
    return this.o.channelCount;
  }

  add(chunk: DecodedChunk): void {
    if (this.nativeRate === 0) {
      this.nativeRate = chunk.sampleRate;
      const length = Math.ceil(this.o.durationSec * chunk.sampleRate);
      this.buffers = Array.from({ length: this.o.channelCount }, () => new Float32Array(length));
    } else if (chunk.sampleRate !== this.nativeRate) {
      throw new Error("Âm thanh gốc đổi tần số mẫu giữa chừng");
    }
    const offset = Math.round((chunk.timestampSec - this.o.originSec) * this.nativeRate);
    for (let c = 0; c < this.o.channelCount; c++) {
      const src = chunk.channels[Math.min(c, chunk.channels.length - 1)];
      const dst = this.buffers[c];
      if (!src || !dst) continue;
      const from = Math.max(0, -offset);
      const to = Math.min(src.length, dst.length - offset);
      if (to > from) dst.set(src.subarray(from, to), offset + from);
    }
  }

  /** Mỗi kênh dài đúng round(durationSec × targetRate). */
  finish(): Float32Array[] {
    const length = Math.round(this.o.durationSec * this.o.targetRate);
    if (this.nativeRate === 0) return Array.from({ length: this.o.channelCount }, () => new Float32Array(length));
    return this.buffers.map((buffer) => fitLength(resample(buffer, this.nativeRate, this.o.targetRate), length));
  }
}

function fitLength(a: Float32Array, length: number): Float32Array {
  if (a.length === length) return a;
  const out = new Float32Array(length);
  out.set(a.subarray(0, Math.min(length, a.length)));
  return out;
}
