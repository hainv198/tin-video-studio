import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { UserDirectory } from "../src/server/auth/UserDirectory";

/**
 * Sinh tài khoản thử + khoá phiên vào process.env. Phải chạy ĐỒNG BỘ ngay khi nạp playwright.config.ts
 * (Playwright khởi động webServer TRƯỚC globalSetup nên globalSetup quá muộn). Idempotent: worker thừa hưởng env từ tiến trình chính.
 */
export function ensureE2eEnv(): void {
  // Luôn ép nhà cung cấp giả cho app e2e chạy local, kể cả khi shell đã có APP_USERS/E2E_PASSWORD (tránh chạy vào key thật).
  process.env.FAKE_PROVIDERS = "1";
  // Next nạp .env.local nhưng biến đã có trong process.env được ưu tiên; đặt chuỗi rỗng (≠ "1") để tắt giọng Edge dev dù .env.local có bật.
  process.env.EDGE_TTS_DEV = "";
  process.env.EDGE_TTS_BIN = "";
  // Chặn luôn giọng clone MiniMax và key thật trong .env.local: e2e chỉ dùng nhà cung cấp giả, không tốn hạn mức.
  for (const key of ["MINIMAX_API_KEY", "MINIMAX_VOICES", "GOOGLE_TTS_API_KEY", "PEXELS_API_KEY", "PIXABAY_API_KEY"]) process.env[key] = "";
  if (process.env.APP_USERS && process.env.E2E_PASSWORD) return; // worker thừa hưởng env từ tiến trình chính
  const password = process.env.E2E_PASSWORD ?? `e2e-${randomBytes(9).toString("base64url")}`;
  const passwordHash = bcrypt.hashSync(password, 4);
  const json = JSON.stringify([{ username: "e2e", passwordHash, displayName: "Người thử" }]);
  UserDirectory.fromEnv(json); // kiểm định dạng như lúc chạy thật
  process.env.E2E_PASSWORD = password;
  process.env.APP_USERS = Buffer.from(json, "utf8").toString("base64");
  process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? randomBytes(32).toString("hex");
}
