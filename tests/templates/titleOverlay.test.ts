import { describe, expect, it } from "vitest";
import { TITLE_COLLAPSE_SEC, titleCollapseProgress } from "@/templates/titleOverlay";

describe("titleCollapseProgress", () => {
  it("0 trước mốc, smoothstep trong 0,4 s, đúng 1 từ mốc + 0,4 s", () => {
    const o = { collapseAtSec: 3 };
    expect(TITLE_COLLAPSE_SEC).toBe(0.4);
    expect(titleCollapseProgress(0, o)).toBe(0);
    expect(titleCollapseProgress(3, o)).toBe(0);
    expect(titleCollapseProgress(3.1, o)).toBeCloseTo(0.15625, 9);
    expect(titleCollapseProgress(3.2, o)).toBeCloseTo(0.5, 9);
    expect(titleCollapseProgress(3.4, o)).toBe(1);
    expect(titleCollapseProgress(9, o)).toBe(1);
  });
});
