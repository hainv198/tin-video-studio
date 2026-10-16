import { describe, expect, it } from "vitest";
import { OptionsController } from "@/client/controllers/OptionsController";
import { flush, makeSessionWithProject } from "../../helpers/studioFixtures";

function setup() {
  const made = makeSessionWithProject(2);
  return { ...made, ctrl: new OptionsController({ session: made.session }) };
}

describe("OptionsController", () => {
  it("bật/tắt phụ đề, đổi font, đổi ưu tiên ảnh/video: ghi vào session và tự lưu", async () => {
    const { ctrl, session, saves, sched } = setup();
    ctrl.setSubtitlesEnabled(false);
    ctrl.setSubtitleFont("oswald");
    ctrl.setTextFont("montserrat");
    ctrl.setFootageKind("image");
    expect(session.state.options.snapshot()).toMatchObject({
      subtitles: { enabled: false, fontId: "oswald" },
      textFontId: "montserrat",
      footageKind: "image",
    });
    sched.runAll();
    await flush();
    expect(saves.at(-1)?.options).toMatchObject({
      subtitles: { enabled: false, fontId: "oswald" },
      textFontId: "montserrat",
      footageKind: "image",
    });
  });

  it("giá trị lạ: báo lỗi tiếng Việt, session giữ nguyên; thao tác đúng sau đó xoá lỗi", () => {
    const { ctrl, session } = setup();
    const before = session.state.options;
    ctrl.setSubtitleFont("comic-sans");
    expect(ctrl.state.error).toBe("Font không có trong danh sách");
    expect(session.state.options).toBe(before);
    ctrl.setIntroBlock("đỏ");
    expect(ctrl.state.error).toBe("Màu phải có dạng #RRGGBB");
    ctrl.setSubtitleFont("oswald");
    expect(ctrl.state.error).toBeNull();
    expect(session.state.options.subtitleFontId).toBe("oswald");
  });

  it("màu thumbnail đầu: mặc định theo màu chủ đạo thương hiệu; đặt riêng; về mặc định", () => {
    const { ctrl, session } = setup();
    expect(ctrl.introColors()).toEqual({ backgroundColor: "#1f9d55", blockColor: "#1f9d55", custom: false });
    session.setBrand({ values: { primaryColor: "#AA0000" }, logo: null });
    expect(ctrl.introColors()).toEqual({ backgroundColor: "#aa0000", blockColor: "#aa0000", custom: false });
    ctrl.setIntroBackground("#112233");
    expect(ctrl.introColors()).toEqual({ backgroundColor: "#112233", blockColor: "#aa0000", custom: true });
    ctrl.setIntroBlock("#445566");
    expect(ctrl.introColors()).toEqual({ backgroundColor: "#112233", blockColor: "#445566", custom: true });
    ctrl.resetIntroColors();
    expect(ctrl.introColors()).toEqual({ backgroundColor: "#aa0000", blockColor: "#aa0000", custom: false });
  });

  it("danh sách font cho giao diện", () => {
    const { ctrl } = setup();
    expect(ctrl.fontChoices.map((f) => f.id)).toContain("phudu");
    expect(ctrl.fontChoices).toHaveLength(6);
  });
});
