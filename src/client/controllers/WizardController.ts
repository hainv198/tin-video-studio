import { parseUploadUri } from "@/client/media/footageFactory";
import type { DraftRepository } from "@/client/storage/DraftRepository";
import type { DraftBody } from "@/client/storage/ProjectDraft";
import type { UploadRepository } from "@/client/storage/UploadRepository";
import { canEnter, firstIncompleteStep, STEPS, type StepId } from "./readiness";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface WizardState {
  step: StepId;
  booting: boolean;
  resume: { savedAt: string; title: string } | null;
  error: string | null;
}

export interface WizardDeps {
  session: StudioSession;
  drafts: Pick<DraftRepository, "load" | "clear">;
  uploads: Pick<UploadRepository, "list" | "delete">;
  /** Id file tải lên cần giữ thêm (ví dụ kho file của bước 3). */
  liveUploadIds?: () => Iterable<string>;
  /** Gọi khi bắt đầu dự án mới, trước khi dọn file. */
  onReset?: () => void;
  /** Trả true khi đang có lần tải file dở: hoãn dọn file để không xoá file vừa lưu. */
  deferCleanup?: () => boolean;
  onAuthLost?: () => void;
}

/** Điều hướng 5 bước, mở lại/bỏ bản nháp, dự án mới, dọn file tải lên không còn dùng. */
export class WizardController extends StateController<WizardState> {
  private pending: (DraftBody & { savedAt: string }) | null = null;
  private bootToken = 0;
  private latestBooting = 0;

  constructor(private readonly deps: WizardDeps) {
    super({ step: "news", booting: false, resume: null, error: null }, deps.onAuthLost);
  }

  async boot(): Promise<void> {
    const token = ++this.bootToken;
    this.latestBooting = token;
    this.patch({ booting: true, error: null });
    try {
      const draft = await this.deps.drafts.load();
      if (token === this.bootToken && draft && !this.deps.session.state.project) {
        this.pending = draft;
        this.patch({ resume: { savedAt: draft.savedAt, title: draft.project.title } });
      }
    } catch (error) {
      if (token === this.bootToken) this.patch({ error: this.report(error) });
    } finally {
      if (token === this.latestBooting) this.patch({ booting: false });
    }
  }

  async resume(): Promise<void> {
    const draft = this.pending;
    if (!draft) return;
    this.pending = null;
    try {
      this.deps.session.restore(draft);
      this.patch({ resume: null, error: null, step: firstIncompleteStep(this.deps.session.state) });
    } catch (error) {
      await this.deps.drafts.clear().catch(() => undefined);
      this.patch({ resume: null, error: this.report(error) });
    }
  }

  async discard(): Promise<void> {
    this.bootToken++;
    this.pending = null;
    await this.deps.drafts.clear().catch(() => undefined);
    this.patch({ resume: null, error: null });
    await this.cleanupUploads();
  }

  async newProject(): Promise<void> {
    this.bootToken++;
    this.pending = null;
    this.deps.session.reset();
    this.deps.onReset?.();
    await this.deps.drafts.clear().catch(() => undefined);
    this.patch({ step: "news", resume: null, error: null });
    await this.cleanupUploads();
  }

  goTo(step: StepId): boolean {
    if (!canEnter(step, this.deps.session.state)) return false;
    this.patch({ step });
    return true;
  }

  next(): boolean {
    const index = STEPS.findIndex((s) => s.id === this.state.step);
    const target = STEPS[index + 1];
    return target ? this.goTo(target.id) : false;
  }

  back(): void {
    const index = STEPS.findIndex((s) => s.id === this.state.step);
    const target = STEPS[index - 1];
    if (target) this.patch({ step: target.id });
  }

  /** Xoá file tải lên không còn được cảnh trám hay nhạc đang dùng tham chiếu. Lỗi bỏ qua (dọn dẹp tuỳ chọn). */
  async cleanupUploads(): Promise<void> {
    try {
      if (this.deps.deferCleanup?.()) return;
      const { footage, music } = this.deps.session.state;
      const used = new Set<string>();
      for (const sceneId of footage.sceneIds()) {
        const snap = footage.get(sceneId)?.snapshot();
        if (snap && snap.kind !== "fallback") {
          const id = parseUploadUri(snap.source.uri);
          if (id) used.add(id);
        }
      }
      const musicId = music ? parseUploadUri(music.uri) : null;
      if (musicId) used.add(musicId);
      for (const id of this.deps.liveUploadIds?.() ?? []) used.add(id);
      for (const meta of await this.deps.uploads.list()) {
        if (!used.has(meta.id)) await this.deps.uploads.delete(meta.id);
      }
    } catch {
      // dọn dẹp không bắt buộc
    }
  }
}
