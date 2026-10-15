import { ValidationError } from "@/domain/errors";
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
): UploadKind {
  if (file.size <= 0) throw new ValidationError("File rỗng");
  const ext = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase() : "";
  const kind = MIME[file.type.toLowerCase()] ?? EXT[ext];
  if (!kind) throw new ValidationError(`Định dạng không được hỗ trợ: ${ext || file.type || "không rõ"}`);
  if (!allowed.includes(kind)) throw new ValidationError(`Không nhận file ${LABEL[kind]} ở đây`);
  if (file.size > UPLOAD_LIMITS[kind]) {
    throw new ValidationError(`File quá lớn (tối đa ${UPLOAD_LIMITS[kind] / MB} MB cho ${LABEL[kind]})`);
  }
  return kind;
}
