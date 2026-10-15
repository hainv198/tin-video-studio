import { ImageFootage, VideoFootage, type Footage, type FootageSource } from "@/domain/Footage";
import { ValidationError } from "@/domain/errors";
import type { StockItemDto } from "@/client/services/StockClient";

export function stockItemToFootage(item: StockItemDto, id: string): Footage {
  const source: FootageSource = { origin: item.provider, uri: item.fullUrl, credit: item.author, pageUrl: item.pageUrl };
  if (item.kind === "image") return new ImageFootage(id, source, item.width, item.height);
  if (!item.durationSec) throw new ValidationError("Video thiếu độ dài");
  return new VideoFootage(id, source, item.width, item.height, item.durationSec);
}

const UPLOAD_PREFIX = "upload:";

export function uploadUri(id: string): string {
  return `${UPLOAD_PREFIX}${id}`;
}

export function parseUploadUri(uri: string): string | null {
  if (!uri.startsWith(UPLOAD_PREFIX)) return null;
  const id = uri.slice(UPLOAD_PREFIX.length);
  return id.length > 0 ? id : null;
}

export function uploadToFootage(
  id: string,
  uploadId: string,
  kind: "image" | "video",
  probe: { width: number; height: number; durationSec?: number },
): Footage {
  if (!uploadId) throw new ValidationError("Thiếu mã file tải lên");
  const source: FootageSource = { origin: "upload", uri: uploadUri(uploadId) };
  if (kind === "image") return new ImageFootage(id, source, probe.width, probe.height);
  if (!probe.durationSec) throw new ValidationError("Video thiếu độ dài");
  return new VideoFootage(id, source, probe.width, probe.height, probe.durationSec);
}
