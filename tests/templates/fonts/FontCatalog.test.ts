import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { FONT_CHOICES } from "@/domain/fontIds";
import { VideoOptions } from "@/domain/VideoOptions";
import { FONT_CATALOG, fontFacesFor, frameStyleFor } from "@/templates/fonts/FontCatalog";
import { missingCodepoints } from "../../../scripts/lib/ttfCmap";

const VIETNAMESE =
  "ẮẰẲẴẶắằẳẵặẤẦẨẪẬấầẩẫậĐđẾỀỂỄỆếềểễệỐỒỔỖỘốồổỗộỚỜỞỠỢớờởỡợỨỪỬỮỰứừửữựỲỴỶỸỳỵỷỹƠơƯưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĨĩŨũẠạẢảẸẹẺẻẼẽỈỉỊịỌọỎỏỤụỦủ";
const BASIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:./-,%";
const file = (url: string) => join(process.cwd(), "public", url);

describe("FontCatalog", () => {
  it("mỗi lựa chọn font có một mục, cùng nhãn, họ CSS riêng có tiền tố TVS", () => {
    for (const choice of FONT_CHOICES) {
      const entry = FONT_CATALOG[choice.id];
      expect(entry.id).toBe(choice.id);
      expect(entry.label).toBe(choice.label);
      expect(entry.style.family.startsWith("TVS ")).toBe(true);
      expect(entry.faces.length).toBeGreaterThan(0);
      for (const face of entry.faces) expect(face.family).toBe(entry.style.family);
    }
    expect(FONT_CATALOG["barlow-condensed"].style).toEqual({ family: "TVS Barlow Condensed", semiBold: 600, bold: 800 });
    expect(FONT_CATALOG.oswald.style.bold).toBe(700);
  });

  it("mọi tệp font có thật, là TrueType, có đủ chữ tiếng Việt; mỗi thư mục có OFL.txt", () => {
    for (const entry of Object.values(FONT_CATALOG)) {
      for (const face of entry.faces) {
        const path = file(face.url);
        expect(existsSync(path), path).toBe(true);
        expect(statSync(path).size).toBeGreaterThan(20_000);
        const bytes = new Uint8Array(readFileSync(path));
        expect([...bytes.subarray(0, 4)], path).toEqual([0, 1, 0, 0]);
        expect(missingCodepoints(bytes, VIETNAMESE + BASIC), `${entry.label} thiếu glyph`).toEqual([]);
        const ofl = join(dirname(path), "OFL.txt");
        expect(existsSync(ofl), ofl).toBe(true);
        expect(readFileSync(ofl, "utf8")).toContain("SIL Open Font License");
      }
    }
  });

  it("frameStyleFor: mặc định Barlow cho chữ, Phudu cho phụ đề, màu thumbnail theo thương hiệu", () => {
    expect(frameStyleFor(VideoOptions.defaults().snapshot())).toEqual({
      textFont: { family: "TVS Barlow Condensed", semiBold: 600, bold: 800 },
      subtitles: { enabled: true, font: { family: "TVS Phudu", semiBold: 600, bold: 800 } },
      intro: { backgroundColor: null, blockColor: null },
    });
    const custom = VideoOptions.defaults().withTextFont("oswald").withSubtitlesEnabled(false).withIntroBlock("#C0392B");
    expect(frameStyleFor(custom.snapshot())).toEqual({
      textFont: { family: "TVS Oswald", semiBold: 600, bold: 700 },
      subtitles: { enabled: false, font: { family: "TVS Phudu", semiBold: 600, bold: 800 } },
      intro: { backgroundColor: null, blockColor: "#c0392b" },
    });
  });

  it("fontFacesFor: chỉ nạp font chữ + font phụ đề khi bật, bỏ trùng", () => {
    const urls = (o: VideoOptions) => fontFacesFor(o.snapshot()).map((f) => f.url);
    expect(urls(VideoOptions.defaults())).toEqual([
      "/templates/theanh28/fonts/BarlowCondensed-SemiBold.ttf",
      "/templates/theanh28/fonts/BarlowCondensed-ExtraBold.ttf",
      "/fonts/phudu/Phudu-Variable.ttf",
    ]);
    expect(urls(VideoOptions.defaults().withSubtitlesEnabled(false))).toEqual([
      "/templates/theanh28/fonts/BarlowCondensed-SemiBold.ttf",
      "/templates/theanh28/fonts/BarlowCondensed-ExtraBold.ttf",
    ]);
    expect(urls(VideoOptions.defaults().withTextFont("phudu"))).toEqual(["/fonts/phudu/Phudu-Variable.ttf"]);
  });
});
