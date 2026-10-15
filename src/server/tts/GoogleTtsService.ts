import { UpstreamError } from "@/domain/errors";
import { fetchJson } from "@/server/http/upstream";
import type { SynthesisRequest, SynthesisResult, TtsProvider, TtsVoice, VoiceGender } from "./TtsProvider";

const BASE = "https://texttospeech.googleapis.com/v1";
const LABELS = { service: "Google TTS", quotaMessage: "Hết hạn mức giọng đọc hôm nay, liên hệ Hải" };
const TIER_ORDER = ["Chirp3-HD", "Neural2", "Wavenet", "Standard"];

interface GoogleVoice {
  name: string;
  ssmlGender?: string;
  languageCodes?: string[];
}

export function tierOf(voiceName: string): string {
  const parts = voiceName.split("-").slice(2, -1);
  return parts.length > 0 ? parts.join("-") : "Standard";
}

function genderOf(raw: string | undefined): VoiceGender {
  return raw === "MALE" || raw === "FEMALE" ? raw : "NEUTRAL";
}

function tierRank(tier: string): number {
  const i = TIER_ORDER.indexOf(tier);
  return i < 0 ? TIER_ORDER.length : i;
}

export class GoogleTtsService implements TtsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("GOOGLE_TTS_API_KEY chưa được cấu hình");
  }

  async listVoices(languageCode: string): Promise<TtsVoice[]> {
    const url = `${BASE}/voices?languageCode=${encodeURIComponent(languageCode)}&key=${encodeURIComponent(this.apiKey)}`;
    const data = await fetchJson<{ voices?: GoogleVoice[] }>(this.fetchImpl, url, { method: "GET" }, LABELS);
    return (data.voices ?? [])
      .filter((v) => v.languageCodes?.includes(languageCode))
      .map((v) => ({ name: v.name, gender: genderOf(v.ssmlGender), tier: tierOf(v.name) }))
      .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name));
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const languageCode = request.voiceName.split("-").slice(0, 2).join("-");
    const body = {
      input: { text: request.text },
      voice: { languageCode, name: request.voiceName },
      audioConfig: { audioEncoding: "MP3", speakingRate: request.speakingRate, sampleRateHertz: 48000 },
    };
    const data = await fetchJson<{ audioContent?: string }>(
      this.fetchImpl,
      `${BASE}/text:synthesize?key=${encodeURIComponent(this.apiKey)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      LABELS,
    );
    if (!data.audioContent) throw new UpstreamError("Google TTS không trả về âm thanh");
    return { audio: Uint8Array.from(Buffer.from(data.audioContent, "base64")), mimeType: "audio/mpeg" };
  }
}
