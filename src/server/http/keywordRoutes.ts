import { ValidationError } from "@/domain/errors";
import type { AuthController } from "@/server/auth/AuthController";
import { assertSameSiteJson } from "@/server/config/configRoutes";
import type { KeywordRequest, SentenceKeywords } from "@/server/keywords/GeminiKeywordService";
import { withAuth } from "./withAuth";

export interface KeywordSuggestApi {
  suggest(input: KeywordRequest): Promise<SentenceKeywords[]>;
}

export interface KeywordRouteDeps {
  auth: AuthController;
  /** undefined = chưa có GEMINI_TEXT_API_KEY, tính năng tắt (client lùi về từ điển). */
  keywords: KeywordSuggestApi | undefined;
}

const NO_STORE = { "Cache-Control": "no-store" };
export const KEYWORDS_DISABLED = { code: "KEYWORDS_DISABLED", message: "Chưa cấu hình AI gợi ý từ khoá" };

export function makeKeywordsPost(getDeps: () => KeywordRouteDeps): (request: Request) => Promise<Response> {
  return withAuth(
    () => getDeps().auth,
    async (request) => {
      const keywords = getDeps().keywords;
      if (!keywords) return Response.json({ error: KEYWORDS_DISABLED }, { status: 503, headers: NO_STORE });
      assertSameSiteJson(request);
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Yêu cầu gợi ý từ khoá không hợp lệ");
      });
      const suggestions = await keywords.suggest(body as KeywordRequest);
      return Response.json({ suggestions }, { headers: NO_STORE });
    },
  );
}
