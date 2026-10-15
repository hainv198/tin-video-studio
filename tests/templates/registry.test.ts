import { describe, expect, it } from "vitest";
import { defaultTemplateRegistry } from "@/templates/registry";

describe("defaultTemplateRegistry", () => {
  it("có phong cách theanh28", () => {
    expect(defaultTemplateRegistry().list()).toEqual([{ id: "theanh28", name: "Bản tin kiểu Theanh28" }]);
  });
});
