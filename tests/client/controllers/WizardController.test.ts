import { describe, expect, it } from "vitest";
import { WizardController } from "@/client/controllers/WizardController";
import { StudioSession } from "@/client/controllers/StudioSession";
import { uploadToFootage, uploadUri } from "@/client/media/footageFactory";
import { DraftRepository } from "@/client/storage/DraftRepository";
import { MemoryKeyValueStore } from "@/client/storage/KeyValueStore";
import { UploadRepository } from "@/client/storage/UploadRepository";
import { MusicTrack } from "@/domain/MusicTrack";
import { sequentialIds } from "@/domain/ids";
import { fakeNarration, makeProject, manualScheduler, VOICE } from "../../helpers/studioFixtures";

function setup() {
  const store = new MemoryKeyValueStore();
  const drafts = new DraftRepository(store, () => new Date("2026-10-14T08:00:00Z"));
  const uploads = new UploadRepository(store, sequentialIds("u"));
  const sched = manualScheduler();
  const session = new StudioSession({ drafts, ids: sequentialIds("n"), schedule: sched.schedule });
  const wizard = new WizardController({ session, drafts, uploads });
  return { store, drafts, uploads, session, wizard };
}

async function fillAll(session: StudioSession) {
  const project = makeProject(2);
  session.update((d) => ({
    ...d,
    project,
    voice: VOICE,
    narrations: new Map(project.scenes.map((s) => [s.id, fakeNarration(s)])),
  }));
  await session.flush();
  return project;
}

describe("WizardController", () => {
  it("bắt đầu ở bước 1; chỉ vào được bước khi các bước trước đã xong", () => {
    const { wizard, session } = setup();
    expect(wizard.state.step).toBe("news");
    expect(wizard.goTo("voice")).toBe(false);
    expect(wizard.next()).toBe(false);
    session.update((d) => ({ ...d, project: makeProject(2) }));
    expect(wizard.next()).toBe(true);
    expect(wizard.state.step).toBe("voice");
    expect(wizard.goTo("render")).toBe(false);
    wizard.back();
    expect(wizard.state.step).toBe("news");
    wizard.back();
    expect(wizard.state.step).toBe("news");
  });

  it("boot đề nghị mở lại bản nháp nhưng chưa áp dụng", async () => {
    const a = setup();
    await fillAll(a.session);
    const b = new WizardController({
      session: new StudioSession({ drafts: a.drafts, ids: sequentialIds("n"), schedule: manualScheduler().schedule }),
      drafts: a.drafts,
      uploads: a.uploads,
    });
    await b.boot();
    expect(b.state.booting).toBe(false);
    expect(b.state.resume).toEqual({ savedAt: "2026-10-14T08:00:00.000Z", title: "Tiêu đề bản tin" });
  });

  it("không có bản nháp thì không đề nghị gì", async () => {
    const { wizard } = setup();
    await wizard.boot();
    expect(wizard.state.resume).toBeNull();
    expect(wizard.state.booting).toBe(false);
  });

  it("resume áp dụng bản nháp và nhảy tới bước đầu tiên chưa xong", async () => {
    const a = setup();
    await fillAll(a.session);
    const session = new StudioSession({ drafts: a.drafts, ids: sequentialIds("n"), schedule: manualScheduler().schedule });
    const wizard = new WizardController({ session, drafts: a.drafts, uploads: a.uploads });
    await wizard.boot();
    await wizard.resume();
    expect(session.state.project?.scenes).toHaveLength(3);
    expect(wizard.state.step).toBe("render");
    expect(wizard.state.resume).toBeNull();
  });

  it("bản nháp hỏng thì xoá đi và báo lỗi tiếng Việt", async () => {
    const { store, wizard, drafts } = setup();
    await store.set("draft", { version: 1, savedAt: "x", project: { title: "T", templateId: "theanh28", sourceCredit: "Nguồn", publishDate: "2026-10-14", scenes: "hỏng" }, narrations: [], footage: { assignments: [] }, voice: null, music: null });
    await wizard.boot();
    expect(wizard.state.resume).not.toBeNull();
    await wizard.resume();
    expect(wizard.state.error).toMatch(/^Bản nháp hỏng/);
    expect(await drafts.load()).toBeNull();
    expect(wizard.state.resume).toBeNull();
  });

  it("discard xoá bản nháp và dọn file tải lên", async () => {
    const { wizard, drafts, uploads, session } = setup();
    await fillAll(session);
    await uploads.put(new Blob(["x"]), { name: "a.jpg", kind: "image" });
    await wizard.boot();
    await wizard.discard();
    expect(await drafts.load()).toBeNull();
    expect(await uploads.list()).toEqual([]);
    expect(wizard.state.resume).toBeNull();
  });

  it("newProject xoá dự án và bản nháp, giữ thương hiệu, về bước 1, dọn file không dùng", async () => {
    const { wizard, drafts, uploads, session } = setup();
    await fillAll(session);
    session.setBrand({ values: { channelName: "K" }, logo: null });
    await uploads.put(new Blob(["x"]), { name: "a.jpg", kind: "image" });
    await wizard.newProject();
    expect(session.state.project).toBeNull();
    expect(session.state.brand.values).toEqual({ channelName: "K" });
    expect(wizard.state.step).toBe("news");
    expect(await drafts.load()).toBeNull();
    expect(await uploads.list()).toEqual([]);
  });

  it("cleanupUploads giữ file đang được cảnh trám hoặc nhạc tham chiếu", async () => {
    const { wizard, uploads, session } = setup();
    const project = await fillAll(session);
    const usedImage = await uploads.put(new Blob(["i"]), { name: "i.jpg", kind: "image" });
    const usedMusic = await uploads.put(new Blob(["m"]), { name: "m.mp3", kind: "audio" });
    const orphan = await uploads.put(new Blob(["o"]), { name: "o.jpg", kind: "image" });
    session.update((d) => ({
      ...d,
      footage: d.footage.assign(project.scenes[1]!.id, uploadToFootage("g1", usedImage.id, "image", { width: 10, height: 10 })),
      music: MusicTrack.create({ id: usedMusic.id, title: "m", origin: "upload", uri: uploadUri(usedMusic.id) }),
    }));
    await wizard.cleanupUploads();
    expect((await uploads.list()).map((m) => m.id).sort()).toEqual([usedImage.id, usedMusic.id].sort());
    expect((await uploads.list()).some((m) => m.id === orphan.id)).toBe(false);
  });

  it("discard giữ file chỉ nằm trong kho (liveUploadIds)", async () => {
    const { drafts, uploads, session } = setup();
    const wizard = new WizardController({ session, drafts, uploads, liveUploadIds: () => ["upload-u1"] });
    await fillAll(session);
    const pooled = await uploads.put(new Blob(["p"]), { name: "p.jpg", kind: "image" });
    const orphan = await uploads.put(new Blob(["o"]), { name: "o.jpg", kind: "image" });
    await wizard.discard();
    const ids = (await uploads.list()).map((m) => m.id);
    expect(ids).toContain(pooled.id);
    expect(ids).not.toContain(orphan.id);
  });

  it("newProject gọi onReset trước khi dọn file", async () => {
    const { drafts, uploads, session } = setup();
    const order: string[] = [];
    let live: string[] = ["upload-u1"];
    const wizard = new WizardController({
      session,
      drafts,
      uploads: { list: async () => { order.push("list"); return uploads.list(); }, delete: (id) => uploads.delete(id) },
      liveUploadIds: () => live,
      onReset: () => { order.push("reset"); live = []; },
    });
    await fillAll(session);
    await uploads.put(new Blob(["p"]), { name: "p.jpg", kind: "image" });
    await wizard.newProject();
    expect(order).toEqual(["reset", "list"]);
    expect(await uploads.list()).toEqual([]);
  });

  it("boot chạy hai lần: lượt cũ về muộn sau discard không đề nghị lại bản nháp", async () => {
    const a = setup();
    await fillAll(a.session);
    const session = new StudioSession({ drafts: a.drafts, ids: sequentialIds("n"), schedule: manualScheduler().schedule });
    const base = await a.drafts.load();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let calls = 0;
    const slow = {
      load: async () => {
        calls += 1;
        if (calls === 1) await gate;
        return base;
      },
      clear: () => a.drafts.clear(),
    };
    const wizard = new WizardController({ session, drafts: slow, uploads: a.uploads });
    const first = wizard.boot();
    const second = wizard.boot();
    await second;
    expect(wizard.state.resume).not.toBeNull();
    await wizard.discard();
    expect(wizard.state.resume).toBeNull();
    release();
    await first;
    expect(wizard.state.resume).toBeNull();
    expect(wizard.state.booting).toBe(false);
  });
});
