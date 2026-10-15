import { jwtVerify, SignJWT } from "jose";

export interface SessionUser {
  username: string;
  displayName: string;
}

export class SessionService {
  static readonly COOKIE = "tvs_session";

  private readonly key: Uint8Array;

  constructor(
    secret: string,
    readonly ttlSeconds = 60 * 60 * 24 * 7,
    private readonly now: () => number = () => Date.now(),
  ) {
    if (!secret || secret.length < 32) throw new Error("AUTH_SECRET phải dài ít nhất 32 ký tự");
    this.key = new TextEncoder().encode(secret);
  }

  async issue(user: SessionUser): Promise<string> {
    const iat = Math.floor(this.now() / 1000);
    return new SignJWT({ name: user.displayName })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.username)
      .setIssuedAt(iat)
      .setExpirationTime(iat + this.ttlSeconds)
      .sign(this.key);
  }

  async verify(token: string | undefined): Promise<SessionUser | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ["HS256"],
        currentDate: new Date(this.now()),
      });
      if (typeof payload.sub !== "string" || typeof payload.name !== "string") return null;
      return { username: payload.sub, displayName: payload.name };
    } catch {
      return null;
    }
  }
}
