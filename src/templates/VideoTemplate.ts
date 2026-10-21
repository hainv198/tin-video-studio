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

/**
 * Cách đặt ảnh/video vào khung: cắt cho đầy dải thân bài (cover), vừa trọn dải trên nền mờ (contain), hay phủ toàn khung
 * video không nền mờ (fullFrame); có zoom Ken Burns hay đứng yên.
 */
export interface SceneMedia {
  fit: "cover" | "contain" | "fullFrame";
  motion: boolean;
}

/** Video người dùng tải lên (khổ khác 9:16): vừa khung trên nền mờ, không cắt mất nội dung, không zoom. */
export const SOURCE_CLIP_MEDIA: SceneMedia = { fit: "contain", motion: false };

/** Video tải lên đã là 9:16: phủ toàn khung 1080×1920, không nền mờ, không zoom. */
export const NATIVE_PORTRAIT_MEDIA: SceneMedia = { fit: "fullFrame", motion: false };

/** Tỉ lệ rộng/cao của khung video dọc 9:16 và dung sai tương đối để coi một hình là "9:16 gốc". */
export const PORTRAIT_RATIO = 9 / 16;
export const PORTRAIT_TOLERANCE = 0.06;

/** Hình có tỉ lệ rộng/cao lệch không quá ±6% so với 9:16 (1080×1920, 720×1280, 1079×1920…). */
export function isNativePortrait(width: number, height: number): boolean {
  if (!(width > 0 && height > 0)) return false;
  return Math.abs(width / height / PORTRAIT_RATIO - 1) <= PORTRAIT_TOLERANCE;
}

/**
 * Cách đặt video tải lên vào cảnh thân bài: 9:16 gốc thì phủ toàn khung (không cắt đáng kể, không nền mờ);
 * mọi khổ khác (ngang, vuông, 4:3, dọc 3:4/4:5, ảnh rất thon) thì vừa khung trên nền mờ lấy từ chính video. Không zoom.
 */
export function sourceClipMediaFor(width: number, height: number): SceneMedia {
  return isNativePortrait(width, height) ? NATIVE_PORTRAIT_MEDIA : SOURCE_CLIP_MEDIA;
}

export interface ProjectFrame {
  displayTitle: string;
  sourceCredit: string;
  publishDateText: string;
  brand: BrandKit;
  logo: DrawableImage | null;
  /** Tuỳ chọn riêng của video. Bỏ trống = như trước khi có tuỳ chọn (font mặc định của phong cách, không phụ đề, màu chủ đạo). */
  style?: FrameStyle;
  /** Dòng thứ hai khối nguồn tin; bỏ trống = "ẢNH: TỔNG HỢP". */
  mediaCredit?: string;
  /** Ảnh banner chân (phong cách có banner); null/bỏ trống = phong cách tự xử lý (tô đen dải). Phong cách khác bỏ qua. */
  banner?: DrawableImage | null;
}

/** Khối tiêu đề đè dưới video (kiểu "đọc tiêu đề đè trên video"): hiện từ đầu cảnh, thu gọn từ `collapseAtSec`. */
export interface TitleOverlay {
  /** Giây (tính từ đầu cảnh) bắt đầu thu gọn = hết giọng + "Giữ tiêu đề sau khi đọc". */
  collapseAtSec: number;
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
  /**
   * Giây tính từ lúc cảnh trám bắt đầu chiếu và tổng thời gian chiếu nó. Khác sceneTime/sceneDuration khi nhiều đoạn
   * liền nhau dùng chung một cảnh trám (hiệu ứng chuyển động phải liên tục qua biên đoạn). Bỏ trống = theo đoạn.
   */
  footageTime?: number;
  footageDuration?: number;
  /** Giây (tính từ đầu cảnh) giọng đọc bắt đầu; bỏ trống = 0. */
  voiceStart?: number;
  /** Độ dài giọng đọc của cảnh; bỏ trống = cả cảnh. */
  voiceDuration?: number;
  /** Bỏ trống = cover + Ken Burns (như cảnh trám). */
  media?: SceneMedia;
  /** Có thì phong cách vẽ khối tiêu đề đè dưới video và thu gọn theo thời gian; bỏ trống = cảnh thân bài thường. */
  titleOverlay?: TitleOverlay;
}

/** Phong cách có banner chân: ảnh mặc định (URL tương đối trong public/) và dải vẽ trên khung. */
export interface FooterBannerSpec {
  defaultUrl: string;
  box: { x: number; y: number; w: number; h: number };
}

/** Một phong cách video. Hàm vẽ phải thuần theo thời gian: cùng đầu vào ra cùng hình. */
export abstract class VideoTemplate {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly brandFields: readonly BrandFieldSpec[];
  abstract readonly defaults: TemplateDefaults;
  abstract readonly fonts: readonly FontFaceSpec[];
  /** Có thì worker/xem trước nạp ảnh banner (riêng của thương hiệu, không có thì `defaultUrl`) vào `ProjectFrame.banner`. */
  readonly footerBanner: FooterBannerSpec | null = null;
  /** Chưa lưu thương hiệu riêng thì mượn thương hiệu của phong cách này (id); null = không mượn. */
  readonly brandFallbackId: string | null = null;

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
