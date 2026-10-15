import { parseUploadUri } from "@/client/media/footageFactory";
import type { UploadRepository } from "@/client/storage/UploadRepository";
import { ValidationError } from "@/domain/errors";
import type { MusicTrack } from "@/domain/MusicTrack";
import { ApiError, assertSameSession } from "./apiError";

/** Lấy dữ liệu một bản nhạc: nhạc trong kho (tải từ máy chủ của app) hoặc nhạc người dùng tải lên. */
export class TrackSource {
  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly uploads: Pick<UploadRepository, "get">,
  ) {}

  async blob(track: MusicTrack): Promise<Blob> {
    if (track.origin === "upload") {
      const id = parseUploadUri(track.uri);
      const stored = id ? await this.uploads.get(id) : null;
      if (!stored) throw new ValidationError("Không tìm thấy file nhạc đã tải lên, hãy chọn lại");
      return stored.blob;
    }
    if (!track.uri.startsWith("/") || track.uri.startsWith("//")) throw new ValidationError("Nguồn nhạc không hợp lệ");
    const response = await this.fetchImpl(track.uri);
    assertSameSession(response);
    if (!response.ok) throw new ApiError(response.status, "TRACK", "Không tải được nhạc nền");
    return response.blob();
  }

  async bytes(track: MusicTrack): Promise<ArrayBuffer> {
    return (await this.blob(track)).arrayBuffer();
  }
}
