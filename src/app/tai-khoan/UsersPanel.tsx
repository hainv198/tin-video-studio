"use client";

import { useMemo, useState } from "react";
import { useController } from "@/views/hooks/useController";
import type { UserRole } from "@/server/auth/UserDirectory";
import type { UsersSnapshot } from "@/server/users/UserAdminController";
import { randomPassword } from "./randomPassword";
import { UsersClient } from "./UsersClient";
import { UsersPanelController } from "./UsersPanelController";

const ROLE_LABEL: Record<UserRole, string> = { admin: "Quản trị (admin)", user: "Người dùng (user)" };
const EMPTY_FORM = { username: "", displayName: "", password: "", role: "user" as UserRole };
const INPUT = "min-w-0 rounded-md bg-neutral-800 px-3 py-1.5 text-sm";
const BUTTON = "rounded-md bg-neutral-800 px-3 py-1.5 text-sm disabled:opacity-50";
const PRIMARY = "rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium disabled:opacity-50";

export function UsersPanel({ initial, currentUsername }: { initial: UsersSnapshot; currentUsername: string }) {
  const controller = useMemo(() => new UsersPanelController(new UsersClient(), initial), [initial]);
  const { snapshot, busy, message, appUsers, oneTimePassword } = useController(controller);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formGenerated, setFormGenerated] = useState(false);
  const [pwTarget, setPwTarget] = useState<string | null>(null);
  const [pwDraft, setPwDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const full = snapshot.users.length >= snapshot.maxUsers;

  async function onAdd() {
    if (await controller.add(form, formGenerated)) {
      setForm(EMPTY_FORM);
      setFormGenerated(false);
    }
  }

  async function onSetPassword(username: string, generated: boolean) {
    const password = generated ? randomPassword() : pwDraft;
    if (await controller.setPassword(username, password, generated)) {
      setPwTarget(null);
      setPwDraft("");
    }
  }

  async function onToggleRole(username: string, role: UserRole) {
    const next: UserRole = role === "admin" ? "user" : "admin";
    if (window.confirm(`Đổi role của "${username}" thành ${ROLE_LABEL[next]}?`)) await controller.setRole(username, next);
  }

  async function onRemove(username: string) {
    if (window.confirm(`Xoá tài khoản "${username}"? Người này sẽ bị đăng xuất và không đăng nhập lại được.`)) {
      await controller.remove(username);
    }
  }

  async function onCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-medium">
          Danh sách tài khoản ({snapshot.users.length}/{snapshot.maxUsers})
        </h2>
        {snapshot.editable ? (
          <p className="text-sm text-neutral-400">
            Thay đổi được ghi vào <code>APP_USERS</code> trong <code>.env.local</code> trên máy này và có hiệu lực ngay. Mật khẩu
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

        {oneTimePassword ? (
          <div className="space-y-1.5 rounded-md border border-amber-700 bg-amber-950/40 p-3 text-sm">
            <p>
              Mật khẩu mới của <strong>{oneTimePassword.username}</strong> (chỉ hiện một lần, hãy chép gửi cho người dùng ngay):
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-neutral-900 px-2 py-1 text-base">{oneTimePassword.password}</code>
              <button type="button" className={BUTTON} onClick={() => void onCopy(oneTimePassword.password)}>
                Sao chép
              </button>
            </div>
          </div>
        ) : null}

        {appUsers ? (
          <div className="space-y-1.5 rounded-md border border-neutral-700 p-3 text-sm">
            <label htmlFor="app-users-value" className="block font-medium">
              Giá trị APP_USERS mới
            </label>
            <textarea
              id="app-users-value"
              readOnly
              rows={4}
              className="w-full break-all rounded-md bg-neutral-900 px-3 py-1.5 font-mono text-xs"
              value={appUsers}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex items-center gap-2">
              <button type="button" className={PRIMARY} onClick={() => void onCopy(appUsers)}>
                Sao chép
              </button>
              {copied ? <span className="text-xs text-emerald-400">Đã sao chép</span> : null}
            </div>
            <p className="text-xs text-neutral-500">
              Sao chép giá trị này vào Vercel → Settings → Environment Variables → APP_USERS rồi Redeploy. Mỗi lần chỉ nên làm một
              thay đổi: danh sách bên trên vẫn là cấu hình đang chạy cho tới khi Redeploy xong.
            </p>
          </div>
        ) : null}

        <table className="w-full border border-neutral-800 text-left text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="border border-neutral-800 px-3 py-1.5 font-medium">Tên đăng nhập</th>
              <th className="border border-neutral-800 px-3 py-1.5 font-medium">Tên hiển thị</th>
              <th className="border border-neutral-800 px-3 py-1.5 font-medium">Role</th>
              <th className="border border-neutral-800 px-3 py-1.5 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.users.map((u) => {
              const isSelf = u.username === currentUsername;
              return (
                <tr key={u.username} className="align-top">
                  <td className="border border-neutral-800 px-3 py-1.5">
                    <code>{u.username}</code>
                    {isSelf ? <span className="ml-1 text-xs text-neutral-500">(bạn)</span> : null}
                  </td>
                  <td className="border border-neutral-800 px-3 py-1.5">{u.displayName}</td>
                  <td className="border border-neutral-800 px-3 py-1.5">{ROLE_LABEL[u.role]}</td>
                  <td className="space-y-2 border border-neutral-800 px-3 py-1.5">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={BUTTON}
                        disabled={busy}
                        onClick={() => {
                          setPwTarget(pwTarget === u.username ? null : u.username);
                          setPwDraft("");
                        }}
                      >
                        Đổi mật khẩu
                      </button>
                      <button
                        type="button"
                        className={BUTTON}
                        disabled={busy || (isSelf && u.role === "admin")}
                        title={isSelf ? "Không thể tự hạ quyền của chính mình" : undefined}
                        onClick={() => void onToggleRole(u.username, u.role)}
                      >
                        Đổi role
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-red-900 px-3 py-1.5 text-sm disabled:opacity-50"
                        disabled={busy || isSelf}
                        title={isSelf ? "Không thể tự xoá tài khoản của chính mình" : undefined}
                        onClick={() => void onRemove(u.username)}
                      >
                        Xoá
                      </button>
                    </div>
                    {pwTarget === u.username ? (
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="password"
                          autoComplete="new-password"
                          aria-label={`Mật khẩu mới cho ${u.username}`}
                          placeholder="Mật khẩu mới (≥ 8 ký tự)"
                          className={`${INPUT} flex-1`}
                          value={pwDraft}
                          onChange={(e) => setPwDraft(e.target.value)}
                          disabled={busy}
                        />
                        <button
                          type="button"
                          className={PRIMARY}
                          disabled={busy || pwDraft.length === 0}
                          onClick={() => void onSetPassword(u.username, false)}
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          className={BUTTON}
                          disabled={busy}
                          onClick={() => void onSetPassword(u.username, true)}
                        >
                          Đặt mật khẩu ngẫu nhiên
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Thêm tài khoản</h2>
        {full ? (
          <p className="text-sm text-neutral-400">Đã đủ {snapshot.maxUsers} tài khoản; xoá bớt một tài khoản để thêm mới.</p>
        ) : (
          <form
            className="grid gap-3 rounded-md border border-neutral-800 p-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void onAdd();
            }}
          >
            <label className="space-y-1 text-sm">
              <span className="block text-neutral-400">Tên đăng nhập</span>
              <input
                className={`${INPUT} w-full`}
                autoComplete="off"
                placeholder="vd. lan.nguyen"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                disabled={busy}
                required
              />
              <span className="block text-xs text-neutral-500">3–32 ký tự: chữ thường không dấu, số, . _ -</span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-neutral-400">Tên hiển thị</span>
              <input
                className={`${INPUT} w-full`}
                autoComplete="off"
                maxLength={40}
                placeholder="vd. Lan Nguyễn"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                disabled={busy}
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-neutral-400">Mật khẩu</span>
              <div className="flex gap-2">
                <input
                  type={formGenerated ? "text" : "password"}
                  autoComplete="new-password"
                  className={`${INPUT} flex-1`}
                  placeholder="Ít nhất 8 ký tự"
                  value={form.password}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, password: e.target.value }));
                    setFormGenerated(false);
                  }}
                  disabled={busy}
                  required
                />
                <button
                  type="button"
                  className={BUTTON}
                  disabled={busy}
                  onClick={() => {
                    setForm((f) => ({ ...f, password: randomPassword() }));
                    setFormGenerated(true);
                  }}
                >
                  Tạo mật khẩu ngẫu nhiên
                </button>
              </div>
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-neutral-400">Role</span>
              <select
                className={`${INPUT} w-full`}
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                disabled={busy}
              >
                <option value="user">{ROLE_LABEL.user}</option>
                <option value="admin">{ROLE_LABEL.admin}</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className={PRIMARY} disabled={busy}>
                {busy ? "Đang lưu…" : "Thêm tài khoản"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
