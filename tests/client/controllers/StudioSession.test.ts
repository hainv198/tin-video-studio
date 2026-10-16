import { describe, expect, it, vi } from "vitest";
import { StudioSession } from "@/client/controllers/StudioSession";
import type { DraftBody } from "@/client/storage/ProjectDraft";
import { FallbackFootage } from "@/domain/Footage";
import { sequentialIds } from "@/domain/ids";
import { VideoOptions } from "@/domain/VideoOptions";
import { fakeNarration, flush, makeProject, makeSession, makeSessionWithProject, manualScheduler, VOICE } from "../../helpers/studioFixtures";

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

  it("setBrand giống hệt bộ hiện tại thì không báo và giữ nguyên state", () => {
    const { session } = makeSession();
    session.setBrand({ values: { channelName: "KÊNH" }, logo: null });
    const before = session.state;
    const listener = vi.fn();
    session.subscribe(listener);
    session.setBrand({ values: { channelName: "KÊNH" }, logo: null });
    expect(listener).not.toHaveBeenCalled();
    expect(session.state).toBe(before);
  });

  it("setBrand đổi giá trị thì báo", () => {
    const { session } = makeSession();
    session.setBrand({ values: { channelName: "A" }, logo: null });
    const listener = vi.fn();
    session.subscribe(listener);
    session.setBrand({ values: { channelName: "B" }, logo: null });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.state.brand.values).toEqual({ channelName: "B" });
  });

  it("setBrand đổi logo (Blob khác) thì báo", () => {
    const { session } = makeSession();
    session.setBrand({ values: {}, logo: new Blob(["a"]) });
    const listener = vi.fn();
    session.subscribe(listener);
    session.setBrand({ values: {}, logo: new Blob(["a"]) });
    expect(listener).toHaveBeenCalledTimes(1);
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

  it("onSaveError ném lỗi cũng không làm hỏng hàng đợi", async () => {
    const sched = manualScheduler();
    const session = new StudioSession({
      drafts: {
        save: async () => {
          throw new Error("đầy bộ nhớ");
        },
        load: async () => null,
        clear: async () => {
          throw new Error("không xoá được");
        },
      },
      ids: sequentialIds("n"),
      schedule: sched.schedule,
      onSaveError: () => {
        throw new Error("callback hỏng");
      },
    });
    session.update((d) => ({ ...d, project: makeProject(1) }));
    await expect(session.flush()).resolves.toBeUndefined();
    session.reset();
    await expect(session.flush()).resolves.toBeUndefined();
  });

  describe("lưu nối tiếp", () => {
    function gated() {
      const sched = manualScheduler();
      const events: string[] = [];
      const stored: DraftBody[] = [];
      const gates: Array<() => void> = [];
      const session = new StudioSession({
        drafts: {
          save: async (body) => {
            events.push("save:start");
            await new Promise<void>((resolve) => gates.push(resolve));
            stored.push(body);
            events.push("save:end");
          },
          load: async () => null,
          clear: async () => {
            events.push("clear");
          },
        },
        ids: sequentialIds("n"),
        schedule: sched.schedule,
      });
      session.update((d) => ({ ...d, project: makeProject(2), voice: VOICE }));
      return { session, sched, events, stored, gates };
    }

    it("hai lần lưu chồng nhau chạy lần lượt và bản cuối là snapshot mới nhất", async () => {
      const { session, sched, events, stored, gates } = gated();
      sched.runAll();
      await flush();
      expect(events).toEqual(["save:start"]);
      session.update((d) => ({ ...d, project: d.project!.mergeWithNext(d.project!.scenes[1]!.id) }));
      sched.runAll();
      await flush();
      expect(events).toEqual(["save:start"]); // lần 2 chưa bắt đầu khi lần 1 còn treo
      gates[0]!();
      await flush();
      gates[1]!();
      await flush();
      expect(events).toEqual(["save:start", "save:end", "save:start", "save:end"]);
      expect(stored).toHaveLength(2);
      expect(stored[1]!.project.scenes).toHaveLength(session.state.project!.scenes.length);
    });

    it("flush khi đang có lần lưu chỉ xong sau cả hai lần và ghi bản mới nhất", async () => {
      const { session, sched, stored, gates } = gated();
      sched.runAll();
      await flush();
      session.update((d) => ({ ...d, voice: null }));
      let done = false;
      const flushing = session.flush().then(() => {
        done = true;
      });
      expect(sched.pending()).toBe(0);
      gates[0]!();
      await flush();
      expect(done).toBe(false);
      gates[1]!();
      await flushing;
      expect(done).toBe(true);
      expect(stored).toHaveLength(2);
      expect(stored[1]!.voice).toBeNull();
    });

    it("reset khi đang lưu: clear chạy sau lần lưu cũ và không ghi lại gì nữa", async () => {
      const { session, sched, events, gates } = gated();
      sched.runAll();
      await flush();
      session.update((d) => ({ ...d, voice: null })); // lần lưu thứ hai đang hẹn
      session.reset();
      expect(sched.pending()).toBe(0);
      gates[0]!();
      await flush();
      await flush();
      expect(events).toEqual(["save:start", "save:end", "clear"]);
      expect(gates).toHaveLength(1);
    });
  });
});

describe("StudioSession — tuỳ chọn video", () => {
  it("mặc định có tuỳ chọn video; đổi khi chưa có dự án thì giữ trong bộ nhớ, không hẹn lưu", () => {
    const { session, sched } = makeSession();
    expect(session.state.options.snapshot()).toEqual(VideoOptions.defaults().snapshot());
    session.update((d) => ({ ...d, options: d.options.withSubtitlesEnabled(false) }));
    expect(session.state.options.subtitlesEnabled).toBe(false);
    expect(sched.pending()).toBe(0);
  });

  it("tự lưu kèm tuỳ chọn video", async () => {
    const { session, saves } = makeSessionWithProject(2);
    session.update((d) => ({ ...d, options: d.options.withTextFont("oswald").withSceneFootageKind("s2", "video") }));
    await session.flush();
    expect(saves.at(-1)?.options).toMatchObject({ textFontId: "oswald", sceneFootageKinds: { s2: "video" } });
  });

  it("restore lấy tuỳ chọn từ bản nháp; bản nháp v1 không có tuỳ chọn thì dùng mặc định", async () => {
    const a = makeSessionWithProject(2);
    a.session.update((d) => ({ ...d, options: d.options.withSubtitleFont("oswald") }));
    await a.session.flush();
    const b = makeSession();
    b.session.restore(a.saves.at(-1)!);
    expect(b.session.state.options.subtitleFontId).toBe("oswald");
    const v1 = { ...a.saves.at(-1)! };
    delete v1.options;
    const c = makeSession();
    c.session.restore(v1);
    expect(c.session.state.options.snapshot()).toEqual(VideoOptions.defaults().snapshot());
  });

  it("bỏ lựa chọn Ảnh/Video của cảnh không còn trong dự án", () => {
    const { session, project } = makeSessionWithProject(3);
    const [, s2, s3] = project.scenes;
    session.update((d) => ({
      ...d,
      options: d.options.withSceneFootageKind(s2!.id, "image").withSceneFootageKind(s3!.id, "video"),
    }));
    session.update((d) => ({ ...d, project: d.project!.mergeWithNext(s2!.id) })); // s3 biến mất
    expect(session.state.options.sceneFootageKind(s2!.id)).toBe("image");
    expect(session.state.options.sceneFootageKind(s3!.id)).toBeNull();
  });

  it("reset (dự án mới) đưa tuỳ chọn về mặc định", () => {
    const { session } = makeSessionWithProject(2);
    session.update((d) => ({ ...d, options: d.options.withSubtitlesEnabled(false) }));
    session.reset();
    expect(session.state.options.subtitlesEnabled).toBe(true);
  });
});
