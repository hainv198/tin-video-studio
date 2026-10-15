import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionService } from "@/server/auth/SessionService";
import { serverContainer } from "@/server/container";
import { LogoutButton } from "@/views/auth/LogoutButton";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const token = (await cookies()).get(SessionService.COOKIE)?.value;
  const user = await serverContainer().auth.authenticate(token).catch(() => null);
  if (!user) redirect("/dang-nhap");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tin Video Studio</h1>
        <div className="flex items-center gap-3 text-sm">
          <span>Xin chào, {user.displayName}</span>
          <LogoutButton />
        </div>
      </header>
      <p className="mt-8 text-neutral-400">Trình dựng 5 bước sẽ có ở chặng 3.</p>
    </main>
  );
}
