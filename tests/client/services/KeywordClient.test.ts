import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/client/services/apiError";
import { KeywordClient } from "@/client/services/KeywordClient";

describe("KeywordClient", () => {
  it("POST /api/keywords một lần, trả danh sách từ khoá theo từng câu", async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json({ suggestions: [{ queries: ["police car"] }, { queries: ["courtroom", "judge"] }] }),
    );
    const client = new KeywordClient(fetchImpl);
    const out = await client.suggest("Tin", ["A.", "B."]);
    expect(out).toEqual([["police car"], ["courtroom", "judge"]]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/keywords");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({ title: "Tin", sentences: ["A.", "B."] });
  });

  it("cắt câu/tiêu đề theo giới hạn server và chia lô 20 câu", async () => {
    const fetchImpl = vi.fn(async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { sentences: string[] };
      return Response.json({ suggestions: body.sentences.map((s) => ({ queries: [`q${s.length}`] })) });
    });
    const client = new KeywordClient(fetchImpl);
    const sentences = Array.from({ length: 25 }, (_, i) => (i === 0 ? "a".repeat(600) : "b"));
    const out = await client.suggest("t".repeat(300), sentences);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const first = JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body));
    expect(first.sentences).toHaveLength(20);
    expect(first.sentences[0]).toHaveLength(500);
    expect(first.title).toHaveLength(200);
    expect(out).toHaveLength(25);
    expect(out[0]).toEqual(["q500"]);
  });

  it("lỗi HTTP thành ApiError; trả sai số câu hoặc sai dạng thì BAD_RESPONSE", async () => {
    const disabled = new KeywordClient(async () =>
      Response.json({ error: { code: "KEYWORDS_DISABLED", message: "Chưa cấu hình" } }, { status: 503 }),
    );
    await expect(disabled.suggest("", ["A."])).rejects.toMatchObject({ status: 503, code: "KEYWORDS_DISABLED" });
    const short = new KeywordClient(async () => Response.json({ suggestions: [] }));
    await expect(short.suggest("", ["A."])).rejects.toBeInstanceOf(ApiError);
    const odd = new KeywordClient(async () => Response.json({ suggestions: [{ queries: "x" }] }));
    await expect(odd.suggest("", ["A."])).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });
});
