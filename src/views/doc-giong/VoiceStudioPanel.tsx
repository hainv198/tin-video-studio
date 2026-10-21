"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientEnv } from "@/client/container";
import {
  MAX_TEXT_CHARS,
  OUTDATED_NOTICE,
  PAUSE_RANGE,
  type AudioFormat,
  type VoiceStudioController,
} from "@/client/controllers/VoiceStudioController";
import type { VoiceInfo } from "@/client/services/TtsClient";
import { PITCH_SEMITONES_RANGE, TEMPO_RANGE } from "@/domain/VideoOptions";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { useController } from "@/views/hooks/useController";

const BUTTON = "min-h-11 sm:min-h-0 rounded-md px-4 py-2 disabled:opacity-50";
const vi = (n: number, digits = 2) => n.toFixed(digits).replace(".", ",");

function groupByTier(voices: VoiceInfo[]): [string, VoiceInfo[]][] {
  const groups = new Map<string, VoiceInfo[]>();
  for (const v of voices) groups.set(v.tier, [...(groups.get(v.tier) ?? []), v]);
  return [...groups.entries()];
}

/** View mỏng của trang Tạo giọng: mọi logic nằm ở VoiceStudioController. */
export function VoiceStudioPanel({ controller, env }: { controller: VoiceStudioController; env: ClientEnv }) {
  const s = useController(controller);
  const [preview, setPreview] = useState<{ url: string; key: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) env.revokeUrl(urlRef.current);
    },
    [env],
  );

  // Bản nghe thử cũ không còn đúng khi đổi tinh chỉnh, khoảng nghỉ hay nội dung: ẩn đi.
  const settingsKey = `${s.ready}|${s.voiceName}|${s.speakingRate}|${s.tweak.tempo}|${s.tweak.pitchSemitones}|${s.pauseSec}|${s.text}`;
  const previewUrl = preview?.key === settingsKey ? preview.url : null;

  async function playPreview() {
    const file = await controller.exportAudio("wav");
    if (!file) return;
    if (urlRef.current) env.revokeUrl(urlRef.current);
    const url = env.createUrl(file.blob);
    urlRef.current = url;
    setPreview({ url, key: settingsKey });
    requestAnimationFrame(() => void audioRef.current?.play().catch(() => {}));
  }

  async function download(format: AudioFormat) {
    const file = await controller.exportAudio(format);
    if (!file) return;
    const url = env.createUrl(file.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => env.revokeUrl(url), 60_000);
  }

  const over = s.charCount > MAX_TEXT_CHARS;
  const failed = s.chunks.filter((c) => c.status === "failed").length;
  const done = s.chunks.filter((c) => c.status === "done").length;
  const tweaked = s.tweak.tempo !== TEMPO_RANGE.default || s.tweak.pitchSemitones !== PITCH_SEMITONES_RANGE.default;
  const pitchText = `${s.tweak.pitchSemitones > 0 ? "+" : s.tweak.pitchSemitones < 0 ? "−" : ""}${String(Math.abs(s.tweak.pitchSemitones)).replace(".", ",")}`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Nội dung cần đọc
        <textarea
          className="min-h-48 w-full rounded-md bg-neutral-800 px-3 py-2 sm:min-h-64"
          value={s.text}
          placeholder="Dán hoặc gõ nội dung cần đọc…"
          onChange={(e) => controller.setText(e.target.value)}
        />
      </label>
      <div className="flex flex-col gap-1 text-sm">
        <span className={over ? "font-medium text-red-400" : "text-neutral-300"} data-testid="dem-ky-tu">
          Đã dùng {s.charCount.toLocaleString("vi-VN")}/{MAX_TEXT_CHARS.toLocaleString("vi-VN")} ký tự
          {over ? " — vượt giới hạn, hãy rút gọn" : ""}
        </span>
        <span className="text-xs text-amber-300">
          Mỗi lần Tạo giọng tốn hạn mức giọng đọc dùng chung của cả nhóm (tính theo số ký tự gửi đi). Mẩu không đổi được dùng lại, không tốn thêm.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          Giọng
          <select
            className="w-full min-w-0 rounded-md bg-neutral-800 px-3 py-2"
            value={s.voiceName ?? ""}
            onChange={(e) => controller.selectVoice(e.target.value)}
          >
            {groupByTier(s.voices).map(([tier, list]) => (
              <optgroup key={tier} label={tier}>
                {list.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.gender})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tốc độ lúc tạo giọng (đổi phải tạo lại): {s.speakingRate.toFixed(2)}
          <input
            type="range"
            min={VoiceSettings.MIN_RATE}
            max={VoiceSettings.MAX_RATE}
            step={0.01}
            value={s.speakingRate}
            onChange={(e) => controller.setRate(Number(e.target.value))}
          />
        </label>
      </div>
      {s.voicesLoading && <p className="text-sm text-neutral-400">Đang tải danh sách giọng…</p>}

      <fieldset className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-3 text-sm">
        <legend className="px-1 font-medium">Tinh chỉnh sau khi tạo giọng (không cần tạo lại)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            Tốc độ: ×{vi(s.tweak.tempo)}
            <input
              type="range"
              min={TEMPO_RANGE.min}
              max={TEMPO_RANGE.max}
              step={TEMPO_RANGE.step}
              value={s.tweak.tempo}
              onChange={(e) => controller.setTempo(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1">
            Tông: {pitchText} nửa cung
            <input
              type="range"
              min={PITCH_SEMITONES_RANGE.min}
              max={PITCH_SEMITONES_RANGE.max}
              step={PITCH_SEMITONES_RANGE.step}
              value={s.tweak.pitchSemitones}
              onChange={(e) => controller.setPitch(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1">
            Khoảng nghỉ giữa các đoạn: {vi(s.pauseSec)} giây
            <input
              type="range"
              min={PAUSE_RANGE.min}
              max={PAUSE_RANGE.max}
              step={PAUSE_RANGE.step}
              value={s.pauseSec}
              onChange={(e) => controller.setPause(Number(e.target.value))}
            />
          </label>
        </div>
        <div>
          <button type="button" disabled={!tweaked} className={`${BUTTON} bg-neutral-800`} onClick={() => controller.resetTweak()}>
            Về mặc định
          </button>
        </div>
      </fieldset>

      {s.error && (
        <p role="alert" className="text-sm text-red-400">
          {s.error}
        </p>
      )}
      {s.notice && (
        <p role="status" className="text-sm text-neutral-400">
          {s.notice}
        </p>
      )}
      {s.outdated && (
        <p role="status" className="rounded-md bg-amber-950 px-3 py-2 text-sm text-amber-300">
          {OUTDATED_NOTICE}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={s.generating || over || !s.text.trim() || !s.voiceName}
          className={`${BUTTON} bg-emerald-600 font-medium`}
          onClick={() => void controller.generate()}
        >
          Tạo giọng
        </button>
        {s.generating && (
          <button type="button" className={`${BUTTON} bg-neutral-800`} onClick={() => controller.cancel()}>
            Dừng
          </button>
        )}
      </div>
      {s.progress && (
        <div className="flex flex-col gap-1 text-sm">
          <span>
            Đang tạo giọng mẩu {s.progress.done}/{s.progress.total}
          </span>
          <progress className="w-full" max={Math.max(1, s.progress.total)} value={s.progress.done} />
        </div>
      )}

      {s.chunks.length > 0 && (
        <details className="rounded-lg border border-neutral-800 p-3 text-sm" open={failed > 0}>
          <summary className="flex min-h-11 sm:min-h-0 cursor-pointer items-center">
            {s.chunks.length} mẩu · xong {done}
            {failed ? ` · lỗi ${failed}` : ""}
          </summary>
          <ol className="mt-2 flex flex-col gap-2">
            {s.chunks.map((chunk, index) => (
              <li key={index} className="flex min-w-0 items-start gap-3 rounded-md border border-neutral-800 p-2">
                <span className="w-6 shrink-0 text-neutral-500">{index + 1}</span>
                <span className="min-w-0 flex-1 break-words">{chunk.text}</span>
                {chunk.status === "failed" ? (
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-red-400">{chunk.error}</span>
                    <button
                      type="button"
                      disabled={s.generating}
                      className={`${BUTTON} bg-neutral-800`}
                      onClick={() => void controller.retry(index)}
                    >
                      Thử lại mẩu này
                    </button>
                  </span>
                ) : chunk.status === "done" ? (
                  <span className="shrink-0 text-emerald-400">✓</span>
                ) : chunk.status === "working" ? (
                  <span className="shrink-0 text-neutral-400">Đang tạo…</span>
                ) : (
                  <span className="shrink-0 text-neutral-500">Chưa tạo</span>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}

      {s.ready && (
        <section aria-label="Kết quả giọng đọc" className="flex flex-col gap-3 rounded-lg border border-emerald-800 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={s.exporting} className={`${BUTTON} bg-neutral-800`} onClick={() => void playPreview()}>
              Nghe thử
            </button>
            <button type="button" disabled={s.exporting} className={`${BUTTON} bg-emerald-600 font-medium`} onClick={() => void download("wav")}>
              Tải WAV
            </button>
            {s.m4aSupported && (
              <button type="button" disabled={s.exporting} className={`${BUTTON} bg-neutral-800`} onClick={() => void download("m4a")}>
                Tải M4A
              </button>
            )}
            {s.exporting && <span className="text-neutral-400">Đang xử lý…</span>}
          </div>
          {previewUrl && <audio ref={audioRef} controls src={previewUrl} className="w-full" aria-label="Nghe thử giọng đọc" />}
          <span className="text-xs text-neutral-500">
            WAV: 16-bit, mono, 48 kHz (không nén, nặng hơn).{s.m4aSupported ? " M4A: AAC nén, nhẹ hơn." : ""}
          </span>
        </section>
      )}
    </div>
  );
}
