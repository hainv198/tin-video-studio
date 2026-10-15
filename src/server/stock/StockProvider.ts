export type StockKind = "image" | "video";
export type StockProviderName = "pexels" | "pixabay" | "fake";

export interface StockItem {
  provider: StockProviderName;
  id: string;
  kind: StockKind;
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  durationSec?: number;
  author: string;
  pageUrl: string;
}

export interface StockQuery {
  query: string;
  kind: StockKind;
  page: number;
  perPage: number;
}

export interface StockProvider {
  readonly name: StockProviderName;
  search(query: StockQuery): Promise<StockItem[]>;
}
