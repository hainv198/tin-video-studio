"use client";

import { useEffect, useRef, useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { toDateInput } from "@/client/controllers/dateText";
import { loadClipThumbnail } from "@/client/media/ClipThumbnail";
import { formatClock, SOURCE_CLIP_LIMITS } from "@/client/media/UploadValidator";
import { SOURCE_CLIP_VOLUME } from "@/domain/SourceClip";
import type { DrawableImage } from "@/templates/VideoTemplate";
import { ConfirmButton } from "@/views/components/ConfirmButton";
import { useController } from "@/views/hooks/useController";
import { PreviewPanel } from "../components/PreviewPanel";

const ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";
const MB = 1024 * 1024;

export function StepClip({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const clipState = useController(studio.clip);
  const project = data.project;
  const clip = data.sourceClip;
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [thumb, setThumb] = useState<DrawableImage | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const uploadId = clip?.uploadId ?? null;
  const thumbnailSec = clip?.thumbnailSec ?? 0;
  const gain = clip?.gain ?? 1;

  useEffect(() => {
    if (!uploadId) return;
    let alive = true;
    let objectUrl: string | null = null;
    let disposeThumb: (() => void) | null = null;
    void (async () => {
      const blob = await studio.clip.blobFor(uploadId);
      if (!alive) return;
      if (!blob) {
        setMissing(true);
        return;
      }
      objectUrl = studio.services.env.createUrl(blob);
      setUrl(objectUrl);
      try {
        const loaded = await loadClipThumbnail(blob, thumbnailSec);
        if (!alive) {
          loaded.dispose();
          return;
        }
        disposeThumb = loaded.dispose;
        setThumb(loaded.image);
      } catch {
        // xem trước không bắt buộc: giữ ảnh minh hoạ
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) studio.services.env.revokeUrl(objectUrl);
      disposeThumb?.();
      setUrl(null);
      setThumb(null);
      setMissing(false);
    };
  }, [studio, uploadId, thumbnailSec]);

  useEffect(() => {
    // Trình duyệt chỉ phát tới 100 %; mức trên 100 % chỉ áp khi dựng.
    if (videoRef.current) videoRef.current.volume = Math.min(1, gain);
  }, [gain, url]);

  if (!project) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]">
      <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
        <h2 className="text-lg font-semibold">Video của bạn</h2>
        <label className="flex flex-col gap-1 text-sm">
          {clip ? "Thay video khác" : "Chọn video"} (MP4, MOV, WebM; tối đa {SOURCE_CLIP_LIMITS.maxDurationSec / 60} phút,{" "}
          {SOURCE_CLIP_LIMITS.maxBytes / MB} MB)
          <input
            type="file"
            accept={ACCEPT}
            disabled={clipState.busy}
            className="min-h-11 max-w-full text-sm sm:min-h-0"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void studio.clip.upload(file);
            }}
          />
        </label>
        {clipState.busy && (
          <p role="status" className="text-sm text-neutral-400">
            Đang đọc và lưu video…
          </p>
        )}
        {clipState.error && (
          <p role="alert" className="text-red-400">
            {clipState.error}
          </p>
        )}
        {clip && (
          <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-neutral-800 p-3 text-sm">
            <p data-testid="video-tai-len" className="break-all">
              {clip.name} · {formatClock(clip.durationSec)} · {clip.width}×{clip.height} ·{" "}
              {clip.hasAudio ? "có tiếng gốc" : "không có tiếng gốc"}
            </p>
            {missing && (
              <p role="alert" className="text-amber-400">
                Không tìm thấy file video trong trình duyệt (có thể đã bị dọn). Hãy chọn lại video.
              </p>
            )}
            {url && <video ref={videoRef} src={url} controls playsInline className="w-full max-w-[360px] rounded-md bg-black" />}
            <label className="flex flex-col gap-1">
              Âm thanh gốc: {clip.volumePercent === 0 ? "Tắt" : `${clip.volumePercent}%`}
              <input
                type="range"
                min={SOURCE_CLIP_VOLUME.min}
                max={SOURCE_CLIP_VOLUME.max}
                step={SOURCE_CLIP_VOLUME.step}
                value={clip.volumePercent}
                disabled={!clip.hasAudio}
                onChange={(e) => studio.clip.setVolume(Number(e.target.value))}
              />
            </label>
            <p className="text-xs text-neutral-500">
              {clip.hasAudio
                ? "100% = giữ nguyên tiếng gốc; kéo về 0 để tắt. Nghe thử trong khung trên chỉ tới 100%."
                : "Video này không có tiếng gốc; phần video chỉ có nhạc nền (nếu chọn)."}
            </p>
            <ConfirmButton
              label="Xoá video"
              prompt="Xoá video đã tải lên?"
              confirmAriaLabel="Xác nhận xoá video"
              className="min-h-11 self-start rounded-md bg-neutral-800 px-3 py-1.5 sm:min-h-0"
              onConfirm={() => studio.clip.remove()}
            />
          </div>
        )}
      </div>
      <PreviewPanel
        studio={studio}
        image={thumb}
        form={{
          text: "",
          title: project.title,
          sourceCredit: project.sourceCredit,
          publishDateText: toDateInput(project.publishDate),
          templateId: project.templateId,
          kind: "upload",
        }}
      />
    </div>
  );
}
