import { AudioDecodeService, RENDER_SAMPLE_RATE, type DecodedAudio } from "@/client/media/AudioDecodeService";
import type { MusicBed } from "@/client/media/AudioMix";
import { trimSilence } from "@/client/media/audioTrim";
import { applyVoiceTweak } from "@/client/media/voiceTweak";
import { parseUploadUri } from "@/client/media/footageFactory";
import { RenderCancelledError } from "@/client/render/errors";
import type { FootageInput, NarrationInput, RenderJob, RenderSceneInput, SourceClipInput } from "@/client/render/RenderJob";
import { isSessionExpired } from "@/client/errors/userMessage";
import type { TrackSource } from "@/client/services/TrackSource";
import type { UploadRepository } from "@/client/storage/UploadRepository";
import { ValidationError } from "@/domain/errors";
import type { Footage } from "@/domain/Footage";
import type { MusicTrack } from "@/domain/MusicTrack";
import type { Narration } from "@/domain/Narration";
import { MEDIA_CREDIT } from "@/domain/ProjectKind";
import type { VideoOptions } from "@/domain/VideoOptions";
import type { TemplateRegistry } from "@/templates/TemplateRegistry";
import { footageOwners, staleSceneIds } from "./readiness";
import type { BrandData, StudioData } from "./StudioSession";

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

/** Dựng RenderJob từ dữ liệu các bước: giải mã giọng, cắt lặng, nạp nhạc, file tải lên (cảnh trám hoặc video tải lên). */
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
    const videoBitrate = options?.videoBitrate ?? this.deps.videoBitrate;
    if (project.kind === "upload") return this.buildUpload(data, onProgress, isCancelled, videoBitrate);

    const warnings: string[] = [];
    const sceneCount = project.scenes.length;
    const total = sceneCount + (music ? 1 : 0);
    const narrationInputs: NarrationInput[] = [];
    const sceneInputs: RenderSceneInput[] = [];
    const owners = footageOwners(data);

    for (const [index, scene] of project.scenes.entries()) {
      if (isCancelled()) throw new RenderCancelledError();
      onProgress?.(`Chuẩn bị giọng đọc ${index + 1}/${sceneCount}`, index / total);
      const narration = narrations.get(scene.id);
      if (!narration) throw new ValidationError("Chưa đủ giọng đọc cho mọi cảnh");
      narrationInputs.push(await this.narrationInput(scene.id, narration, videoOptions));
      const owner = owners.get(scene.id) ?? scene.id;
      if (owner !== scene.id) {
        // Dùng tiếp cảnh của đoạn trước: không nạp cảnh riêng (nếu đang giữ) để khỏi tải thừa.
        sceneInputs.push({ sceneId: scene.id, role: scene.role, text: scene.text, footage: { kind: "fallback" }, footageFrom: owner });
        continue;
      }
      sceneInputs.push({
        sceneId: scene.id,
        role: scene.role,
        text: scene.text,
        footage: await this.footageInput(footage.resolve(scene.id), index + 1, warnings),
      });
    }

    const musicBed = music ? await this.musicBed(music, sceneCount / total, onProgress, isCancelled, warnings) : null;

    const job: RenderJob = {
      templateId: project.templateId,
      brandValues: brand.values,
      logo: brand.logo,
      ...this.bannerOf(project.templateId, brand),
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

  /** Kiểu "Video tải lên": giọng chỉ đọc tiêu đề; video tải lên phát trọn sau thẻ đầu; không phụ đề. */
  private async buildUpload(
    data: StudioData,
    onProgress: ((label: string, ratio: number) => void) | undefined,
    isCancelled: () => boolean,
    videoBitrate: number | undefined,
  ): Promise<BuiltJob> {
    const { project, narrations, music, brand, options: videoOptions, sourceClip } = data;
    if (!project) throw new ValidationError("Chưa có dự án");
    if (!sourceClip) throw new ValidationError("Chưa tải video lên");
    const warnings: string[] = [];
    const total = 2 + (music ? 1 : 0);

    if (isCancelled()) throw new RenderCancelledError();
    onProgress?.("Chuẩn bị giọng đọc tiêu đề", 0);
    const intro = project.introScene;
    const narration = narrations.get(intro.id);
    if (!narration) throw new ValidationError("Chưa đủ giọng đọc cho mọi cảnh");
    const introNarration = await this.narrationInput(intro.id, narration, videoOptions);

    if (isCancelled()) throw new RenderCancelledError();
    onProgress?.("Nạp video tải lên", 1 / total);
    const stored = await this.deps.uploads.get(sourceClip.uploadId);
    if (!stored) throw new ValidationError("Không tìm thấy video đã tải lên, hãy tải lại ở bước Video của bạn");
    if (!sourceClip.hasAudio) warnings.push("Video tải lên không có tiếng gốc");
    const clipInput: SourceClipInput = {
      blob: stored.blob,
      durationSec: sourceClip.durationSec,
      hasAudio: sourceClip.hasAudio,
      gain: sourceClip.gain,
      thumbnailSec: sourceClip.thumbnailSec,
    };

    const musicBed = music ? await this.musicBed(music, 2 / total, onProgress, isCancelled, warnings) : null;
    const snapshot = videoOptions.snapshot();
    const job: RenderJob = {
      templateId: project.templateId,
      brandValues: brand.values,
      logo: brand.logo,
      ...this.bannerOf(project.templateId, brand),
      project: {
        displayTitle: project.displayTitle,
        sourceCredit: project.sourceCredit,
        publishDateText: project.formattedPublishDate(),
        mediaCredit: MEDIA_CREDIT.upload,
      },
      scenes: [{ sceneId: intro.id, role: "intro", text: intro.text, footage: { kind: "fallback" } }],
      narrations: [introNarration],
      music: musicBed,
      sampleRate: this.sampleRate,
      origin: this.deps.origin,
      // Kiểu này không có phụ đề (chỉ tiêu đề): ép tắt dù tuỳ chọn của video đang bật.
      options: { ...snapshot, subtitles: { ...snapshot.subtitles, enabled: false } },
      sourceClip: clipInput,
      ...(videoBitrate ? { videoBitrate } : {}),
    };
    return { job, warnings };
  }

  /** Banner riêng chỉ gửi cho phong cách có banner chân; không có thì worker tự tải banner mặc định. */
  private bannerOf(templateId: string, brand: BrandData): { banner?: Blob } {
    return brand.banner && this.deps.templates.get(templateId).footerBanner ? { banner: brand.banner } : {};
  }

  /** Giải mã, cắt lặng (mỗi lần dựng), tinh chỉnh tốc độ/tông; độ dài gửi bộ dựng là độ dài đã xử lý. */
  private async narrationInput(sceneId: string, narration: Narration, videoOptions: VideoOptions): Promise<NarrationInput> {
    const decoded = this.checkRate(await this.deps.decoder.decode(narration.audio.slice().buffer as ArrayBuffer));
    const trimmed = trimSilence(AudioDecodeService.toMono(decoded.channels), decoded.sampleRate);
    const samples = applyVoiceTweak(trimmed.samples, decoded.sampleRate, videoOptions.voiceTweak);
    return { sceneId, durationSec: samples.length / decoded.sampleRate, samples };
  }

  private async musicBed(
    music: MusicTrack,
    ratio: number,
    onProgress: ((label: string, ratio: number) => void) | undefined,
    isCancelled: () => boolean,
    warnings: string[],
  ): Promise<MusicBed | null> {
    if (isCancelled()) throw new RenderCancelledError();
    onProgress?.("Nạp nhạc nền", ratio);
    try {
      const decoded = this.checkRate(await this.deps.decoder.decode(await this.deps.tracks.bytes(music)));
      return { channels: decoded.channels, levelBelowVoiceDb: music.levelBelowVoiceDb };
    } catch (error) {
      if (isSessionExpired(error)) throw error;
      warnings.push("Không nạp được nhạc nền, video sẽ dựng không có nhạc");
      return null;
    }
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
