import { afterEach, describe, expect, it, vi } from "vitest";
import { QuotaError, UpstreamError, ValidationError } from "@/domain/errors";
import { GEMINI_TEXT_DEFAULT_MODEL, GeminiKeywordService } from "@/server/keywords/GeminiKeywordService";

const KEY = "gt-bi-mat";

function modelReply(payload: unknown) {
  return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] });
}

function make(reply: () => Response | Promise<Response>) {
  const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => reply());
  return { svc: new GeminiKeywordService({ apiKey: KEY, fetchImpl }), fetchImpl };
}

afterEach(() => vi.restoreAllMocks());

describe("GeminiKeywordService", () => {
  it("thiếu key thì báo lỗi", () => {
    expect(() => new GeminiKeywordService({ apiKey: "" })).toThrow("GEMINI_TEXT_API_KEY chưa được cấu hình");
  });

  it("gọi generateContent với key trong header, JSON schema và lời nhắc chứa tiêu đề + từng câu", async () => {
    const { svc, fetchImpl } = make(() => modelReply([{ queries: ["police car", "crime scene tape"] }, { queries: ["courtroom", "judge desk"] }]));
    await svc.suggest({ title: "Bắt nghi phạm trộm xe", sentences: ["Công an vào cuộc.", "Toà xét xử."] });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_DEFAULT_MODEL}:generateContent`);
    expect(GEMINI_TEXT_DEFAULT_MODEL).toBe("gemini-2.5-flash");
    expect(String(url)).not.toContain(KEY);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json", "x-goog-api-key": KEY });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema.type).toBe("ARRAY");
    expect(body.generationConfig.responseSchema.items.properties.queries.type).toBe("ARRAY");
    const prompt: string = body.contents[0].parts[0].text;
    expect(prompt).toContain("Bắt nghi phạm trộm xe");
    expect(prompt).toContain("1. Công an vào cuộc.");
    expect(prompt).toContain("2. Toà xét xử.");
    expect(prompt).toMatch(/English/i);
  });

  it("đổi model bằng tuỳ chọn", async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => modelReply([{ queries: ["a b"] }]));
    await new GeminiKeywordService({ apiKey: KEY, model: "gemini-x", fetchImpl }).suggest({ sentences: ["Câu."] });
    expect(String(fetchImpl.mock.calls[0]![0])).toContain("/models/gemini-x:generateContent");
  });

  it("chuẩn hoá: cắt khoảng trắng, chữ thường, bỏ ký tự lạ, tối đa 40 ký tự, bỏ trùng trong câu, tối đa 3", async () => {
    const { svc } = make(() =>
      modelReply([{ queries: ["  Police CAR!! ", "police car", "Crime-scene  tape", "x".repeat(60), "fourth one"] }]),
    );
    const [first] = await svc.suggest({ sentences: ["Công an vào cuộc."] });
    expect(first!.queries).toEqual(["police car", "crime-scene tape", "x".repeat(40)]);
  });

  it("khử trùng lặp xuyên câu: từ khoá đầu trùng câu trước thì đẩy từ khoá kế lên đầu", async () => {
    const { svc } = make(() =>
      modelReply([
        { queries: ["court gavel", "courtroom"] },
        { queries: ["court gavel", "judge reading verdict", "lawyer"] },
        { queries: ["prison bars", "handcuffs"] },
      ]),
    );
    const out = await svc.suggest({ sentences: ["A.", "B.", "C."] });
    expect(out.map((s) => s.queries[0])).toEqual(["court gavel", "judge reading verdict", "prison bars"]);
    expect(out[1]!.queries).toEqual(["judge reading verdict", "court gavel", "lawyer"]);
  });

  it("mọi từ khoá đều trùng câu trước thì giữ nguyên", async () => {
    const { svc } = make(() => modelReply([{ queries: ["street", "city"] }, { queries: ["street"] }]));
    const out = await svc.suggest({ sentences: ["A.", "B."] });
    expect(out[1]!.queries).toEqual(["street"]);
  });

  it("luôn trả đúng số câu: model trả thiếu thì bù rỗng, thừa thì cắt", async () => {
    const short = make(() => modelReply([{ queries: ["a scene"] }]));
    expect(await short.svc.suggest({ sentences: ["A.", "B.", "C."] })).toEqual([
      { queries: ["a scene"] },
      { queries: [] },
      { queries: [] },
    ]);
    const long = make(() => modelReply([{ queries: ["a"] }, { queries: ["b"] }, { queries: ["c"] }]));
    expect(await long.svc.suggest({ sentences: ["A."] })).toEqual([{ queries: ["a"] }]);
  });

  it("phần tử hỏng thì coi như rỗng; JSON hỏng thì UpstreamError", async () => {
    const odd = make(() => modelReply([{ queries: [1, null, "ok scene"] }, "rác", { khac: true }]));
    expect(await odd.svc.suggest({ sentences: ["A.", "B.", "C."] })).toEqual([
      { queries: ["ok scene"] },
      { queries: [] },
      { queries: [] },
    ]);
    const broken = make(() => Response.json({ candidates: [{ content: { parts: [{ text: "{khong-json" }] } }] }));
    await expect(broken.svc.suggest({ sentences: ["A."] })).rejects.toBeInstanceOf(UpstreamError);
    const empty = make(() => Response.json({ candidates: [] }));
    await expect(empty.svc.suggest({ sentences: ["A."] })).rejects.toBeInstanceOf(UpstreamError);
  });

  it("429 hoặc RESOURCE_EXHAUSTED thành QuotaError", async () => {
    const a = make(() => new Response("hết", { status: 429 }));
    await expect(a.svc.suggest({ sentences: ["A."] })).rejects.toBeInstanceOf(QuotaError);
    const b = make(() => new Response('{"error":{"status":"RESOURCE_EXHAUSTED"}}', { status: 400 }));
    await expect(b.svc.suggest({ sentences: ["A."] })).rejects.toBeInstanceOf(QuotaError);
  });

  it("lỗi khác thành UpstreamError, thân lỗi ghi log đã che key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { svc } = make(() => new Response(`API key ${KEY} không hợp lệ`, { status: 400 }));
    await expect(svc.suggest({ sentences: ["A."] })).rejects.toBeInstanceOf(UpstreamError);
    const logged = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).not.toContain(KEY);
    expect(logged).toContain("[đã che]");
  });

  it("đầu vào vượt giới hạn hoặc sai kiểu thì ValidationError, không gọi mạng", async () => {
    const { svc, fetchImpl } = make(() => modelReply([]));
    const bad = [
      { sentences: [] },
      { sentences: Array.from({ length: 21 }, () => "Câu.") },
      { sentences: ["a".repeat(501)] },
      { sentences: ["Câu."], title: "t".repeat(201) },
      { sentences: [5] },
      { sentences: "Câu." },
      { sentences: ["Câu."], title: 7 },
      null,
    ];
    for (const input of bad) {
      await expect(svc.suggest(input as never)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(svc.suggest({ sentences: Array.from({ length: 20 }, () => "a".repeat(500)), title: "t".repeat(200) })).resolves.toHaveLength(20);
  });
});
