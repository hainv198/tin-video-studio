import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/client/services/AuthClient";
import { StockClient, type StockItemDto } from "@/client/services/StockClient";
import type { StockItem } from "@/server/stock/StockProvider";

// Kiểm hợp đồng kiểu: StockItem của server gán được cho StockItemDto của client (typecheck sẽ báo nếu lệch).
export const contract = (item: StockItem): StockItemDto => item;

const item: StockItemDto = {
  provider: "pexels",
  id: "pexels-photo-1",
  kind: "image",
  thumbUrl: "https://t",
  fullUrl: "https://f",
  width: 10,
  height: 10,
  author: "An",
  pageUrl: "https://p",
};

describe("StockClient", () => {
  it("gọi đúng URL với tham số đã mã hoá và trả kết quả", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ items: [item], warnings: ["pixabay: lỗi"] }));
    const out = await new StockClient(fetchImpl as unknown as typeof fetch).search("police car", "video", { page: 2, perPage: 6 });
    expect(out).toEqual({ items: [item], warnings: ["pixabay: lỗi"] });
    expect(fetchImpl).toHaveBeenCalledWith("/api/stock/search?q=police+car&kind=video&page=2&perPage=6");
  });

  it("mặc định page=1, perPage=8", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ items: [], warnings: [] }));
    await new StockClient(fetchImpl as unknown as typeof fetch).search("a", "image");
    expect(fetchImpl).toHaveBeenCalledWith("/api/stock/search?q=a&kind=image&page=1&perPage=8");
  });

  it("lỗi server thành ApiError", async () => {
    const client = new StockClient((async () =>
      Response.json({ error: { code: "UPSTREAM", message: "Không tìm được cảnh trám" } }, { status: 502 })) as unknown as typeof fetch);
    await expect(client.search("a", "image")).rejects.toBeInstanceOf(ApiError);
  });
});
