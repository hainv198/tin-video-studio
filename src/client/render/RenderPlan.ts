import { Timeline, type TimelineConfig } from "@/domain/Timeline";
import type { MonoClip } from "@/client/media/AudioMix";
import type { RenderJob } from "./RenderJob";

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
