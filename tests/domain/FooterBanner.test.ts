import { describe, expect, it } from "vitest";
import { ValidationError } from "@/domain/errors";
import { checkFooterBanner, FOOTER_BANNER_LIMITS } from "@/domain/FooterBanner";

describe("checkFooterBanner", () => {
  it("nhận ảnh ngang tỉ lệ 2–5, rộng ≥ 720 (banner mặc định 2048×682 hợp lệ)", () => {
    expect(() => checkFooterBanner(2048, 682)).not.toThrow();
    expect(() => checkFooterBanner(1080, 360)).not.toThrow();
    expect(() => checkFooterBanner(1440, 720)).not.toThrow(); // đúng 2
    expect(() => checkFooterBanner(2500, 500)).not.toThrow(); // đúng 5
    expect(FOOTER_BANNER_LIMITS).toEqual({ maxBytes: 5 * 1024 * 1024, minWidth: 720, minRatio: 2, maxRatio: 5 });
  });

  it("ảnh vuông/dọc hoặc quá dài bị từ chối, câu báo có tỉ lệ thật", () => {
    expect(() => checkFooterBanner(800, 800)).toThrow(
      "Banner phải là ảnh ngang, tỉ lệ rộng/cao từ 2 đến 5 (ảnh này 1,00). Khuyên dùng 3:1, ví dụ 2048×682.",
    );
    expect(() => checkFooterBanner(3000, 500)).toThrow(/ảnh này 6,00/);
    expect(() => checkFooterBanner(800, 800)).toThrow(ValidationError);
  });

  it("ảnh quá nhỏ hoặc kích thước hỏng bị từ chối", () => {
    expect(() => checkFooterBanner(600, 200)).toThrow("Banner quá nhỏ: cần rộng ít nhất 720 px (ảnh này 600 px)");
    expect(() => checkFooterBanner(0, 100)).toThrow("Không đọc được kích thước ảnh banner");
    expect(() => checkFooterBanner(Number.NaN, 100)).toThrow("Không đọc được kích thước ảnh banner");
  });
});
