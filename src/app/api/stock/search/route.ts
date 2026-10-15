import { serverContainer } from "@/server/container";
import { makeStockSearchGet } from "@/server/http/stockRoutes";

export const GET = makeStockSearchGet(() => serverContainer());
