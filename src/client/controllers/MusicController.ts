import { uploadUri } from "@/client/media/footageFactory";
import type { MediaProbe } from "@/client/media/MediaProbe";
import { classifyUpload } from "@/client/media/UploadValidator";
import type { MusicLibrary } from "@/client/services/MusicLibrary";
import type { TrackSource } from "@/client/services/TrackSource";
import type { UploadRepository } from "@/client/storage/UploadRepository";
import { ValidationError } from "@/domain/errors";
import { MusicTrack } from "@/domain/MusicTrack";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface MusicState {
  library: MusicTrack[];
  uploaded: MusicTrack[];
  loading: boolean;
  busy: boolean;
  error: string | null;
}

export interface MusicControllerDeps {
  session: StudioSession;
  library: Pick<MusicLibrary, "list">;
  uploads: Pick<UploadRepository, "put">;
  tracks: Pick<TrackSource, "blob">;
  probe: MediaProbe;
  onAuthLost?: () => void;
}

/** Bước 4: chọn nhạc trong kho, tải nhạc lên, hoặc không nhạc; chỉnh âm lượng ±6 dB. */
export class MusicController extends StateController<MusicState> {
  constructor(private readonly deps: MusicControllerDeps) {
    super({ library: [], uploaded: [], loading: false, busy: false, error: null }, deps.onAuthLost);
  }

  async loadLibrary(): Promise<void> {
    this.patch({ loading: true, error: null });
    try {
      this.patch({ library: await this.deps.library.list(), loading: false });
    } catch (error) {
      this.patch({ loading: false, error: this.report(error) });
    }
  }

  /** Dữ liệu để View nghe thử (nhạc kho hoặc nhạc tải lên). */
  async previewBlob(track: MusicTrack): Promise<Blob | null> {
    try {
      const blob = await this.deps.tracks.blob(track);
      this.patch({ error: null });
      return blob;
    } catch (error) {
      this.patch({ error: this.report(error) });
      return null;
    }
  }

  choose(track: MusicTrack): void {
    const offset = this.deps.session.state.music?.gainOffsetDb ?? 0;
    try {
      const next = track.withGainOffset(offset);
      this.deps.session.update((d) => ({ ...d, music: next }));
      this.patch({ error: null });
    } catch (error) {
      this.patch({ error: this.report(error) });
    }
  }

  none(): void {
    this.deps.session.update((d) => ({ ...d, music: null }));
    this.patch({ error: null });
  }

  setGainOffset(db: number): void {
    try {
      const current = this.deps.session.state.music;
      if (!current) throw new ValidationError("Chưa chọn nhạc");
      const next = current.withGainOffset(db);
      this.deps.session.update((d) => ({ ...d, music: next }));
      this.patch({ error: null });
    } catch (error) {
      this.patch({ error: this.report(error) });
    }
  }

  async uploadTrack(file: File): Promise<void> {
    this.patch({ busy: true, error: null });
    try {
      classifyUpload(file, ["audio"]);
      await this.deps.probe.audio(file); // kiểm giải mã được trước khi lưu
      const meta = await this.deps.uploads.put(file, { name: file.name, kind: "audio" });
      const track = MusicTrack.create({
        id: meta.id,
        title: file.name.replace(/\.[^.]+$/, ""),
        origin: "upload",
        uri: uploadUri(meta.id),
      });
      this.patch({ uploaded: [...this.state.uploaded, track] });
      this.choose(track);
    } catch (error) {
      this.patch({ error: this.report(error) });
    } finally {
      this.patch({ busy: false });
    }
  }
}
