import { ValidationError } from "./errors";

export type MusicOrigin = "library" | "upload";

export interface MusicTrackProps {
  id: string;
  title: string;
  origin: MusicOrigin;
  uri: string;
  gainOffsetDb?: number;
}

export interface MusicTrackSnapshot {
  id: string;
  title: string;
  origin: MusicOrigin;
  uri: string;
  gainOffsetDb: number;
}

export class MusicTrack {
  static readonly MIN_OFFSET_DB = -6;
  static readonly MAX_OFFSET_DB = 6;
  static readonly BELOW_VOICE_DB = 15;

  private constructor(
    readonly id: string,
    readonly title: string,
    readonly origin: MusicOrigin,
    readonly uri: string,
    readonly gainOffsetDb: number,
  ) {}

  static create(p: MusicTrackProps): MusicTrack {
    if (!p.id || !p.uri) throw new ValidationError("Bản nhạc thiếu nguồn");
    const offset = p.gainOffsetDb ?? 0;
    if (!Number.isFinite(offset) || offset < MusicTrack.MIN_OFFSET_DB || offset > MusicTrack.MAX_OFFSET_DB) {
      throw new ValidationError("Chỉnh âm lượng nhạc chỉ trong khoảng ±6 dB");
    }
    return new MusicTrack(p.id, p.title.trim() || p.id, p.origin, p.uri, offset);
  }

  withGainOffset(db: number): MusicTrack {
    return MusicTrack.create({ id: this.id, title: this.title, origin: this.origin, uri: this.uri, gainOffsetDb: db });
  }

  get levelBelowVoiceDb(): number {
    return MusicTrack.BELOW_VOICE_DB - this.gainOffsetDb;
  }

  snapshot(): MusicTrackSnapshot {
    return { id: this.id, title: this.title, origin: this.origin, uri: this.uri, gainOffsetDb: this.gainOffsetDb };
  }

  static restore(s: MusicTrackSnapshot): MusicTrack {
    if (s.origin !== "library" && s.origin !== "upload") {
      throw new ValidationError("Bản nháp hỏng: nguồn nhạc không hợp lệ");
    }
    return MusicTrack.create({ id: s.id, title: s.title, origin: s.origin, uri: s.uri, gainOffsetDb: s.gainOffsetDb });
  }
}
