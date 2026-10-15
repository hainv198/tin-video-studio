import { describe, expect, it, vi } from "vitest";
import { buildServerContainer } from "@/server/container";

const HASH = "$2b$04$abcdefghijklmnopqrstuuJ0123456789abcdefghijklmnopqrstu";
const base = {
  APP_USERS: JSON.stringify([{ username: "hai", passwordHash: HASH, displayName: "Hải" }]),
  AUTH_SECRET: "s".repeat(32),
};
const realKeys = { GOOGLE_TTS_API_KEY: "g", PEXELS_API_KEY: "p", PIXABAY_API_KEY: "x" };

describe("buildServerContainer", () => {
  it("FAKE_PROVIDERS=1 dùng bản giả lập, không cần key", async () => {
    const c = buildServerContainer({ ...base, FAKE_PROVIDERS: "1" });
    expect(c.usingFakes).toBe(true);
    expect((await c.tts.voices())[0]?.name).toBe("vi-VN-Fake-A");
    expect((await c.stock.search({ q: "x", kind: "image" })).items.length).toBeGreaterThan(0);
  });

  it("không bật giả lập thì bắt buộc có đủ key thật", () => {
    expect(() => buildServerContainer(base)).toThrow("GOOGLE_TTS_API_KEY chưa được cấu hình");
    expect(() => buildServerContainer({ ...base, GOOGLE_TTS_API_KEY: "g" })).toThrow("PEXELS_API_KEY chưa được cấu hình");
    expect(buildServerContainer({ ...base, ...realKeys }).usingFakes).toBe(false);
  });

  it("cấm giả lập trên production của Vercel", () => {
    expect(() => buildServerContainer({ ...base, FAKE_PROVIDERS: "1", VERCEL_ENV: "production" })).toThrow(
      "FAKE_PROVIDERS không được bật trên production",
    );
  });

  it("cookie Secure khi NODE_ENV=production", () => {
    expect(buildServerContainer({ ...base, FAKE_PROVIDERS: "1", NODE_ENV: "production" }).secureCookies).toBe(true);
  });

  it("có cấu hình MiniMax: giọng clone đứng đầu, giọng cũ vẫn tạo được", async () => {
    const c = buildServerContainer({
      ...base,
      FAKE_PROVIDERS: "1",
      MINIMAX_API_KEY: "mk",
      MINIMAX_VOICES: JSON.stringify([{ alias: "Hai", voiceId: "tvsHai001", gender: "MALE" }]),
    });
    expect((await c.tts.voices()).map((v) => v.name)).toEqual(["vi-VN-MiniMax-Hai", "vi-VN-Fake-A", "vi-VN-Fake-B"]);
    const fake = await c.tts.synthesize({ text: "Xin chào.", voiceName: "vi-VN-Fake-A", speakingRate: 1 });
    expect(fake.mimeType).toBe("audio/wav");
  });

  it("có GEMINI_API_KEY: giọng Gemini đứng sau MiniMax, trước giọng cũ; không có thì không hiện", async () => {
    const withGemini = buildServerContainer({
      ...base,
      FAKE_PROVIDERS: "1",
      MINIMAX_API_KEY: "mk",
      MINIMAX_VOICES: JSON.stringify([{ alias: "Hai", voiceId: "tvsHai001", gender: "MALE" }]),
      GEMINI_API_KEY: "gk",
    });
    const names = (await withGemini.tts.voices()).map((v) => v.name);
    expect(names[0]).toBe("vi-VN-MiniMax-Hai");
    expect(names[1]).toBe("vi-VN-Gemini-Kore");
    expect(names.slice(-2)).toEqual(["vi-VN-Fake-A", "vi-VN-Fake-B"]);
    const without = buildServerContainer({ ...base, FAKE_PROVIDERS: "1" });
    expect((await without.tts.voices()).some((v) => v.name.startsWith("vi-VN-Gemini-"))).toBe(false);
    const geminiOnly = buildServerContainer({ ...base, FAKE_PROVIDERS: "1", GEMINI_API_KEY: "gk" });
    expect((await geminiOnly.tts.voices())[0]?.name).toBe("vi-VN-Gemini-Kore");
    const fake = await geminiOnly.tts.synthesize({ text: "Xin chào.", voiceName: "vi-VN-Fake-A", speakingRate: 1 });
    expect(fake.mimeType).toBe("audio/wav");
  });

  it("cấu hình MiniMax thiếu một nửa hoặc sai: app chạy như cũ, cảnh báo không lộ key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const half = buildServerContainer({ ...base, FAKE_PROVIDERS: "1", MINIMAX_API_KEY: "mk-bi-mat" });
      expect((await half.tts.voices()).map((v) => v.name)).toEqual(["vi-VN-Fake-A", "vi-VN-Fake-B"]);
      const broken = buildServerContainer({
        ...base,
        FAKE_PROVIDERS: "1",
        MINIMAX_API_KEY: "mk-bi-mat",
        MINIMAX_VOICES: "rác",
      });
      expect((await broken.tts.voices()).map((v) => v.name)).toEqual(["vi-VN-Fake-A", "vi-VN-Fake-B"]);
      expect(warn).toHaveBeenCalledTimes(2);
      const logged = warn.mock.calls.flat().join(" ");
      expect(logged).toContain("Bỏ qua giọng MiniMax");
      expect(logged).not.toContain("mk-bi-mat");
    } finally {
      warn.mockRestore();
    }
  });

  it("EDGE_TTS_DEV=1 (kèm giả lập) dùng giọng Edge; cấm khi production hoặc Vercel", async () => {
    const c = buildServerContainer({ ...base, FAKE_PROVIDERS: "1", EDGE_TTS_DEV: "1" });
    expect((await c.tts.voices()).map((v) => v.name)).toEqual(["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"]);
    expect(() => buildServerContainer({ ...base, FAKE_PROVIDERS: "1", EDGE_TTS_DEV: "1", NODE_ENV: "production" })).toThrow(
      "EDGE_TTS_DEV chỉ dùng khi phát triển trên máy",
    );
    expect(() => buildServerContainer({ ...base, FAKE_PROVIDERS: "1", EDGE_TTS_DEV: "1", VERCEL: "1" })).toThrow(
      "EDGE_TTS_DEV chỉ dùng khi phát triển trên máy",
    );
  });
});
