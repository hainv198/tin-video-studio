import { afterEach, describe, expect, it, vi } from "vitest";
import { RoutingTtsProvider, type RoutedTtsProvider } from "@/server/tts/RoutingTtsProvider";
import { ValidationError } from "@/domain/errors";
import { EdgeCliTtsProvider } from "@/server/tts/EdgeCliTtsProvider";

function provider(prefix: string, opts: { failList?: boolean } = {}) {
  const synthesize = vi.fn(async () => ({ audio: new Uint8Array([1]), mimeType: "audio/mpeg" }));
  const p: RoutedTtsProvider = {
    owns: (name: string) => name.startsWith(prefix),
    listVoices: async () => {
      if (opts.failList) throw new Error("hỏng");
      return [{ name: `${prefix}A`, gender: "FEMALE" as const, tier: prefix }];
    },
    synthesize,
  };
  return { p, synthesize };
}

afterEach(() => vi.restoreAllMocks());

describe("RoutingTtsProvider", () => {
  it("gộp danh sách giọng theo thứ tự nhà cung cấp", async () => {
    const r = new RoutingTtsProvider([provider("vi-VN-MiniMax-").p, provider("vi-VN-").p]);
    expect((await r.listVoices("vi-VN")).map((v) => v.name)).toEqual(["vi-VN-MiniMax-A", "vi-VN-A"]);
  });

  it("một nguồn lỗi vẫn trả nguồn còn lại, đánh dấu danh sách bị thiếu", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = new RoutingTtsProvider([provider("vi-VN-MiniMax-", { failList: true }).p, provider("vi-VN-").p]);
    const voices = await r.listVoices("vi-VN");
    expect(voices.map((v) => v.name)).toEqual(["vi-VN-A"]);
    expect(voices.partial).toBe(true);
    expect(err).toHaveBeenCalled();
  });

  it("mọi nguồn chạy được thì danh sách không bị đánh dấu thiếu", async () => {
    const r = new RoutingTtsProvider([provider("vi-VN-MiniMax-").p, provider("vi-VN-").p]);
    expect((await r.listVoices("vi-VN")).partial).toBeFalsy();
  });

  it("mọi nguồn lỗi thì ném lỗi", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = new RoutingTtsProvider([provider("x-", { failList: true }).p]);
    await expect(r.listVoices("vi-VN")).rejects.toThrow("hỏng");
  });

  it("chuyển yêu cầu tới nhà cung cấp đầu tiên nhận tên giọng", async () => {
    const mm = provider("vi-VN-MiniMax-");
    const gg = provider("vi-VN-");
    const r = new RoutingTtsProvider([mm.p, gg.p]);
    await r.synthesize({ text: "a", voiceName: "vi-VN-MiniMax-Hai", speakingRate: 1 });
    await r.synthesize({ text: "a", voiceName: "vi-VN-Neural2-A", speakingRate: 1 });
    expect(mm.synthesize).toHaveBeenCalledTimes(1);
    expect(gg.synthesize).toHaveBeenCalledTimes(1);
  });

  it("giọng Edge được chuyển đúng tới EdgeCliTtsProvider khi chạy cùng nhà cung cấp khác", async () => {
    const run = vi.fn(async () => {});
    const edge = new EdgeCliTtsProvider({ runner: run });
    const gg = provider("gemini-");
    const r = new RoutingTtsProvider([gg.p, edge]);
    await expect(r.synthesize({ text: "a", voiceName: "vi-VN-NamMinhNeural", speakingRate: 1 })).rejects.toThrow("Giọng Edge");
    expect(run).toHaveBeenCalledTimes(1);
    expect(gg.synthesize).not.toHaveBeenCalled();
  });

  it("không ai nhận tên giọng thì ValidationError", async () => {
    const r = new RoutingTtsProvider([provider("vi-VN-MiniMax-").p]);
    await expect(r.synthesize({ text: "a", voiceName: "vi-VN-Neural2-A", speakingRate: 1 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("cần ít nhất một nhà cung cấp", () => {
    expect(() => new RoutingTtsProvider([])).toThrow("Chưa cấu hình nhà cung cấp giọng nào");
  });
});
