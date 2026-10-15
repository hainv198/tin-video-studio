import { serverContainer } from "@/server/container";
import { makeVoicesGet } from "@/server/http/ttsRoutes";

export const GET = makeVoicesGet(() => serverContainer());
