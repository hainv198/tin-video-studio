import { describe, expect, it, vi } from "vitest";
import { FootageSearchController, type KeywordSource } from "@/client/controllers/FootageSearchController";
import { ApiError } from "@/client/services/apiError";
import type { StockApi, StockItemDto, StockSearchResponse } from "@/client/services/StockClient";
import { sequentialIds } from "@/domain/ids";
import { FallbackFootage } from "@/domain/Footage";
import { defaultTemplateRegistry } from "@/templates/registry";
import { makeSessionWithProject } from "../../helpers/studioFixtures";

function item(id: string, kind: "image" | "video" = "image"): StockItemDto {
  return {
    provider: "fake",
    id,
    kind,
    thumbUrl: `t-${id}`,
    fullUrl: `f-${id}`,
    width: 1600,
    height: 900,
    durationSec: kind === "video" ? 10 : undefined,
    author: "Tác giả",
    pageUrl: `p-${id}`,
  };
}

type Plan = Record<string, { image?: StockItemDto[]; video?: StockItemDto[]; warnings?: string[]; failKind?: "image" | "video"; quotaKind?: "image" | "video" }>;

type Hook = (signal?: AbortSignal, query?: string, kind?: string) => Promise<void>;

function fakeStock(plan: Plan, onCall?: Hook) {
  const calls: string[] = [];
  const stock: StockApi = {
    search: async (query, kind, options): Promise<StockSearchResponse> => {
      calls.push(`${kind}:${query}`);
      await onCall?.(options?.signal, query, kind);
      if (query === "boom") throw new ApiError(429, "QUOTA", "Hết lượt tìm kiếm hôm nay");
      if (query === "expired") throw new ApiError(401, "AUTH", "Chưa đăng nhập");
      const p = plan[query];
      if (p?.quotaKind === kind) throw new ApiError(429, "QUOTA", "Hết lượt tìm kiếm hôm nay");
      if (p?.failKind === kind) throw new ApiError(502, "UPSTREAM", "Nguồn video đang lỗi");
      return { items: p?.[kind] ?? [], warnings: p?.warnings ?? [] };
    },
  };
  return { stock, calls };
}

const keywords =
  (rules: Record<string, string[]>) =>
  (fallback: string): KeywordSource => ({
    suggest: (sentence) => {
      const hit = Object.entries(rules).find(([needle]) => sentence.includes(needle));
      return hit ? [...hit[1], fallback] : [fallback];
    },
  });

interface SetupOptions {
  concurrency?: number;
  templates?: Pick<ReturnType<typeof defaultTemplateRegistry>, "get">;
}

function setup(plan: Plan, rules: Record<string, string[]> = {}, hook?: Hook, options: SetupOptions = {}) {
  const made = makeSessionWithProject(3); // s1 mở đầu, s2, s3, s4
  made.session.update((d) => ({ ...d, project: d.project!.updateSceneText("s2", "Công an vào cuộc.") }));
  const { stock, calls } = fakeStock(plan, hook);
  const authLost = vi.fn();
  const ctrl = new FootageSearchController({
    session: made.session,
    stock,
    keywords: keywords(rules),
    templates: options.templates ?? defaultTemplateRegistry(),
    ids: sequentialIds("f"),
    concurrency: options.concurrency ?? 1,
    onAuthLost: authLost,
  });
  return { ...made, ctrl, calls, authLost };
}

const uri = (session: { state: { footage: { get(id: string): { snapshot(): unknown } | undefined } } }, id: string) =>
  (session.state.footage.get(id)?.snapshot() as { source?: { uri: string } } | undefined)?.source?.uri;

describe("FootageSearchController", () => {
  it("autoFill chọn kết quả đầu, ảnh trước, không dùng lại cùng một kết quả cho hai cảnh", async () => {
    const { ctrl, session } = setup(
      {
        police: { image: [item("a1"), item("a2")], video: [item("v1", "video")] },
        news: { image: [item("n1"), item("n2"), item("n3"), item("n4")] },
      },
      { "Công an": ["police"] },
    );
    await ctrl.autoFill();
    expect(uri(session, "s1")).toBe("f-n1");
    expect(uri(session, "s2")).toBe("f-a1");
    expect(uri(session, "s3")).toBe("f-n2");
    expect(uri(session, "s4")).toBe("f-n3");
    expect(ctrl.state.autoRunning).toBe(false);
    expect(ctrl.state.byScene.s2?.items.map((i) => i.id)).toEqual(["a1", "v1", "a2"]);
    expect(ctrl.state.byScene.s2?.query).toBe("police");
  });

  it("autoFill bỏ qua đoạn dùng tiếp cảnh đoạn trước (không cần cảnh riêng, không tìm)", async () => {
    const { ctrl, session } = setup({ news: { image: [item("n1"), item("n2"), item("n3"), item("n4")] } });
    session.update((d) => ({ ...d, options: d.options.withSceneContinued("s3", true) }));
    await ctrl.autoFill();
    expect(uri(session, "s1")).toBe("f-n1");
    expect(uri(session, "s2")).toBe("f-n2");
    expect(session.state.footage.get("s3")).toBeUndefined();
    expect(ctrl.state.byScene.s3).toBeUndefined();
    expect(uri(session, "s4")).toBe("f-n3");
  });

  it("cụm đầu không có kết quả thì thử cụm kế (cuối cùng là từ khoá chung của phong cách)", async () => {
    const { ctrl, session, calls } = setup({ news: { image: [item("n1")] } }, { "Công an": ["land"] });
    await ctrl.autoFill();
    expect(calls).toContain("image:land");
    expect(calls).toContain("video:land");
    expect(uri(session, "s2")).toBe("f-n1");
    expect(ctrl.state.byScene.s2?.query).toBe("news");
  });

  it("không tìm ra gì thì cảnh để trống và đánh dấu empty", async () => {
    const { ctrl, session } = setup({});
    await ctrl.autoFill();
    expect(session.state.footage.sceneIds()).toEqual([]);
    expect(ctrl.state.byScene.s2?.empty).toBe(true);
  });

  it("chỉ tìm cho cảnh chưa có cảnh trám", async () => {
    const { ctrl, session, calls } = setup({ news: { image: [item("n1"), item("n2")] } });
    session.update((d) => ({ ...d, footage: d.footage.assign("s2", new FallbackFootage("keep")) }));
    await ctrl.autoFill();
    expect(session.state.footage.get("s2")?.id).toBe("keep");
    expect(calls.filter((c) => c === "image:news")).toHaveLength(3); // s1, s3, s4
  });

  it("một nguồn lỗi (video) vẫn dùng kết quả của nguồn kia", async () => {
    const { ctrl, session } = setup({ news: { image: [item("n1")], failKind: "video" } });
    await ctrl.autoFill();
    expect(uri(session, "s1")).toBe("f-n1");
    expect(ctrl.state.byScene.s1?.error).toBeNull();
  });

  it("lỗi một cảnh không dừng các cảnh khác", async () => {
    const { ctrl, session } = setup({ news: { image: [item("n1"), item("n2"), item("n3")] } }, { "Công an": ["boom"] });
    await ctrl.autoFill();
    expect(ctrl.state.byScene.s2?.error).toBe("Hết lượt tìm kiếm hôm nay");
    expect(session.state.footage.get("s2")).toBeUndefined();
    expect(session.state.footage.get("s3")).toBeDefined();
  });

  it("cảnh báo của server được gom, không trùng", async () => {
    const { ctrl } = setup({ news: { image: [item("n1"), item("n2"), item("n3"), item("n4")], warnings: ["Pexels hết lượt"] } });
    await ctrl.autoFill();
    expect(ctrl.state.warnings).toEqual(["Pexels hết lượt"]);
  });

  it("hết phiên thì báo onAuthLost", async () => {
    const { ctrl, authLost } = setup({}, { "Công an": ["expired"] });
    await ctrl.autoFill();
    expect(authLost).toHaveBeenCalled();
  });

  it("search thủ công điền ứng viên; choose gán cảnh trám có nguồn và tác giả", async () => {
    const { ctrl, session } = setup({ "xe cứu hoả": { image: [item("x1")], video: [item("xv", "video")] } });
    await ctrl.search("s3", "  xe cứu hoả ");
    expect(ctrl.state.byScene.s3?.items.map((i) => i.id)).toEqual(["x1", "xv"]);
    expect(ctrl.state.byScene.s3?.query).toBe("xe cứu hoả");
    ctrl.choose("s3", ctrl.state.byScene.s3!.items[1]!);
    expect(session.state.footage.get("s3")?.snapshot()).toMatchObject({
      kind: "video",
      source: { origin: "fake", uri: "f-xv", credit: "Tác giả", pageUrl: "p-xv" },
      durationSec: 10,
    });
  });

  it("từ khoá trống thì báo lỗi, không gọi API", async () => {
    const { ctrl, calls } = setup({});
    await ctrl.search("s3", "   ");
    expect(ctrl.state.byScene.s3?.error).toBe("Hãy nhập từ khoá");
    expect(calls).toEqual([]);
  });

  it("cancel huỷ yêu cầu đang bay và không gán gì", async () => {
    const hook = (signal?: AbortSignal) =>
      new Promise<void>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    const { ctrl, session } = setup({ news: { image: [item("n1")] } }, {}, hook);
    const run = ctrl.autoFill();
    await Promise.resolve();
    ctrl.cancel();
    await run;
    expect(session.state.footage.sceneIds()).toEqual([]);
    expect(ctrl.state.autoRunning).toBe(false);
    expect(ctrl.state.byScene.s1?.error).toBeNull();
  });

  it("search thủ công trong lúc autoFill đang chạy cảnh đó: yêu cầu cũ bị huỷ không xoá loading của search, kết quả thủ công thắng", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const hook: Hook = (signal, query) => {
      if (query === "hang") {
        return new Promise<void>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }
      if (query === "manual") return gate;
      return Promise.resolve();
    };
    const { ctrl } = setup(
      { news: { image: [item("n1"), item("n2"), item("n3")] }, manual: { image: [item("m1")] } },
      { "Công an": ["hang"] },
      hook,
      { concurrency: 3 },
    );
    const run = ctrl.autoFill();
    await new Promise((r) => setTimeout(r, 0));
    const manual = ctrl.search("s2", "manual");
    await new Promise((r) => setTimeout(r, 0));
    expect(ctrl.state.byScene.s2?.loading).toBe(true);
    release();
    await manual;
    await run;
    expect(ctrl.state.byScene.s2).toMatchObject({ query: "manual", loading: false, error: null });
    expect(ctrl.state.byScene.s2?.items.map((i) => i.id)).toEqual(["m1"]);
  });

  it("lỗi ở templates.get của một cảnh chỉ báo ở cảnh đó, các cảnh khác vẫn điền, autoRunning tắt ở cuối", async () => {
    const real = defaultTemplateRegistry();
    let calls = 0;
    const templates = {
      get: (id: Parameters<typeof real.get>[0]) => {
        calls += 1;
        if (calls === 2) throw new Error("template hỏng");
        return real.get(id);
      },
    };
    const { ctrl, session } = setup({ news: { image: [item("n1"), item("n2"), item("n3")] } }, {}, undefined, {
      concurrency: 3,
      templates,
    });
    await ctrl.autoFill();
    const errored = Object.entries(ctrl.state.byScene).filter(([, v]) => v.error !== null);
    expect(errored).toHaveLength(1);
    expect(session.state.footage.sceneIds()).toHaveLength(3);
    expect(ctrl.state.autoRunning).toBe(false);
  });

  it("hết phiên với nhiều cảnh chạy song song chỉ báo onAuthLost đúng một lần", async () => {
    const { ctrl, authLost } = setup({}, { "": ["expired"] }, undefined, { concurrency: 3 });
    await ctrl.autoFill();
    expect(authLost).toHaveBeenCalledTimes(1);
  });

  it("nguồn ảnh hết lượt và nguồn video rỗng thì báo lỗi chứ không báo rỗng", async () => {
    const { ctrl } = setup({ news: { quotaKind: "image" } });
    await ctrl.autoFill();
    expect(ctrl.state.byScene.s1?.error).toBe("Hết lượt tìm kiếm hôm nay");
    expect(ctrl.state.byScene.s1?.empty).toBe(false);
  });

  it("một nguồn lỗi, nguồn kia có kết quả: dùng kết quả và thêm cảnh báo", async () => {
    const { ctrl } = setup({ news: { image: [item("n1")], failKind: "video" } });
    await ctrl.autoFill();
    expect(ctrl.state.byScene.s1?.items.map((i) => i.id)).toEqual(["n1"]);
    expect(ctrl.state.warnings).toContain("Một nguồn cảnh trám đang lỗi, chỉ dùng nguồn còn lại");
  });

  it("khi lỗi, query lưu đúng cụm đã lỗi", async () => {
    const { ctrl } = setup({}, { "Công an": ["land", "boom"] });
    await ctrl.autoFill();
    expect(ctrl.state.byScene.s2?.error).toBe("Hết lượt tìm kiếm hôm nay");
    expect(ctrl.state.byScene.s2?.query).toBe("boom");
  });

  describe("cảnh đang xếp hàng trong pool", () => {
    function queued() {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const hook: Hook = (_signal, query) => (query === "hang" ? gate : Promise.resolve());
      const made = setup(
        { news: { image: [item("n1"), item("n2"), item("n3"), item("n4")] }, manual: { image: [item("m1")] } },
        { "": ["hang"] },
        hook,
        { concurrency: 3 },
      );
      return { ...made, release };
    }

    it("search thủ công cảnh còn xếp hàng: kết quả thủ công thắng, autoFill không chạy cảnh đó", async () => {
      const { ctrl, calls, release } = queued();
      const run = ctrl.autoFill();
      await new Promise((r) => setTimeout(r, 0));
      await ctrl.search("s4", "manual");
      release();
      await run;
      expect(ctrl.state.byScene.s4).toMatchObject({ query: "manual", loading: false, error: null });
      expect(ctrl.state.byScene.s4?.items.map((i) => i.id)).toEqual(["m1"]);
      expect(calls.filter((c) => c === "image:hang")).toHaveLength(3);
    });

    it("choose thủ công cảnh còn xếp hàng: fillScene không gọi stock cho cảnh đó", async () => {
      const { ctrl, session, calls, release } = queued();
      const run = ctrl.autoFill();
      await new Promise((r) => setTimeout(r, 0));
      ctrl.choose("s4", item("hand"));
      release();
      await run;
      expect(uri(session, "s4")).toBe("f-hand");
      expect(calls.filter((c) => c === "image:hang")).toHaveLength(3);
      expect(calls.filter((c) => c === "image:news")).toHaveLength(3);
    });
  });

  it("cancel tắt loading của cảnh đang bay", async () => {
    const hook = (signal?: AbortSignal) =>
      new Promise<void>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    const { ctrl } = setup({ news: { image: [item("n1")] } }, {}, hook);
    const run = ctrl.autoFill();
    await Promise.resolve();
    expect(ctrl.state.byScene.s1?.loading).toBe(true);
    ctrl.cancel();
    expect(ctrl.state.byScene.s1?.loading).toBe(false);
    await run;
    expect(ctrl.state.byScene.s1?.loading).toBe(false);
  });

  it("search sau cancel không làm pool đã huỷ chạy tiếp", async () => {
    const hook: Hook = (signal, query) =>
      query === "hang"
        ? new Promise<void>((_resolve, reject) => {
            signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          })
        : Promise.resolve();
    const { ctrl, calls } = setup({ manual: { image: [item("m1")] }, news: { image: [item("n1")] } }, { "": ["hang"] }, hook);
    const run = ctrl.autoFill();
    await new Promise((r) => setTimeout(r, 0));
    ctrl.cancel();
    await run;
    await ctrl.search("s1", "manual");
    await new Promise((r) => setTimeout(r, 0));
    expect(ctrl.state.byScene.s1?.items.map((i) => i.id)).toEqual(["m1"]);
    expect(ctrl.state.byScene.s2).toBeUndefined();
    expect(ctrl.state.byScene.s3).toBeUndefined();
    expect(calls.filter((c) => c.endsWith(":hang"))).toHaveLength(2);
  });

  it("sau khi autoFill xong, search lại cùng cảnh chạy bình thường (không lỗi huỷ)", async () => {
    const { ctrl } = setup({ news: { image: [item("n1")] }, manual: { image: [item("m1")] } });
    await ctrl.autoFill();
    await ctrl.search("s1", "manual");
    expect(ctrl.state.byScene.s1).toMatchObject({ query: "manual", loading: false, error: null });
    expect(ctrl.state.byScene.s1?.items.map((i) => i.id)).toEqual(["m1"]);
  });

  it("templates.get ném lỗi: query lưu nội dung cảnh", async () => {
    const templates = {
      get: () => {
        throw new Error("template hỏng");
      },
    };
    const { ctrl } = setup({}, {}, undefined, { templates });
    await ctrl.autoFill();
    expect(ctrl.state.byScene.s2?.error).not.toBeNull();
    expect(ctrl.state.byScene.s2?.query).toBe("Công an vào cuộc.");
  });

  it("reset huỷ lượt tìm và xoá kết quả, cảnh báo của dự án cũ", async () => {
    const { ctrl } = setup({ news: { image: [item("n1")], warnings: ["Cảnh báo"] } });
    await ctrl.search("s2", "news");
    expect(Object.keys(ctrl.state.byScene)).toEqual(["s2"]);
    expect(ctrl.state.warnings).toEqual(["Cảnh báo"]);
    ctrl.reset();
    expect(ctrl.state.byScene).toEqual({});
    expect(ctrl.state.warnings).toEqual([]);
  });
});

describe("FootageSearchController — Ảnh/Video", () => {
  it("autoFill với ưu tiên video: chỉ tìm video khi có kết quả", async () => {
    const { ctrl, session, calls } = setup(
      {
        police: { image: [item("a1")], video: [item("v1", "video")] },
        news: { image: [item("n1")], video: [item("w1", "video"), item("w2", "video"), item("w3", "video")] },
      },
      { "Công an": ["police"] },
    );
    session.update((d) => ({ ...d, options: d.options.withFootageKind("video") }));
    await ctrl.autoFill();
    expect(calls.every((c) => c.startsWith("video:"))).toBe(true);
    expect(uri(session, "s1")).toBe("f-w1");
    expect(uri(session, "s2")).toBe("f-v1");
    expect(uri(session, "s3")).toBe("f-w2");
    expect(uri(session, "s4")).toBe("f-w3");
  });

  it("autoFill với ưu tiên video mà không có video: lùi về ảnh", async () => {
    const { ctrl, session, calls } = setup({ news: { image: [item("n1"), item("n2"), item("n3"), item("n4")] } });
    session.update((d) => ({ ...d, options: d.options.withFootageKind("video") }));
    await ctrl.autoFill();
    expect(calls.slice(0, 2)).toEqual(["video:news", "image:news"]);
    expect(uri(session, "s1")).toBe("f-n1");
    expect(uri(session, "s4")).toBe("f-n4");
  });

  it("autoFill: cảnh có lựa chọn riêng thì chỉ tìm loại đó, không lùi", async () => {
    const { ctrl, session, calls } = setup(
      {
        police: { image: [item("a1")], video: [item("v1", "video")] },
        news: { image: [item("n1"), item("n2"), item("n3")], video: [item("w1", "video"), item("w2", "video"), item("w3", "video")] },
      },
      { "Công an": ["police"] },
    );
    session.update((d) => ({ ...d, options: d.options.withFootageKind("video").withSceneFootageKind("s2", "image") }));
    await ctrl.autoFill();
    expect(calls).toContain("image:police");
    expect(calls).not.toContain("video:police");
    expect(uri(session, "s2")).toBe("f-a1");
  });

  it("search theo loại riêng của cảnh: chỉ gọi một loại; không có loại riêng thì tìm cả hai như cũ", async () => {
    const { ctrl, session, calls } = setup({ boat: { image: [item("b1")], video: [item("bv1", "video")] } });
    session.update((d) => ({ ...d, options: d.options.withFootageKind("image").withSceneFootageKind("s3", "video") }));
    await ctrl.search("s3", "boat");
    expect(calls).toEqual(["video:boat"]);
    expect(ctrl.state.byScene.s3?.items.map((i) => i.id)).toEqual(["bv1"]);
    calls.length = 0;
    await ctrl.search("s4", "boat");
    expect([...calls].sort()).toEqual(["image:boat", "video:boat"]);
  });

  it("setSceneKind nhớ loại của cảnh trong session và tìm lại bằng từ khoá đang có; null là bỏ", async () => {
    const { ctrl, session, calls } = setup({ boat: { image: [item("b1")], video: [item("bv1", "video")] } });
    await ctrl.search("s3", "boat");
    expect(ctrl.state.byScene.s3?.items.map((i) => i.id)).toEqual(["b1", "bv1"]);
    calls.length = 0;
    await ctrl.setSceneKind("s3", "video");
    expect(session.state.options.sceneFootageKind("s3")).toBe("video");
    expect(calls).toEqual(["video:boat"]);
    expect(ctrl.state.byScene.s3?.items.map((i) => i.id)).toEqual(["bv1"]);
    calls.length = 0;
    await ctrl.setSceneKind("s3", null);
    expect(session.state.options.sceneFootageKind("s3")).toBeNull();
    expect([...calls].sort()).toEqual(["image:boat", "video:boat"]);
  });

  it("setSceneKind khi cảnh chưa có từ khoá: dùng gợi ý từ câu (cuối cùng là từ khoá chung)", async () => {
    const { ctrl, calls } = setup({});
    await ctrl.setSceneKind("s4", "image");
    expect(calls).toEqual(["image:news"]);
    expect(ctrl.state.byScene.s4?.empty).toBe(true);
  });
});
