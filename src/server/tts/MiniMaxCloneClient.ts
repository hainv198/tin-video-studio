import { MINIMAX_DEFAULT_MODEL, minimaxUrl, validateVoiceId, type MiniMaxBaseResp } from "./minimaxShared";

export { validateVoiceId };

export interface MiniMaxCloneOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export interface CloneRequest {
  audio: Uint8Array;
  fileName: string;
  voiceId: string;
  previewText: string;
}

export interface CloneResult {
  fileId: number;
  demoAudioUrl: string;
}

/** Clone giọng một lần: tải file thu âm lên MiniMax rồi tạo voice_id. Dùng cho script dòng lệnh, không chạy trong app. */
export class MiniMaxCloneClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: MiniMaxCloneOptions) {
    if (!options.apiKey) throw new Error("MINIMAX_API_KEY chưa được cấu hình");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async clone(request: CloneRequest): Promise<CloneResult> {
    if (!validateVoiceId(request.voiceId)) {
      throw new Error(
        "voiceId không hợp lệ: 8–256 ký tự, bắt đầu bằng chữ, chỉ chữ/số/-/_, không kết thúc bằng - hoặc _",
      );
    }
    const fileId = await this.upload(request.audio, request.fileName);
    const data = await this.postJson<{ demo_audio?: string; base_resp?: MiniMaxBaseResp }>(
      "/v1/voice_clone",
      {
        file_id: fileId,
        voice_id: request.voiceId,
        need_noise_reduction: true,
        need_volume_normalization: true,
        language_boost: "Vietnamese",
        text: request.previewText,
        model: this.options.model || MINIMAX_DEFAULT_MODEL,
      },
      "clone",
    );
    return { fileId, demoAudioUrl: data.demo_audio ?? "" };
  }

  private async upload(audio: Uint8Array, fileName: string): Promise<number> {
    const form = new FormData();
    form.append("purpose", "voice_clone");
    form.append("file", new Blob([new Uint8Array(audio)]), fileName);
    const response = await this.fetchImpl(minimaxUrl(this.options.baseUrl, "/v1/files/upload"), {
      method: "POST",
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
      body: form,
    });
    const data = await this.read<{ file?: { file_id?: number }; base_resp?: MiniMaxBaseResp }>(response, "tải file");
    const fileId = data.file?.file_id;
    if (typeof fileId !== "number") throw new Error("MiniMax tải file không trả về file_id");
    return fileId;
  }

  private async postJson<T extends { base_resp?: MiniMaxBaseResp }>(path: string, body: unknown, step: string): Promise<T> {
    const response = await this.fetchImpl(minimaxUrl(this.options.baseUrl, path), {
      method: "POST",
      headers: { Authorization: `Bearer ${this.options.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return this.read<T>(response, step);
  }

  private async read<T extends { base_resp?: MiniMaxBaseResp }>(response: Response, step: string): Promise<T> {
    if (!response.ok) throw new Error(`MiniMax ${step} lỗi HTTP ${response.status}`);
    const data = (await response.json()) as T;
    const code = data.base_resp?.status_code ?? 0;
    if (code !== 0) throw new Error(`MiniMax ${step} lỗi ${code}: ${data.base_resp?.status_msg ?? ""}`);
    return data;
  }
}
