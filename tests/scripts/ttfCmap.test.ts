import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cmapLookup, missingCodepoints } from "../../scripts/lib/ttfCmap";

const barlow = new Uint8Array(readFileSync(join(process.cwd(), "public/templates/theanh28/fonts/BarlowCondensed-ExtraBold.ttf")));

describe("ttfCmap", () => {
  it("nhận ra ký tự có và không có trong font", () => {
    const has = cmapLookup(barlow);
    expect(has(0x41)).toBe(true); // A
    expect(has(0x1ec5)).toBe(true); // ễ
    expect(has(0x4e2d)).toBe(false); // 中
    expect(has(0x1f600)).toBe(false); // 😀
  });

  it("missingCodepoints trả các mã thiếu, bỏ trùng", () => {
    expect(missingCodepoints(barlow, "Aễ中中😀")).toEqual([0x4e2d, 0x1f600]);
  });

  it("tệp không phải font thì báo lỗi", () => {
    expect(() => cmapLookup(new Uint8Array(64))).toThrow("Font không có bảng cmap");
  });
});
