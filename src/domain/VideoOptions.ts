import { ValidationError } from "./errors";
import { DEFAULT_SUBTITLE_FONT_ID, DEFAULT_TEXT_FONT_ID, isFontId, type FontId } from "./fontIds";

export type FootageKindPreference = "any" | "image" | "video";
export type SceneFootageKind = "image" | "video";

export interface VideoOptionsSnapshot {
  subtitles: { enabled: boolean; fontId: FontId };
  textFontId: FontId;
  /** Màu riêng của thumbnail đầu (cảnh mở đầu); không có khoá = theo màu chủ đạo thương hiệu. */
  intro: { backgroundColor?: string; blockColor?: string };
  /** Ưu tiên khi tự điền cảnh trám. */
  footageKind: FootageKindPreference;
  /** Lựa chọn Ảnh/Video riêng của từng cảnh (theo id cảnh). */
  sceneFootageKinds: Record<string, SceneFootageKind>;
  /** Nhịp đọc: nghỉ giữa các câu và nghỉ đầu video (giây). */
  pacing: { gapSec: number; leadInSec: number };
  /** Tinh chỉnh giọng sau khi tạo (xử lý ở máy khi dựng, không làm giọng thành cũ): tốc độ giữ cao độ và tông theo nửa cung. */
  voiceTweak: { tempo: number; pitchSemitones: number };
}

interface Fields {
  subtitlesEnabled: boolean;
  subtitleFontId: FontId;
  textFontId: FontId;
  introBackgroundColor: string | null;
  introBlockColor: string | null;
  footageKind: FootageKindPreference;
  sceneKinds: ReadonlyMap<string, SceneFootageKind>;
  gapSec: number;
  leadInSec: number;
  tempo: number;
  pitchSemitones: number;
}

export const GAP_SEC_RANGE = { min: 0.1, max: 1, step: 0.05, default: 0.35 } as const;
export const LEAD_IN_SEC_RANGE = { min: 0.1, max: 1, step: 0.05, default: 0.3 } as const;
export const TEMPO_RANGE = { min: 0.8, max: 1.4, step: 0.01, default: 1 } as const;
export const PITCH_SEMITONES_RANGE = { min: -4, max: 4, step: 0.5, default: 0 } as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FOOTAGE_KINDS: readonly FootageKindPreference[] = ["any", "image", "video"];

const DEFAULTS: Fields = {
  subtitlesEnabled: true,
  subtitleFontId: DEFAULT_SUBTITLE_FONT_ID,
  textFontId: DEFAULT_TEXT_FONT_ID,
  introBackgroundColor: null,
  introBlockColor: null,
  footageKind: "any",
  sceneKinds: new Map(),
  gapSec: GAP_SEC_RANGE.default,
  leadInSec: LEAD_IN_SEC_RANGE.default,
  tempo: TEMPO_RANGE.default,
  pitchSemitones: PITCH_SEMITONES_RANGE.default,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFootageKind(v: unknown): v is FootageKindPreference {
  return FOOTAGE_KINDS.includes(v as FootageKindPreference);
}

function isSceneKind(v: unknown): v is SceneFootageKind {
  return v === "image" || v === "video";
}

function checkedFont(id: string): FontId {
  if (!isFontId(id)) throw new ValidationError("Font không có trong danh sách");
  return id;
}

function checkedColor(color: string | null): string | null {
  if (color === null) return null;
  if (!HEX_COLOR.test(color)) throw new ValidationError("Màu phải có dạng #RRGGBB");
  return color.toLowerCase();
}

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Làm tròn về bước 0,5 nửa cung; `+ 0` bỏ −0. */
const roundHalf = (n: number) => Math.round(n * 2) / 2 + 0;

function checkedSeconds(v: number, range: { min: number; max: number }, message: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < range.min - 1e-9 || v > range.max + 1e-9) {
    throw new ValidationError(message);
  }
  return round2(v);
}

function restoredSeconds(v: unknown, range: { min: number; max: number; default: number }): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return range.default;
  return round2(Math.min(range.max, Math.max(range.min, v)));
}

function restoredPitch(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return PITCH_SEMITONES_RANGE.default;
  return roundHalf(Math.min(PITCH_SEMITONES_RANGE.max, Math.max(PITCH_SEMITONES_RANGE.min, v)));
}

function restoredColor(v: unknown): string | null {
  return typeof v === "string" && HEX_COLOR.test(v) ? v.toLowerCase() : null;
}

/** Tuỳ chọn riêng của MỘT video (lưu trong bản nháp, không thuộc bộ thương hiệu). Bất biến. */
export class VideoOptions {
  private constructor(private readonly f: Fields) {}

  static defaults(): VideoOptions {
    return new VideoOptions(DEFAULTS);
  }

  get subtitlesEnabled(): boolean {
    return this.f.subtitlesEnabled;
  }

  get subtitleFontId(): FontId {
    return this.f.subtitleFontId;
  }

  get textFontId(): FontId {
    return this.f.textFontId;
  }

  get introBackgroundColor(): string | null {
    return this.f.introBackgroundColor;
  }

  get introBlockColor(): string | null {
    return this.f.introBlockColor;
  }

  get footageKind(): FootageKindPreference {
    return this.f.footageKind;
  }

  get gapSec(): number {
    return this.f.gapSec;
  }

  get leadInSec(): number {
    return this.f.leadInSec;
  }

  withGapSec(sec: number): VideoOptions {
    return this.with({
      gapSec: checkedSeconds(sec, GAP_SEC_RANGE, "Khoảng nghỉ giữa các câu phải từ 0,10 đến 1,00 giây"),
    });
  }

  withLeadInSec(sec: number): VideoOptions {
    return this.with({
      leadInSec: checkedSeconds(sec, LEAD_IN_SEC_RANGE, "Khoảng nghỉ đầu video phải từ 0,1 đến 1,0 giây"),
    });
  }

  /** Tốc độ và tông tinh chỉnh sau khi tạo giọng (không thuộc VoiceSettings nên không làm giọng thành cũ). */
  get voiceTweak(): { tempo: number; pitchSemitones: number } {
    return { tempo: this.f.tempo, pitchSemitones: this.f.pitchSemitones };
  }

  withTempo(tempo: number): VideoOptions {
    return this.with({ tempo: checkedSeconds(tempo, TEMPO_RANGE, "Tốc độ tinh chỉnh phải từ 0,80 đến 1,40") });
  }

  withPitchSemitones(semitones: number): VideoOptions {
    const r = PITCH_SEMITONES_RANGE;
    if (typeof semitones !== "number" || !Number.isFinite(semitones) || semitones < r.min || semitones > r.max) {
      throw new ValidationError("Tông giọng phải từ −4 đến +4 nửa cung");
    }
    return this.with({ pitchSemitones: roundHalf(semitones) });
  }

  withoutVoiceTweak(): VideoOptions {
    return this.with({ tempo: TEMPO_RANGE.default, pitchSemitones: PITCH_SEMITONES_RANGE.default });
  }

  withSubtitlesEnabled(enabled: boolean): VideoOptions {
    return this.with({ subtitlesEnabled: enabled });
  }

  withSubtitleFont(fontId: string): VideoOptions {
    return this.with({ subtitleFontId: checkedFont(fontId) });
  }

  withTextFont(fontId: string): VideoOptions {
    return this.with({ textFontId: checkedFont(fontId) });
  }

  withIntroBackground(color: string | null): VideoOptions {
    return this.with({ introBackgroundColor: checkedColor(color) });
  }

  withIntroBlock(color: string | null): VideoOptions {
    return this.with({ introBlockColor: checkedColor(color) });
  }

  withoutIntroColors(): VideoOptions {
    return this.with({ introBackgroundColor: null, introBlockColor: null });
  }

  withFootageKind(kind: string): VideoOptions {
    if (!isFootageKind(kind)) throw new ValidationError("Loại cảnh trám không hợp lệ");
    return this.with({ footageKind: kind });
  }

  withSceneFootageKind(sceneId: string, kind: SceneFootageKind | null): VideoOptions {
    if (!sceneId) throw new ValidationError("Cảnh thiếu id");
    if (kind !== null && !isSceneKind(kind)) throw new ValidationError("Loại cảnh trám không hợp lệ");
    const next = new Map(this.f.sceneKinds);
    if (kind === null) next.delete(sceneId);
    else next.set(sceneId, kind);
    return this.with({ sceneKinds: next });
  }

  sceneFootageKind(sceneId: string): SceneFootageKind | null {
    return this.f.sceneKinds.get(sceneId) ?? null;
  }

  /** Loại dùng khi tự điền cảnh: lựa chọn riêng của cảnh, không có thì ưu tiên chung. */
  footageKindFor(sceneId: string): FootageKindPreference {
    return this.sceneFootageKind(sceneId) ?? this.f.footageKind;
  }

  /** Bỏ lựa chọn của cảnh không còn trong dự án; không đổi gì thì trả chính nó. */
  keepScenes(sceneIds: ReadonlySet<string>): VideoOptions {
    if ([...this.f.sceneKinds.keys()].every((id) => sceneIds.has(id))) return this;
    return this.with({ sceneKinds: new Map([...this.f.sceneKinds].filter(([id]) => sceneIds.has(id))) });
  }

  snapshot(): VideoOptionsSnapshot {
    const intro: VideoOptionsSnapshot["intro"] = {};
    if (this.f.introBackgroundColor) intro.backgroundColor = this.f.introBackgroundColor;
    if (this.f.introBlockColor) intro.blockColor = this.f.introBlockColor;
    return {
      subtitles: { enabled: this.f.subtitlesEnabled, fontId: this.f.subtitleFontId },
      textFontId: this.f.textFontId,
      intro,
      footageKind: this.f.footageKind,
      sceneFootageKinds: Object.fromEntries(this.f.sceneKinds),
      pacing: { gapSec: this.f.gapSec, leadInSec: this.f.leadInSec },
      voiceTweak: this.voiceTweak,
    };
  }

  /** Khoan dung: dữ liệu thiếu hoặc sai ở trường nào thì trường đó dùng mặc định (bản nháp cũ không có tuỳ chọn). */
  static restore(raw: unknown): VideoOptions {
    if (!isRecord(raw)) return VideoOptions.defaults();
    const subtitles = isRecord(raw.subtitles) ? raw.subtitles : {};
    const intro = isRecord(raw.intro) ? raw.intro : {};
    const pacing = isRecord(raw.pacing) ? raw.pacing : {};
    const tweak = isRecord(raw.voiceTweak) ? raw.voiceTweak : {};
    const kinds = isRecord(raw.sceneFootageKinds) ? raw.sceneFootageKinds : {};
    const sceneKinds = new Map<string, SceneFootageKind>();
    for (const [sceneId, kind] of Object.entries(kinds)) if (sceneId && isSceneKind(kind)) sceneKinds.set(sceneId, kind);
    return new VideoOptions({
      subtitlesEnabled: typeof subtitles.enabled === "boolean" ? subtitles.enabled : DEFAULTS.subtitlesEnabled,
      subtitleFontId: isFontId(subtitles.fontId) ? subtitles.fontId : DEFAULTS.subtitleFontId,
      textFontId: isFontId(raw.textFontId) ? raw.textFontId : DEFAULTS.textFontId,
      introBackgroundColor: restoredColor(intro.backgroundColor),
      introBlockColor: restoredColor(intro.blockColor),
      footageKind: isFootageKind(raw.footageKind) ? raw.footageKind : DEFAULTS.footageKind,
      sceneKinds,
      gapSec: restoredSeconds(pacing.gapSec, GAP_SEC_RANGE),
      leadInSec: restoredSeconds(pacing.leadInSec, LEAD_IN_SEC_RANGE),
      tempo: restoredSeconds(tweak.tempo, TEMPO_RANGE),
      pitchSemitones: restoredPitch(tweak.pitchSemitones),
    });
  }

  private with(change: Partial<Fields>): VideoOptions {
    return new VideoOptions({ ...this.f, ...change });
  }
}
