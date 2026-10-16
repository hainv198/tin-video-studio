import { ValidationError } from "@/domain/errors";

export type ConfigKind = "secret" | "json" | "flag";

export interface ConfigKeyDef {
  key: string;
  label: string;
  hint: string;
  kind: ConfigKind;
}

/** Danh sách cứng các khoá được phép sửa từ giao diện. Không nhận khoá nào khác. */
export const CONFIG_KEYS: readonly ConfigKeyDef[] = [
  {
    key: "GEMINI_API_KEY",
    label: "Gemini (giọng đọc)",
    hint: "Lấy ở Google AI Studio (aistudio.google.com) → Get API key.",
    kind: "secret",
  },
  {
    key: "PIXABAY_API_KEY",
    label: "Pixabay (cảnh trám)",
    hint: "Đăng ký miễn phí ở pixabay.com, key hiện ở trang tài liệu API.",
    kind: "secret",
  },
  {
    key: "PEXELS_API_KEY",
    label: "Pexels (cảnh trám)",
    hint: "pexels.com/api → Your API Key (hiện đang tạm ngừng cấp key mới).",
    kind: "secret",
  },
  {
    key: "GOOGLE_TTS_API_KEY",
    label: "Google Cloud TTS (giọng đọc)",
    hint: "Google Cloud Console → bật Text-to-Speech API → Credentials → API key.",
    kind: "secret",
  },
  {
    key: "MINIMAX_API_KEY",
    label: "MiniMax (giọng clone)",
    hint: "Bảng điều khiển MiniMax → API Keys. Cần dùng cùng danh sách giọng bên dưới.",
    kind: "secret",
  },
  {
    key: "MINIMAX_VOICES",
    label: "Danh sách giọng MiniMax",
    hint: 'Mảng JSON, ví dụ [{"alias":"Giọng A","voiceId":"...","gender":"FEMALE"}]. Tạo bằng npm run minimax:clone.',
    kind: "json",
  },
  {
    key: "EDGE_TTS_DEV",
    label: "Edge TTS (chỉ khi dev)",
    hint: 'Công tắc dùng giọng Edge trên máy dev, giá trị "1". Chỉ có tác dụng cùng FAKE_PROVIDERS=1.',
    kind: "flag",
  },
];

export const MAX_VALUE_LENGTH = 4000;

export function findConfigKey(key: string): ConfigKeyDef | undefined {
  return CONFIG_KEYS.find((def) => def.key === key);
}

function hasControlChars(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f || code === 0x2028 || code === 0x2029) return true;
  }
  return false;
}

/** Kiểm giá trị đã trim. Thông báo lỗi chỉ nêu tên khoá, không bao giờ nêu giá trị. */
export function assertValidValue(def: ConfigKeyDef, value: string): void {
  if (hasControlChars(value)) throw new ValidationError(`${def.key}: giá trị chứa xuống dòng hoặc ký tự điều khiển`);
  if (value.length > MAX_VALUE_LENGTH) throw new ValidationError(`${def.key}: giá trị dài quá ${MAX_VALUE_LENGTH} ký tự`);
  if (def.kind === "flag" && value !== "1") throw new ValidationError(`${def.key}: chỉ nhận giá trị 1 (hoặc xoá để tắt)`);
  if (def.kind === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new ValidationError(`${def.key}: không phải JSON hợp lệ`);
    }
    if (!Array.isArray(parsed)) throw new ValidationError(`${def.key}: cần là một mảng JSON`);
  }
}
