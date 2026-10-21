import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionService } from "@/server/auth/SessionService";
import { serverContainer } from "@/server/container";
import { VoiceStudioApp } from "@/views/doc-giong/VoiceStudioApp";

export const dynamic = "force-dynamic";

/** Tạo giọng đọc riêng (không gắn với dự án video): mọi người dùng đã đăng nhập đều dùng được. */
export default async function VoiceStudioPage() {
  const token = (await cookies()).get(SessionService.COOKIE)?.value;
  const user = await serverContainer().auth.authenticate(token).catch(() => null);
  if (!user) redirect("/dang-nhap?next=%2Fdoc-giong");

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 pt-4 pb-6 sm:p-6">
      <header className="space-y-1">
        <Link href="/studio" className="inline-flex min-h-11 sm:min-h-0 items-center text-sm underline">
          ← Về trình dựng
        </Link>
        <h1 className="text-lg font-semibold sm:text-xl">Tạo giọng đọc</h1>
        <p className="text-sm text-neutral-400">
          Nhập nội dung bất kỳ, tạo giọng, nghe thử rồi tải file âm thanh. Âm thanh chỉ nằm trong trình duyệt của bạn, không lưu lên máy chủ.
        </p>
      </header>
      <VoiceStudioApp />
    </main>
  );
}
