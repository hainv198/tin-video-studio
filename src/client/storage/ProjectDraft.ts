import { FootageBoard, type FootageBoardSnapshot } from "@/domain/FootageBoard";
import { ValidationError } from "@/domain/errors";
import type { IdGenerator } from "@/domain/ids";
import { MusicTrack, type MusicTrackSnapshot } from "@/domain/MusicTrack";
import { Narration, type NarrationSnapshot } from "@/domain/Narration";
import { NewsProject, type NewsProjectSnapshot } from "@/domain/NewsProject";
import { VoiceSettings, type VoiceSnapshot } from "@/domain/VoiceSettings";

export const DRAFT_VERSION = 1;

export interface DraftParts {
  project: NewsProject;
  voice: VoiceSettings | null;
  narrations: readonly Narration[];
  footage: FootageBoard;
  music: MusicTrack | null;
}

export interface DraftBody {
  project: NewsProjectSnapshot;
  voice: VoiceSnapshot | null;
  narrations: NarrationSnapshot[];
  footage: FootageBoardSnapshot;
  music: MusicTrackSnapshot | null;
}

export interface ProjectDraft extends DraftBody {
  version: typeof DRAFT_VERSION;
  savedAt: string;
}

export function buildDraftBody(parts: DraftParts): DraftBody {
  return {
    project: parts.project.snapshot(),
    voice: parts.voice?.snapshot() ?? null,
    narrations: parts.narrations.map((n) => n.snapshot()),
    footage: parts.footage.snapshot(),
    music: parts.music?.snapshot() ?? null,
  };
}

/** Dựng lại các đối tượng domain; mọi phần hỏng ném ValidationError. */
export function restoreDraft(draft: DraftBody, nextId: IdGenerator): DraftParts {
  const isObject = (v: unknown) => typeof v === "object" && v !== null;
  if (!Array.isArray(draft.narrations)) throw new ValidationError("Bản nháp hỏng: thiếu danh sách giọng đọc");
  if (!isObject(draft.footage)) throw new ValidationError("Bản nháp hỏng: dữ liệu bảng cảnh trám không hợp lệ");
  if (draft.voice != null && !isObject(draft.voice)) throw new ValidationError("Bản nháp hỏng: dữ liệu giọng đọc không hợp lệ");
  if (draft.music != null && !isObject(draft.music)) throw new ValidationError("Bản nháp hỏng: dữ liệu nhạc nền không hợp lệ");
  return {
    project: NewsProject.restore(draft.project, nextId),
    voice: draft.voice ? VoiceSettings.restore(draft.voice) : null,
    narrations: draft.narrations.map((n) => Narration.restore(n)),
    footage: FootageBoard.restore(draft.footage),
    music: draft.music ? MusicTrack.restore(draft.music) : null,
  };
}
