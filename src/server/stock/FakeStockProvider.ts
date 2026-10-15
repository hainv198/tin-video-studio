import type { StockItem, StockProvider, StockQuery } from "./StockProvider";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2"];

function placeholderSvg(label: string, color: string): string {
  const safe = label.replace(/[<>&"]/g, "");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">` +
    `<rect width="1600" height="900" fill="${color}"/>` +
    `<text x="800" y="470" font-family="sans-serif" font-size="96" fill="#fff" text-anchor="middle">${safe}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export class FakeStockProvider implements StockProvider {
  readonly name = "fake" as const;

  async search(q: StockQuery): Promise<StockItem[]> {
    if (q.kind === "video") return [];
    return Array.from({ length: q.perPage }, (_, i) => {
      const n = (q.page - 1) * q.perPage + i + 1;
      const url = placeholderSvg(`${q.query} #${n}`, COLORS[n % COLORS.length] as string);
      return {
        provider: this.name,
        id: `fake-${q.query}-${n}`,
        kind: "image" as const,
        thumbUrl: url,
        fullUrl: url,
        width: 1600,
        height: 900,
        author: "Giả lập",
        pageUrl: "about:blank",
      };
    });
  }
}
