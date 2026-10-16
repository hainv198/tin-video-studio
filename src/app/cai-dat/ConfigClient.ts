import { readApiError, readJson, networkSafeFetch } from "@/client/services/apiError";
import type { ConfigUpdateResult } from "@/server/config/ConfigController";
import type { ConfigApi } from "./ConfigPanelController";

export class ConfigClient implements ConfigApi {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = (...args) => fetch(...args)) {
    this.fetchImpl = networkSafeFetch(fetchImpl);
  }

  save(key: string, value: string): Promise<ConfigUpdateResult> {
    return this.post({ set: { [key]: value } });
  }

  clear(key: string): Promise<ConfigUpdateResult> {
    return this.post({ clear: [key] });
  }

  private async post(body: unknown): Promise<ConfigUpdateResult> {
    const response = await this.fetchImpl("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await readApiError(response);
    return readJson<ConfigUpdateResult>(response);
  }
}
