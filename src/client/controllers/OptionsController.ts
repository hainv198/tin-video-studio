import { ValidationError } from "@/domain/errors";
import { FONT_CHOICES } from "@/domain/fontIds";
import { canContinueFootage, pairedContinuations } from "@/domain/footageGroups";
import type { VideoOptions } from "@/domain/VideoOptions";
import { footageOwners } from "./readiness";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface OptionsPanelState {
  error: string | null;
}

export interface OptionsControllerDeps {
  session: StudioSession;
  onAuthLost?: () => void;
}

export interface IntroColors {
  backgroundColor: string;
  blockColor: string;
  /** true khi có ít nhất một màu đặt riêng (nút "Về mặc định" bật). */
  custom: boolean;
}

/** Màu chủ đạo mặc định của phong cách Theanh28, dùng khi bộ thương hiệu chưa nạp. */
const FALLBACK_PRIMARY = "#1f9d55";

/** Thanh "Tuỳ chọn video": ghi tuỳ chọn riêng của video vào session (session tự lưu bản nháp). */
export class OptionsController extends StateController<OptionsPanelState> {
  readonly fontChoices = FONT_CHOICES;

  constructor(private readonly deps: OptionsControllerDeps) {
    super({ error: null }, deps.onAuthLost);
  }

  setSubtitlesEnabled(enabled: boolean): void {
    this.apply((o) => o.withSubtitlesEnabled(enabled));
  }

  setSubtitleFont(fontId: string): void {
    this.apply((o) => o.withSubtitleFont(fontId));
  }

  setTextFont(fontId: string): void {
    this.apply((o) => o.withTextFont(fontId));
  }

  setIntroBackground(color: string): void {
    this.apply((o) => o.withIntroBackground(color));
  }

  setIntroBlock(color: string): void {
    this.apply((o) => o.withIntroBlock(color));
  }

  resetIntroColors(): void {
    this.apply((o) => o.withoutIntroColors());
  }

  setFootageKind(kind: string): void {
    this.apply((o) => o.withFootageKind(kind));
  }

  setGapSec(sec: number): void {
    this.apply((o) => o.withGapSec(sec));
  }

  setLeadInSec(sec: number): void {
    this.apply((o) => o.withLeadInSec(sec));
  }

  /** Tốc độ tinh chỉnh sau khi tạo giọng (xử lý ở máy, không phải tạo lại giọng). */
  setTempo(tempo: number): void {
    this.apply((o) => o.withTempo(tempo));
  }

  /** Tông tinh chỉnh sau khi tạo giọng, theo nửa cung. */
  setPitch(semitones: number): void {
    this.apply((o) => o.withPitchSemitones(semitones));
  }

  resetVoiceTweak(): void {
    this.apply((o) => o.withoutVoiceTweak());
  }

  /** Tick/bỏ tick "Có cảnh trám riêng" của một đoạn; bỏ tick = dùng tiếp cảnh của đoạn trước. Mở đầu luôn có cảnh riêng. */
  setSceneContinued(sceneId: string, continued: boolean): void {
    this.apply((o) => {
      const scenes = this.deps.session.state.project?.scenes ?? [];
      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene) throw new ValidationError("Không tìm thấy đoạn này");
      if (continued && !canContinueFootage(scenes, sceneId)) throw new ValidationError("Đoạn mở đầu luôn có cảnh trám riêng");
      return o.withSceneContinued(sceneId, continued);
    });
  }

  /** Nút nhanh: mỗi 2 đoạn thân bài dùng chung một cảnh. */
  mergeScenesInPairs(): void {
    this.apply((o) => o.withContinuedScenes(pairedContinuations(this.deps.session.state.project?.scenes ?? [])));
  }

  /** Nút nhanh: mỗi đoạn một cảnh (như mặc định). */
  resetSceneGrouping(): void {
    this.apply((o) => o.withContinuedScenes([]));
  }

  /** Đoạn có cảnh riêng mà cảnh trám của nó đang được dùng cho `sceneId`. */
  footageOwnerOf(sceneId: string): string {
    return footageOwners(this.deps.session.state).get(sceneId) ?? sceneId;
  }

  /** Màu đang dùng của thumbnail đầu (chữ thường): màu đặt riêng, không có thì màu chủ đạo thương hiệu. */
  introColors(): IntroColors {
    const { options, brand } = this.deps.session.state;
    const primary = (brand.values.primaryColor ?? FALLBACK_PRIMARY).toLowerCase();
    return {
      backgroundColor: options.introBackgroundColor ?? primary,
      blockColor: options.introBlockColor ?? primary,
      custom: options.introBackgroundColor !== null || options.introBlockColor !== null,
    };
  }

  private apply(change: (options: VideoOptions) => VideoOptions): void {
    let next: VideoOptions;
    try {
      next = change(this.deps.session.state.options);
    } catch (error) {
      this.patch({ error: this.report(error) });
      return;
    }
    this.deps.session.update((d) => ({ ...d, options: next }));
    if (this.state.error !== null) this.patch({ error: null });
  }
}
