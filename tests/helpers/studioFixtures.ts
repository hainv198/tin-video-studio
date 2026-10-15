import { MemoryKeyValueStore } from "@/client/storage/KeyValueStore";
import { UploadRepository } from "@/client/storage/UploadRepository";
import { StudioSession } from "@/client/controllers/StudioSession";
import type { DraftBody } from "@/client/storage/ProjectDraft";
import { Narration } from "@/domain/Narration";
import { NewsProject } from "@/domain/NewsProject";
import type { Scene } from "@/domain/Scene";
import { SentenceSplitter } from "@/domain/SentenceSplitter";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { sequentialIds, type IdGenerator } from "@/domain/ids";

/** Dự án giả: 1 cảnh mở đầu (s1) + `bodyCount` cảnh thân bài (s2…). */
export function makeProject(bodyCount = 3, ids: IdGenerator = sequentialIds("s")): NewsProject {
  const text = Array.from({ length: bodyCount }, (_, i) => `Câu thân bài số ${i + 1} của bản tin.`).join(" ");
  return NewsProject.fromText(
    { text, title: "Tiêu đề bản tin", sourceCredit: "Nguồn thử", publishDate: new Date(2026, 9, 14), templateId: "theanh28" },
    new SentenceSplitter(),
    ids,
  );
}

export const VOICE = VoiceSettings.create("vi-VN-Test", 1.07);

export function fakeNarration(scene: Scene, voice: VoiceSettings = VOICE, durationSec = 1.5): Narration {
  return Narration.create({
    sceneId: scene.id,
    text: scene.text,
    audio: new Uint8Array([1, 2, 3]),
    mimeType: "audio/mpeg",
    durationSec,
    voice,
  });
}

export function manualScheduler() {
  const tasks = new Map<number, () => void>();
  let n = 0;
  return {
    schedule: (fn: () => void, _ms: number) => {
      const id = ++n;
      tasks.set(id, fn);
      return () => {
        tasks.delete(id);
      };
    },
    runAll: () => {
      const all = [...tasks.values()];
      tasks.clear();
      for (const fn of all) fn();
    },
    pending: () => tasks.size,
  };
}

export function makeSession() {
  const saves: DraftBody[] = [];
  const sched = manualScheduler();
  const session = new StudioSession({
    drafts: {
      save: async (body) => {
        saves.push(body);
      },
      load: async () => null,
      clear: async () => {},
    },
    ids: sequentialIds("n"),
    schedule: sched.schedule,
  });
  return { session, saves, sched };
}

/** Session đã có dự án `bodyCount` cảnh thân bài và giọng mặc định. */
export function makeSessionWithProject(bodyCount = 3) {
  const made = makeSession();
  const project = makeProject(bodyCount);
  made.session.update((d) => ({ ...d, project, voice: VOICE }));
  return { ...made, project };
}

export function memoryUploads(prefix = "u") {
  const store = new MemoryKeyValueStore();
  return { store, uploads: new UploadRepository(store, sequentialIds(prefix)) };
}

export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
