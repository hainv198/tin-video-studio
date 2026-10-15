export type VoiceGender = "MALE" | "FEMALE" | "NEUTRAL";

export interface TtsVoice {
  name: string;
  gender: VoiceGender;
  tier: string;
}

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
  listVoices(languageCode: string): Promise<TtsVoice[]>;
  synthesize(request: SynthesisRequest): Promise<SynthesisResult>;
}
