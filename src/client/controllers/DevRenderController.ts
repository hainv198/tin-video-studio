import { MusicTrack } from "@/domain/MusicTrack";
import { NewsProject } from "@/domain/NewsProject";
import { SentenceSplitter } from "@/domain/SentenceSplitter";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { sequentialIds } from "@/domain/ids";
import { AudioDecodeService, type DecodedAudio } from "@/client/media/AudioDecodeService";
import type { SupportReport } from "@/client/render/BrowserSupport";
import { RenderCancelledError } from "@/client/render/errors";
import type { FootageInput, RenderJob, WorkerMessage } from "@/client/render/RenderJob";
import { ApiError } from "@/client/services/AuthClient";
import type { TtsApi } from "@/client/services/TtsClient";

/** 4 cảnh trám đã kiểm CORS (đặc tả mục 11). */
const DEV_FOOTAGE: FootageInput[] = [
  { kind: "image", url: "https://images.pexels.com/photos/2014422/pexels-photo-2014422.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" },
  { kind: "video", url: "https://videos.pexels.com/video-files/10476430/10476430-sd_640_338_25fps.mp4" },
  { kind: "image", url: "https://cdn.pixabay.com/photo/2013/10/15/09/12/flower-195893_640.jpg" },
  { kind: "video", url: "https://cdn.pixabay.com/video/2015/08/08/125-135736646_large.mp4" },
];

/** Tin mẫu (tin Phú Thọ trong video tham chiếu). */
export const DEV_SAMPLE = {
  text: [
    "Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã vì lạm quyền, tự ý bán trụ sở làm việc.",
    "Ngày 14 tháng 10, Công an tỉnh Phú Thọ cho biết đã khởi tố bị can, áp dụng biện pháp cấm đi khỏi nơi cư trú đối với hai cán bộ xã Trường Sơn.",
    "Hai bị can bị khởi tố về tội lạm quyền trong khi thi hành công vụ.",
    "Trong giai đoạn từ năm 2013 đến 2018, hai bị can đã tự ý bán tổng cộng 1.116,2 mét vuông đất thuộc các công trình công cộng cho 4 hộ dân.",
    "Tổng số tiền các bị can thu được từ việc bán đất là hơn 545 triệu đồng.",
    "Do việc bán đất không đúng thẩm quyền, các thửa đất trên phải thu hồi.",
  ].join(" "),
  sourceCredit: "Đức Phong - VietNamNet",
  publishDate: new Date(2026, 9, 14),
  footage: DEV_FOOTAGE,
  musicUrl: "/music/ban-tin-mac-dinh.mp3",
};

type Progress = Extract<WorkerMessage, { type: "progress" }>;

export interface DevRenderDeps {
  support: () => Promise<SupportReport>;
  tts: TtsApi;
  decode: (bytes: ArrayBuffer) => Promise<DecodedAudio>;
  fetchBytes: (url: string) => Promise<ArrayBuffer>;
  render: (job: RenderJob, onProgress?: (p: Progress) => void) => Promise<{ blob: Blob; durationSec: number }>;
  cancel: () => void;
  createUrl: (blob: Blob) => string;
  revokeUrl: (url: string) => void;
  origin: string;
}

export type DevRenderState =
  | { status: "idle" }
  | { status: "unsupported"; missing: string[] }
  | { status: "working"; label: string; percent: number }
  | { status: "done"; url: string; durationSec: number; sizeBytes: number }
  | { status: "error"; message: string };

const SAMPLE_RATE = 48000;
const STAGE_LABEL: Record<Progress["stage"], string> = {
  loading: "Nạp font và cảnh trám",
  audio: "Trộn âm thanh",
  video: "Dựng hình",
  finalizing: "Đóng gói MP4",
};

export class DevRenderController {
  private current: DevRenderState = { status: "idle" };
  private readonly listeners = new Set<() => void>();
  private cancelRequested = false;

  constructor(private readonly deps: DevRenderDeps) {}

  get state(): DevRenderState {
    return this.current;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async checkSupport(): Promise<void> {
    const report = await this.deps.support();
    if (!report.ok && this.current.status === "idle") this.set({ status: "unsupported", missing: report.missing });
  }

  cancel(): void {
    this.cancelRequested = true;
    this.deps.cancel();
  }

  async render(voiceName: string): Promise<void> {
    if (this.current.status === "working") return;
    if (this.current.status === "done") this.deps.revokeUrl(this.current.url);
    this.cancelRequested = false;
    try {
      const voice = VoiceSettings.create(voiceName);
      const project = NewsProject.fromText(
        { text: DEV_SAMPLE.text, sourceCredit: DEV_SAMPLE.sourceCredit, publishDate: DEV_SAMPLE.publishDate, templateId: "theanh28" },
        new SentenceSplitter(),
        sequentialIds("s"),
      );

      const narrations: RenderJob["narrations"] = [];
      for (const [i, scene] of project.scenes.entries()) {
        this.set({ status: "working", label: `Tạo giọng ${i + 1}/${project.scenes.length}`, percent: (i / project.scenes.length) * 20 });
        const decoded = await this.deps.decode(await this.deps.tts.synthesize(scene.text, voice.voiceName, voice.speakingRate));
        this.throwIfCancelled();
        narrations.push({ sceneId: scene.id, durationSec: decoded.durationSec, samples: AudioDecodeService.toMono(decoded.channels) });
      }

      this.set({ status: "working", label: "Nạp nhạc nền", percent: 20 });
      const music = await this.deps.decode(await this.deps.fetchBytes(DEV_SAMPLE.musicUrl));
      this.throwIfCancelled();
      const track = MusicTrack.create({ id: "ban-tin-mac-dinh", title: "Bản tin", origin: "library", uri: DEV_SAMPLE.musicUrl });

      const job: RenderJob = {
        templateId: project.templateId,
        brandValues: {},
        logo: null,
        project: {
          displayTitle: project.displayTitle,
          sourceCredit: project.sourceCredit,
          publishDateText: project.formattedPublishDate(),
        },
        scenes: project.scenes.map((s, i) => ({
          sceneId: s.id,
          role: s.role,
          text: s.text,
          footage: { ...(DEV_SAMPLE.footage[i % DEV_SAMPLE.footage.length] as FootageInput) },
        })),
        narrations,
        music: { channels: music.channels, levelBelowVoiceDb: track.levelBelowVoiceDb },
        sampleRate: SAMPLE_RATE,
        origin: this.deps.origin,
      };

      this.throwIfCancelled();
      let lastRatio = 0;
      const result = await this.deps.render(job, (p) => {
        if (p.frame && p.totalFrames) lastRatio = p.frame / p.totalFrames;
        const ratio = lastRatio;
        const label = p.stage === "video" ? `${STAGE_LABEL.video} ${Math.round(ratio * 100)}%` : STAGE_LABEL[p.stage];
        this.set({ status: "working", label, percent: 25 + ratio * 70 });
      });
      this.set({ status: "done", url: this.deps.createUrl(result.blob), durationSec: result.durationSec, sizeBytes: result.blob.size });
    } catch (error) {
      if (error instanceof RenderCancelledError) {
        this.set({ status: "idle" });
        return;
      }
      const message = error instanceof ApiError || error instanceof Error ? error.message : "Dựng video thất bại";
      this.set({ status: "error", message });
    }
  }

  private throwIfCancelled(): void {
    if (this.cancelRequested) throw new RenderCancelledError();
  }

  private set(state: DevRenderState): void {
    this.current = state;
    for (const listener of this.listeners) listener();
  }
}
