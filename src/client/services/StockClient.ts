import { readApiError } from "./apiError";

export interface StockItemDto {
  provider: "pexels" | "pixabay" | "fake";
  id: string;
  kind: "image" | "video";
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  durationSec?: number;
  author: string;
  pageUrl: string;
}

export interface StockSearchResponse {
  items: StockItemDto[];
  warnings: string[];
}

export interface StockApi {
  search(query: string, kind: "image" | "video", options?: { page?: number; perPage?: number }): Promise<StockSearchResponse>;
}

export class StockClient implements StockApi {
  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async search(
    query: string,
    kind: "image" | "video",
    options: { page?: number; perPage?: number } = {},
  ): Promise<StockSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      kind,
      page: String(options.page ?? 1),
      perPage: String(options.perPage ?? 8),
    });
    const response = await this.fetchImpl(`/api/stock/search?${params}`);
    if (!response.ok) throw await readApiError(response);
    return (await response.json()) as StockSearchResponse;
  }
}
