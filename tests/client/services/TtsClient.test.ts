import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/client/services/AuthClient";
import { TtsClient } from "@/client/services/TtsClient";

describe("TtsClient", () => {
  it("voices trả danh sách giọng", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ voices: [{ name: "vi-VN-A", gender: "FEMALE", tier: "x" }] }));
    const voices = await new TtsClient(fetchImpl as unknown as typeof fetch).voices();
    expect(voices).toEqual([{ name: "vi-VN-A", gender: "FEMALE", tier: "x" }]);
    expect(fetchImpl).toHaveBeenCalledWith("/api/tts/voices");
  });

  it("synthesize gửi JSON và trả ArrayBuffer", async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    const buf = await new TtsClient(fetchImpl as unknown as typeof fetch).synthesize("Xin chào.", "vi-VN-A", 1.07);
    expect(Array.from(new Uint8Array(buf))).toEqual([1, 2, 3]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/tts");
    expect(JSON.parse(init.body as string)).toEqual({ text: "Xin chào.", voiceName: "vi-VN-A", speakingRate: 1.07 });
  });

  it("lỗi server thành ApiError với thông báo của server", async () => {
    const client = new TtsClient((async () =>
      Response.json({ error: { code: "QUOTA", message: "Hết hạn mức giọng đọc hôm nay, liên hệ Hải" } }, { status: 429 })) as unknown as typeof fetch);
    await expect(client.synthesize("a", "vi-VN-A", 1)).rejects.toBeInstanceOf(ApiError);
    await expect(client.voices()).rejects.toThrow("Hết hạn mức giọng đọc hôm nay, liên hệ Hải");
  });
});
