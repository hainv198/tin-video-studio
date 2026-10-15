import type { BrandFieldSpec } from "@/domain/BrandKit";
import { DEFAULT_TIMELINE_CONFIG } from "@/domain/Timeline";
import type { Canvas2D } from "../Canvas2D";
import { VideoTemplate, type DrawableImage, type FontFaceSpec, type ProjectFrame, type SceneFrame, type TemplateDefaults } from "../VideoTemplate";
import { coverRect, kenBurnsRect, LAYOUT, withAlpha, wrapText, type Rect } from "./layout";

export const THEANH28_FONT_FAMILY = "TVS Barlow Condensed";
const DEFAULT_COLOR = "#1F9D55";
const WHITE = "#FFFFFF";

const font = (weight: number, px: number) => `${weight} ${px}px "${THEANH28_FONT_FAMILY}", "Arial Narrow", sans-serif`;
const upper = (s: string) => s.toLocaleUpperCase("vi");

export class TheAnh28Template extends VideoTemplate {
  readonly id = "theanh28";
  readonly name = "Bản tin kiểu Theanh28";

  readonly brandFields: readonly BrandFieldSpec[] = [
    { key: "channelName", label: "Tên kênh", type: "text", required: true, defaultValue: "TIN NHANH", maxLength: 24 },
    { key: "primaryColor", label: "Màu chủ đạo", type: "color", required: true, defaultValue: DEFAULT_COLOR },
    { key: "logo", label: "Logo", type: "image", required: false },
  ];

  readonly defaults: TemplateDefaults = {
    width: LAYOUT.frame.width,
    height: LAYOUT.frame.height,
    fps: 30,
    timeline: DEFAULT_TIMELINE_CONFIG,
    fallbackKeyword: "news",
  };

  readonly fonts: readonly FontFaceSpec[] = [
    { family: THEANH28_FONT_FAMILY, url: "/templates/theanh28/fonts/BarlowCondensed-SemiBold.ttf", weight: "600" },
    { family: THEANH28_FONT_FAMILY, url: "/templates/theanh28/fonts/BarlowCondensed-ExtraBold.ttf", weight: "800" },
  ];

  protected drawIntro(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void {
    const color = this.color(project);
    const { width, height } = LAYOUT.frame;
    const L = LAYOUT.intro;

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    if (scene.image) this.drawClipped(ctx, scene.image, L.image, this.progress(scene));

    const gradient = ctx.createLinearGradient(0, L.gradientTop, 0, L.gradientSolid);
    gradient.addColorStop(0, withAlpha(color, 0));
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, L.gradientTop, width, L.gradientSolid - L.gradientTop);
    ctx.fillStyle = color;
    ctx.fillRect(0, L.gradientSolid, width, height - L.gradientSolid);

    this.drawDotPattern(ctx);
    this.drawChip(ctx, project);
    this.drawDateTag(ctx, project.publishDateText, L.dateTag.x, L.dateTag.y);

    ctx.font = font(800, L.title.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const lines = wrapText(upper(project.displayTitle), L.title.maxWidth, (s) => ctx.measureText(s).width, L.title.maxLines);
    lines.forEach((line, i) => ctx.fillText(line, L.title.x, L.title.y + i * L.title.lineHeight));
  }

  protected drawBody(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void {
    const color = this.color(project);
    const { width, height } = LAYOUT.frame;
    const B = LAYOUT.body;

    if (scene.image) {
      if (scene.backdrop) {
        // nền mờ đã được thu nhỏ sẵn: phóng ra toàn khung bằng nội suy
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(scene.backdrop.source, 0, 0, width, height);
      } else {
        const full = coverRect(scene.image.width, scene.image.height, { x: 0, y: 0, w: width, h: height });
        const backdrop = kenBurnsRect(full, 1, 1, B.backdropScale);
        ctx.filter = `blur(${LAYOUT.blurPx}px)`;
        ctx.drawImage(scene.image.source, backdrop.x, backdrop.y, backdrop.w, backdrop.h);
        ctx.filter = "none";
      }
      ctx.fillStyle = `rgba(0,0,0,${B.backdropShade})`;
      ctx.fillRect(0, 0, width, height);
      this.drawClipped(ctx, scene.image, B.band, this.progress(scene));
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "#0B0F0D");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    this.drawDateTag(ctx, project.publishDateText, B.dateTag.x, B.dateTag.y);
  }

  protected drawOverlay(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void {
    const C = LAYOUT.credit;
    ctx.font = font(600, C.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const lines = project.sourceCredit ? [`THEO: ${upper(project.sourceCredit)}`, "ẢNH: TỔNG HỢP"] : ["ẢNH: TỔNG HỢP"];
    lines.forEach((line, i) => ctx.fillText(line, C.x, C.y + i * C.lineHeight));
    if (scene.role === "body") this.drawCornerLogo(ctx, project);
  }

  private color(project: ProjectFrame): string {
    return project.brand.get("primaryColor") ?? DEFAULT_COLOR;
  }

  private channelName(project: ProjectFrame): string {
    return upper(project.brand.get("channelName") ?? "TIN NHANH");
  }

  private progress(scene: SceneFrame): number {
    return scene.sceneDuration > 0 ? scene.sceneTime / scene.sceneDuration : 0;
  }

  private drawClipped(ctx: Canvas2D, image: DrawableImage, box: Rect, progress: number): void {
    const target = kenBurnsRect(coverRect(image.width, image.height, box), progress);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.drawImage(image.source, target.x, target.y, target.w, target.h);
    ctx.restore();
  }

  private drawDotPattern(ctx: Canvas2D): void {
    const P = LAYOUT.intro.pattern;
    ctx.save();
    ctx.globalAlpha = P.alpha;
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    for (let y = P.y + P.spacing / 2; y < P.y + P.h; y += P.spacing) {
      for (let x = P.x + P.spacing / 2; x < P.x + P.w; x += P.spacing) {
        ctx.rect(x - P.radius, y - P.radius, P.radius * 2, P.radius * 2);
      }
    }
    ctx.fill();
    ctx.restore();
  }

  private drawLogoBadge(ctx: Canvas2D, project: ProjectFrame, x: number, y: number, size: number): void {
    const color = this.color(project);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    if (project.logo) {
      const r = coverRect(project.logo.width, project.logo.height, { x, y, w: size, h: size });
      ctx.drawImage(project.logo.source, r.x, r.y, r.w, r.h);
    } else {
      ctx.fillStyle = WHITE;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = color;
      ctx.font = font(800, Math.round(size * 0.55));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.channelName(project).charAt(0), x + size / 2, y + size / 2);
    }
    ctx.restore();
  }

  private drawChip(ctx: Canvas2D, project: ProjectFrame): void {
    const K = LAYOUT.intro.chip;
    const name = this.channelName(project);
    ctx.font = font(800, K.fontPx);
    const textW = ctx.measureText(name).width;
    const w = K.padX + K.logoSize + K.gap + textW + K.padX;
    ctx.fillStyle = this.color(project);
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(K.x, K.y, w, K.h, K.h / 2);
    ctx.fill();
    ctx.stroke();
    this.drawLogoBadge(ctx, project, K.x + K.padX, K.y + (K.h - K.logoSize) / 2, K.logoSize);
    ctx.font = font(800, K.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(name, K.x + K.padX + K.logoSize + K.gap, K.y + K.h / 2);
  }

  private drawDateTag(ctx: Canvas2D, dateText: string, x: number, y: number): void {
    const D = LAYOUT.dateTag;
    const text = `NGÀY ĐĂNG: ${dateText}`;
    ctx.font = font(600, D.fontPx);
    const w = ctx.measureText(text).width + D.padX * 2;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, y, w, D.h);
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + D.padX, y + D.h / 2);
  }

  private drawCornerLogo(ctx: Canvas2D, project: ProjectFrame): void {
    const G = LAYOUT.logo;
    const name = this.channelName(project);
    ctx.font = font(800, G.fontPx);
    const textW = ctx.measureText(name).width;
    const textX = LAYOUT.frame.width - G.right - textW;
    this.drawLogoBadge(ctx, project, textX - G.gap - G.size, G.y, G.size);
    ctx.font = font(800, G.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(name, textX, G.y + G.size / 2);
  }
}
