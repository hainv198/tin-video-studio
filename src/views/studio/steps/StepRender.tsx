"use client";

import { useEffect } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { useController } from "@/views/hooks/useController";

export function StepRender({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const render = useController(studio.render);
  const project = data.project;

  useEffect(() => {
    void studio.render.checkSupport();
  }, [studio]);

  if (!project) return null;
  const voiceSeconds = [...data.narrations.values()].reduce((sum, n) => sum + n.durationSec, 0);
  const working = render.status === "working";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Dựng và tải về</h2>
      <p className="text-sm text-neutral-400">
        {project.scenes.length} cảnh, giọng đọc khoảng {voiceSeconds.toFixed(0)} giây, nhạc: {data.music ? data.music.title : "không dùng"}.
      </p>
      {render.status === "unsupported" && (
        <p role="alert" className="text-red-400">
          Hãy dùng Chrome hoặc Edge bản mới. Thiếu: {render.missing.join(", ")}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={working || render.status === "unsupported"}
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-50"
          onClick={() => void studio.render.start()}
        >
          {render.status === "done" || render.status === "error" ? "Dựng lại" : "Dựng video"}
        </button>
        {working && (
          <button type="button" className="rounded-md bg-neutral-800 px-4 py-2" onClick={() => studio.render.cancel()}>
            Huỷ
          </button>
        )}
      </div>
      {render.status === "working" && (
        <div className="flex flex-col gap-1 text-sm">
          <span>{render.label}</span>
          <progress className="w-full" max={100} value={render.percent} />
        </div>
      )}
      {render.status === "error" && (
        <p role="alert" className="text-red-400">
          {render.message}
        </p>
      )}
      {render.status === "done" && (
        <div className="flex flex-col gap-2">
          <video data-testid="ket-qua" className="w-full max-w-[360px] rounded-lg" src={render.url} controls playsInline />
          <p className="text-sm text-neutral-400">
            {render.durationSec.toFixed(1)} giây, {(render.sizeBytes / 1024 / 1024).toFixed(1)} MB
          </p>
          {render.warnings.map((w) => (
            <p key={w} className="text-sm text-amber-400">
              {w}
            </p>
          ))}
          <a className="text-emerald-400 underline" href={render.url} download={render.fileName}>
            Tải MP4 ({render.fileName})
          </a>
        </div>
      )}
    </div>
  );
}
