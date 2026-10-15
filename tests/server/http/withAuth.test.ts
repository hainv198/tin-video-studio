import { describe, expect, it } from "vitest";
import { withAuth } from "@/server/http/withAuth";
import { QuotaError } from "@/domain/errors";
import { makeTestAuth } from "../helpers";

describe("withAuth", () => {
  it("không có cookie: 401", async () => {
    const { auth } = await makeTestAuth();
    const handler = withAuth(() => auth, async () => new Response("ok"));
    const res = await handler(new Request("http://localhost/api/x"));
    expect(res.status).toBe(401);
  });

  it("có cookie hợp lệ: gọi handler kèm người dùng", async () => {
    const { auth, cookieFor } = await makeTestAuth();
    const handler = withAuth(() => auth, async (_req, user) => Response.json({ who: user.username }));
    const res = await handler(new Request("http://localhost/api/x", { headers: { cookie: `a=1; ${await cookieFor("hai")}` } }));
    expect(await res.json()).toEqual({ who: "hai" });
  });

  it("lỗi nghiệp vụ trong handler được ánh xạ mã HTTP", async () => {
    const { auth, cookieFor } = await makeTestAuth();
    const handler = withAuth(() => auth, async () => {
      throw new QuotaError("Hết hạn mức");
    });
    const res = await handler(new Request("http://localhost/api/x", { headers: { cookie: await cookieFor("hai") } }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: { code: "QUOTA", message: "Hết hạn mức" } });
  });

  it("lỗi lạ: 500 với thông báo chung", async () => {
    const { auth, cookieFor } = await makeTestAuth();
    const handler = withAuth(() => auth, async () => {
      throw new Error("bí mật nội bộ");
    });
    const res = await handler(new Request("http://localhost/api/x", { headers: { cookie: await cookieFor("hai") } }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: { code: "INTERNAL", message: "Lỗi máy chủ" } });
  });
});
