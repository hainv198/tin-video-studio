import { assertSameSession, readApiError, readJson } from "./apiError";

export interface VoiceInfo {
  name: string;
  gender: string;
  tier: string;
}

export interface TtsApi {
  voices(): Promise<VoiceInfo[]>;
  synthesize(text: string, voiceName: string, speakingRate: number): Promise<ArrayBuffer>;
}

export class TtsClient implements TtsApi {
  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async voices(): Promise<VoiceInfo[]> {
    const response = await this.fetchImpl("/api/tts/voices");
    if (!response.ok) throw await readApiError(response);
    return (await readJson<{ voices: VoiceInfo[] }>(response)).voices;
  }

  async synthesize(text: string, voiceName: string, speakingRate: number): Promise<ArrayBuffer> {
    const response = await this.fetchImpl("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceName, speakingRate }),
    });
    if (!response.ok) throw await readApiError(response);
    assertSameSession(response);
    return response.arrayBuffer();
  }
}
