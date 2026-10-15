import { ValidationError } from "./errors";
import type { Scene } from "./Scene";
import type { VoiceSettings } from "./VoiceSettings";

export interface NarrationProps {
  sceneId: string;
  text: string;
  audio: Uint8Array;
  mimeType: string;
  durationSec: number;
  voice: VoiceSettings;
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
}
