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

  const ttsProvider: TtsProvider = usingFakes
    ? new FakeTtsProvider()
    : new GoogleTtsService(env.GOOGLE_TTS_API_KEY ?? "");
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

let cached: ServerContainer | undefined;

export function serverContainer(): ServerContainer {
  cached ??= buildServerContainer(process.env);
  return cached;
}
