import type { FootagePlayback } from "@/domain/Footage";

/** Thời điểm (giây) cần lấy khung từ cảnh trám; null khi cảnh không có hình. */
export function sourceTimeFor(playback: FootagePlayback, sceneTime: number): number | null {
  const src = playback.sourceDurationSec ?? 0;
  switch (playback.mode) {
    case "none":
      return null;
    case "still":
      return 0;
    case "clip":
      return Math.min(sceneTime, Math.max(0, src - 0.001));
    case "loop":
      return src > 0 ? sceneTime % src : 0;
  }
}
