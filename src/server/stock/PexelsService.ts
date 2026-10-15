import { fetchJson } from "@/server/http/upstream";
import type { StockItem, StockProvider, StockQuery } from "./StockProvider";

const BASE = "https://api.pexels.com";
const LABELS = { service: "Pexels", quotaMessage: "Pexels đã hết lượt tìm trong giờ này, thử lại sau" };
const MAX_SIDE = 1920;

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  src: { medium: string; large2x: string; original: string };
}

export interface PexelsVideoFile {
  link: string;
  file_type: string;
  width: number | null;
  height: number | null;
  quality: string | null;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image: string;
  duration: number;
  user: { name: string };
  video_files: PexelsVideoFile[];
}

export function pickPexelsFile(files: readonly PexelsVideoFile[]): PexelsVideoFile | undefined {
  const mp4 = files.filter((f) => f.file_type === "video/mp4" && f.width && f.height);
  const fitting = mp4.filter((f) => Math.max(f.width ?? 0, f.height ?? 0) <= MAX_SIDE);
  const pool = fitting.length > 0 ? fitting : mp4;
  return [...pool].sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0];
}

export class PexelsService implements StockProvider {
  readonly name = "pexels" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("PEXELS_API_KEY chưa được cấu hình");
  }

  async search(q: StockQuery): Promise<StockItem[]> {
    const params = new URLSearchParams({ query: q.query, page: String(q.page), per_page: String(q.perPage) });
    const init: RequestInit = { headers: { Authorization: this.apiKey } };
    if (q.kind === "image") {
      const data = await fetchJson<{ photos?: PexelsPhoto[] }>(this.fetchImpl, `${BASE}/v1/search?${params}`, init, LABELS);
      return (data.photos ?? []).map((p) => ({
        provider: this.name,
        id: `pexels-photo-${p.id}`,
        kind: "image",
        thumbUrl: p.src.medium,
        fullUrl: p.src.large2x,
        width: p.width,
        height: p.height,
        author: p.photographer,
        pageUrl: p.url,
      }));
    }
    const data = await fetchJson<{ videos?: PexelsVideo[] }>(
      this.fetchImpl,
      `${BASE}/videos/search?${params}`,
      init,
      LABELS,
    );
    return (data.videos ?? []).flatMap((v): StockItem[] => {
      const file = pickPexelsFile(v.video_files);
      if (!file) return [];
      return [
        {
          provider: this.name,
          id: `pexels-video-${v.id}`,
          kind: "video",
          thumbUrl: v.image,
          fullUrl: file.link,
          width: file.width ?? v.width,
          height: file.height ?? v.height,
          durationSec: v.duration,
          author: v.user.name,
          pageUrl: v.url,
        },
      ];
    });
  }
}
