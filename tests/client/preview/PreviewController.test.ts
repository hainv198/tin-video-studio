import { describe, expect, it } from "vitest";
import { PreviewController, type DecodedImage } from "@/client/preview/PreviewController";
import type { PreviewForm } from "@/client/preview/PreviewFrameBuilder";
import { defaultTemplateRegistry } from "@/templates/registry";
import type { DrawableImage, FontFaceSpec } from "@/templates/VideoTemplate";
import { flush, makeSession, manualScheduler } from "../../helpers/studioFixtures";
import { RecordingCanvas } from "../../helpers/RecordingCanvas";

const placeholder: DrawableImage = { source: { tag: "placeholder" } as unknown as CanvasImageSource, width: 1600, height: 900 };
const form = (over: Partial<PreviewForm> = {}): PreviewForm => ({
  text: "Câu một. Câu hai.",
  title: "",
  sourceCredit: "Báo A",
  publishDateText: "2026-10-17",
  templateId: "theanh28",
  ...over,
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function setup(opts: { fontGate?: Promise<void> } = {}) {
  const { session } = makeSession();
  const sched = manualScheduler();
  const fontCalls: FontFaceSpec[][] = [];
  const decoded: { blob: Blob; disposed: boolean }[] = [];
  const ctrl = new PreviewController({
    session,
    templates: defaultTemplateRegistry(),
    schedule: sched.schedule,
    loadFonts: async (faces) => {
      fontCalls.push([...faces]);
      await opts.fontGate;
    },
    decodeImage: async (blob): Promise<DecodedImage> => {
      const entry = { blob, disposed: false };
      decoded.push(entry);
      return {
        image: { source: { tag: "logo", blob } as unknown as CanvasImageSource, width: 64, height: 64 },
        dispose: () => {
          entry.disposed = true;
        },
      };
    },
  });
  const canvas = new RecordingCanvas();
  return { session, sched, ctrl, canvas, fontCalls, decoded };
}

async function settle(sched: ReturnType<typeof manualScheduler>) {
  sched.runAll();
  await flush();
  await flush();
}

describe("PreviewController", () => {
  it("chỉ vẽ sau debounce; gõ liên tục chỉ giữ một lượt chờ và vẽ nội dung mới nhất", async () => {
    const { ctrl, sched, canvas } = setup();
    ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    ctrl.setForm(form({ title: "Tiêu đề A" }));
    ctrl.setForm(form({ title: "Tiêu đề B" }));
    expect(canvas.calls).toHaveLength(0);
    expect(sched.pending()).toBe(1);
    await settle(sched);
    expect(canvas.texts()).toContain("TIÊU ĐỀ B");
    expect(canvas.texts()).not.toContain("TIÊU ĐỀ A");
    expect(ctrl.state).toMatchObject({ tab: "intro", usingSample: false, drawCount: 1, error: null });
  });

  it("không đổi gì thì không vẽ lại", async () => {
    const { ctrl, sched, canvas, session } = setup();
    ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    ctrl.setForm(form());
    await settle(sched);
    ctrl.setForm(form());
    session.update((d) => ({ ...d })); // session báo nhưng dữ liệu xem trước như cũ
    await settle(sched);
    expect(ctrl.state.drawCount).toBe(1);
  });

  it("chuyển tab vẽ cảnh thân bài với phụ đề; tắt phụ đề ở thanh tuỳ chọn thì vẽ lại không phụ đề", async () => {
    const { ctrl, sched, canvas, session } = setup();
    ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    ctrl.setForm(form());
    await settle(sched);
    ctrl.setTab("body");
    await settle(sched);
    expect(ctrl.state.tab).toBe("body");
    expect(canvas.ops("strokeText").map((c) => c.args[0])).toContain("Câu hai.");
    canvas.calls.length = 0;
    session.update((d) => ({ ...d, options: d.options.withSubtitlesEnabled(false) }));
    await settle(sched);
    expect(ctrl.state.drawCount).toBe(3);
    expect(canvas.ops("strokeText")).toHaveLength(0);
  });

  it("nạp font đã chọn trước khi vẽ, mỗi tệp một lần; đổi font phụ đề chỉ nạp font mới", async () => {
    const gate = deferred();
    const { ctrl, sched, canvas, fontCalls, session } = setup({ fontGate: gate.promise });
    ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    ctrl.setForm(form());
    await settle(sched);
    expect(fontCalls).toHaveLength(1);
    expect(fontCalls[0]?.map((f) => f.family)).toEqual(["TVS Barlow Condensed", "TVS Barlow Condensed", "TVS Phudu"]);
    expect(canvas.calls).toHaveLength(0);
    gate.resolve();
    await flush();
    await flush();
    expect(ctrl.state.drawCount).toBe(1);
    session.update((d) => ({ ...d, options: d.options.withSubtitleFont("oswald") }));
    await settle(sched);
    expect(fontCalls.at(-1)?.map((f) => f.url)).toEqual(["/fonts/oswald/Oswald-Variable.ttf"]);
    expect(ctrl.state.drawCount).toBe(2);
  });

  it("chưa có nội dung thì báo đang dùng nội dung mẫu", async () => {
    const { ctrl, sched, canvas } = setup();
    ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    ctrl.setForm(form({ text: "", sourceCredit: "" }));
    await settle(sched);
    expect(ctrl.state.usingSample).toBe(true);
  });

  it("thương hiệu sống từ session: tên kênh đổi là vẽ lại; logo được giải mã, thay logo thì nhả logo cũ", async () => {
    const { ctrl, sched, canvas, session, decoded } = setup();
    ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    ctrl.setForm(form());
    await settle(sched);
    session.setBrand({ values: { channelName: "Kênh Mới", primaryColor: "#123456" }, logo: null });
    await settle(sched);
    expect(canvas.texts()).toContain("KÊNH MỚI");
    const logo1 = new Blob(["a"]);
    session.setBrand({ values: { channelName: "Kênh Mới", primaryColor: "#123456" }, logo: logo1 });
    await settle(sched);
    expect(decoded.map((d) => d.blob)).toEqual([logo1]);
    expect(canvas.ops("drawImage").some((c) => (c.args[0] as { tag?: string }).tag === "logo")).toBe(true);
    const logo2 = new Blob(["b"]);
    session.setBrand({ values: { channelName: "Kênh Mới", primaryColor: "#123456" }, logo: logo2 });
    await settle(sched);
    expect(decoded.map((d) => d.disposed)).toEqual([true, false]);
  });

  it("phong cách không tồn tại thì báo lỗi, không vẽ", async () => {
    const { ctrl, sched, canvas } = setup();
    ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    ctrl.setForm(form({ templateId: "khong-co" }));
    await settle(sched);
    expect(canvas.calls).toHaveLength(0);
    expect(ctrl.state.error).toMatch(/khong-co/);
  });

  it("tháo khỏi canvas: huỷ lượt chờ, nhả logo, không nghe session nữa", async () => {
    const { ctrl, sched, canvas, session, decoded } = setup();
    const detach = ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    session.setBrand({ values: {}, logo: new Blob(["a"]) });
    ctrl.setForm(form());
    await settle(sched);
    expect(ctrl.state.drawCount).toBe(1);
    ctrl.setForm(form({ title: "Mới" }));
    expect(sched.pending()).toBe(1);
    detach();
    expect(sched.pending()).toBe(0);
    expect(decoded.length).toBe(1);
    expect(decoded.every((d) => d.disposed)).toBe(true);
    session.update((d) => ({ ...d, options: d.options.withSubtitlesEnabled(false) }));
    expect(sched.pending()).toBe(0);
    await settle(sched);
    expect(ctrl.state.drawCount).toBe(1);
  });

  it("tháo khi đang nạp font: lượt vẽ đó bị bỏ", async () => {
    const gate = deferred();
    const { ctrl, sched, canvas } = setup({ fontGate: gate.promise });
    const detach = ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    ctrl.setForm(form());
    sched.runAll();
    await flush();
    detach();
    gate.resolve();
    await flush();
    await flush();
    expect(canvas.calls).toHaveLength(0);
    expect(ctrl.state.drawCount).toBe(0);
  });
});
