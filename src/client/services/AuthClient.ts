import { ApiError, readApiError } from "./apiError";

export { ApiError };

export interface AuthApi {
  login(username: string, password: string): Promise<{ username: string; displayName: string }>;
  logout(): Promise<void>;
}

export class AuthClient implements AuthApi {
  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async login(username: string, password: string): Promise<{ username: string; displayName: string }> {
    const response = await this.fetchImpl("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw await readApiError(response);
    const body = (await response.json()) as { user: { username: string; displayName: string } };
    return body.user;
  }

  async logout(): Promise<void> {
    const response = await this.fetchImpl("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw await readApiError(response);
  }
}
