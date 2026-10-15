import { NotFoundError, ValidationError } from "./errors";
import type { IdGenerator } from "./ids";
import { Scene } from "./Scene";
import type { SentenceSplitter } from "./SentenceSplitter";

export interface NewsProjectInput {
  text: string;
  title?: string;
  sourceCredit: string;
  publishDate: Date;
  templateId: string;
}

interface NewsProjectMeta {
  sourceCredit?: string;
  publishDate?: Date;
  templateId?: string;
}

const comparable = (s: string) =>
  s
    .replace(/[.!?…\s]+$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("vi");

export class NewsProject {
  private constructor(
    readonly title: string,
    readonly sourceCredit: string,
    readonly publishDate: Date,
    readonly templateId: string,
    readonly scenes: readonly Scene[],
    private readonly nextId: IdGenerator,
  ) {}

  static fromText(input: NewsProjectInput, splitter: SentenceSplitter, nextId: IdGenerator): NewsProject {
    if (!input.templateId) throw new ValidationError("Chưa chọn phong cách video");
    const sentences = splitter.split(input.text);
    const typedTitle = input.title?.replace(/\s+/g, " ").trim();
    const firstSentence = sentences[0];
    if (!typedTitle && firstSentence === undefined) throw new ValidationError("Chưa có nội dung tin");

    const title = typedTitle || (firstSentence as string);
    const body =
      firstSentence !== undefined && comparable(firstSentence) === comparable(title) ? sentences.slice(1) : sentences;
    if (body.length === 0) throw new ValidationError("Tin cần ít nhất một câu ngoài tiêu đề");

    const scenes = [Scene.create(nextId(), title, "intro"), ...body.map((s) => Scene.create(nextId(), s, "body"))];
    return new NewsProject(title, input.sourceCredit.trim(), input.publishDate, input.templateId, scenes, nextId);
  }

  get introScene(): Scene {
    return this.scenes[0] as Scene;
  }

  get bodyScenes(): Scene[] {
    return this.scenes.slice(1);
  }

  get displayTitle(): string {
    return this.title.replace(/[.!?…]+$/u, "").trim();
  }

  get totalChars(): number {
    return this.scenes.reduce((n, s) => n + s.text.length, 0);
  }

  formattedPublishDate(): string {
    const d = this.publishDate;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  sceneById(id: string): Scene {
    const scene = this.scenes.find((s) => s.id === id);
    if (!scene) throw new NotFoundError(`Không tìm thấy cảnh ${id}`);
    return scene;
  }

  updateSceneText(id: string, text: string): NewsProject {
    const updated = this.sceneById(id).withText(text);
    const scenes = this.scenes.map((s) => (s.id === id ? updated : s));
    const title = updated.role === "intro" ? updated.text : this.title;
    return this.copy({ scenes, title });
  }

  mergeWithNext(id: string): NewsProject {
    const index = this.indexOf(id);
    const current = this.scenes[index] as Scene;
    const next = this.scenes[index + 1];
    if (current.role === "intro") throw new ValidationError("Không gộp được cảnh mở đầu");
    if (!next) throw new ValidationError("Cảnh cuối không có cảnh sau để gộp");
    const merged = current.withText(`${current.text} ${next.text}`);
    const scenes = [...this.scenes.slice(0, index), merged, ...this.scenes.slice(index + 2)];
    return this.copy({ scenes });
  }

  splitScene(id: string, at: number): NewsProject {
    const index = this.indexOf(id);
    const current = this.scenes[index] as Scene;
    if (current.role === "intro") throw new ValidationError("Không tách được cảnh mở đầu");
    const left = current.text.slice(0, at).trim();
    const right = current.text.slice(at).trim();
    if (!left || !right) throw new ValidationError("Vị trí tách phải nằm giữa câu");
    const scenes = [
      ...this.scenes.slice(0, index),
      current.withText(left),
      Scene.create(this.nextId(), right, "body"),
      ...this.scenes.slice(index + 1),
    ];
    return this.copy({ scenes });
  }

  withMeta(meta: NewsProjectMeta): NewsProject {
    if (meta.templateId !== undefined && !meta.templateId) throw new ValidationError("Chưa chọn phong cách video");
    return new NewsProject(
      this.title,
      meta.sourceCredit !== undefined ? meta.sourceCredit.trim() : this.sourceCredit,
      meta.publishDate ?? this.publishDate,
      meta.templateId ?? this.templateId,
      this.scenes,
      this.nextId,
    );
  }

  private indexOf(id: string): number {
    const index = this.scenes.findIndex((s) => s.id === id);
    if (index < 0) throw new NotFoundError(`Không tìm thấy cảnh ${id}`);
    return index;
  }

  private copy(change: { scenes: readonly Scene[]; title?: string }): NewsProject {
    return new NewsProject(
      change.title ?? this.title,
      this.sourceCredit,
      this.publishDate,
      this.templateId,
      change.scenes,
      this.nextId,
    );
  }
}
