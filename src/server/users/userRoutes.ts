import { ValidationError } from "@/domain/errors";
import type { AuthController } from "@/server/auth/AuthController";
import { requireAdmin } from "@/server/auth/roles";
import { assertSameSiteJson } from "@/server/config/configRoutes";
import { withAuth } from "@/server/http/withAuth";
import type { UserAdminController } from "./UserAdminController";

export interface UserRouteDeps {
  auth: AuthController;
  users: UserAdminController;
}

const NO_STORE = { "Cache-Control": "no-store" };

export function makeUsersGet(getDeps: () => UserRouteDeps): (request: Request) => Promise<Response> {
  return withAuth(
    () => getDeps().auth,
    async (_request, user) => {
      requireAdmin(user);
      return Response.json(getDeps().users.list(), { headers: NO_STORE });
    },
  );
}

/** Thân yêu cầu có mật khẩu: không bao giờ log, lỗi chỉ nêu luật chứ không nêu giá trị. */
export function makeUsersPost(getDeps: () => UserRouteDeps): (request: Request) => Promise<Response> {
  return withAuth(
    () => getDeps().auth,
    async (request, user) => {
      requireAdmin(user);
      assertSameSiteJson(request);
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Yêu cầu tài khoản không hợp lệ");
      });
      const result = await getDeps().users.perform(user.username, body);
      return Response.json(result, { headers: NO_STORE });
    },
  );
}
