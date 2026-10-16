import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_ONLY_MESSAGE, isAdmin } from "@/server/auth/roles";
import { SessionService } from "@/server/auth/SessionService";
import { localConfigController } from "@/server/config/localConfig";
import { serverContainer } from "@/server/container";
import { validateEnv } from "@/server/env/validateEnv";
import type { TtsVoice } from "@/server/tts/TtsProvider";
import { ConfigPanel } from "./ConfigPanel";

export const dynamic = "force-dynamic";

const GENDER_LABEL: Record<string, string> = { MALE: "Nam", FEMALE: "Nữ", NEUTRAL: "Trung tính" };
const STOCK_LABEL: Record<string, string> = { pexels: "Pexels", pixabay: "Pixabay", fake: "Giả lập (dev)" };
const TIER_ORDER = ["Vclip", "MiniMax", "Gemini", "Chirp3-HD", "Neural2", "Wavenet", "Standard", "Edge", "Fake"];
const CLONE_ENV: Record<string, string> = { Vclip: "VCLIP_VOICES", MiniMax: "MINIMAX_VOICES" };

function groupByTier(voices: TtsVoice[]): [string, TtsVoice[]][] {
  const groups = new Map<string, TtsVoice[]>();
  for (const v of voices) groups.set(v.tier, [...(groups.get(v.tier) ?? []), v]);
  const rank = (t: string) => {
    const i = TIER_ORDER.indexOf(t);
    return i < 0 ? TIER_ORDER.length : i;
  };
  return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
}

export default async function SettingsPage() {
  const token = (await cookies()).get(SessionService.COOKIE)?.value;
  const container = serverContainer();
  const user = await container.auth.authenticate(token).catch(() => null);
  if (!user) redirect("/dang-nhap");

  if (!isAdmin(user)) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 p-6">
        <Link href="/studio" className="text-sm underline">
          ← Về trình dựng
        </Link>
        <h1 className="text-xl font-semibold">Cấu hình</h1>
        <p role="alert" className="text-sm text-red-400">
          {ADMIN_ONLY_MESSAGE}
        </p>
      </main>
    );
  }

  const env = validateEnv(process.env);
  const configSnapshot = localConfigController().snapshot();

  let voices: TtsVoice[] = [];
  let voiceError: string | null = null;
  try {
    voices = await container.tts.voices();
  } catch (error) {
    voiceError = error instanceof Error ? error.message : "Không tải được danh sách giọng đọc";
  }

  let stockNames: string[] = [];
  try {
    stockNames = container.stock.providerNames();
  } catch {
    stockNames = [];
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <header className="space-y-2">
        <div className="flex gap-4 text-sm">
          <Link href="/studio" className="underline">
            ← Về trình dựng
          </Link>
          <Link href="/tai-khoan" className="underline">
            Tài khoản
          </Link>
        </div>
        <h1 className="text-xl font-semibold">Cấu hình</h1>
        <p className="text-sm text-neutral-400">
          Các key nằm trong biến môi trường trên máy chủ (<code>.env.local</code> trên máy dev, Environment Variables trên
          Vercel) và không bao giờ được hiển thị ở đây. Chạy trên máy bạn thì có thể dán key mới ngay bên dưới.
        </p>
      </header>

      <ConfigPanel initial={configSnapshot} />

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Nguồn dịch vụ</h2>
        {env.ok ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
            {env.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-400">
            {env.problems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Giọng đọc có sẵn</h2>
        {voiceError ? (
          <p className="text-sm text-red-400">{voiceError}</p>
        ) : voices.length === 0 ? (
          <p className="text-sm text-neutral-400">Chưa có giọng đọc nào.</p>
        ) : (
          groupByTier(voices).map(([tier, list]) => (
            <div key={tier} className="space-y-1">
              <h3 className="text-sm font-medium text-neutral-300">
                {tier} ({list.length})
              </h3>
              {CLONE_ENV[tier] ? (
                <p className="text-xs text-neutral-500">Giọng clone: thêm/bớt bằng biến VCLIP_VOICES / MINIMAX_VOICES</p>
              ) : null}
              <table className="w-full border border-neutral-800 text-left text-sm">
                <thead className="bg-neutral-900 text-neutral-400">
                  <tr>
                    <th className="border border-neutral-800 px-3 py-1.5 font-medium">Tên giọng</th>
                    <th className="border border-neutral-800 px-3 py-1.5 font-medium">Giới tính</th>
                    <th className="border border-neutral-800 px-3 py-1.5 font-medium">Nguồn</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((v) => (
                    <tr key={v.name}>
                      <td className="border border-neutral-800 px-3 py-1.5">{v.name}</td>
                      <td className="border border-neutral-800 px-3 py-1.5">{GENDER_LABEL[v.gender] ?? v.gender}</td>
                      <td className="border border-neutral-800 px-3 py-1.5">{v.tier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Cảnh trám</h2>
        {stockNames.length === 0 ? (
          <p className="text-sm text-neutral-400">Chưa cấu hình nguồn cảnh trám nào.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
            {stockNames.map((name) => (
              <li key={name}>{STOCK_LABEL[name] ?? name}</li>
            ))}
          </ul>
        )}
      </section>

      <footer className="text-sm">
        <span className="underline">Xem README mục Deploy để đặt biến môi trường</span>
      </footer>
    </main>
  );
}
