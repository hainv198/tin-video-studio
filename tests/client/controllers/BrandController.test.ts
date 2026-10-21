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

describe("BrandController — banner chân", () => {
  function bannerSetup(size = { width: 2048, height: 682 }) {
    const { session } = makeSession();
    const brands = new BrandRepository(new MemoryKeyValueStore());
    const measured: Blob[] = [];
    const ctrl = new BrandController({
      session,
      templates: defaultTemplateRegistry(),
      brands,
      measureImage: async (blob) => {
        measured.push(blob);
        return size;
      },
    });
    return { session, brands, ctrl, measured };
  }
  const png = (bytes = 10, name = "banner.png") => new File([new Uint8Array(bytes)], name, { type: "image/png" });

  it("chưa lưu thương hiệu riêng: mượn tên kênh, màu, logo của theanh28; chưa có banner; trạng thái chưa lưu", async () => {
    const { ctrl, brands, session } = bannerSetup();
    const logo = new Blob(["logo"]);
    await brands.save("theanh28", { channelName: "KÊNH GỐC", primaryColor: "#112233" }, logo);
    await ctrl.load("theanh28-banner");
    expect(ctrl.state.values.channelName).toBe("KÊNH GỐC");
    expect(ctrl.state.values.primaryColor).toBe("#112233");
    expect(ctrl.state.logo?.size).toBe(logo.size); // kho dùng structuredClone nên Blob đọc ra là bản sao, không so theo định danh
    expect(ctrl.state.banner).toBeUndefined();
    expect(ctrl.state.saved).toBe(false);
    expect(session.state.brand.values.channelName).toBe("KÊNH GỐC");
    expect(session.state.brand.logo?.size).toBe(logo.size);
    expect("banner" in session.state.brand).toBe(false);
  });

  it("đã lưu riêng thì dùng bản riêng (kể cả banner), không mượn", async () => {
    const { ctrl, brands, session } = bannerSetup();
    const banner = new Blob(["b"]);
    await brands.save("theanh28", { channelName: "KÊNH GỐC" }, null);
    await brands.save("theanh28-banner", { channelName: "KÊNH RIÊNG" }, null, banner);
    await ctrl.load("theanh28-banner");
    expect(ctrl.state.values.channelName).toBe("KÊNH RIÊNG");
    expect(ctrl.state.banner?.size).toBe(banner.size);
    expect(ctrl.state.saved).toBe(true);
    expect(session.state.brand.banner?.size).toBe(banner.size);
  });

  it("setBanner hợp lệ: đo kích thước, vào session; lưu thì kho có banner; clearBanner về mặc định", async () => {
    const { ctrl, brands, session, measured } = bannerSetup();
    await ctrl.load("theanh28-banner");
    const file = png();
    await ctrl.setBanner(file);
    expect(measured).toEqual([file]);
    expect(ctrl.state.error).toBeNull();
    expect(ctrl.state.banner).toBe(file);
    expect(session.state.brand.banner).toBe(file);
    expect(await ctrl.save()).toBe(true);
    expect((await brands.load("theanh28-banner"))?.banner?.size).toBe(10);
    ctrl.clearBanner();
    expect(ctrl.state.banner).toBeUndefined();
    expect(session.state.brand.banner).toBeUndefined();
    expect(ctrl.state.saved).toBe(false);
  });

  it("banner sai tỉ lệ, quá lớn, sai định dạng, hoặc không đọc được thì báo lỗi và giữ banner cũ", async () => {
    const square = bannerSetup({ width: 800, height: 800 });
    await square.ctrl.load("theanh28-banner");
    await square.ctrl.setBanner(png());
    expect(square.ctrl.state.error).toBe(
      "Banner phải là ảnh ngang, tỉ lệ rộng/cao từ 2 đến 5 (ảnh này 1,00). Khuyên dùng 3:1, ví dụ 2048×682.",
    );
    expect(square.ctrl.state.banner).toBeUndefined();

    const ok = bannerSetup();
    await ok.ctrl.load("theanh28-banner");
    await ok.ctrl.setBanner(png(5 * 1024 * 1024 + 1));
    expect(ok.ctrl.state.error).toBe("Banner tối đa 5 MB");
    await ok.ctrl.setBanner(new File(["x"], "a.mp4", { type: "video/mp4" }));
    expect(ok.ctrl.state.error).toBe("Không nhận file video ở đây");
    expect(ok.measured).toHaveLength(0);

    const { session } = makeSession();
    const broken = new BrandController({
      session,
      templates: defaultTemplateRegistry(),
      brands: new BrandRepository(new MemoryKeyValueStore()),
      measureImage: async () => {
        throw new Error("decode");
      },
    });
    await broken.load("theanh28-banner");
    await broken.setBanner(png());
    expect(broken.state.error).toBe("Không đọc được ảnh banner");
    expect(broken.state.banner).toBeUndefined();
  });
});
