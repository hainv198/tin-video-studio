"use client";

import { useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { footageOwners, missingFootageSceneIds } from "@/client/controllers/readiness";
import { canContinueFootage } from "@/domain/footageGroups";
import { useController } from "@/views/hooks/useController";
import { FootagePreview } from "../components/FootagePreview";

const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.mov";

/** Nhãn đoạn như trên thẻ: "Mở đầu" cho đoạn đầu, "Cảnh k" cho các đoạn sau. */
const sceneLabel = (index: number) => (index === 0 ? "Mở đầu" : `Cảnh ${index}`);

function OwnFootageToggle({ studio, sceneId, checked }: { studio: Studio; sceneId: string; checked: boolean }) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => studio.options.setSceneContinued(sceneId, !e.target.checked)} />
      Có cảnh trám riêng
    </label>
  );
}

function SceneCard({ studio, sceneId, index }: { studio: Studio; sceneId: string; index: number }) {
  const data = useController(studio.session);
  useController(studio.footage); // vẽ lại khi kho file tải lên đổi (nguồn của danh sách "Dùng file đã tải lên")
  const search = useController(studio.search);
  const project = data.project;
  const scene = project?.scenes.find((s) => s.id === sceneId);
  const state = search.byScene[sceneId];
  const [draft, setDraft] = useState<{ base: string; text: string } | null>(null);
  const base = state?.query ?? "";
  const shown = draft && draft.base === base ? draft.text : base;
  if (!project || !scene) return null;
  const owners = footageOwners(data);
  const ownerId = owners.get(sceneId) ?? sceneId;
  const canContinue = canContinueFootage(project.scenes, sceneId);
  const heading = (
    <div className="text-sm">
      <span className="text-neutral-500">{sceneLabel(index)}: </span>
      {scene.text}
    </div>
  );

  if (ownerId !== sceneId) {
    // Không có cảnh riêng: thu gọn, ảnh/video của chủ cảnh chạy tiếp qua đoạn này.
    const ownerIndex = project.scenes.findIndex((s) => s.id === ownerId);
    return (
      <li className="flex flex-col gap-2 rounded-lg border border-dashed border-neutral-800 p-3">
        {heading}
        <OwnFootageToggle studio={studio} sceneId={sceneId} checked={false} />
        <p className="text-sm text-neutral-400">Dùng tiếp cảnh của {sceneLabel(ownerIndex)}</p>
      </li>
    );
  }

  const current = data.footage.get(sceneId);
  // Chỉ hoán đổi với đoạn có cảnh riêng (cảnh của đoạn dùng tiếp đang ẩn).
  const others = project.scenes.filter((s) => s.id !== sceneId && owners.get(s.id) === s.id);
  const pool = studio.footage.pool();
  const kind = data.options.sceneFootageKind(sceneId);

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-neutral-800 p-3">
      {heading}
      {canContinue && <OwnFootageToggle studio={studio} sceneId={sceneId} checked />}
      <FootagePreview studio={studio} footage={current} />
      <form
        className="flex flex-wrap items-center gap-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void studio.search.search(sceneId, shown);
          setDraft(null);
        }}
      >
        <div role="group" aria-label="Loại cảnh trám" className="flex overflow-hidden rounded-md">
          {(["image", "video"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              disabled={state?.loading}
              title={kind === k ? "Bấm lại để tìm cả ảnh và video" : undefined}
              className={`px-3 py-1.5 disabled:opacity-50 ${kind === k ? "bg-emerald-600 font-medium" : "bg-neutral-800"}`}
              onClick={() => void studio.search.setSceneKind(sceneId, kind === k ? null : k)}
            >
              {k === "image" ? "Ảnh" : "Video"}
            </button>
          ))}
        </div>
        <input
          className="min-w-40 flex-1 rounded-md bg-neutral-800 px-3 py-1.5"
          placeholder="Từ khoá tiếng Anh (ví dụ: police car)"
          aria-label="Từ khoá tìm cảnh trám"
          value={shown}
          onChange={(e) => setDraft({ base, text: e.target.value })}
        />
        <button type="submit" disabled={state?.loading} className="rounded-md bg-neutral-700 px-3 py-1.5 disabled:opacity-50">
          Tìm lại
        </button>
      </form>
      {state?.loading && <p className="text-sm text-neutral-400">Đang tìm…</p>}
      {state?.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state?.empty && (
        <p className="text-sm text-amber-400">Không tìm ra kết quả. Hãy sửa từ khoá; nếu bỏ qua, cảnh dùng nền mặc định.</p>
      )}
      {state && state.items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {state.items.map((item) => (
            <button
              key={`${item.provider}-${item.kind}-${item.id}`}
              type="button"
              title={`${item.kind === "video" ? "Video" : "Ảnh"} · ${item.author}`}
              className="relative overflow-hidden rounded-md ring-emerald-500 hover:ring-2"
              onClick={() => studio.search.choose(sceneId, item)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="h-16 w-28 object-cover" src={item.thumbUrl} alt={item.kind === "video" ? "Video gợi ý" : "Ảnh gợi ý"} />
              {item.kind === "video" && <span className="absolute bottom-0 right-0 bg-black/70 px-1 text-xs">▶</span>}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="cursor-pointer rounded-md bg-neutral-800 px-3 py-1.5 hover:bg-neutral-700 focus-within:ring-2 focus-within:ring-emerald-500">
          Tải file thay thế
          <input
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void studio.footage.replaceWithFile(sceneId, file);
              e.target.value = "";
            }}
          />
        </label>
        <button type="button" className="rounded-md bg-neutral-800 px-3 py-1.5" onClick={() => studio.footage.unassign(sceneId)}>
          Dùng nền mặc định
        </button>
        <select
          aria-label="Hoán đổi với cảnh khác"
          className="rounded-md bg-neutral-800 px-2 py-1.5"
          value=""
          onChange={(e) => {
            if (e.target.value) studio.footage.swap(sceneId, e.target.value);
          }}
        >
          <option value="">Hoán đổi với…</option>
          {others.map((s) => (
            <option key={s.id} value={s.id}>
              {s.role === "intro" ? "Mở đầu" : `Cảnh ${project.scenes.indexOf(s)}`}
            </option>
          ))}
        </select>
        {pool.length > 0 && (
          <select
            aria-label="Dùng file đã tải lên"
            className="rounded-md bg-neutral-800 px-2 py-1.5"
            value=""
            onChange={(e) => {
              if (e.target.value) studio.footage.assignFromPool(sceneId, e.target.value);
            }}
          >
            <option value="">Dùng file đã tải lên…</option>
            {pool.map((f, i) => (
              <option key={f.id} value={f.id}>
                File {i + 1} ({f.kind === "video" ? "video" : "ảnh"})
              </option>
            ))}
          </select>
        )}
      </div>
    </li>
  );
}

export function StepFootage({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const footage = useController(studio.footage);
  const search = useController(studio.search);
  const project = data.project;
  if (!project) return null;
  const ownCount = [...footageOwners(data)].filter(([id, owner]) => id === owner).length;
  const missing = missingFootageSceneIds(data).length;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Duyệt cảnh trám</h2>
      <p className="text-sm text-neutral-400">
        Tải ảnh/video của bạn lên (gán lần lượt vào các cảnh còn trống), rồi để app tự tìm cảnh trám cho cảnh còn lại. Bấm vào ảnh
        gợi ý để đổi.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-md bg-neutral-800 px-4 py-2 hover:bg-neutral-700 focus-within:ring-2 focus-within:ring-emerald-500">
          Tải ảnh/video lên
          <input
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) void studio.footage.addFiles(files);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          disabled={search.autoRunning}
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-50"
          onClick={() => void studio.search.autoFill()}
        >
          {search.autoRunning ? "Đang tìm…" : "Tự tìm cảnh còn trống"}
        </button>
        {search.autoRunning && (
          <button type="button" className="rounded-md bg-neutral-800 px-4 py-2" onClick={() => studio.search.cancel()}>
            Dừng
          </button>
        )}
        {footage.busy && <span className="text-sm text-neutral-400">Đang xử lý file…</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="rounded-md bg-neutral-800 px-3 py-1.5" onClick={() => studio.options.mergeScenesInPairs()}>
          Gộp: mỗi 2 đoạn một cảnh
        </button>
        <button type="button" className="rounded-md bg-neutral-800 px-3 py-1.5" onClick={() => studio.options.resetSceneGrouping()}>
          Mỗi đoạn một cảnh
        </button>
        <span className="text-neutral-400">
          {ownCount}/{project.scenes.length} đoạn có cảnh trám riêng{missing > 0 ? ` · còn ${missing} cảnh trống` : ""}
        </span>
      </div>

      {footage.error && (
        <p role="alert" className="text-sm text-red-400">
          {footage.error}
        </p>
      )}
      {search.warnings.map((w) => (
        <p key={w} className="text-sm text-amber-400">
          {w}
        </p>
      ))}
      <ol className="flex flex-col gap-3">
        {project.scenes.map((scene, index) => (
          <SceneCard key={scene.id} studio={studio} sceneId={scene.id} index={index} />
        ))}
      </ol>
    </div>
  );
}
