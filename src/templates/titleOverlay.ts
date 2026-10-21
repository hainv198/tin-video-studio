import type { TitleOverlay } from "./VideoTemplate";

/** Thời gian thu gọn khối tiêu đề (giây). */
export const TITLE_COLLAPSE_SEC = 0.4;

/** Tiến độ thu gọn 0 → 1 (smoothstep), thuần theo `sceneTime`. Sai số số thực sát cuối được làm tròn thành đúng 1. */
export function titleCollapseProgress(sceneTime: number, overlay: TitleOverlay): number {
  const x = (sceneTime - overlay.collapseAtSec) / TITLE_COLLAPSE_SEC;
  if (x <= 0) return 0;
  if (x >= 1 - 1e-9) return 1;
  return x * x * (3 - 2 * x);
}
