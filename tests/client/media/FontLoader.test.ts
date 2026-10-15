import { describe, expect, it } from "vitest";
import { loadFonts } from "@/client/media/FontLoader";

describe("loadFonts", () => {
  it("tạo FontFace theo URL tuyệt đối, chờ nạp xong rồi thêm vào tập font", async () => {
    const made: string[] = [];
    const added: string[] = [];
    const createFace = (family: string, source: string, d: FontFaceDescriptors) => {
      made.push(`${family}|${source}|${d.weight}`);
      return { load: async () => ({ family }) } as unknown as FontFace;
    };
    await loadFonts(
      [
        { family: "F", url: "/a.ttf", weight: "600" },
        { family: "F", url: "/b.ttf", weight: "800" },
      ],
      { add: (f) => added.push(String((f as unknown as { load: unknown }).load !== undefined)) },
      "http://localhost:3100",
      createFace,
    );
    expect(made).toEqual(['F|url("http://localhost:3100/a.ttf")|600', 'F|url("http://localhost:3100/b.ttf")|800']);
    expect(added).toHaveLength(2);
  });
});
