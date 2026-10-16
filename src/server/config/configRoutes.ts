import { ValidationError } from "@/domain/errors";
import type { AuthController } from "@/server/auth/AuthController";
import { requireAdmin } from "@/server/auth/roles";
import { withAuth } from "@/server/http/withAuth";
import type { ConfigController } from "./ConfigController";

export interface ConfigRouteDeps {
  auth: AuthController;
  config: ConfigController;
}

export function makeConfigGet(getDeps: () => ConfigRouteDeps): (request: Request) => Promise<Response> {
  return withAuth(
    () => getDeps().auth,
    async (_request, user) => {
      requireAdmin(user);
      return Response.json(getDeps().config.snapshot(), { headers: { "Cache-Control": "no-store" } });
    },
  );
}

/** Chống CSRF cơ bản: bắt buộc JSON và Origin (nếu có) phải cùng host với yêu cầu. */
function assertSameSiteJson(request: Request): void {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    throw new ValidationError("Yêu cầu phải là application/json");
  }
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("host") ?? new URL(request.url).host;
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      /* origin hỏng: coi như khác host */
    }
    if (originHost !== host) throw new ValidationError("Yêu cầu bị từ chối: sai nguồn gốc (Origin)");
  }
}

export function makeConfigPost(getDeps: () => ConfigRouteDeps): (request: Request) => Promise<Response> {
  return withAuth(
    () => getDeps().auth,
    async (request, user) => {
      requireAdmin(user);
      assertSameSiteJson(request);
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Yêu cầu cấu hình không hợp lệ");
      });
      const result = await getDeps().config.update(body);
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    },
  );
}
