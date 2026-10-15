import { describe, expect, it, vi } from "vitest";
import { MiniMaxCloneClient, validateVoiceId } from "@/server/tts/MiniMaxCloneClient";

describe("validateVoiceId", () => {
  it("theo luật của MiniMax", () => {
    expect(validateVoiceId("tvsHai001")).toBe(true);
    expect(validateVoiceId("tvs-hai_01")).toBe(true);
    expect(validateVoiceId("short1")).toBe(false);
    expect(validateVoiceId("1tvsHai001")).toBe(false);
    expect(validateVoiceId("tvsHai001_")).toBe(false);
    expect(validateVoiceId("tvs Hai 001")).toBe(false);
  });
});

describe("MiniMaxCloneClient", () => {
  it("tải file lên rồi clone, trả link nghe thử", async () => {
    const calls: Array<[string, RequestInit]> = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      if (url.endsWith("/v1/files/upload")) {
        return Response.json({ file: { file_id: 12345 }, base_resp: { status_code: 0 } });
      }
      return Response.json({
        demo_audio: "https://cdn.example/demo.mp3",
        base_resp: { status_code: 0, status_msg: "success" },
      });
    });
    const client = new MiniMaxCloneClient({ apiKey: "MK", fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await client.clone({
      audio: new Uint8Array([1, 2, 3]),
      fileName: "giong.mp3",
      voiceId: "tvsHai001",
      previewText: "Xin chào.",
    });
    expect(result).toEqual({ fileId: 12345, demoAudioUrl: "https://cdn.example/demo.mp3" });

    const [upUrl, upInit] = calls[0] as [string, RequestInit];
    expect(upUrl).toBe("https://api.minimax.io/v1/files/upload");
    expect(upInit.headers).toEqual({ Authorization: "Bearer MK" });
    const form = upInit.body as FormData;
    expect(form.get("purpose")).toBe("voice_clone");
    expect((form.get("file") as File).name).toBe("giong.mp3");

    const [cloneUrl, cloneInit] = calls[1] as [string, RequestInit];
    expect(cloneUrl).toBe("https://api.minimax.io/v1/voice_clone");
    expect(cloneInit.headers).toEqual({ Authorization: "Bearer MK", "Content-Type": "application/json" });
    expect(JSON.parse(cloneInit.body as string)).toEqual({
      file_id: 12345,
      voice_id: "tvsHai001",
      need_noise_reduction: true,
      need_volume_normalization: true,
      language_boost: "Vietnamese",
      text: "Xin chào.",
      model: "speech-2.8-hd",
    });
  });

  it("voiceId sai luật thì báo lỗi trước khi gọi API", async () => {
    const fetchImpl = vi.fn();
    const client = new MiniMaxCloneClient({ apiKey: "MK", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(
      client.clone({ audio: new Uint8Array([1]), fileName: "a.mp3", voiceId: "x", previewText: "a" }),
    ).rejects.toThrow("voiceId không hợp lệ");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("base_resp lỗi thì báo kèm mã và thông điệp", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith("/upload")
        ? Response.json({ file: { file_id: 1 }, base_resp: { status_code: 0 } })
        : Response.json({ base_resp: { status_code: 2038, status_msg: "no cloning permission" } }),
    );
    const client = new MiniMaxCloneClient({ apiKey: "MK", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(
      client.clone({ audio: new Uint8Array([1]), fileName: "a.mp3", voiceId: "tvsHai001", previewText: "a" }),
    ).rejects.toThrow("MiniMax clone lỗi 2038: no cloning permission");
  });
});
