import path from "node:path";
import { resetServerContainer } from "@/server/container";
import { ConfigController } from "./ConfigController";
import { EnvFileWriter } from "./EnvFileWriter";

/** Bộ điều khiển cấu hình gắn với .env.local ở thư mục gốc dự án và process.env hiện tại. */
export function localConfigController(): ConfigController {
  return new ConfigController({
    writer: new EnvFileWriter(path.join(process.cwd(), ".env.local")),
    env: process.env,
    onApplied: resetServerContainer,
  });
}
