import { describe, expect, it } from "vitest";
import { meanAbsDiff, regionArgs } from "../../scripts/lib/frameRegion";

describe("frameRegion", () => {
  it("meanAbsDiff: trung bình chênh lệch tuyệt đối từng byte", () => {
    expect(meanAbsDiff(new Uint8Array([0, 10, 20]), new Uint8Array([0, 0, 30]))).toBeCloseTo(20 / 3, 9);
    expect(meanAbsDiff(new Uint8Array([5, 5]), new Uint8Array([5, 5]))).toBe(0);
  });

  it("meanAbsDiff: khác kích thước hoặc rỗng thì báo lỗi", () => {
    expect(() => meanAbsDiff(new Uint8Array(3), new Uint8Array(6))).toThrow("Hai vùng ảnh phải cùng kích thước");
    expect(() => meanAbsDiff(new Uint8Array(0), new Uint8Array(0))).toThrow("Hai vùng ảnh phải cùng kích thước");
  });

  it("regionArgs: tua tới giây t, cắt vùng, xuất RGB24 thô ra stdout", () => {
    expect(regionArgs("a.mp4", 10, { x: 130, y: 1464, w: 820, h: 136 })).toEqual([
      "-v", "error", "-ss", "10", "-i", "a.mp4", "-frames:v", "1",
      "-vf", "crop=820:136:130:1464", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ]);
  });
});
