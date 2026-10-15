import { existsSync, readFileSync } from "node:fs";
import { validateEnv } from "../src/server/env/validateEnv";

/** Nạp KEY=VALUE từ file (bỏ dòng trống và #); biến đã có trong process.env được ưu tiên, giống Next. */
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");
const result = validateEnv(process.env);
if (result.ok) {
  for (const line of result.summary) console.log(`✓ ${line}`);
} else {
  for (const line of result.problems) console.error(`✗ ${line}`);
  console.error("Cấu hình môi trường chưa đúng, dừng build. Xem README mục Deploy.");
  process.exit(1);
}
