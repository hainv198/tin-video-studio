import { describe, expect, it } from "vitest";
import { interleave, StockController } from "@/server/stock/StockController";
import type { StockItem, StockProvider } from "@/server/stock/StockProvider";
import { QuotaError, ValidationError } from "@/domain/errors";

const item = (provider: "pexels" | "pixabay", n: number): StockItem => ({
  provider,
  id: `${provider}-${n}`,
  kind: "image",
  thumbUrl: "t",
  fullUrl: "f",
  width: 1,
  height: 1,
  author: "a",
  pageUrl: "p",
});
const ok = (name: "pexels" | "pixabay", n: number): StockProvider => ({
  name,
  search: async () => Array.from({ length: n }, (_, i) => item(name, i + 1)),
});
const failing = (name: "pexels" | "pixabay"): StockProvider => ({
  name,
  search: async () => {
    throw new QuotaError(`${name} hết lượt`);
  },
});

describe("interleave", () => {
  it("xen kẽ các danh sách", () => {
    expect(interleave([[1, 2, 3], [9]])).toEqual([1, 9, 2, 3]);
  });
});

describe("StockController", () => {
  it("gộp xen kẽ kết quả hai nguồn", async () => {
    const r = await new StockController([ok("pexels", 2), ok("pixabay", 2)]).search({ q: "police", kind: "image" });
    expect(r.items.map((i) => i.id)).toEqual(["pexels-1", "pixabay-1", "pexels-2", "pixabay-2"]);
    expect(r.warnings).toEqual([]);
  });

  it("một nguồn lỗi: vẫn trả nguồn còn lại kèm cảnh báo", async () => {
    const r = await new StockController([failing("pexels"), ok("pixabay", 1)]).search({ q: "x", kind: "video" });
    expect(r.items).toHaveLength(1);
    expect(r.warnings).toEqual(["pexels: pexels hết lượt"]);
  });

  it("mọi nguồn lỗi: ném lỗi của nguồn cuối", async () => {
    await expect(new StockController([failing("pexels"), failing("pixabay")]).search({ q: "x", kind: "image" })).rejects.toThrow(
      "pixabay hết lượt",
    );
  });

  it("kiểm tham số", async () => {
    const c = new StockController([ok("pexels", 1)]);
    await expect(c.search({ q: "  ", kind: "image" })).rejects.toBeInstanceOf(ValidationError);
    await expect(c.search({ q: "x", kind: "gif" })).rejects.toBeInstanceOf(ValidationError);
    await expect(c.search({ q: "x", kind: "image", perPage: "99" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("truyền page, perPage mặc định 1 và 8", async () => {
    let seen: unknown;
    const spy: StockProvider = {
      name: "pexels",
      search: async (q) => {
        seen = q;
        return [];
      },
    };
    await new StockController([spy]).search({ q: " police ", kind: "image" });
    expect(seen).toEqual({ query: "police", kind: "image", page: 1, perPage: 8 });
  });
});
