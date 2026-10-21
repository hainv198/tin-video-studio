import { AudioSample, AudioSampleSource, BufferTarget, canEncodeAudio, Mp4OutputFormat, Output } from "mediabunny";

/** Mã hoá âm thanh mono thành file nén để tải xuống. */
export interface AudioExporter {
  canEncode(sampleRate: number): Promise<boolean>;
  encode(samples: Float32Array, sampleRate: number): Promise<Blob>;
}

const BITRATE = 128_000;
const CHUNK_SEC = 1;

/** .m4a (AAC trong MP4) bằng mediabunny + WebCodecs — cùng bộ mã hoá AAC mà Mp4Encoder dùng khi dựng video. */
export class AacAudioExporter implements AudioExporter {
  async canEncode(sampleRate: number): Promise<boolean> {
    try {
      return await canEncodeAudio("aac", { numberOfChannels: 1, sampleRate });
    } catch {
      return false;
    }
  }

  async encode(samples: Float32Array, sampleRate: number): Promise<Blob> {
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
    const source = new AudioSampleSource({ codec: "aac", bitrate: BITRATE });
    output.addAudioTrack(source);
    await output.start();
    const chunk = Math.round(CHUNK_SEC * sampleRate);
    for (let start = 0; start < samples.length; start += chunk) {
      const sample = new AudioSample({
        data: samples.slice(start, Math.min(samples.length, start + chunk)),
        format: "f32",
        numberOfChannels: 1,
        sampleRate,
        timestamp: start / sampleRate,
      });
      await source.add(sample);
      sample.close();
    }
    source.close();
    await output.finalize();
    if (!target.buffer) throw new Error("Không tạo được file M4A");
    return new Blob([target.buffer], { type: "audio/mp4" });
  }
}
