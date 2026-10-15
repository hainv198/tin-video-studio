import { ApiError, readApiError, readJson } from "./apiError";

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
  search(query: string, kind: "image" | "video", options?: { page?: number; perPage?: number; signal?: AbortSignal }): Promise<StockSearchResponse>;
}

export class StockClient implements StockApi {
  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async search(
    query: string,
    kind: "image" | "video",
    options: { page?: number; perPage?: number; signal?: AbortSignal } = {},
  ): Promise<StockSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      kind,
      page: String(options.page ?? 1),
      perPage: String(options.perPage ?? 8),
    });
    const url = `/api/stock/search?${params}`;
    const response = options.signal ? await this.fetchImpl(url, { signal: options.signal }) : await this.fetchImpl(url);
    if (!response.ok) throw await readApiError(response);
    const body = await readJson<Partial<StockSearchResponse>>(response);
    if (!Array.isArray(body.items)) throw new ApiError(502, "BAD_RESPONSE", "Máy chủ trả về dữ liệu không đọc được");
    return { items: body.items, warnings: Array.isArray(body.warnings) ? body.warnings : [] };
  }
}
