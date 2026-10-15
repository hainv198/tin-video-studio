import { describe, expect, it } from "vitest";
import { SessionService } from "@/server/auth/SessionService";
import { TEST_SECRET } from "../helpers";

describe("SessionService", () => {
  it("cấp rồi đọc lại phiên", async () => {
    const s = new SessionService(TEST_SECRET);
    const token = await s.issue({ username: "hai", displayName: "Hải" });
    expect(await s.verify(token)).toEqual({ username: "hai", displayName: "Hải" });
  });

  it("phiên hết hạn sau ttl", async () => {
    let now = Date.UTC(2026, 9, 15);
    const s = new SessionService(TEST_SECRET, 60, () => now);
    const token = await s.issue({ username: "hai", displayName: "Hải" });
    now += 61_000;
    expect(await s.verify(token)).toBeNull();
  });

  it("token sai chữ ký hoặc rỗng trả null", async () => {
    const other = new SessionService("x".repeat(32));
    const token = await other.issue({ username: "hai", displayName: "Hải" });
    expect(await new SessionService(TEST_SECRET).verify(token)).toBeNull();
    expect(await new SessionService(TEST_SECRET).verify(undefined)).toBeNull();
    expect(await new SessionService(TEST_SECRET).verify("rac")).toBeNull();
  });

  it("chặn secret ngắn", () => {
    expect(() => new SessionService("ngan")).toThrow("AUTH_SECRET phải dài ít nhất 32 ký tự");
  });
});
