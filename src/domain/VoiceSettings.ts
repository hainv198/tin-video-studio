import { ValidationError } from "./errors";

const VOICE_NAME = /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9-]+$/;

export class VoiceSettings {
  static readonly MIN_RATE = 0.8;
  static readonly MAX_RATE = 1.3;
  static readonly DEFAULT_RATE = 1.07;

  private constructor(
    readonly voiceName: string,
    readonly speakingRate: number,
  ) {}

  static create(voiceName: string, speakingRate: number = VoiceSettings.DEFAULT_RATE): VoiceSettings {
    if (!VOICE_NAME.test(voiceName)) throw new ValidationError(`Tên giọng không hợp lệ: ${voiceName}`);
    if (!Number.isFinite(speakingRate)) throw new ValidationError("Tốc độ đọc không hợp lệ");
    const rate = Math.round(speakingRate * 100) / 100;
    if (rate < VoiceSettings.MIN_RATE || rate > VoiceSettings.MAX_RATE) {
      throw new ValidationError(`Tốc độ đọc phải từ ${VoiceSettings.MIN_RATE} đến ${VoiceSettings.MAX_RATE}`);
    }
    return new VoiceSettings(voiceName, rate);
  }

  withRate(rate: number): VoiceSettings {
    return VoiceSettings.create(this.voiceName, rate);
  }

  equals(other: VoiceSettings): boolean {
    return this.voiceName === other.voiceName && this.speakingRate === other.speakingRate;
  }
}
