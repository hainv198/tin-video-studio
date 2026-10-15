import type { ClientServices } from "@/client/container";
import { defaultKeywordSuggester } from "@/client/services/KeywordSuggester";
import { randomIds, type IdGenerator } from "@/domain/ids";
import { BrandController } from "./BrandController";
import { FootageController } from "./FootageController";
import { FootageSearchController } from "./FootageSearchController";
import { MusicController } from "./MusicController";
import { ProjectController } from "./ProjectController";
import { RenderController } from "./RenderController";
import { RenderJobBuilder } from "./RenderJobBuilder";
import { StudioSession, type SessionDeps } from "./StudioSession";
import { VoiceController } from "./VoiceController";
import { WizardController } from "./WizardController";

export interface StudioOptions {
  onAuthLost?: () => void;
  schedule?: SessionDeps["schedule"];
  ids?: IdGenerator;
}

export interface Studio {
  services: ClientServices;
  session: StudioSession;
  wizard: WizardController;
  brand: BrandController;
  project: ProjectController;
  voice: VoiceController;
  footage: FootageController;
  search: FootageSearchController;
  music: MusicController;
  render: RenderController;
  dispose(): void;
}

const browserSchedule: SessionDeps["schedule"] = (fn, ms) => {
  const handle = setTimeout(fn, ms);
  return () => clearTimeout(handle);
};

/** Lắp session và mọi controller của trình 5 bước từ các dịch vụ client. */
export function createStudio(services: ClientServices, options: StudioOptions = {}): Studio {
  const ids = options.ids ?? randomIds();
  const onAuthLost = options.onAuthLost;
  const session = new StudioSession({
    drafts: services.drafts,
    ids,
    schedule: options.schedule ?? browserSchedule,
  });
  const builder = new RenderJobBuilder({
    templates: services.templates,
    uploads: services.uploads,
    tracks: services.tracks,
    decoder: services.decoder,
    origin: services.env.origin,
  });
  const keywordSources = new Map<string, ReturnType<typeof defaultKeywordSuggester>>();
  const keywords = (fallback: string) => {
    let source = keywordSources.get(fallback);
    if (!source) {
      source = defaultKeywordSuggester(fallback);
      keywordSources.set(fallback, source);
    }
    return source;
  };

  const search = new FootageSearchController({ session, stock: services.stock, keywords, templates: services.templates, ids, onAuthLost });
  const render = new RenderController({
    session,
    builder,
    render: (job, onProgress) => services.render.render(job, onProgress),
    cancelRender: () => services.render.cancel(),
    support: services.support,
    probeWorker: () => services.render.probe(),
    createUrl: (blob) => services.env.createUrl(blob),
    revokeUrl: (url) => services.env.revokeUrl(url),
    onAuthLost,
  });

  // Session chỉ báo khi dữ liệu dự án đổi; RenderController không ghi vào session nên không tự kích hoạt.
  session.subscribe(() => render.markStale());

  const footage = new FootageController({ session, uploads: services.uploads, probe: services.probe, ids, onAuthLost });
  const voice = new VoiceController({ session, tts: services.tts, decoder: services.decoder, onAuthLost });
  const music = new MusicController({
    session,
    library: services.music,
    uploads: services.uploads,
    tracks: services.tracks,
    probe: services.probe,
    onAuthLost,
  });
  const wizard = new WizardController({
    session,
    drafts: services.drafts,
    uploads: services.uploads,
    liveUploadIds: () => footage.uploadIds(),
    deferCleanup: () => footage.ingesting,
    onReset: () => {
      footage.reset();
      search.reset();
      voice.reset();
      music.reset();
      render.reset();
    },
    onAuthLost,
  });

  return {
    services,
    session,
    wizard,
    brand: new BrandController({ session, templates: services.templates, brands: services.brands, onAuthLost }),
    project: new ProjectController({ session, ids, onAuthLost }),
    voice,
    footage,
    search,
    music,
    render,
    dispose() {
      render.dispose();
      search.cancel();
      void session.flush();
    },
  };
}
