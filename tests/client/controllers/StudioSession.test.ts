import { describe, expect, it, vi } from "vitest";
import { StudioSession } from "@/client/controllers/StudioSession";
import { FallbackFootage } from "@/domain/Footage";
import { sequentialIds } from "@/domain/ids";
import { fakeNarration, makeProject, makeSession, makeSessionWithProject, manualScheduler, VOICE } from "../../helpers/studioFixtures";

describe("StudioSession", () => {
  it("update thay state và báo cho người nghe", () => {
    const { session } = makeSession();
    const seen = vi.fn();
    session.subscribe(seen);
    session.update((d) => ({ ...d, voice: VOICE }));
    expect(session.state.voice).toBe(VOICE);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("tự lưu có trễ: nhiều update chỉ một lần lưu, huỷ hẹn cũ", async () => {
    const { session, saves, sched } = makeSessionWithProject(2);
    session.update((d) => ({ ...d, voice: VOICE }));
    expect(sched.pending()).toBe(1);
    expect(saves).toHaveLength(0);
    sched.runAll();
    await Promise.resolve();
    expect(saves).toHaveLength(1);
    expect(saves[0]?.project.scenes).toHaveLength(3);
    expect(saves[0]?.voice).toEqual(VOICE.snapshot());
  });

  it("chưa có dự án thì không hẹn lưu", () => {
    const { session, sched } = makeSession();
    session.update((d) => ({ ...d, voice: VOICE }));
    expect(sched.pending()).toBe(0);
  });

  it("dọn giọng và cảnh trám của cảnh không còn trong dự án", () => {
    const { session, project } = makeSessionWithProject(3); // s1 mở đầu, s2, s3, s4
    const [, s2, s3] = project.scenes;
    session.update((d) => ({
      ...d,
      narrations: new Map([
        [s2!.id, fakeNarration(s2!)],
        [s3!.id, fakeNarration(s3!)],
      ]),
      footage: d.footage.assign(s2!.id, new FallbackFootage("a")).assign(s3!.id, new FallbackFootage("b")),
    }));
    session.update((d) => ({ ...d, project: d.project!.mergeWithNext(s2!.id) })); // s3 biến mất
    expect([...session.state.narrations.keys()]).toEqual([s2!.id]);
    expect(session.state.footage.sceneIds()).toEqual([s2!.id]);
  });

  it("restore dựng lại dự án từ bản nháp", async () => {
    const a = makeSessionWithProject(2);
    a.session.update((d) => ({
      ...d,
      narrations: new Map([[a.project.scenes[1]!.id, fakeNarration(a.project.scenes[1]!)]]),
    }));
    await a.session.flush();
    const draft = { ...a.saves.at(-1)!, version: 1 as const, savedAt: "x" };
    const b = makeSession();
    b.session.restore(draft);
    expect(b.session.state.project?.scenes).toHaveLength(3);
    expect(b.session.state.voice?.voiceName).toBe("vi-VN-Test");
    expect(b.session.state.narrations.size).toBe(1);
  });

  it("reset xoá dự án nhưng giữ bộ thương hiệu và huỷ lưu đang hẹn", () => {
    const { session, sched } = makeSessionWithProject(1);
    session.setBrand({ values: { channelName: "KÊNH" }, logo: null });
    session.reset();
    expect(session.state.project).toBeNull();
    expect(session.state.voice).toBeNull();
    expect(session.state.brand.values).toEqual({ channelName: "KÊNH" });
    expect(sched.pending()).toBe(0);
  });

  it("setBrand không hẹn lưu bản nháp", () => {
    const { session, sched } = makeSessionWithProject(1);
    sched.runAll();
    session.setBrand({ values: {}, logo: null });
    expect(sched.pending()).toBe(0);
  });

  it("flush lưu ngay và huỷ hẹn", async () => {
    const { session, saves, sched } = makeSessionWithProject(1);
    await session.flush();
    expect(saves).toHaveLength(1);
    expect(sched.pending()).toBe(0);
  });

  it("lỗi lưu đi tới onSaveError, không ném ra ngoài", async () => {
    const sched = manualScheduler();
    const onSaveError = vi.fn();
    const session = new StudioSession({
      drafts: {
        save: async () => {
          throw new Error("đầy bộ nhớ");
        },
        load: async () => null,
        clear: async () => {},
      },
      ids: sequentialIds("n"),
      schedule: sched.schedule,
      onSaveError,
    });
    session.update((d) => ({ ...d, project: makeProject(1) }));
    await session.flush();
    expect(onSaveError).toHaveBeenCalledTimes(1);
  });
});
