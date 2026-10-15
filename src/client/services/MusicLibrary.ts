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
  ) {}

  async list(): Promise<MusicTrack[]> {
    if (this.cached) return this.cached;
    const response = await this.fetchImpl(this.url);
    assertSameSession(response);
    if (!response.ok) throw new Error("Không tải được kho nhạc");
    const parsed = ManifestSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new Error("Kho nhạc sai định dạng");
    this.cached = parsed.data.map((m) => MusicTrack.create({ id: m.id, title: m.title, origin: "library", uri: m.file }));
    return this.cached;
  }
}
