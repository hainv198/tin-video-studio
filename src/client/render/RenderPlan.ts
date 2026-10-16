import { Timeline, type TimelineConfig } from "@/domain/Timeline";
import type { MonoClip } from "@/client/media/AudioMix";
import type { VideoOptionsSnapshot } from "@/domain/VideoOptions";
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

export function planRender(job: RenderJob, timelineConfig: TimelineConfig): { timeline: Timeline; voices: MonoClip[] } {
  const bySceneId = new Map(job.narrations.map((n) => [n.sceneId, n]));
  const entries = job.scenes.map((s) => {
    const narration = bySceneId.get(s.sceneId);
    if (!narration) throw new Error(`Cảnh ${s.sceneId} chưa có giọng đọc`);
    return { sceneId: s.sceneId, durationSec: narration.durationSec, samples: narration.samples };
  });
  const timeline = Timeline.build(entries, timelineConfig);
  const voices = timeline.slots.map((slot, i) => ({
    startSec: slot.voiceStart,
    samples: (entries[i] as (typeof entries)[number]).samples,
  }));
  return { timeline, voices };
}
