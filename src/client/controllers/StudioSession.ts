import type { DraftRepository } from "@/client/storage/DraftRepository";
import { buildDraftBody, restoreDraft, type DraftBody } from "@/client/storage/ProjectDraft";
import { FootageBoard } from "@/domain/FootageBoard";
import type { IdGenerator } from "@/domain/ids";
import type { MusicTrack } from "@/domain/MusicTrack";
import type { Narration } from "@/domain/Narration";
import type { NewsProject } from "@/domain/NewsProject";
import type { VoiceSettings } from "@/domain/VoiceSettings";

export interface BrandData {
  values: Record<string, string>;
  logo: Blob | null;
}

export interface StudioData {
  project: NewsProject | null;
  voice: VoiceSettings | null;
  narrations: ReadonlyMap<string, Narration>;
  footage: FootageBoard;
  music: MusicTrack | null;
  brand: BrandData;
}

export const EMPTY_STUDIO: StudioData = {
  project: null,
  voice: null,
  narrations: new Map(),
  footage: FootageBoard.empty(),
  music: null,
  brand: { values: {}, logo: null },
};

export interface SessionDeps {
  drafts: Pick<DraftRepository, "save" | "load" | "clear">;
  ids: IdGenerator;
  /** Hẹn chạy `fn` sau `ms`; trả hàm huỷ hẹn. */
  schedule: (fn: () => void, ms: number) => () => void;
  autosaveMs?: number;
  onSaveError?: (error: unknown) => void;
}

/** Bỏ giọng và cảnh trám của cảnh không còn trong dự án. */
function prune(data: StudioData): StudioData {
  if (!data.project) return data;
  const ids = new Set(data.project.scenes.map((s) => s.id));
  let narrations = data.narrations;
  if ([...narrations.keys()].some((id) => !ids.has(id))) {
    narrations = new Map([...narrations].filter(([id]) => ids.has(id)));
  }
  let footage = data.footage;
  for (const id of footage.sceneIds()) if (!ids.has(id)) footage = footage.unassign(id);
  return narrations === data.narrations && footage === data.footage ? data : { ...data, narrations, footage };
}

/** Dữ liệu đang làm việc của trình 5 bước; tự lưu bản nháp sau mỗi thay đổi (có trễ). */
export class StudioSession {
  private current: StudioData = EMPTY_STUDIO;
  private readonly listeners = new Set<() => void>();
  private cancelSave: (() => void) | null = null;

  constructor(private readonly deps: SessionDeps) {}

  get state(): StudioData {
    return this.current;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  update(change: (data: StudioData) => StudioData): void {
    this.current = prune(change(this.current));
    this.notify();
    this.scheduleSave();
  }

  /** Bộ thương hiệu lưu ở BrandRepository, không vào bản nháp. */
  setBrand(brand: BrandData): void {
    this.current = { ...this.current, brand };
    this.notify();
  }

  restore(draft: DraftBody): void {
    const parts = restoreDraft(draft, this.deps.ids);
    this.current = prune({
      ...this.current,
      project: parts.project,
      voice: parts.voice,
      narrations: new Map(parts.narrations.map((n) => [n.sceneId, n])),
      footage: parts.footage,
      music: parts.music,
    });
    this.notify();
  }

  reset(): void {
    this.cancelPendingSave();
    this.current = { ...EMPTY_STUDIO, brand: this.current.brand };
    this.notify();
  }

  async flush(): Promise<void> {
    this.cancelPendingSave();
    await this.save();
  }

  private scheduleSave(): void {
    if (!this.current.project) return;
    this.cancelPendingSave();
    this.cancelSave = this.deps.schedule(() => {
      this.cancelSave = null;
      void this.save();
    }, this.deps.autosaveMs ?? 800);
  }

  private cancelPendingSave(): void {
    this.cancelSave?.();
    this.cancelSave = null;
  }

  private async save(): Promise<void> {
    const { project, voice, narrations, footage, music } = this.current;
    if (!project) return;
    try {
      await this.deps.drafts.save(buildDraftBody({ project, voice, narrations: [...narrations.values()], footage, music }));
    } catch (error) {
      this.deps.onSaveError?.(error);
    }
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
