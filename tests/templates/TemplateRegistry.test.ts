import { describe, expect, it } from "vitest";
import { DEFAULT_TIMELINE_CONFIG } from "@/domain/Timeline";
import { NotFoundError } from "@/domain/errors";
import { TemplateRegistry } from "@/templates/TemplateRegistry";
import { VideoTemplate } from "@/templates/VideoTemplate";

class T extends VideoTemplate {
  readonly brandFields = [];
  readonly fonts = [];
  readonly defaults = { width: 1080, height: 1920, fps: 30, timeline: DEFAULT_TIMELINE_CONFIG, fallbackKeyword: "news" };
  constructor(readonly id: string, readonly name: string) {
    super();
  }
  protected drawIntro(): void {}
  protected drawBody(): void {}
}

describe("TemplateRegistry", () => {
  it("tra theo id và liệt kê", () => {
    const r = new TemplateRegistry([new T("a", "A"), new T("b", "B")]);
    expect(r.get("b").name).toBe("B");
    expect(r.list()).toEqual([
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ]);
  });

  it("id không có ném NotFoundError, id trùng ném lỗi cấu hình", () => {
    expect(() => new TemplateRegistry([new T("a", "A")]).get("z")).toThrow(NotFoundError);
    expect(() => new TemplateRegistry([new T("a", "A"), new T("a", "B")])).toThrow("Trùng phong cách a");
  });
});
