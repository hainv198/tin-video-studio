import { stockItemToFootage } from "@/client/media/footageFactory";
import type { StockApi, StockItemDto } from "@/client/services/StockClient";
import { isSessionExpired } from "@/client/errors/userMessage";
import type { Footage } from "@/domain/Footage";
import type { IdGenerator } from "@/domain/ids";
import type { TemplateRegistry } from "@/templates/TemplateRegistry";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface KeywordSource {
  suggest(sentence: string, maxQueries?: number): string[];
}

export interface SceneSearch {
  query: string;
  loading: boolean;
  items: StockItemDto[];
  error: string | null;
  empty: boolean;
}

export interface FootageSearchState {
  byScene: Record<string, SceneSearch>;
  autoRunning: boolean;
  warnings: string[];
}

export interface FootageSearchDeps {
  session: StudioSession;
  stock: StockApi;
  keywords: (fallback: string) => KeywordSource;
  templates: Pick<TemplateRegistry, "get">;
  ids: IdGenerator;
  concurrency?: number;
  onAuthLost?: () => void;
}

const MAX_CANDIDATES = 8;
const MAX_PHRASES = 3;
const PARTIAL_SOURCE_WARNING = "Một nguồn cảnh trám đang lỗi, chỉ dùng nguồn còn lại";

/** Gộp xen kẽ ảnh và video (ảnh trước), bỏ trùng, tối đa `limit`. */
export function interleave(images: StockItemDto[], videos: StockItemDto[], limit = MAX_CANDIDATES): StockItemDto[] {
  const out: StockItemDto[] = [];
  const seen = new Set<string>();
  const push = (it: StockItemDto | undefined) => {
    if (!it || out.length >= limit) return;
    const key = `${it.provider}:${it.kind}:${it.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(it);
  };
  for (let i = 0; out.length < limit && (i < images.length || i < videos.length); i++) {
    push(images[i]);
    push(videos[i]);
  }
  return out;
}

async function runPool<T>(items: readonly T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      try {
        await fn(items[index] as T);
      } catch {
        // lỗi từng phần tử đã được báo theo cảnh; pool không bao giờ ném
      }
    }
  });
  await Promise.all(workers);
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

function uriOf(footage: Footage | undefined): string | null {
  if (!footage) return null;
  const snap = footage.snapshot();
  return snap.kind === "fallback" ? null : snap.source.uri;
}

/** Bước 3 (phần tìm kiếm): đoán từ khoá, tìm Pexels/Pixabay, tự chọn và cho chọn lại. */
export class FootageSearchController extends StateController<FootageSearchState> {
  private readonly inflight = new Map<string, AbortController>();
  private readonly suggesters = new Map<string, KeywordSource>();
  private run = 0;
  private authLost = false;

  constructor(private readonly deps: FootageSearchDeps) {
    super({ byScene: {}, autoRunning: false, warnings: [] }, deps.onAuthLost);
  }

  async autoFill(): Promise<void> {
    if (this.state.autoRunning) return;
    const run = ++this.run;
    this.authLost = false;
    const { project, footage } = this.deps.session.state;
    if (!project) return;
    const todo = footage.unassignedSceneIds(project.scenes.map((s) => s.id));
    this.patch({ autoRunning: true, warnings: [] });
    try {
      await runPool(todo, this.deps.concurrency ?? 3, (sceneId) => this.fillScene(sceneId, run));
    } finally {
      this.patch({ autoRunning: false });
    }
  }

  async search(sceneId: string, query: string): Promise<void> {
    this.authLost = false;
    const text = query.trim();
    if (!text) {
      this.setScene(sceneId, { query: "", loading: false, items: [], error: "Hãy nhập từ khoá", empty: false });
      return;
    }
    const signal = this.begin(sceneId);
    this.setScene(sceneId, { query: text, loading: true, items: [], error: null, empty: false });
    try {
      const items = await this.query(text, signal);
      if (!this.owns(sceneId, signal)) return;
      this.setScene(sceneId, { query: text, loading: false, items, error: null, empty: items.length === 0 });
    } catch (error) {
      this.failScene(sceneId, signal, text, error);
    } finally {
      this.release(sceneId, signal);
    }
  }

  choose(sceneId: string, item: StockItemDto): void {
    try {
      const footage = stockItemToFootage(item, this.deps.ids());
      this.deps.session.update((d) => ({ ...d, footage: d.footage.assign(sceneId, footage) }));
      this.patchScene(sceneId, { error: null });
    } catch (error) {
      this.patchScene(sceneId, { error: this.report(error) });
    }
  }

  /** Dừng cả lượt: huỷ yêu cầu đang bay và không nhận thêm cảnh mới. */
  cancel(): void {
    this.run++;
    const pending = [...this.inflight.keys()];
    for (const controller of this.inflight.values()) controller.abort();
    this.inflight.clear();
    const byScene = { ...this.state.byScene };
    let changed = false;
    for (const id of pending) {
      const current = byScene[id];
      if (current?.loading) {
        byScene[id] = { ...current, loading: false };
        changed = true;
      }
    }
    if (changed) this.patch({ byScene });
  }

  private async fillScene(sceneId: string, run: number): Promise<void> {
    if (run !== this.run) return;
    const { project } = this.deps.session.state;
    const scene = project?.scenes.find((s) => s.id === sceneId);
    if (!project || !scene) return;
    const signal = this.begin(sceneId);
    let current = "";
    try {
      const fallback = this.deps.templates.get(project.templateId).defaults.fallbackKeyword;
      const phrases = this.suggester(fallback).suggest(scene.text, MAX_PHRASES);
      const first = phrases[0] ?? fallback;
      current = first;
      this.setScene(sceneId, { query: first, loading: true, items: [], error: null, empty: false });
      for (const phrase of phrases) {
        current = phrase;
        const items = await this.query(phrase, signal);
        if (!this.owns(sceneId, signal)) return;
        if (items.length > 0) {
          this.setScene(sceneId, { query: phrase, loading: false, items, error: null, empty: false });
          this.pickFirstUnused(sceneId, items);
          return;
        }
      }
      this.setScene(sceneId, { query: first, loading: false, items: [], error: null, empty: true });
    } catch (error) {
      this.failScene(sceneId, signal, current, error);
    } finally {
      this.release(sceneId, signal);
    }
  }

  /** Tìm ảnh và video song song; một nguồn lỗi thì dùng nguồn còn lại, cả hai lỗi thì ném lỗi đầu. */
  private async query(query: string, signal: AbortSignal): Promise<StockItemDto[]> {
    const [images, videos] = await Promise.allSettled([
      this.deps.stock.search(query, "image", { signal, perPage: MAX_CANDIDATES }),
      this.deps.stock.search(query, "video", { signal, perPage: MAX_CANDIDATES }),
    ]);
    if (images.status === "rejected" && videos.status === "rejected") throw images.reason;
    const warnings = [images, videos].flatMap((r) => (r.status === "fulfilled" ? r.value.warnings : []));
    if (warnings.length > 0) this.addWarnings(warnings);
    const imageItems = images.status === "fulfilled" ? images.value.items : [];
    const videoItems = videos.status === "fulfilled" ? videos.value.items : [];
    const merged = interleave(imageItems, videoItems);
    const failed = images.status === "rejected" ? images : videos.status === "rejected" ? videos : null;
    if (failed) {
      if (merged.length === 0) throw failed.reason;
      if (!isAbort(failed.reason)) this.addWarnings([PARTIAL_SOURCE_WARNING]);
    }
    return merged;
  }

  private pickFirstUnused(sceneId: string, items: StockItemDto[]): void {
    const board = this.deps.session.state.footage;
    if (board.get(sceneId)) return; // người dùng đã gán cảnh này trong lúc chờ
    const used = new Set(board.sceneIds().map((id) => uriOf(board.get(id))));
    const pick = items.find((it) => !used.has(it.fullUrl)) ?? items[0];
    if (pick) this.choose(sceneId, pick);
  }

  private suggester(fallback: string): KeywordSource {
    let source = this.suggesters.get(fallback);
    if (!source) {
      source = this.deps.keywords(fallback);
      this.suggesters.set(fallback, source);
    }
    return source;
  }

  private begin(sceneId: string): AbortSignal {
    this.inflight.get(sceneId)?.abort();
    const controller = new AbortController();
    this.inflight.set(sceneId, controller);
    return controller.signal;
  }

  private owns(sceneId: string, signal: AbortSignal): boolean {
    return this.inflight.get(sceneId)?.signal === signal;
  }

  private release(sceneId: string, signal: AbortSignal): void {
    if (this.owns(sceneId, signal)) this.inflight.delete(sceneId);
  }

  private failScene(sceneId: string, signal: AbortSignal, query: string, error: unknown): void {
    if (!this.owns(sceneId, signal)) return; // yêu cầu cũ đã bị thay thế hoặc huỷ
    if (isAbort(error)) {
      this.patchScene(sceneId, { loading: false });
      return;
    }
    if (isSessionExpired(error)) {
      if (this.authLost) return;
      this.authLost = true;
      const message = this.report(error);
      this.cancel();
      this.setScene(sceneId, { query, loading: false, items: [], error: message, empty: false });
      return;
    }
    this.setScene(sceneId, { query, loading: false, items: [], error: this.report(error), empty: false });
  }

  private addWarnings(more: string[]): void {
    const merged = [...new Set([...this.state.warnings, ...more])];
    if (merged.length !== this.state.warnings.length) this.patch({ warnings: merged });
  }

  private setScene(sceneId: string, value: SceneSearch): void {
    this.patch({ byScene: { ...this.state.byScene, [sceneId]: value } });
  }

  private patchScene(sceneId: string, partial: Partial<SceneSearch>): void {
    const current = this.state.byScene[sceneId] ?? { query: "", loading: false, items: [], error: null, empty: false };
    this.setScene(sceneId, { ...current, ...partial });
  }
}
