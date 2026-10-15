import { describe, expect, it } from "vitest";
import { validateAlias } from "@/server/tts/minimaxShared";

describe("validateAlias", () => {
  it("chỉ nhận chữ và số không dấu, 1–32 ký tự", () => {
    expect(validateAlias("Hai")).toBe(true);
    expect(validateAlias("Lan2")).toBe(true);
    expect(validateAlias("Hải")).toBe(false);
    expect(validateAlias("a b")).toBe(false);
    expect(validateAlias("")).toBe(false);
    expect(validateAlias("x".repeat(33))).toBe(false);
  });
});
