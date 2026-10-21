import { ALL_FORMATS, BlobSource, CanvasSink, Input, type WrappedCanvas } from "mediabunny";
import type { FrameProvider } from "@/client/render/VideoRenderer";
import type { DrawableImage } from "@/templates/VideoTemplate";

export class ImageFrameProvider implements FrameProvider {
  private constructor(private readonly bitmap: ImageBitmap) {}

  static async fromBlob(blob: Blob): Promise<ImageFrameProvider> {
    return new ImageFrameProvider(await createImageBitmap(blob));
  }

  get width(): number {
    return this.bitmap.width;
  }

  get height(): number {
    return this.bitmap.height;
  }

  async frameAt(): Promise<DrawableImage> {
    return { source: this.bitmap, width: this.bitmap.width, height: this.bitmap.height };
  }

  release(): void {}

  dispose(): void {
    this.bitmap.close();
  }
}

/** Đọc khung video tuần tự bằng mediabunny; tua lùi (khi lặp) thì mở lại bộ đọc từ thời điểm đó. */
export class VideoFrameProvider implements FrameProvider {
  private iterator: AsyncGenerator<WrappedCanvas, void, unknown> | null = null;
  private current: WrappedCanvas | null = null;
  private upcoming: WrappedCanvas | null = null;
  private lastTime = -1;

  private constructor(
    private readonly input: Input,
    private readonly sink: CanvasSink,
    readonly durationSec: number,
    readonly width: number,
    readonly height: number,
    /** Mốc khung hình đầu của video, giây. */
    readonly startSec: number,
  ) {}

  static async open(blob: Blob, maxSide = 1080): Promise<VideoFrameProvider> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      input.dispose();
      throw new Error("File video không có hình");
    }
    const w = await track.getDisplayWidth();
    const h = await track.getDisplayHeight();
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const width = Math.round(w * scale);
    const height = Math.round(h * scale);
    // poolSize 3: bộ đọc giữ tối đa hai canvas cùng lúc (hiện tại và kế tiếp)
    const sink = new CanvasSink(track, { width, height, fit: "fill", poolSize: 3 });
    const durationSec = await track.computeDuration();
    const startSec = await track.getFirstTimestamp();
    return new VideoFrameProvider(input, sink, durationSec, width, height, startSec);
  }

  /** Phải gọi tuần tự, không chồng lệnh. */
  async frameAt(sourceTime: number): Promise<DrawableImage | null> {
    if (this.iterator === null || sourceTime < this.lastTime) {
      await this.iterator?.return();
      this.iterator = this.sink.canvases(sourceTime);
      this.current = null;
      const first = await this.iterator.next();
      this.upcoming = first.done ? null : first.value;
    }
    this.lastTime = sourceTime;
    while (this.upcoming && this.upcoming.timestamp <= sourceTime + 1e-6) {
      this.current = this.upcoming;
      const next = await this.iterator.next();
      this.upcoming = next.done ? null : next.value;
    }
    const frame = this.current ?? this.upcoming;
    return frame ? { source: frame.canvas, width: frame.canvas.width, height: frame.canvas.height } : null;
  }

  /** Nhả bộ giải mã và canvas giữ trong bộ đệm; `frameAt` sau đó tự mở lại bộ đọc. */
  release(): void {
    this.iterator?.return().catch(() => {});
    this.iterator = null;
    this.current = null;
    this.upcoming = null;
    this.lastTime = -1;
  }

  dispose(): void {
    this.release();
    this.input.dispose();
  }
}
