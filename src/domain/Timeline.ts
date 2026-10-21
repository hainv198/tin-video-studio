import { ValidationError } from "./errors";
import { titleOverlayOverrunSec, titleOverlayTooLongMessage } from "./UploadComposition";

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

  /**
   * `silent`: đoạn không giọng (video tải lên) — bắt đầu ngay sau đoạn trước, dài đúng `durationSec`, không nghỉ đầu,
   * không nghỉ/đuôi sau. Đoạn có giọng giữ quy tắc cũ (nghỉ đầu ở đoạn đầu, nghỉ giữa câu, đuôi ở đoạn cuối).
   */
  static build(
    entries: ReadonlyArray<{ sceneId: string; durationSec: number; silent?: boolean }>,
    config: TimelineConfig = DEFAULT_TIMELINE_CONFIG,
  ): Timeline {
    if (entries.length === 0) throw new ValidationError("Chưa có cảnh nào để dựng");
    const slots: SceneSlot[] = [];
    let start = 0;
    let voiceStart = config.leadInSec;
    entries.forEach((entry, index) => {
      if (!Number.isFinite(entry.durationSec) || entry.durationSec <= 0) {
        throw new ValidationError(
          entry.silent ? `Đoạn ${entry.sceneId} có độ dài không hợp lệ` : `Cảnh ${entry.sceneId} chưa có độ dài giọng`,
        );
      }
      if (entry.silent) {
        const end = start + entry.durationSec;
        slots.push({ sceneId: entry.sceneId, index, start: ms(start), voiceStart: ms(start), voiceEnd: ms(start), end: ms(end) });
        start = end;
        voiceStart = end;
        return;
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

  /**
   * Kiểu "đọc tiêu đề đè trên video": một khe dài đúng `clipSec` (video chạy từ giây 0, không thẻ đầu, không đuôi),
   * giọng tiêu đề từ `leadInSec`. Nghỉ đầu + giọng dài hơn video thì ném ValidationError (không cắt giọng).
   */
  static overlay(sceneId: string, clipSec: number, voiceSec: number, config: TimelineConfig = DEFAULT_TIMELINE_CONFIG): Timeline {
    if (!Number.isFinite(clipSec) || clipSec <= 0) throw new ValidationError(`Đoạn ${sceneId} có độ dài không hợp lệ`);
    if (!Number.isFinite(voiceSec) || voiceSec <= 0) throw new ValidationError(`Cảnh ${sceneId} chưa có độ dài giọng`);
    if (titleOverlayOverrunSec(config.leadInSec, voiceSec, clipSec) > 0) {
      throw new ValidationError(titleOverlayTooLongMessage(config.leadInSec, voiceSec, clipSec));
    }
    const end = ms(clipSec);
    const slot: SceneSlot = {
      sceneId,
      index: 0,
      start: 0,
      voiceStart: ms(config.leadInSec),
      voiceEnd: Math.min(end, ms(config.leadInSec + voiceSec)),
      end,
    };
    return new Timeline([slot], end);
  }

  slotAt(t: number): SceneSlot {
    const first = this.slots[0] as SceneSlot;
    const last = this.slots[this.slots.length - 1] as SceneSlot;
    if (t < first.end) return first;
    if (t >= last.start) return last;
    return this.slots.find((s) => t >= s.start && t < s.end) ?? last;
  }

  frameCount(fps: number): number {
    if (!Number.isFinite(fps) || fps <= 0) throw new ValidationError("fps phải là số dương");
    return Math.ceil(Math.round(this.totalDuration * fps * 1e6) / 1e6);
  }
}
