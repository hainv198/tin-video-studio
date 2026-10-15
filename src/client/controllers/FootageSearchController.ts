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
      await fn(items[index] as T);
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
  private cancelled = false;

  constructor(private readonly deps: FootageSearchDeps) {
    super({ byScene: {}, autoRunning: false, warnings: [] }, deps.onAuthLost);
  }

  async autoFill(): Promise<void> {
    if (this.state.autoRunning) return;
    this.cancelled = false;
    const { project, footage } = this.deps.session.state;
    if (!project) return;
    const todo = footage.unassignedSceneIds(project.scenes.map((s) => s.id));
    this.patch({ autoRunning: true, warnings: [] });
    try {
      await runPool(todo, this.deps.concurrency ?? 3, (sceneId) => this.fillScene(sceneId));
    } finally {
      this.patch({ autoRunning: false });
    }
  }

  async search(sceneId: string, query: string): Promise<void> {
    this.cancelled = false;
    const text = query.trim();
    if (!text) {
      this.setScene(sceneId, { query: "", loading: false, items: [], error: "Hãy nhập từ khoá", empty: false });
      return;
    }
    const signal = this.begin(sceneId);
    this.setScene(sceneId, { query: text, loading: true, items: [], error: null, empty: false });
    try {
      const items = await this.query(text, signal);
      this.setScene(sceneId, { query: text, loading: false, items, error: null, empty: items.length === 0 });
    } catch (error) {
      this.failScene(sceneId, text, error);
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
    this.cancelled = true;
    for (const controller of this.inflight.values()) controller.abort();
    this.inflight.clear();
  }

  private async fillScene(sceneId: string): Promise<void> {
    if (this.cancelled) return;
    const { project } = this.deps.session.state;
    const scene = project?.scenes.find((s) => s.id === sceneId);
    if (!project || !scene) return;
    const fallback = this.deps.templates.get(project.templateId).defaults.fallbackKeyword;
    const phrases = this.suggester(fallback).suggest(scene.text, MAX_PHRASES);
    const first = phrases[0] ?? fallback;
    const signal = this.begin(sceneId);
    this.setScene(sceneId, { query: first, loading: true, items: [], error: null, empty: false });
    try {
      for (const phrase of phrases) {
        const items = await this.query(phrase, signal);
        if (items.length > 0) {
          this.setScene(sceneId, { query: phrase, loading: false, items, error: null, empty: false });
          this.pickFirstUnused(sceneId, items);
          return;
        }
      }
      this.setScene(sceneId, { query: first, loading: false, items: [], error: null, empty: true });
    } catch (error) {
      this.failScene(sceneId, first, error);
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
    return interleave(imageItems, videoItems);
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

  private failScene(sceneId: string, query: string, error: unknown): void {
    if (isAbort(error)) {
      this.patchScene(sceneId, { loading: false });
      return;
    }
    if (isSessionExpired(error)) this.cancel();
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
