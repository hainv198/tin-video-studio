import type { FootagePlayback } from "@/domain/Footage";
import type { SceneRole } from "@/domain/Scene";
import type { Timeline } from "@/domain/Timeline";
import { sourceTimeFor } from "@/client/media/sourceTime";
import type { Canvas2D } from "@/templates/Canvas2D";
import type { DrawableImage, ProjectFrame, VideoTemplate } from "@/templates/VideoTemplate";
import { RenderCancelledError } from "./errors";

export interface FrameProvider {
  frameAt(sourceTime: number): Promise<DrawableImage | null>;
  dispose(): void;
}

export interface RenderScene {
  sceneId: string;
  role: SceneRole;
  text: string;
  playback: FootagePlayback;
  frames: FrameProvider | null;
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
}

const PROGRESS_EVERY = 15;

export class VideoRenderer {
  constructor(private readonly input: VideoRenderInput) {}

  async render(): Promise<number> {
    const { template, ctx, project, timeline, scenes, fps, sink, onProgress, signal } = this.input;
    const total = timeline.frameCount(fps);
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new RenderCancelledError();
      const t = i / fps;
      const slot = timeline.slotAt(t);
      const scene = scenes.get(slot.sceneId);
      if (!scene) throw new Error(`Thiếu dữ liệu cảnh ${slot.sceneId}`);
      const sceneTime = t - slot.start;
      const sourceTime = sourceTimeFor(scene.playback, sceneTime);
      const image = sourceTime === null || !scene.frames ? null : await scene.frames.frameAt(sourceTime);
      template.drawFrame(ctx, project, {
        role: scene.role,
        text: scene.text,
        image,
        sceneTime,
        sceneDuration: slot.end - slot.start,
      });
      await sink.add(t, 1 / fps);
      const frame = i + 1;
      if (frame % PROGRESS_EVERY === 0 || frame === total) onProgress?.({ frame, totalFrames: total });
    }
    return total;
  }
}
