import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/domain/errors";
import { ADMIN_ONLY_MESSAGE, isAdmin, requireAdmin } from "@/server/auth/roles";

const admin = { username: "hai", displayName: "Hải", role: "admin" as const };
const plain = { username: "lan", displayName: "Lan", role: "user" as const };

describe("roles", () => {
  it("isAdmin chỉ đúng với admin", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(plain)).toBe(false);
  });

  it("requireAdmin cho admin qua, chặn user bằng ForbiddenError", () => {
    expect(() => requireAdmin(admin)).not.toThrow();
    expect(() => requireAdmin(plain)).toThrow(ForbiddenError);
    expect(() => requireAdmin(plain)).toThrow(ADMIN_ONLY_MESSAGE);
    expect(ADMIN_ONLY_MESSAGE).toBe("Chỉ quản trị viên được thay đổi cấu hình");
  });
});
