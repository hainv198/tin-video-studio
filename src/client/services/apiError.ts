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

export async function readApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  return new ApiError(response.status, body?.error?.code ?? "INTERNAL", body?.error?.message ?? "Lỗi máy chủ");
}

export const NETWORK_MESSAGE = "Không kết nối được máy chủ, kiểm tra mạng rồi thử lại";
export const SESSION_EXPIRED_MESSAGE = "Hết phiên đăng nhập, hãy đăng nhập lại";

/** Phản hồi 200 nhưng bị proxy chuyển hướng sang trang đăng nhập: coi là hết phiên. */
export function assertSameSession(response: Response): void {
  if (response.redirected) throw new ApiError(401, "AUTH", SESSION_EXPIRED_MESSAGE);
}

export async function readJson<T>(response: Response): Promise<T> {
  assertSameSession(response);
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(502, "BAD_RESPONSE", "Máy chủ trả về dữ liệu không đọc được");
  }
}

/** Bọc fetch: lỗi mạng thành ApiError tiếng Việt; huỷ chủ động (AbortError) giữ nguyên. */
export function networkSafeFetch(base: typeof fetch): typeof fetch {
  const safe = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    try {
      return await base(...args);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new ApiError(0, "NETWORK", NETWORK_MESSAGE);
    }
  };
  return safe as typeof fetch;
}
