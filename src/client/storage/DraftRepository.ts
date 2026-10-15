import type { KeyValueStore } from "./KeyValueStore";
import { DRAFT_VERSION, type DraftBody, type ProjectDraft } from "./ProjectDraft";

const KEY = "draft";

export class DraftRepository {
  constructor(
    private readonly store: KeyValueStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async save(body: DraftBody): Promise<void> {
    const draft: ProjectDraft = { ...body, version: DRAFT_VERSION, savedAt: this.now().toISOString() };
    await this.store.set(KEY, draft);
  }

  /** Bản nháp không đọc được hoặc sai phiên bản thì coi như chưa có (không ném). */
  async load(): Promise<ProjectDraft | null> {
    const value = await this.store.get<unknown>(KEY);
    if (typeof value !== "object" || value === null) return null;
    const draft = value as Partial<ProjectDraft>;
    if (draft.version !== DRAFT_VERSION || typeof draft.project !== "object" || draft.project === null) return null;
    return draft as ProjectDraft;
  }

  async clear(): Promise<void> {
    await this.store.delete(KEY);
  }
}
