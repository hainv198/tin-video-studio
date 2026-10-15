import { describe, expect, it } from "vitest";
import { makeStockSearchGet } from "@/server/http/stockRoutes";
import { StockController } from "@/server/stock/StockController";
import { FakeStockProvider } from "@/server/stock/FakeStockProvider";
import { QuotaError } from "@/domain/errors";
import { makeTestAuth } from "../helpers";

describe("GET /api/stock/search", () => {
  it("cần đăng nhập", async () => {
    const t = await makeTestAuth();
    const get = makeStockSearchGet(() => ({ auth: t.auth, stock: new StockController([new FakeStockProvider()]) }));
    expect((await get(new Request("http://localhost/api/stock/search?q=x&kind=image"))).status).toBe(401);
  });

  it("trả kết quả từ bản giả lập", async () => {
    const t = await makeTestAuth();
    const get = makeStockSearchGet(() => ({ auth: t.auth, stock: new StockController([new FakeStockProvider()]) }));
    const res = await get(
      new Request("http://localhost/api/stock/search?q=police&kind=image&perPage=4", {
        headers: { cookie: await t.cookieFor("hai") },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(4);
    expect(body.items[0].fullUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(body.warnings).toEqual([]);
  });

  it("Cache-Control: cache 5 phút khi đủ nguồn, no-store khi có cảnh báo", async () => {
    const t = await makeTestAuth();
    const url = "http://localhost/api/stock/search?q=police&kind=image";
    const headers = { cookie: await t.cookieFor("hai") };
    const okGet = makeStockSearchGet(() => ({ auth: t.auth, stock: new StockController([new FakeStockProvider()]) }));
    expect((await okGet(new Request(url, { headers }))).headers.get("cache-control")).toBe("private, max-age=300");

    const broken = { name: "pexels" as const, search: async () => Promise.reject(new QuotaError("hết lượt")) };
    const partialGet = makeStockSearchGet(() => ({
      auth: t.auth,
      stock: new StockController([broken, new FakeStockProvider()]),
    }));
    const res = await partialGet(new Request(url, { headers }));
    expect(res.status).toBe(200);
    expect((await res.clone().json()).warnings).toHaveLength(1);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
