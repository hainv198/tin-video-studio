import type { SceneRole } from "@/domain/Scene";
import type { MusicBed } from "@/client/media/AudioMix";

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
}

export interface NarrationInput {
  sceneId: string;
  durationSec: number;
  /** Mono, cùng sampleRate với job. */
  samples: Float32Array;
}

export interface RenderJob {
  templateId: string;
  brandValues: Record<string, string>;
  logo: Blob | null;
  project: { displayTitle: string; sourceCredit: string; publishDateText: string };
  scenes: RenderSceneInput[];
  narrations: NarrationInput[];
  music: MusicBed | null;
  sampleRate: number;
  /** Origin của trang, để worker dựng URL tuyệt đối cho font và media tương đối. */
  origin: string;
}

export type WorkerRequest = { type: "start"; job: RenderJob };

export type RenderStage = "loading" | "audio" | "video" | "finalizing";

export type WorkerMessage =
  | { type: "progress"; stage: RenderStage; frame?: number; totalFrames?: number }
  | { type: "done"; blob: Blob; durationSec: number }
  | { type: "error"; message: string };
