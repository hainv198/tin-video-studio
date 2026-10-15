import { z } from "zod";
import { QuotaError, UpstreamError, ValidationError } from "@/domain/errors";
import { fetchJson } from "@/server/http/upstream";
import { validateAlias } from "./minimaxShared";
import type { RoutedTtsProvider } from "./RoutingTtsProvider";
import type { SynthesisRequest, SynthesisResult, TtsVoice, VoiceGender } from "./TtsProvider";

export const VCLIP_VOICE_PREFIX = "vi-VN-Vclip-";
const DEFAULT_BASE_URL = "https://api-tts.vclip.io";
const LANGUAGE = "vi-VN";
const MIN_SPEED = 0.5;
const MAX_SPEED = 2;
const LABELS = { service: "vclip", quotaMessage: "vclip đã hết hạn mức, kiểm tra tài khoản" };
const QUOTA_HINT = /quota|credit|limit|insufficient/i;
const FAILED_STATES = new Set(["failed", "error", "cancelled", "canceled"]);

export interface VclipVoice {
  alias: string;
  voiceId: string;
  gender: VoiceGender;
}

const VoicesSchema = z.array(
  z.object({
    alias: z.string().refine(validateAlias),
    voiceId: z.string().trim().min(1),
    gender: z.enum(["MALE", "FEMALE", "NEUTRAL"]),
  }),
);

export function parseVclipVoices(raw: string): VclipVoice[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("VCLIP_VOICES không phải JSON hợp lệ");
  }
  const result = VoicesSchema.safeParse(parsed);
  if (!result.success) throw new Error("VCLIP_VOICES sai định dạng (cần alias, voiceId, gender)");
  const seen = new Set<string>();
  for (const v of result.data) {
    if (seen.has(v.alias)) throw new Error(`VCLIP_VOICES bị trùng alias ${v.alias}`);
    seen.add(v.alias);
  }
  return result.data;
}

export interface VclipTtsOptions {
  apiKey: string;
  voices: VclipVoice[];
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Chờ giữa hai lần hỏi trạng thái; test truyền hàm rỗng để khỏi chờ thật. */
  sleep?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

interface RpcBody {
  projectExportId?: string;
  state?: string;
  status?: string;
  url?: string;
  audioUrl?: string;
  downloadUrl?: string;
  data?: { projectExportId?: string };
}

interface RpcResponse extends RpcBody {
  result?: RpcBody;
  error?: { code?: string; message?: string };
}

export class VclipTtsService implements RoutedTtsProvider {
  private readonly byAlias: ReadonlyMap<string, VclipVoice>;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(private readonly options: VclipTtsOptions) {
    if (!options.apiKey) throw new Error("VCLIP_API_KEY chưa được cấu hình");
    if (options.voices.length === 0) throw new Error("VCLIP_VOICES chưa có giọng nào");
    this.byAlias = new Map(options.voices.map((v) => [v.alias, v]));
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.pollIntervalMs = options.pollIntervalMs ?? 2500;
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  owns(voiceName: string): boolean {
    return voiceName.startsWith(VCLIP_VOICE_PREFIX);
  }

  async listVoices(languageCode: string): Promise<TtsVoice[]> {
    if (languageCode !== LANGUAGE) return [];
    return this.options.voices.map((v) => ({ name: `${VCLIP_VOICE_PREFIX}${v.alias}`, gender: v.gender, tier: "Vclip" }));
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const voice = this.owns(request.voiceName)
      ? this.byAlias.get(request.voiceName.slice(VCLIP_VOICE_PREFIX.length))
      : undefined;
    if (!voice) throw new ValidationError(`Không có giọng ${request.voiceName}`);

    const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, request.speakingRate));
    const started = await this.rpc("ttsLongText", { text: request.text, userVoiceId: voice.voiceId, speed });
    const projectExportId = started.projectExportId ?? started.data?.projectExportId;
    if (!projectExportId) throw new UpstreamError("vclip không trả về mã tạo giọng");

    const url = await this.waitForUrl(projectExportId);
    return this.download(url);
  }

  private async waitForUrl(projectExportId: string): Promise<string> {
    let waited = 0;
    for (;;) {
      const body = await this.rpc("getExportStatus", { projectExportId });
      const state = (body.state ?? body.status ?? "").toLowerCase();
      if (state === "completed") {
        const url = body.url ?? body.audioUrl ?? body.downloadUrl;
        if (!url) throw new UpstreamError("vclip không trả về âm thanh");
        return url;
      }
      if (FAILED_STATES.has(state)) throw new UpstreamError("vclip tạo giọng thất bại");
      if (waited >= this.timeoutMs) throw new UpstreamError("vclip quá lâu không trả kết quả");
      await this.sleep(this.pollIntervalMs);
      waited += this.pollIntervalMs;
    }
  }

  /** JSON-RPC của vclip trả HTTP 200 cả khi lỗi, nên phải đọc đối tượng `error` ở ngoài cùng. */
  private async rpc(method: string, input: Record<string, unknown>): Promise<RpcBody> {
    const { apiKey } = this.options;
    const baseUrl = (this.options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    const json = await fetchJson<RpcResponse>(
      this.fetchImpl,
      `${baseUrl}/json-rpc`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ method, input }),
      },
      { ...LABELS, redact: [apiKey] },
    );
    if (json.error) {
      const code = String(json.error.code ?? "");
      const message = String(json.error.message ?? "");
      if (QUOTA_HINT.test(code) || QUOTA_HINT.test(message)) throw new QuotaError(LABELS.quotaMessage);
      console.warn(`[vclip] ${code}: ${message.split(apiKey).join("[đã che]").slice(0, 300)}`);
      throw new UpstreamError(`vclip lỗi: ${code}`);
    }
    return json.result ?? json;
  }

  private async download(url: string): Promise<SynthesisResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(url);
    } catch {
      throw new UpstreamError("Không tải được âm thanh từ vclip");
    }
    if (!response.ok) throw new UpstreamError(`vclip lỗi tải âm thanh ${response.status}`);
    const audio = new Uint8Array(await response.arrayBuffer());
    if (audio.length === 0) throw new UpstreamError("vclip không trả về âm thanh");
    return { audio, mimeType: response.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg" };
  }
}
