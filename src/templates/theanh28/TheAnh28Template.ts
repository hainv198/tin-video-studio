import type { BrandFieldSpec } from "@/domain/BrandKit";
import { DEFAULT_TIMELINE_CONFIG } from "@/domain/Timeline";
import type { Canvas2D } from "../Canvas2D";
import {
  cssFont,
  VideoTemplate,
  type DrawableImage,
  type FontFaceSpec,
  type FontStyle,
  type FrameStyle,
  type ProjectFrame,
  type SceneFrame,
  type TemplateDefaults,
} from "../VideoTemplate";
import { coverRect, kenBurnsRect, LAYOUT, withAlpha, wrapText, type Rect } from "./layout";
import { cueAt, splitSubtitle, timeCues, type SubtitleCue } from "./subtitles";

export const THEANH28_FONT_FAMILY = "TVS Barlow Condensed";
const DEFAULT_COLOR = "#1F9D55";
const WHITE = "#FFFFFF";
/** Font chữ khi dự án không có tuỳ chọn riêng: giữ đúng hình ảnh trước khi có tuỳ chọn video. */
const DEFAULT_TEXT_FONT: FontStyle = { family: THEANH28_FONT_FAMILY, semiBold: 600, bold: 800 };

type Weight = "semiBold" | "bold";

const upper = (s: string) => s.toLocaleUpperCase("vi");

export class TheAnh28Template extends VideoTemplate {
  readonly id = "theanh28";
  readonly name = "Bản tin kiểu Theanh28";

  readonly brandFields: readonly BrandFieldSpec[] = [
    { key: "channelName", label: "Tên kênh", type: "text", required: true, defaultValue: "TIN NHANH", maxLength: 24 },
    { key: "primaryColor", label: "Màu chủ đạo", type: "color", required: true, defaultValue: DEFAULT_COLOR },
    { key: "logo", label: "Logo", type: "image", required: false },
    { key: "titleFontPx", label: "Cỡ chữ tiêu đề mở đầu (px, 44–80)", type: "number", required: false, defaultValue: "64", min: 44, max: 80 },
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

  /** Đoạn phụ đề đã chia, theo (font, mốc giọng, câu). Chỉ là bộ nhớ đệm: kết quả chỉ phụ thuộc đầu vào nên hàm vẽ vẫn thuần. */
  private readonly cueCache = new Map<string, SubtitleCue[]>();

  protected drawIntro(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void {
    const color = this.color(project);
    // Màu riêng của thumbnail đầu (tuỳ chọn video); không đặt thì theo màu chủ đạo thương hiệu.
    const background = project.style?.intro.backgroundColor ?? color;
    const block = project.style?.intro.blockColor ?? color;
    const { width, height } = LAYOUT.frame;
    const L = LAYOUT.intro;

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    if (scene.image) this.drawClipped(ctx, scene.image, L.image, this.progress(scene));

    const gradient = ctx.createLinearGradient(0, L.gradientTop, 0, L.gradientSolid);
    gradient.addColorStop(0, withAlpha(block, 0));
    gradient.addColorStop(1, block);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, L.gradientTop, width, L.gradientSolid - L.gradientTop);
    ctx.fillStyle = block;
    ctx.fillRect(0, L.gradientSolid, width, height - L.gradientSolid);

    this.drawDotPattern(ctx);
    this.drawChip(ctx, project);
    this.drawDateTag(ctx, project, project.publishDateText, L.dateTag.x, L.dateTag.y);

    const fontPx = Number(project.brand.get("titleFontPx") ?? L.title.fontPx);
    const lineHeight = Math.round(fontPx * (L.title.lineHeight / L.title.fontPx));
    ctx.font = this.font(project, "bold", fontPx);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const lines = wrapText(upper(project.displayTitle), L.title.maxWidth, (s) => ctx.measureText(s).width, L.title.maxLines);
    lines.forEach((line, i) => ctx.fillText(line, L.title.x, L.title.y + i * lineHeight));
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
    this.drawDateTag(ctx, project, project.publishDateText, B.dateTag.x, B.dateTag.y);
  }

  protected drawOverlay(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void {
    const C = LAYOUT.credit;
    // vùng cho phép của dòng nguồn tin: tới mép trái huy hiệu logo (cảnh thân bài) hoặc mép phải khung (cảnh mở đầu)
    const limit =
      (scene.role === "body" ? this.cornerLogoBox(ctx, project).badgeX - C.gapToLogo : LAYOUT.frame.width - C.rightMargin) -
      C.x;
    ctx.font = this.font(project, "semiBold", C.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const measure = (s: string) => ctx.measureText(s).width;
    const lines = project.sourceCredit ? [`THEO: ${upper(project.sourceCredit)}`, "ẢNH: TỔNG HỢP"] : ["ẢNH: TỔNG HỢP"];
    lines.forEach((line, i) => ctx.fillText(wrapText(line, limit, measure, 1)[0] ?? "", C.x, C.y + i * C.lineHeight));
    if (scene.role === "body") this.drawCornerLogo(ctx, project);
    if (project.style?.subtitles.enabled) this.drawSubtitle(ctx, project.style, scene);
  }

  private drawSubtitle(ctx: Canvas2D, style: FrameStyle, scene: SceneFrame): void {
    const S = LAYOUT.subtitle;
    ctx.save();
    ctx.font = cssFont(style.subtitles.font, "bold", S.fontPx);
    const voiceStart = scene.voiceStart ?? 0;
    const voiceDuration = scene.voiceDuration ?? scene.sceneDuration;
    const cue = cueAt(this.cues(ctx, scene.text, voiceStart, voiceDuration), scene.sceneTime);
    if (cue) {
      const bottom = scene.role === "intro" ? S.introBottom : S.bodyBottom;
      const top = bottom - cue.lines.length * S.lineHeight;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineJoin = "round";
      ctx.lineWidth = S.strokePx;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = S.shadowBlurPx;
      ctx.shadowOffsetY = S.shadowOffsetPx;
      cue.lines.forEach((line, i) => ctx.strokeText(line, S.centerX, top + i * S.lineHeight));
      ctx.shadowColor = "rgba(0,0,0,0)";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = WHITE;
      cue.lines.forEach((line, i) => ctx.fillText(line, S.centerX, top + i * S.lineHeight));
    }
    ctx.restore();
  }

  private cues(ctx: Canvas2D, text: string, voiceStart: number, voiceDuration: number): SubtitleCue[] {
    const key = `${ctx.font}|${voiceStart}|${voiceDuration}|${text}`;
    let cues = this.cueCache.get(key);
    if (!cues) {
      if (this.cueCache.size >= 64) this.cueCache.clear();
      const S = LAYOUT.subtitle;
      cues = timeCues(splitSubtitle(text, S.maxWidth, (s) => ctx.measureText(s).width, S.maxLines), voiceStart, voiceDuration);
      this.cueCache.set(key, cues);
    }
    return cues;
  }

  private font(project: ProjectFrame, weight: Weight, px: number): string {
    return cssFont(project.style?.textFont ?? DEFAULT_TEXT_FONT, weight, px);
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
      ctx.font = this.font(project, "bold", Math.round(size * 0.55));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.channelName(project).charAt(0), x + size / 2, y + size / 2);
    }
    ctx.restore();
  }

  private drawChip(ctx: Canvas2D, project: ProjectFrame): void {
    const K = LAYOUT.intro.chip;
    const name = this.channelName(project);
    ctx.font = this.font(project, "bold", K.fontPx);
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
    ctx.font = this.font(project, "bold", K.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(name, K.x + K.padX + K.logoSize + K.gap, K.y + K.h / 2);
  }

  private drawDateTag(ctx: Canvas2D, project: ProjectFrame, dateText: string, x: number, y: number): void {
    const D = LAYOUT.dateTag;
    const text = `NGÀY ĐĂNG: ${dateText}`;
    ctx.font = this.font(project, "semiBold", D.fontPx);
    const w = ctx.measureText(text).width + D.padX * 2;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, y, w, D.h);
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + D.padX, y + D.h / 2);
  }

  /** Vị trí huy hiệu logo và chữ tên kênh ở góc trên phải (cảnh thân bài). Đặt font của ctx về font tên kênh. */
  private cornerLogoBox(ctx: Canvas2D, project: ProjectFrame): { name: string; textX: number; badgeX: number } {
    const G = LAYOUT.logo;
    const name = this.channelName(project);
    ctx.font = this.font(project, "bold", G.fontPx);
    const textX = LAYOUT.frame.width - G.right - ctx.measureText(name).width;
    return { name, textX, badgeX: textX - G.gap - G.size };
  }

  private drawCornerLogo(ctx: Canvas2D, project: ProjectFrame): void {
    const G = LAYOUT.logo;
    const { name, textX, badgeX } = this.cornerLogoBox(ctx, project);
    this.drawLogoBadge(ctx, project, badgeX, G.y, G.size);
    ctx.font = this.font(project, "bold", G.fontPx);
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(name, textX, G.y + G.size / 2);
  }
}
