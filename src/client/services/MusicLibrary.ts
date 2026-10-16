import { z } from "zod";
import { MusicTrack } from "@/domain/MusicTrack";
import { assertSameSession } from "./apiError";

const ManifestSchema = z.array(
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    file: z.string().startsWith("/"),
    note: z.string().optional(),
  }),
);

export class MusicLibrary {
  private cached: MusicTrack[] | null = null;

  constructor(
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly url = "/music/manifest.json",
    /** Kho nhạc riêng trên máy (không đưa vào git/deploy). Không có file này là bình thường. */
    private readonly localUrl = "/music/local/manifest.json",
  ) {}

  async list(): Promise<MusicTrack[]> {
    if (this.cached) return this.cached;
    const main = await this.read(this.url, true);
    const local = await this.read(this.localUrl, false);
    const seen = new Set(main.map((m) => m.id));
    const entries = [...main, ...local.filter((m) => !seen.has(m.id))];
    this.cached = entries.map((m) => MusicTrack.create({ id: m.id, title: m.title, origin: "library", uri: m.file }));
    return this.cached;
  }

  private async read(url: string, required: boolean): Promise<z.infer<typeof ManifestSchema>> {
    try {
      const response = await this.fetchImpl(url);
      assertSameSession(response);
      if (!response.ok) throw new Error("Không tải được kho nhạc");
      const parsed = ManifestSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) throw new Error("Kho nhạc sai định dạng");
      return parsed.data;
    } catch (error) {
      if (required) throw error;
      return [];
    }
  }
}
