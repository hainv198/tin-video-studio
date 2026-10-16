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
import { parseVclipVoices, VclipTtsService } from "./tts/VclipTtsService";

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

  // Giọng nền: giả lập khi dev; Google Cloud khi có key. Không có Google thì Gemini/MiniMax đứng một mình được.
  const edgeDev = env.EDGE_TTS_DEV === "1";
  const baseTts: TtsProvider | undefined = usingFakes
    ? edgeDev
      ? new EdgeCliTtsProvider({ bin: env.EDGE_TTS_BIN })
      : new FakeTtsProvider()
    : env.GOOGLE_TTS_API_KEY?.trim()
      ? new GoogleTtsService(env.GOOGLE_TTS_API_KEY.trim())
      : undefined;
  const ttsProvider = composeTts(baseTts, env, !usingFakes && edgeDev ? new EdgeCliTtsProvider({ bin: env.EDGE_TTS_BIN }) : undefined);
  // Cảnh trám: dùng nguồn nào có key (Pexels đang tạm ngừng cấp key mới, nên chỉ Pixabay cũng chạy được).
  const stockProviders: StockProvider[] = usingFakes ? [new FakeStockProvider()] : buildStockProviders(env);

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

function buildStockProviders(env: Record<string, string | undefined>): StockProvider[] {
  const providers: StockProvider[] = [];
  if (env.PEXELS_API_KEY?.trim()) providers.push(new PexelsService(env.PEXELS_API_KEY.trim()));
  if (env.PIXABAY_API_KEY?.trim()) providers.push(new PixabayService(env.PIXABAY_API_KEY.trim()));
  if (providers.length === 0) throw new Error("Cần PEXELS_API_KEY hoặc PIXABAY_API_KEY để tìm cảnh trám");
  return providers;
}

/**
 * vclip, MiniMax, Gemini và Edge (chỉ dev, tự động chuyển khi Gemini hết lượt) đều tuỳ chọn.
 * Thứ tự danh sách giọng: vclip, MiniMax (giọng clone), Gemini, Edge, rồi giọng nền (nếu có).
 */
function composeTts(base: TtsProvider | undefined, env: Record<string, string | undefined>, edge?: RoutedTtsProvider): TtsProvider {
  const candidates: Array<RoutedTtsProvider | undefined> = [buildVclip(env), buildMiniMax(env), buildGemini(env), edge];
  const optional = candidates.filter((p): p is RoutedTtsProvider => p !== undefined);
  if (!base && optional.length === 0) {
    throw new Error("Cần một nguồn giọng: VCLIP_API_KEY + VCLIP_VOICES, GEMINI_API_KEY, GOOGLE_TTS_API_KEY hoặc MiniMax");
  }
  if (!base) return new RoutingTtsProvider(optional);
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

/** Giống MiniMax: chỉ bật khi có đủ VCLIP_API_KEY và VCLIP_VOICES hợp lệ. */
function buildVclip(env: Record<string, string | undefined>): VclipTtsService | undefined {
  const apiKey = env.VCLIP_API_KEY?.trim();
  const rawVoices = env.VCLIP_VOICES?.trim();
  if (!apiKey && !rawVoices) return undefined;
  if (!apiKey || !rawVoices) {
    console.warn("[vclip] Bỏ qua giọng vclip: cần cả VCLIP_API_KEY và VCLIP_VOICES");
    return undefined;
  }
  try {
    return new VclipTtsService({ apiKey, voices: parseVclipVoices(rawVoices) });
  } catch (error) {
    console.warn(`[vclip] Bỏ qua giọng vclip: ${error instanceof Error ? error.message : "cấu hình sai"}`);
    return undefined;
  }
}

function buildGemini(env: Record<string, string | undefined>): GeminiTtsService | undefined {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return undefined;
  return new GeminiTtsService({ apiKey, model: env.GEMINI_MODEL?.trim() || undefined });
}

/** Next tách module theo route nên cache phải nằm trên globalThis, nếu không reset ở route cấu hình không tới được route khác. */
const globalCache = globalThis as typeof globalThis & { __tvsServerContainer?: ServerContainer };

export function serverContainer(): ServerContainer {
  globalCache.__tvsServerContainer ??= buildServerContainer(process.env);
  return globalCache.__tvsServerContainer;
}

/** Bỏ container đang cache để lần gọi sau dựng lại theo process.env mới (dùng sau khi lưu cấu hình). */
export function resetServerContainer(): void {
  globalCache.__tvsServerContainer = undefined;
}
