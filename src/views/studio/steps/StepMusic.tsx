"use client";

import { useEffect, useRef, useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { MusicTrack } from "@/domain/MusicTrack";
import { useController } from "@/views/hooks/useController";

export function StepMusic({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const music = useController(studio.music);
  const playing = useRef<{ audio: HTMLAudioElement; url: string; trackId: string } | null>(null);
  const seq = useRef(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    void studio.music.loadLibrary();
  }, [studio]);

  function stop() {
    seq.current++;
    if (!playing.current) return;
    playing.current.audio.pause();
    studio.services.env.revokeUrl(playing.current.url);
    playing.current = null;
    setPlayingId(null);
  }
  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  });

  useEffect(() => () => stopRef.current(), []);

  const selected = data.music;
  const known = [...music.library, ...music.uploaded];
  // Bản nháp khôi phục có thể chọn nhạc của người dùng không còn trong danh sách: vẫn hiện để biết đang chọn gì.
  const orphan = selected && selected.origin === "upload" && !known.some((t) => t.id === selected.id) ? selected : null;
  const tracks = orphan ? [...known, orphan] : known;

  async function toggle(trackId: string) {
    const wasPlaying = playing.current?.trackId === trackId;
    stop();
    if (wasPlaying) return;
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const req = ++seq.current;
    const blob = await studio.music.previewBlob(track);
    if (!blob || req !== seq.current) return;
    const url = studio.services.env.createUrl(blob);
    const audio = new Audio(url);
    // Handler của bản nghe thử cũ không được dừng bản mới hơn: chỉ hành động nếu audio này vẫn là bản đang phát.
    const stopIfCurrent = () => {
      if (playing.current?.audio === audio) stop();
    };
    audio.onended = stopIfCurrent;
    audio.onerror = stopIfCurrent;
    playing.current = { audio, url, trackId };
    setPlayingId(trackId);
    audio.play().catch(stopIfCurrent);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Nhạc nền</h2>
      {music.loading && <p className="text-sm text-neutral-400">Đang tải kho nhạc…</p>}
      {music.error && (
        <p role="alert" className="text-red-400">
          {music.error}
        </p>
      )}
      <p className="text-sm text-neutral-400">Bấm vào ô để nghe thử (bấm lần nữa để dừng), tick “Chọn” để dùng bài đó.</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <li>
          <label
            className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center text-xs focus-within:ring-2 focus-within:ring-emerald-500 ${
              selected === null ? "border-emerald-500 bg-emerald-950/40" : "border-neutral-800 hover:bg-neutral-900"
            }`}
          >
            <span aria-hidden className="text-2xl">
              🔇
            </span>
            <input type="radio" name="music" className="sr-only" checked={selected === null} onChange={() => studio.music.none()} />
            <span>Không dùng nhạc</span>
            {selected === null && <span className="text-xs text-emerald-400">✓ Đang chọn</span>}
          </label>
        </li>
        {tracks.map((track) => {
          const isSelected = selected?.id === track.id;
          const isPlaying = playingId === track.id;
          return (
            <li
              key={track.id}
              className={`flex aspect-square flex-col overflow-hidden rounded-lg border ${
                isSelected ? "border-emerald-500 ring-1 ring-emerald-500" : "border-neutral-800"
              }`}
            >
              <button
                type="button"
                aria-label={`${isPlaying ? "Dừng" : "Nghe thử"}: ${track.title}`}
                aria-pressed={isPlaying}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 p-1.5 text-center hover:bg-neutral-900 focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  isPlaying ? "bg-emerald-950/40" : ""
                }`}
                onClick={() => void toggle(track.id)}
              >
                <span aria-hidden className="text-2xl">
                  {isPlaying ? "⏸" : "▶"}
                </span>
                <span className="line-clamp-3 text-xs leading-tight">{track.title}</span>
                {track.origin === "upload" && <span className="text-xs text-neutral-500">(của bạn)</span>}
              </button>
              <label
                className={`flex cursor-pointer items-center justify-center gap-2 border-t px-1 py-1 text-[11px] focus-within:ring-2 focus-within:ring-emerald-500 ${
                  isSelected ? "border-emerald-500 bg-emerald-900/50 text-emerald-200" : "border-neutral-800 bg-neutral-900"
                }`}
              >
                <input
                  type="radio"
                  name="music"
                  aria-label={track.title}
                  checked={isSelected}
                  onChange={() => studio.music.choose(track)}
                />
                {isSelected ? "✓ Đang chọn" : "Chọn"}
              </label>
            </li>
          );
        })}
      </ul>
      <label className="w-fit cursor-pointer rounded-md bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700 focus-within:ring-2 focus-within:ring-emerald-500">
        {music.busy ? "Đang xử lý…" : "Tải nhạc của bạn lên (MP3, WAV, M4A)"}
        <input
          type="file"
          accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
          className="sr-only"
          disabled={music.busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void studio.music.uploadTrack(file);
            e.target.value = "";
          }}
        />
      </label>
      {selected && (
        <label className="flex flex-col gap-1 text-sm">
          Âm lượng nhạc: thấp hơn giọng {selected.levelBelowVoiceDb} dB (mặc định {MusicTrack.BELOW_VOICE_DB} dB)
          <input
            type="range"
            min={-6}
            max={6}
            step={1}
            value={selected.gainOffsetDb}
            onChange={(e) => studio.music.setGainOffset(Number(e.target.value))}
          />
        </label>
      )}
    </div>
  );
}
