import type { FootagePlayback } from "@/domain/Footage";
import type { SceneRole } from "@/domain/Scene";
import type { Timeline } from "@/domain/Timeline";
import { sourceTimeFor } from "@/client/media/sourceTime";
import type { Canvas2D } from "@/templates/Canvas2D";
import type { DrawableImage, ProjectFrame, SceneMedia, VideoTemplate } from "@/templates/VideoTemplate";
import type { BackdropMaker } from "./BackdropMaker";
import { footageSpans } from "./RenderPlan";
import { RenderCancelledError } from "./errors";

export interface FrameProvider {
  frameAt(sourceTime: number): Promise<DrawableImage | null>;
  /** Nhả tài nguyên nặng (bộ giải mã) khi hết cảnh. Gọi `frameAt` sau đó vẫn dùng được (tự mở lại). */
  release(): void;
  /** Nhả toàn bộ, kể cả bộ đọc tệp. Gọi một lần khi bỏ provider. */
  dispose(): void;
}

export interface RenderScene {
  sceneId: string;
  role: SceneRole;
  text: string;
  /** Với chủ cảnh dùng chung, `playback` tính theo cả khoảng của nhóm (xem `footageSpans`). */
  playback: FootagePlayback;
  frames: FrameProvider | null;
  /** Đoạn không có cảnh trám riêng: id đoạn chủ cảnh; ảnh/video của chủ cảnh chạy tiếp, không cắt cảnh. */
  footageFrom?: string;
  /** Cách đặt hình vào khung; bỏ trống = cover + Ken Burns. */
  media?: SceneMedia;
}

export interface VideoFrameSink {
  /** Mã hoá nội dung canvas hiện tại thành một khung. */
  add(timestampSec: number, durationSec: number): Promise<void>;
}

export interface RenderProgress {
  frame: number;
  totalFrames: number;
}

export interface VideoRenderInput {
  template: VideoTemplate;
  ctx: Canvas2D;
  project: ProjectFrame;
  timeline: Timeline;
  scenes: ReadonlyMap<string, RenderScene>;
  fps: number;
  sink: VideoFrameSink;
  onProgress?: (progress: RenderProgress) => void;
  signal?: AbortSignal;
  backdrop?: BackdropMaker;
}

const PROGRESS_EVERY = 15;

export class VideoRenderer {
  constructor(private readonly input: VideoRenderInput) {}

  async render(): Promise<number> {
    const { template, ctx, project, timeline, scenes, fps, sink, onProgress, signal, backdrop } = this.input;
    const total = timeline.frameCount(fps);
    const owners = new Map<string, string>();
    for (const scene of scenes.values()) if (scene.footageFrom) owners.set(scene.sceneId, scene.footageFrom);
    const spans = footageSpans(timeline, owners);
    let currentOwnerId: string | null = null;
    const releaseCurrent = () => {
      if (currentOwnerId !== null) scenes.get(currentOwnerId)?.frames?.release();
    };
    try {
      for (let i = 0; i < total; i++) {
        if (signal?.aborted) throw new RenderCancelledError();
        const t = i / fps;
        const slot = timeline.slotAt(t);
        const scene = scenes.get(slot.sceneId);
        if (!scene) throw new Error(`Thiếu dữ liệu cảnh ${slot.sceneId}`);
        const span = spans.get(slot.sceneId) ?? { ownerId: slot.sceneId, start: slot.start, end: slot.end };
        const owner = scenes.get(span.ownerId);
        if (!owner) throw new Error(`Thiếu dữ liệu cảnh ${span.ownerId}`);
        // Nhả bộ giải mã khi đổi cảnh trám (không phải khi đổi đoạn): nhóm dùng chung đọc liền một mạch.
        if (span.ownerId !== currentOwnerId) {
          releaseCurrent();
          currentOwnerId = span.ownerId;
        }
        const sceneTime = t - slot.start;
        // Thời gian tính từ đầu cảnh trám (đầu nhóm): Ken Burns và khung video liên tục qua biên đoạn dùng tiếp.
        const footageTime = t - span.start;
        const sourceTime = sourceTimeFor(owner.playback, footageTime);
        const image = sourceTime === null || !owner.frames ? null : await owner.frames.frameAt(sourceTime);
        const backdropImage = image && scene.role === "body" && backdrop ? backdrop.make(image) : null;
        template.drawFrame(ctx, project, {
          role: scene.role,
          text: scene.text,
          image,
          backdrop: backdropImage,
          sceneTime,
          sceneDuration: slot.end - slot.start,
          footageTime,
          footageDuration: span.end - span.start,
          voiceStart: slot.voiceStart - slot.start,
          voiceDuration: slot.voiceEnd - slot.voiceStart,
          media: scene.media,
        });
        await sink.add(t, 1 / fps);
        const frame = i + 1;
        if (frame % PROGRESS_EVERY === 0 || frame === total) onProgress?.({ frame, totalFrames: total });
      }
    } finally {
      releaseCurrent();
    }
    return total;
  }
}
