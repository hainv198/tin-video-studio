import { execFileSync } from "node:child_process";
import { audioMetrics, type AudioMetrics } from "./lib/audioMetrics";
import { parseWav } from "./lib/wav";

function usage(): never {
  console.error("Cách dùng: npm run measure:mp4 -- <file.mp4> [--json]");
  process.exit(1);
}

export class FfmpegMissingError extends Error {
  constructor() {
    super("Cần ffmpeg trong PATH để đo âm");
    this.name = "FfmpegMissingError";
  }
}

export interface DecodedFileAudio {
  channels: Float32Array[];
  sampleRate: number;
}

/** Giải mã âm của MP4 bằng ffmpeg (stereo 48 kHz). Ném FfmpegMissingError nếu máy không có ffmpeg. */
export function decodeFileAudio(file: string): DecodedFileAudio {
  let wav: Buffer;
  try {
    wav = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vn", "-ac", "2", "-ar", "48000", "-f", "wav", "pipe:1"], {
      maxBuffer: 1024 * 1024 * 512,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") throw new FfmpegMissingError();
    throw error;
  }
  const parsed = parseWav(new Uint8Array(wav.buffer, wav.byteOffset, wav.byteLength));
  return { channels: parsed.channels, sampleRate: parsed.sampleRate };
}

/** Giải mã âm của MP4 bằng ffmpeg rồi đo. Ném FfmpegMissingError nếu máy không có ffmpeg (để e2e bỏ qua phần đo). */
export function measureFile(file: string): AudioMetrics {
  const audio = decodeFileAudio(file);
  return audioMetrics(audio.channels, audio.sampleRate);
}

function main(): void {
  const [file, flag] = process.argv.slice(2);
  if (!file) usage();
  let m: AudioMetrics;
  try {
    m = measureFile(file);
  } catch (error) {
    if (error instanceof FfmpegMissingError) {
      console.error(error.message);
      process.exit(2);
    }
    throw error;
  }
  if (flag === "--json") {
    console.log(JSON.stringify(m));
    return;
  }
  const fmt = (x: number) => (Number.isNaN(x) ? "—" : x.toFixed(2));
  console.log(`Thời lượng: ${fmt(m.durationSec)} s`);
  console.log(`Đỉnh: ${m.peak.toFixed(3)} (trần 0,89)`);
  console.log(`Đoạn có tiếng: ${fmt(m.voicedRmsDb)} dB RMS (${m.voicedWindows}/${m.windows} cửa sổ; mục tiêu −16,5 ± 1)`);
  console.log(`Lúc nghỉ (nhạc nền): ${fmt(m.quietRmsDb)} dB RMS (mẫu Theanh28 ≈ −30)`);
}

// Chỉ chạy CLI khi gọi trực tiếp; khi e2e import `measureFile` thì không chạy.
if (process.argv[1] && /measure-mp4\.ts$/.test(process.argv[1].replace(/\\/g, "/"))) main();
