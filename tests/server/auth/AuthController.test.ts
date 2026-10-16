import { describe, expect, it } from "vitest";
import { AuthError, ValidationError } from "@/domain/errors";
import { makeTestAuth, TEST_PASSWORD } from "../helpers";

describe("AuthController", () => {
  it("đăng nhập đúng trả token và người dùng", async () => {
    const { auth } = await makeTestAuth();
    const result = await auth.login({ username: "HAI", password: TEST_PASSWORD });
    expect(result.user).toEqual({ username: "hai", displayName: "Hải" });
    expect(result.token.split(".")).toHaveLength(3);
  });

  it("sai mật khẩu hoặc sai tài khoản ném AuthError", async () => {
    const { auth } = await makeTestAuth();
    await expect(auth.login({ username: "hai", password: "sai" })).rejects.toBeInstanceOf(AuthError);
    await expect(auth.login({ username: "ai-do", password: TEST_PASSWORD })).rejects.toBeInstanceOf(AuthError);
  });

  it("dữ liệu thiếu ném ValidationError", async () => {
    const { auth } = await makeTestAuth();
    await expect(auth.login({ username: "hai" })).rejects.toBeInstanceOf(ValidationError);
    await expect(auth.login(null)).rejects.toBeInstanceOf(ValidationError);
  });

  it("authenticate chấp nhận phiên hợp lệ, từ chối tài khoản đã bị xoá", async () => {
    const { auth, sessions } = await makeTestAuth();
    const token = await sessions.issue({ username: "hai", displayName: "Hải" });
    expect((await auth.authenticate(token)).username).toBe("hai");
    expect((await auth.authenticate(token)).role).toBe("admin");
    const ghost = await sessions.issue({ username: "da-xoa", displayName: "X" });
    await expect(auth.authenticate(ghost)).rejects.toThrow("Phiên đăng nhập đã hết hạn");
  });

  it("authenticate lấy role từ danh bạ mỗi lần, không từ token", async () => {
    const { auth, sessions } = await makeTestAuth();
    const lan = await sessions.issue({ username: "lan", displayName: "Lan" });
    expect((await auth.authenticate(lan)).role).toBe("user");
  });
});
