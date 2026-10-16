import { readFileSync } from "node:fs";
import { BcryptPasswordHasher } from "../src/server/auth/PasswordHasher";
import { UserDirectory } from "../src/server/auth/UserDirectory";
import { buildEntry, USAGE } from "./lib/userEntry";

async function entry(args: string[]): Promise<void> {
  const result = await buildEntry(args, new BcryptPasswordHasher());
  if (!result) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(result));
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
