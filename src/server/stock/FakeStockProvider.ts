import { makeSolidPng } from "./png";
import type { StockItem, StockProvider, StockQuery } from "./StockProvider";

const COLORS: Array<[number, number, number]> = [
  [37, 99, 235],
  [22, 163, 74],
  [220, 38, 38],
  [147, 51, 234],
  [234, 88, 12],
  [8, 145, 178],
];

const cache = new Map<string, string>();

function pngDataUri(width: number, height: number, rgb: [number, number, number]): string {
  const key = `${width}x${height}:${rgb.join(",")}`;
  let uri = cache.get(key);
  if (!uri) {
    uri = `data:image/png;base64,${Buffer.from(makeSolidPng(width, height, rgb)).toString("base64")}`;
    cache.set(key, uri);
  }
  return uri;
}

export class FakeStockProvider implements StockProvider {
  readonly name = "fake" as const;

  async search(q: StockQuery): Promise<StockItem[]> {
    if (q.kind === "video") return [];
    return Array.from({ length: q.perPage }, (_, i) => {
      const n = (q.page - 1) * q.perPage + i + 1;
      const rgb = COLORS[n % COLORS.length] as [number, number, number];
      return {
        provider: this.name,
        id: `fake-${q.query}-${n}`,
        kind: "image" as const,
        thumbUrl: pngDataUri(320, 180, rgb),
        fullUrl: pngDataUri(1600, 900, rgb),
        width: 1600,
        height: 900,
        author: "Giả lập",
        pageUrl: "about:blank",
      };
    });
  }
}
