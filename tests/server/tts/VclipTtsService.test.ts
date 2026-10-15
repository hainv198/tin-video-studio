import { afterEach, describe, expect, it, vi } from "vitest";
import { QuotaError, UpstreamError, ValidationError } from "@/domain/errors";
import { parseVclipVoices, VclipTtsService } from "@/server/tts/VclipTtsService";

const KEY = "vclip-khoa-bi-mat";
const VOICES = JSON.stringify([
  { alias: "Hai", voiceId: "voice-hai-1", gender: "MALE" },
  { alias: "Lan", voiceId: "voice-lan-1", gender: "FEMALE" },
]);

type Step = (url: string, init?: RequestInit) => Response;

function scripted(steps: Step[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const step = steps[calls.length - 1];
    if (!step) throw new Error(`gọi thừa lần ${calls.length}: ${url}`);
    return step(url, init);
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

const rpc = (body: unknown): Step => () => Response.json(body);
const audio = (bytes: number[], type = "audio/mpeg"): Step => () =>
  new Response(new Uint8Array(bytes), { headers: { "content-type": type } });

function service(fetchImpl: typeof fetch, extra: Partial<ConstructorParameters<typeof VclipTtsService>[0]> = {}) {
  return new VclipTtsService({
    apiKey: KEY,
    voices: parseVclipVoices(VOICES),
    fetchImpl,
    sleep: async () => {},
    ...extra,
  });
}

const request = { text: "Xin chào.", voiceName: "vi-VN-Vclip-Hai", speakingRate: 1.2 };

afterEach(() => vi.restoreAllMocks());

describe("parseVclipVoices", () => {
  it("đọc danh sách giọng", () => {
    expect(parseVclipVoices(VOICES)).toEqual([
      { alias: "Hai", voiceId: "voice-hai-1", gender: "MALE" },
      { alias: "Lan", voiceId: "voice-lan-1", gender: "FEMALE" },
    ]);
  });

  it("báo lỗi rõ khi sai định dạng, alias xấu, voiceId rỗng hoặc trùng alias", () => {
    expect(() => parseVclipVoices("rác")).toThrow("VCLIP_VOICES không phải JSON hợp lệ");
    expect(() => parseVclipVoices(JSON.stringify([{ alias: "Hai Nguyen", voiceId: "v1", gender: "MALE" }]))).toThrow(
      "VCLIP_VOICES sai định dạng",
    );
    expect(() => parseVclipVoices(JSON.stringify([{ alias: "Hai", voiceId: "", gender: "MALE" }]))).toThrow(
      "VCLIP_VOICES sai định dạng",
    );
    expect(() => parseVclipVoices(JSON.stringify([{ alias: "Hai", voiceId: "v1", gender: "KHAC" }]))).toThrow(
      "VCLIP_VOICES sai định dạng",
    );
    expect(() =>
      parseVclipVoices(
        JSON.stringify([
          { alias: "Hai", voiceId: "v1", gender: "MALE" },
          { alias: "Hai", voiceId: "v2", gender: "MALE" },
        ]),
      ),
    ).toThrow("VCLIP_VOICES bị trùng alias Hai");
  });
});

describe("VclipTtsService", () => {
  it("cấu hình thiếu key hoặc giọng thì báo lỗi", () => {
    expect(() => new VclipTtsService({ apiKey: "", voices: parseVclipVoices(VOICES) })).toThrow("VCLIP_API_KEY");
    expect(() => new VclipTtsService({ apiKey: KEY, voices: [] })).toThrow("VCLIP_VOICES");
  });

  it("liệt kê giọng vi-VN-Vclip-<Alias> và owns chỉ nhận giọng vclip", async () => {
    const svc = service(scripted([]).fetchImpl);
    expect(await svc.listVoices("vi-VN")).toEqual([
      { name: "vi-VN-Vclip-Hai", gender: "MALE", tier: "Vclip" },
      { name: "vi-VN-Vclip-Lan", gender: "FEMALE", tier: "Vclip" },
    ]);
    expect(await svc.listVoices("en-US")).toEqual([]);
    expect(svc.owns("vi-VN-Vclip-Hai")).toBe(true);
    expect(svc.owns("vi-VN-MiniMax-Hai")).toBe(false);
  });

  it("tạo giọng: gửi ttsLongText, hỏi trạng thái tới khi xong, rồi tải âm thanh", async () => {
    const { fetchImpl, calls } = scripted([
      rpc({ result: { projectExportId: "exp-1" } }),
      rpc({ result: { state: "processing" } }),
      rpc({ result: { state: "processing" } }),
      rpc({ result: { state: "completed", url: "https://cdn.vclip.io/a/exp-1.mp3" } }),
      audio([1, 2, 3]),
    ]);
    const result = await service(fetchImpl).synthesize(request);

    expect(result.mimeType).toBe("audio/mpeg");
    expect(Array.from(result.audio)).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(5);

    const start = calls[0]!;
    expect(start.url).toBe("https://api-tts.vclip.io/json-rpc");
    expect(start.url).not.toContain(KEY);
    expect(start.init?.method).toBe("POST");
    const headers = start.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(start.init?.body))).toEqual({
      method: "ttsLongText",
      input: { text: "Xin chào.", userVoiceId: "voice-hai-1", speed: 1.2 },
    });

    for (const poll of calls.slice(1, 4)) {
      expect(poll.url).toBe("https://api-tts.vclip.io/json-rpc");
      expect(JSON.parse(String(poll.init?.body))).toEqual({
        method: "getExportStatus",
        input: { projectExportId: "exp-1" },
      });
    }
    expect(calls[4]!.url).toBe("https://cdn.vclip.io/a/exp-1.mp3");
    expect(JSON.stringify(calls[4]!.init ?? {})).not.toContain(KEY);
  });

  it("đọc được dạng trả về phẳng hoặc lồng trong data, và trường status/audioUrl", async () => {
    const { fetchImpl } = scripted([
      rpc({ data: { projectExportId: "exp-2" } }),
      rpc({ status: "completed", audioUrl: "https://cdn.vclip.io/b.wav" }),
      audio([9], "audio/wav"),
    ]);
    const result = await service(fetchImpl).synthesize(request);
    expect(result.mimeType).toBe("audio/wav");
    expect(Array.from(result.audio)).toEqual([9]);
  });

  it("kẹp tốc độ vào khoảng 0,5–2", async () => {
    for (const [rate, expected] of [
      [0.2, 0.5],
      [5, 2],
    ] as const) {
      const { fetchImpl, calls } = scripted([
        rpc({ projectExportId: "e" }),
        rpc({ state: "completed", downloadUrl: "https://cdn.vclip.io/c.mp3" }),
        audio([1]),
      ]);
      await service(fetchImpl).synthesize({ ...request, speakingRate: rate });
      expect(JSON.parse(String(calls[0]!.init?.body)).input.speed).toBe(expected);
    }
  });

  it("lỗi JSON-RPC thường → UpstreamError, log đã che key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl } = scripted([
      rpc({ error: { code: "INTERNAL_ERROR", message: `Input validation error: sai ${KEY}` } }),
    ]);
    await expect(service(fetchImpl).synthesize(request)).rejects.toThrow(new UpstreamError("vclip lỗi: INTERNAL_ERROR"));
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("Input validation error");
    expect(logged).not.toContain(KEY);
  });

  it("lỗi giống hết hạn mức → QuotaError, vẫn log đã che key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl } = scripted([rpc({ error: { code: "FORBIDDEN", message: `insufficient credits ${KEY}` } })]);
    await expect(service(fetchImpl).synthesize(request)).rejects.toBeInstanceOf(QuotaError);
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("insufficient credits");
    expect(logged).not.toContain(KEY);
  });

  it("lỗi chứa chữ limit nhưng không phải hạn mức → UpstreamError, không phải QuotaError", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl } = scripted([rpc({ error: { code: "BAD_REQUEST", message: "text exceeds the character limit" } })]);
    const err = await service(fetchImpl).synthesize(request).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err).not.toBeInstanceOf(QuotaError);
  });

  it("HTTP không phải 200 từ RPC → UpstreamError, log đã che key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl } = scripted([() => new Response(`lỗi máy chủ ${KEY}`, { status: 500 })]);
    await expect(service(fetchImpl).synthesize(request)).rejects.toBeInstanceOf(UpstreamError);
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("500");
    expect(logged).not.toContain(KEY);
  });

  it("lỗi dạng đối tượng error khi đang hỏi trạng thái → UpstreamError", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl } = scripted([rpc({ projectExportId: "e" }), rpc({ error: { code: "EXPORT_GONE", message: "m" } })]);
    await expect(service(fetchImpl).synthesize(request)).rejects.toThrow(new UpstreamError("vclip lỗi: EXPORT_GONE"));
  });

  it("completed nhưng không có url → UpstreamError", async () => {
    const { fetchImpl } = scripted([rpc({ projectExportId: "e" }), rpc({ state: "completed" })]);
    await expect(service(fetchImpl).synthesize(request)).rejects.toThrow(new UpstreamError("vclip không trả về âm thanh"));
  });

  it("đường dẫn âm thanh không phải https → UpstreamError, không tải", async () => {
    const { fetchImpl, calls } = scripted([rpc({ projectExportId: "e" }), rpc({ state: "completed", url: "http://cdn.vclip.io/x.mp3" })]);
    await expect(service(fetchImpl).synthesize(request)).rejects.toThrow(
      new UpstreamError("vclip trả về đường dẫn âm thanh không hợp lệ"),
    );
    expect(calls).toHaveLength(2);
  });

  it("trạng thái viết hoa vẫn được nhận", async () => {
    const { fetchImpl } = scripted([rpc({ projectExportId: "e" }), rpc({ state: "COMPLETED", url: "https://cdn.vclip.io/u.mp3" }), audio([4])]);
    expect(Array.from((await service(fetchImpl).synthesize(request)).audio)).toEqual([4]);
  });

  it("yêu cầu quá hạn (TimeoutError) → UpstreamError 'vclip không phản hồi'", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("hết giờ", "TimeoutError");
    }) as unknown as typeof fetch;
    await expect(service(fetchImpl).synthesize(request)).rejects.toThrow(new UpstreamError("vclip không phản hồi"));
  });

  it("tải âm thanh quá hạn → UpstreamError 'vclip không phản hồi'", async () => {
    const { fetchImpl } = scripted([
      rpc({ projectExportId: "e" }),
      rpc({ state: "completed", url: "https://cdn.vclip.io/t.mp3" }),
      () => {
        throw new DOMException("hết giờ", "TimeoutError");
      },
    ]);
    await expect(service(fetchImpl).synthesize(request)).rejects.toThrow(new UpstreamError("vclip không phản hồi"));
  });

  it("mọi yêu cầu có signal; tải âm thanh có signal nhưng không có Authorization", async () => {
    const { fetchImpl, calls } = scripted([
      rpc({ projectExportId: "e" }),
      rpc({ state: "completed", url: "https://cdn.vclip.io/s.mp3" }),
      audio([1]),
    ]);
    await service(fetchImpl).synthesize(request);
    for (const c of calls) expect(c.init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(calls[2]!.init?.headers ?? {})).not.toContain("Authorization");
  });

  it("tốc độ không hữu hạn → dùng 1", async () => {
    const { fetchImpl, calls } = scripted([
      rpc({ projectExportId: "e" }),
      rpc({ state: "completed", url: "https://cdn.vclip.io/n.mp3" }),
      audio([1]),
    ]);
    await service(fetchImpl).synthesize({ ...request, speakingRate: Number.NaN });
    expect(JSON.parse(String(calls[0]!.init?.body)).input.speed).toBe(1);
  });

  it("trạng thái failed → UpstreamError", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl } = scripted([rpc({ projectExportId: "e" }), rpc({ state: "failed" })]);
    await expect(service(fetchImpl).synthesize(request)).rejects.toThrow(new UpstreamError("vclip tạo giọng thất bại"));
    expect(warn).toHaveBeenCalled();
  });

  it("không có projectExportId → UpstreamError, có log", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl } = scripted([rpc({ result: {} })]);
    await expect(service(fetchImpl).synthesize(request)).rejects.toBeInstanceOf(UpstreamError);
    expect(warn).toHaveBeenCalled();
  });

  it("quá thời gian chờ → UpstreamError (đồng hồ giả, không chờ thật)", async () => {
    const steps: Step[] = [rpc({ projectExportId: "e" }), ...Array.from({ length: 10 }, () => rpc({ state: "processing" }))];
    const { fetchImpl, calls } = scripted(steps);
    const sleep = vi.fn(async () => {});
    const svc = service(fetchImpl, { sleep, pollIntervalMs: 1000, timeoutMs: 3000 });
    await expect(svc.synthesize(request)).rejects.toThrow(new UpstreamError("vclip quá lâu không trả kết quả"));
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(calls).toHaveLength(1 + 4);
  });

  it("quá hạn theo đồng hồ (now giả) dù chưa hết số lần hỏi", async () => {
    const steps: Step[] = [rpc({ projectExportId: "e" }), ...Array.from({ length: 10 }, () => rpc({ state: "processing" }))];
    const { fetchImpl, calls } = scripted(steps);
    let t = -1000;
    const now = () => (t += 1000);
    const svc = service(fetchImpl, { now, pollIntervalMs: 1, timeoutMs: 3000 });
    await expect(svc.synthesize(request)).rejects.toThrow(new UpstreamError("vclip quá lâu không trả kết quả"));
    expect(calls).toHaveLength(1 + 4);
  });

  it("tải âm thanh rỗng hoặc lỗi → UpstreamError", async () => {
    const done = rpc({ state: "completed", url: "https://cdn.vclip.io/x.mp3" });
    const empty = scripted([rpc({ projectExportId: "e" }), done, audio([])]);
    await expect(service(empty.fetchImpl).synthesize(request)).rejects.toThrow(new UpstreamError("vclip không trả về âm thanh"));
    const bad = scripted([rpc({ projectExportId: "e" }), done, () => new Response("no", { status: 403 })]);
    await expect(service(bad.fetchImpl).synthesize(request)).rejects.toBeInstanceOf(UpstreamError);
  });

  it("giọng lạ → ValidationError, không gọi mạng", async () => {
    const { fetchImpl } = scripted([]);
    await expect(service(fetchImpl).synthesize({ ...request, voiceName: "vi-VN-Vclip-Khong" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(service(fetchImpl).synthesize({ ...request, voiceName: "vi-VN-Fake-A" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
