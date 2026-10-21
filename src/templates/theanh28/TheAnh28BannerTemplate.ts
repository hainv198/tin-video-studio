import type { Canvas2D } from "../Canvas2D";
import type { DrawableImage, FooterBannerSpec, ProjectFrame, SceneFrame } from "../VideoTemplate";
import { BANNER_LAYOUT, FOOTER_BANNER_BOX } from "./bannerLayout";
import { coverRect } from "./layout";
import type { BrandFieldSpec } from "@/domain/BrandKit";
import { THEANH28_BRAND_FIELDS, TheAnh28Template } from "./TheAnh28Template";

export const THEANH28_BANNER_ID = "theanh28-banner";
export const DEFAULT_FOOTER_BANNER_URL = "/templates/theanh28-banner/banner-chan-video.png";

/** Theanh28 + banner chân 1080×360: nội dung dời lên trên y = 1560, banner hiện suốt video (cả thẻ đầu). */
export class TheAnh28BannerTemplate extends TheAnh28Template {
  readonly id: string = THEANH28_BANNER_ID;
  readonly name: string = "Bản tin Theanh28 + banner chân";
  readonly brandFields: readonly BrandFieldSpec[] = [
    ...THEANH28_BRAND_FIELDS,
    { key: "banner", label: "Banner chân video", type: "image", required: false },
  ];
  readonly brandFallbackId: string | null = "theanh28";
  readonly footerBanner: FooterBannerSpec | null = { defaultUrl: DEFAULT_FOOTER_BANNER_URL, box: FOOTER_BANNER_BOX };

  constructor() {
    super(BANNER_LAYOUT);
  }

  drawFrame(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void {
    super.drawFrame(ctx, project, scene);
    this.drawFooterBanner(ctx, project.banner ?? null);
  }

  /** Banner phủ kín dải (cover, căn giữa, cắt phần thừa). Chưa có ảnh thì tô đen để bố cục không đổi. */
  private drawFooterBanner(ctx: Canvas2D, banner: DrawableImage | null): void {
    const B = FOOTER_BANNER_BOX;
    ctx.save();
    if (banner) {
      const r = coverRect(banner.width, banner.height, B);
      ctx.beginPath();
      ctx.rect(B.x, B.y, B.w, B.h);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(banner.source, r.x, r.y, r.w, r.h);
    } else {
      ctx.fillStyle = "#000000";
      ctx.fillRect(B.x, B.y, B.w, B.h);
    }
    ctx.restore();
  }
}
