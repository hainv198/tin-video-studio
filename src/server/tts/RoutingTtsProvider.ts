import { ValidationError } from "@/domain/errors";
import type { SynthesisRequest, SynthesisResult, TtsProvider, TtsVoice, TtsVoiceList } from "./TtsProvider";

export interface RoutedTtsProvider extends TtsProvider {
  owns(voiceName: string): boolean;
}

/** Gắn quy tắc nhận tên giọng cho một nhà cung cấp chưa có `owns`. */
export function routed(provider: TtsProvider, owns: (voiceName: string) => boolean): RoutedTtsProvider {
  return {
    owns,
    listVoices: (languageCode) => provider.listVoices(languageCode),
    synthesize: (request) => provider.synthesize(request),
  };
}

export class RoutingTtsProvider implements TtsProvider {
  constructor(private readonly providers: readonly RoutedTtsProvider[]) {
    if (providers.length === 0) throw new Error("Chưa cấu hình nhà cung cấp giọng nào");
  }

  async listVoices(languageCode: string): Promise<TtsVoiceList> {
    const settled = await Promise.allSettled(this.providers.map((p) => p.listVoices(languageCode)));
    const voices: TtsVoice[] = [];
    let lastError: unknown;
    let anyOk = false;
    let failed = false;
    for (const result of settled) {
      if (result.status === "fulfilled") {
        anyOk = true;
        voices.push(...result.value);
      } else {
        failed = true;
        lastError = result.reason;
        console.error(result.reason);
      }
    }
    if (!anyOk) throw lastError;
    return failed ? Object.assign(voices, { partial: true }) : voices;
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const provider = this.providers.find((p) => p.owns(request.voiceName));
    if (!provider) throw new ValidationError(`Không có giọng ${request.voiceName}`);
    return provider.synthesize(request);
  }
}
