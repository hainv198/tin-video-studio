import { describe, expect, it } from "vitest";
import { Scene } from "@/domain/Scene";
import { ValidationError } from "@/domain/errors";

describe("Scene", () => {
  it("chuẩn hoá khoảng trắng", () => {
    const s = Scene.create("s1", "  Câu   tin.  ", "body");
    expect(s.text).toBe("Câu tin.");
    expect(s.role).toBe("body");
  });

  it("không cho nội dung rỗng", () => {
    expect(() => Scene.create("s1", "   ", "body")).toThrow(ValidationError);
  });

  it("không cho id rỗng", () => {
    expect(() => Scene.create("", "Câu", "body")).toThrow(ValidationError);
  });

  it("withText tạo cảnh mới, giữ id và vai trò", () => {
    const a = Scene.create("s1", "Cũ.", "intro");
    const b = a.withText("Mới.");
    expect(b).not.toBe(a);
    expect(b.id).toBe("s1");
    expect(b.role).toBe("intro");
    expect(b.text).toBe("Mới.");
  });
});
