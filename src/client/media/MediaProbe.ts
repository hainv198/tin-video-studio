import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import type { AudioDecodeService } from "./AudioDecodeService";

export interface MediaProbe {
  image(blob: Blob): Promise<{ width: number; height: number }>;
  video(blob: Blob): Promise<{ width: number; height: number; durationSec: number }>;
  audio(blob: Blob): Promise<{ durationSec: number }>;
}

export interface ClipInfo {
  width: number;
  height: number;
  /** Giây, tính từ khung hình đầu. */
  durationSec: number;
  /** Có track âm và trình duyệt giải mã được. */
  hasAudio: boolean;
}

/** Đọc thông tin video của kiểu "Video tải lên". */
export interface SourceClipProbe {
  clip(blob: Blob): Promise<ClipInfo>;
}

/** Đọc kích thước/độ dài của file người dùng tải lên bằng API của trình duyệt (cần WebCodecs/Web Audio, chỉ chạy ở luồng chính). */
export class BrowserMediaProbe implements MediaProbe, SourceClipProbe {
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

  async clip(blob: Blob): Promise<ClipInfo> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    try {
      const video = await input.getPrimaryVideoTrack();
      if (!video) throw new Error("File video không có hình");
      if (!(await video.canDecode())) throw new Error("Trình duyệt không giải mã được hình của video này");
      const first = await video.getFirstTimestamp();
      const audio = await input.getPrimaryAudioTrack();
      return {
        width: await video.getDisplayWidth(),
        height: await video.getDisplayHeight(),
        durationSec: (await video.computeDuration()) - first,
        hasAudio: audio !== null && (await audio.canDecode()),
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
