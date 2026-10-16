import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_ONLY_MESSAGE, isAdmin } from "@/server/auth/roles";
import { SessionService } from "@/server/auth/SessionService";
import { serverContainer } from "@/server/container";
import { localUserAdminController } from "@/server/users/localUserAdmin";
import type { UsersSnapshot } from "@/server/users/UserAdminController";
import { UsersPanel } from "./UsersPanel";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const token = (await cookies()).get(SessionService.COOKIE)?.value;
  const user = await serverContainer().auth.authenticate(token).catch(() => null);
  if (!user) redirect("/dang-nhap");

  if (!isAdmin(user)) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 p-6">
        <Link href="/studio" className="text-sm underline">
          ← Về trình dựng
        </Link>
        <h1 className="text-xl font-semibold">Tài khoản</h1>
        <p role="alert" className="text-sm text-red-400">
          {ADMIN_ONLY_MESSAGE}
        </p>
      </main>
    );
  }

  let snapshot: UsersSnapshot | null = null;
  let loadError: string | null = null;
  try {
    snapshot = localUserAdminController().list();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Không đọc được danh sách tài khoản";
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <header className="space-y-2">
        <div className="flex gap-4 text-sm">
          <Link href="/studio" className="underline">
            ← Về trình dựng
          </Link>
          <Link href="/cai-dat" className="underline">
            Cấu hình
          </Link>
        </div>
        <h1 className="text-xl font-semibold">Tài khoản</h1>
        <p className="text-sm text-neutral-400">
          Cấp và quản lý tài khoản đăng nhập (tối đa 5). Quản trị viên (admin) vào được màn Cấu hình và màn này; người dùng
          (user) chỉ dựng video.
        </p>
      </header>

      {snapshot ? (
        <UsersPanel initial={snapshot} currentUsername={user.username} />
      ) : (
        <p role="alert" className="text-sm text-red-400">
          {loadError}
        </p>
      )}
    </main>
  );
}
