import { describe, expect, it } from "vitest";
import { makeStockSearchGet } from "@/server/http/stockRoutes";
import { StockController } from "@/server/stock/StockController";
import { FakeStockProvider } from "@/server/stock/FakeStockProvider";
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
    expect(body.items[0].fullUrl.startsWith("data:image/svg+xml")).toBe(true);
    expect(body.warnings).toEqual([]);
  });
});
