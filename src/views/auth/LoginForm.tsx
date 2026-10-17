"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SessionController, safeNextPath } from "@/client/controllers/SessionController";
import { AuthClient } from "@/client/services/AuthClient";

export function LoginForm() {
  const controller = useMemo(() => new SessionController(new AuthClient()), []);
  const state = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.state,
    () => controller.state,
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const next = useSearchParams().get("next");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (await controller.login(username, password)) {
      router.replace(safeNextPath(next));
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-16 flex w-full max-w-sm flex-col gap-4 rounded-xl bg-neutral-900 p-6 sm:mt-24">
      <h1 className="text-xl font-semibold">Tin Video Studio</h1>
      <label className="flex flex-col gap-1 text-sm">
        Tên đăng nhập
        <input
          className="rounded-md bg-neutral-800 px-3 py-2"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Mật khẩu
        <input
          className="rounded-md bg-neutral-800 px-3 py-2"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {state.status === "error" && <p className="text-sm text-red-400">{state.message}</p>}
      <button
        type="submit"
        disabled={state.status === "submitting"}
        className="min-h-11 sm:min-h-0 rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-50"
      >
        {state.status === "submitting" ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
