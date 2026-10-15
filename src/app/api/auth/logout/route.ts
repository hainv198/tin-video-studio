import { serverContainer } from "@/server/container";
import { makeLogoutPost } from "@/server/http/authRoutes";

export const POST = makeLogoutPost(() => serverContainer());
