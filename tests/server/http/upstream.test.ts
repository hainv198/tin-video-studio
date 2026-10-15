import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "@/server/http/upstream";
import { QuotaError, UpstreamError } from "@/domain/errors";

const labels = { service: "Dịch vụ X", quotaMessage: "Hết lượt" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchJson", () => {
  it("trả JSON khi 200", async () => {
    const f = vi.fn(async () => Response.json({ a: 1 }));
    expect(await fetchJson(f as unknown as typeof fetch, "https://x", {}, labels)).toEqual({ a: 1 });
  });

  it("429 hoặc RESOURCE_EXHAUSTED thành QuotaError", async () => {
    const f429 = async () => new Response("", { status: 429 });
    await expect(fetchJson(f429 as typeof fetch, "https://x", {}, labels)).rejects.toThrow(QuotaError);
    const fExhausted = async () => new Response('{"status":"RESOURCE_EXHAUSTED"}', { status: 403 });
    await expect(fetchJson(fExhausted as typeof fetch, "https://x", {}, labels)).rejects.toThrow("Hết lượt");
  });

  it("lỗi khác và lỗi mạng thành UpstreamError", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const f500 = async () => new Response("x", { status: 500 });
    await expect(fetchJson(f500 as typeof fetch, "https://x", {}, labels)).rejects.toThrow("Dịch vụ X lỗi 500");
    const fNet = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(fetchJson(fNet as typeof fetch, "https://x", {}, labels)).rejects.toBeInstanceOf(UpstreamError);
  });
});
