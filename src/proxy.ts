import { NextResponse, type NextRequest } from "next/server";
import { SessionService } from "@/server/auth/SessionService";

const PUBLIC_PATHS = new Set(["/dang-nhap", "/api/auth/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const sessions = new SessionService(process.env.AUTH_SECRET ?? "");
  const user = await sessions.verify(request.cookies.get(SessionService.COOKIE)?.value);
  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { code: "AUTH", message: "Chưa đăng nhập" } }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/dang-nhap";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
