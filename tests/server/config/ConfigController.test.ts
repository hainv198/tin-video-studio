import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/domain/errors";
import { ConfigController } from "@/server/config/ConfigController";
import { CONFIG_KEYS } from "@/server/config/configKeys";

function make(env: Record<string, string | undefined> = {}, overrides: { onApplied?: () => void } = {}) {
  const apply = vi.fn(async () => {});
  const onApplied = overrides.onApplied ?? vi.fn();
  const controller = new ConfigController({ writer: { apply }, env, onApplied });
  return { controller, apply, onApplied, env };
}

describe("ConfigController.snapshot", () => {
  it("có khoá GEMINI_TEXT_API_KEY (gợi ý từ khoá cảnh trám), tách khỏi GEMINI_API_KEY", () => {
    const { controller } = make({ GEMINI_TEXT_API_KEY: "BIMAT-TEXT" });
    const snap = controller.snapshot();
    const text = snap.keys.find((k) => k.key === "GEMINI_TEXT_API_KEY");
    expect(text).toMatchObject({ label: "Gemini (gợi ý từ khoá cảnh trám)", kind: "secret", isSet: true });
    expect(text?.hint).toContain("aistudio.google.com");
    expect(snap.keys.find((k) => k.key === "GEMINI_API_KEY")?.isSet).toBe(false);
    expect(JSON.stringify(snap)).not.toContain("BIMAT-TEXT");
  });

  it("liệt kê đúng whitelist, không lộ giá trị", () => {
    const { controller } = make({ GEMINI_API_KEY: "BIMAT-123", MINIMAX_VOICES: "BIMAT-VOICES", EDGE_TTS_DEV: "1" });
    const snap = controller.snapshot();
    expect(snap.keys.map((k) => k.key)).toEqual(CONFIG_KEYS.map((k) => k.key));
    expect(snap.keys.find((k) => k.key === "GEMINI_API_KEY")?.isSet).toBe(true);
    expect(snap.keys.find((k) => k.key === "PIXABAY_API_KEY")?.isSet).toBe(false);
    for (const gone of ["MINIMAX_API_KEY", "MINIMAX_VOICES", "EDGE_TTS_DEV"]) {
      expect(snap.keys.some((k) => k.key === gone)).toBe(false);
      expect(CONFIG_KEYS.some((k) => k.key === gone)).toBe(false);
    }
    expect(JSON.stringify(snap)).not.toContain("BIMAT-VOICES");
    expect(JSON.stringify(snap)).not.toContain("BIMAT-123");
    expect(snap.editable).toBe(true);
  });

  it("chỉ xem khi chạy trên Vercel", () => {
    const snap = make({ VERCEL: "1" }).controller.snapshot();
    expect(snap.editable).toBe(false);
    expect(snap.readOnlyReason).toContain("Vercel");
  });

  it("production tự dựng thì chỉ xem, trừ khi bật cờ cho phép", () => {
    expect(make({ NODE_ENV: "production" }).controller.snapshot().editable).toBe(false);
    expect(make({ NODE_ENV: "production", TVS_ALLOW_CONFIG_EDIT: "1" }).controller.snapshot().editable).toBe(true);
  });
});

describe("ConfigController.update", () => {
  it("ghi file, cập nhật process env, làm mới container, trả trạng thái không có giá trị", async () => {
    const { controller, apply, onApplied, env } = make({});
    const res = await controller.update({ set: { GEMINI_API_KEY: "  BIMAT-999  " } });
    expect(apply).toHaveBeenCalledWith({ set: { GEMINI_API_KEY: "BIMAT-999" }, clear: [] });
    expect(env.GEMINI_API_KEY).toBe("BIMAT-999");
    expect(onApplied).toHaveBeenCalledOnce();
    expect(res.restartRequired).toBe(false);
    expect(res.changed).toEqual(["GEMINI_API_KEY"]);
    expect(JSON.stringify(res)).not.toContain("BIMAT-999");
  });

  it("giá trị trống nghĩa là không đổi", async () => {
    const { controller, apply, env } = make({ GEMINI_API_KEY: "giu" });
    const res = await controller.update({ set: { GEMINI_API_KEY: "   ", PIXABAY_API_KEY: "" } });
    expect(apply).not.toHaveBeenCalled();
    expect(env.GEMINI_API_KEY).toBe("giu");
    expect(res.changed).toEqual([]);
  });

  it("clear xoá khoá khỏi file và env", async () => {
    const { controller, apply, env } = make({ PEXELS_API_KEY: "x" });
    const res = await controller.update({ clear: ["PEXELS_API_KEY"] });
    expect(apply).toHaveBeenCalledWith({ set: {}, clear: ["PEXELS_API_KEY"] });
    expect(env.PEXELS_API_KEY).toBeUndefined();
    expect(res.keys.find((k) => k.key === "PEXELS_API_KEY")?.isSet).toBe(false);
  });

  it.each([
    [{ set: { AUTH_SECRET: "x" } }],
    [{ clear: ["APP_USERS"] }],
    [{ set: { GEMINI_API_KEY: "a\nB=1" } }],
    [{ set: { GEMINI_API_KEY: "a\rb" } }],
    [{ set: { GEMINI_API_KEY: "a\u0000b" } }],
    [{ set: { GEMINI_API_KEY: "a".repeat(4001) } }],
    [{ set: { MINIMAX_API_KEY: "x" } }],
    [{ set: { MINIMAX_VOICES: "[]" } }],
    [{ set: { EDGE_TTS_DEV: "1" } }],
    [{ clear: ["MINIMAX_API_KEY"] }],
    [{ clear: ["MINIMAX_VOICES"] }],
    [{ clear: ["EDGE_TTS_DEV"] }],
    [{ set: { GEMINI_API_KEY: 5 } }],
    [{ set: { GEMINI_API_KEY: "a" }, clear: ["GEMINI_API_KEY"] }],
    [{ set: [] }],
    [null],
    ["chuoi"],
  ])("từ chối đầu vào sai %j", async (body) => {
    const { controller, apply } = make({});
    await expect(controller.update(body)).rejects.toBeInstanceOf(ValidationError);
    expect(apply).not.toHaveBeenCalled();
  });

  it("3 khoá đã bỏ bị từ chối là khoá không được phép", async () => {
    const { controller } = make({});
    for (const key of ["MINIMAX_API_KEY", "MINIMAX_VOICES", "EDGE_TTS_DEV"]) {
      await expect(controller.update({ set: { [key]: "BIMAT" } })).rejects.toThrow(/không được phép/);
    }
  });

  it("thông báo lỗi không chứa giá trị", async () => {
    const { controller } = make({});
    const err = await controller.update({ set: { GEMINI_API_KEY: "BIMAT-json\n{" } }).catch((e: Error) => e);
    expect((err as Error).message).not.toContain("BIMAT");
  });

  it("bị chặn khi VERCEL đặt", async () => {
    const { controller, apply } = make({ VERCEL: "1" });
    await expect(controller.update({ set: { GEMINI_API_KEY: "a" } })).rejects.toThrow(/Vercel/);
    expect(apply).not.toHaveBeenCalled();
  });

  it("nếu làm mới container lỗi thì báo cần khởi động lại", async () => {
    const { controller, env } = make(
      {},
      {
        onApplied: () => {
          throw new Error("x");
        },
      },
    );
    const res = await controller.update({ set: { GEMINI_API_KEY: "a" } });
    expect(res.restartRequired).toBe(true);
    expect(env.GEMINI_API_KEY).toBe("a");
  });

  it("ghi file lỗi thì không đụng process env", async () => {
    const env: Record<string, string | undefined> = {};
    const controller = new ConfigController({
      writer: {
        apply: async () => {
          throw new Error("EACCES");
        },
      },
      env,
      onApplied: () => {},
    });
    await expect(controller.update({ set: { GEMINI_API_KEY: "a" } })).rejects.toThrow();
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });
});
