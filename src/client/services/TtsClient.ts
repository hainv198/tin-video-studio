import { ApiError } from "./AuthClient";

export interface VoiceInfo {
  name: string;
  gender: string;
  tier: string;
}

export interface TtsApi {
  voices(): Promise<VoiceInfo[]>;
  synthesize(text: string, voiceName: string, speakingRate: number): Promise<ArrayBuffer>;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  return new ApiError(response.status, body?.error?.code ?? "INTERNAL", body?.error?.message ?? "Lỗi máy chủ");
}

export class TtsClient implements TtsApi {
  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async voices(): Promise<VoiceInfo[]> {
    const response = await this.fetchImpl("/api/tts/voices");
    if (!response.ok) throw await toApiError(response);
    return ((await response.json()) as { voices: VoiceInfo[] }).voices;
  }

  async synthesize(text: string, voiceName: string, speakingRate: number): Promise<ArrayBuffer> {
    const response = await this.fetchImpl("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceName, speakingRate }),
    });
    if (!response.ok) throw await toApiError(response);
    return response.arrayBuffer();
  }
}
