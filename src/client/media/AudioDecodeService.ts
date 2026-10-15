export interface DecodedAudio {
  channels: Float32Array[];
  durationSec: number;
  sampleRate: number;
}

/** Giải mã MP3/WAV/M4A thành mẫu Float32 ở sampleRate cố định. Chỉ chạy ở luồng chính (cần Web Audio). */
export class AudioDecodeService {
  constructor(private readonly sampleRate = 48000) {}

  async decode(bytes: ArrayBuffer): Promise<DecodedAudio> {
    // decodeAudioData tự lấy mẫu lại (resample) về tần số của context, nên tạo context ở sampleRate đích
    // là đủ để đầu ra luôn đúng sampleRate đó, bất kể tần số gốc của file.
    const ctx = new OfflineAudioContext(2, 1, this.sampleRate);
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i).slice());
    return { channels, durationSec: buffer.duration, sampleRate: buffer.sampleRate };
  }

  static toMono(channels: Float32Array[]): Float32Array {
    const first = channels[0];
    if (!first) return new Float32Array();
    if (channels.length === 1) return first;
    const out = new Float32Array(first.length);
    for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) + (ch[i] ?? 0) / channels.length;
    return out;
  }
}
