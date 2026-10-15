import { z } from "zod";
import { PayloadTooLargeError, ValidationError } from "@/domain/errors";
import { VoiceSettings } from "@/domain/VoiceSettings";
import type { SynthesisResult, TtsProvider, TtsVoice } from "./TtsProvider";

const SynthesisSchema = z.object({
  text: z.string(),
  voiceName: z.string().regex(/^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9-]+$/),
  speakingRate: z.number().min(VoiceSettings.MIN_RATE).max(VoiceSettings.MAX_RATE),
});

export class TtsController {
  static readonly MAX_CHARS = 5000;
  static readonly LANGUAGE = "vi-VN";
  private static readonly VOICE_CACHE_MS = 86_400_000;

  private voiceCache?: { at: number; voices: TtsVoice[] };

  constructor(
    private readonly provider: TtsProvider,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async voices(): Promise<TtsVoice[]> {
    const cache = this.voiceCache;
    if (cache && this.now() - cache.at < TtsController.VOICE_CACHE_MS) return cache.voices;
    const voices = await this.provider.listVoices(TtsController.LANGUAGE);
    this.voiceCache = { at: this.now(), voices };
    return voices;
  }

  async synthesize(input: unknown): Promise<SynthesisResult> {
    const parsed = SynthesisSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Yêu cầu tạo giọng không hợp lệ");
    const text = parsed.data.text.trim();
    if (!text) throw new ValidationError("Câu cần đọc đang trống");
    if (text.length > TtsController.MAX_CHARS) {
      throw new PayloadTooLargeError(`Mỗi lần tạo giọng tối đa ${TtsController.MAX_CHARS} ký tự`);
    }
    return this.provider.synthesize({ ...parsed.data, text });
  }
}
