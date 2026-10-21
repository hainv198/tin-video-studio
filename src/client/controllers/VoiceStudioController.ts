import { isQuotaExhausted, isSessionExpired } from "@/client/errors/userMessage";
import type { AudioExporter } from "@/client/media/AacAudioExporter";
import { RENDER_SAMPLE_RATE, type AudioDecodeService } from "@/client/media/AudioDecodeService";
import type { SpeechAssembler } from "@/client/media/SpeechAssembler";
import { SpeechChunker } from "@/client/media/SpeechChunker";
import type { VoiceTweak } from "@/client/media/voiceTweak";
import type { TtsApi, VoiceInfo } from "@/client/services/TtsClient";
import { PITCH_SEMITONES_RANGE, TEMPO_RANGE } from "@/domain/VideoOptions";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { audioFileName } from "./fileName";
import { StateController } from "./StateController";

/** Giới hạn mỗi lần tạo: bảo vệ hạn mức Google TTS dùng chung của cả nhóm. */
export const MAX_TEXT_CHARS = 10_000;
export const PAUSE_RANGE = { min: 0.1, max: 1, step: 0.05, default: 0.35 } as const;
export const STUDIO_STOPPED_NOTICE = "Đã dừng. Các mẩu đã tạo được giữ lại.";
export const QUOTA_NOTICE = "Đã hết hạn mức giọng đọc (dùng chung cả nhóm). Các mẩu đã tạo được giữ lại — thử lại sau hoặc chọn giọng khác.";
export const OUTDATED_NOTICE = "Nội dung hoặc giọng đã đổi — bấm Tạo giọng để cập nhật (chỉ đọc lại phần thay đổi).";

export type ChunkStatus = "pending" | "working" | "done" | "failed";

export interface ChunkView {
  text: string;
  status: ChunkStatus;
  error: string | null;
}

export type AudioFormat = "wav" | "m4a";

export interface VoiceStudioState {
  text: string;
  charCount: number;
  voices: VoiceInfo[];
  voicesLoading: boolean;
  voiceName: string | null;
  speakingRate: number;
  tweak: VoiceTweak;
  pauseSec: number;
  chunks: ChunkView[];
  generating: boolean;
  progress: { done: number; total: number } | null;
  /** Mọi mẩu đã có giọng và khớp văn bản, giọng, tốc độ hiện tại. */
  ready: boolean;
  /** Đã có kết quả nhưng văn bản/giọng/tốc độ đổi sau đó. */
  outdated: boolean;
  exporting: boolean;
  m4aSupported: boolean | null;
  error: string | null;
  notice: string | null;
}

export interface VoiceStudioDeps {
  tts: TtsApi;
  decoder: Pick<AudioDecodeService, "decode">;
  assembler: SpeechAssembler;
  exporter: AudioExporter;
  chunker?: SpeechChunker;
  now?: () => Date;
  onAuthLost?: () => void;
}

interface Plan {
  voiceName: string;
  speakingRate: number;
  text: string;
  pieces: string[];
}

const INITIAL: VoiceStudioState = {
  text: "",
  charCount: 0,
  voices: [],
  voicesLoading: false,
  voiceName: null,
  speakingRate: VoiceSettings.DEFAULT_RATE,
  tweak: { tempo: TEMPO_RANGE.default, pitchSemitones: PITCH_SEMITONES_RANGE.default },
  pauseSec: PAUSE_RANGE.default,
  chunks: [],
  generating: false,
  progress: null,
  ready: false,
  outdated: false,
  exporting: false,
  m4aSupported: null,
  error: null,
  notice: null,
};

const formatVi = (n: number) => n.toFixed(2).replace(".", ",");

/**
 * Trang "Tạo giọng": văn bản bất kỳ → tách mẩu → gọi /api/tts tuần tự → giải mã, cắt lặng → ghép (tinh chỉnh + khoảng nghỉ) → tải WAV/M4A.
 * Âm thanh chỉ nằm trong bộ nhớ trình duyệt.
 */
export class VoiceStudioController extends StateController<VoiceStudioState> {
  private readonly chunker: SpeechChunker;
  /** Mẩu đã tạo (mono, đã cắt lặng) theo khoá giọng|tốc độ|chữ: tạo lại chỉ gọi phần đổi. */
  private readonly cache = new Map<string, Float32Array>();
  private plan: Plan | null = null;
  private active: AbortController | null = null;
  private assembled: { key: string; samples: Float32Array } | null = null;

  constructor(private readonly deps: VoiceStudioDeps) {
    super(INITIAL, deps.onAuthLost);
    this.chunker = deps.chunker ?? new SpeechChunker();
  }

  async loadVoices(): Promise<void> {
    this.patch({ voicesLoading: true, error: null });
    try {
      const voices = await this.deps.tts.voices();
      const keep = voices.some((v) => v.name === this.state.voiceName);
      this.patch({ voices, voicesLoading: false, voiceName: keep ? this.state.voiceName : (voices[0]?.name ?? null) });
      this.refresh();
    } catch (error) {
      this.patch({ voicesLoading: false, error: this.report(error) });
    }
  }

  async checkM4a(): Promise<void> {
    this.patch({ m4aSupported: await this.deps.exporter.canEncode(RENDER_SAMPLE_RATE).catch(() => false) });
  }

  setText(text: string): void {
    this.patch({ text, charCount: text.length, error: null, notice: null });
    this.refresh();
  }

  selectVoice(name: string): void {
    this.patch({ voiceName: name, error: null });
    this.refresh();
  }

  setRate(rate: number): void {
    const rounded = Math.round(rate * 100) / 100;
    if (!Number.isFinite(rounded) || rounded < VoiceSettings.MIN_RATE || rounded > VoiceSettings.MAX_RATE) {
      this.patch({ error: `Tốc độ đọc phải từ ${VoiceSettings.MIN_RATE} đến ${VoiceSettings.MAX_RATE}` });
      return;
    }
    this.patch({ speakingRate: rounded, error: null });
    this.refresh();
  }

  setTempo(tempo: number): void {
    if (!Number.isFinite(tempo) || tempo < TEMPO_RANGE.min || tempo > TEMPO_RANGE.max) {
      this.patch({ error: `Tốc độ tinh chỉnh phải từ ${formatVi(TEMPO_RANGE.min)} đến ${formatVi(TEMPO_RANGE.max)}` });
      return;
    }
    this.patch({ tweak: { ...this.state.tweak, tempo: Math.round(tempo * 100) / 100 }, error: null });
    this.refresh();
  }

  setPitch(semitones: number): void {
    const r = PITCH_SEMITONES_RANGE;
    if (!Number.isFinite(semitones) || semitones < r.min || semitones > r.max) {
      this.patch({ error: "Tông giọng phải từ −4 đến +4 nửa cung" });
      return;
    }
    this.patch({ tweak: { ...this.state.tweak, pitchSemitones: Math.round(semitones * 2) / 2 }, error: null });
    this.refresh();
  }

  resetTweak(): void {
    this.patch({ tweak: INITIAL.tweak, error: null });
    this.refresh();
  }

  setPause(sec: number): void {
    if (!Number.isFinite(sec) || sec < PAUSE_RANGE.min || sec > PAUSE_RANGE.max) {
      this.patch({ error: `Khoảng nghỉ phải từ ${formatVi(PAUSE_RANGE.min)} đến ${formatVi(PAUSE_RANGE.max)} giây` });
      return;
    }
    this.patch({ pauseSec: Math.round(sec * 100) / 100, error: null });
    this.refresh();
  }

  async generate(): Promise<void> {
    if (this.state.generating) return;
    const { text, voiceName, speakingRate } = this.state;
    if (!text.trim()) {
      this.patch({ error: "Hãy nhập nội dung cần đọc" });
      return;
    }
    if (text.length > MAX_TEXT_CHARS) {
      this.patch({ error: `Tối đa 10.000 ký tự mỗi lần tạo (đang có ${text.length.toLocaleString("vi-VN")})` });
      return;
    }
    if (!voiceName) {
      this.patch({ error: "Chưa chọn giọng" });
      return;
    }
    const pieces = this.chunker.split(text);
    this.plan = { voiceName, speakingRate, text, pieces };
    // Chỉ giữ trong bộ nhớ các mẩu của lượt này.
    const keep = new Set(pieces.map((p) => this.keyOf(this.plan!, p)));
    for (const key of [...this.cache.keys()]) if (!keep.has(key)) this.cache.delete(key);
    const chunks: ChunkView[] = pieces.map((p) => ({
      text: p,
      status: this.cache.has(this.keyOf(this.plan!, p)) ? "done" : "pending",
      error: null,
    }));
    const todo = chunks.flatMap((c, i) => (c.status === "pending" ? [i] : []));
    const run = new AbortController();
    this.active = run;
    this.patch({ chunks, generating: true, error: null, notice: null, progress: { done: 0, total: todo.length } });
    this.refresh();
    try {
      let done = 0;
      for (const index of todo) {
        const outcome = await this.runChunk(index, run);
        if (this.active !== run) break;
        done += 1;
        this.patch({ progress: { done, total: todo.length } });
        if (outcome === "stop") break;
      }
    } finally {
      this.finishRun(run);
    }
  }

  /** "Thử lại mẩu này": chỉ gọi lại đúng một mẩu, các mẩu khác giữ nguyên. */
  async retry(index: number): Promise<void> {
    if (this.state.generating || !this.plan || !this.state.chunks[index]) return;
    const run = new AbortController();
    this.active = run;
    this.patch({ generating: true, error: null, notice: null, progress: { done: 0, total: 1 } });
    try {
      await this.runChunk(index, run);
    } finally {
      this.finishRun(run);
    }
  }

  /** Dừng NGAY: huỷ lần gọi đang bay, trả trạng thái về rảnh; mẩu đã xong giữ nguyên. */
  cancel(): void {
    const run = this.active;
    if (!run) return;
    this.active = null;
    run.abort();
    this.patch({
      generating: false,
      progress: null,
      notice: STUDIO_STOPPED_NOTICE,
      chunks: this.state.chunks.map((c) => (c.status === "working" ? { ...c, status: "pending" } : c)),
    });
    this.refresh();
  }

  /** Âm thanh đã ghép (áp tinh chỉnh + khoảng nghỉ); null khi chưa đủ mẩu. Ghi nhớ theo thiết lập để nghe thử rồi tải không tính lại. */
  buildSamples(): Float32Array | null {
    const plan = this.plan;
    if (!plan || !this.state.ready) return null;
    const { tweak, pauseSec } = this.state;
    const key = `${plan.voiceName}|${plan.speakingRate}|${plan.text}|${tweak.tempo}|${tweak.pitchSemitones}|${pauseSec}`;
    if (this.assembled?.key === key) return this.assembled.samples;
    const clips = plan.pieces.map((p) => this.cache.get(this.keyOf(plan, p))!);
    const samples = this.deps.assembler.assemble(clips, RENDER_SAMPLE_RATE, { pauseSec, tweak });
    this.assembled = { key, samples };
    return samples;
  }

  /** File để nghe thử hoặc tải xuống; null khi chưa sẵn sàng hoặc lỗi (lỗi ghi vào state). */
  async exportAudio(format: AudioFormat): Promise<{ blob: Blob; fileName: string } | null> {
    if (!this.state.ready || this.state.exporting) return null;
    this.patch({ exporting: true, error: null });
    try {
      const samples = this.buildSamples();
      if (!samples) return null;
      const blob =
        format === "wav"
          ? new Blob([this.deps.assembler.toWav(samples, RENDER_SAMPLE_RATE)], { type: "audio/wav" })
          : await this.deps.exporter.encode(samples, RENDER_SAMPLE_RATE);
      const now = (this.deps.now ?? (() => new Date()))();
      return { blob, fileName: audioFileName(this.plan?.text ?? "", now, format) };
    } catch (error) {
      this.patch({ error: format === "m4a" ? "Không mã hoá được M4A trên trình duyệt này, hãy tải WAV" : this.report(error) });
      return null;
    } finally {
      this.patch({ exporting: false });
    }
  }

  private keyOf(plan: Pick<Plan, "voiceName" | "speakingRate">, piece: string): string {
    return `${plan.voiceName}|${plan.speakingRate}|${piece}`;
  }

  private setChunk(index: number, change: Partial<ChunkView>): void {
    this.patch({ chunks: this.state.chunks.map((c, i) => (i === index ? { ...c, ...change } : c)) });
  }

  /** Một mẩu. "stop" nếu phải dừng cả lượt (hết hạn mức, hết phiên). */
  private async runChunk(index: number, run: AbortController): Promise<"ok" | "stop"> {
    const plan = this.plan;
    const piece = this.state.chunks[index]?.text;
    if (!plan || piece === undefined) return "ok";
    this.setChunk(index, { status: "working", error: null });
    try {
      const bytes = await this.deps.tts.synthesize(piece, plan.voiceName, plan.speakingRate, run.signal);
      const decoded = await this.deps.decoder.decode(bytes);
      if (this.active !== run) return "ok";
      this.cache.set(this.keyOf(plan, piece), this.deps.assembler.prepare(decoded.channels, decoded.sampleRate));
      this.setChunk(index, { status: "done", error: null });
      return "ok";
    } catch (error) {
      if (this.active !== run) return "ok";
      const message = this.report(error);
      this.setChunk(index, { status: "failed", error: message });
      if (isQuotaExhausted(error)) {
        this.patch({ error: QUOTA_NOTICE });
        return "stop";
      }
      return isSessionExpired(error) ? "stop" : "ok";
    }
  }

  private finishRun(run: AbortController): void {
    // Đã bị Dừng thì cancel() đã trả trạng thái rồi.
    if (this.active !== run) return;
    this.active = null;
    this.patch({ generating: false, progress: null });
    this.refresh();
  }

  /** Tính lại `ready`/`outdated` từ kết quả hiện có và thiết lập hiện tại. */
  private refresh(): void {
    const plan = this.plan;
    const allDone = !!plan && plan.pieces.length > 0 && this.state.chunks.every((c) => c.status === "done");
    const matches =
      !!plan && plan.text === this.state.text && plan.voiceName === this.state.voiceName && plan.speakingRate === this.state.speakingRate;
    const ready = allDone && matches && !this.state.generating;
    const outdated = !!plan && !matches && !this.state.generating;
    if (ready !== this.state.ready || outdated !== this.state.outdated) this.patch({ ready, outdated });
  }
}
