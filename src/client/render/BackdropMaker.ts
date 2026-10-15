import type { Canvas2D } from "@/templates/Canvas2D";
import type { DrawableImage } from "@/templates/VideoTemplate";

export interface BackdropMaker {
  /** Trả ảnh nền mờ (nhỏ). Canvas được dùng lại: phải vẽ ngay trước khi gọi `make` lần sau. */
  make(image: DrawableImage): DrawableImage;
}

export interface BackdropSurface {
  canvas: CanvasImageSource;
  ctx: Canvas2D;
}

/** Nền mờ bằng cách thu nhỏ rồi để template phóng to: rẻ hơn blur toàn khung và chạy được cả khi trình duyệt bỏ qua ctx.filter. */
export class CanvasBackdropMaker implements BackdropMaker {
  private readonly surface: BackdropSurface;

  constructor(
    createSurface: (width: number, height: number) => BackdropSurface,
    private readonly width = 135,
    private readonly height = 240,
  ) {
    this.surface = createSurface(width, height);
  }

  make(image: DrawableImage): DrawableImage {
    const { canvas, ctx } = this.surface;
    const scale = Math.max(this.width / image.width, this.height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image.source, (this.width - w) / 2, (this.height - h) / 2, w, h);
    return { source: canvas, width: this.width, height: this.height };
  }
}
