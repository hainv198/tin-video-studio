import type { DecodedImage } from "@/client/preview/PreviewController";

/** Tải một ảnh tĩnh của app (URL tương đối) và giải mã thành ImageBitmap; dispose() nhả bộ nhớ ảnh. */
export async function loadImageUrl(url: string, origin: string): Promise<DecodedImage> {
  const response = await fetch(new URL(url, origin));
  if (!response.ok) throw new Error(`Không tải được ảnh (${response.status})`);
  const bitmap = await createImageBitmap(await response.blob());
  return { image: { source: bitmap, width: bitmap.width, height: bitmap.height }, dispose: () => bitmap.close() };
}
