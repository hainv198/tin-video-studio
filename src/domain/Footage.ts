import { ValidationError } from "./errors";

export type FootageOrigin = "upload" | "pexels" | "pixabay" | "fake";

export interface FootageSource {
  origin: FootageOrigin;
  uri: string;
  credit?: string;
  pageUrl?: string;
}

export interface FootagePlayback {
  mode: "still" | "clip" | "loop" | "none";
  sourceDurationSec?: number;
}

export type FootageSnapshot =
  | { kind: "image"; id: string; source: FootageSource; width: number; height: number }
  | { kind: "video"; id: string; source: FootageSource; width: number; height: number; durationSec: number }
  | { kind: "fallback"; id: string };

export abstract class Footage {
  abstract readonly kind: "image" | "video" | "fallback";

  constructor(readonly id: string) {
    if (!id) throw new ValidationError("Cảnh trám thiếu id");
  }

  abstract playbackFor(sceneDurationSec: number): FootagePlayback;

  abstract snapshot(): FootageSnapshot;
}

function assertSource(source: FootageSource, width: number, height: number): void {
  if (!source.uri) throw new ValidationError("Cảnh trám thiếu nguồn");
  if (!(width > 0) || !(height > 0)) throw new ValidationError("Kích thước cảnh trám không hợp lệ");
}

export class ImageFootage extends Footage {
  readonly kind = "image" as const;

  constructor(
    id: string,
    readonly source: FootageSource,
    readonly width: number,
    readonly height: number,
  ) {
    super(id);
    assertSource(source, width, height);
  }

  get aspectRatio(): number {
    return this.width / this.height;
  }

  playbackFor(_sceneDurationSec: number): FootagePlayback {
    return { mode: "still" };
  }

  snapshot(): FootageSnapshot {
    return { kind: "image", id: this.id, source: { ...this.source }, width: this.width, height: this.height };
  }
}

export class VideoFootage extends Footage {
  readonly kind = "video" as const;

  constructor(
    id: string,
    readonly source: FootageSource,
    readonly width: number,
    readonly height: number,
    readonly durationSec: number,
  ) {
    super(id);
    assertSource(source, width, height);
    if (!(durationSec > 0)) throw new ValidationError("Độ dài video cảnh trám không hợp lệ");
  }

  playbackFor(sceneDurationSec: number): FootagePlayback {
    const mode = sceneDurationSec <= this.durationSec ? "clip" : "loop";
    return { mode, sourceDurationSec: this.durationSec };
  }

  snapshot(): FootageSnapshot {
    return {
      kind: "video",
      id: this.id,
      source: { ...this.source },
      width: this.width,
      height: this.height,
      durationSec: this.durationSec,
    };
  }
}

export class FallbackFootage extends Footage {
  readonly kind = "fallback" as const;

  playbackFor(_sceneDurationSec: number): FootagePlayback {
    return { mode: "none" };
  }

  snapshot(): FootageSnapshot {
    return { kind: "fallback", id: this.id };
  }
}

const FOOTAGE_ORIGINS: readonly FootageOrigin[] = ["upload", "pexels", "pixabay", "fake"];

function sourceFromSnapshot(v: unknown): FootageSource {
  const src = v as Record<string, unknown> | null;
  if (typeof src !== "object" || src === null) throw new ValidationError("Bản nháp hỏng: nguồn cảnh trám không hợp lệ");
  if (!FOOTAGE_ORIGINS.includes(src.origin as FootageOrigin) || typeof src.uri !== "string") {
    throw new ValidationError("Bản nháp hỏng: nguồn cảnh trám không hợp lệ");
  }
  if (src.credit !== undefined && typeof src.credit !== "string") {
    throw new ValidationError("Bản nháp hỏng: nguồn cảnh trám không hợp lệ");
  }
  if (src.pageUrl !== undefined && typeof src.pageUrl !== "string") {
    throw new ValidationError("Bản nháp hỏng: nguồn cảnh trám không hợp lệ");
  }
  return { ...(src as unknown as FootageSource) };
}

export function footageFromSnapshot(s: FootageSnapshot): Footage {
  const raw = s as unknown as Record<string, unknown> | null;
  if (typeof raw !== "object" || raw === null) throw new ValidationError("Bản nháp hỏng: dữ liệu cảnh trám không hợp lệ");
  if (typeof raw.id !== "string") throw new ValidationError("Bản nháp hỏng: cảnh trám thiếu id");
  switch (raw.kind) {
    case "image":
      if (typeof raw.width !== "number" || typeof raw.height !== "number") {
        throw new ValidationError("Bản nháp hỏng: kích thước cảnh trám không hợp lệ");
      }
      return new ImageFootage(raw.id, sourceFromSnapshot(raw.source), raw.width, raw.height);
    case "video":
      if (typeof raw.width !== "number" || typeof raw.height !== "number" || typeof raw.durationSec !== "number") {
        throw new ValidationError("Bản nháp hỏng: kích thước hoặc độ dài video không hợp lệ");
      }
      return new VideoFootage(raw.id, sourceFromSnapshot(raw.source), raw.width, raw.height, raw.durationSec);
    case "fallback":
      return new FallbackFootage(raw.id);
    default:
      throw new ValidationError("Bản nháp hỏng: loại cảnh trám không hợp lệ");
  }
}
