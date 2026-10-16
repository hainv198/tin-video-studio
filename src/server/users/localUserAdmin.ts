import path from "node:path";
import { BcryptPasswordHasher } from "@/server/auth/PasswordHasher";
import { EnvFileWriter } from "@/server/config/EnvFileWriter";
import { resetServerContainer } from "@/server/container";
import { UserAdminController } from "./UserAdminController";

/** Quản lý tài khoản gắn với .env.local ở thư mục gốc dự án và process.env hiện tại. */
export function localUserAdminController(): UserAdminController {
  return new UserAdminController({
    writer: new EnvFileWriter(path.join(process.cwd(), ".env.local")),
    env: process.env,
    hasher: new BcryptPasswordHasher(),
    onApplied: resetServerContainer,
  });
}
