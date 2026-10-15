import { describe, expect, it } from "vitest";
import { Mp4Encoder } from "@/client/render/Mp4Encoder";

describe("Mp4Encoder.addAudio", () => {
  it("từ chối hai kênh khác độ dài trước khi đụng tới bộ mã hoá", async () => {
    const encoder = Object.create(Mp4Encoder.prototype) as Mp4Encoder;
    await expect(
      encoder.addAudio({ left: new Float32Array(4), right: new Float32Array(3), sampleRate: 48000, limiterGainDb: 0 }),
    ).rejects.toThrow("Hai kênh âm thanh phải cùng độ dài");
  });
});
