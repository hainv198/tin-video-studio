import { describe, expect, it } from "vitest";
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
});
