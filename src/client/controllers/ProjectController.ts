import { FootageBoard } from "@/domain/FootageBoard";
import { NewsProject } from "@/domain/NewsProject";
import { SentenceSplitter } from "@/domain/SentenceSplitter";
import { ValidationError } from "@/domain/errors";
import type { IdGenerator } from "@/domain/ids";
import { fromDateInput } from "./dateText";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface ProjectControllerDeps {
  session: StudioSession;
  ids: IdGenerator;
  splitter?: SentenceSplitter;
  onAuthLost?: () => void;
}

export interface ProjectInput {
  text: string;
  title?: string;
  sourceCredit: string;
  publishDate: Date;
  templateId: string;
}

/** Bước 1: tạo dự án từ text, sửa/gộp/tách cảnh. */
export class ProjectController extends StateController<{ error: string | null }> {
  private readonly splitter: SentenceSplitter;

  constructor(private readonly deps: ProjectControllerDeps) {
    super({ error: null }, deps.onAuthLost);
    this.splitter = deps.splitter ?? new SentenceSplitter();
  }

  createFrom(input: ProjectInput): boolean {
    return this.attempt(() => {
      const project = NewsProject.fromText(input, this.splitter, this.deps.ids);
      this.deps.session.update((d) => ({
        ...d,
        project,
        narrations: new Map(),
        footage: FootageBoard.empty(),
      }));
    });
  }

  createFromForm(form: { text: string; title?: string; sourceCredit: string; publishDateText: string; templateId: string }): boolean {
    const publishDate = this.parseDate(form.publishDateText);
    if (!publishDate) return false;
    return this.createFrom({
      text: form.text,
      title: form.title?.trim() || undefined,
      sourceCredit: form.sourceCredit,
      publishDate,
      templateId: form.templateId,
    });
  }

  updateMeta(meta: { sourceCredit?: string; publishDate?: Date; templateId?: string }): boolean {
    return this.change((p) => p.withMeta(meta));
  }

  updateMetaFromForm(form: { sourceCredit?: string; publishDateText?: string; templateId?: string }): boolean {
    let publishDate: Date | undefined;
    if (form.publishDateText !== undefined) {
      const parsed = this.parseDate(form.publishDateText);
      if (!parsed) return false;
      publishDate = parsed;
    }
    return this.updateMeta({ sourceCredit: form.sourceCredit, publishDate, templateId: form.templateId });
  }

  updateSceneText(id: string, text: string): boolean {
    return this.change((p) => p.updateSceneText(id, text));
  }

  mergeWithNext(id: string): boolean {
    return this.change((p) => p.mergeWithNext(id));
  }

  splitScene(id: string, at: number): boolean {
    return this.change((p) => p.splitScene(id, at));
  }

  private parseDate(text: string): Date | null {
    try {
      return fromDateInput(text);
    } catch (error) {
      this.patch({ error: this.report(error) });
      return null;
    }
  }

  private change(fn: (project: NewsProject) => NewsProject): boolean {
    return this.attempt(() => {
      const current = this.deps.session.state.project;
      if (!current) throw new ValidationError("Chưa có dự án");
      const next = fn(current);
      this.deps.session.update((d) => ({ ...d, project: next }));
    });
  }

  private attempt(action: () => void): boolean {
    try {
      action();
      this.patch({ error: null });
      return true;
    } catch (error) {
      this.patch({ error: this.report(error) });
      return false;
    }
  }
}
