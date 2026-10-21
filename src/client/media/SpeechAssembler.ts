import { AudioDecodeService } from "./AudioDecodeService";
import { trimSilence } from "./audioTrim";
import { applyVoiceTweak, encodeWav, type VoiceTweak } from "./voiceTweak";

export interface AssembleOptions {
  pauseSec: number;
  tweak: VoiceTweak;
}

/** Ghép các mẩu mono, chèn `pauseSec` giây lặng giữa hai mẩu liền nhau. */
export function joinWithPauses(parts: Float32Array[], sampleRate: number, pauseSec: number): Float32Array {
  if (parts.length === 0) return new Float32Array(0);
  const gap = Math.round(pauseSec * sampleRate);
  const total = parts.reduce((sum, p) => sum + p.length, 0) + gap * (parts.length - 1);
  const out = new Float32Array(total);
  let offset = 0;
  parts.forEach((part, i) => {
    if (i > 0) offset += gap;
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

/** Ghép giọng đọc riêng: mỗi mẩu cắt lặng, áp tinh chỉnh, rồi nối liền với khoảng nghỉ cố định; xuất WAV. */
export class SpeechAssembler {
  /** Mẩu vừa giải mã → mono, bỏ lặng đầu/cuối (khoảng nghỉ do người dùng chọn thay thế). */
  prepare(channels: Float32Array[], sampleRate: number): Float32Array {
    return trimSilence(AudioDecodeService.toMono(channels), sampleRate).samples;
  }

  /** Tinh chỉnh áp TỪNG mẩu nên khoảng nghỉ giữ đúng độ dài đã chọn. */
  assemble(clips: Float32Array[], sampleRate: number, options: AssembleOptions): Float32Array {
    const tweaked = clips.map((clip) => applyVoiceTweak(clip, sampleRate, options.tweak));
    return joinWithPauses(tweaked, sampleRate, options.pauseSec);
  }

  /** WAV PCM 16-bit mono. */
  toWav(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
    return encodeWav(samples, sampleRate);
  }
}
