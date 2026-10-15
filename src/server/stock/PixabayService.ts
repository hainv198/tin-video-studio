import { fetchJson } from "@/server/http/upstream";
import type { StockItem, StockProvider, StockQuery } from "./StockProvider";

const BASE = "https://pixabay.com/api";
const LABELS = { service: "Pixabay", quotaMessage: "Pixabay đã hết lượt tìm, thử lại sau 1 phút" };
const MIN_PER_PAGE = 3;
const MAX_SIDE = 1920;

interface PixabayImage {
  id: number;
  pageURL: string;
  webformatURL: string;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  user: string;
}

interface PixabayVariant {
  url: string;
  width: number;
  height: number;
  thumbnail?: string;
}

interface PixabayVideo {
  id: number;
  pageURL: string;
  duration: number;
  user: string;
  videos: { large?: PixabayVariant; medium?: PixabayVariant; small?: PixabayVariant; tiny?: PixabayVariant };
}

function pickVariant(v: PixabayVideo["videos"]): PixabayVariant | undefined {
  const all = [v.large, v.medium, v.small, v.tiny].filter((x): x is PixabayVariant => Boolean(x?.url));
  return all.find((x) => Math.max(x.width, x.height) <= MAX_SIDE) ?? all[all.length - 1];
}

export class PixabayService implements StockProvider {
  readonly name = "pixabay" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("PIXABAY_API_KEY chưa được cấu hình");
  }

  async search(q: StockQuery): Promise<StockItem[]> {
    const params = new URLSearchParams({
      key: this.apiKey,
      q: q.query.slice(0, 100),
      page: String(q.page),
      per_page: String(Math.max(MIN_PER_PAGE, q.perPage)),
      safesearch: "true",
    });
    if (q.kind === "image") {
      params.set("image_type", "photo");
      const data = await fetchJson<{ hits?: PixabayImage[] }>(this.fetchImpl, `${BASE}/?${params}`, {}, LABELS);
      return (data.hits ?? []).slice(0, q.perPage).map((h) => ({
        provider: this.name,
        id: `pixabay-photo-${h.id}`,
        kind: "image",
        thumbUrl: h.webformatURL,
        fullUrl: h.largeImageURL,
        width: h.imageWidth,
        height: h.imageHeight,
        author: h.user,
        pageUrl: h.pageURL,
      }));
    }
    const data = await fetchJson<{ hits?: PixabayVideo[] }>(this.fetchImpl, `${BASE}/videos/?${params}`, {}, LABELS);
    return (data.hits ?? []).slice(0, q.perPage).flatMap((h): StockItem[] => {
      const variant = pickVariant(h.videos);
      if (!variant) return [];
      return [
        {
          provider: this.name,
          id: `pixabay-video-${h.id}`,
          kind: "video",
          thumbUrl: variant.thumbnail ?? "",
          fullUrl: variant.url,
          width: variant.width,
          height: variant.height,
          durationSec: h.duration,
          author: h.user,
          pageUrl: h.pageURL,
        },
      ];
    });
  }
}
