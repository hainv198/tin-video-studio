import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createStudio } from "@/client/controllers/createStudio";
import { createClientServices, type ClientEnv } from "@/client/container";
import { SAMPLE_NEWS } from "@/client/sample/sampleNews";
import { ApiError } from "@/client/services/apiError";

function env(): ClientEnv {
  return {
    fetch: (async () => new Response("", { status: 404 })) as unknown as typeof fetch,
    indexedDB: new IDBFactory() as unknown as IDBFactory,
    origin: "http://localhost:3100",
    createUrl: () => "blob:x",
    revokeUrl: () => {},
  };
}

describe("createStudio", () => {
  it("lắp đủ controller dùng chung một session", async () => {
    const studio = createStudio(createClientServices(env()), { schedule: () => () => {} });
    expect(studio.project.createFrom({ ...SAMPLE_NEWS, templateId: "theanh28" })).toBe(true);
    expect(studio.session.state.project?.scenes.length).toBeGreaterThan(2);
    expect(studio.wizard.next()).toBe(true);
    expect(studio.wizard.state.step).toBe("voice");
    await studio.brand.load("theanh28");
    expect(studio.session.state.brand.values.channelName).toBe("TIN NHANH");
    studio.dispose();
  });

  it("onAuthLost của studio được gọi khi một controller gặp lỗi hết phiên", async () => {
    let lost = 0;
    const services = createClientServices(env());
    (services.tts as unknown as { voices: () => Promise<never> }).voices = async () => {
      throw new ApiError(401, "AUTH", "Chưa đăng nhập");
    };
    const studio = createStudio(services, { onAuthLost: () => lost++, schedule: () => () => {} });
    await studio.voice.loadVoices();
    expect(lost).toBe(1);
    studio.dispose();
  });
});
