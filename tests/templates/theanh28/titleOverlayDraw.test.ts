import { describe, expect, it } from "vitest";
import { BrandKit } from "@/domain/BrandKit";
import { BANNER_LAYOUT } from "@/templates/theanh28/bannerLayout";
import { LAYOUT, type TheAnh28Layout } from "@/templates/theanh28/layout";
import { TheAnh28BannerTemplate } from "@/templates/theanh28/TheAnh28BannerTemplate";
import { TheAnh28Template } from "@/templates/theanh28/TheAnh28Template";
import { SOURCE_CLIP_MEDIA, type DrawableImage, type ProjectFrame, type SceneFrame } from "@/templates/VideoTemplate";
import { RecordingCanvas, type DrawCall } from "../../helpers/RecordingCanvas";

const frame: DrawableImage = { source: { tag: "video" } as unknown as CanvasImageSource, width: 1920, height: 1080 };
const cases: Array<[TheAnh28Template, TheAnh28Layout, number]> = [
  [new TheAnh28Template(), LAYOUT, 1600], // đáy vùng an toàn TikTok
  [new TheAnh28BannerTemplate(), BANNER_LAYOUT, 1560], // đỉnh dải banner
];
const project = (t: TheAnh28Template): ProjectFrame => ({
  displayTitle: "Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã vì lạm quyền, tự ý bán trụ sở làm việc",
  sourceCredit: "Đức Phong - VietNamNet",
  publishDateText: "14/10/2026",
  brand: BrandKit.create(t.id, t.brandFields, { channelName: "28 News" }),
  logo: null,
  mediaCredit: "VIDEO: TỔNG HỢP",
});
const scene = (sceneTime: number, withOverlay = true): SceneFrame => ({
  role: "body",
  text: "",
  image: frame,
  sceneTime,
  sceneDuration: 8,
  footageTime: sceneTime,
  footageDuration: 8,
  voiceStart: 0.3,
  voiceDuration: 2.35,
  media: SOURCE_CLIP_MEDIA,
  ...(withOverlay ? { titleOverlay: { collapseAtSec: 3 } } : {}),
});
const draw = (t: TheAnh28Template, s: SceneFrame) => {
  const c = new RecordingCanvas();
  t.drawFrame(c.asCanvas(), project(t), s);
  return c;
};
const titleCalls = (c: RecordingCanvas, L: TheAnh28Layout) =>
  c.ops("fillText").filter((x) => x.state.font.startsWith(`800 ${L.titleOverlay.title.fontPx}px`));
const fontPx = (c: DrawCall) => Number(/(\d+(?:\.\d+)?)px/.exec(c.state.font)?.[1] ?? 0);

describe("Khối tiêu đề đè dưới video", () => {
  for (const [t, L, safeBottom] of cases) {
    it(`${t.id}: lúc đang đọc có chip tên kênh, ngày đăng, tiêu đề in hoa; vẫn có logo góc và dòng nguồn`, () => {
      const c = draw(t, scene(1.5));
      const titles = titleCalls(c, L);
      expect(titles.length).toBeGreaterThanOrEqual(2);
      expect(titles[0]?.args.slice(0, 3)).toEqual([titles[0]?.args[0], L.titleOverlay.title.x, L.titleOverlay.title.y]);
      expect(titles.map((x) => String(x.args[0])).join(" ")).toMatch(/^PHÚ THỌ: KHỞI TỐ NGUYÊN/);
      expect(c.texts().filter((s) => s === "28 NEWS")).toHaveLength(2); // chip + góc phải
      expect(c.texts().filter((s) => s === "NGÀY ĐĂNG: 14/10/2026")).toHaveLength(2); // thân bài (bị khối che) + khối
      expect(c.texts()).toEqual(expect.arrayContaining(["THEO: ĐỨC PHONG - VIETNAMNET", "VIDEO: TỔNG HỢP"]));
      const bottoms = c.calls.filter((x) => x.op === "fillText").map((x) => Number(x.args[2]) + fontPx(x));
      expect(Math.max(...bottoms)).toBeLessThanOrEqual(safeBottom);
      expect(titles.every((x) => x.state.globalAlpha === 1)).toBe(true);
    });

    it(`${t.id}: giữa lúc thu gọn (mốc + 0,2 s) khối trượt xuống nửa quãng và mờ 50 %`, () => {
      const c = draw(t, scene(3.2));
      const first = titleCalls(c, L)[0];
      const shift = (L.titleOverlay.bottom - L.titleOverlay.gradientTop) * 0.5;
      expect(Number(first?.args[2])).toBeCloseTo(L.titleOverlay.title.y + shift, 6);
      expect(first?.state.globalAlpha).toBeCloseTo(0.5, 6);
      expect(c.ops("rect").some((x) => x.args.join() === `0,0,1080,${L.titleOverlay.bottom}`)).toBe(true);
    });

    it(`${t.id}: thu gọn xong thì khung y hệt cảnh thân bài không có khối tiêu đề`, () => {
      const after = draw(t, scene(3.4));
      expect(titleCalls(after, L)).toHaveLength(0);
      expect(after.calls).toEqual(draw(t, scene(3.4, false)).calls);
      expect(after.texts().filter((s) => s === "NGÀY ĐĂNG: 14/10/2026")).toHaveLength(1);
    });

    it(`${t.id}: thuần theo thời gian`, () => {
      expect(draw(t, scene(3.13)).calls).toEqual(draw(t, scene(3.13)).calls);
    });
  }
});
