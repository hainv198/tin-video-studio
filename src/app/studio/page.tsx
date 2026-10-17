import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdmin } from "@/server/auth/roles";
import { SessionService } from "@/server/auth/SessionService";
import { serverContainer } from "@/server/container";
import { LogoutButton } from "@/views/auth/LogoutButton";
import { StudioApp } from "@/views/studio/StudioApp";

export const dynamic = "force-dynamic";

const MENU_LINK = "flex min-h-11 items-center rounded-md px-3 hover:bg-neutral-800";

export default async function StudioPage() {
  const token = (await cookies()).get(SessionService.COOKIE)?.value;
  const user = await serverContainer().auth.authenticate(token).catch(() => null);
  if (!user) redirect("/dang-nhap");
  const admin = isAdmin(user);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-4 pb-6 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="truncate text-lg font-semibold sm:text-xl">Tin Video Studio</h1>
        <div className="hidden items-center gap-3 text-sm sm:flex">
          <span>Xin chào, {user.displayName}</span>
          {admin ? (
            <>
              <Link href="/cai-dat" className="underline">
                Cấu hình
              </Link>
              <Link href="/tai-khoan" className="underline">
                Tài khoản
              </Link>
            </>
          ) : null}
          <LogoutButton />
        </div>
        {/* Điện thoại: lời chào và liên kết gom vào menu thu gọn để tiêu đề không xuống dòng. */}
        <details className="group relative sm:hidden">
          <summary
            aria-label="Menu tài khoản"
            className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-md bg-neutral-800 px-3 text-sm [&::-webkit-details-marker]:hidden"
          >
            <span aria-hidden>☰</span>
          </summary>
          <div className="absolute right-0 z-40 mt-2 flex w-56 flex-col gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-sm shadow-xl">
            <span className="truncate px-3 py-2 text-neutral-400">Xin chào, {user.displayName}</span>
            {admin ? (
              <>
                <Link href="/cai-dat" className={MENU_LINK}>
                  Cấu hình
                </Link>
                <Link href="/tai-khoan" className={MENU_LINK}>
                  Tài khoản
                </Link>
              </>
            ) : null}
            <LogoutButton className="min-h-11 rounded-md bg-neutral-800 px-3 text-left text-sm" />
          </div>
        </details>
      </header>
      <StudioApp />
    </main>
  );
}
