import { Timeline, type SceneSlot, type TimelineConfig } from "@/domain/Timeline";
import type { MonoClip } from "@/client/media/AudioMix";
import type { VideoOptionsSnapshot } from "@/domain/VideoOptions";
import type { TitleOverlay } from "@/templates/VideoTemplate";
import type { RenderJob } from "./RenderJob";

/** Cấu hình timeline của MỘT video: mẫu cho tailSec, tuỳ chọn video cho nhịp đọc. Nguồn duy nhất cho video, phụ đề, thời lượng. */
export function timelineConfigFor(base: TimelineConfig, options: VideoOptionsSnapshot): TimelineConfig {
  return { ...base, gapSec: options.pacing.gapSec, leadInSec: options.pacing.leadInSec };
}

/** Khoảng thời gian (giây, trên toàn video) một cảnh trám được chiếu: từ đầu đoạn chủ cảnh tới hết đoạn cuối dùng tiếp nó. */
export interface FootageSpan {
  ownerId: string;
  start: number;
  end: number;
}

/**
 * Khoảng cảnh trám của từng đoạn. `owners`: đoạn → chủ cảnh (thiếu = chính nó); nhóm dùng chung là các đoạn liền nhau.
 * Mặc định (không ai dùng tiếp) mỗi đoạn có khoảng đúng bằng khe của nó.
 */
export function footageSpans(timeline: Timeline, owners: ReadonlyMap<string, string>): Map<string, FootageSpan> {
  const ownerOf = (sceneId: string) => owners.get(sceneId) ?? sceneId;
  const byOwner = new Map<string, { start: number; end: number }>();
  for (const slot of timeline.slots) {
    const ownerId = ownerOf(slot.sceneId);
    const range = byOwner.get(ownerId);
    if (range) range.end = slot.end;
    else byOwner.set(ownerId, { start: slot.start, end: slot.end });
  }
  const spans = new Map<string, FootageSpan>();
  for (const slot of timeline.slots) {
    const ownerId = ownerOf(slot.sceneId);
    const range = byOwner.get(ownerId) as { start: number; end: number };
    spans.set(slot.sceneId, { ownerId, start: range.start, end: range.end });
  }
  return spans;
}

/** Id đoạn của video tải lên trong timeline (không trùng id cảnh vì id cảnh là UUID/“s<n>”). */
export const SOURCE_CLIP_SCENE_ID = "source-clip";

export interface RenderPlanResult {
  timeline: Timeline;
  voices: MonoClip[];
  /** Khe của video tải lên (đoạn lặng cuối); null khi job không có video. */
  clipSlot: SceneSlot | null;
}

export function planRender(job: RenderJob, timelineConfig: TimelineConfig): RenderPlanResult {
  const bySceneId = new Map(job.narrations.map((n) => [n.sceneId, n]));
  if (job.sourceClip?.composition === "title-over-clip") {
    // Đọc tiêu đề đè trên video: một khe video dài đúng video, giọng tiêu đề đặt ở nghỉ đầu.
    const intro = job.scenes[0];
    const narration = intro ? bySceneId.get(intro.sceneId) : undefined;
    if (!intro || !narration) throw new Error("Thiếu giọng đọc tiêu đề");
    const timeline = Timeline.overlay(SOURCE_CLIP_SCENE_ID, job.sourceClip.durationSec, narration.durationSec, timelineConfig);
    const slot = timeline.slots[0] as SceneSlot;
    return { timeline, voices: [{ startSec: slot.voiceStart, samples: narration.samples }], clipSlot: slot };
  }
  const entries = job.scenes.map((s) => {
    const narration = bySceneId.get(s.sceneId);
    if (!narration) throw new Error(`Cảnh ${s.sceneId} chưa có giọng đọc`);
    return { sceneId: s.sceneId, durationSec: narration.durationSec, samples: narration.samples };
  });
  const timelineEntries: Array<{ sceneId: string; durationSec: number; silent?: boolean }> = entries.map((e) => ({
    sceneId: e.sceneId,
    durationSec: e.durationSec,
  }));
  if (job.sourceClip) timelineEntries.push({ sceneId: SOURCE_CLIP_SCENE_ID, durationSec: job.sourceClip.durationSec, silent: true });
  const timeline = Timeline.build(timelineEntries, timelineConfig);
  const voices = entries.map((entry, i) => ({ startSec: (timeline.slots[i] as SceneSlot).voiceStart, samples: entry.samples }));
  const clipSlot = job.sourceClip ? (timeline.slots[timeline.slots.length - 1] as SceneSlot) : null;
  return { timeline, voices, clipSlot };
}

/** Mốc thu gọn khối tiêu đề (giây tính từ đầu khe): hết giọng + "Giữ tiêu đề sau khi đọc" (gapSec). */
export function titleOverlayFor(slot: SceneSlot, config: TimelineConfig): TitleOverlay {
  return { collapseAtSec: slot.voiceEnd - slot.start + config.gapSec };
}
