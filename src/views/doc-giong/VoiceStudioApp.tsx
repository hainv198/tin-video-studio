"use client";

import { useEffect, useSyncExternalStore } from "react";
import { browserEnv, type ClientEnv } from "@/client/container";
import { VoiceStudioController } from "@/client/controllers/VoiceStudioController";
import { AacAudioExporter } from "@/client/media/AacAudioExporter";
import { AudioDecodeService } from "@/client/media/AudioDecodeService";
import { SpeechAssembler } from "@/client/media/SpeechAssembler";
import { TtsClient } from "@/client/services/TtsClient";
import { VoiceStudioPanel } from "./VoiceStudioPanel";

let instance: { controller: VoiceStudioController; env: ClientEnv } | null = null;

/** Một controller cho cả phiên trình duyệt: quay lại trang vẫn còn văn bản và giọng đã tạo. */
function getInstance() {
  if (!instance) {
    const env = browserEnv();
    const controller = new VoiceStudioController({
      tts: new TtsClient(env.fetch),
      decoder: new AudioDecodeService(),
      assembler: new SpeechAssembler(),
      exporter: new AacAudioExporter(),
      onAuthLost: () => {
        window.location.replace(`/dang-nhap?next=${encodeURIComponent("/doc-giong")}`);
      },
    });
    instance = { controller, env };
  }
  return instance;
}

const noopSubscribe = () => () => {};

export function VoiceStudioApp() {
  const app = useSyncExternalStore(noopSubscribe, getInstance, () => null);

  useEffect(() => {
    if (!app) return;
    void app.controller.loadVoices();
    void app.controller.checkM4a();
    return () => app.controller.cancel();
  }, [app]);

  if (!app) return <p className="mt-8 text-neutral-400">Đang tải…</p>;
  return <VoiceStudioPanel controller={app.controller} env={app.env} />;
}
