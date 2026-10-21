/** Cách ghép tiêu đề với video tải lên. "intro-then-clip": thẻ tiêu đề rồi video (kiểu gốc). "title-over-clip": đọc tiêu đề đè trên video. */
export type UploadComposition = "intro-then-clip" | "title-over-clip";

export const UPLOAD_COMPOSITIONS: readonly UploadComposition[] = ["intro-then-clip", "title-over-clip"];

export const DEFAULT_UPLOAD_COMPOSITION: UploadComposition = "intro-then-clip";

export const UPLOAD_COMPOSITION_LABELS: Record<UploadComposition, string> = {
  "intro-then-clip": "Thẻ tiêu đề rồi video",
  "title-over-clip": "Đọc tiêu đề đè trên video",
};

export const UPLOAD_COMPOSITION_HINTS: Record<UploadComposition, string> = {
  "intro-then-clip": "Thẻ tiêu đề có giọng đọc, sau đó chạy nguyên video. Tổng = thẻ đầu + video.",
  "title-over-clip":
    "Video chạy ngay từ đầu; giọng đọc tiêu đề phát đè lên video, khối tiêu đề hiện dưới video rồi thu gọn; tiếng gốc tự nhỏ lại khi đọc. Tổng = đúng độ dài video.",
};

export function isUploadComposition(v: unknown): v is UploadComposition {
  return v === "intro-then-clip" || v === "title-over-clip";
}

const ms = (n: number) => Math.round(n * 1000) / 1000;
const sec = (n: number) => n.toFixed(1).replace(".", ",");

/** Giây giọng tiêu đề (tính cả nghỉ đầu) vượt quá video; ≤ 0 là vừa. */
export function titleOverlayOverrunSec(leadInSec: number, voiceSec: number, clipSec: number): number {
  return ms(leadInSec + voiceSec - clipSec);
}

export function titleOverlayTooLongMessage(leadInSec: number, voiceSec: number, clipSec: number): string {
  return `Giọng đọc tiêu đề (kể cả nghỉ đầu) dài ${sec(leadInSec + voiceSec)} giây, video chỉ ${sec(clipSec)} giây. Hãy rút gọn tiêu đề, giảm nghỉ đầu, tăng tốc độ đọc hoặc chọn “Thẻ tiêu đề rồi video”.`;
}
