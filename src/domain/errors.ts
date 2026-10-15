export type ErrorCode = "VALIDATION" | "AUTH" | "NOT_FOUND" | "PAYLOAD_TOO_LARGE" | "QUOTA" | "UPSTREAM";

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "VALIDATION");
  }
}

export class AuthError extends DomainError {
  constructor(message = "Sai tên đăng nhập hoặc mật khẩu") {
    super(message, "AUTH");
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
  }
}

export class PayloadTooLargeError extends DomainError {
  constructor(message: string) {
    super(message, "PAYLOAD_TOO_LARGE");
  }
}

export class QuotaError extends DomainError {
  constructor(message: string) {
    super(message, "QUOTA");
  }
}

export class UpstreamError extends DomainError {
  constructor(message: string) {
    super(message, "UPSTREAM");
  }
}
