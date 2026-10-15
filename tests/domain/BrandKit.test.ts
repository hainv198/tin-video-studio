import { describe, expect, it } from "vitest";
import { BrandKit, type BrandFieldSpec } from "@/domain/BrandKit";
import { ValidationError } from "@/domain/errors";

const specs: BrandFieldSpec[] = [
  { key: "channelName", label: "Tên kênh", type: "text", required: true, maxLength: 24 },
  { key: "primaryColor", label: "Màu chủ đạo", type: "color", required: true, defaultValue: "#1F9D55" },
  { key: "logo", label: "Logo", type: "image", required: false },
];

describe("BrandKit", () => {
  it("lấy giá trị mặc định khi bỏ trống", () => {
    const kit = BrandKit.create("theanh28", specs, { channelName: " 2NV News " });
    expect(kit.get("channelName")).toBe("2NV News");
    expect(kit.get("primaryColor")).toBe("#1F9D55");
    expect(kit.get("logo")).toBeUndefined();
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
    expect(kit.toJSON()).toEqual({ templateId: "theanh28", values: { channelName: "A", primaryColor: "#1F9D55" } });
  });
});
