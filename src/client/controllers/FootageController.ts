import { classifyUpload } from "@/client/media/UploadValidator";
import { parseUploadUri, uploadToFootage } from "@/client/media/footageFactory";
import type { MediaProbe } from "@/client/media/MediaProbe";
import type { UploadRepository } from "@/client/storage/UploadRepository";
import { userMessage } from "@/client/errors/userMessage";
import type { Footage } from "@/domain/Footage";
import type { IdGenerator } from "@/domain/ids";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface FootageState {
  busy: boolean;
  error: string | null;
  /** Footage tạo từ file tải lên trong phiên này (nằm trong "kho" để dùng lại cho nhiều cảnh). */
  added: Footage[];
}

export interface FootageControllerDeps {
  session: StudioSession;
  uploads: Pick<UploadRepository, "put" | "get">;
  probe: MediaProbe;
  ids: IdGenerator;
  onAuthLost?: () => void;
}

/** Bước 3 (phần tải lên): file của người dùng, gán lần lượt, thay thế, hoán đổi. */
export class FootageController extends StateController<FootageState> {
  /** Số lần tải đang chạy song song; `busy` = còn lần nào chưa xong. */
  private inFlight = 0;

  constructor(private readonly deps: FootageControllerDeps) {
    super({ busy: false, error: null, added: [] }, deps.onAuthLost);
  }

  async addFiles(files: readonly File[]): Promise<void> {
    if (!this.deps.session.state.project) {
      this.patch({ error: "Chưa có dự án" });
      return;
    }
    const { footages, errors } = await this.ingest(files);
    if (footages.length > 0) {
      // Đọc danh sách cảnh lúc ghi (không phải lúc bắt đầu) để tôn trọng cảnh tách/gộp trong lúc đọc file.
      this.deps.session.update((d) => ({
        ...d,
        footage: d.footage.fillInOrder(d.project?.scenes.map((s) => s.id) ?? [], footages),
      }));
    }
    this.finishWith(errors);
  }

  async replaceWithFile(sceneId: string, file: File): Promise<void> {
    if (!this.deps.session.state.project) {
      this.patch({ error: "Chưa có dự án" });
      return;
    }
    const { footages, errors } = await this.ingest([file]);
    const footage = footages[0];
    if (footage) this.deps.session.update((d) => ({ ...d, footage: d.footage.assign(sceneId, footage) }));
    this.finishWith(errors);
  }

  /** Có lỗi thì hiện; không lỗi thì chỉ xoá lỗi cũ khi không còn lần tải nào khác đang chạy. */
  private finishWith(errors: string[]): void {
    if (errors.length > 0) this.patch({ error: errors.join("; ") });
    else if (this.inFlight === 0) this.patch({ error: null });
  }

  /** File tải lên đã thêm trong phiên + file tải lên đang nằm trong bảng cảnh trám, không trùng id. */
  pool(): Footage[] {
    const byId = new Map<string, Footage>();
    for (const f of this.state.added) byId.set(f.id, f);
    const board = this.deps.session.state.footage;
    for (const sceneId of board.sceneIds()) {
      const f = board.get(sceneId);
      const snap = f?.snapshot();
      if (f && snap && snap.kind !== "fallback" && snap.source.origin === "upload") byId.set(f.id, f);
    }
    return [...byId.values()];
  }

  assignFromPool(sceneId: string, footageId: string): void {
    const footage = this.pool().find((f) => f.id === footageId);
    if (!footage) {
      this.patch({ error: "Không tìm thấy file trong danh sách đã tải lên" });
      return;
    }
    this.deps.session.update((d) => ({ ...d, footage: d.footage.assign(sceneId, footage) }));
    this.patch({ error: null });
  }

  /** Nguồn xem trước: URL (stock), Blob (file tải lên), null (chưa gán, nền mặc định hoặc file đã mất). */
  async previewSource(footage: Footage | undefined): Promise<string | Blob | null> {
    const snap = footage?.snapshot();
    if (!snap || snap.kind === "fallback") return null;
    if (snap.source.origin !== "upload") return snap.source.uri;
    const id = parseUploadUri(snap.source.uri);
    const stored = id ? await this.deps.uploads.get(id) : null;
    return stored?.blob ?? null;
  }

  unassign(sceneId: string): void {
    this.deps.session.update((d) => ({ ...d, footage: d.footage.unassign(sceneId) }));
  }

  swap(a: string, b: string): void {
    this.deps.session.update((d) => ({ ...d, footage: d.footage.swap(a, b) }));
  }

  private async ingest(files: readonly File[]): Promise<{ footages: Footage[]; errors: string[] }> {
    this.inFlight += 1;
    this.patch({ busy: true });
    const footages: Footage[] = [];
    const errors: string[] = [];
    try {
      for (const file of files) {
        try {
          // Chỉ cho phép ảnh/video nên kết quả không thể là "audio".
          const kind = classifyUpload(file, ["image", "video"]) as "image" | "video";
          let info;
          try {
            info = kind === "image" ? await this.deps.probe.image(file) : await this.deps.probe.video(file);
          } catch (error) {
            errors.push(`${file.name}: ${userMessage(error, "Không đọc được file (hỏng hoặc không đúng định dạng)")}`);
            continue;
          }
          const meta = await this.deps.uploads.put(file, { name: file.name, kind });
          footages.push(uploadToFootage(this.deps.ids(), meta.id, kind, info));
        } catch (error) {
          errors.push(`${file.name}: ${this.report(error)}`);
        }
      }
      if (footages.length > 0) this.patch({ added: [...this.state.added, ...footages] });
    } finally {
      this.inFlight -= 1;
      this.patch({ busy: this.inFlight > 0 });
    }
    return { footages, errors };
  }
}
