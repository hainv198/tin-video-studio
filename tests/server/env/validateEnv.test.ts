import { describe, expect, it } from "vitest";
import { validateEnv } from "@/server/env/validateEnv";

const HASH = "$2b$04$abcdefghijklmnopqrstuuJ0123456789abcdefghijklmnopqrstu"; // cùng dạng với tests/server/auth/UserDirectory.test.ts
const users = Buffer.from(JSON.stringify([{ username: "hai", passwordHash: HASH, displayName: "Hải" }])).toString("base64");
const base = { AUTH_SECRET: "s".repeat(32), APP_USERS: users };

describe("validateEnv", () => {
  it("cấu hình production đủ key thì ok, summary không lộ key", () => {
    const r = validateEnv({ ...base, GOOGLE_TTS_API_KEY: "AIza-secret", PEXELS_API_KEY: "p", PIXABAY_API_KEY: "x", VERCEL_ENV: "production" });
    expect(r.ok).toBe(true);
    const text = r.ok ? r.summary.join("\n") : "";
    expect(text).not.toContain("AIza-secret");
    expect(text).toMatch(/Google TTS: đã đặt/);
  });

  it("thiếu AUTH_SECRET hoặc ngắn thì lỗi", () => {
    const r = validateEnv({ ...base, AUTH_SECRET: "ngan", FAKE_PROVIDERS: "1" });
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.problems.join()).toMatch(/AUTH_SECRET/);
  });

  it("APP_USERS hỏng thì lỗi mà không in nội dung", () => {
    const r = validateEnv({ ...base, APP_USERS: Buffer.from("[]").toString("base64"), FAKE_PROVIDERS: "1" });
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.problems.join()).toMatch(/APP_USERS/);
    expect(r.ok ? "" : r.problems.join()).not.toContain("[]");
  });

  it("FAKE_PROVIDERS trên production là lỗi; trên máy dev chỉ cảnh báo", () => {
    expect(validateEnv({ ...base, FAKE_PROVIDERS: "1", VERCEL_ENV: "production" }).ok).toBe(false);
    const dev = validateEnv({ ...base, FAKE_PROVIDERS: "1" });
    expect(dev.ok).toBe(true);
    expect(dev.ok ? dev.summary.join() : "").toMatch(/GIẢ LẬP/);
  });

  it("không fake mà thiếu key nào thì lỗi nêu đúng tên biến", () => {
    const r = validateEnv({ ...base, GOOGLE_TTS_API_KEY: "g", PEXELS_API_KEY: "" });
    expect(r.ok).toBe(false);
    const p = r.ok ? "" : r.problems.join("\n");
    expect(p).toMatch(/PEXELS_API_KEY/);
    expect(p).toMatch(/PIXABAY_API_KEY/);
    expect(p).not.toMatch(/GOOGLE_TTS_API_KEY/);
    // Pexels đang tạm ngừng cấp key mới: chỉ Pixabay cũng đủ
    expect(validateEnv({ ...base, GOOGLE_TTS_API_KEY: "g", PIXABAY_API_KEY: "x" }).ok).toBe(true);
  });

  it("EDGE_TTS_DEV khi deploy là lỗi", () => {
    expect(validateEnv({ ...base, FAKE_PROVIDERS: "1", EDGE_TTS_DEV: "1", VERCEL: "1" }).ok).toBe(false);
  });

  it("MiniMax: thiếu một trong hai thì cảnh báo, sai JSON thì lỗi", () => {
    const warn = validateEnv({ ...base, FAKE_PROVIDERS: "1", MINIMAX_API_KEY: "k" });
    expect(warn.ok).toBe(true);
    expect(warn.ok ? warn.summary.join() : "").toMatch(/MiniMax/);
    const bad = validateEnv({ ...base, FAKE_PROVIDERS: "1", MINIMAX_API_KEY: "k", MINIMAX_VOICES: "không phải json" });
    expect(bad.ok).toBe(false);
  });

  it("Gemini: có key thì ghi vào tóm tắt (không lộ key), không có thì không sao", () => {
    const on = validateEnv({ ...base, FAKE_PROVIDERS: "1", GEMINI_API_KEY: "gk-bi-mat" });
    expect(on.ok).toBe(true);
    const text = on.ok ? on.summary.join("\n") : "";
    expect(text).toContain("Gemini: đã đặt");
    expect(text).not.toContain("gk-bi-mat");
    const off = validateEnv({ ...base, FAKE_PROVIDERS: "1" });
    expect(off.ok ? off.summary.join("\n") : "").not.toContain("Gemini");
  });
});

describe("validateEnv — Vercel Preview", () => {
  it("Preview được dùng nhà cung cấp giả; production thì không (khớp server/container.ts)", () => {
    const users = Buffer.from(JSON.stringify([{ username: "hai", passwordHash: "$2b$04$abcdefghijklmnopqrstuuJ0123456789abcdefghijklmnopqrstu", displayName: "Hải" }])).toString("base64");
    const base = { AUTH_SECRET: "s".repeat(32), APP_USERS: users, FAKE_PROVIDERS: "1" };
    expect(validateEnv({ ...base, VERCEL: "1", VERCEL_ENV: "preview", NODE_ENV: "production" }).ok).toBe(true);
    expect(validateEnv({ ...base, VERCEL: "1", VERCEL_ENV: "production", NODE_ENV: "production" }).ok).toBe(false);
  });
});

describe("validateEnv — Gemini thay Google", () => {
  it("không fake: chỉ có Gemini + hai key stock là đủ; không có giọng nào thì lỗi", () => {
    const users = Buffer.from(JSON.stringify([{ username: "hai", passwordHash: "$2b$04$abcdefghijklmnopqrstuuJ0123456789abcdefghijklmnopqrstu", displayName: "Hải" }])).toString("base64");
    const base = { AUTH_SECRET: "s".repeat(32), APP_USERS: users, PEXELS_API_KEY: "p", PIXABAY_API_KEY: "x" };
    expect(validateEnv({ ...base, GEMINI_API_KEY: "gm" }).ok).toBe(true);
    const none = validateEnv(base);
    expect(none.ok).toBe(false);
    expect(none.ok ? "" : none.problems.join()).toMatch(/GOOGLE_TTS_API_KEY hoặc GEMINI_API_KEY/);
  });
});
