import { describe, expect, it, vi } from "vitest";
import { QuotaError } from "@/domain/errors";
import { makeKeywordsPost, type KeywordSuggestApi } from "@/server/http/keywordRoutes";
import { makeTestAuth } from "../helpers";

const URL_ = "http://localhost/api/keywords";

function fakeKeywords(impl?: KeywordSuggestApi["suggest"]): KeywordSuggestApi {
  return { suggest: vi.fn(impl ?? (async (input) => input.sentences.map(() => ({ queries: ["police car", "crime scene"] })))) };
}

async function post(keywords: KeywordSuggestApi | undefined, init: { cookie?: string; body?: unknown; headers?: Record<string, string> }) {
  const t = await makeTestAuth();
  const route = makeKeywordsPost(() => ({ auth: t.auth, keywords }));
  const headers: Record<string, string> = { "content-type": "application/json", host: "localhost", ...init.headers };
  if (init.cookie !== undefined) headers.cookie = init.cookie === "hai" ? await t.cookieFor("hai") : init.cookie;
  return route(new Request(URL_, { method: "POST", headers, body: JSON.stringify(init.body ?? { sentences: ["Câu."] }) }));
}

describe("POST /api/keywords", () => {
  it("cần đăng nhập", async () => {
    const res = await post(fakeKeywords(), {});
    expect(res.status).toBe(401);
  });

  it("thiếu key (tính năng tắt) thì 503 với mã rõ ràng", async () => {
    const res = await post(undefined, { cookie: "hai" });
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.error.code).toBe("KEYWORDS_DISABLED");
    expect(body.error.message).toBe("Chưa cấu hình AI gợi ý từ khoá");
  });

  it("từ chối khi không phải JSON hoặc Origin khác host", async () => {
    const kw = fakeKeywords();
    expect((await post(kw, { cookie: "hai", headers: { "content-type": "text/plain" } })).status).toBe(400);
    expect((await post(kw, { cookie: "hai", headers: { origin: "https://ke-xau.example" } })).status).toBe(400);
    expect(kw.suggest).not.toHaveBeenCalled();
    expect((await post(kw, { cookie: "hai", headers: { origin: "http://localhost" } })).status).toBe(200);
  });

  it("200 trả suggestions, no-store, chuyển đúng tiêu đề + câu", async () => {
    const kw = fakeKeywords();
    const res = await post(kw, { cookie: "hai", body: { title: "Tin", sentences: ["A.", "B."] } });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      suggestions: [{ queries: ["police car", "crime scene"] }, { queries: ["police car", "crime scene"] }],
    });
    expect(kw.suggest).toHaveBeenCalledWith({ title: "Tin", sentences: ["A.", "B."] });
  });

  it("body không phải JSON thì 400; hết lượt thì 429", async () => {
    const t = await makeTestAuth();
    const route = makeKeywordsPost(() => ({ auth: t.auth, keywords: fakeKeywords() }));
    const bad = await route(
      new Request(URL_, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: await t.cookieFor("hai") },
        body: "{hong",
      }),
    );
    expect(bad.status).toBe(400);
    const quota = await post(
      fakeKeywords(async () => Promise.reject(new QuotaError("hết lượt"))),
      { cookie: "hai" },
    );
    expect(quota.status).toBe(429);
  });
});
