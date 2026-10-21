import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from "mediabunny";
import { SourceAudioAssembler } from "./SourceAudioAssembler";

/** Báo khi video CÓ track âm nhưng không giải mã được: dừng dựng, không âm thầm bỏ tiếng gốc. */
export const SOURCE_AUDIO_DECODE_ERROR =
  "Không giải mã được tiếng gốc của video tải lên. Hãy kéo mức tiếng gốc về 0 % để dựng không có tiếng gốc, hoặc chuyển video sang MP4 (âm AAC) rồi tải lại.";

/**
 * Giải mã track âm của video tải lên (WebCodecs, chạy được trong worker), đặt theo mốc khung hình đầu, lấy mẫu lại về
 * `targetRate`. Trả null khi video không có track âm (hợp lệ: chỉ là không có tiếng gốc); có track mà trình duyệt không
 * giải mã được thì ném lỗi tiếng Việt. Không chạy trong Vitest (cần trình duyệt).
 */
export async function decodeSourceAudio(blob: Blob, targetRate: number, durationSec: number): Promise<Float32Array[] | null> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return null;
    if (!(await track.canDecode())) throw new Error(SOURCE_AUDIO_DECODE_ERROR);
    const video = await input.getPrimaryVideoTrack();
    const originSec = video ? await video.getFirstTimestamp() : 0;
    const assembler = new SourceAudioAssembler({
      targetRate,
      originSec,
      durationSec,
      channelCount: Math.min(2, Math.max(1, track.numberOfChannels)),
    });
    const sink = new AudioSampleSink(track);
    try {
      for await (const sample of sink.samples(originSec, originSec + durationSec)) {
        try {
          const channels = Array.from({ length: Math.min(assembler.channelCount, sample.numberOfChannels) }, (_, c) => {
            const plane = new Float32Array(sample.numberOfFrames);
            sample.copyTo(plane, { planeIndex: c, format: "f32-planar" });
            return plane;
          });
          assembler.add({ timestampSec: sample.timestamp, sampleRate: sample.sampleRate, channels });
        } finally {
          sample.close();
        }
      }
    } catch (error) {
      throw new Error(SOURCE_AUDIO_DECODE_ERROR, { cause: error });
    }
    return assembler.finish();
  } finally {
    input.dispose();
  }
}
