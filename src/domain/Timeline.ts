import { ValidationError } from "./errors";

export interface TimelineConfig {
  leadInSec: number;
  gapSec: number;
  tailSec: number;
}

export const DEFAULT_TIMELINE_CONFIG: TimelineConfig = { leadInSec: 0.3, gapSec: 0.35, tailSec: 0.6 };

export interface SceneSlot {
  readonly sceneId: string;
  readonly index: number;
  readonly start: number;
  readonly voiceStart: number;
  readonly voiceEnd: number;
  readonly end: number;
}

const ms = (n: number) => Math.round(n * 1000) / 1000;

export class Timeline {
  private constructor(
    readonly slots: readonly SceneSlot[],
    readonly totalDuration: number,
  ) {}

  static build(
    entries: ReadonlyArray<{ sceneId: string; durationSec: number }>,
    config: TimelineConfig = DEFAULT_TIMELINE_CONFIG,
  ): Timeline {
    if (entries.length === 0) throw new ValidationError("Chưa có cảnh nào để dựng");
    const slots: SceneSlot[] = [];
    let start = 0;
    let voiceStart = config.leadInSec;
    entries.forEach((entry, index) => {
      if (!Number.isFinite(entry.durationSec) || entry.durationSec <= 0) {
        throw new ValidationError(`Cảnh ${entry.sceneId} chưa có độ dài giọng`);
      }
      const voiceEnd = voiceStart + entry.durationSec;
      const isLast = index === entries.length - 1;
      const end = voiceEnd + (isLast ? config.tailSec : config.gapSec);
      slots.push({
        sceneId: entry.sceneId,
        index,
        start: ms(start),
        voiceStart: ms(voiceStart),
        voiceEnd: ms(voiceEnd),
        end: ms(end),
      });
      start = end;
      voiceStart = end;
    });
    return new Timeline(slots, (slots[slots.length - 1] as SceneSlot).end);
  }

  slotAt(t: number): SceneSlot {
    const first = this.slots[0] as SceneSlot;
    const last = this.slots[this.slots.length - 1] as SceneSlot;
    if (t < first.end) return first;
    if (t >= last.start) return last;
    return this.slots.find((s) => t >= s.start && t < s.end) ?? last;
  }

  frameCount(fps: number): number {
    return Math.ceil(this.totalDuration * fps);
  }
}
