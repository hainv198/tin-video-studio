import { describe, expect, it, vi } from "vitest";
import { ConfigController } from "@/server/config/ConfigController";
import { makeConfigGet, makeConfigPost } from "@/server/config/configRoutes";
import { makeTestAuth } from "../helpers";

async function setup(env: Record<string, string | undefined> = {}) {
  const t = await makeTestAuth();
  const apply = vi.fn(async () => {});
  const config = new ConfigController({ writer: { apply }, env, onApplied: () => {} });
  const deps = () => ({ auth: t.auth, config });
  return { ...t, deps, apply, env };
}

async function post(handler: (r: Request) => Promise<Response>, body: unknown, headers: Record<string, string>) {
  return handler(
    new Request("http://localhost:3100/api/config", {
      method: "POST",
      headers: { host: "localhost:3100", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("GET /api/config", () => {
  it("cần phiên đăng nhập", async () => {
    const { deps } = await setup();
    expect((await makeConfigGet(deps)(new Request("http://localhost/api/config"))).status).toBe(401);
  });

  it("trả trạng thái, không lộ giá trị", async () => {
    const { deps, cookieFor } = await setup({ GEMINI_API_KEY: "BIMAT-1" });
    const res = await makeConfigGet(deps)(
      new Request("http://localhost/api/config", { headers: { cookie: await cookieFor("hai") } }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("BIMAT-1");
    expect(JSON.parse(text).keys.length).toBe(5);
  });
});

describe("phân quyền admin", () => {
  it("GET: user thường nhận 403 và không lộ trạng thái key", async () => {
    const { deps, cookieFor } = await setup({ GEMINI_API_KEY: "BIMAT-3" });
    const res = await makeConfigGet(deps)(
      new Request("http://localhost/api/config", { headers: { cookie: await cookieFor("lan") } }),
    );
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toContain("Chỉ quản trị viên được thay đổi cấu hình");
    expect(text).not.toContain("GEMINI_API_KEY");
    expect(JSON.parse(text).error.code).toBe("FORBIDDEN");
  });

  it("POST: user thường nhận 403 và không ghi gì", async () => {
    const { deps, cookieFor, apply } = await setup();
    const res = await post(
      makeConfigPost(deps),
      { set: { GEMINI_API_KEY: "x" } },
      { "content-type": "application/json", cookie: await cookieFor("lan"), origin: "http://localhost:3100" },
    );
    expect(res.status).toBe(403);
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("POST /api/config", () => {
  it("cần phiên đăng nhập", async () => {
    const { deps, apply } = await setup();
    const res = await post(makeConfigPost(deps), { set: { GEMINI_API_KEY: "a" } }, { "content-type": "application/json" });
    expect(res.status).toBe(401);
    expect(apply).not.toHaveBeenCalled();
  });

  it("lưu thành công và không lộ giá trị", async () => {
    const { deps, cookieFor, apply } = await setup();
    const res = await post(
      makeConfigPost(deps),
      { set: { GEMINI_API_KEY: "BIMAT-2" } },
      { "content-type": "application/json", cookie: await cookieFor("hai"), origin: "http://localhost:3100" },
    );
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain("BIMAT-2");
    expect(apply).toHaveBeenCalledOnce();
  });

  it("không phải application/json: 400", async () => {
    const { deps, cookieFor, apply } = await setup();
    const res = await post(
      makeConfigPost(deps),
      { set: { GEMINI_API_KEY: "a" } },
      { "content-type": "text/plain", cookie: await cookieFor("hai") },
    );
    expect(res.status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
  });

  it("Origin khác host: chặn", async () => {
    const { deps, cookieFor, apply } = await setup();
    const res = await post(
      makeConfigPost(deps),
      { set: { GEMINI_API_KEY: "a" } },
      { "content-type": "application/json", cookie: await cookieFor("hai"), origin: "https://evil.example" },
    );
    expect(res.status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
  });

  it("JSON hỏng: 400", async () => {
    const { deps, cookieFor } = await setup();
    const res = await post(makeConfigPost(deps), "{hong", {
      "content-type": "application/json",
      cookie: await cookieFor("hai"),
    });
    expect(res.status).toBe(400);
  });

  it("khoá lạ: 400", async () => {
    const { deps, cookieFor } = await setup();
    const res = await post(
      makeConfigPost(deps),
      { set: { AUTH_SECRET: "x" } },
      { "content-type": "application/json", cookie: await cookieFor("hai") },
    );
    expect(res.status).toBe(400);
  });

  it("bị chặn khi VERCEL đặt", async () => {
    const { deps, cookieFor, apply } = await setup({ VERCEL: "1" });
    const res = await post(
      makeConfigPost(deps),
      { set: { GEMINI_API_KEY: "a" } },
      { "content-type": "application/json", cookie: await cookieFor("hai") },
    );
    expect(res.status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
  });
});
