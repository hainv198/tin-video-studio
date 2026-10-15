import { AuthController } from "./auth/AuthController";
import { BcryptPasswordHasher } from "./auth/PasswordHasher";
import { SessionService } from "./auth/SessionService";
import { UserDirectory } from "./auth/UserDirectory";
import { FakeStockProvider } from "./stock/FakeStockProvider";
import { PexelsService } from "./stock/PexelsService";
import { PixabayService } from "./stock/PixabayService";
import { StockController } from "./stock/StockController";
import type { StockProvider } from "./stock/StockProvider";
import { FakeTtsProvider } from "./tts/FakeTtsProvider";
import { GoogleTtsService } from "./tts/GoogleTtsService";
import { MiniMaxTtsService, parseMiniMaxVoices } from "./tts/MiniMaxTtsService";
import { routed, RoutingTtsProvider } from "./tts/RoutingTtsProvider";
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
  const users = UserDirectory.fromEnv(env.APP_USERS);
  const sessions = new SessionService(env.AUTH_SECRET ?? "");
  const auth = new AuthController(users, new BcryptPasswordHasher(), sessions);

  const baseTts: TtsProvider = usingFakes ? new FakeTtsProvider() : new GoogleTtsService(env.GOOGLE_TTS_API_KEY ?? "");
  const ttsProvider = withMiniMax(baseTts, env);
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

/** MiniMax là tuỳ chọn: chỉ bật khi có đủ key và danh sách giọng hợp lệ; thiếu hoặc sai thì cảnh báo và chạy như cũ. Giọng clone đứng đầu danh sách. */
function withMiniMax(base: TtsProvider, env: Record<string, string | undefined>): TtsProvider {
  const apiKey = env.MINIMAX_API_KEY?.trim();
  const rawVoices = env.MINIMAX_VOICES?.trim();
  if (!apiKey && !rawVoices) return base;
  if (!apiKey || !rawVoices) {
    console.warn("[MiniMax] Bỏ qua giọng MiniMax: cần cả MINIMAX_API_KEY và MINIMAX_VOICES");
    return base;
  }
  let minimax: MiniMaxTtsService;
  try {
    minimax = new MiniMaxTtsService({
      apiKey,
      voices: parseMiniMaxVoices(rawVoices),
      model: env.MINIMAX_MODEL,
      baseUrl: env.MINIMAX_BASE_URL,
    });
  } catch (error) {
    console.warn(`[MiniMax] Bỏ qua giọng MiniMax: ${error instanceof Error ? error.message : "cấu hình sai"}`);
    return base;
  }
  return new RoutingTtsProvider([minimax, routed(base, (voiceName) => !minimax.owns(voiceName))]);
}

let cached: ServerContainer | undefined;

export function serverContainer(): ServerContainer {
  cached ??= buildServerContainer(process.env);
  return cached;
}
