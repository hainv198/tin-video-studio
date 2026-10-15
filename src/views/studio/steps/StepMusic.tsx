"use client";

import { useEffect, useRef, useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
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
      <ul className="flex flex-col gap-2">
        <li className="flex items-center gap-3 rounded-lg border border-neutral-800 p-3 text-sm">
          <label className="flex flex-1 items-center gap-2">
            <input type="radio" name="music" checked={selected === null} onChange={() => studio.music.none()} />
            Không dùng nhạc
          </label>
        </li>
        {tracks.map((track) => (
          <li key={track.id} className="flex items-center gap-3 rounded-lg border border-neutral-800 p-3 text-sm">
            <label className="flex flex-1 items-center gap-2">
              <input type="radio" name="music" checked={selected?.id === track.id} onChange={() => studio.music.choose(track)} />
              {track.title}
              {track.origin === "upload" && <span className="text-xs text-neutral-500">(của bạn)</span>}
            </label>
            <button type="button" className="rounded-md bg-neutral-800 px-3 py-1" onClick={() => void toggle(track.id)}>
              {playingId === track.id ? "Dừng" : "Nghe thử"}
            </button>
          </li>
        ))}
      </ul>
      <label className="w-fit cursor-pointer rounded-md bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
        {music.busy ? "Đang xử lý…" : "Tải nhạc của bạn lên (MP3, WAV, M4A)"}
        <input
          type="file"
          accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void studio.music.uploadTrack(file);
            e.target.value = "";
          }}
        />
      </label>
      {selected && (
        <label className="flex flex-col gap-1 text-sm">
          Âm lượng nhạc: thấp hơn giọng {selected.levelBelowVoiceDb} dB (mặc định 15 dB)
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
