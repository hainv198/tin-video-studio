import { describe, expect, it } from "vitest";
import newsKeywords from "@/data/news-keywords.json";
import { defaultKeywordSuggester, KeywordSuggester, type KeywordEntry } from "@/client/services/KeywordSuggester";

const small: KeywordEntry[] = [
  { vi: ["giao thông"], en: "traffic" },
  { vi: ["tai nạn giao thông", "tai nạn"], en: "car accident" },
  { vi: ["công an"], en: "police" },
  { vi: ["bắt giữ"], en: "handcuffs" },
  { vi: ["đất"], en: "land plot" },
  { vi: ["chợ"], en: "market shopping" },
  { vi: ["pin"], en: "solar panels" },
];

describe("KeywordSuggester — thuật toán", () => {
  const s = new KeywordSuggester(small);

  it("cụm dài giành vùng trước: 'tai nạn giao thông' không kéo thêm 'giao thông'", () => {
    expect(s.suggest("Xảy ra tai nạn giao thông nghiêm trọng")).toEqual(["car accident"]);
  });

  it("xếp theo tổng độ dài cụm khớp rồi theo vị trí xuất hiện", () => {
    expect(s.suggest("Công an bắt giữ đối tượng trên đất")).toEqual(["police", "handcuffs", "land plot"]);
    // "đất" xuất hiện 3 lần (tổng 9) thắng "công an" (7) dù "công an" xuất hiện sau
    expect(s.suggest("Bán đất, bán đất, bán đất, rồi công an đến")).toEqual(["land plot", "police"]);
    // cùng tổng 7: "công an" đứng trước nên xếp trước
    expect(s.suggest("Công an bắt giữ")).toEqual(["police", "handcuffs"]);
  });

  it("chỉ khớp ở ranh giới từ", () => {
    expect(s.suggest("Nhiều pinned notes được ghim")).toEqual(["news"]); // "pin" nằm trong "pinned": không phải ranh giới từ
    expect(s.suggest("Thay pin mới, bán đất")).toEqual(["solar panels", "land plot"]);
  });

  it("giữ nguyên dấu: 'chợ' không bị nhầm với 'cho'", () => {
    expect(s.suggest("Ông ấy cho biết sẽ đến")).toEqual(["news"]);
    expect(s.suggest("Ra chợ mua rau")).toEqual(["market shopping"]);
  });

  it("không phân biệt hoa thường", () => {
    expect(s.suggest("CÔNG AN vào cuộc")).toEqual(["police"]);
  });

  it("câu gõ không dấu thì khớp theo bản bỏ dấu, bỏ qua cụm ngắn dưới 4 ký tự", () => {
    expect(s.suggest("cong an bat giu doi tuong")).toEqual(["police", "handcuffs"]);
    expect(s.suggest("cho biet se den cho")).toEqual(["news"]); // "cho" (3 ký tự) bị bỏ qua
  });

  it("giới hạn số từ khoá và đổi được từ khoá dự phòng", () => {
    expect(s.suggest("Công an bắt giữ đối tượng trên đất", 2)).toEqual(["police", "handcuffs"]);
    expect(new KeywordSuggester(small, "city aerial").suggest("Chẳng có gì khớp")).toEqual(["city aerial"]);
    expect(s.suggest("")).toEqual(["news"]);
  });
});

describe("KeywordSuggester — từ điển thật (src/data/news-keywords.json)", () => {
  const real = defaultKeywordSuggester();

  it("tin Phú Thọ: cụm 'trụ sở làm việc' và 'UBND' đứng đầu", () => {
    const r = real.suggest("Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã vì lạm quyền, tự ý bán trụ sở làm việc.");
    expect(r[0]).toBe("government office building");
    expect(r).toContain("corruption");
    expect(r.length).toBeLessThanOrEqual(3);
  });

  it("câu về tiền và đất: tiền, bị can, đất", () => {
    const r = real.suggest("Tổng số tiền các bị can thu được từ việc bán đất là hơn 545 triệu đồng.");
    expect(r).toEqual(["money cash", "court gavel", "land plot"]);
  });

  it("câu về mưa ngập ở Hà Nội", () => {
    const r = real.suggest("Mưa lớn gây ngập lụt nhiều tuyến đường tại Hà Nội");
    expect(r[0]).toBe("flood");
    expect(r).toContain("hanoi city");
  });

  it("câu gõ không dấu vẫn ra kết quả", () => {
    expect(real.suggest("cong an bat giu doi tuong")).toEqual(["crime scene", "police", "handcuffs"]);
  });

  it("câu không có gì trong từ điển thì dùng từ khoá dự phòng", () => {
    expect(real.suggest("Xin chào các bạn")).toEqual(["news"]);
  });
});

describe("chất lượng từ điển", () => {
  const entries = newsKeywords as KeywordEntry[];
  const norm = (s: string) => s.normalize("NFC").toLocaleLowerCase("vi");

  it("đủ lớn và mọi mục hợp lệ", () => {
    expect(entries.length).toBeGreaterThanOrEqual(100);
    for (const e of entries) {
      expect(e.vi.length).toBeGreaterThan(0);
      expect(e.vi.every((p) => p.trim() === p && p.length >= 2)).toBe(true);
      expect(e.en).toMatch(/^[a-z]+( [a-z]+){0,3}$/);
    }
  });

  it("không có cụm tiếng Việt nào xuất hiện ở hai mục khác nhau", () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const e of entries) {
      for (const phrase of e.vi.map(norm)) {
        const prev = owner.get(phrase);
        if (prev !== undefined && prev !== e.en) clashes.push(`${phrase}: ${prev} / ${e.en}`);
        owner.set(phrase, e.en);
      }
    }
    expect(clashes).toEqual([]);
  });
});
