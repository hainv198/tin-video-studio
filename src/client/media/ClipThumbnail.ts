import type { DrawableImage } from "@/templates/VideoTemplate";
import { VideoFrameProvider } from "./MediaFrameProvider";

/**
 * Lấy khung ở giây `atSec` (tính từ khung đầu) của video làm ảnh tĩnh cho xem trước. Vẽ sang canvas riêng vì canvas
 * của bộ đọc nằm trong vùng dùng lại. Chỉ chạy trên trình duyệt (cần WebCodecs, document).
 */
export async function loadClipThumbnail(blob: Blob, atSec: number): Promise<{ image: DrawableImage; dispose(): void }> {
  const frames = await VideoFrameProvider.open(blob, 1080);
  try {
    const frame = await frames.frameAt(frames.startSec + atSec);
    if (!frame) throw new Error("Video không có khung hình");
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Trình duyệt không cấp được canvas 2D");
    ctx.drawImage(frame.source, 0, 0);
    return {
      image: { source: canvas, width: canvas.width, height: canvas.height },
      dispose: () => {
        canvas.width = 0;
        canvas.height = 0;
      },
    };
  } finally {
    frames.dispose();
  }
}
