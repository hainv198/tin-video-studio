import { describe, expect, it } from "vitest";
import { UserDirectory } from "@/server/auth/UserDirectory";

const HASH = "$2b$04$abcdefghijklmnopqrstuuJ0123456789abcdefghijklmnopqrstu";
const user = (username: string) => ({ username, passwordHash: HASH, displayName: `Tên ${username}` });
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8").toString("base64");

describe("UserDirectory.fromEnv", () => {
  it("đọc base64 của JSON", () => {
    const dir = UserDirectory.fromEnv(b64([user("hai"), user("lan")]));
    expect(dir.size).toBe(2);
    expect(dir.find("hai")?.displayName).toBe("Tên hai");
  });

  it("đọc JSON thô bắt đầu bằng [", () => {
    expect(UserDirectory.fromEnv(JSON.stringify([user("hai")])).size).toBe(1);
  });

  it("tìm không phân biệt hoa thường và khoảng trắng", () => {
    expect(UserDirectory.fromEnv(b64([user("hai")])).find("  HAI ")?.username).toBe("hai");
  });

  it("chặn quá 5 tài khoản", () => {
    const six = ["a1a", "b2b", "c3c", "d4d", "e5e", "f6f"].map(user);
    expect(() => UserDirectory.fromEnv(b64(six))).toThrow("APP_USERS tối đa 5 tài khoản");
  });

  it("chặn trùng tên đăng nhập", () => {
    expect(() => UserDirectory.fromEnv(b64([user("hai"), user("hai")]))).toThrow("APP_USERS bị trùng tài khoản hai");
  });

  it("role: admin và user hợp lệ, thiếu role = user, APP_USERS cũ vẫn đọc được", () => {
    const dir = UserDirectory.fromEnv(
      b64([{ ...user("hai"), role: "admin" }, { ...user("lan"), role: "user" }, user("minh")]),
    );
    expect(dir.find("hai")?.role).toBe("admin");
    expect(dir.find("lan")?.role).toBe("user");
    expect(dir.find("minh")?.role).toBe("user");
  });

  it("role lạ là lỗi định dạng", () => {
    expect(() => UserDirectory.fromEnv(b64([{ ...user("hai"), role: "root" }]))).toThrow("APP_USERS sai định dạng");
    expect(() => UserDirectory.fromEnv(b64([{ ...user("hai"), role: "ADMIN" }]))).toThrow("APP_USERS sai định dạng");
  });

  it("báo lỗi rõ khi thiếu hoặc sai định dạng", () => {
    expect(() => UserDirectory.fromEnv(undefined)).toThrow("APP_USERS chưa được cấu hình");
    expect(() => UserDirectory.fromEnv("không-phải-base64-json")).toThrow("APP_USERS không đọc được");
    expect(() => UserDirectory.fromEnv(b64([{ username: "hai" }]))).toThrow("APP_USERS sai định dạng");
  });
});
