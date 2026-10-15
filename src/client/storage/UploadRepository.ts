import { randomIds, type IdGenerator } from "@/domain/ids";
import type { UploadKind } from "@/domain/UploadKind";
import type { KeyValueStore } from "./KeyValueStore";

const PREFIX = "blob:";

export interface UploadMeta {
  id: string;
  name: string;
  kind: UploadKind;
  size: number;
  addedAt: string;
}

export interface StoredUpload extends UploadMeta {
  blob: Blob;
}

export class UploadRepository {
  constructor(
    private readonly store: KeyValueStore,
    private readonly nextId: IdGenerator = randomIds(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async put(blob: Blob, info: { name: string; kind: UploadKind }): Promise<UploadMeta> {
    const meta: UploadMeta = {
      id: `upload-${this.nextId()}`,
      name: info.name,
      kind: info.kind,
      size: blob.size,
      addedAt: this.now().toISOString(),
    };
    const stored: StoredUpload = { ...meta, blob };
    await this.store.set(`${PREFIX}${meta.id}`, stored);
    return meta;
  }

  async get(id: string): Promise<StoredUpload | null> {
    return (await this.store.get<StoredUpload>(`${PREFIX}${id}`)) ?? null;
  }

  async delete(id: string): Promise<void> {
    await this.store.delete(`${PREFIX}${id}`);
  }

  async list(): Promise<UploadMeta[]> {
    const metas: UploadMeta[] = [];
    for (const key of await this.store.keys(PREFIX)) {
      const stored = await this.store.get<StoredUpload>(key);
      if (stored) metas.push({ id: stored.id, name: stored.name, kind: stored.kind, size: stored.size, addedAt: stored.addedAt });
    }
    return metas.sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id));
  }

  async totalBytes(): Promise<number> {
    return (await this.list()).reduce((sum, m) => sum + m.size, 0);
  }
}
