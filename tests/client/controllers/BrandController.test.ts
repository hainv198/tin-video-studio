import { describe, expect, it } from "vitest";
import { BrandController } from "@/client/controllers/BrandController";
import { BrandRepository } from "@/client/storage/BrandRepository";
import { MemoryKeyValueStore } from "@/client/storage/KeyValueStore";
import { defaultTemplateRegistry } from "@/templates/registry";
import { makeSession } from "../../helpers/studioFixtures";

function setup() {
  const { session } = makeSession();
  const store = new MemoryKeyValueStore();
  const brands = new BrandRepository(store);
  const ctrl = new BrandController({ session, templates: defaultTemplateRegistry(), brands });
  return { session, brands, ctrl };
}

describe("BrandController", () => {
  it("load lần đầu dùng giá trị mặc định của phong cách và đưa vào session", async () => {
    const { ctrl, session } = setup();
    await ctrl.load("theanh28");
    expect(ctrl.state.values.channelName).toBe("TIN NHANH");
    expect(ctrl.state.specs.map((s) => s.key)).toEqual(["channelName", "primaryColor", "logo", "titleFontPx"]);
    expect(session.state.brand.values.channelName).toBe("TIN NHANH");
    expect(session.state.brand.logo).toBeNull();
  });

  it("setValue hợp lệ cập nhật session; không hợp lệ chỉ báo lỗi", async () => {
    const { ctrl, session } = setup();
    await ctrl.load("theanh28");
    ctrl.setValue("channelName", "KÊNH CỦA HẢI");
    expect(session.state.brand.values.channelName).toBe("KÊNH CỦA HẢI");
    expect(ctrl.state.error).toBeNull();
    ctrl.setValue("primaryColor", "xanh");
    expect(ctrl.state.error).toBe("Màu chủ đạo phải có dạng #RRGGBB");
    expect(session.state.brand.values.primaryColor).not.toBe("xanh");
    ctrl.setValue("channelName", "x".repeat(25));
    expect(ctrl.state.error).toBe("Tên kênh tối đa 24 ký tự");
  });

  it("save lưu vào kho; mở lại thấy đúng giá trị và logo", async () => {
    const first = setup();
    await first.ctrl.load("theanh28");
    first.ctrl.setValue("channelName", "KÊNH A");
    first.ctrl.setLogo(new File([new Uint8Array(10)], "logo.png", { type: "image/png" }));
    expect(await first.ctrl.save()).toBe(true);
    expect(first.ctrl.state.saved).toBe(true);
    const stored = await first.brands.load("theanh28");
    expect(stored?.values.channelName).toBe("KÊNH A");
    expect(stored?.logo?.size).toBe(10);

    const second = setup();
    await second.brands.save("theanh28", { channelName: "KÊNH B" }, null);
    await second.ctrl.load("theanh28");
    expect(second.ctrl.state.values.channelName).toBe("KÊNH B");
  });

  it("logo sai định dạng hoặc quá 5 MB bị từ chối", async () => {
    const { ctrl } = setup();
    await ctrl.load("theanh28");
    ctrl.setLogo(new File(["x"], "a.mp4", { type: "video/mp4" }));
    expect(ctrl.state.error).toBe("Không nhận file video ở đây");
    ctrl.setLogo(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "l.png", { type: "image/png" }));
    expect(ctrl.state.error).toBe("Logo tối đa 5 MB");
    expect(ctrl.state.logo).toBeNull();
  });

  it("clearLogo bỏ logo khỏi trạng thái và session", async () => {
    const { ctrl, session } = setup();
    await ctrl.load("theanh28");
    ctrl.setLogo(new File([new Uint8Array(4)], "l.png", { type: "image/png" }));
    expect(session.state.brand.logo).not.toBeNull();
    ctrl.clearLogo();
    expect(ctrl.state.logo).toBeNull();
    expect(session.state.brand.logo).toBeNull();
  });

  it("load: giá trị đã lưu sai quy tắc → panel giữ giá trị và báo lỗi, session nhận mặc định", async () => {
    const { ctrl, session, brands } = setup();
    await brands.save("theanh28", { primaryColor: "xanh" }, null);
    await ctrl.load("theanh28");
    expect(ctrl.state.error).toBe("Màu chủ đạo phải có dạng #RRGGBB");
    expect(ctrl.state.values.primaryColor).toBe("xanh");
    const spec = ctrl.state.specs.find((s) => s.key === "primaryColor");
    expect(session.state.brand.values.primaryColor).toBe(spec?.defaultValue);
    expect(session.state.brand.logo).toBeNull();
  });

  it("load: phong cách không tồn tại → trạng thái rỗng kèm lỗi, session rỗng", async () => {
    const { ctrl, session } = setup();
    await ctrl.load("theanh28");
    await ctrl.load("khong-co");
    expect(ctrl.state).toEqual({
      templateId: "khong-co",
      specs: [],
      values: {},
      logo: null,
      error: "Không có phong cách khong-co",
      saved: false,
    });
    expect(session.state.brand).toEqual({ values: {}, logo: null });
  });

  it("load chồng nhau: kết quả của lần gọi cũ bị bỏ", async () => {
    const { session } = makeSession();
    type Stored = NonNullable<Awaited<ReturnType<BrandRepository["load"]>>>;
    const stored = (name: string): Stored => ({ values: { channelName: name }, logo: null, updatedAt: "" });
    let release!: (v: Stored) => void;
    const slow = new Promise<Stored>((r) => (release = r));
    let call = 0;
    const brands = {
      load: () => (++call === 1 ? slow : Promise.resolve(stored("B"))),
      save: async () => undefined,
    };
    const ctrl = new BrandController({ session, templates: defaultTemplateRegistry(), brands });
    const first = ctrl.load("theanh28");
    const second = ctrl.load("theanh28");
    await second;
    release(stored("A"));
    await first;
    expect(ctrl.state.values.channelName).toBe("B");
    expect(session.state.brand.values.channelName).toBe("B");
  });

  it("load lại cùng phong cách giữ chỉnh sửa chưa lưu", async () => {
    const { ctrl, session } = setup();
    await ctrl.load("theanh28");
    ctrl.setValue("channelName", "KÊNH X");
    await ctrl.load("theanh28");
    expect(ctrl.state.values.channelName).toBe("KÊNH X");
    expect(session.state.brand.values.channelName).toBe("KÊNH X");
  });

  it("logo 21 MB nhận thông báo logo, file rỗng vẫn báo File rỗng", async () => {
    const { ctrl } = setup();
    await ctrl.load("theanh28");
    ctrl.setLogo(new File([new Uint8Array(21 * 1024 * 1024)], "l.png", { type: "image/png" }));
    expect(ctrl.state.error).toBe("Logo tối đa 5 MB");
    ctrl.setLogo(new File([], "l.png", { type: "image/png" }));
    expect(ctrl.state.error).toBe("File rỗng");
  });

  it("saved về false khi giá trị không hợp lệ", async () => {
    const { ctrl } = setup();
    await ctrl.load("theanh28");
    ctrl.setValue("channelName", "A");
    await ctrl.save();
    expect(ctrl.state.saved).toBe(true);
    ctrl.setValue("primaryColor", "xanh");
    expect(ctrl.state.saved).toBe(false);
  });
});
