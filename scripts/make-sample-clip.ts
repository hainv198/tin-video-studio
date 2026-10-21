import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { FfmpegMissingError } from "./measure-mp4";

export interface SampleClipOptions {
  out: string;
  seconds: number;
  width: number;
  height: number;
  /** Có track âm sin (mặc định 440 Hz, 44,1 kHz — khác 48 kHz để thử lấy mẫu lại). */
  audio: boolean;
  frequency?: number;
  sampleRate?: number;
}

/** Tham số ffmpeg tạo video mẫu bằng nguồn lavfi (testsrc2 + sine): không cần file nguồn, kết quả lặp lại được. */
export function sampleClipArgs(o: SampleClipOptions): string[] {
  const args = ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=${o.width}x${o.height}:rate=30:duration=${o.seconds}`];
  if (o.audio) {
    args.push("-f", "lavfi", "-i", `sine=frequency=${o.frequency ?? 440}:sample_rate=${o.sampleRate ?? 44100}:duration=${o.seconds}`);
  }
  args.push("-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-g", "60");
  if (o.audio) args.push("-c:a", "aac", "-b:a", "128k");
  else args.push("-an");
  args.push("-movflags", "+faststart", o.out);
  return args;
}

/** Tạo video mẫu; ném FfmpegMissingError nếu máy không có ffmpeg. */
export function makeSampleClip(o: SampleClipOptions): string {
  mkdirSync(dirname(o.out), { recursive: true });
  try {
    execFileSync("ffmpeg", sampleClipArgs(o), { stdio: ["ignore", "ignore", "pipe"] });
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") throw new FfmpegMissingError();
    throw error;
  }
  return o.out;
}

function main(): void {
  const [out, secondsText, ...flags] = process.argv.slice(2);
  if (!out) {
    console.error("Cách dùng: npm run sample:clip -- <ra.mp4> [giây=8] [--no-audio] [--size 1280x720]");
    process.exit(1);
  }
  const sizeIndex = flags.indexOf("--size");
  const [w, h] = (sizeIndex >= 0 ? (flags[sizeIndex + 1] ?? "1280x720") : "1280x720").split("x").map(Number);
  makeSampleClip({ out, seconds: Number(secondsText ?? 8), width: w ?? 1280, height: h ?? 720, audio: !flags.includes("--no-audio") });
  console.log(`Đã tạo ${out}`);
}

if (process.argv[1] && /make-sample-clip\.ts$/.test(process.argv[1].replace(/\\/g, "/"))) main();
