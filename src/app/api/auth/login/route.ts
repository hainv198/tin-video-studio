import { serverContainer } from "@/server/container";
import { makeLoginPost } from "@/server/http/authRoutes";

export const POST = makeLoginPost(() => serverContainer());
