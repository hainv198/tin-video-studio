import { describe, expect, it } from "vitest";
import { audioFileName, fileNameFor } from "@/client/controllers/fileName";

describe("audioFileName", () => {
  it("lấy 6 từ đầu, bỏ dấu, kebab-case, kèm ngày và đuôi", () => {
    expect(audioFileName("Tin nhanh hôm nay: Đà Nẵng mưa lớn kéo dài", new Date(2026, 9, 21), "wav")).toBe(
      "tin-nhanh-hom-nay-da-nang_20261021.wav",
    );
  });

  it("văn bản trống hoặc toàn ký hiệu thì dùng 'giong-doc'", () => {
    expect(audioFileName("  ... ", new Date(2026, 0, 2), "m4a")).toBe("giong-doc_20260102.m4a");
  });
});

describe("fileNameFor", () => {
  it("bỏ dấu, chữ thường, nối bằng gạch, kèm ngày yyyymmdd", () => {
    expect(fileNameFor("Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã", new Date(2026, 9, 14))).toBe(
      "phu-tho-khoi-to-nguyen-chu-tich-ubnd-xa_20261014.mp4",
    );
  });

  it("xử lý chữ đ/Đ", () => {
    expect(fileNameFor("Đà Nẵng đón đoàn", new Date(2026, 0, 5))).toBe("da-nang-don-doan_20260105.mp4");
  });

  it("cắt slug tối đa 60 ký tự, không để gạch ở cuối", () => {
    const name = fileNameFor("một hai ba bốn năm sáu bảy tám chín mười mười một mười hai mười ba mười bốn", new Date(2026, 0, 1));
    const slug = name.replace(/_\d{8}\.mp4$/, "");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("tiêu đề toàn ký hiệu thì dùng 'tin'", () => {
    expect(fileNameFor("!!! ???", new Date(2026, 11, 31))).toBe("tin_20261231.mp4");
  });
});
