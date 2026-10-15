import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { SessionService } from "@/server/auth/SessionService";

const SECRET = "s".repeat(32);
const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined);
const passesThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("proxy", () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = SECRET;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = saved;
  });

  it.each(["/dang-nhap", "/api/auth/login", "/api/auth/logout"])("%s đi qua không cần phiên", async (path) => {
    const res = await proxy(req(path));
    expect(passesThrough(res)).toBe(true);
    expect(res.status).not.toBe(401);
  });

  it("API không có cookie: 401 JSON", async () => {
    const res = await proxy(req("/api/tts/voices"));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("AUTH");
  });

  it("trang không có cookie: chuyển về đăng nhập kèm next", async () => {
    const res = await proxy(req("/studio"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/dang-nhap\?next=%2Fstudio$/);
  });

  it("có cookie hợp lệ: đi qua", async () => {
    const token = await new SessionService(SECRET).issue({ username: "hai", displayName: "Hải" });
    const res = await proxy(req("/studio", `${SessionService.COOKIE}=${token}`));
    expect(passesThrough(res)).toBe(true);
  });
});
