"use client";

import { useEffect, useRef } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { staleSceneIds } from "@/client/controllers/readiness";
import { useController } from "@/views/hooks/useController";

export function StepVoice({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const voice = useController(studio.voice);
  const playing = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    void studio.voice.loadVoices();
  }, [studio]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      playing.current?.audio.pause();
      if (playing.current) studio.services.env.revokeUrl(playing.current.url);
      playing.current = null;
    };
  }, [studio]);

  const project = data.project;
  if (!project) return null;
  const stale = new Set(staleSceneIds(data));
  const settings = data.voice;

  async function preview() {
    const blob = await studio.voice.previewVoice();
    if (!blob || !mounted.current) return;
    if (playing.current) {
      playing.current.audio.pause();
      studio.services.env.revokeUrl(playing.current.url);
    }
    const url = studio.services.env.createUrl(blob);
    const audio = new Audio(url);
    playing.current = { audio, url };
    audio.play().catch(() => {});
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Chọn giọng đọc</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Giọng
          <select
            className="rounded-md bg-neutral-800 px-3 py-2"
            value={settings?.voiceName ?? ""}
            onChange={(e) => studio.voice.selectVoice(e.target.value)}
          >
            {voice.voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.gender}, {v.tier})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tốc độ đọc: {(settings?.speakingRate ?? 1.07).toFixed(2)}
          <input
            type="range"
            min={0.8}
            max={1.3}
            step={0.01}
            value={settings?.speakingRate ?? 1.07}
            onChange={(e) => studio.voice.setRate(Number(e.target.value))}
          />
        </label>
      </div>
      {voice.voicesLoading && <p className="text-sm text-neutral-400">Đang tải danh sách giọng…</p>}
      {voice.error && (
        <p role="alert" className="text-red-400">
          {voice.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={voice.previewing || !settings}
          className="rounded-md bg-neutral-800 px-4 py-2 disabled:opacity-50"
          onClick={() => void preview()}
        >
          {voice.previewing ? "Đang đọc thử…" : "Nghe thử câu tiêu đề"}
        </button>
        <button
          type="button"
          disabled={voice.generating || stale.size === 0 || !settings}
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-50"
          onClick={() => void studio.voice.generate()}
        >
          {stale.size === project.scenes.length ? "Tạo giọng" : stale.size === 0 ? "Giọng đã đủ" : `Tạo lại ${stale.size} câu`}
        </button>
        {voice.generating && (
          <button type="button" className="rounded-md bg-neutral-800 px-4 py-2" onClick={() => studio.voice.cancel()}>
            Dừng
          </button>
        )}
      </div>
      {voice.progress && (
        <div className="flex flex-col gap-1 text-sm">
          <span>
            Đang tạo giọng {voice.progress.done}/{voice.progress.total}
          </span>
          <progress className="w-full" max={voice.progress.total} value={voice.progress.done} />
        </div>
      )}
      <ol className="flex flex-col gap-2">
        {project.scenes.map((scene, index) => {
          const narration = data.narrations.get(scene.id);
          const failed = voice.failed[scene.id];
          return (
            <li key={scene.id} className="flex items-start gap-3 rounded-lg border border-neutral-800 p-3 text-sm">
              <span className="w-6 shrink-0 text-neutral-500">{index + 1}</span>
              <span className="flex-1">{scene.text}</span>
              {failed ? (
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-red-400">{failed}</span>
                  <button
                    type="button"
                    disabled={voice.generating}
                    className="rounded-md bg-neutral-800 px-3 py-1 disabled:opacity-50"
                    onClick={() => void studio.voice.retry(scene.id)}
                  >
                    Thử lại
                  </button>
                </span>
              ) : stale.has(scene.id) ? (
                <span className="shrink-0 text-amber-400">{narration ? "Giọng cũ, cần tạo lại" : "Chưa có giọng"}</span>
              ) : (
                <span className="shrink-0 text-emerald-400">✓ {narration?.durationSec.toFixed(1)} giây</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
