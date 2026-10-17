"use client";

import { useMemo, useState } from "react";
import { ConfirmButton } from "@/views/components/ConfirmButton";
import { useController } from "@/views/hooks/useController";
import type { ConfigKeyStatus, ConfigSnapshot } from "@/server/config/ConfigController";
import { ConfigClient } from "./ConfigClient";
import { ConfigPanelController } from "./ConfigPanelController";

function statusText(k: ConfigKeyStatus): string {
  if (!k.isSet) return "Chưa đặt";
  if (k.kind === "json" && k.count !== undefined) return `Đã đặt (${k.count} mục)`;
  return "Đã đặt";
}

export function ConfigPanel({ initial }: { initial: ConfigSnapshot }) {
  const controller = useMemo(() => new ConfigPanelController(new ConfigClient(), initial), [initial]);
  const state = useController(controller);
  const { snapshot, busyKey, message } = state;
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function onSave(key: string) {
    if (await controller.save(key, drafts[key] ?? "")) setDrafts((d) => ({ ...d, [key]: "" }));
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Khoá dịch vụ (API key)</h2>
      {snapshot.editable ? (
        <p className="text-sm text-neutral-400">
          Dán key mới rồi bấm Lưu; key được ghi vào <code>.env.local</code> trên máy này. Ô để trống nghĩa là giữ nguyên. Giá trị
          cũ không bao giờ hiển thị lại.
        </p>
      ) : (
        <p className="text-sm text-amber-400">{snapshot.readOnlyReason}</p>
      )}
      {message ? (
        <p role="status" className={`text-sm ${message.tone === "ok" ? "text-emerald-400" : "text-red-400"}`}>
          {message.text}
        </p>
      ) : null}
      <ul className="space-y-3">
        {snapshot.keys.map((k) => {
          const busy = busyKey === k.key;
          return (
            <li key={k.key} className="space-y-1.5 rounded-md border border-neutral-800 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{k.label}</span>
                <code className="text-xs text-neutral-500">{k.key}</code>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${k.isSet ? "bg-emerald-900 text-emerald-300" : "bg-neutral-800 text-neutral-400"}`}
                >
                  {statusText(k)}
                </span>
              </div>
              <p className="text-xs text-neutral-500">{k.hint}</p>
              {snapshot.editable ? (
                <div className="flex flex-wrap gap-2">
                  <input
                    type="password"
                    autoComplete="new-password"
                    aria-label={`Dán ${k.label} mới`}
                    placeholder={k.kind === "flag" ? "Gõ 1 để bật" : "Dán key mới"}
                    className="min-h-11 sm:min-h-0 min-w-0 flex-1 basis-full rounded-md bg-neutral-800 px-3 py-1.5 text-sm sm:basis-0"
                    value={drafts[k.key] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [k.key]: e.target.value }))}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="min-h-11 sm:min-h-0 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                    disabled={busy || !(drafts[k.key] ?? "").trim()}
                    onClick={() => void onSave(k.key)}
                  >
                    {busy ? "Đang lưu…" : "Lưu"}
                  </button>
                  <ConfirmButton
                    label="Xoá"
                    prompt={`Xoá giá trị của "${k.label}"?`}
                    confirmAriaLabel={`Xác nhận xoá giá trị ${k.label}`}
                    className="min-h-11 sm:min-h-0 rounded-md bg-neutral-800 px-3 py-1.5 text-sm disabled:opacity-50"
                    disabled={busy || !k.isSet}
                    onConfirm={() => controller.clear(k.key)}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
