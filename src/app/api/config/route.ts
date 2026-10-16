import { localConfigController } from "@/server/config/localConfig";
import { makeConfigGet, makeConfigPost } from "@/server/config/configRoutes";
import { serverContainer } from "@/server/container";

const deps = () => ({ auth: serverContainer().auth, config: localConfigController() });

export const GET = makeConfigGet(deps);
export const POST = makeConfigPost(deps);
