export type VoiceGender = "MALE" | "FEMALE" | "NEUTRAL";

export interface TtsVoice {
  name: string;
  gender: VoiceGender;
  tier: string;
}

/** Danh sách giọng; `partial` = true khi một nguồn lỗi nên danh sách bị thiếu (không được cache). */
export type TtsVoiceList = TtsVoice[] & { partial?: boolean };

export interface SynthesisRequest {
  text: string;
  voiceName: string;
  speakingRate: number;
}

export interface SynthesisResult {
  audio: Uint8Array<ArrayBuffer>;
  mimeType: string;
}

export interface TtsProvider {
  listVoices(languageCode: string): Promise<TtsVoiceList>;
  synthesize(request: SynthesisRequest): Promise<SynthesisResult>;
}
