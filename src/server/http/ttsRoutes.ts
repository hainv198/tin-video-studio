import { ValidationError } from "@/domain/errors";
import type { AuthController } from "@/server/auth/AuthController";
import type { TtsController } from "@/server/tts/TtsController";
import { withAuth } from "./withAuth";

export interface TtsRouteDeps {
  auth: AuthController;
  tts: TtsController;
}

export function makeVoicesGet(getDeps: () => TtsRouteDeps): (request: Request) => Promise<Response> {
  return withAuth(
    () => getDeps().auth,
    async () =>
      Response.json({ voices: await getDeps().tts.voices() }, { headers: { "Cache-Control": "no-store" } }),
  );
}

export function makeTtsPost(getDeps: () => TtsRouteDeps): (request: Request) => Promise<Response> {
  return withAuth(
    () => getDeps().auth,
    async (request) => {
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Yêu cầu tạo giọng không hợp lệ");
      });
      const result = await getDeps().tts.synthesize(body);
      return new Response(result.audio, {
        headers: { "Content-Type": result.mimeType, "Cache-Control": "no-store" },
      });
    },
  );
}
