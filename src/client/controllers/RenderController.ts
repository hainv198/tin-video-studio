import type { SupportReport } from "@/client/render/BrowserSupport";
import { RenderCancelledError } from "@/client/render/errors";
import type { RenderJob, WorkerMessage } from "@/client/render/RenderJob";
import { fileNameFor } from "./fileName";
import type { RenderJobBuilder } from "./RenderJobBuilder";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

type Progress = Extract<WorkerMessage, { type: "progress" }>;

export type RenderState =
  | { status: "idle" }
  | { status: "unsupported"; missing: string[] }
  | { status: "working"; label: string; percent: number }
  | { status: "done"; url: string; durationSec: number; sizeBytes: number; fileName: string; warnings: string[]; stale: boolean }
  | { status: "error"; message: string };

export interface RenderControllerDeps {
  session: StudioSession;
  builder: Pick<RenderJobBuilder, "build">;
  render: (job: RenderJob, onProgress?: (p: Progress) => void) => Promise<{ blob: Blob; durationSec: number }>;
  cancelRender: () => void;
  support: () => Promise<SupportReport>;
  probeWorker: () => Promise<string[]>;
  createUrl: (blob: Blob) => string;
  revokeUrl: (url: string) => void;
  onAuthLost?: () => void;
}

const STAGE_LABEL: Record<Progress["stage"], string> = {
  loading: "Nạp font và cảnh trám",
  audio: "Trộn âm thanh",
  video: "Dựng hình",
  finalizing: "Đóng gói MP4",
};

/** Bước 5: dựng video và trả về MP4 để xem lại, tải về. */
export class RenderController extends StateController<RenderState> {
  private cancelRequested = false;
  /** Đổi mỗi lần bắt đầu/huỷ/reset: kết quả của lượt dựng cũ bị bỏ. */
  private run = 0;
  private dirtyDuringWork = false;

  constructor(private readonly deps: RenderControllerDeps) {
    super({ status: "idle" }, deps.onAuthLost);
  }

  async checkSupport(): Promise<void> {
    if (this.state.status !== "idle") return;
    try {
      const report = await this.deps.support();
      if (!report.ok) {
        if (this.state.status === "idle") this.set({ status: "unsupported", missing: report.missing });
        return;
      }
      const missing = await this.deps.probeWorker();
      if (missing.length > 0 && this.state.status === "idle") this.set({ status: "unsupported", missing });
    } catch (error) {
      if (this.state.status === "idle") this.set({ status: "unsupported", missing: [this.report(error)] });
    }
  }

  async start(): Promise<void> {
    if (this.state.status === "working" || this.state.status === "unsupported") return;
    if (this.state.status === "done") this.deps.revokeUrl(this.state.url);
    this.cancelRequested = false;
    this.dirtyDuringWork = false;
    const run = ++this.run;
    this.set({ status: "working", label: "Chuẩn bị", percent: 0 });
    try {
      const data = this.deps.session.state;
      const { job, warnings } = await this.deps.builder.build(
        data,
        (label, ratio) => {
          if (run === this.run) this.set({ status: "working", label, percent: ratio * 25 });
        },
        () => this.cancelRequested,
      );
      if (this.cancelRequested || run !== this.run) throw new RenderCancelledError();
      let lastRatio = 0;
      const result = await this.deps.render(job, (p) => {
        if (run !== this.run) return;
        if (p.frame && p.totalFrames) lastRatio = p.frame / p.totalFrames;
        const label = p.stage === "video" ? `${STAGE_LABEL.video} ${Math.round(lastRatio * 100)}%` : STAGE_LABEL[p.stage];
        this.set({ status: "working", label, percent: 25 + lastRatio * 70 });
      });
      if (run !== this.run) return;
      if (this.cancelRequested) throw new RenderCancelledError();
      const project = data.project!;
      this.set({
        status: "done",
        url: this.deps.createUrl(result.blob),
        durationSec: result.durationSec,
        sizeBytes: result.blob.size,
        fileName: fileNameFor(project.displayTitle, project.publishDate),
        warnings,
        stale: this.dirtyDuringWork,
      });
    } catch (error) {
      if (run !== this.run) return;
      if (error instanceof RenderCancelledError) {
        this.set({ status: "idle" });
        return;
      }
      this.set({ status: "error", message: this.report(error) });
    }
  }

  /** Dự án đổi sau khi dựng xong: giữ video nhưng đánh dấu đã cũ. */
  markStale(): void {
    if (this.state.status === "working") this.dirtyDuringWork = true;
    else if (this.state.status === "done" && !this.state.stale) this.set({ ...this.state, stale: true });
  }

  cancel(): void {
    this.cancelRequested = true;
    this.run += 1;
    this.deps.cancelRender();
    if (this.state.status === "working") this.set({ status: "idle" });
  }

  /** Dự án mới: huỷ lượt dựng, thu hồi url bản cũ, về `idle` (trừ `unsupported`). */
  reset(): void {
    if (this.state.status === "unsupported") return;
    if (this.state.status === "working") this.cancel();
    if (this.state.status === "done") this.deps.revokeUrl(this.state.url);
    this.set({ status: "idle" });
  }

  dispose(): void {
    this.cancel();
    if (this.state.status === "done") this.deps.revokeUrl(this.state.url);
  }
}
