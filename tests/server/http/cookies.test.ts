import { describe, expect, it } from "vitest";
import { readCookie } from "@/server/http/cookies";

describe("readCookie", () => {
  it("cookie phần trăm sai định dạng: trả undefined", () => {
    const req = new Request("http://localhost/api/x", { headers: { cookie: "tvs_session=%E0%A4%A" } });
    expect(readCookie(req, "tvs_session")).toBeUndefined();
  });

  it("cookie mã hoá hợp lệ: giải mã đúng", () => {
    const req = new Request("http://localhost/api/x", { headers: { cookie: "a=1; tvs_session=x%2By" } });
    expect(readCookie(req, "tvs_session")).toBe("x+y");
  });

  it("không có header cookie: trả undefined", () => {
    const req = new Request("http://localhost/api/x");
    expect(readCookie(req, "tvs_session")).toBeUndefined();
  });
});
