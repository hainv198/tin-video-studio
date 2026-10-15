import { afterEach, describe, expect, it, vi } from "vitest";
import { MiniMaxTtsService, parseMiniMaxVoices } from "@/server/tts/MiniMaxTtsService";
import { QuotaError, UpstreamError, ValidationError } from "@/domain/errors";

const VOICES = JSON.stringify([
  { alias: "Hai", voiceId: "tvsHai001", gender: "MALE" },
  { alias: "Lan", voiceId: "tvsLan001", gender: "FEMALE" },
]);

function ok(audioHex: string) {
  return Response.json({ data: { audio: audioHex, status: 2 }, base_resp: { status_code: 0, status_msg: "success" } });
}

afterEach(() => vi.restoreAllMocks());

describe("parseMiniMaxVoices", () => {
  it("đọc danh sách giọng clone", () => {
    expect(parseMiniMaxVoices(VOICES)).toEqual([
      { alias: "Hai", voiceId: "tvsHai001", gender: "MALE" },
      { alias: "Lan", voiceId: "tvsLan001", gender: "FEMALE" },
    ]);
  });

  it("báo lỗi rõ khi sai định dạng hoặc trùng alias", () => {
    expect(() => parseMiniMaxVoices("rác")).toThrow("MINIMAX_VOICES không phải JSON hợp lệ");
    expect(() =>
      parseMiniMaxVoices(JSON.stringify([{ alias: "Hai Nguyen", voiceId: "tvsHai001", gender: "MALE" }])),
    ).toThrow("MINIMAX_VOICES sai định dạng");
    expect(() => parseMiniMaxVoices(JSON.stringify([{ alias: "Hai", voiceId: "1bad", gender: "MALE" }]))).toThrow(
      "MINIMAX_VOICES sai định dạng",
    );
    expect(() =>
      parseMiniMaxVoices(
        JSON.stringify([
          { alias: "Hai", voiceId: "tvsHai001", gender: "MALE" },
          { alias: "Hai", voiceId: "tvsHai002", gender: "MALE" },
        ]),
      ),
    ).toThrow("MINIMAX_VOICES bị trùng alias Hai");
  });
});

describe("MiniMaxTtsService", () => {
  it("liệt kê giọng clone với tên vi-VN-MiniMax-<Alias>", async () => {
    const svc = new MiniMaxTtsService({ apiKey: "MK", voices: parseMiniMaxVoices(VOICES) });
    expect(await svc.listVoices("vi-VN")).toEqual([
      { name: "vi-VN-MiniMax-Hai", gender: "MALE", tier: "MiniMax" },
      { name: "vi-VN-MiniMax-Lan", gender: "FEMALE", tier: "MiniMax" },
    ]);
    expect(await svc.listVoices("en-US")).toEqual([]);
  });

  it("owns chỉ nhận giọng MiniMax", () => {
    const svc = new MiniMaxTtsService({ apiKey: "MK", voices: parseMiniMaxVoices(VOICES) });
    expect(svc.owns("vi-VN-MiniMax-Hai")).toBe(true);
    expect(svc.owns("vi-VN-Neural2-A")).toBe(false);
  });

  it("synthesize gửi đúng URL, header, body và giải hex", async () => {
    const fetchImpl = vi.fn(async () => ok("494433"));
    const svc = new MiniMaxTtsService({
      apiKey: "MK",
      voices: parseMiniMaxVoices(VOICES),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await svc.synthesize({ text: "Xin chào.", voiceName: "vi-VN-MiniMax-Hai", speakingRate: 1.07 });
    expect(Array.from(result.audio)).toEqual([0x49, 0x44, 0x33]);
    expect(result.mimeType).toBe("audio/mpeg");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.minimax.io/v1/t2a_v2");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer MK", "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      model: "speech-2.8-hd",
      text: "Xin chào.",
      stream: false,
      language_boost: "Vietnamese",
      output_format: "hex",
      voice_setting: { voice_id: "tvsHai001", speed: 1.07 },
      audio_setting: { format: "mp3", sample_rate: 44100, bitrate: 128000, channel: 1 },
    });
  });

  it("dùng model và base URL tuỳ chỉnh", async () => {
    const fetchImpl = vi.fn(async () => ok("00"));
    const svc = new MiniMaxTtsService({
      apiKey: "MK",
      voices: parseMiniMaxVoices(VOICES),
      model: "speech-2.8-turbo",
      baseUrl: "https://api-uw.minimax.io/",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await svc.synthesize({ text: "a", voiceName: "vi-VN-MiniMax-Lan", speakingRate: 1 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api-uw.minimax.io/v1/t2a_v2");
    expect(JSON.parse(init.body as string).model).toBe("speech-2.8-turbo");
  });

  it("alias không có trong cấu hình: ValidationError, không gọi API", async () => {
    const fetchImpl = vi.fn(async () => ok("00"));
    const svc = new MiniMaxTtsService({
      apiKey: "MK",
      voices: parseMiniMaxVoices(VOICES),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(svc.synthesize({ text: "a", voiceName: "vi-VN-MiniMax-Ai", speakingRate: 1 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("base_resp 1002/1039 thành QuotaError, mã khác thành UpstreamError, thiếu audio cũng vậy", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const make = (body: unknown) =>
      new MiniMaxTtsService({
        apiKey: "MK",
        voices: parseMiniMaxVoices(VOICES),
        fetchImpl: (async () => Response.json(body)) as unknown as typeof fetch,
      });
    const req = { text: "a", voiceName: "vi-VN-MiniMax-Hai", speakingRate: 1 };
    await expect(make({ base_resp: { status_code: 1002, status_msg: "rate limit" } }).synthesize(req)).rejects.toBeInstanceOf(
      QuotaError,
    );
    await expect(make({ base_resp: { status_code: 1039, status_msg: "tpm" } }).synthesize(req)).rejects.toBeInstanceOf(
      QuotaError,
    );
    await expect(make({ base_resp: { status_code: 1004, status_msg: "auth" } }).synthesize(req)).rejects.toThrow(
      "MiniMax lỗi 1004",
    );
    await expect(make({ data: null, base_resp: { status_code: 0 } }).synthesize(req)).rejects.toBeInstanceOf(
      UpstreamError,
    );
  });

  it("âm thanh hex hỏng thì UpstreamError, không trả file cụt", async () => {
    const make = (hex: string) =>
      new MiniMaxTtsService({
        apiKey: "MK",
        voices: parseMiniMaxVoices(VOICES),
        fetchImpl: (async () => ok(hex)) as unknown as typeof fetch,
      });
    const req = { text: "a", voiceName: "vi-VN-MiniMax-Hai", speakingRate: 1 };
    await expect(make("4944zz").synthesize(req)).rejects.toThrow("MiniMax trả về âm thanh hỏng");
    await expect(make("49443").synthesize(req)).rejects.toThrow("MiniMax trả về âm thanh hỏng");
  });

  it("thiếu key hoặc không có giọng thì báo lỗi cấu hình", () => {
    expect(() => new MiniMaxTtsService({ apiKey: "", voices: parseMiniMaxVoices(VOICES) })).toThrow(
      "MINIMAX_API_KEY chưa được cấu hình",
    );
    expect(() => new MiniMaxTtsService({ apiKey: "MK", voices: [] })).toThrow("MINIMAX_VOICES chưa có giọng nào");
  });
});
