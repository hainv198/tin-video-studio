import { describe, expect, it } from "vitest";
import { makeTtsPost, makeVoicesGet } from "@/server/http/ttsRoutes";
import { TtsController } from "@/server/tts/TtsController";
import { FakeTtsProvider } from "@/server/tts/FakeTtsProvider";
import { makeTestAuth } from "../helpers";

async function setup() {
  const t = await makeTestAuth();
  const deps = () => ({ auth: t.auth, tts: new TtsController(new FakeTtsProvider()) });
  return { ...t, deps };
}

describe("GET /api/tts/voices", () => {
  it("cần đăng nhập", async () => {
    const { deps } = await setup();
    expect((await makeVoicesGet(deps)(new Request("http://localhost/api/tts/voices"))).status).toBe(401);
  });

  it("trả danh sách giọng", async () => {
    const { deps, cookieFor } = await setup();
    const res = await makeVoicesGet(deps)(
      new Request("http://localhost/api/tts/voices", { headers: { cookie: await cookieFor("hai") } }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).voices).toHaveLength(2);
  });

  it("không cho trình duyệt cache danh sách giọng (đổi cấu hình phải thấy ngay)", async () => {
    const { deps, cookieFor } = await setup();
    const res = await makeVoicesGet(deps)(
      new Request("http://localhost/api/tts/voices", { headers: { cookie: await cookieFor("hai") } }),
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/tts", () => {
  it("trả âm thanh nhị phân đúng content-type", async () => {
    const { deps, cookieFor } = await setup();
    const res = await makeTtsPost(deps)(
      new Request("http://localhost/api/tts", {
        method: "POST",
        headers: { cookie: await cookieFor("hai"), "content-type": "application/json" },
        body: JSON.stringify({ text: "Xin chào.", voiceName: "vi-VN-Fake-A", speakingRate: 1 }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(44);
  });

  it("text quá dài: 413", async () => {
    const { deps, cookieFor } = await setup();
    const res = await makeTtsPost(deps)(
      new Request("http://localhost/api/tts", {
        method: "POST",
        headers: { cookie: await cookieFor("hai") },
        body: JSON.stringify({ text: "a".repeat(5001), voiceName: "vi-VN-Fake-A", speakingRate: 1 }),
      }),
    );
    expect(res.status).toBe(413);
  });
});
