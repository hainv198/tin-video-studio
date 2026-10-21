import { ValidationError } from "@/domain/errors";
import { SourceClip } from "@/domain/SourceClip";
import type { UploadKind } from "@/domain/UploadKind";

const MB = 1024 * 1024;

export const UPLOAD_LIMITS = { image: 20 * MB, video: 300 * MB, audio: 30 * MB } as const;

const LABEL: Record<UploadKind, string> = { image: "ảnh", video: "video", audio: "nhạc" };

const MIME: Record<string, UploadKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/mp3": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/wave": "audio",
  "audio/mp4": "audio",
  "audio/x-m4a": "audio",
  "audio/m4a": "audio",
};

const EXT: Record<string, UploadKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
};

export function classifyUpload(
  file: { name: string; type: string; size: number },
  allowed: readonly UploadKind[] = ["image", "video", "audio"],
  limits: Partial<Record<UploadKind, number>> = {},
): UploadKind {
  if (file.size <= 0) throw new ValidationError("File rỗng");
  const ext = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase() : "";
  const kind = MIME[file.type.toLowerCase()] ?? EXT[ext];
  if (!kind) throw new ValidationError(`Định dạng không được hỗ trợ: ${ext || file.type || "không rõ"}`);
  if (!allowed.includes(kind)) throw new ValidationError(`Không nhận file ${LABEL[kind]} ở đây`);
  const max = limits[kind] ?? UPLOAD_LIMITS[kind];
  if (file.size > max) throw new ValidationError(`File quá lớn (tối đa ${max / MB} MB cho ${LABEL[kind]})`);
  return kind;
}

/** Video của kiểu "Video tải lên": 500 MB (video điện thoại 1080p 5 phút ≈ 450–600 MB), tối đa 5 phút. */
export const SOURCE_CLIP_LIMITS = { maxBytes: 500 * MB, maxDurationSec: SourceClip.MAX_DURATION_SEC } as const;

export function classifySourceClip(file: { name: string; type: string; size: number }): "video" {
  classifyUpload(file, ["video"], { video: SOURCE_CLIP_LIMITS.maxBytes });
  return "video";
}

/** "m:ss" (làm tròn xuống giây). */
export function formatClock(sec: number): string {
  const total = Math.floor(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function checkSourceClipDuration(durationSec: number): void {
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new ValidationError("Không đọc được độ dài video");
  if (durationSec > SOURCE_CLIP_LIMITS.maxDurationSec + SourceClip.DURATION_TOLERANCE_SEC) {
    throw new ValidationError(`Video dài ${formatClock(durationSec)}, tối đa 5 phút. Hãy cắt ngắn rồi tải lại.`);
  }
}
