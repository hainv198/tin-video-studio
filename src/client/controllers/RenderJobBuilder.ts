import { AudioDecodeService, RENDER_SAMPLE_RATE, type DecodedAudio } from "@/client/media/AudioDecodeService";
import type { MusicBed } from "@/client/media/AudioMix";
import { trimSilence } from "@/client/media/audioTrim";
import { parseUploadUri } from "@/client/media/footageFactory";
import { RenderCancelledError } from "@/client/render/errors";
import type { FootageInput, NarrationInput, RenderJob, RenderSceneInput } from "@/client/render/RenderJob";
import { isSessionExpired } from "@/client/errors/userMessage";
import type { TrackSource } from "@/client/services/TrackSource";
import type { UploadRepository } from "@/client/storage/UploadRepository";
import { ValidationError } from "@/domain/errors";
import type { Footage } from "@/domain/Footage";
import type { TemplateRegistry } from "@/templates/TemplateRegistry";
import { staleSceneIds } from "./readiness";
import type { StudioData } from "./StudioSession";

export interface RenderJobBuilderDeps {
  templates: Pick<TemplateRegistry, "get">;
  uploads: Pick<UploadRepository, "get">;
  tracks: Pick<TrackSource, "bytes">;
  decoder: Pick<AudioDecodeService, "decode">;
  origin: string;
  sampleRate?: number;
  videoBitrate?: number;
}

export interface BuiltJob {
  job: RenderJob;
  warnings: string[];
}

/** Dựng `RenderJob` từ dữ liệu bước 1–4: giải mã giọng, cắt lặng, nạp nhạc và file tải lên. */
export class RenderJobBuilder {
  private readonly sampleRate: number;

  constructor(private readonly deps: RenderJobBuilderDeps) {
    this.sampleRate = deps.sampleRate ?? RENDER_SAMPLE_RATE;
  }

  async build(
    data: StudioData,
    onProgress?: (label: string, ratio: number) => void,
    isCancelled: () => boolean = () => false,
    options?: { videoBitrate?: number },
  ): Promise<BuiltJob> {
    const { project, voice, narrations, footage, music, brand, options: videoOptions } = data;
    if (!project) throw new ValidationError("Chưa có dự án");
    if (!voice || staleSceneIds(data).length > 0) throw new ValidationError("Chưa đủ giọng đọc cho mọi cảnh");
    this.deps.templates.get(project.templateId); // phong cách không tồn tại thì ném NotFoundError

    const warnings: string[] = [];
    const sceneCount = project.scenes.length;
    const total = sceneCount + (music ? 1 : 0);
    const narrationInputs: NarrationInput[] = [];
    const sceneInputs: RenderSceneInput[] = [];

    for (const [index, scene] of project.scenes.entries()) {
      if (isCancelled()) throw new RenderCancelledError();
      onProgress?.(`Chuẩn bị giọng đọc ${index + 1}/${sceneCount}`, index / total);
      const narration = narrations.get(scene.id);
      if (!narration) throw new ValidationError("Chưa đủ giọng đọc cho mọi cảnh");
      const decoded = this.checkRate(await this.deps.decoder.decode(narration.audio.slice().buffer as ArrayBuffer));
      // Cắt lặng ở mỗi lần dựng; độ dài gửi cho bộ dựng là độ dài đã cắt.
      const trimmed = trimSilence(AudioDecodeService.toMono(decoded.channels), decoded.sampleRate);
      narrationInputs.push({
        sceneId: scene.id,
        durationSec: trimmed.samples.length / decoded.sampleRate,
        samples: trimmed.samples,
      });
      sceneInputs.push({
        sceneId: scene.id,
        role: scene.role,
        text: scene.text,
        footage: await this.footageInput(footage.resolve(scene.id), index + 1, warnings),
      });
    }

    let musicBed: MusicBed | null = null;
    if (music) {
      if (isCancelled()) throw new RenderCancelledError();
      onProgress?.("Nạp nhạc nền", sceneCount / total);
      try {
        const decoded = this.checkRate(await this.deps.decoder.decode(await this.deps.tracks.bytes(music)));
        musicBed = { channels: decoded.channels, levelBelowVoiceDb: music.levelBelowVoiceDb };
      } catch (error) {
        if (isSessionExpired(error)) throw error;
        warnings.push("Không nạp được nhạc nền, video sẽ dựng không có nhạc");
      }
    }

    const videoBitrate = options?.videoBitrate ?? this.deps.videoBitrate;
    const job: RenderJob = {
      templateId: project.templateId,
      brandValues: brand.values,
      logo: brand.logo,
      project: {
        displayTitle: project.displayTitle,
        sourceCredit: project.sourceCredit,
        publishDateText: project.formattedPublishDate(),
      },
      scenes: sceneInputs,
      narrations: narrationInputs,
      music: musicBed,
      sampleRate: this.sampleRate,
      origin: this.deps.origin,
      options: videoOptions.snapshot(),
      ...(videoBitrate ? { videoBitrate } : {}),
    };
    return { job, warnings };
  }

  /** Giọng và nhạc phải cùng tần số mẫu với bản trộn; lệch sẽ sai cao độ và nhịp mà không báo lỗi. */
  private checkRate(decoded: DecodedAudio): DecodedAudio {
    if (decoded.sampleRate !== this.sampleRate) {
      throw new Error(`Âm thanh giải mã sai tần số mẫu (${decoded.sampleRate} Hz thay vì ${this.sampleRate} Hz)`);
    }
    return decoded;
  }

  private async footageInput(footage: Footage, sceneNumber: number, warnings: string[]): Promise<FootageInput> {
    const snap = footage.snapshot();
    if (snap.kind === "fallback") return { kind: "fallback" };
    if (snap.source.origin === "upload") {
      const id = parseUploadUri(snap.source.uri);
      const stored = id ? await this.deps.uploads.get(id) : null;
      if (!stored) {
        warnings.push(`Không tìm thấy file tải lên của cảnh ${sceneNumber}, dùng nền mặc định`);
        return { kind: "fallback" };
      }
      return { kind: snap.kind, blob: stored.blob };
    }
    return { kind: snap.kind, url: snap.source.uri };
  }
}
