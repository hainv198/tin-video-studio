import { canEncodeAudio, canEncodeVideo } from "mediabunny";

export interface SupportReport {
  ok: boolean;
  missing: string[];
}

interface Encoders {
  canEncodeVideo: (codec: "avc", options: { width: number; height: number }) => Promise<boolean>;
  canEncodeAudio: (codec: "aac", options: { numberOfChannels: number; sampleRate: number }) => Promise<boolean>;
}

const REQUIRED = ["VideoEncoder", "AudioEncoder", "OffscreenCanvas", "Worker"] as const;

export class BrowserSupport {
  constructor(
    private readonly env: Record<string, unknown>,
    private readonly encoders: Encoders,
  ) {}

  async check(): Promise<SupportReport> {
    const missing: string[] = REQUIRED.filter((name) => typeof this.env[name] === "undefined");
    if (missing.length > 0) return { ok: false, missing };
    if (!(await this.encoders.canEncodeVideo("avc", { width: 1080, height: 1920 }))) missing.push("Mã hoá H.264 1080×1920");
    if (!(await this.encoders.canEncodeAudio("aac", { numberOfChannels: 2, sampleRate: 48000 }))) {
      missing.push("Mã hoá AAC 48 kHz stereo");
    }
    return { ok: missing.length === 0, missing };
  }
}

export function browserSupport(): BrowserSupport {
  return new BrowserSupport(globalThis as unknown as Record<string, unknown>, { canEncodeVideo, canEncodeAudio });
}
