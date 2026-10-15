import { describe, expect, it } from "vitest";
import { ProjectController } from "@/client/controllers/ProjectController";
import { sequentialIds } from "@/domain/ids";
import { FallbackFootage } from "@/domain/Footage";
import { fakeNarration, makeSession, VOICE } from "../../helpers/studioFixtures";

const input = {
  text: "Phú Thọ khởi tố một vụ án. Công an đã vào cuộc điều tra. Hai bị can bị bắt giữ.",
  sourceCredit: "Đức Phong - VietNamNet",
  publishDate: new Date(2026, 9, 14),
  templateId: "theanh28",
};

function setup() {
  const made = makeSession();
  const ctrl = new ProjectController({ session: made.session, ids: sequentialIds("s") });
  return { ...made, ctrl };
}

describe("ProjectController", () => {
  it("createFrom chia cảnh, câu đầu làm tiêu đề, giữ lựa chọn giọng", () => {
    const { ctrl, session } = setup();
    session.update((d) => ({ ...d, voice: VOICE }));
    expect(ctrl.createFrom(input)).toBe(true);
    const project = session.state.project!;
    expect(project.scenes.map((s) => s.role)).toEqual(["intro", "body", "body"]);
    expect(project.title).toBe("Phú Thọ khởi tố một vụ án.");
    expect(session.state.voice).toBe(VOICE);
    expect(ctrl.state.error).toBeNull();
  });

  it("tạo lại dự án thì bỏ giọng và cảnh trám của dự án trước", () => {
    const { ctrl, session } = setup();
    ctrl.createFrom(input);
    const first = session.state.project!;
    session.update((d) => ({
      ...d,
      narrations: new Map([[first.scenes[1]!.id, fakeNarration(first.scenes[1]!)]]),
      footage: d.footage.assign(first.scenes[1]!.id, new FallbackFootage("x")),
    }));
    ctrl.createFrom({ ...input, text: "Một tin khác hoàn toàn. Câu thứ hai của tin." });
    expect(session.state.narrations.size).toBe(0);
    expect(session.state.footage.sceneIds()).toEqual([]);
  });

  it("dữ liệu sai thì trả false và báo lỗi tiếng Việt, không đổi dự án", () => {
    const { ctrl, session } = setup();
    expect(ctrl.createFrom({ ...input, text: "   " })).toBe(false);
    expect(ctrl.state.error).toBe("Chưa có nội dung tin");
    expect(session.state.project).toBeNull();
    expect(ctrl.createFrom({ ...input, sourceCredit: "x".repeat(81) })).toBe(false);
    expect(ctrl.state.error).toBe("Nguồn tin tối đa 80 ký tự");
  });

  it("sửa chữ, gộp, tách cảnh; chưa có dự án thì báo lỗi", () => {
    const { ctrl, session } = setup();
    expect(ctrl.updateSceneText("s1", "x")).toBe(false);
    expect(ctrl.state.error).toBe("Chưa có dự án");
    ctrl.createFrom(input);
    const [, a, b] = session.state.project!.scenes;
    expect(ctrl.updateSceneText(a!.id, "Câu đã sửa.")).toBe(true);
    expect(session.state.project!.sceneById(a!.id).text).toBe("Câu đã sửa.");
    expect(ctrl.mergeWithNext(a!.id)).toBe(true);
    expect(session.state.project!.scenes).toHaveLength(2);
    expect(session.state.project!.scenes.some((s) => s.id === b!.id)).toBe(false);
    expect(ctrl.splitScene(a!.id, 5)).toBe(true);
    expect(session.state.project!.scenes).toHaveLength(3);
    const intro = session.state.project!.introScene.id;
    expect(ctrl.mergeWithNext(intro)).toBe(false);
    expect(ctrl.state.error).toBe("Không gộp được cảnh mở đầu");
  });

  it("createFromForm nhận ngày dạng yyyy-mm-dd; tiêu đề rỗng thì lấy câu đầu; ngày sai thì báo lỗi", () => {
    const { ctrl, session } = setup();
    expect(ctrl.createFromForm({ text: input.text, title: "  ", sourceCredit: "Báo A", publishDateText: "", templateId: "theanh28" })).toBe(false);
    expect(ctrl.state.error).toBe("Ngày đăng không hợp lệ");
    expect(session.state.project).toBeNull();
    expect(
      ctrl.createFromForm({ text: input.text, title: "  ", sourceCredit: "Báo A", publishDateText: "2026-10-14", templateId: "theanh28" }),
    ).toBe(true);
    expect(session.state.project!.title).toBe("Phú Thọ khởi tố một vụ án.");
    expect(session.state.project!.formattedPublishDate()).toBe("14/10/2026");
  });

  it("updateMetaFromForm đổi ngày từ chuỗi và báo lỗi khi ngày sai", () => {
    const { ctrl, session } = setup();
    ctrl.createFrom(input);
    expect(ctrl.updateMetaFromForm({ publishDateText: "2026-02-03" })).toBe(true);
    expect(session.state.project!.formattedPublishDate()).toBe("03/02/2026");
    expect(ctrl.updateMetaFromForm({ publishDateText: "" })).toBe(false);
    expect(ctrl.state.error).toBe("Ngày đăng không hợp lệ");
    expect(session.state.project!.formattedPublishDate()).toBe("03/02/2026");
  });

  it("updateMeta đổi nguồn tin, ngày, phong cách", () => {
    const { ctrl, session } = setup();
    ctrl.createFrom(input);
    expect(ctrl.updateMeta({ sourceCredit: "Báo mới", publishDate: new Date(2026, 0, 2) })).toBe(true);
    expect(session.state.project!.sourceCredit).toBe("Báo mới");
    expect(session.state.project!.formattedPublishDate()).toBe("02/01/2026");
    expect(ctrl.updateMeta({ sourceCredit: "y".repeat(81) })).toBe(false);
    expect(session.state.project!.sourceCredit).toBe("Báo mới");
  });
});
