import { describe, expect, it, vi } from "vitest";
import { BcryptPasswordHasher } from "@/server/auth/PasswordHasher";
import { UserAdminController } from "@/server/users/UserAdminController";
import { makeUsersGet, makeUsersPost } from "@/server/users/userRoutes";
import { makeTestAuth } from "../helpers";

const HASH = "$2b$04$abcdefghijklmnopqrstuuJ0123456789abcdefghijklmnopqrstu";
const APP_USERS = Buffer.from(
  JSON.stringify([
    { username: "hai", passwordHash: HASH, displayName: "Hải", role: "admin" },
    { username: "lan", passwordHash: HASH, displayName: "Lan" },
  ]),
).toString("base64");

async function setup(extraEnv: Record<string, string> = {}) {
  const t = await makeTestAuth();
  const apply = vi.fn(async () => {});
  const env: Record<string, string | undefined> = { APP_USERS, ...extraEnv };
  const users = new UserAdminController({ writer: { apply }, env, hasher: new BcryptPasswordHasher(4), onApplied: () => {} });
  const deps = () => ({ auth: t.auth, users });
  return { ...t, deps, apply, env };
}

async function post(handler: (r: Request) => Promise<Response>, body: unknown, headers: Record<string, string>) {
  return handler(
    new Request("http://localhost:3100/api/users", {
      method: "POST",
      headers: { host: "localhost:3100", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const json = { "content-type": "application/json", origin: "http://localhost:3100" };

describe("GET /api/users", () => {
  it("chưa đăng nhập: 401", async () => {
    const { deps } = await setup();
    expect((await makeUsersGet(deps)(new Request("http://localhost/api/users"))).status).toBe(401);
  });

  it("user thường: 403", async () => {
    const { deps, cookieFor } = await setup();
    const res = await makeUsersGet(deps)(new Request("http://localhost/api/users", { headers: { cookie: await cookieFor("lan") } }));
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("hai");
  });

  it("admin: 200, no-store, không lộ hash", async () => {
    const { deps, cookieFor } = await setup();
    const res = await makeUsersGet(deps)(new Request("http://localhost/api/users", { headers: { cookie: await cookieFor("hai") } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const text = await res.text();
    expect(text).not.toContain("$2");
    expect(text).not.toContain("passwordHash");
    expect(JSON.parse(text).users).toHaveLength(2);
  });
});

describe("POST /api/users", () => {
  it("chưa đăng nhập: 401, không ghi", async () => {
    const { deps, apply } = await setup();
    const res = await post(makeUsersPost(deps), { action: "remove", username: "lan" }, json);
    expect(res.status).toBe(401);
    expect(apply).not.toHaveBeenCalled();
  });

  it("user thường: 403, không ghi", async () => {
    const { deps, cookieFor, apply } = await setup();
    const res = await post(makeUsersPost(deps), { action: "remove", username: "hai" }, { ...json, cookie: await cookieFor("lan") });
    expect(res.status).toBe(403);
    expect(apply).not.toHaveBeenCalled();
  });

  it("admin thêm tài khoản: 200, no-store, không lộ mật khẩu hay hash", async () => {
    const { deps, cookieFor, apply } = await setup();
    const res = await post(
      makeUsersPost(deps),
      { action: "add", username: "minh", displayName: "Minh", password: "BIMAT-123456", role: "user" },
      { ...json, cookie: await cookieFor("hai") },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const text = await res.text();
    expect(text).not.toContain("BIMAT-123456");
    expect(text).not.toContain("$2");
    expect(JSON.parse(text).users).toHaveLength(3);
    expect(apply).toHaveBeenCalledOnce();
  });

  it("admin tự xoá mình: 403", async () => {
    const { deps, cookieFor, apply } = await setup();
    const res = await post(makeUsersPost(deps), { action: "remove", username: "hai" }, { ...json, cookie: await cookieFor("hai") });
    expect(res.status).toBe(403);
    expect(apply).not.toHaveBeenCalled();
  });

  it("không phải application/json: 400", async () => {
    const { deps, cookieFor, apply } = await setup();
    const res = await post(
      makeUsersPost(deps),
      { action: "remove", username: "lan" },
      { "content-type": "text/plain", cookie: await cookieFor("hai") },
    );
    expect(res.status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
  });

  it("Origin khác host: 400", async () => {
    const { deps, cookieFor, apply } = await setup();
    const res = await post(
      makeUsersPost(deps),
      { action: "remove", username: "lan" },
      { "content-type": "application/json", origin: "https://evil.example", cookie: await cookieFor("hai") },
    );
    expect(res.status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
  });

  it("JSON hỏng hoặc action lạ: 400", async () => {
    const { deps, cookieFor } = await setup();
    const cookie = await cookieFor("hai");
    expect((await post(makeUsersPost(deps), "{hong", { ...json, cookie })).status).toBe(400);
    expect((await post(makeUsersPost(deps), { action: "xoaHet" }, { ...json, cookie })).status).toBe(400);
  });

  it("Vercel: không ghi, trả chuỗi APP_USERS để chép", async () => {
    const { deps, cookieFor, apply } = await setup({ VERCEL: "1" });
    const res = await post(makeUsersPost(deps), { action: "remove", username: "lan" }, { ...json, cookie: await cookieFor("hai") });
    expect(res.status).toBe(200);
    expect(apply).not.toHaveBeenCalled();
    const body = JSON.parse(await res.text());
    expect(typeof body.appUsers).toBe("string");
    expect(body.readOnlyReason).toContain("Vercel");
  });
});
