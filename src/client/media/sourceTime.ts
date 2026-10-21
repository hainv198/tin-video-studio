import type { FootagePlayback } from "@/domain/Footage";

/** Thời điểm (giây, theo mốc của file) cần lấy khung từ cảnh trám/video; null khi cảnh không có hình. */
export function sourceTimeFor(playback: FootagePlayback, sceneTime: number): number | null {
  const src = playback.sourceDurationSec ?? 0;
  const base = playback.startSec ?? 0;
  switch (playback.mode) {
    case "none":
      return null;
    case "still":
      return base + (playback.stillAtSec ?? 0);
    case "clip":
      return base + Math.min(sceneTime, Math.max(0, src - 0.001));
    case "loop":
      return base + (src > 0 ? sceneTime % src : 0);
  }
}
