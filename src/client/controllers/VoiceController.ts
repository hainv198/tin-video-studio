import { isSessionExpired } from "@/client/errors/userMessage";
import type { AudioDecodeService } from "@/client/media/AudioDecodeService";
import type { TtsApi, VoiceInfo } from "@/client/services/TtsClient";
import { ValidationError } from "@/domain/errors";
import { Narration } from "@/domain/Narration";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { staleSceneIds } from "./readiness";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface VoiceState {
  voices: VoiceInfo[];
  voicesLoading: boolean;
  error: string | null;
  generating: boolean;
  progress: { done: number; total: number } | null;
  failed: Record<string, string>;
  previewing: boolean;
}

export interface VoiceControllerDeps {
  session: StudioSession;
  tts: TtsApi;
  decoder: Pick<AudioDecodeService, "decode">;
  onAuthLost?: () => void;
}

const INITIAL: VoiceState = {
  voices: [],
  voicesLoading: false,
  error: null,
  generating: false,
  progress: null,
  failed: {},
  previewing: false,
};

/** Bước 2: chọn giọng, tốc độ, tạo giọng riêng cho từng câu. */
export class VoiceController extends StateController<VoiceState> {
  private cancelRequested = false;
  /** Tăng mỗi lần reset: kết quả của lượt đọc bắt đầu ở dự án cũ bị bỏ. */
  private epoch = 0;

  constructor(private readonly deps: VoiceControllerDeps) {
    super(INITIAL, deps.onAuthLost);
  }

  async loadVoices(): Promise<void> {
    this.patch({ voicesLoading: true, error: null });
    try {
      const voices = await this.deps.tts.voices();
      this.patch({ voices, voicesLoading: false });
      const first = voices[0];
      if (first && !this.deps.session.state.voice) {
        this.deps.session.update((d) => ({ ...d, voice: VoiceSettings.create(first.name) }));
      }
    } catch (error) {
      this.patch({ voicesLoading: false, error: this.report(error) });
    }
  }

  selectVoice(name: string): void {
    this.attempt(() => {
      const rate = this.deps.session.state.voice?.speakingRate ?? VoiceSettings.DEFAULT_RATE;
      const voice = VoiceSettings.create(name, rate);
      this.deps.session.update((d) => ({ ...d, voice }));
    });
  }

  setRate(rate: number): void {
    this.attempt(() => {
      const current = this.deps.session.state.voice;
      if (!current) throw new ValidationError("Chưa chọn giọng");
      const voice = current.withRate(rate);
      this.deps.session.update((d) => ({ ...d, voice }));
    });
  }

  async generate(): Promise<void> {
    if (this.state.generating) return;
    const { project, voice } = this.deps.session.state;
    if (!project) {
      this.patch({ error: "Chưa có dự án" });
      return;
    }
    if (!voice) {
      this.patch({ error: "Chưa chọn giọng" });
      return;
    }
    const todo = staleSceneIds(this.deps.session.state);
    this.cancelRequested = false;
    const epoch = this.epoch;
    this.patch({ generating: true, error: null, failed: {}, progress: { done: 0, total: todo.length } });
    try {
      let done = 0;
      for (const sceneId of todo) {
        if (this.cancelRequested) break;
        const stop = await this.runScene(sceneId, epoch);
        done += 1;
        this.patch({ progress: { done, total: todo.length } });
        if (stop) break;
      }
    } finally {
      this.patch(epoch === this.epoch ? { generating: false, progress: null } : { generating: false, progress: null, failed: {} });
    }
  }

  async retry(sceneId: string): Promise<void> {
    if (this.state.generating) return;
    this.cancelRequested = false;
    const epoch = this.epoch;
    this.patch({ generating: true, error: null });
    try {
      await this.runScene(sceneId, epoch);
    } finally {
      this.patch(epoch === this.epoch ? { generating: false } : { generating: false, failed: {} });
    }
  }

  cancel(): void {
    this.cancelRequested = true;
  }

  /** Dự án mới: dừng lượt đang chạy và bỏ lỗi, tiến độ của dự án cũ. */
  reset(): void {
    this.epoch += 1;
    this.cancel();
    this.patch({ error: null, failed: {}, progress: null });
  }

  async previewVoice(): Promise<Blob | null> {
    const { project, voice } = this.deps.session.state;
    if (!project || !voice) {
      this.patch({ error: voice ? "Chưa có dự án" : "Chưa chọn giọng" });
      return null;
    }
    this.patch({ previewing: true, error: null });
    try {
      const bytes = await this.deps.tts.synthesize(project.introScene.text, voice.voiceName, voice.speakingRate);
      return new Blob([bytes], { type: "audio/mpeg" });
    } catch (error) {
      this.patch({ error: this.report(error) });
      return null;
    } finally {
      this.patch({ previewing: false });
    }
  }

  /** Tạo giọng một cảnh. Trả true nếu phải dừng cả lượt (hết phiên). */
  private async runScene(sceneId: string, epoch: number): Promise<boolean> {
    const start = this.deps.session.state;
    const scene = start.project?.scenes.find((s) => s.id === sceneId);
    const voice = start.voice;
    if (!scene || !voice) return false;
    try {
      const bytes = await this.deps.tts.synthesize(scene.text, voice.voiceName, voice.speakingRate);
      // decode làm hỏng (detach) bộ đệm đầu vào nên đưa bản sao; bản gốc đem lưu.
      const decoded = await this.deps.decoder.decode(bytes.slice(0));
      if (this.cancelRequested || epoch !== this.epoch) return false;
      const narration = Narration.create({
        sceneId,
        text: scene.text,
        audio: new Uint8Array(bytes),
        mimeType: "audio/mpeg",
        durationSec: decoded.durationSec,
        voice,
      });
      const now = this.deps.session.state;
      const currentScene = now.project?.scenes.find((s) => s.id === sceneId);
      if (!currentScene || !now.voice || narration.isStaleFor(currentScene, now.voice)) return false;
      this.deps.session.update((d) => ({ ...d, narrations: new Map(d.narrations).set(sceneId, narration) }));
      const { [sceneId]: _removed, ...rest } = this.state.failed;
      this.patch({ failed: rest });
      return false;
    } catch (error) {
      if (epoch !== this.epoch) return false;
      this.patch({ failed: { ...this.state.failed, [sceneId]: this.report(error) } });
      return isSessionExpired(error);
    }
  }

  private attempt(action: () => void): void {
    try {
      action();
      this.patch({ error: null });
    } catch (error) {
      this.patch({ error: this.report(error) });
    }
  }
}
