import { z } from "zod";
import { DomainError, UpstreamError, ValidationError } from "@/domain/errors";
import type { StockItem, StockProvider } from "./StockProvider";

const QuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  kind: z.enum(["image", "video"]),
  page: z.coerce.number().int().min(1).max(50).default(1),
  perPage: z.coerce.number().int().min(1).max(30).default(8),
});

export interface StockSearchResult {
  items: StockItem[];
  warnings: string[];
}

export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const value = list[i];
      if (value !== undefined) out.push(value);
    }
  }
  return out;
}

export class StockController {
  constructor(private readonly providers: StockProvider[]) {
    if (providers.length === 0) throw new Error("Chưa cấu hình nguồn cảnh trám nào");
  }

  async search(input: Record<string, string | undefined>): Promise<StockSearchResult> {
    const parsed = QuerySchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Từ khoá tìm cảnh trám không hợp lệ");
    const query = { query: parsed.data.q, kind: parsed.data.kind, page: parsed.data.page, perPage: parsed.data.perPage };

    const settled = await Promise.allSettled(this.providers.map((p) => p.search(query)));
    const lists: StockItem[][] = [];
    const warnings: string[] = [];
    let lastError: unknown;
    settled.forEach((result, i) => {
      if (result.status === "fulfilled") {
        lists.push(result.value);
        return;
      }
      lastError = result.reason;
      const name = this.providers[i]?.name;
      if (result.reason instanceof DomainError) {
        warnings.push(`${name}: ${result.reason.message}`);
      } else {
        console.error(result.reason);
        warnings.push(`${name}: lỗi không rõ`);
      }
    });

    if (lists.length === 0) {
      throw lastError instanceof DomainError ? lastError : new UpstreamError("Không tìm được cảnh trám");
    }
    return { items: interleave(lists), warnings };
  }
}
