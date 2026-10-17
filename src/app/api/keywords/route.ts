import { serverContainer } from "@/server/container";
import { makeKeywordsPost } from "@/server/http/keywordRoutes";

export const POST = makeKeywordsPost(() => {
  const { auth, keywords } = serverContainer();
  return { auth, keywords };
});
