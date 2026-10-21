import { describe, expect, it } from "vitest";
import { NewsProject, type NewsProjectInput, type NewsProjectSnapshot } from "@/domain/NewsProject";
import { SentenceSplitter } from "@/domain/SentenceSplitter";
import { sequentialIds } from "@/domain/ids";
import { NotFoundError, ValidationError } from "@/domain/errors";

const TEXT =
  "Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã vì lạm quyền.\n" +
  "Ngày 14 tháng 10, Công an tỉnh Phú Thọ cho biết đã khởi tố bị can. " +
  "Tổng số tiền thu được là hơn 545 triệu đồng.";

function make(overrides: Partial<NewsProjectInput> = {}) {
  return NewsProject.fromText(
    {
      text: TEXT,
      sourceCredit: " Đức Phong - VietNamNet ",
      publishDate: new Date(2026, 9, 14),
      templateId: "theanh28",
      ...overrides,
    },
    new SentenceSplitter(),
    sequentialIds("s"),
  );
}

describe("NewsProject.fromText", () => {
  it("câu đầu thành cảnh mở đầu khi không nhập tiêu đề", () => {
    const p = make();
    expect(p.scenes.map((s) => s.role)).toEqual(["intro", "body", "body"]);
    expect(p.introScene.text).toBe("Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã vì lạm quyền.");
    expect(p.title).toBe(p.introScene.text);
    expect(p.bodyScenes).toHaveLength(2);
    expect(p.scenes.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(p.sourceCredit).toBe("Đức Phong - VietNamNet");
  });

  it("tiêu đề nhập tay trùng câu đầu (khác dấu chấm, hoa thường) thì không lặp", () => {
    const p = make({ title: "phú thọ: khởi tố nguyên chủ tịch UBND xã vì lạm quyền" });
    expect(p.scenes).toHaveLength(3);
    expect(p.introScene.text).toBe("phú thọ: khởi tố nguyên chủ tịch UBND xã vì lạm quyền");
  });

  it("tiêu đề nhập tay khác câu đầu thì mọi câu thành thân bài", () => {
    const p = make({ title: "Khởi tố cựu chủ tịch xã bán trụ sở" });
    expect(p.scenes).toHaveLength(4);
    expect(p.bodyScenes[0]?.text).toBe("Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã vì lạm quyền.");
  });

  it("báo lỗi khi không có nội dung", () => {
    expect(() => make({ text: "  " })).toThrow(ValidationError);
  });

  it("báo lỗi khi chỉ có tiêu đề, không có thân bài", () => {
    expect(() => make({ text: "Chỉ một câu." })).toThrow("Tin cần ít nhất một câu ngoài tiêu đề");
  });

  it("báo lỗi khi thiếu phong cách", () => {
    expect(() => make({ templateId: "" })).toThrow(ValidationError);
  });
});

describe("NewsProject chỉnh sửa", () => {
  it("displayTitle bỏ dấu câu cuối", () => {
    expect(make().displayTitle).toBe("Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã vì lạm quyền");
  });

  it("formattedPublishDate dạng dd/mm/yyyy", () => {
    expect(make().formattedPublishDate()).toBe("14/10/2026");
  });

  it("sửa cảnh mở đầu thì đổi luôn tiêu đề, bản cũ giữ nguyên", () => {
    const p = make();
    const q = p.updateSceneText("s1", "Tiêu đề mới.");
    expect(q.title).toBe("Tiêu đề mới.");
    expect(p.title).not.toBe("Tiêu đề mới.");
  });

  it("gộp cảnh thân bài với cảnh sau", () => {
    const q = make().mergeWithNext("s2");
    expect(q.bodyScenes).toHaveLength(1);
    expect(q.bodyScenes[0]?.text).toBe(
      "Ngày 14 tháng 10, Công an tỉnh Phú Thọ cho biết đã khởi tố bị can. Tổng số tiền thu được là hơn 545 triệu đồng.",
    );
  });

  it("không gộp cảnh mở đầu hoặc cảnh cuối", () => {
    expect(() => make().mergeWithNext("s1")).toThrow(ValidationError);
    expect(() => make().mergeWithNext("s3")).toThrow(ValidationError);
  });

  it("tách cảnh thân bài tại vị trí ký tự, phần sau nhận id mới", () => {
    const q = make().splitScene("s3", 25);
    expect(q.bodyScenes.map((s) => s.text)).toEqual([
      "Ngày 14 tháng 10, Công an tỉnh Phú Thọ cho biết đã khởi tố bị can.",
      "Tổng số tiền thu được là",
      "hơn 545 triệu đồng.",
    ]);
    expect(q.bodyScenes[2]?.id).toBe("s4");
  });

  it("không tách thành phần rỗng", () => {
    expect(() => make().splitScene("s3", 0)).toThrow(ValidationError);
  });

  it("sceneById báo NotFoundError khi không có", () => {
    expect(() => make().sceneById("zz")).toThrow(NotFoundError);
  });

  it("withMeta đổi nguồn tin, ngày, phong cách", () => {
    const q = make().withMeta({ sourceCredit: "VnExpress", publishDate: new Date(2026, 0, 2), templateId: "khac" });
    expect(q.sourceCredit).toBe("VnExpress");
    expect(q.formattedPublishDate()).toBe("02/01/2026");
    expect(q.templateId).toBe("khac");
  });

  it("totalChars cộng độ dài mọi cảnh", () => {
    const p = make();
    expect(p.totalChars).toBe(p.scenes.reduce((n, s) => n + s.text.length, 0));
  });
});

describe("NewsProject kiểm dữ liệu vào", () => {
  it("chặn ngày đăng không hợp lệ", () => {
    expect(() => make({ publishDate: new Date(Number.NaN) })).toThrow("Ngày đăng không hợp lệ");
    expect(() => make().withMeta({ publishDate: new Date("rác") })).toThrow("Ngày đăng không hợp lệ");
  });

  it("chặn nguồn tin quá 80 ký tự, nhận đúng 80", () => {
    expect(() => make({ sourceCredit: "x".repeat(81) })).toThrow("Nguồn tin tối đa 80 ký tự");
    expect(make({ sourceCredit: "x".repeat(80) }).sourceCredit).toHaveLength(80);
    expect(() => make().withMeta({ sourceCredit: "y".repeat(81) })).toThrow("Nguồn tin tối đa 80 ký tự");
  });
});

describe("NewsProject snapshot / restore", () => {
  it("snapshot là dữ liệu thuần, ngày dạng yyyy-mm-dd theo giờ địa phương", () => {
    const s = make().snapshot();
    expect(s).toMatchObject({
      sourceCredit: "Đức Phong - VietNamNet",
      publishDate: "2026-10-14",
      templateId: "theanh28",
    });
    expect(s.scenes.map((x) => [x.id, x.role])).toEqual([
      ["s1", "intro"],
      ["s2", "body"],
      ["s3", "body"],
    ]);
    expect(s.title).toBe(s.scenes[0]?.text);
    expect(structuredClone(s)).toEqual(s);
  });

  it("restore dựng lại đúng dự án và dùng tiếp được (gộp, tách cảnh với bộ sinh id mới)", () => {
    const original = make();
    const restored = NewsProject.restore(structuredClone(original.snapshot()), sequentialIds("n"));
    expect(restored.snapshot()).toEqual(original.snapshot());
    expect(restored.formattedPublishDate()).toBe("14/10/2026");
    expect(restored.mergeWithNext("s2").bodyScenes).toHaveLength(1);
    expect(restored.splitScene("s3", 5).scenes.map((s) => s.id)).toContain("n1");
  });

  it("bản nháp hỏng thì ném ValidationError", () => {
    const good = make().snapshot();
    const bad = (patch: Partial<NewsProjectSnapshot>) => () => NewsProject.restore({ ...good, ...patch }, sequentialIds("n"));
    expect(bad({ publishDate: "2026-13-40" })).toThrow("Ngày đăng không hợp lệ");
    expect(bad({ publishDate: "14/10/2026" })).toThrow("Ngày đăng không hợp lệ");
    expect(bad({ scenes: [] })).toThrow("Bản nháp hỏng");
    expect(bad({ scenes: good.scenes.map((s) => ({ ...s, role: "body" as const })) })).toThrow("Bản nháp hỏng");
    expect(bad({ scenes: [{ id: "x", text: "  ", role: "intro" }, ...good.scenes.slice(1)] })).toThrow(ValidationError);
    expect(bad({ templateId: "" })).toThrow("Chưa chọn phong cách video");
    expect(bad({ sourceCredit: "z".repeat(81) })).toThrow("Nguồn tin tối đa 80 ký tự");
  });
});

describe("NewsProject restore: dữ liệu hỏng không rõ kiểu", () => {
  const good = () => make().snapshot();
  const bad = (patch: Record<string, unknown>) => () =>
    NewsProject.restore({ ...good(), ...patch } as unknown as NewsProjectSnapshot, sequentialIds("n"));

  it("chặn tiêu đề rỗng hoặc không phải chuỗi", () => {
    expect(bad({ title: "" })).toThrow("Bản nháp hỏng");
    expect(bad({ title: "   " })).toThrow("Bản nháp hỏng");
    expect(bad({ title: 5 })).toThrow("Bản nháp hỏng");
    expect(bad({ title: undefined })).toThrow(ValidationError);
  });

  it("chặn id cảnh trùng nhau", () => {
    const g = good();
    const dup = [g.scenes[0], g.scenes[1], { ...(g.scenes[2] as object), id: g.scenes[1]?.id }];
    expect(bad({ scenes: dup })).toThrow("Bản nháp hỏng");
  });

  it("chặn scenes không phải mảng", () => {
    expect(bad({ scenes: "abc" })).toThrow("Bản nháp hỏng");
    expect(bad({ scenes: null })).toThrow(ValidationError);
    expect(bad({ scenes: undefined })).toThrow(ValidationError);
  });

  it("chặn sourceCredit có mặt nhưng không phải chuỗi", () => {
    expect(bad({ sourceCredit: 123 })).toThrow("Bản nháp hỏng");
    expect(bad({ sourceCredit: null })).toThrow(ValidationError);
  });

  it("chặn phần tử cảnh không phải đối tượng", () => {
    const g = good();
    expect(bad({ scenes: [g.scenes[0], null, g.scenes[2]] })).toThrow("Bản nháp hỏng");
    expect(bad({ scenes: [g.scenes[0], "x", g.scenes[2]] })).toThrow(ValidationError);
    expect(bad({ scenes: [g.scenes[0], { id: 1, text: 2, role: "body" }] })).toThrow(ValidationError);
  });

  it("chặn snapshot không phải đối tượng", () => {
    expect(() => NewsProject.restore(null as never, sequentialIds("n"))).toThrow(ValidationError);
  });

  it("snapshot là bản sao sâu, sửa snapshot không đổi dự án", () => {
    const p = make();
    const before = p.scenes[1]?.text;
    const s = p.snapshot();
    (s.scenes[1] as { text: string }).text = "đã sửa";
    s.publishDate = "1999-01-01";
    expect(p.scenes[1]?.text).toBe(before);
    expect(p.formattedPublishDate()).toBe("14/10/2026");
  });
});

describe("NewsProject restore: bộ sinh id không đụng id đã có", () => {
  it("splitScene sau restore với sequentialIds cùng tiền tố cho id duy nhất", () => {
    const restored = NewsProject.restore(structuredClone(make().snapshot()), sequentialIds("s"));
    const ids = restored.splitScene("s3", 5).scenes.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(4);
  });
});

describe("NewsProject — kiểu Video tải lên", () => {
  const input = { title: "  Clip   hiện trường vụ cháy  ", sourceCredit: "Báo A", publishDate: new Date(2026, 9, 21), templateId: "theanh28" };

  it("titleOnly: đúng một cảnh mở đầu, kind upload", () => {
    const p = NewsProject.titleOnly(input, sequentialIds("s"));
    expect(p.kind).toBe("upload");
    expect(p.scenes.map((s) => [s.id, s.role, s.text])).toEqual([["s1", "intro", "Clip hiện trường vụ cháy"]]);
    expect(p.title).toBe("Clip hiện trường vụ cháy");
    expect(p.bodyScenes).toEqual([]);
  });

  it("titleOnly: thiếu tiêu đề / phong cách / ngày sai thì ném", () => {
    expect(() => NewsProject.titleOnly({ ...input, title: " " }, sequentialIds("s"))).toThrow("Chưa có tiêu đề video");
    expect(() => NewsProject.titleOnly({ ...input, templateId: "" }, sequentialIds("s"))).toThrow("Chưa chọn phong cách video");
    expect(() => NewsProject.titleOnly({ ...input, publishDate: new Date(Number.NaN) }, sequentialIds("s"))).toThrow("Ngày đăng không hợp lệ");
  });

  it("sửa tiêu đề qua cảnh mở đầu, withMeta giữ kind; không tách/gộp được", () => {
    const p = NewsProject.titleOnly(input, sequentialIds("s"));
    const edited = p.updateSceneText("s1", "Tiêu đề mới").withMeta({ sourceCredit: "Báo B" });
    expect(edited.kind).toBe("upload");
    expect(edited.title).toBe("Tiêu đề mới");
    expect(() => p.splitScene("s1", 3)).toThrow("Không tách được cảnh mở đầu");
    expect(() => p.mergeWithNext("s1")).toThrow("Không gộp được cảnh mở đầu");
  });

  it("snapshot: kiểu upload có khoá kind; kiểu tin KHÔNG có khoá kind", () => {
    const up = NewsProject.titleOnly(input, sequentialIds("s"));
    expect(up.snapshot().kind).toBe("upload");
    const news = NewsProject.fromText({ ...input, text: "Câu một. Câu hai." }, new SentenceSplitter(), sequentialIds("n"));
    expect(news.kind).toBe("news");
    expect("kind" in news.snapshot()).toBe(false);
  });

  it("restore: khứ hồi upload; thiếu kind = news; cấu trúc sai theo kiểu thì ném", () => {
    const up = NewsProject.titleOnly(input, sequentialIds("s"));
    const back = NewsProject.restore(up.snapshot(), sequentialIds("x"));
    expect(back.kind).toBe("upload");
    expect(back.snapshot()).toEqual(up.snapshot());
    const twoScenes = { ...up.snapshot(), scenes: [...up.snapshot().scenes, { id: "s2", text: "Thân bài", role: "body" as const }] };
    expect(() => NewsProject.restore(twoScenes, sequentialIds("x"))).toThrow("Bản nháp hỏng: cấu trúc cảnh không hợp lệ");
    const { kind: _k, ...asNews } = up.snapshot();
    expect(() => NewsProject.restore(asNews, sequentialIds("x"))).toThrow("Bản nháp hỏng: cấu trúc cảnh không hợp lệ");
    expect(() => NewsProject.restore({ ...up.snapshot(), kind: "khac" as never }, sequentialIds("x"))).toThrow(
      "Bản nháp hỏng: kiểu video không hợp lệ",
    );
  });
});
