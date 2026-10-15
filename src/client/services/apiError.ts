import { ApiError } from "./AuthClient";

export async function readApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  return new ApiError(response.status, body?.error?.code ?? "INTERNAL", body?.error?.message ?? "Lỗi máy chủ");
}
