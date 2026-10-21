import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BrandKit } from "@/domain/BrandKit";
import { VideoOptions } from "@/domain/VideoOptions";
import { frameStyleFor } from "@/templates/fonts/FontCatalog";
import { BANNER_LAYOUT, FOOTER_BANNER_BOX } from "@/templates/theanh28/bannerLayout";
import { DEFAULT_FOOTER_BANNER_URL, TheAnh28BannerTemplate } from "@/templates/theanh28/TheAnh28BannerTemplate";
import { TheAnh28Template } from "@/templates/theanh28/TheAnh28Template";
import { coverRect, LAYOUT } from "@/templates/theanh28/layout";
import { SOURCE_CLIP_MEDIA, type DrawableImage, type ProjectFrame, type SceneFrame } from "@/templates/VideoTemplate";
import { RecordingCanvas, type DrawCall } from "../../helpers/RecordingCanvas";

const t = new TheAnh28BannerTemplate();
const photo: DrawableImage = { source: { tag: "img" } as unknown as CanvasImageSource, width: 1600, height: 900 };
const banner: DrawableImage = { source: { tag: "banner" } as unknown as CanvasImageSource, width: 2048, height: 682 };
const LONG =
  "Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã vì lạm quyền, tự ý bán trụ sở làm việc và nhiều sai phạm nghiêm trọng khác";

const project = (over: Partial<ProjectFrame> = {}): ProjectFrame => ({
  displayTitle: LONG,
  sourceCredit: "Đức Phong - VietNamNet",
  publishDateText: "14/10/2026",
  brand: BrandKit.create(t.id, t.brandFields, { channelName: "28 News", titleFontPx: "80" }),
  logo: null,
  banner,
  style: frameStyleFor(VideoOptions.defaults().snapshot()), // phụ đề bật
  ...over,
});
const scene = (over: Partial<SceneFrame> = {}): SceneFrame => ({
  role: "body",
  text: LONG,
  image: photo,
  sceneTime: 0,
  sceneDuration: 4,
  ...over,
});
const draw = (tpl: TheAnh28Template, p: ProjectFrame, s: SceneFrame) => {
  const c = new RecordingCanvas();
  tpl.drawFrame(c.asCanvas(), p, s);
  return c;
};
const fontPx = (c: DrawCall) => Number(/(\d+(?:\.\d+)?)px/.exec(c.state.font)?.[1] ?? 0);
/** Đáy (bảo thủ) của mọi dòng chữ: y + cỡ chữ (với baseline "middle" còn dư nửa cỡ chữ). */
const textBottoms = (c: RecordingCanvas) =>
  c.calls.filter((x) => x.op === "fillText" || x.op === "strokeText").map((x) => Number(x.args[2]) + fontPx(x));
const isBannerRect = (x: DrawCall) =>
  x.args[0] === FOOTER_BANNER_BOX.x && x.args[1] === FOOTER_BANNER_BOX.y && x.args[2] === FOOTER_BANNER_BOX.w && x.args[3] === FOOTER_BANNER_BOX.h;

describe("TheAnh28BannerTemplate — khai báo", () => {
  it("id, tên, cùng trường thương hiệu và font với Theanh28, có banner mặc định", () => {
    expect(t.id).toBe("theanh28-banner");
    expect(t.name).toBe("Bản tin Theanh28 + banner chân");
    expect(t.fonts).toEqual(new TheAnh28Template().fonts);
    expect(t.defaults).toMatchObject({ width: 1080, height: 1920, fps: 30, fallbackKeyword: "news" });
    expect(t.footerBanner).toEqual({ defaultUrl: DEFAULT_FOOTER_BANNER_URL, box: FOOTER_BANNER_BOX });
    expect(existsSync(join(process.cwd(), "public", DEFAULT_FOOTER_BANNER_URL))).toBe(true);
  });

  it("phong cách cũ không có banner; bố cục mặc định vẫn là LAYOUT", () => {
    expect(new TheAnh28Template().footerBanner).toBeNull();
    expect(new TheAnh28Template().id).toBe("theanh28");
  });

  it("bố cục banner: khung thân bài, phụ đề, hoa văn đều kết thúc trên dải banner", () => {
    const L = BANNER_LAYOUT;
    expect(FOOTER_BANNER_BOX).toEqual({ x: 0, y: 1560, w: 1080, h: 360 });
    expect(L.body.band.y + L.body.band.h).toBeLessThanOrEqual(1560);
    expect(L.subtitle.bodyBottom).toBeLessThanOrEqual(1560);
    expect(L.intro.pattern.y + L.intro.pattern.h).toBeLessThanOrEqual(1560);
    expect(L.frame).toEqual(LAYOUT.frame);
  });
});

describe("TheAnh28BannerTemplate — mọi nội dung nằm trên y = 1560", () => {
  for (const role of ["intro", "body"] as const) {
    it(`${role}: chữ (cả tiêu đề 80 px, phụ đề) có đáy ≤ 1560; khung cắt ảnh không xuống dải banner`, () => {
      const c = draw(t, project(), scene({ role, sceneTime: 1 }));
      expect(c.texts().length).toBeGreaterThan(3);
      expect(Math.max(...textBottoms(c))).toBeLessThanOrEqual(1560);
      for (const r of c.ops("rect").filter((x) => !isBannerRect(x))) {
        expect(Number(r.args[1]) + Number(r.args[3])).toBeLessThanOrEqual(1560);
      }
    });
  }

  it("video tải lên (contain) dùng khung thân bài 1080×880 tại y = 300", () => {
    const c = draw(t, project(), scene({ text: "", media: SOURCE_CLIP_MEDIA }));
    expect(c.ops("rect").some((x) => x.args.join() === "0,300,1080,880")).toBe(true);
  });
});

describe("TheAnh28BannerTemplate — vẽ banner", () => {
  it("banner vẽ SAU CÙNG, kiểu cover vào dải 1080×360, trong vùng cắt của dải", () => {
    for (const role of ["intro", "body"] as const) {
      const c = draw(t, project(), scene({ role }));
      const images = c.ops("drawImage");
      const last = images.at(-1);
      expect(last?.args[0]).toBe(banner.source);
      const r = coverRect(2048, 682, FOOTER_BANNER_BOX);
      expect(last?.args.slice(1)).toEqual([r.x, r.y, r.w, r.h]);
      expect(Number(last?.args[2])).toBeCloseTo(1560, 6);
      expect(Number(last?.args[4])).toBeCloseTo(360, 6);
      expect(c.ops("rect").some(isBannerRect)).toBe(true);
      const lastIndex = c.calls.lastIndexOf(last as DrawCall);
      expect(c.calls.slice(lastIndex + 1).every((x) => x.op === "restore")).toBe(true);
    }
  });

  it("không có ảnh banner (null) thì tô đen dải đáy, không vẽ ảnh", () => {
    const c = draw(t, project({ banner: null }), scene());
    expect(c.ops("drawImage").some((x) => x.args[0] === banner.source)).toBe(false);
    const black = c.ops("fillRect").filter((x) => x.args.join() === "0,1560,1080,360");
    expect(black).toHaveLength(1);
    expect(black[0]?.state.fillStyle).toBe("#000000");
  });

  it("thuần theo thời gian: cùng đầu vào ra cùng chuỗi lệnh", () => {
    const a = draw(t, project(), scene({ sceneTime: 1.25 }));
    const b = draw(t, project(), scene({ sceneTime: 1.25 }));
    expect(a.calls).toEqual(b.calls);
  });

  it("phong cách cũ bỏ qua project.banner (khung cũ y hệt)", () => {
    const old = new TheAnh28Template();
    const withBanner = draw(old, project(), scene());
    const without = draw(old, project({ banner: undefined }), scene());
    expect(withBanner.calls).toEqual(without.calls);
    expect(withBanner.ops("drawImage").some((x) => x.args[0] === banner.source)).toBe(false);
  });
});
