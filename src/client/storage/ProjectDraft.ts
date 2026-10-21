import { FootageBoard, type FootageBoardSnapshot } from "@/domain/FootageBoard";
import { ValidationError } from "@/domain/errors";
import type { IdGenerator } from "@/domain/ids";
import { MusicTrack, type MusicTrackSnapshot } from "@/domain/MusicTrack";
import { Narration, type NarrationSnapshot } from "@/domain/Narration";
import { NewsProject, type NewsProjectSnapshot } from "@/domain/NewsProject";
import { SourceClip, type SourceClipSnapshot } from "@/domain/SourceClip";
import { VideoOptions, type VideoOptionsSnapshot } from "@/domain/VideoOptions";
import { VoiceSettings, type VoiceSnapshot } from "@/domain/VoiceSettings";

/**
 * v2 thêm `options` (tuỳ chọn video). v3 thêm `project.kind` và `sourceClip` (kiểu Video tải lên).
 * v1/v2 vẫn đọc được: thiếu `options` dùng mặc định, thiếu `kind` = "news", thiếu `sourceClip` = null.
 */
export const DRAFT_VERSION = 3;
export type DraftVersion = 1 | 2 | 3;
export const READABLE_DRAFT_VERSIONS: readonly DraftVersion[] = [1, 2, 3];

export interface DraftParts {
  project: NewsProject;
  voice: VoiceSettings | null;
  narrations: readonly Narration[];
  footage: FootageBoard;
  music: MusicTrack | null;
  /** Bỏ trống khi ghi = tuỳ chọn mặc định. */
  options?: VideoOptions;
  /** Chỉ dự án kiểu "upload" mới có. */
  sourceClip?: SourceClip | null;
}

export interface RestoredDraft extends DraftParts {
  options: VideoOptions;
  sourceClip: SourceClip | null;
}

export interface DraftBody {
  project: NewsProjectSnapshot;
  voice: VoiceSnapshot | null;
  narrations: NarrationSnapshot[];
  footage: FootageBoardSnapshot;
  music: MusicTrackSnapshot | null;
  /** Không có ở bản nháp v1. */
  options?: VideoOptionsSnapshot;
  /** Không có ở bản nháp v1/v2 và ở dự án kiểu tin. */
  sourceClip?: SourceClipSnapshot | null;
}

export interface ProjectDraft extends DraftBody {
  version: DraftVersion;
  savedAt: string;
}

export function buildDraftBody(parts: DraftParts): DraftBody {
  return {
    project: parts.project.snapshot(),
    voice: parts.voice?.snapshot() ?? null,
    narrations: parts.narrations.map((n) => n.snapshot()),
    footage: parts.footage.snapshot(),
    music: parts.music?.snapshot() ?? null,
    options: (parts.options ?? VideoOptions.defaults()).snapshot(),
    // Dự án tin giữ đúng hình dạng bản nháp cũ (không có khoá sourceClip).
    ...(parts.sourceClip ? { sourceClip: parts.sourceClip.snapshot() } : {}),
  };
}

/** Dựng lại các đối tượng domain; mọi phần hỏng ném ValidationError (riêng tuỳ chọn video thì khoan dung). */
export function restoreDraft(draft: DraftBody, nextId: IdGenerator): RestoredDraft {
  const isObject = (v: unknown) => typeof v === "object" && v !== null;
  if (!Array.isArray(draft.narrations)) throw new ValidationError("Bản nháp hỏng: thiếu danh sách giọng đọc");
  if (!isObject(draft.footage)) throw new ValidationError("Bản nháp hỏng: dữ liệu bảng cảnh trám không hợp lệ");
  if (draft.voice != null && !isObject(draft.voice)) throw new ValidationError("Bản nháp hỏng: dữ liệu giọng đọc không hợp lệ");
  if (draft.music != null && !isObject(draft.music)) throw new ValidationError("Bản nháp hỏng: dữ liệu nhạc nền không hợp lệ");
  const project = NewsProject.restore(draft.project, nextId);
  const rawClip: unknown = draft.sourceClip;
  if (project.kind === "upload" && rawClip != null && !isObject(rawClip)) {
    throw new ValidationError("Bản nháp hỏng: dữ liệu video tải lên không hợp lệ");
  }
  return {
    project,
    voice: draft.voice ? VoiceSettings.restore(draft.voice) : null,
    narrations: draft.narrations.map((n) => Narration.restore(n)),
    footage: FootageBoard.restore(draft.footage),
    music: draft.music ? MusicTrack.restore(draft.music) : null,
    options: VideoOptions.restore(draft.options),
    sourceClip: project.kind === "upload" && rawClip != null ? SourceClip.restore(rawClip as SourceClipSnapshot) : null,
  };
}
