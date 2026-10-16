import type { BrandFieldSpec, BrandKit } from "@/domain/BrandKit";
import type { SceneRole } from "@/domain/Scene";
import type { TimelineConfig } from "@/domain/Timeline";
import type { Canvas2D } from "./Canvas2D";

export interface DrawableImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface FontFaceSpec {
  family: string;
  url: string;
  weight: string;
}

/** Một họ font đã nạp và hai mức đậm dùng trong video. */
export interface FontStyle {
  family: string;
  /** Dòng nguồn tin, tem ngày. */
  semiBold: number;
  /** Tiêu đề, tên kênh, phụ đề. */
  bold: number;
}

/** Tuỳ chọn riêng của video đã quy về dữ liệu vẽ. */
export interface FrameStyle {
  textFont: FontStyle;
  subtitles: { enabled: boolean; font: FontStyle };
  /** Màu riêng của cảnh mở đầu; null = theo màu chủ đạo thương hiệu. */
  intro: { backgroundColor: string | null; blockColor: string | null };
}

export function cssFont(font: FontStyle, weight: "semiBold" | "bold", px: number): string {
  return `${font[weight]} ${px}px "${font.family}", "Arial Narrow", sans-serif`;
}

export interface TemplateDefaults {
  width: number;
  height: number;
  fps: number;
  timeline: TimelineConfig;
  fallbackKeyword: string;
}

export interface ProjectFrame {
  displayTitle: string;
  sourceCredit: string;
  publishDateText: string;
  brand: BrandKit;
  logo: DrawableImage | null;
  /** Tuỳ chọn riêng của video. Bỏ trống = như trước khi có tuỳ chọn (font mặc định của phong cách, không phụ đề, màu chủ đạo). */
  style?: FrameStyle;
}

export interface SceneFrame {
  role: SceneRole;
  text: string;
  image: DrawableImage | null;
  /** Nền mờ đã chuẩn bị sẵn (thu nhỏ); template phóng ra toàn khung. Không có thì template tự làm mờ. */
  backdrop?: DrawableImage | null;
  /** Giây tính từ đầu cảnh. */
  sceneTime: number;
  sceneDuration: number;
  /** Giây (tính từ đầu cảnh) giọng đọc bắt đầu; bỏ trống = 0. */
  voiceStart?: number;
  /** Độ dài giọng đọc của cảnh; bỏ trống = cả cảnh. */
  voiceDuration?: number;
}

/** Một phong cách video. Hàm vẽ phải thuần theo thời gian: cùng đầu vào ra cùng hình. */
export abstract class VideoTemplate {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly brandFields: readonly BrandFieldSpec[];
  abstract readonly defaults: TemplateDefaults;
  abstract readonly fonts: readonly FontFaceSpec[];

  drawFrame(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void {
    ctx.save();
    if (scene.role === "intro") this.drawIntro(ctx, project, scene);
    else this.drawBody(ctx, project, scene);
    this.drawOverlay(ctx, project, scene);
    ctx.restore();
  }

  protected abstract drawIntro(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void;
  protected abstract drawBody(ctx: Canvas2D, project: ProjectFrame, scene: SceneFrame): void;
  protected drawOverlay(_ctx: Canvas2D, _project: ProjectFrame, _scene: SceneFrame): void {}
}
