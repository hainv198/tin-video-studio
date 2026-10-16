import { DomainError, type ErrorCode } from "@/domain/errors";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  AUTH: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  QUOTA: 429,
  UPSTREAM: 502,
};

export function toErrorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: STATUS[error.code] });
  }
  console.error(error);
  return Response.json({ error: { code: "INTERNAL", message: "Lỗi máy chủ" } }, { status: 500 });
}
