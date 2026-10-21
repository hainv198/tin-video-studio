import { NotFoundError, ValidationError } from "./errors";
import type { IdGenerator } from "./ids";
import { isProjectKind, type ProjectKind } from "./ProjectKind";
import { Scene, type SceneRole } from "./Scene";
import type { SentenceSplitter } from "./SentenceSplitter";

export interface NewsProjectInput {
  text: string;
  title?: string;
  sourceCredit: string;
  publishDate: Date;
  templateId: string;
}

/** Đầu vào kiểu "Video tải lên": chỉ có tiêu đề (cũng là câu giọng đọc). */
export interface TitleOnlyInput {
  title: string;
  sourceCredit: string;
  publishDate: Date;
  templateId: string;
}

interface NewsProjectMeta {
  sourceCredit?: string;
  publishDate?: Date;
  templateId?: string;
}

const MAX_CREDIT_CHARS = 80;

function checkedCredit(raw: string): string {
  const credit = raw.trim();
  if (credit.length > MAX_CREDIT_CHARS) throw new ValidationError(`Nguồn tin tối đa ${MAX_CREDIT_CHARS} ký tự`);
  return credit;
}

function checkedDate(date: Date): Date {
  if (Number.isNaN(date.getTime())) throw new ValidationError("Ngày đăng không hợp lệ");
  return new Date(date.getTime());
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseLocalDate(text: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new ValidationError("Ngày đăng không hợp lệ");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    throw new ValidationError("Ngày đăng không hợp lệ");
  }
  return date;
}

export interface NewsProjectSnapshot {
  title: string;
  sourceCredit: string;
  /** yyyy-mm-dd theo giờ địa phương (không dùng ISO để khỏi lệch múi giờ). */
  publishDate: string;
  templateId: string;
  scenes: Array<{ id: string; text: string; role: SceneRole }>;
  /** Chỉ có khi "upload"; bản nháp cũ không có khoá này = "news". */
  kind?: ProjectKind;
}

const comparable = (s: string) =>
  s
    .replace(/[.!?…\s]+$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("vi");

export class NewsProject {
  static readonly MAX_CREDIT_CHARS = MAX_CREDIT_CHARS;

  private constructor(
    readonly title: string,
    readonly sourceCredit: string,
    readonly publishDate: Date,
    readonly templateId: string,
    readonly scenes: readonly Scene[],
    private readonly nextId: IdGenerator,
    readonly kind: ProjectKind,
  ) {}

  static fromText(input: NewsProjectInput, splitter: SentenceSplitter, nextId: IdGenerator): NewsProject {
    if (!input.templateId) throw new ValidationError("Chưa chọn phong cách video");
    const credit = checkedCredit(input.sourceCredit);
    const publishDate = checkedDate(input.publishDate);
    const sentences = splitter.split(input.text);
    const typedTitle = input.title?.replace(/\s+/g, " ").trim();
    const firstSentence = sentences[0];
    if (!typedTitle && firstSentence === undefined) throw new ValidationError("Chưa có nội dung tin");

    const title = typedTitle || (firstSentence as string);
    const body =
      firstSentence !== undefined && comparable(firstSentence) === comparable(title) ? sentences.slice(1) : sentences;
    if (body.length === 0) throw new ValidationError("Tin cần ít nhất một câu ngoài tiêu đề");

    const scenes = [Scene.create(nextId(), title, "intro"), ...body.map((s) => Scene.create(nextId(), s, "body"))];
    return new NewsProject(title, credit, publishDate, input.templateId, scenes, nextId, "news");
  }

  static titleOnly(input: TitleOnlyInput, nextId: IdGenerator): NewsProject {
    if (!input.templateId) throw new ValidationError("Chưa chọn phong cách video");
    const credit = checkedCredit(input.sourceCredit);
    const publishDate = checkedDate(input.publishDate);
    const title = input.title.replace(/\s+/g, " ").trim();
    if (!title) throw new ValidationError("Chưa có tiêu đề video");
    return new NewsProject(title, credit, publishDate, input.templateId, [Scene.create(nextId(), title, "intro")], nextId, "upload");
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
      meta.sourceCredit !== undefined ? checkedCredit(meta.sourceCredit) : this.sourceCredit,
      meta.publishDate !== undefined ? checkedDate(meta.publishDate) : this.publishDate,
      meta.templateId ?? this.templateId,
      this.scenes,
      this.nextId,
      this.kind,
    );
  }

  snapshot(): NewsProjectSnapshot {
    return {
      title: this.title,
      sourceCredit: this.sourceCredit,
      publishDate: toLocalDateString(this.publishDate),
      templateId: this.templateId,
      scenes: this.scenes.map((s) => ({ id: s.id, text: s.text, role: s.role })),
      // Kiểu tin giữ đúng hình dạng snapshot cũ (không có khoá kind).
      ...(this.kind === "upload" ? { kind: "upload" as const } : {}),
    };
  }

  static restore(snapshot: NewsProjectSnapshot, nextId: IdGenerator): NewsProject {
    const raw = snapshot as unknown;
    if (!isRecord(raw)) throw new ValidationError("Bản nháp hỏng: dữ liệu không hợp lệ");
    const kind: unknown = raw.kind ?? "news";
    if (!isProjectKind(kind)) throw new ValidationError("Bản nháp hỏng: kiểu video không hợp lệ");
    if (typeof raw.title !== "string" || !raw.title.trim()) throw new ValidationError("Bản nháp hỏng: thiếu tiêu đề");
    if (typeof raw.templateId !== "string" || !raw.templateId) throw new ValidationError("Chưa chọn phong cách video");
    if (raw.sourceCredit !== undefined && typeof raw.sourceCredit !== "string") {
      throw new ValidationError("Bản nháp hỏng: nguồn tin không hợp lệ");
    }
    const credit = checkedCredit(raw.sourceCredit ?? "");
    if (typeof raw.publishDate !== "string") throw new ValidationError("Ngày đăng không hợp lệ");
    const publishDate = parseLocalDate(raw.publishDate);
    if (!Array.isArray(raw.scenes)) throw new ValidationError("Bản nháp hỏng: danh sách cảnh không hợp lệ");
    const entries: unknown[] = raw.scenes;
    const scenes = entries.map((entry) => {
      if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.text !== "string") {
        throw new ValidationError("Bản nháp hỏng: cảnh không hợp lệ");
      }
      if (entry.role !== "intro" && entry.role !== "body") throw new ValidationError("Bản nháp hỏng: vai trò cảnh không hợp lệ");
      return Scene.create(entry.id, entry.text, entry.role);
    });
    if (new Set(scenes.map((s) => s.id)).size !== scenes.length) {
      throw new ValidationError("Bản nháp hỏng: id cảnh bị trùng");
    }
    const structureOk =
      kind === "upload"
        ? scenes.length === 1 && scenes[0]?.role === "intro"
        : scenes.length >= 2 && scenes[0]?.role === "intro" && scenes.slice(1).every((s) => s.role === "body");
    if (!structureOk) throw new ValidationError("Bản nháp hỏng: cấu trúc cảnh không hợp lệ");
    const taken = new Set(scenes.map((s) => s.id));
    const freshId: IdGenerator = () => {
      let id = nextId();
      while (taken.has(id)) id = nextId();
      taken.add(id);
      return id;
    };
    return new NewsProject(raw.title, credit, publishDate, raw.templateId, scenes, freshId, kind);
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
      this.kind,
    );
  }
}
