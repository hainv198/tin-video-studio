import { serverContainer } from "@/server/container";
import { localUserAdminController } from "@/server/users/localUserAdmin";
import { makeUsersGet, makeUsersPost } from "@/server/users/userRoutes";

const deps = () => ({ auth: serverContainer().auth, users: localUserAdminController() });

export const GET = makeUsersGet(deps);
export const POST = makeUsersPost(deps);
