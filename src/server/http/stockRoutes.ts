import type { AuthController } from "@/server/auth/AuthController";
import type { StockController } from "@/server/stock/StockController";
import { withAuth } from "./withAuth";

export interface StockRouteDeps {
  auth: AuthController;
  stock: StockController;
}

export function makeStockSearchGet(getDeps: () => StockRouteDeps): (request: Request) => Promise<Response> {
  return withAuth(
    () => getDeps().auth,
    async (request) => {
      const params = Object.fromEntries(new URL(request.url).searchParams);
      const result = await getDeps().stock.search(params);
      return Response.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
    },
  );
}
