import { describe, expect, it } from "vitest";
import { buildEntry } from "../../scripts/lib/userEntry";

const hasher = { hash: async (p: string) => `$2b$04$${p}` };

describe("buildEntry", () => {
  it("không chỉ định role thì không có trường role", async () => {
    const e = await buildEntry(["Hai", "Hải", "matkhau123"], hasher);
    expect(e).toEqual({ username: "hai", passwordHash: "$2b$04$matkhau123", displayName: "Hải" });
    expect("role" in e!).toBe(false);
  });

  it("chỉ định admin hoặc user thì in role", async () => {
    expect((await buildEntry(["hai", "Hải", "matkhau123", "admin"], hasher))?.role).toBe("admin");
    expect((await buildEntry(["lan", "Lan", "matkhau123", "user"], hasher))?.role).toBe("user");
  });

  it("từ chối role lạ, thiếu tham số hoặc mật khẩu ngắn", async () => {
    expect(await buildEntry(["hai", "Hải", "matkhau123", "root"], hasher)).toBeNull();
    expect(await buildEntry(["hai", "Hải"], hasher)).toBeNull();
    expect(await buildEntry(["hai", "Hải", "ngan"], hasher)).toBeNull();
  });
});
