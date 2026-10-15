import { afterEach, describe, expect, it, vi } from "vitest";
import { QuotaError, UpstreamError, ValidationError } from "@/domain/errors";
import { GEMINI_DEFAULT_MODEL, GEMINI_VOICE_PREFIX, GeminiTtsService } from "@/server/tts/GeminiTtsService";

const KEY = "gm-bi-mat";

function audioResponse(bytes: number[], mimeType = "audio/L16;codec=pcm;rate=24000") {
  const data = Buffer.from(bytes).toString("base64");
  return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType, data } }] } }] });
}

afterEach(() => vi.restoreAllMocks());

describe("GeminiTtsService", () => {
  it("thiếu key thì báo lỗi", () => {
    expect(() => new GeminiTtsService({ apiKey: "" })).toThrow("GEMINI_API_KEY chưa được cấu hình");
  });

  it("liệt kê giọng theo thứ tự đã chọn, chỉ cho vi-VN, trả bản sao", async () => {
    const svc = new GeminiTtsService({ apiKey: KEY });
    const voices = await svc.listVoices("vi-VN");
    expect(voices.map((v) => `${v.name}:${v.gender}:${v.tier}`)).toEqual([
      "vi-VN-Gemini-Kore:FEMALE:Gemini",
      "vi-VN-Gemini-Charon:MALE:Gemini",
      "vi-VN-Gemini-Despina:FEMALE:Gemini",
      "vi-VN-Gemini-Iapetus:MALE:Gemini",
      "vi-VN-Gemini-Erinome:FEMALE:Gemini",
      "vi-VN-Gemini-Alnilam:MALE:Gemini",
      "vi-VN-Gemini-Sulafat:FEMALE:Gemini",
      "vi-VN-Gemini-Rasalgethi:MALE:Gemini",
    ]);
    expect(await svc.listVoices("en-US")).toEqual([]);
    voices.pop();
    expect(await svc.listVoices("vi-VN")).toHaveLength(8);
  });

  it("owns chỉ nhận giọng Gemini", () => {
    const svc = new GeminiTtsService({ apiKey: KEY });
    expect(svc.owns(`${GEMINI_VOICE_PREFIX}Kore`)).toBe(true);
    expect(svc.owns("vi-VN-Neural2-A")).toBe(false);
  });

  it("gửi key trong header (không nằm trong URL) và body đúng", async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => audioResponse([1, 0]));
    const svc = new GeminiTtsService({ apiKey: KEY, fetchImpl });
    await svc.synthesize({ text: "Bản tin tối nay.", voiceName: "vi-VN-Gemini-Charon", speakingRate: 1.07 });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DEFAULT_MODEL}:generateContent`);
    expect(String(url)).not.toContain(KEY);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json", "x-goog-api-key": KEY });
    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig.responseModalities).toEqual(["AUDIO"]);
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe("Charon");
    const prompt: string = body.contents[0].parts[0].text;
    expect(prompt).toContain("Bản tin tối nay.");
    expect(prompt).not.toContain("nhanh hơn");
    expect(prompt).not.toContain("chậm hơn");
  });

  it("gợi ý tốc độ trong prompt: nhanh khi 1.2, chậm khi 0.85", async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => audioResponse([1, 0]));
    const svc = new GeminiTtsService({ apiKey: KEY, fetchImpl, model: "m-khac", baseUrl: "http://localhost:9" });
    await svc.synthesize({ text: "A.", voiceName: "vi-VN-Gemini-Kore", speakingRate: 1.2 });
    await svc.synthesize({ text: "A.", voiceName: "vi-VN-Gemini-Kore", speakingRate: 0.85 });
    expect(fetchImpl.mock.calls[0]![0]).toBe("http://localhost:9/v1beta/models/m-khac:generateContent");
    expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body)).contents[0].parts[0].text).toContain("nhanh hơn bình thường một chút");
    expect(JSON.parse(String(fetchImpl.mock.calls[1]![1]?.body)).contents[0].parts[0].text).toContain("chậm hơn bình thường một chút");
  });

  it("trả WAV với sampleRate lấy từ mimeType và đúng số byte PCM", async () => {
    const pcm = [1, 0, 2, 0, 3, 0, 4, 0];
    const fetchImpl = vi.fn(async () => audioResponse(pcm, "audio/L16;codec=pcm;rate=16000"));
    const svc = new GeminiTtsService({ apiKey: KEY, fetchImpl });
    const result = await svc.synthesize({ text: "A.", voiceName: "vi-VN-Gemini-Kore", speakingRate: 1 });
    expect(result.mimeType).toBe("audio/wav");
    const view = new DataView(result.audio.buffer);
    expect(String.fromCharCode(...result.audio.slice(0, 4))).toBe("RIFF");
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(40, true)).toBe(pcm.length);
    expect(result.audio.length).toBe(44 + pcm.length);
  });

  it("mimeType không có rate thì dùng 24000", async () => {
    const fetchImpl = vi.fn(async () => audioResponse([1, 0], "audio/L16"));
    const svc = new GeminiTtsService({ apiKey: KEY, fetchImpl });
    const result = await svc.synthesize({ text: "A.", voiceName: "vi-VN-Gemini-Kore", speakingRate: 1 });
    expect(new DataView(result.audio.buffer).getUint32(24, true)).toBe(24000);
  });

  it("429 -> QuotaError", async () => {
    const fetchImpl = vi.fn(async () => new Response("quota", { status: 429 }));
    const svc = new GeminiTtsService({ apiKey: KEY, fetchImpl });
    const err = await svc.synthesize({ text: "A.", voiceName: "vi-VN-Gemini-Kore", speakingRate: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(QuotaError);
    expect(err.message).toBe("Gemini đã hết lượt tạo giọng, thử lại sau");
  });

  it("không có âm thanh -> UpstreamError", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ candidates: [{ content: { parts: [{ text: "xin lỗi" }] } }] }));
    const svc = new GeminiTtsService({ apiKey: KEY, fetchImpl });
    const err = await svc.synthesize({ text: "A.", voiceName: "vi-VN-Gemini-Kore", speakingRate: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err.message).toBe("Gemini không trả về âm thanh");
  });

  it("bị chặn nội dung -> UpstreamError", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ promptFeedback: { blockReason: "OTHER" } }));
    const svc = new GeminiTtsService({ apiKey: KEY, fetchImpl });
    const err = await svc.synthesize({ text: "A.", voiceName: "vi-VN-Gemini-Kore", speakingRate: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err.message).toBe("Gemini từ chối đọc đoạn tin này");
  });

  it("giọng lạ -> ValidationError, không gọi fetch", async () => {
    const fetchImpl = vi.fn(async () => audioResponse([1, 0]));
    const svc = new GeminiTtsService({ apiKey: KEY, fetchImpl });
    await expect(svc.synthesize({ text: "A.", voiceName: "vi-VN-Gemini-Khong", speakingRate: 1 })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.synthesize({ text: "A.", voiceName: "vi-VN-Neural2-A", speakingRate: 1 })).rejects.toThrow("Không có giọng vi-VN-Neural2-A");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("GeminiTtsService — an toàn và định dạng", () => {
  it("mimeType lạ -> UpstreamError, không bọc WAV bừa", async () => {
    const f = async () => audioResponse([1, 2, 3, 4], "audio/mpeg");
    const svc = new GeminiTtsService({ apiKey: KEY, fetchImpl: f as unknown as typeof fetch });
    await expect(svc.synthesize({ text: "a", voiceName: `${GEMINI_VOICE_PREFIX}Kore`, speakingRate: 1 })).rejects.toThrow(
      /định dạng âm thanh lạ/,
    );
  });

  it("PCM lẻ byte thì bỏ byte cuối", async () => {
    const f = async () => audioResponse([1, 2, 3]);
    const svc = new GeminiTtsService({ apiKey: KEY, fetchImpl: f as unknown as typeof fetch });
    const r = await svc.synthesize({ text: "a", voiceName: `${GEMINI_VOICE_PREFIX}Kore`, speakingRate: 1 });
    expect(r.audio.byteLength).toBe(44 + 2);
  });

  it("thân lỗi của Google có chứa key thì log đã che", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = async () => new Response(`{"error":{"message":"API key not valid ${KEY}"}}`, { status: 400 });
    const svc = new GeminiTtsService({ apiKey: KEY, fetchImpl: f as unknown as typeof fetch });
    await expect(svc.synthesize({ text: "a", voiceName: `${GEMINI_VOICE_PREFIX}Kore`, speakingRate: 1 })).rejects.toThrow(UpstreamError);
    expect(warn.mock.calls.map((c) => c.join(" ")).join("\n")).not.toContain(KEY);
  });
});
