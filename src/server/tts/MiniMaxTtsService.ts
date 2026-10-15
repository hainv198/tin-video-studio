import { z } from "zod";
import { QuotaError, UpstreamError, ValidationError } from "@/domain/errors";
import { fetchJson } from "@/server/http/upstream";
import { MINIMAX_DEFAULT_MODEL, minimaxUrl, validateVoiceId, type MiniMaxBaseResp } from "./minimaxShared";
import type { SynthesisRequest, SynthesisResult, TtsProvider, TtsVoice, VoiceGender } from "./TtsProvider";

export const MINIMAX_VOICE_PREFIX = "vi-VN-MiniMax-";
const LANGUAGE = "vi-VN";
const LABELS = { service: "MiniMax", quotaMessage: "MiniMax đã hết lượt tạo giọng, thử lại sau" };
const QUOTA_CODES = new Set([1002, 1039]);

export interface MiniMaxVoice {
  alias: string;
  voiceId: string;
  gender: VoiceGender;
}

const VoicesSchema = z.array(
  z.object({
    alias: z.string().regex(/^[A-Za-z0-9]{1,32}$/),
    voiceId: z.string().refine(validateVoiceId),
    gender: z.enum(["MALE", "FEMALE", "NEUTRAL"]),
  }),
);

export function parseMiniMaxVoices(raw: string): MiniMaxVoice[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("MINIMAX_VOICES không phải JSON hợp lệ");
  }
  const result = VoicesSchema.safeParse(parsed);
  if (!result.success) throw new Error("MINIMAX_VOICES sai định dạng (cần alias, voiceId, gender)");
  const seen = new Set<string>();
  for (const v of result.data) {
    if (seen.has(v.alias)) throw new Error(`MINIMAX_VOICES bị trùng alias ${v.alias}`);
    seen.add(v.alias);
  }
  return result.data;
}

export interface MiniMaxTtsOptions {
  apiKey: string;
  voices: MiniMaxVoice[];
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface T2AResponse {
  data?: { audio?: string } | null;
  base_resp?: MiniMaxBaseResp;
}

export class MiniMaxTtsService implements TtsProvider {
  private readonly byAlias: ReadonlyMap<string, MiniMaxVoice>;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: MiniMaxTtsOptions) {
    if (!options.apiKey) throw new Error("MINIMAX_API_KEY chưa được cấu hình");
    if (options.voices.length === 0) throw new Error("MINIMAX_VOICES chưa có giọng nào");
    this.byAlias = new Map(options.voices.map((v) => [v.alias, v]));
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  owns(voiceName: string): boolean {
    return voiceName.startsWith(MINIMAX_VOICE_PREFIX);
  }

  async listVoices(languageCode: string): Promise<TtsVoice[]> {
    if (languageCode !== LANGUAGE) return [];
    return this.options.voices.map((v) => ({ name: `${MINIMAX_VOICE_PREFIX}${v.alias}`, gender: v.gender, tier: "MiniMax" }));
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const voice = this.owns(request.voiceName)
      ? this.byAlias.get(request.voiceName.slice(MINIMAX_VOICE_PREFIX.length))
      : undefined;
    if (!voice) throw new ValidationError(`Không có giọng ${request.voiceName}`);

    const body = {
      model: this.options.model || MINIMAX_DEFAULT_MODEL,
      text: request.text,
      stream: false,
      language_boost: "Vietnamese",
      output_format: "hex",
      voice_setting: { voice_id: voice.voiceId, speed: request.speakingRate },
      audio_setting: { format: "mp3", sample_rate: 44100, bitrate: 128000, channel: 1 },
    };
    const data = await fetchJson<T2AResponse>(
      this.fetchImpl,
      minimaxUrl(this.options.baseUrl, "/v1/t2a_v2"),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      LABELS,
    );

    const code = data.base_resp?.status_code ?? 0;
    if (code !== 0) {
      if (QUOTA_CODES.has(code)) throw new QuotaError(LABELS.quotaMessage);
      console.warn(`[MiniMax] status_code ${code}: ${data.base_resp?.status_msg ?? ""}`);
      throw new UpstreamError(`MiniMax lỗi ${code}`);
    }
    const hex = data.data?.audio;
    if (!hex) throw new UpstreamError("MiniMax không trả về âm thanh");
    return { audio: Uint8Array.from(Buffer.from(hex, "hex")), mimeType: "audio/mpeg" };
  }
}
