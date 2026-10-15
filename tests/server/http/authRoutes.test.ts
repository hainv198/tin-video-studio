import { describe, expect, it } from "vitest";
import { makeLoginPost, makeLogoutPost } from "@/server/http/authRoutes";
import { makeTestAuth, TEST_PASSWORD } from "../helpers";

const post = (body: unknown) =>
  new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/auth/login", () => {
  it("đúng mật khẩu: 200 + cookie HttpOnly", async () => {
    const t = await makeTestAuth();
    const res = await makeLoginPost(() => ({ ...t, secureCookies: true }))(post({ username: "hai", password: TEST_PASSWORD }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { username: "hai", displayName: "Hải" } });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^tvs_session=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure$/);
  });

  it("sai mật khẩu: 401, không có cookie", async () => {
    const t = await makeTestAuth();
    const res = await makeLoginPost(() => ({ ...t, secureCookies: false }))(post({ username: "hai", password: "x" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.json()).toEqual({ error: { code: "AUTH", message: "Sai tên đăng nhập hoặc mật khẩu" } });
  });

  it("body không phải JSON: 400", async () => {
    const t = await makeTestAuth();
    const req = new Request("http://localhost/api/auth/login", { method: "POST", body: "rác" });
    expect((await makeLoginPost(() => ({ ...t, secureCookies: false }))(req)).status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  it("xoá cookie", async () => {
    const t = await makeTestAuth();
    const res = await makeLogoutPost(() => ({ ...t, secureCookies: false }))(
      new Request("http://localhost/api/auth/logout", { method: "POST" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBe("tvs_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  });
});
