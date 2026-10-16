import { isQuotaExhausted, isSessionExpired } from "@/client/errors/userMessage";
import { AudioDecodeService } from "@/client/media/AudioDecodeService";
import { applyVoiceTweak, encodeWav, isDefaultVoiceTweak } from "@/client/media/voiceTweak";
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
  /** Có chữ khi tool đã tự chuyển cả tin sang giọng Edge vì giọng chính hết lượt. */
  fallbackNotice: string | null;
}

export const FALLBACK_NOTICE = "Gemini đã hết lượt, đã chuyển cả tin sang giọng Edge (miễn phí, chỉ trên máy này)";
const EDGE_TIER = "Edge";

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
  fallbackNotice: null,
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
      this.patch({ fallbackNotice: null });
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
    await this.generateRun(true);
  }

  /** `allowFallback`: còn được tự chuyển sang giọng Edge một lần khi hết lượt. */
  private async generateRun(allowFallback: boolean): Promise<void> {
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
    let restart = false;
    try {
      let done = 0;
      for (const sceneId of todo) {
        if (this.cancelRequested) break;
        const outcome = await this.runScene(sceneId, epoch);
        if (outcome === "quota" && allowFallback && epoch === this.epoch && !this.cancelRequested && this.switchToEdge()) {
          restart = true;
          break;
        }
        done += 1;
        this.patch({ progress: { done, total: todo.length } });
        if (outcome === "stop") break;
      }
    } finally {
      this.patch(epoch === this.epoch ? { generating: false, progress: null } : { generating: false, progress: null, failed: {} });
    }
    // Đổi giọng nên mọi câu cũ đều thành cũ: đọc lại cả tin bằng giọng Edge (chỉ một lần).
    if (restart) await this.generateRun(false);
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
    this.patch({ error: null, failed: {}, progress: null, fallbackNotice: null });
  }

  async previewVoice(): Promise<Blob | null> {
    const { project, voice } = this.deps.session.state;
    if (!project || !voice) {
      this.patch({ error: voice ? "Chưa có dự án" : "Chưa chọn giọng" });
      return null;
    }
    this.patch({ previewing: true, error: null });
    try {
      const tweak = this.deps.session.state.options.voiceTweak;
      if (isDefaultVoiceTweak(tweak)) return await this.previewWith(project.introScene.text, voice, true);
      // Có tinh chỉnh: dùng giọng đã tạo của câu tiêu đề nếu còn mới (khỏi tốn lượt), không thì đọc thử; xử lý ở máy rồi phát WAV.
      const intro = project.introScene;
      const narration = this.deps.session.state.narrations.get(intro.id);
      const bytes =
        narration && !narration.isStaleFor(intro, voice)
          ? (narration.audio.slice().buffer as ArrayBuffer)
          : await (await this.previewWith(intro.text, voice, true)).arrayBuffer();
      const decoded = await this.deps.decoder.decode(bytes);
      const samples = applyVoiceTweak(AudioDecodeService.toMono(decoded.channels), decoded.sampleRate, tweak);
      return new Blob([encodeWav(samples, decoded.sampleRate)], { type: "audio/wav" });
    } catch (error) {
      this.patch({ error: this.report(error) });
      return null;
    } finally {
      this.patch({ previewing: false });
    }
  }

  private async previewWith(text: string, voice: VoiceSettings, allowFallback: boolean): Promise<Blob> {
    try {
      const bytes = await this.deps.tts.synthesize(text, voice.voiceName, voice.speakingRate);
      return new Blob([bytes], { type: "audio/mpeg" });
    } catch (error) {
      if (allowFallback && isQuotaExhausted(error) && this.switchToEdge()) {
        const next = this.deps.session.state.voice;
        if (next) return this.previewWith(text, next, false);
      }
      throw error;
    }
  }

  /**
   * Hết lượt giọng chính: đổi giọng của cả tin sang Edge (cùng giới tính nếu có, giữ tốc độ).
   * Trả false khi không đổi được (đang dùng Edge, giọng hiện tại không nằm trong danh sách, hoặc không có giọng Edge).
   */
  private switchToEdge(): boolean {
    const current = this.deps.session.state.voice;
    if (!current) return false;
    const info = this.state.voices.find((v) => v.name === current.voiceName);
    if (!info || info.tier === EDGE_TIER) return false;
    const edge = this.state.voices.filter((v) => v.tier === EDGE_TIER);
    const target = edge.find((v) => v.gender === info.gender) ?? edge[0];
    if (!target) return false;
    const voice = VoiceSettings.create(target.name, current.speakingRate);
    this.deps.session.update((d) => ({ ...d, voice }));
    this.patch({ fallbackNotice: FALLBACK_NOTICE, failed: {}, error: null });
    return true;
  }

  /** Tạo giọng một cảnh. "stop" nếu phải dừng cả lượt (hết phiên); "quota" nếu hết lượt giọng. */
  private async runScene(sceneId: string, epoch: number): Promise<"ok" | "stop" | "quota"> {
    const start = this.deps.session.state;
    const scene = start.project?.scenes.find((s) => s.id === sceneId);
    const voice = start.voice;
    if (!scene || !voice) return "ok";
    try {
      const bytes = await this.deps.tts.synthesize(scene.text, voice.voiceName, voice.speakingRate);
      // decode làm hỏng (detach) bộ đệm đầu vào nên đưa bản sao; bản gốc đem lưu.
      const decoded = await this.deps.decoder.decode(bytes.slice(0));
      if (this.cancelRequested || epoch !== this.epoch) return "ok";
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
      if (!currentScene || !now.voice || narration.isStaleFor(currentScene, now.voice)) return "ok";
      this.deps.session.update((d) => ({ ...d, narrations: new Map(d.narrations).set(sceneId, narration) }));
      const { [sceneId]: _removed, ...rest } = this.state.failed;
      this.patch({ failed: rest });
      return "ok";
    } catch (error) {
      if (epoch !== this.epoch) return "ok";
      this.patch({ failed: { ...this.state.failed, [sceneId]: this.report(error) } });
      if (isSessionExpired(error)) return "stop";
      return isQuotaExhausted(error) ? "quota" : "ok";
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
