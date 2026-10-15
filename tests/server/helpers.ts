import { AuthController } from "@/server/auth/AuthController";
import { BcryptPasswordHasher } from "@/server/auth/PasswordHasher";
import { SessionService } from "@/server/auth/SessionService";
import { UserDirectory } from "@/server/auth/UserDirectory";

export const TEST_SECRET = "s".repeat(32);
export const TEST_PASSWORD = "matkhau-thu-123";

export async function makeTestAuth() {
  const hasher = new BcryptPasswordHasher(4);
  const passwordHash = await hasher.hash(TEST_PASSWORD);
  const users = UserDirectory.fromEnv(JSON.stringify([{ username: "hai", passwordHash, displayName: "Hải" }]));
  const sessions = new SessionService(TEST_SECRET);
  const auth = new AuthController(users, hasher, sessions);
  const cookieFor = async (username: string) =>
    `${SessionService.COOKIE}=${await sessions.issue({ username, displayName: "Hải" })}`;
  return { auth, sessions, users, cookieFor };
}
