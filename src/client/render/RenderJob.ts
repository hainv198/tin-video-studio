import type { SceneRole } from "@/domain/Scene";
import type { MusicBed } from "@/client/media/AudioMix";
import type { UploadComposition } from "@/domain/UploadComposition";
import type { VideoOptionsSnapshot } from "@/domain/VideoOptions";

export interface FootageInput {
  kind: "image" | "video" | "fallback";
  blob?: Blob;
  url?: string;
}

export interface RenderSceneInput {
  sceneId: string;
  role: SceneRole;
  text: string;
  footage: FootageInput;
  /** Đoạn không có cảnh trám riêng: id đoạn chủ cảnh (đứng trước) mà ảnh/video được dùng tiếp; `footage` khi đó bỏ qua. */
  footageFrom?: string;
}

export interface NarrationInput {
  sceneId: string;
  durationSec: number;
  /** Mono, cùng sampleRate với job. */
  samples: Float32Array;
}

/** Video người dùng tải lên (kiểu "Video tải lên"): phát trọn sau thẻ tiêu đề. */
export interface SourceClipInput {
  blob: Blob;
  /** Giây, tính từ khung hình đầu (từ MediaProbe). */
  durationSec: number;
  hasAudio: boolean;
  /** Hệ số tuyến tính 0–1,5 cho tiếng gốc (0 = tắt). */
  gain: number;
  /** Giây (tính từ khung đầu) lấy ảnh cho thẻ tiêu đề. */
  thumbnailSec: number;
  /** "title-over-clip": đọc tiêu đề đè trên video (không thẻ đầu); bỏ trống = thẻ tiêu đề rồi video. */
  composition?: UploadComposition;
}

export interface RenderJob {
  templateId: string;
  brandValues: Record<string, string>;
  logo: Blob | null;
  /** Banner chân riêng (phong cách có banner); bỏ trống = worker dùng banner mặc định của phong cách. */
  banner?: Blob;
  project: { displayTitle: string; sourceCredit: string; publishDateText: string; mediaCredit?: string };
  scenes: RenderSceneInput[];
  narrations: NarrationInput[];
  music: MusicBed | null;
  sampleRate: number;
  /** Origin của trang, để worker dựng URL tuyệt đối cho font và media tương đối. */
  origin: string;
  /** Bitrate hình (bps); bỏ trống dùng RENDER_VIDEO_BITRATE. */
  videoBitrate?: number;
  /** Tuỳ chọn riêng của video: font chữ, phụ đề, màu thumbnail đầu. */
  options: VideoOptionsSnapshot;
  /** Có khi kiểu "Video tải lên"; bỏ trống = dựng như bản tin nhiều cảnh. */
  sourceClip?: SourceClipInput;
}

export type WorkerRequest = { type: "start"; job: RenderJob } | { type: "probe" };

export type RenderStage = "loading" | "audio" | "video" | "finalizing";

export type WorkerMessage =
  | { type: "progress"; stage: RenderStage; frame?: number; totalFrames?: number }
  | { type: "done"; blob: Blob; durationSec: number }
  | { type: "probe-result"; missing: string[] }
  | { type: "error"; message: string };
