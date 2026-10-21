import type { SourceClipProbe, ClipInfo } from "@/client/media/MediaProbe";
import { checkSourceClipDuration, classifySourceClip } from "@/client/media/UploadValidator";
import type { UploadRepository } from "@/client/storage/UploadRepository";
import { DomainError, ValidationError } from "@/domain/errors";
import { SourceClip } from "@/domain/SourceClip";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface SourceClipState {
  busy: boolean;
  error: string | null;
}

export interface SourceClipControllerDeps {
  session: StudioSession;
  uploads: Pick<UploadRepository, "put" | "get" | "delete">;
  probe: SourceClipProbe;
  onAuthLost?: () => void;
}

export const UNREADABLE_CLIP = "Không đọc được video này. Hãy thử file MP4 (H.264) khác.";
export const NOT_UPLOAD_PROJECT = "Chưa có dự án kiểu Video tải lên";

/** Bước "Video của bạn": tải/thay/xoá đúng một video, chỉnh mức tiếng gốc. */
export class SourceClipController extends StateController<SourceClipState> {
  /** Tăng mỗi lần reset: lần tải bắt đầu ở dự án cũ phải bỏ kết quả. */
  private epoch = 0;

  constructor(private readonly deps: SourceClipControllerDeps) {
    super({ busy: false, error: null }, deps.onAuthLost);
  }

  /** Đang đọc/lưu file (blob có thể đã lưu nhưng chưa vào session): Wizard hoãn dọn file. */
  get ingesting(): boolean {
    return this.state.busy;
  }

  async upload(file: File): Promise<void> {
    if (this.state.busy) return;
    if (this.deps.session.state.project?.kind !== "upload") {
      this.patch({ error: NOT_UPLOAD_PROJECT });
      return;
    }
    const epoch = this.epoch;
    this.patch({ busy: true, error: null });
    try {
      classifySourceClip(file);
      const info = await this.read(file);
      checkSourceClipDuration(info.durationSec);
      const meta = await this.deps.uploads.put(file, { name: file.name, kind: "video" });
      if (epoch !== this.epoch || this.deps.session.state.project?.kind !== "upload") {
        await this.deps.uploads.delete(meta.id).catch(() => {});
        return;
      }
      const previous = this.deps.session.state.sourceClip;
      const clip = SourceClip.create({
        uploadId: meta.id,
        name: file.name,
        ...info,
        ...(previous ? { volumePercent: previous.volumePercent } : {}),
      });
      this.deps.session.update((d) => ({ ...d, sourceClip: clip }));
      if (previous && previous.uploadId !== meta.id) await this.deps.uploads.delete(previous.uploadId).catch(() => {});
    } catch (error) {
      if (epoch === this.epoch) this.patch({ error: this.report(error) });
    } finally {
      this.patch({ busy: false });
    }
  }

  setVolume(percent: number): void {
    try {
      const current = this.deps.session.state.sourceClip;
      if (!current) throw new ValidationError("Chưa tải video lên");
      const next = current.withVolume(percent);
      this.deps.session.update((d) => ({ ...d, sourceClip: next }));
      this.patch({ error: null });
    } catch (error) {
      this.patch({ error: this.report(error) });
    }
  }

  async remove(): Promise<void> {
    const current = this.deps.session.state.sourceClip;
    if (!current) return;
    this.deps.session.update((d) => ({ ...d, sourceClip: null }));
    this.patch({ error: null });
    await this.deps.uploads.delete(current.uploadId).catch(() => {});
  }

  /** Blob đã lưu (để xem lại); thiếu (bị trình duyệt dọn) thì null. */
  async blobFor(uploadId: string): Promise<Blob | null> {
    try {
      return (await this.deps.uploads.get(uploadId))?.blob ?? null;
    } catch {
      return null;
    }
  }

  /** Dự án mới: bỏ lỗi của dự án cũ; lần tải đang chạy sẽ tự xoá blob của nó. */
  reset(): void {
    this.epoch += 1;
    this.patch({ error: null });
  }

  /** Lỗi thô của bộ đọc (tiếng Anh, DOMException) đổi thành câu tiếng Việt. */
  private async read(file: File): Promise<ClipInfo> {
    try {
      return await this.deps.probe.clip(file);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new ValidationError(UNREADABLE_CLIP);
    }
  }
}
