import { describe, expect, it } from "vitest";
import { FakeStockProvider } from "@/server/stock/FakeStockProvider";

describe("FakeStockProvider", () => {
  const search = (kind: "image" | "video", perPage = 4, page = 1) =>
    new FakeStockProvider().search({ query: "police", kind, page, perPage });

  it("ảnh là PNG thật dạng data URI, kích thước đúng", async () => {
    const items = await search("image");
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item.fullUrl.startsWith("data:image/png;base64,")).toBe(true);
      expect(item.thumbUrl.startsWith("data:image/png;base64,")).toBe(true);
      expect([item.width, item.height, item.kind, item.provider]).toEqual([1600, 900, "image", "fake"]);
      const bytes = Buffer.from(item.fullUrl.split(",")[1] as string, "base64");
      expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(bytes.readUInt32BE(16)).toBe(1600);
      expect(bytes.readUInt32BE(20)).toBe(900);
      const thumb = Buffer.from(item.thumbUrl.split(",")[1] as string, "base64");
      expect([thumb.readUInt32BE(16), thumb.readUInt32BE(20)]).toEqual([320, 180]);
    }
  });

  it("id khác nhau giữa các trang và các màu không trùng nhau liên tiếp", async () => {
    const p1 = await search("image", 3, 1);
    const p2 = await search("image", 3, 2);
    expect(new Set([...p1, ...p2].map((i) => i.id)).size).toBe(6);
    expect(p1[0]?.fullUrl).not.toBe(p1[1]?.fullUrl);
  });

  it("video trả mảng rỗng", async () => {
    expect(await search("video")).toEqual([]);
  });
});
