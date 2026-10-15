import { AudioDecodeService } from "@/client/media/AudioDecodeService";
import { BrowserMediaProbe, type MediaProbe } from "@/client/media/MediaProbe";
import { browserSupport, type SupportReport } from "@/client/render/BrowserSupport";
import { RenderClient } from "@/client/render/RenderClient";
import { defaultKeywordSuggester, type KeywordSuggester } from "@/client/services/KeywordSuggester";
import { MusicLibrary } from "@/client/services/MusicLibrary";
import { StockClient, type StockApi } from "@/client/services/StockClient";
import { TtsClient, type TtsApi } from "@/client/services/TtsClient";
import { BrandRepository } from "@/client/storage/BrandRepository";
import { DraftRepository } from "@/client/storage/DraftRepository";
import { IdbKeyValueStore } from "@/client/storage/IdbKeyValueStore";
import { UploadRepository } from "@/client/storage/UploadRepository";
import { defaultTemplateRegistry } from "@/templates/registry";
import type { TemplateRegistry } from "@/templates/TemplateRegistry";

export interface ClientEnv {
  fetch: typeof fetch;
  indexedDB: IDBFactory;
  origin: string;
  createUrl(blob: Blob): string;
  revokeUrl(url: string): void;
}

export interface ClientServices {
  env: ClientEnv;
  templates: TemplateRegistry;
  tts: TtsApi;
  stock: StockApi;
  keywords: KeywordSuggester;
  music: MusicLibrary;
  drafts: DraftRepository;
  brands: BrandRepository;
  uploads: UploadRepository;
  decoder: AudioDecodeService;
  probe: MediaProbe;
  render: RenderClient;
  support: () => Promise<SupportReport>;
}

/** Lắp mọi dịch vụ phía client ở một chỗ. Không chạm API trình duyệt cho tới khi dịch vụ được dùng. */
export function createClientServices(env: ClientEnv): ClientServices {
  const store = new IdbKeyValueStore(env.indexedDB);
  const decoder = new AudioDecodeService();
  return {
    env,
    templates: defaultTemplateRegistry(),
    tts: new TtsClient(env.fetch),
    stock: new StockClient(env.fetch),
    keywords: defaultKeywordSuggester(),
    music: new MusicLibrary(env.fetch),
    drafts: new DraftRepository(store),
    brands: new BrandRepository(store),
    uploads: new UploadRepository(store),
    decoder,
    probe: new BrowserMediaProbe(decoder),
    render: new RenderClient(),
    support: () => browserSupport().check(),
  };
}

/** Môi trường thật của trình duyệt. Chỉ gọi ở phía client (dùng window). */
export function browserEnv(): ClientEnv {
  return {
    fetch: (...args) => fetch(...args),
    indexedDB: window.indexedDB,
    origin: window.location.origin,
    createUrl: (blob) => URL.createObjectURL(blob),
    revokeUrl: (url) => URL.revokeObjectURL(url),
  };
}
