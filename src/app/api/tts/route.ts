import { serverContainer } from "@/server/container";
import { makeTtsPost } from "@/server/http/ttsRoutes";

export const POST = makeTtsPost(() => serverContainer());
