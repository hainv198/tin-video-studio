import { describe, expect, it, vi } from "vitest";
import { ApiError, type AuthApi } from "@/client/services/AuthClient";
import { SessionController, safeNextPath } from "@/client/controllers/SessionController";

const api = (impl: Partial<AuthApi>): AuthApi => ({
  login: impl.login ?? (async () => ({ username: "hai", displayName: "Hải" })),
  logout: impl.logout ?? (async () => {}),
});

describe("SessionController", () => {
  it("đăng nhập thành công: submitting rồi done, báo cho người nghe", async () => {
    const c = new SessionController(api({}));
    const seen: string[] = [];
    c.subscribe(() => seen.push(c.state.status));
    expect(await c.login("hai", "x")).toBe(true);
    expect(seen).toEqual(["submitting", "done"]);
    expect(c.state).toEqual({ status: "done", displayName: "Hải" });
  });

  it("sai mật khẩu: hiện thông báo của server", async () => {
    const c = new SessionController(
      api({
        login: async () => {
          throw new ApiError(401, "AUTH", "Sai tên đăng nhập hoặc mật khẩu");
        },
      }),
    );
    expect(await c.login("hai", "x")).toBe(false);
    expect(c.state).toEqual({ status: "error", message: "Sai tên đăng nhập hoặc mật khẩu" });
  });

  it("lỗi mạng: thông báo chung", async () => {
    const c = new SessionController(
      api({
        login: async () => {
          throw new TypeError("Failed to fetch");
        },
      }),
    );
    await c.login("hai", "x");
    expect(c.state).toEqual({ status: "error", message: "Không kết nối được máy chủ, thử lại sau" });
  });

  it("bỏ trống thì báo lỗi, không gọi API", async () => {
    const login = vi.fn();
    const c = new SessionController(api({ login }));
    expect(await c.login("  ", "")).toBe(false);
    expect(login).not.toHaveBeenCalled();
    expect(c.state).toEqual({ status: "error", message: "Nhập tên đăng nhập và mật khẩu" });
  });

  it("huỷ đăng ký người nghe", async () => {
    const c = new SessionController(api({}));
    const listener = vi.fn();
    const off = c.subscribe(listener);
    off();
    await c.login("hai", "x");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("safeNextPath", () => {
  it("chỉ nhận đường dẫn nội bộ, còn lại về /studio", () => {
    expect(safeNextPath(null)).toBe("/studio");
    expect(safeNextPath("")).toBe("/studio");
    expect(safeNextPath("/studio/x?a=1#h")).toBe("/studio/x?a=1#h");
    expect(safeNextPath("//evil.example")).toBe("/studio");
    expect(safeNextPath("/\\evil")).toBe("/studio");
    expect(safeNextPath("/\t/evil.example")).toBe("/studio");
    expect(safeNextPath("/\n/evil.example")).toBe("/studio");
    expect(safeNextPath("/\r/evil.example")).toBe("/studio");
    expect(safeNextPath("https://evil.example")).toBe("/studio");
    expect(safeNextPath("/")).toBe("/");
  });
});
