import { describe, expect, it } from "vitest";
import { sourceTimeFor } from "@/client/media/sourceTime";

describe("sourceTimeFor", () => {
  it("ảnh luôn lấy khung 0, nền dự phòng không có khung", () => {
    expect(sourceTimeFor({ mode: "still" }, 3)).toBe(0);
    expect(sourceTimeFor({ mode: "none" }, 3)).toBeNull();
  });
  it("video dài hơn cảnh: theo thời gian cảnh, không vượt cuối video", () => {
    expect(sourceTimeFor({ mode: "clip", sourceDurationSec: 5 }, 2)).toBe(2);
    expect(sourceTimeFor({ mode: "clip", sourceDurationSec: 5 }, 9)).toBeCloseTo(4.999, 6);
  });
  it("video ngắn hơn cảnh: lặp lại", () => {
    expect(sourceTimeFor({ mode: "loop", sourceDurationSec: 4 }, 5)).toBeCloseTo(1, 6);
    expect(sourceTimeFor({ mode: "loop", sourceDurationSec: 0 }, 5)).toBe(0);
  });
});

describe("sourceTimeFor — mốc đầu và ảnh tĩnh tại giây", () => {
  it("startSec cộng vào mọi chế độ; stillAtSec chọn giây của ảnh tĩnh", () => {
    expect(sourceTimeFor({ mode: "clip", sourceDurationSec: 8, startSec: 0.5 }, 2)).toBe(2.5);
    expect(sourceTimeFor({ mode: "clip", sourceDurationSec: 8, startSec: 0.5 }, 9)).toBeCloseTo(8.499, 9);
    expect(sourceTimeFor({ mode: "still", startSec: 0.5, stillAtSec: 1 }, 3)).toBe(1.5);
    expect(sourceTimeFor({ mode: "still" }, 3)).toBe(0);
  });
});
