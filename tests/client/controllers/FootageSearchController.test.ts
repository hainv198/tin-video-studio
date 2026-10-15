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

type Plan = Record<string, { image?: StockItemDto[]; video?: StockItemDto[]; warnings?: string[]; failKind?: "image" | "video" }>;

function fakeStock(plan: Plan, onCall?: (signal?: AbortSignal) => Promise<void>) {
  const calls: string[] = [];
  const stock: StockApi = {
    search: async (query, kind, options): Promise<StockSearchResponse> => {
      calls.push(`${kind}:${query}`);
      await onCall?.(options?.signal);
      if (query === "boom") throw new ApiError(429, "QUOTA", "Hết lượt tìm kiếm hôm nay");
      if (query === "expired") throw new ApiError(401, "AUTH", "Chưa đăng nhập");
      const p = plan[query];
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

function setup(plan: Plan, rules: Record<string, string[]> = {}, hook?: (s?: AbortSignal) => Promise<void>) {
  const made = makeSessionWithProject(3); // s1 mở đầu, s2, s3, s4
  made.session.update((d) => ({ ...d, project: d.project!.updateSceneText("s2", "Công an vào cuộc.") }));
  const { stock, calls } = fakeStock(plan, hook);
  const authLost = vi.fn();
  const ctrl = new FootageSearchController({
    session: made.session,
    stock,
    keywords: keywords(rules),
    templates: defaultTemplateRegistry(),
    ids: sequentialIds("f"),
    concurrency: 1,
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
});
