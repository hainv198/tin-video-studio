import type { AuthController, AuthenticatedUser } from "@/server/auth/AuthController";
import { SessionService } from "@/server/auth/SessionService";
import { readCookie } from "./cookies";
import { toErrorResponse } from "./errorResponse";

export function withAuth(
  getAuth: () => AuthController,
  handler: (request: Request, user: AuthenticatedUser) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const user = await getAuth().authenticate(readCookie(request, SessionService.COOKIE));
      return await handler(request, user);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
