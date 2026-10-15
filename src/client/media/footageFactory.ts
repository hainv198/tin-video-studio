import { ImageFootage, VideoFootage, type Footage, type FootageSource } from "@/domain/Footage";
import { ValidationError } from "@/domain/errors";
import type { StockItemDto } from "@/client/services/StockClient";

export function stockItemToFootage(item: StockItemDto, id: string): Footage {
  const source: FootageSource = { origin: item.provider, uri: item.fullUrl, credit: item.author, pageUrl: item.pageUrl };
  if (item.kind === "image") return new ImageFootage(id, source, item.width, item.height);
  if (!item.durationSec) throw new ValidationError("Video thiếu độ dài");
  return new VideoFootage(id, source, item.width, item.height, item.durationSec);
}

export function uploadToFootage(
  id: string,
  uploadId: string,
  kind: "image" | "video",
  probe: { width: number; height: number; durationSec?: number },
): Footage {
  const source: FootageSource = { origin: "upload", uri: `upload:${uploadId}` };
  if (kind === "image") return new ImageFootage(id, source, probe.width, probe.height);
  if (!probe.durationSec) throw new ValidationError("Video thiếu độ dài");
  return new VideoFootage(id, source, probe.width, probe.height, probe.durationSec);
}
