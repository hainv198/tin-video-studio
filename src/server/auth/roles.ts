import { ForbiddenError } from "@/domain/errors";
import type { UserRole } from "./UserDirectory";

export const ADMIN_ONLY_MESSAGE = "Chỉ quản trị viên được thay đổi cấu hình";

export function isAdmin(user: { role: UserRole }): boolean {
  return user.role === "admin";
}

export function requireAdmin(user: { role: UserRole }): void {
  if (!isAdmin(user)) throw new ForbiddenError(ADMIN_ONLY_MESSAGE);
}
