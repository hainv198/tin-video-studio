import { BrandKit } from "@/domain/BrandKit";
import { VideoFootage } from "@/domain/Footage";
import { mixProgram } from "@/client/media/AudioMix";
import { loadFonts, type FontSink } from "@/client/media/FontLoader";
import { ImageFrameProvider, VideoFrameProvider } from "@/client/media/MediaFrameProvider";
import { defaultTemplateRegistry } from "@/templates/registry";
import { CanvasBackdropMaker } from "./BackdropMaker";
import { Mp4Encoder } from "./Mp4Encoder";
import { planRender } from "./RenderPlan";
import type { FootageInput, RenderJob, WorkerMessage, WorkerRequest } from "./RenderJob";
import { VideoRenderer, type FrameProvider, type RenderScene } from "./VideoRenderer";

interface WorkerScope {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerMessage): void;
  fonts: FontSink;
}

const scope = globalThis as unknown as WorkerScope;
const VIDEO_BITRATE = 8_000_000;
const AUDIO_BITRATE = 192_000;

async function blobOf(footage: FootageInput, origin: string): Promise<Blob> {
  if (footage.blob) return footage.blob;
  if (!footage.url) throw new Error("Cảnh trám thiếu nguồn");
  const response = await fetch(new URL(footage.url, origin), { mode: "cors" });
  if (!response.ok) throw new Error(`Không tải được cảnh trám (${response.status})`);
  return response.blob();
}

async function render(job: RenderJob): Promise<void> {
  scope.postMessage({ type: "progress", stage: "loading" });
  if (!scope.fonts) throw new Error("Trình duyệt không hỗ trợ nạp font trong worker");
  const template = defaultTemplateRegistry().get(job.templateId);
  await loadFonts(template.fonts, scope.fonts, job.origin);
  const brand = BrandKit.create(template.id, template.brandFields, job.brandValues);

  const providers: FrameProvider[] = [];
  const scenes = new Map<string, RenderScene>();
  let logoBitmap: ImageBitmap | null = null;
  let encoder: Mp4Encoder | null = null;
  try {
    logoBitmap = job.logo ? await createImageBitmap(job.logo) : null;
    const { timeline, voices } = planRender(job, template.defaults.timeline);
    for (const [index, s] of job.scenes.entries()) {
      const slot = timeline.slots[index];
      if (!slot) throw new Error(`Thiếu mốc thời gian cho cảnh ${s.sceneId}`);
      const sceneDuration = slot.end - slot.start;
      if (s.footage.kind === "fallback") {
        scenes.set(s.sceneId, { sceneId: s.sceneId, role: s.role, text: s.text, playback: { mode: "none" }, frames: null });
        continue;
      }
      const blob = await blobOf(s.footage, job.origin);
      if (s.footage.kind === "image") {
        const frames = await ImageFrameProvider.fromBlob(blob);
        providers.push(frames);
        scenes.set(s.sceneId, { sceneId: s.sceneId, role: s.role, text: s.text, playback: { mode: "still" }, frames });
      } else {
        const frames = await VideoFrameProvider.open(blob);
        providers.push(frames);
        const footage = new VideoFootage(s.sceneId, { origin: "upload", uri: "blob" }, frames.width, frames.height, frames.durationSec);
        scenes.set(s.sceneId, {
          sceneId: s.sceneId,
          role: s.role,
          text: s.text,
          playback: footage.playbackFor(sceneDuration),
          frames,
        });
      }
    }

    scope.postMessage({ type: "progress", stage: "audio" });
    const mix = mixProgram(voices, job.music, { sampleRate: job.sampleRate, durationSec: timeline.totalDuration });

    const { width, height, fps } = template.defaults;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Trình duyệt không cấp được canvas 2D");
    const backdrop = new CanvasBackdropMaker((w, h) => {
      const surface = new OffscreenCanvas(w, h);
      const surfaceCtx = surface.getContext("2d");
      if (!surfaceCtx) throw new Error("Trình duyệt không cấp được canvas 2D");
      return { canvas: surface, ctx: surfaceCtx };
    });
    const enc = new Mp4Encoder({ canvas, fps, videoBitrate: VIDEO_BITRATE, audioBitrate: AUDIO_BITRATE });
    encoder = enc;
    await enc.start();
    await enc.addAudio(mix);

    await new VideoRenderer({
      template,
      ctx,
      project: {
        ...job.project,
        brand,
        logo: logoBitmap ? { source: logoBitmap, width: logoBitmap.width, height: logoBitmap.height } : null,
      },
      timeline,
      scenes,
      fps,
      sink: enc,
      backdrop,
      onProgress: (p) => scope.postMessage({ type: "progress", stage: "video", frame: p.frame, totalFrames: p.totalFrames }),
    }).render();

    scope.postMessage({ type: "progress", stage: "finalizing" });
    const blob = await enc.finish();
    scope.postMessage({ type: "done", blob, durationSec: timeline.totalDuration });
  } catch (error) {
    try {
      await encoder?.cancel();
    } catch {
      // bỏ qua lỗi huỷ bộ mã hoá, giữ lỗi gốc
    }
    throw error;
  } finally {
    for (const p of providers) {
      try {
        p.dispose();
      } catch {
        // một provider lỗi không được bỏ qua các provider còn lại
      }
    }
    logoBitmap?.close();
  }
}

scope.onmessage = (event) => {
  if (event.data.type !== "start") return;
  render(event.data.job).catch((error: unknown) => {
    scope.postMessage({ type: "error", message: error instanceof Error ? error.message : "Dựng video thất bại" });
  });
};
