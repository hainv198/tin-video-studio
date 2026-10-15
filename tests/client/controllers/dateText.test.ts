import { describe, expect, it } from "vitest";
import { fromDateInput, toDateInput } from "@/client/controllers/dateText";

describe("dateText", () => {
  it("đi lại yyyy-mm-dd theo giờ địa phương", () => {
    expect(toDateInput(new Date(2026, 9, 14))).toBe("2026-10-14");
    const d = fromDateInput("2026-01-05");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 0, 5]);
  });

  it("từ chối ngày sai", () => {
    for (const bad of ["", "2026-13-01", "2026-02-30", "14/10/2026", "abc"]) {
      expect(() => fromDateInput(bad)).toThrow("Ngày đăng không hợp lệ");
    }
  });
});
