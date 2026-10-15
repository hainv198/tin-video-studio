import { AuthController } from "./auth/AuthController";
import { BcryptPasswordHasher } from "./auth/PasswordHasher";
import { SessionService } from "./auth/SessionService";
import { UserDirectory } from "./auth/UserDirectory";

export interface ServerContainer {
  users: UserDirectory;
  sessions: SessionService;
  auth: AuthController;
  secureCookies: boolean;
}

export function buildServerContainer(env: Record<string, string | undefined>): ServerContainer {
  const users = UserDirectory.fromEnv(env.APP_USERS);
  const sessions = new SessionService(env.AUTH_SECRET ?? "");
  const auth = new AuthController(users, new BcryptPasswordHasher(), sessions);
  return { users, sessions, auth, secureCookies: env.NODE_ENV === "production" };
}

let cached: ServerContainer | undefined;

export function serverContainer(): ServerContainer {
  cached ??= buildServerContainer(process.env);
  return cached;
}
