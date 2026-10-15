"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DevRenderController } from "@/client/controllers/DevRenderController";
import { AudioDecodeService } from "@/client/media/AudioDecodeService";
import { browserSupport } from "@/client/render/BrowserSupport";
import { RenderClient } from "@/client/render/RenderClient";
import { TtsClient, type VoiceInfo } from "@/client/services/TtsClient";

export function DevRenderPanel() {
  const tts = useMemo(() => new TtsClient(), []);
  const controller = useMemo(() => {
    const client = new RenderClient();
    const decoder = new AudioDecodeService();
    return new DevRenderController({
      support: () => browserSupport().check(),
      tts,
      decode: (bytes) => decoder.decode(bytes),
      fetchBytes: async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Không tải được nhạc nền");
        return response.arrayBuffer();
      },
      render: (job, onProgress) => client.render(job, onProgress),
      cancel: () => client.cancel(),
      createUrl: (blob) => URL.createObjectURL(blob),
      revokeUrl: (u) => URL.revokeObjectURL(u),
      // component client vẫn được render trên server một lần; window chỉ có ở trình duyệt
      origin: typeof window === "undefined" ? "" : window.location.origin,
    });
  }, [tts]);
  const state = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.state,
    () => controller.state,
  );
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [voice, setVoice] = useState("");
  const [voicesError, setVoicesError] = useState<string | null>(null);

  useEffect(() => {
    controller.checkSupport().catch(() => undefined);
    tts
      .voices()
      .then((list) => {
        setVoices(list);
        setVoice(list[0]?.name ?? "");
      })
      .catch((e) => setVoicesError(e instanceof Error ? e.message : "Không tải được danh sách giọng"));
  }, [controller, tts]);

  useEffect(() => () => controller.cancel(), [controller]);

  const busy = state.status === "working";
  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Dựng thử (tin Phú Thọ)</h1>
      {state.status === "unsupported" && (
        <p className="text-red-400">Hãy dùng Chrome hoặc Edge bản mới. Thiếu: {state.missing.join(", ")}</p>
      )}
      {voicesError && <p className="text-red-400">{voicesError}</p>}
      <label className="flex flex-col gap-1 text-sm">
        Giọng đọc
        <select className="rounded-md bg-neutral-800 px-3 py-2" value={voice} onChange={(e) => setVoice(e.target.value)}>
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} ({v.gender}, {v.tier})
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy || !voice || state.status === "unsupported"}
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-50"
          onClick={() => void controller.render(voice)}
        >
          Dựng video
        </button>
        {busy && (
          <button type="button" className="rounded-md bg-neutral-800 px-4 py-2" onClick={() => controller.cancel()}>
            Huỷ
          </button>
        )}
      </div>
      {state.status === "working" && (
        <div className="flex flex-col gap-1 text-sm">
          <span>{state.label}</span>
          <progress className="w-full" max={100} value={state.percent} />
        </div>
      )}
      {state.status === "error" && <p className="text-red-400">{state.message}</p>}
      {state.status === "done" && (
        <div className="flex flex-col gap-2">
          <video data-testid="ket-qua" className="w-full max-w-[360px] rounded-lg" src={state.url} controls playsInline />
          <p className="text-sm text-neutral-400">
            {state.durationSec.toFixed(1)} giây, {(state.sizeBytes / 1024 / 1024).toFixed(1)} MB
          </p>
          <a className="text-emerald-400 underline" href={state.url} download="dung-thu-phu-tho.mp4">
            Tải MP4
          </a>
        </div>
      )}
    </section>
  );
}
