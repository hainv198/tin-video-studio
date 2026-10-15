export const MINIMAX_DEFAULT_BASE_URL = "https://api.minimax.io";
export const MINIMAX_DEFAULT_MODEL = "speech-2.8-hd";

/** Luật voice_id của MiniMax: 8–256 ký tự, bắt đầu bằng chữ, chỉ chữ/số/-/_, không kết thúc bằng - hoặc _. */
const VOICE_ID = /^[A-Za-z][A-Za-z0-9_-]{6,254}[A-Za-z0-9]$/;

export function validateVoiceId(voiceId: string): boolean {
  return VOICE_ID.test(voiceId);
}

/** Alias giọng clone trong app: chữ và số không dấu, 1–32 ký tự (thành tên vi-VN-MiniMax-<Alias>). */
const ALIAS = /^[A-Za-z0-9]{1,32}$/;

export function validateAlias(alias: string): boolean {
  return ALIAS.test(alias);
}

export function minimaxUrl(baseUrl: string | undefined, path: string): string {
  return `${(baseUrl || MINIMAX_DEFAULT_BASE_URL).replace(/\/+$/, "")}${path}`;
}

export interface MiniMaxBaseResp {
  status_code?: number;
  status_msg?: string;
}
