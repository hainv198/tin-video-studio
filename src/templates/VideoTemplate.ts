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
}

export interface SceneFrame {
  role: SceneRole;
  text: string;
  image: DrawableImage | null;
  /** Giây tính từ đầu cảnh. */
  sceneTime: number;
  sceneDuration: number;
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
