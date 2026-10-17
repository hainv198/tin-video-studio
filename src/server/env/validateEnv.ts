import { UserDirectory } from "@/server/auth/UserDirectory";
import { parseMiniMaxVoices } from "@/server/tts/MiniMaxTtsService";
import { parseVclipVoices } from "@/server/tts/VclipTtsService";

export type EnvCheck = { ok: true; summary: string[] } | { ok: false; problems: string[] };

const set = (v: string | undefined) => (v && v.trim() ? "đã đặt" : "trống");

/** Kiểm biến môi trường trước khi build/deploy. Không bao giờ đưa giá trị key vào thông báo. */
export function validateEnv(env: Record<string, string | undefined>): EnvCheck {
  const problems: string[] = [];
  const summary: string[] = [];
  // Chỉ production thật mới cấm nhà cung cấp giả (khớp server/container.ts); Preview của Vercel vẫn được dùng giả.
  const deployed = env.VERCEL_ENV === "production";
  const fake = env.FAKE_PROVIDERS === "1";

  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) problems.push("AUTH_SECRET phải có và dài ít nhất 32 ký tự");
  else summary.push("AUTH_SECRET: đã đặt");

  if (!env.APP_USERS) problems.push("APP_USERS trống (tạo bằng npm run user:encode)");
  else {
    try {
      const users = UserDirectory.fromEnv(env.APP_USERS);
      summary.push(`APP_USERS: ${users.size} tài khoản`);
    } catch (error) {
      problems.push(`APP_USERS không hợp lệ: ${error instanceof Error ? error.message : "không đọc được"}`);
    }
  }

  if (fake) {
    if (deployed) problems.push("FAKE_PROVIDERS=1 không được bật trên production (Vercel)");
    else summary.push("Nhà cung cấp: GIẢ LẬP (chỉ để phát triển)");
  } else {
    if (!env.PEXELS_API_KEY?.trim() && !env.PIXABAY_API_KEY?.trim()) {
      problems.push("Cần PEXELS_API_KEY hoặc PIXABAY_API_KEY để tìm cảnh trám (bỏ FAKE_PROVIDERS thì phải có ít nhất một)");
    }
    const hasTts = Boolean(env.GOOGLE_TTS_API_KEY?.trim() || env.GEMINI_API_KEY?.trim() || (env.MINIMAX_API_KEY?.trim() && env.MINIMAX_VOICES?.trim()) || (env.VCLIP_API_KEY?.trim() && env.VCLIP_VOICES?.trim()));
    if (!hasTts) problems.push("Cần một nguồn giọng: VCLIP_API_KEY + VCLIP_VOICES, GEMINI_API_KEY, GOOGLE_TTS_API_KEY hoặc MiniMax (bỏ FAKE_PROVIDERS thì phải có ít nhất một)");
    summary.push(`Google TTS: ${set(env.GOOGLE_TTS_API_KEY)}; Pexels: ${set(env.PEXELS_API_KEY)}; Pixabay: ${set(env.PIXABAY_API_KEY)}`);
  }

  if (env.EDGE_TTS_DEV === "1" && (Boolean(env.VERCEL) || env.NODE_ENV === "production")) {
    problems.push("EDGE_TTS_DEV=1 chỉ dùng trên máy dev, không dùng khi deploy");
  }

  const mmKey = env.MINIMAX_API_KEY?.trim();
  const mmVoices = env.MINIMAX_VOICES?.trim();
  if (mmKey && mmVoices) {
    try {
      summary.push(`MiniMax: ${parseMiniMaxVoices(mmVoices).length} giọng clone`);
    } catch (error) {
      problems.push(`MINIMAX_VOICES không hợp lệ: ${error instanceof Error ? error.message : "sai định dạng"}`);
    }
  } else if (mmKey || mmVoices) {
    summary.push("MiniMax: cảnh báo — cần cả MINIMAX_API_KEY và MINIMAX_VOICES, đang bỏ qua");
  }

  const vcKey = env.VCLIP_API_KEY?.trim();
  const vcVoices = env.VCLIP_VOICES?.trim();
  if (vcKey && vcVoices) {
    try {
      summary.push(`Vclip: ${parseVclipVoices(vcVoices).length} giọng`);
    } catch (error) {
      problems.push(`VCLIP_VOICES không hợp lệ: ${error instanceof Error ? error.message : "sai định dạng"}`);
    }
  } else if (vcKey || vcVoices) {
    summary.push("Vclip: cảnh báo — cần cả VCLIP_API_KEY và VCLIP_VOICES, đang bỏ qua");
  }

  if (env.GEMINI_API_KEY?.trim()) summary.push("Gemini: đã đặt");
  summary.push(
    env.GEMINI_TEXT_API_KEY?.trim()
      ? "AI gợi ý từ khoá cảnh trám: đã đặt"
      : "AI gợi ý từ khoá cảnh trám: chưa đặt GEMINI_TEXT_API_KEY, dùng từ điển",
  );

  return problems.length ? { ok: false, problems } : { ok: true, summary };
}
