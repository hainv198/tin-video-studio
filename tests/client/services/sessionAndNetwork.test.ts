import { describe, expect, it, vi } from "vitest";
import { ApiError, assertSameSession, networkSafeFetch, NETWORK_MESSAGE, readJson } from "@/client/services/apiError";
import { MusicLibrary } from "@/client/services/MusicLibrary";
import { StockClient } from "@/client/services/StockClient";
import { TtsClient } from "@/client/services/TtsClient";

function redirected(body: BodyInit | null = "<html>đăng nhập</html>"): Response {
  const res = new Response(body, { status: 200 });
  Object.defineProperty(res, "redirected", { value: true });
  return res;
}

describe("readJson", () => {
  it("đọc JSON hợp lệ", async () => {
    await expect(readJson<{ a: number }>(Response.json({ a: 1 }))).resolves.toEqual({ a: 1 });
  });

  it("thân không phải JSON thì ApiError 502 BAD_RESPONSE", async () => {
    const err: ApiError = await readJson<never>(new Response("<html></html>")).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect([err.status, err.code]).toEqual([502, "BAD_RESPONSE"]);
  });

  it("phản hồi bị chuyển hướng (trang đăng nhập) thì ApiError 401 AUTH", async () => {
    const err: ApiError = await readJson<never>(redirected()).catch((e) => e);
    expect([err.status, err.code]).toEqual([401, "AUTH"]);
    expect(() => assertSameSession(redirected())).toThrow(ApiError);
    expect(() => assertSameSession(new Response("ok"))).not.toThrow();
  });
});

describe("networkSafeFetch", () => {
  it("lỗi mạng thành ApiError NETWORK có thông báo tiếng Việt", async () => {
    const safe = networkSafeFetch(vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch);
    const err = await safe("/x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect([err.status, err.code, err.message]).toEqual([0, "NETWORK", NETWORK_MESSAGE]);
  });

  it("AbortError giữ nguyên", async () => {
    const abort = new DOMException("aborted", "AbortError");
    const safe = networkSafeFetch(vi.fn().mockRejectedValue(abort) as unknown as typeof fetch);
    await expect(safe("/x")).rejects.toBe(abort);
  });

  it("phản hồi bình thường đi qua", async () => {
    const res = new Response("ok");
    const safe = networkSafeFetch(vi.fn().mockResolvedValue(res) as unknown as typeof fetch);
    await expect(safe("/x")).resolves.toBe(res);
  });
});

describe("StockClient", () => {
  it("truyền signal cho fetch và mã hoá từ khoá tiếng Việt", async () => {
    const fetchMock = vi.fn(async () => Response.json({ items: [], warnings: [] }));
    const controller = new AbortController();
    await new StockClient(fetchMock as unknown as typeof fetch).search("xe cảnh sát", "image", { signal: controller.signal });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url, "http://x").searchParams.get("q")).toBe("xe cảnh sát");
    expect(init.signal).toBe(controller.signal);
  });

  it("không có signal thì gọi fetch đúng một đối số", async () => {
    const fetchMock = vi.fn(async () => Response.json({ items: [], warnings: [] }));
    await new StockClient(fetchMock as unknown as typeof fetch).search("a", "image");
    expect(fetchMock.mock.calls[0]).toHaveLength(1);
  });

  it("200 nhưng thân sai hình dạng thì ApiError BAD_RESPONSE", async () => {
    const client = new StockClient((async () => Response.json({ oops: true })) as unknown as typeof fetch);
    const err = await client.search("a", "image").catch((e) => e);
    expect([err.status, err.code]).toEqual([502, "BAD_RESPONSE"]);
  });

  it("thiếu warnings thì mặc định mảng rỗng", async () => {
    const client = new StockClient((async () => Response.json({ items: [] })) as unknown as typeof fetch);
    await expect(client.search("a", "image")).resolves.toEqual({ items: [], warnings: [] });
  });

  it("bị chuyển hướng thì ApiError 401", async () => {
    const client = new StockClient((async () => redirected()) as unknown as typeof fetch);
    const err = await client.search("a", "image").catch((e) => e);
    expect(err.status).toBe(401);
  });
});

describe("TtsClient và MusicLibrary khi hết phiên", () => {
  it("synthesize bị chuyển hướng thì ApiError 401", async () => {
    const client = new TtsClient((async () => redirected("xx")) as unknown as typeof fetch);
    const err = await client.synthesize("a", "v", 1).catch((e) => e);
    expect(err.status).toBe(401);
  });

  it("voices thân không phải JSON thì ApiError BAD_RESPONSE", async () => {
    const client = new TtsClient((async () => new Response("nope")) as unknown as typeof fetch);
    const err = await client.voices().catch((e) => e);
    expect(err.code).toBe("BAD_RESPONSE");
  });

  it("kho nhạc bị chuyển hướng sang trang đăng nhập thì ApiError 401, không báo sai định dạng", async () => {
    const lib = new MusicLibrary((async () => redirected()) as unknown as typeof fetch);
    const err = await lib.list().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
  });
});
