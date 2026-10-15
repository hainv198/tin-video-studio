import { ValidationError } from "@/domain/errors";
import type { AuthController } from "@/server/auth/AuthController";
import { SessionService } from "@/server/auth/SessionService";
import { clearedSessionCookie, sessionCookie } from "./cookies";
import { toErrorResponse } from "./errorResponse";

export interface AuthRouteDeps {
  auth: AuthController;
  sessions: SessionService;
  secureCookies: boolean;
}

export function makeLoginPost(getDeps: () => AuthRouteDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const deps = getDeps();
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Dữ liệu đăng nhập không hợp lệ");
      });
      const { token, user } = await deps.auth.login(body);
      const response = Response.json({ user });
      response.headers.append(
        "Set-Cookie",
        sessionCookie(SessionService.COOKIE, token, deps.sessions.ttlSeconds, deps.secureCookies),
      );
      return response;
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function makeLogoutPost(getDeps: () => AuthRouteDeps): (request: Request) => Promise<Response> {
  return async () => {
    const response = Response.json({ ok: true });
    response.headers.append("Set-Cookie", clearedSessionCookie(SessionService.COOKIE, getDeps().secureCookies));
    return response;
  };
}
