import { describe, expect, it, vi } from "vitest";
import { TtsController } from "@/server/tts/TtsController";
import type { TtsProvider } from "@/server/tts/TtsProvider";
import { PayloadTooLargeError, ValidationError } from "@/domain/errors";

function provider(): TtsProvider & { listVoices: ReturnType<typeof vi.fn>; synthesize: ReturnType<typeof vi.fn> } {
  return {
    listVoices: vi.fn(async () => [{ name: "vi-VN-Neural2-A", gender: "FEMALE" as const, tier: "Neural2" }]),
    synthesize: vi.fn(async () => ({ audio: new Uint8Array([1]), mimeType: "audio/mpeg" })),
  };
}

describe("TtsController", () => {
  it("cache danh sách giọng 24 giờ", async () => {
    let now = 0;
    const p = provider();
    const c = new TtsController(p, () => now);
    await c.voices();
    await c.voices();
    expect(p.listVoices).toHaveBeenCalledTimes(1);
    expect(p.listVoices).toHaveBeenCalledWith("vi-VN");
    now = 86_400_001;
    await c.voices();
    expect(p.listVoices).toHaveBeenCalledTimes(2);
  });

  it("không cache danh sách giọng bị thiếu (một nguồn lỗi)", async () => {
    const p = provider();
    p.listVoices.mockImplementation(async () =>
      Object.assign([{ name: "vi-VN-MiniMax-Hai", gender: "MALE" as const, tier: "MiniMax" }], { partial: true }),
    );
    const c = new TtsController(p, () => 0);
    await c.voices();
    await c.voices();
    expect(p.listVoices).toHaveBeenCalledTimes(2);
  });

  it("cắt khoảng trắng rồi gọi nhà cung cấp", async () => {
    const p = provider();
    await new TtsController(p).synthesize({ text: "  Câu tin.  ", voiceName: "vi-VN-Neural2-A", speakingRate: 1.07 });
    expect(p.synthesize).toHaveBeenCalledWith({ text: "Câu tin.", voiceName: "vi-VN-Neural2-A", speakingRate: 1.07 });
  });

  it("chặn dữ liệu sai, câu rỗng, tốc độ ngoài khoảng", async () => {
    const c = new TtsController(provider());
    await expect(c.synthesize({ text: "a" })).rejects.toBeInstanceOf(ValidationError);
    await expect(c.synthesize({ text: "  ", voiceName: "vi-VN-Neural2-A", speakingRate: 1 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(c.synthesize({ text: "a", voiceName: "vi-VN-Neural2-A", speakingRate: 2 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("chặn quá 5.000 ký tự", async () => {
    const c = new TtsController(provider());
    await expect(
      c.synthesize({ text: "a".repeat(5001), voiceName: "vi-VN-Neural2-A", speakingRate: 1 }),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("chỉ nhận giọng vi-VN", async () => {
    const p = provider();
    await expect(
      new TtsController(p).synthesize({ text: "a", voiceName: "en-US-Studio-O", speakingRate: 1 }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(p.synthesize).not.toHaveBeenCalled();
  });

  it("làm tròn tốc độ qua VoiceSettings", async () => {
    const p = provider();
    await new TtsController(p).synthesize({ text: "a", voiceName: "vi-VN-Neural2-A", speakingRate: 1.0749 });
    expect(p.synthesize).toHaveBeenCalledWith({ text: "a", voiceName: "vi-VN-Neural2-A", speakingRate: 1.07 });
  });
});
