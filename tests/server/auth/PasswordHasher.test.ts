import { describe, expect, it } from "vitest";
import { BcryptPasswordHasher } from "@/server/auth/PasswordHasher";

describe("BcryptPasswordHasher", () => {
  it("băm rồi kiểm đúng mật khẩu", async () => {
    const hasher = new BcryptPasswordHasher(4);
    const hash = await hasher.hash("matkhau-dai-123");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await hasher.verify("matkhau-dai-123", hash)).toBe(true);
    expect(await hasher.verify("sai", hash)).toBe(false);
  });
});
