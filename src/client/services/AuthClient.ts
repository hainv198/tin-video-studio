export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface AuthApi {
  login(username: string, password: string): Promise<{ username: string; displayName: string }>;
  logout(): Promise<void>;
}

async function readError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  return new ApiError(response.status, body?.error?.code ?? "INTERNAL", body?.error?.message ?? "Lỗi máy chủ");
}

export class AuthClient implements AuthApi {
  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async login(username: string, password: string): Promise<{ username: string; displayName: string }> {
    const response = await this.fetchImpl("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw await readError(response);
    const body = (await response.json()) as { user: { username: string; displayName: string } };
    return body.user;
  }

  async logout(): Promise<void> {
    const response = await this.fetchImpl("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw await readError(response);
  }
}
