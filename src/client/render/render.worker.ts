import { BrandKit } from "@/domain/BrandKit";
import { VideoFootage } from "@/domain/Footage";
import { VideoOptions } from "@/domain/VideoOptions";
import { mixProgram, type SourceBed, type StereoMix } from "@/client/media/AudioMix";
import { decodeSourceAudio } from "@/client/media/decodeSourceAudio";
import { loadFonts, type FontSink } from "@/client/media/FontLoader";
import { ImageFrameProvider, VideoFrameProvider } from "@/client/media/MediaFrameProvider";
import { fontFacesFor, frameStyleFor } from "@/templates/fonts/FontCatalog";
import { defaultTemplateRegistry } from "@/templates/registry";
import { CanvasBackdropMaker } from "./BackdropMaker";
import { RENDER_AUDIO_BITRATE, RENDER_VIDEO_BITRATE } from "./encodingDefaults";
import { Mp4Encoder } from "./Mp4Encoder";
import { sourceClipMediaFor } from "@/templates/VideoTemplate";
import { footageSpans, planRender, SOURCE_CLIP_SCENE_ID, timelineConfigFor } from "./RenderPlan";
import { probeWorkerScope, type ProbeScope } from "./workerProbe";
import type { FootageInput, RenderJob, WorkerMessage, WorkerRequest } from "./RenderJob";
import { VideoRenderer, type FrameProvider, type RenderScene } from "./VideoRenderer";

interface WorkerScope {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerMessage): void;
  fonts: FontSink;
}

const scope = globalThis as unknown as WorkerScope;

/** Ảnh banner chân: banner riêng trong job, không có thì tải ảnh mặc định của phong cách. */
async function loadBanner(job: RenderJob, defaultUrl: string): Promise<ImageBitmap> {
  let blob = job.banner ?? null;
  if (!blob) {
    const response = await fetch(new URL(defaultUrl, job.origin));
    if (!response.ok) throw new Error(`Không tải được banner mặc định (${response.status})`);
    blob = await response.blob();
  }
  try {
    return await createImageBitmap(blob);
  } catch (error) {
    throw new Error("Không đọc được ảnh banner chân video. Hãy tải lại ảnh ở phần Thương hiệu hoặc bấm “Dùng banner mặc định”.", {
      cause: error,
    });
  }
}

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
  // Khoan dung: job thiếu/sai tuỳ chọn thì dùng mặc định. Chỉ nạp font video này cần.
  const options = VideoOptions.restore(job.options).snapshot();
  await loadFonts(fontFacesFor(options), scope.fonts, job.origin);
  const style = frameStyleFor(options);
  const brand = BrandKit.create(template.id, template.brandFields, job.brandValues);

  const providers: FrameProvider[] = [];
  const scenes = new Map<string, RenderScene>();
  let logoBitmap: ImageBitmap | null = null;
  let bannerBitmap: ImageBitmap | null = null;
  let encoder: Mp4Encoder | null = null;
  try {
    logoBitmap = job.logo ? await createImageBitmap(job.logo) : null;
    bannerBitmap = template.footerBanner ? await loadBanner(job, template.footerBanner.defaultUrl) : null;
    const { timeline, voices, clipSlot } = planRender(job, timelineConfigFor(template.defaults.timeline, options));
    const owners = new Map<string, string>();
    for (const s of job.scenes) if (s.footageFrom) owners.set(s.sceneId, s.footageFrom);
    const spans = footageSpans(timeline, owners);
    for (const [index, s] of job.scenes.entries()) {
      const slot = timeline.slots[index];
      if (!slot) throw new Error(`Thiếu mốc thời gian cho cảnh ${s.sceneId}`);
      if (s.footageFrom) {
        // Dùng tiếp cảnh trám của đoạn trước: VideoRenderer lấy khung từ chủ cảnh theo thời gian cả nhóm.
        scenes.set(s.sceneId, { sceneId: s.sceneId, role: s.role, text: s.text, playback: { mode: "none" }, frames: null, footageFrom: s.footageFrom });
        continue;
      }
      // Chủ cảnh dùng chung chiếu suốt cả nhóm: lặp/cắt video theo độ dài nhóm, không theo một đoạn.
      const span = spans.get(s.sceneId);
      const sceneDuration = span ? span.end - span.start : slot.end - slot.start;
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
    if (job.sourceClip) {
      // Mở video tải lên MỘT lần: một khung làm ảnh thẻ tiêu đề, rồi phát trọn ở cảnh thân bài (không zoom).
      // Ngang: vừa khung trên nền mờ; dọc/vuông: phủ kín khung (xem sourceClipMediaFor).
      const clip = job.sourceClip;
      const frames = await VideoFrameProvider.open(clip.blob).catch((error: unknown) => {
        throw new Error(
          "Trình duyệt không đọc được hình của video tải lên (có thể do codec như HEVC/H.265). Hãy chuyển video sang MP4 (H.264, âm AAC) rồi tải lại.",
          { cause: error },
        );
      });
      providers.push(frames);
      const intro = job.scenes[0];
      if (intro && intro.role === "intro") {
        scenes.set(intro.sceneId, {
          sceneId: intro.sceneId,
          role: "intro",
          text: intro.text,
          playback: { mode: "still", startSec: frames.startSec, stillAtSec: clip.thumbnailSec },
          frames,
        });
      }
      scenes.set(SOURCE_CLIP_SCENE_ID, {
        sceneId: SOURCE_CLIP_SCENE_ID,
        role: "body",
        text: "",
        playback: { mode: "clip", sourceDurationSec: clip.durationSec, startSec: frames.startSec },
        frames,
        media: sourceClipMediaFor(frames.width, frames.height),
      });
    }

    scope.postMessage({ type: "progress", stage: "audio" });
    let source: SourceBed | null = null;
    const clip = job.sourceClip;
    if (clip && clip.hasAudio && clip.gain > 0 && clipSlot) {
      // null = video không có track âm (hợp lệ); có track mà không giải mã được thì decodeSourceAudio ném lỗi → dừng dựng.
      const channels = await decodeSourceAudio(clip.blob, job.sampleRate, clip.durationSec);
      if (channels) source = { channels, startSec: clipSlot.start, gain: clip.gain };
    }
    let mix: StereoMix | null = mixProgram(voices, job.music, { sampleRate: job.sampleRate, durationSec: timeline.totalDuration }, source);
    source = null; // nhả tiếng gốc đã giải mã (≈ 115 MB với video 5 phút stereo)

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
    const enc = new Mp4Encoder({ canvas, fps, videoBitrate: job.videoBitrate ?? RENDER_VIDEO_BITRATE, audioBitrate: RENDER_AUDIO_BITRATE });
    encoder = enc;
    await enc.start();
    await enc.addAudio(mix);
    mix = null; // âm đã mã hoá AAC; nhả hai kênh Float32 trước khi dựng hình

    await new VideoRenderer({
      template,
      ctx,
      project: {
        ...job.project,
        brand,
        logo: logoBitmap ? { source: logoBitmap, width: logoBitmap.width, height: logoBitmap.height } : null,
        ...(bannerBitmap ? { banner: { source: bannerBitmap, width: bannerBitmap.width, height: bannerBitmap.height } } : {}),
        style,
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
    bannerBitmap?.close();
  }
}

scope.onmessage = (event) => {
  if (event.data.type === "probe") {
    scope.postMessage({
      type: "probe-result",
      missing: probeWorkerScope(globalThis as unknown as ProbeScope, () => new OffscreenCanvas(1, 1).getContext("2d")),
    });
    return;
  }
  if (event.data.type !== "start") return;
  render(event.data.job).catch((error: unknown) => {
    scope.postMessage({ type: "error", message: error instanceof Error ? error.message : "Dựng video thất bại" });
  });
};
