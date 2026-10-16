import { describe, expect, it, vi } from "vitest";
import { ConfigPanelController, type ConfigApi } from "@/app/cai-dat/ConfigPanelController";
import type { ConfigSnapshot } from "@/server/config/ConfigController";

const snap = (isSet: boolean): ConfigSnapshot => ({
  editable: true,
  readOnlyReason: null,
  keys: [{ key: "GEMINI_API_KEY", label: "Gemini", hint: "h", kind: "secret", isSet }],
});

function make(restartRequired = false) {
  const api: ConfigApi = {
    save: vi.fn(async () => ({ ...snap(true), changed: ["GEMINI_API_KEY"], restartRequired })),
    clear: vi.fn(async () => ({ ...snap(false), changed: ["GEMINI_API_KEY"], restartRequired })),
  };
  return { api, controller: new ConfigPanelController(api, snap(false)) };
}

describe("ConfigPanelController", () => {
  it("lưu: gọi api, cập nhật trạng thái, báo Đã lưu", async () => {
    const { api, controller } = make();
    await controller.save("GEMINI_API_KEY", "  abc ");
    expect(api.save).toHaveBeenCalledWith("GEMINI_API_KEY", "abc");
    expect(controller.state.snapshot.keys[0]?.isSet).toBe(true);
    expect(controller.state.message).toEqual({ tone: "ok", text: "Đã lưu" });
  });

  it("ô trống: không gọi api", async () => {
    const { api, controller } = make();
    await controller.save("GEMINI_API_KEY", "   ");
    expect(api.save).not.toHaveBeenCalled();
    expect(controller.state.message?.tone).toBe("error");
  });

  it("cần khởi động lại thì nói rõ", async () => {
    const { controller } = make(true);
    await controller.save("GEMINI_API_KEY", "abc");
    expect(controller.state.message?.text).toContain("khởi động lại");
  });

  it("xoá cập nhật trạng thái", async () => {
    const { controller } = make();
    await controller.clear("GEMINI_API_KEY");
    expect(controller.state.message?.text).toBe("Đã xoá");
    expect(controller.state.snapshot.keys[0]?.isSet).toBe(false);
  });

  it("lỗi api hiện thông báo lỗi và báo cho người nghe", async () => {
    const { api, controller } = make();
    (api.save as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("hỏng"));
    const listener = vi.fn();
    controller.subscribe(listener);
    await controller.save("GEMINI_API_KEY", "abc");
    expect(controller.state.message).toEqual({ tone: "error", text: "hỏng" });
    expect(listener).toHaveBeenCalled();
    expect(controller.state.busyKey).toBeNull();
  });
});
