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

export abstract class Footage {
  abstract readonly kind: "image" | "video" | "fallback";

  constructor(readonly id: string) {
    if (!id) throw new ValidationError("Cảnh trám thiếu id");
  }

  abstract playbackFor(sceneDurationSec: number): FootagePlayback;
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
}

export class FallbackFootage extends Footage {
  readonly kind = "fallback" as const;

  playbackFor(_sceneDurationSec: number): FootagePlayback {
    return { mode: "none" };
  }
}
