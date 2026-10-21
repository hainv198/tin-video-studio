"use client";

import { useEffect } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { VIDEO_BITRATE_CHOICES, VIDEO_QUALITY_LABELS, type VideoQuality } from "@/client/render/encodingDefaults";
import { LONG_CLIP_SEC, renderSummary } from "@/client/controllers/renderSummary";
import { useController } from "@/views/hooks/useController";

export function StepRender({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const render = useController(studio.render);
  const project = data.project;

  useEffect(() => {
    void studio.render.checkSupport();
  }, [studio]);

  if (!project) return null;
  const working = render.status === "working";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Dựng và tải về</h2>
      <p className="text-sm text-neutral-400">{renderSummary(data)}</p>
      {project.kind === "upload" && (data.sourceClip?.durationSec ?? 0) > LONG_CLIP_SEC && (
        <p className="text-sm text-amber-400">
          Video dài: dựng có thể mất vài phút. Giữ tab này mở, không cho máy ngủ; chất lượng “Nhẹ” cho file nhỏ hơn và đỡ tốn bộ nhớ.
        </p>
      )}
      {render.status === "unsupported" && (
        <p role="alert" className="text-red-400">
          Hãy dùng Chrome hoặc Edge bản mới. Thiếu: {render.missing.join(", ")}
        </p>
      )}
      <fieldset className="flex flex-col gap-2 text-sm" disabled={working}>
        <legend className="mb-1 font-medium">Chất lượng video</legend>
        {(Object.keys(VIDEO_BITRATE_CHOICES) as VideoQuality[]).map((q) => (
          <label key={q} className="flex min-h-11 sm:min-h-0 items-center gap-2">
            <input
              type="radio"
              name="chat-luong-video"
              value={q}
              checked={render.quality === q}
              onChange={() => studio.render.setQuality(q)}
            />
            {VIDEO_QUALITY_LABELS[q]}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={working || render.status === "unsupported"}
          className="min-h-11 sm:min-h-0 rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-50"
          onClick={() => void studio.render.start()}
        >
          {render.status === "done" || render.status === "error" ? "Dựng lại" : "Dựng video"}
        </button>
        {working && (
          <button type="button" className="min-h-11 sm:min-h-0 rounded-md bg-neutral-800 px-4 py-2" onClick={() => studio.render.cancel()}>
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
          {render.stale && (
            <p className="text-sm text-amber-400">Kết quả này không còn khớp với dự án hoặc lựa chọn hiện tại, hãy dựng lại để cập nhật.</p>
          )}
          {render.warnings.map((w, i) => (
            <p key={`${i}-${w}`} className="text-sm text-amber-400">
              {w}
            </p>
          ))}
          <a className="flex min-h-11 sm:min-h-0 w-fit items-center break-all text-emerald-400 underline" href={render.url} download={render.fileName}>
            Tải MP4 ({render.fileName})
          </a>
        </div>
      )}
    </div>
  );
}
