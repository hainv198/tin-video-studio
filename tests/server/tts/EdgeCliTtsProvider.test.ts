import { writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { EdgeCliTtsProvider, ratePercent } from "@/server/tts/EdgeCliTtsProvider";
import { UpstreamError } from "@/domain/errors";

describe("ratePercent", () => {
  it("đổi tốc độ 0.8–1.3 sang phần trăm của edge-tts", () => {
    expect(ratePercent(1)).toBe("+0%");
    expect(ratePercent(1.07)).toBe("+7%");
    expect(ratePercent(0.8)).toBe("-20%");
  });
});

describe("EdgeCliTtsProvider", () => {
  it("liệt kê hai giọng Edge", async () => {
    const p = new EdgeCliTtsProvider({ runner: async () => {} });
    expect((await p.listVoices("vi-VN")).map((v) => v.name)).toEqual(["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"]);
    expect(await p.listVoices("en-US")).toEqual([]);
  });

  it("gọi edge-tts với --text=..., đọc file mp3 sinh ra rồi trả về", async () => {
    let seen: string[] = [];
    const runner = vi.fn(async (args: string[]) => {
      seen = args;
      await writeFile(args[args.indexOf("--write-media") + 1] as string, Buffer.from([0x49, 0x44, 0x33]));
    });
    const p = new EdgeCliTtsProvider({ runner });
    const r = await p.synthesize({ text: "-Xin  chào.\n", voiceName: "vi-VN-HoaiMyNeural", speakingRate: 1.07 });
    expect(Array.from(r.audio)).toEqual([0x49, 0x44, 0x33]);
    expect(r.mimeType).toBe("audio/mpeg");
    expect(seen).toEqual(expect.arrayContaining(["--voice", "vi-VN-HoaiMyNeural", "--rate=+7%", "--text=-Xin chào."]));
  });

  it("chạy lỗi hoặc không ra file thì UpstreamError, không lộ đường dẫn", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = new EdgeCliTtsProvider({
      runner: async () => {
        throw new Error("spawn C:\\bi-mat\\edge-tts.exe ENOENT");
      },
    });
    await expect(
      failing.synthesize({ text: "a", voiceName: "vi-VN-HoaiMyNeural", speakingRate: 1 }),
    ).rejects.toThrow("Giọng Edge (dev) không chạy được");
    const silent = new EdgeCliTtsProvider({ runner: async () => {} });
    await expect(silent.synthesize({ text: "a", voiceName: "vi-VN-HoaiMyNeural", speakingRate: 1 })).rejects.toBeInstanceOf(
      UpstreamError,
    );
    err.mockRestore();
  });

  it("tên giọng lạ bị từ chối trước khi chạy lệnh", async () => {
    const runner = vi.fn(async () => {});
    await expect(
      new EdgeCliTtsProvider({ runner }).synthesize({ text: "a", voiceName: "vi-VN-Khac-A", speakingRate: 1 }),
    ).rejects.toThrow("Không có giọng vi-VN-Khac-A");
    expect(runner).not.toHaveBeenCalled();
  });
});
