import { describe, expect, it, vi } from "vitest";
import { GoogleTtsService, tierOf } from "@/server/tts/GoogleTtsService";
import { UpstreamError } from "@/domain/errors";

describe("tierOf", () => {
  it("lấy hạng giọng từ tên", () => {
    expect(tierOf("vi-VN-Standard-A")).toBe("Standard");
    expect(tierOf("vi-VN-Wavenet-D")).toBe("Wavenet");
    expect(tierOf("vi-VN-Neural2-A")).toBe("Neural2");
    expect(tierOf("vi-VN-Chirp3-HD-Achernar")).toBe("Chirp3-HD");
    expect(tierOf("vi-VN-A")).toBe("Standard");
  });
});

describe("GoogleTtsService", () => {
  it("listVoices lọc đúng ngôn ngữ, sắp hạng tốt lên trước", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        voices: [
          { name: "vi-VN-Standard-A", ssmlGender: "FEMALE", languageCodes: ["vi-VN"] },
          { name: "en-US-Neural2-A", ssmlGender: "MALE", languageCodes: ["en-US"] },
          { name: "vi-VN-Chirp3-HD-Achernar", ssmlGender: "FEMALE", languageCodes: ["vi-VN"] },
          { name: "vi-VN-Neural2-D", ssmlGender: "MALE", languageCodes: ["vi-VN"] },
        ],
      }),
    );
    const svc = new GoogleTtsService("KEY", fetchImpl as unknown as typeof fetch);
    expect(await svc.listVoices("vi-VN")).toEqual([
      { name: "vi-VN-Chirp3-HD-Achernar", gender: "FEMALE", tier: "Chirp3-HD" },
      { name: "vi-VN-Neural2-D", gender: "MALE", tier: "Neural2" },
      { name: "vi-VN-Standard-A", gender: "FEMALE", tier: "Standard" },
    ]);
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://texttospeech.googleapis.com/v1/voices?languageCode=vi-VN&key=KEY");
  });

  it("synthesize gửi đúng body và giải base64", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ audioContent: Buffer.from([7, 8, 9]).toString("base64") }));
    const svc = new GoogleTtsService("KEY", fetchImpl as unknown as typeof fetch);
    const result = await svc.synthesize({ text: "Xin chào.", voiceName: "vi-VN-Neural2-A", speakingRate: 1.07 });
    expect(Array.from(result.audio)).toEqual([7, 8, 9]);
    expect(result.mimeType).toBe("audio/mpeg");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://texttospeech.googleapis.com/v1/text:synthesize?key=KEY");
    expect(JSON.parse(init.body as string)).toEqual({
      input: { text: "Xin chào." },
      voice: { languageCode: "vi-VN", name: "vi-VN-Neural2-A" },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.07, sampleRateHertz: 48000 },
    });
  });

  it("thiếu audioContent thì UpstreamError", async () => {
    const svc = new GoogleTtsService("KEY", (async () => Response.json({})) as unknown as typeof fetch);
    await expect(svc.synthesize({ text: "a", voiceName: "vi-VN-Neural2-A", speakingRate: 1 })).rejects.toBeInstanceOf(
      UpstreamError,
    );
  });

  it("thiếu key thì báo lỗi cấu hình", () => {
    expect(() => new GoogleTtsService("")).toThrow("GOOGLE_TTS_API_KEY chưa được cấu hình");
  });
});
