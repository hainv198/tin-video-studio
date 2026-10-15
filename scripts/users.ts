import { readFileSync } from "node:fs";
import { BcryptPasswordHasher } from "../src/server/auth/PasswordHasher";
import { UserDirectory } from "../src/server/auth/UserDirectory";

const USAGE = [
  "Cách dùng:",
  '  npm run user:entry -- <tên-đăng-nhập> "<Tên hiển thị>" <mật khẩu ≥ 8 ký tự>',
  "  npm run user:encode -- users.local.json",
].join("\n");

async function entry(args: string[]): Promise<void> {
  const [username, displayName, password] = args;
  if (!username || !displayName || !password || password.length < 8) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  const passwordHash = await new BcryptPasswordHasher().hash(password);
  console.log(JSON.stringify({ username: username.trim().toLowerCase(), passwordHash, displayName: displayName.trim() }));
}

function encode(args: string[]): void {
  const [file] = args;
  if (!file) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  const json = JSON.stringify(JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")));
  UserDirectory.fromEnv(json);
  console.log(Buffer.from(json, "utf8").toString("base64"));
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === "entry") return entry(args);
  if (command === "encode") return encode(args);
  console.error(USAGE);
  process.exitCode = 1;
}

void main();
