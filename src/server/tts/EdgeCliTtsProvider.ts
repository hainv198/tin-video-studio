import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { UpstreamError, ValidationError } from "@/domain/errors";
import type { SynthesisRequest, SynthesisResult, TtsProvider, TtsVoice } from "./TtsProvider";

const run = promisify(execFile);
const VOICES: TtsVoice[] = [
  { name: "vi-VN-HoaiMyNeural", gender: "FEMALE", tier: "Edge" },
  { name: "vi-VN-NamMinhNeural", gender: "MALE", tier: "Edge" },
];

export type EdgeRunner = (args: string[]) => Promise<void>;

export interface EdgeCliOptions {
  /** Đường dẫn tới edge-tts (mặc định "edge-tts" trong PATH). */
  bin?: string;
  /** Chỉ dùng cho test: thay lệnh thật. */
  runner?: EdgeRunner;
}

export function ratePercent(speakingRate: number): string {
  const pct = Math.round((speakingRate - 1) * 100);
  return `${pct >= 0 ? "+" : "-"}${Math.abs(pct)}%`;
}

/**
 * Giọng Microsoft Edge qua lệnh edge-tts cài trên máy, CHỈ để nghe thử khi phát triển.
 * Dịch vụ này không chính thức và có thể bị chặn bất cứ lúc nào, nên không dùng cho bản deploy.
 */
export class EdgeCliTtsProvider implements TtsProvider {
  private readonly runner: EdgeRunner;

  constructor(options: EdgeCliOptions = {}) {
    const bin = options.bin || "edge-tts";
    this.runner = options.runner ?? (async (args) => void (await run(bin, args, { timeout: 60_000, windowsHide: true })));
  }

  async listVoices(languageCode: string): Promise<TtsVoice[]> {
    return languageCode === "vi-VN" ? VOICES.map((v) => ({ ...v })) : [];
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    if (!VOICES.some((v) => v.name === request.voiceName)) throw new ValidationError(`Không có giọng ${request.voiceName}`);
    const dir = await mkdtemp(join(tmpdir(), "tvs-edge-"));
    const textFile = join(dir, "in.txt");
    const outFile = join(dir, "out.mp3");
    try {
      await writeFile(textFile, request.text, "utf8");
      try {
        await this.runner([
          "--voice",
          request.voiceName,
          `--rate=${ratePercent(request.speakingRate)}`,
          "--file",
          textFile,
          "--write-media",
          outFile,
        ]);
      } catch (error) {
        console.error(error);
        throw new UpstreamError("Giọng Edge (dev) không chạy được, kiểm tra lệnh edge-tts");
      }
      const audio = await readFile(outFile).catch(() => null);
      if (!audio || audio.byteLength === 0) throw new UpstreamError("Giọng Edge (dev) không trả về âm thanh");
      return { audio: Uint8Array.from(audio), mimeType: "audio/mpeg" };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
