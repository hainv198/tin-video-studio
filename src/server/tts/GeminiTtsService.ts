import { UpstreamError, ValidationError } from "@/domain/errors";
import { fetchJson } from "@/server/http/upstream";
import type { SynthesisRequest, SynthesisResult, TtsProvider, TtsVoice, VoiceGender } from "./TtsProvider";
import { pcm16ToWav } from "./wav";

export const GEMINI_VOICE_PREFIX = "vi-VN-Gemini-";
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_SAMPLE_RATE = 24000;
const LANGUAGE = "vi-VN";
const LABELS = { service: "Gemini", quotaMessage: "Gemini đã hết lượt tạo giọng, thử lại sau" };

/** Gemini không có endpoint liệt kê giọng nên dùng danh sách chọn sẵn. */
const VOICES: ReadonlyArray<{ name: string; gender: VoiceGender }> = [
  { name: "Kore", gender: "FEMALE" },
  { name: "Charon", gender: "MALE" },
  { name: "Despina", gender: "FEMALE" },
  { name: "Iapetus", gender: "MALE" },
  { name: "Erinome", gender: "FEMALE" },
  { name: "Alnilam", gender: "MALE" },
  { name: "Sulafat", gender: "FEMALE" },
  { name: "Rasalgethi", gender: "MALE" },
];

export interface GeminiTtsOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface GenerateContentResponse {
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
  promptFeedback?: { blockReason?: string };
}

function speedHint(rate: number): string {
  if (rate >= 1.15) return ", nhanh hơn bình thường một chút";
  if (rate <= 0.9) return ", chậm hơn bình thường một chút";
  return "";
}

export class GeminiTtsService implements TtsProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GeminiTtsOptions) {
    if (!options.apiKey) throw new Error("GEMINI_API_KEY chưa được cấu hình");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  owns(voiceName: string): boolean {
    return voiceName.startsWith(GEMINI_VOICE_PREFIX);
  }

  async listVoices(languageCode: string): Promise<TtsVoice[]> {
    if (languageCode !== LANGUAGE) return [];
    return VOICES.map((v) => ({ name: `${GEMINI_VOICE_PREFIX}${v.name}`, gender: v.gender, tier: "Gemini" }));
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const shortName = this.owns(request.voiceName) ? request.voiceName.slice(GEMINI_VOICE_PREFIX.length) : "";
    const voice = VOICES.find((v) => v.name === shortName);
    if (!voice) throw new ValidationError(`Không có giọng ${request.voiceName}`);

    const prompt = `Đọc đoạn tin sau bằng giọng phát thanh viên thời sự tiếng Việt, rõ ràng, trung tính${speedHint(request.speakingRate)}:\n\n${request.text}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.name } } },
      },
    };
    const baseUrl = this.options.baseUrl || DEFAULT_BASE_URL;
    const model = this.options.model || GEMINI_DEFAULT_MODEL;
    const data = await fetchJson<GenerateContentResponse>(
      this.fetchImpl,
      `${baseUrl}/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.options.apiKey },
        body: JSON.stringify(body),
      },
      { ...LABELS, redact: [this.options.apiKey] },
    );

    if (data.promptFeedback?.blockReason) throw new UpstreamError("Gemini từ chối đọc đoạn tin này");
    const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!inline?.data) throw new UpstreamError("Gemini không trả về âm thanh");
    const mimeType = inline.mimeType ?? "";
    // Gemini trả PCM 16-bit little-endian mono ("audio/L16;codec=pcm;rate=24000"); định dạng khác thì không bọc WAV bừa.
    if (mimeType && !/audio\/l16|pcm/i.test(mimeType)) throw new UpstreamError(`Gemini trả về định dạng âm thanh lạ (${mimeType})`);
    const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1]); // NaN nếu không có rate= → dùng mặc định
    const sampleRate = Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_SAMPLE_RATE;
    const raw = Buffer.from(inline.data, "base64");
    const pcm = raw.subarray(0, raw.length & ~1); // bỏ byte lẻ cuối nếu có
    return { audio: pcm16ToWav(pcm, sampleRate), mimeType: "audio/wav" };
  }
}
