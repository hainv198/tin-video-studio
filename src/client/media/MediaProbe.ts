import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import type { AudioDecodeService } from "./AudioDecodeService";

export interface MediaProbe {
  image(blob: Blob): Promise<{ width: number; height: number }>;
  video(blob: Blob): Promise<{ width: number; height: number; durationSec: number }>;
  audio(blob: Blob): Promise<{ durationSec: number }>;
}

/** Đọc kích thước/độ dài của file người dùng tải lên bằng API của trình duyệt (cần WebCodecs/Web Audio, chỉ chạy ở luồng chính). */
export class BrowserMediaProbe implements MediaProbe {
  constructor(private readonly decoder: AudioDecodeService) {}

  async image(blob: Blob): Promise<{ width: number; height: number }> {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  }

  async video(blob: Blob): Promise<{ width: number; height: number; durationSec: number }> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track) throw new Error("File video không có hình");
      return {
        width: await track.getDisplayWidth(),
        height: await track.getDisplayHeight(),
        durationSec: await track.computeDuration(),
      };
    } finally {
      input.dispose();
    }
  }

  async audio(blob: Blob): Promise<{ durationSec: number }> {
    const decoded = await this.decoder.decode(await blob.arrayBuffer());
    return { durationSec: decoded.durationSec };
  }
}
