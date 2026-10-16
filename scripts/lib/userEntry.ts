export interface UserEntry {
  username: string;
  passwordHash: string;
  displayName: string;
  role?: "admin" | "user";
}

export const USAGE = [
  "Cách dùng:",
  '  npm run user:entry -- <tên-đăng-nhập> "<Tên hiển thị>" <mật khẩu ≥ 8 ký tự> [admin|user]',
  "  npm run user:encode -- users.local.json",
].join("\n");

/** Trả null khi tham số sai. Không chỉ định role thì dòng JSON không có trường role (mặc định user). */
export async function buildEntry(args: string[], hasher: { hash(p: string): Promise<string> }): Promise<UserEntry | null> {
  const [username, displayName, password, role] = args;
  if (!username || !displayName || !password || password.length < 8) return null;
  if (role !== undefined && role !== "admin" && role !== "user") return null;
  const passwordHash = await hasher.hash(password);
  const entry: UserEntry = { username: username.trim().toLowerCase(), passwordHash, displayName: displayName.trim() };
  if (role) entry.role = role;
  return entry;
}
