import { describe, expect, it } from "vitest";
import { BrandKit, type BrandFieldSpec } from "@/domain/BrandKit";
import { ValidationError } from "@/domain/errors";

const specs: BrandFieldSpec[] = [
  { key: "channelName", label: "Tên kênh", type: "text", required: true, maxLength: 24 },
  { key: "primaryColor", label: "Màu chủ đạo", type: "color", required: true, defaultValue: "#1F9D55" },
  { key: "logo", label: "Logo", type: "image", required: false },
  { key: "size", label: "Cỡ chữ", type: "number", required: false, defaultValue: "64", min: 44, max: 80 },
];

describe("BrandKit", () => {
  it("lấy giá trị mặc định khi bỏ trống", () => {
    const kit = BrandKit.create("theanh28", specs, { channelName: " 2NV News " });
    expect(kit.get("channelName")).toBe("2NV News");
    expect(kit.get("primaryColor")).toBe("#1F9D55");
    expect(kit.get("logo")).toBeUndefined();
    expect(kit.get("size")).toBe("64");
  });

  it("báo lỗi khi thiếu trường bắt buộc", () => {
    expect(() => BrandKit.create("theanh28", specs, {})).toThrow("Thiếu Tên kênh");
  });

  it("kiểm màu dạng #RRGGBB và độ dài chữ", () => {
    expect(() => BrandKit.create("theanh28", specs, { channelName: "A", primaryColor: "green" })).toThrow(
      ValidationError,
    );
    expect(() => BrandKit.create("theanh28", specs, { channelName: "x".repeat(25) })).toThrow(ValidationError);
  });

  it("bỏ qua khoá không khai báo, toJSON chỉ chứa giá trị có", () => {
    const kit = BrandKit.create("theanh28", specs, { channelName: "A", hacker: "x" });
    expect(kit.toJSON()).toEqual({
      templateId: "theanh28",
      values: { channelName: "A", primaryColor: "#1F9D55", size: "64" },
    });
  });

  it("trường số: nhận số nguyên trong khoảng và chuẩn hoá", () => {
    expect(BrandKit.create("theanh28", specs, { channelName: "A", size: " 52 " }).get("size")).toBe("52");
    expect(BrandKit.create("theanh28", specs, { channelName: "A", size: "044" }).get("size")).toBe("44");
  });

  it("trường số: báo lỗi khi ngoài khoảng hoặc không phải số nguyên", () => {
    for (const bad of ["43", "81", "abc", "52.5", "1e1"]) {
      expect(() => BrandKit.create("theanh28", specs, { channelName: "A", size: bad })).toThrow(
        "Cỡ chữ phải là số từ 44 đến 80",
      );
    }
  });
});
