import { AuthController } from "./auth/AuthController";
import { BcryptPasswordHasher } from "./auth/PasswordHasher";
import { SessionService } from "./auth/SessionService";
import { UserDirectory } from "./auth/UserDirectory";
import { FakeStockProvider } from "./stock/FakeStockProvider";
import { PexelsService } from "./stock/PexelsService";
import { PixabayService } from "./stock/PixabayService";
import { StockController } from "./stock/StockController";
import type { StockProvider } from "./stock/StockProvider";
import { EdgeCliTtsProvider } from "./tts/EdgeCliTtsProvider";
import { FakeTtsProvider } from "./tts/FakeTtsProvider";
import { GeminiTtsService } from "./tts/GeminiTtsService";
import { GoogleTtsService } from "./tts/GoogleTtsService";
import { MiniMaxTtsService, parseMiniMaxVoices } from "./tts/MiniMaxTtsService";
import { routed, RoutingTtsProvider, type RoutedTtsProvider } from "./tts/RoutingTtsProvider";
import { TtsController } from "./tts/TtsController";
import type { TtsProvider } from "./tts/TtsProvider";

export interface ServerContainer {
  users: UserDirectory;
  sessions: SessionService;
  auth: AuthController;
  secureCookies: boolean;
  usingFakes: boolean;
  tts: TtsController;
  stock: StockController;
}

export function buildServerContainer(env: Record<string, string | undefined>): ServerContainer {
  const usingFakes = env.FAKE_PROVIDERS === "1";
  if (usingFakes && env.VERCEL_ENV === "production") {
    throw new Error("FAKE_PROVIDERS không được bật trên production");
  }
  if (env.EDGE_TTS_DEV === "1" && (env.NODE_ENV === "production" || env.VERCEL)) {
    throw new Error("EDGE_TTS_DEV chỉ dùng khi phát triển trên máy, không dùng khi deploy");
  }
  const users = UserDirectory.fromEnv(env.APP_USERS);
  const sessions = new SessionService(env.AUTH_SECRET ?? "");
  const auth = new AuthController(users, new BcryptPasswordHasher(), sessions);

  const baseTts: TtsProvider = usingFakes
    ? env.EDGE_TTS_DEV === "1"
      ? new EdgeCliTtsProvider({ bin: env.EDGE_TTS_BIN })
      : new FakeTtsProvider()
    : new GoogleTtsService(env.GOOGLE_TTS_API_KEY ?? "");
  const ttsProvider = composeTts(baseTts, env);
  const stockProviders: StockProvider[] = usingFakes
    ? [new FakeStockProvider()]
    : [new PexelsService(env.PEXELS_API_KEY ?? ""), new PixabayService(env.PIXABAY_API_KEY ?? "")];

  return {
    users,
    sessions,
    auth,
    secureCookies: env.NODE_ENV === "production",
    usingFakes,
    tts: new TtsController(ttsProvider),
    stock: new StockController(stockProviders),
  };
}

/** MiniMax và Gemini đều tuỳ chọn. Thứ tự danh sách giọng: MiniMax (giọng clone), Gemini, rồi giọng nền. */
function composeTts(base: TtsProvider, env: Record<string, string | undefined>): TtsProvider {
  const candidates: Array<RoutedTtsProvider | undefined> = [buildMiniMax(env), buildGemini(env)];
  const optional = candidates.filter((p): p is RoutedTtsProvider => p !== undefined);
  if (optional.length === 0) return base;
  return new RoutingTtsProvider([...optional, routed(base, (voiceName) => !optional.some((p) => p.owns(voiceName)))]);
}

/** Chỉ bật khi có đủ key và danh sách giọng hợp lệ; thiếu hoặc sai thì cảnh báo và chạy như cũ. */
function buildMiniMax(env: Record<string, string | undefined>): MiniMaxTtsService | undefined {
  const apiKey = env.MINIMAX_API_KEY?.trim();
  const rawVoices = env.MINIMAX_VOICES?.trim();
  if (!apiKey && !rawVoices) return undefined;
  if (!apiKey || !rawVoices) {
    console.warn("[MiniMax] Bỏ qua giọng MiniMax: cần cả MINIMAX_API_KEY và MINIMAX_VOICES");
    return undefined;
  }
  try {
    return new MiniMaxTtsService({
      apiKey,
      voices: parseMiniMaxVoices(rawVoices),
      model: env.MINIMAX_MODEL,
      baseUrl: env.MINIMAX_BASE_URL,
    });
  } catch (error) {
    console.warn(`[MiniMax] Bỏ qua giọng MiniMax: ${error instanceof Error ? error.message : "cấu hình sai"}`);
    return undefined;
  }
}

function buildGemini(env: Record<string, string | undefined>): GeminiTtsService | undefined {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return undefined;
  return new GeminiTtsService({ apiKey, model: env.GEMINI_MODEL?.trim() || undefined });
}

let cached: ServerContainer | undefined;

export function serverContainer(): ServerContainer {
  cached ??= buildServerContainer(process.env);
  return cached;
}
