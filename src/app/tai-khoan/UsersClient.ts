import { readApiError, readJson, networkSafeFetch } from "@/client/services/apiError";
import type { UserRole } from "@/server/auth/UserDirectory";
import type { UsersChangeResult } from "@/server/users/UserAdminController";
import type { NewUserInput, UsersApi } from "./UsersPanelController";

export class UsersClient implements UsersApi {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = (...args) => fetch(...args)) {
    this.fetchImpl = networkSafeFetch(fetchImpl);
  }

  add(input: NewUserInput): Promise<UsersChangeResult> {
    return this.post({ action: "add", ...input });
  }

  setPassword(username: string, password: string): Promise<UsersChangeResult> {
    return this.post({ action: "setPassword", username, password });
  }

  setRole(username: string, role: UserRole): Promise<UsersChangeResult> {
    return this.post({ action: "setRole", username, role });
  }

  remove(username: string): Promise<UsersChangeResult> {
    return this.post({ action: "remove", username });
  }

  private async post(body: unknown): Promise<UsersChangeResult> {
    const response = await this.fetchImpl("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await readApiError(response);
    return readJson<UsersChangeResult>(response);
  }
}
