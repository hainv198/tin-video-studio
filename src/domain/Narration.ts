import { ValidationError } from "./errors";
import type { Scene } from "./Scene";
import { VoiceSettings, type VoiceSnapshot } from "./VoiceSettings";

export interface NarrationProps {
  sceneId: string;
  text: string;
  audio: Uint8Array;
  mimeType: string;
  durationSec: number;
  voice: VoiceSettings;
}

export interface NarrationSnapshot {
  sceneId: string;
  text: string;
  audio: Uint8Array;
  mimeType: string;
  durationSec: number;
  voice: VoiceSnapshot;
}

export class Narration {
  private constructor(
    readonly sceneId: string,
    readonly text: string,
    readonly audio: Uint8Array,
    readonly mimeType: string,
    readonly durationSec: number,
    readonly voice: VoiceSettings,
  ) {}

  static create(p: NarrationProps): Narration {
    if (!p.sceneId) throw new ValidationError("Giọng đọc thiếu id cảnh");
    if (p.audio.byteLength === 0) throw new ValidationError("Giọng đọc rỗng");
    if (!p.mimeType.startsWith("audio/")) throw new ValidationError("Định dạng giọng đọc không hợp lệ");
    if (!Number.isFinite(p.durationSec) || p.durationSec <= 0) {
      throw new ValidationError("Độ dài giọng đọc phải lớn hơn 0");
    }
    return new Narration(p.sceneId, p.text, p.audio, p.mimeType, p.durationSec, p.voice);
  }

  isStaleFor(scene: Scene, voice: VoiceSettings): boolean {
    return scene.id !== this.sceneId || scene.text !== this.text || !voice.equals(this.voice);
  }

  snapshot(): NarrationSnapshot {
    return {
      sceneId: this.sceneId,
      text: this.text,
      audio: this.audio.slice(),
      mimeType: this.mimeType,
      durationSec: this.durationSec,
      voice: this.voice.snapshot(),
    };
  }

  static restore(s: NarrationSnapshot): Narration {
    const raw = s as unknown as Record<string, unknown> | null;
    if (typeof raw !== "object" || raw === null) throw new ValidationError("Bản nháp hỏng: dữ liệu giọng đọc không hợp lệ");
    if (typeof raw.sceneId !== "string" || typeof raw.text !== "string") {
      throw new ValidationError("Bản nháp hỏng: giọng đọc thiếu id cảnh hoặc lời");
    }
    if (!(raw.audio instanceof Uint8Array)) throw new ValidationError("Bản nháp hỏng: âm thanh giọng đọc không hợp lệ");
    if (typeof raw.mimeType !== "string" || typeof raw.durationSec !== "number") {
      throw new ValidationError("Bản nháp hỏng: thông tin giọng đọc không hợp lệ");
    }
    return Narration.create({
      sceneId: raw.sceneId,
      text: raw.text,
      audio: raw.audio.slice(),
      mimeType: raw.mimeType,
      durationSec: raw.durationSec,
      voice: VoiceSettings.restore(raw.voice as VoiceSnapshot),
    });
  }
}
