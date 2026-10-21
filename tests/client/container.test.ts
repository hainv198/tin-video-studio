import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { createClientServices, type ClientEnv } from "@/client/container";
import { RENDER_SAMPLE_RATE } from "@/client/media/AudioDecodeService";

function fakeEnv(routes: Record<string, unknown> = {}): ClientEnv {
  return {
    fetch: vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const key = Object.keys(routes).find((k) => url.startsWith(k));
      return key ? Response.json(routes[key]) : new Response("", { status: 404 });
    }) as unknown as typeof fetch,
    indexedDB: new IDBFactory() as unknown as IDBFactory,
    origin: "http://localhost:3100",
    createUrl: () => "blob:fake",
    revokeUrl: () => {},
  };
}

describe("RENDER_SAMPLE_RATE", () => {
  it("là 48000, khớp tần số mẫu của bộ trộn và bộ giải mã", () => {
    expect(RENDER_SAMPLE_RATE).toBe(48000);
  });
});

describe("createClientServices", () => {
  it("lắp đủ dịch vụ, phong cách theanh28 có trong registry", () => {
    const s = createClientServices(fakeEnv());
    const templates = s.templates.list();
    expect(templates[0]).toEqual({ id: "theanh28", name: "Bản tin kiểu Theanh28" }); // phong cách cũ vẫn đứng đầu (mặc định)
    expect(templates.map((x) => x.id)).toContain("theanh28-banner");
    expect(typeof s.support).toBe("function");
    expect(s.env.origin).toBe("http://localhost:3100");
  });

  it("các dịch vụ gọi API dùng đúng hàm fetch của môi trường", async () => {
    const env = fakeEnv({
      "/api/tts/voices": { voices: [{ name: "vi-VN-HoaiMyNeural", gender: "FEMALE", tier: "Edge" }] },
      "/api/stock/search": { items: [], warnings: [] },
      "/music/manifest.json": [{ id: "m", title: "M", file: "/music/m.mp3" }],
    });
    const s = createClientServices(env);
    expect((await s.tts.voices())[0]?.name).toBe("vi-VN-HoaiMyNeural");
    expect(await s.stock.search("police", "image")).toEqual({ items: [], warnings: [] });
    expect((await s.music.list()).map((t) => t.id)).toEqual(["m"]);
  });

  it("các repository dùng chung một kho IndexedDB nhưng không lẫn khoá", async () => {
    const s = createClientServices(fakeEnv());
    expect(await s.drafts.load()).toBeNull();
    await s.brands.save("theanh28", { channelName: "2NV" }, null);
    const meta = await s.uploads.put(new Blob(["x"]), { name: "x.png", kind: "image" });
    expect((await s.brands.load("theanh28"))?.values).toEqual({ channelName: "2NV" });
    expect((await s.uploads.get(meta.id))?.name).toBe("x.png");
    expect(await s.drafts.load()).toBeNull();
    expect((await s.uploads.list()).map((m) => m.id)).toEqual([meta.id]);
  });

  it("đoán từ khoá bằng từ điển thật", () => {
    const s = createClientServices(fakeEnv());
    expect(s.keywords.suggest("Mưa lớn gây ngập lụt")[0]).toBe("flood");
  });

  it("hai lần tạo container cho hai kho độc lập", async () => {
    const a = createClientServices(fakeEnv());
    const b = createClientServices(fakeEnv());
    await a.brands.save("t", { x: "1" }, null);
    expect(await b.brands.load("t")).toBeNull();
  });
});

describe("createClientServices — tracks", () => {
  it("có TrackSource", () => {
    expect(typeof createClientServices(fakeEnv()).tracks.bytes).toBe("function");
  });
});
