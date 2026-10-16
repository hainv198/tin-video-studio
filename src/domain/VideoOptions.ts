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
}

interface Fields {
  subtitlesEnabled: boolean;
  subtitleFontId: FontId;
  textFontId: FontId;
  introBackgroundColor: string | null;
  introBlockColor: string | null;
  footageKind: FootageKindPreference;
  sceneKinds: ReadonlyMap<string, SceneFootageKind>;
}

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
    };
  }

  /** Khoan dung: dữ liệu thiếu hoặc sai ở trường nào thì trường đó dùng mặc định (bản nháp cũ không có tuỳ chọn). */
  static restore(raw: unknown): VideoOptions {
    if (!isRecord(raw)) return VideoOptions.defaults();
    const subtitles = isRecord(raw.subtitles) ? raw.subtitles : {};
    const intro = isRecord(raw.intro) ? raw.intro : {};
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
    });
  }

  private with(change: Partial<Fields>): VideoOptions {
    return new VideoOptions({ ...this.f, ...change });
  }
}
