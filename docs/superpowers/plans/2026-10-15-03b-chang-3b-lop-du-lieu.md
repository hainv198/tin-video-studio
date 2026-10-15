# Tin Video Studio — Chặng 3B: Lớp dữ liệu và dịch vụ phía trình duyệt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng toàn bộ lớp không-giao-diện mà trình 5 bước (chặng 3C) cần: bản chụp (snapshot) và khôi phục cho các đối tượng domain, lưu bản nháp / bộ thương hiệu / file tải lên bằng IndexedDB, đoán từ khoá tiếng Anh từ câu tin, client tìm cảnh trám, kho nhạc, kiểm tra file tải lên, ảnh giả dạng PNG thật cho chế độ dev, và một container dịch vụ phía client.

**Architecture:** Mọi thứ nằm ở `src/domain` (snapshot thuần), `src/client/storage` (kho khoá-giá trị + repository), `src/client/services` và `src/client/media` (client API, từ khoá, kho nhạc), `src/data` (từ điển) và `src/client/container.ts` (lắp dependency một chỗ). Không có View nào ở chặng này. Domain chỉ trao đổi với bên ngoài bằng đối tượng thuần (structured-clone được), không chứa logic IndexedDB.

**Tech Stack:** Như chặng 2; thêm devDependency `fake-indexeddb` 6.2.5 (chỉ để test lớp IndexedDB trên Node).

**Đặc tả:** `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md` (mục 3 "Lưu trữ phía người dùng", 6.3, 7, 12). **Lộ trình:** `docs/superpowers/plans/2026-10-15-00-lo-trinh.md`.

## Global Constraints

- Thư mục dự án: `D:\Brain Hainv\ca-nhan\tools\tin-video-studio`, nhánh `feat/chang-3b-lop-du-lieu` (điều phối viên tạo từ `main`). Đường dẫn tính từ thư mục này.
- **Agent thực thi CẤM chạy mọi lệnh git.** Bỏ qua bước "Commit"; điều phối viên commit. Không chạy dev server; không tạo `.env*`; không đọc/sửa `.env.local`.
- **RED phải đỏ thật:** chạy test mới trước khi viết code và ghi lại dòng thất bại. Test nào không đỏ trên code cũ thì KHÔNG sửa kỳ vọng, báo lại trong report.
- `src/domain` không import gì ngoài `src/domain` (không `fetch`, không `indexedDB`, không React). Snapshot là đối tượng thuần: phải qua được `structuredClone` và giữ nguyên bằng `toEqual`.
- `src/client` không import từ `src/server` ở **mã nguồn** (test thì được, dùng để kiểm hợp đồng kiểu).
- Giới hạn file tải lên (đặc tả mục 7): **ảnh ≤ 20 MB, video ≤ 300 MB, nhạc ≤ 30 MB**. Logo thương hiệu ≤ **5 MB**. Nguồn tin ≤ **80 ký tự**.
- Ngôn ngữ giao diện và thông báo lỗi: tiếng Việt có dấu. Tên lớp, hàm, biến: tiếng Anh.
- Mọi commit kết thúc bằng dòng `Co-Authored-By` do phiên chạy quy định (điều phối viên tự thêm).
- Sau mỗi task: `npx vitest run`, `npm run typecheck`, `npm run lint` đều sạch (0 cảnh báo).

## Cấu trúc file chặng 3B

```
src/domain/NewsProject.ts            # sửa: kiểm ngày/nguồn tin, snapshot/restore
src/domain/VoiceSettings.ts          # sửa: snapshot/restore
src/domain/MusicTrack.ts             # sửa: snapshot/restore
src/domain/Narration.ts              # sửa: snapshot/restore
src/domain/Footage.ts                # sửa: snapshot(), footageFromSnapshot
src/domain/FootageBoard.ts           # sửa: snapshot/restore
src/domain/UploadKind.ts             # mới
src/client/storage/KeyValueStore.ts  # mới: interface + MemoryKeyValueStore
src/client/storage/IdbKeyValueStore.ts
src/client/storage/ProjectDraft.ts   # kiểu bản nháp + buildDraftBody/restoreDraft
src/client/storage/DraftRepository.ts
src/client/storage/BrandRepository.ts
src/client/storage/UploadRepository.ts
src/client/services/apiError.ts      # mới (tách từ TtsClient)
src/client/services/TtsClient.ts     # sửa: dùng apiError
src/client/services/StockClient.ts
src/client/services/KeywordSuggester.ts
src/client/services/MusicLibrary.ts
src/client/media/footageFactory.ts   # stock/upload → Footage
src/client/media/UploadValidator.ts
src/client/media/MediaProbe.ts
src/client/media/AudioDecodeService.ts  # sửa: RENDER_SAMPLE_RATE
src/client/controllers/DevRenderController.ts  # sửa nhỏ: dùng RENDER_SAMPLE_RATE
src/views/dev/DevRenderPanel.tsx     # sửa nhỏ
src/client/container.ts              # mới
src/data/news-keywords.json          # mới
src/server/stock/png.ts              # mới
src/server/stock/FakeStockProvider.ts  # sửa: PNG thật
tests/**                             # gương theo src/
```

---

### Task 1: Domain — kiểm dữ liệu vào, snapshot/restore cho `NewsProject`, `VoiceSettings`, `MusicTrack`

**Vấn đề (review chặng 2):** `Invalid Date` lọt qua `NewsProject` (in `NaN/NaN/NaN` lên video), nguồn tin không giới hạn độ dài, và domain chưa có đường lưu/khôi phục để dùng IndexedDB (`NewsProject` chứa hàm sinh id nên không structured-clone được).

**Files:**
- Modify: `src/domain/NewsProject.ts`, `src/domain/VoiceSettings.ts`, `src/domain/MusicTrack.ts`
- Test: `tests/domain/NewsProject.test.ts`, `tests/domain/VoiceSettings.test.ts`, `tests/domain/MusicTrack.test.ts` (thêm test vào cuối mỗi file)

**Interfaces:**
- Consumes: `Scene`, `SceneRole`, `IdGenerator`, `ValidationError` (đã có).
- Produces:
  - `NewsProject.MAX_CREDIT_CHARS = 80`; `fromText`/`withMeta` ném `ValidationError("Ngày đăng không hợp lệ")` khi `Date` không hợp lệ, `ValidationError("Nguồn tin tối đa 80 ký tự")` khi dài hơn 80.
  - `interface NewsProjectSnapshot { title: string; sourceCredit: string; publishDate: string; templateId: string; scenes: Array<{ id: string; text: string; role: SceneRole }> }` — `publishDate` dạng `yyyy-mm-dd` theo giờ địa phương (không dùng ISO để khỏi lệch múi giờ).
  - `NewsProject#snapshot(): NewsProjectSnapshot`; `static NewsProject.restore(snapshot: NewsProjectSnapshot, nextId: IdGenerator): NewsProject` — ném `ValidationError` khi hỏng (`"Bản nháp hỏng: cấu trúc cảnh không hợp lệ"`, `"Ngày đăng không hợp lệ"`, `"Chưa chọn phong cách video"`, …).
  - `interface VoiceSnapshot { voiceName: string; speakingRate: number }`; `VoiceSettings#snapshot(): VoiceSnapshot`; `static VoiceSettings.restore(s: VoiceSnapshot): VoiceSettings`.
  - `interface MusicTrackSnapshot { id: string; title: string; origin: MusicOrigin; uri: string; gainOffsetDb: number }`; `MusicTrack#snapshot()`; `static MusicTrack.restore(s)` — ném `ValidationError("Bản nháp hỏng: nguồn nhạc không hợp lệ")` khi `origin` lạ.

- [ ] **Step 1: Thêm test vào cuối `tests/domain/NewsProject.test.ts`** (dùng hàm `make` và hằng đã có ở đầu file; sửa dòng import đầu file thành `import { NewsProject, type NewsProjectInput, type NewsProjectSnapshot } from "@/domain/NewsProject";`)

```ts
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
```

Thêm vào cuối `tests/domain/VoiceSettings.test.ts`:
```ts
describe("VoiceSettings snapshot / restore", () => {
  it("round trip qua structuredClone", () => {
    const v = VoiceSettings.create("vi-VN-Neural2-A", 1.1);
    const s = v.snapshot();
    expect(s).toEqual({ voiceName: "vi-VN-Neural2-A", speakingRate: 1.1 });
    expect(VoiceSettings.restore(structuredClone(s)).equals(v)).toBe(true);
  });

  it("snapshot hỏng thì ném ValidationError", () => {
    expect(() => VoiceSettings.restore({ voiceName: "x", speakingRate: 1 })).toThrow(ValidationError);
    expect(() => VoiceSettings.restore({ voiceName: "vi-VN-Neural2-A", speakingRate: 5 })).toThrow(ValidationError);
  });
});
```

Thêm vào cuối `tests/domain/MusicTrack.test.ts`:
```ts
describe("MusicTrack snapshot / restore", () => {
  it("round trip qua structuredClone, giữ chỉnh âm lượng", () => {
    const t = MusicTrack.create({ id: "m1", title: "Bản tin 1", origin: "upload", uri: "upload-abc", gainOffsetDb: 3 });
    const s = t.snapshot();
    expect(s).toEqual({ id: "m1", title: "Bản tin 1", origin: "upload", uri: "upload-abc", gainOffsetDb: 3 });
    const back = MusicTrack.restore(structuredClone(s));
    expect(back.snapshot()).toEqual(s);
    expect(back.levelBelowVoiceDb).toBe(12);
  });

  it("origin lạ hoặc chỉnh âm lượng ngoài ±6 dB thì ném ValidationError", () => {
    const good = { id: "m1", title: "t", origin: "library", uri: "/music/a.mp3", gainOffsetDb: 0 } as const;
    expect(() => MusicTrack.restore({ ...good, origin: "web" as never })).toThrow("Bản nháp hỏng: nguồn nhạc không hợp lệ");
    expect(() => MusicTrack.restore({ ...good, gainOffsetDb: 9 })).toThrow(ValidationError);
  });
});
```
(Thêm `ValidationError` và `VoiceSettings`/`MusicTrack` vào import của từng file test nếu chưa có.)

- [ ] **Step 2: Chạy để thấy lỗi**

Run: `npx vitest run tests/domain/NewsProject.test.ts tests/domain/VoiceSettings.test.ts tests/domain/MusicTrack.test.ts`
Expected: FAIL — `snapshot`/`restore` không tồn tại, không có lỗi ngày/nguồn tin. Ghi lại.

- [ ] **Step 3: Sửa `src/domain/NewsProject.ts`**

(a) Đổi dòng import `Scene`:
```ts
import { Scene, type SceneRole } from "./Scene";
```
(b) Chèn khối sau ngay **trước** dòng `const comparable = (s: string) =>`:
```ts
const MAX_CREDIT_CHARS = 80;

function checkedCredit(raw: string): string {
  const credit = raw.trim();
  if (credit.length > MAX_CREDIT_CHARS) throw new ValidationError(`Nguồn tin tối đa ${MAX_CREDIT_CHARS} ký tự`);
  return credit;
}

function checkedDate(date: Date): Date {
  if (Number.isNaN(date.getTime())) throw new ValidationError("Ngày đăng không hợp lệ");
  return date;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseLocalDate(text: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new ValidationError("Ngày đăng không hợp lệ");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    throw new ValidationError("Ngày đăng không hợp lệ");
  }
  return date;
}

export interface NewsProjectSnapshot {
  title: string;
  sourceCredit: string;
  /** yyyy-mm-dd theo giờ địa phương (không dùng ISO để khỏi lệch múi giờ). */
  publishDate: string;
  templateId: string;
  scenes: Array<{ id: string; text: string; role: SceneRole }>;
}

```
(c) Thêm vào đầu thân lớp, ngay **trước** `private constructor(`:
```ts
  static readonly MAX_CREDIT_CHARS = MAX_CREDIT_CHARS;

```
(d) Trong `fromText`: thay dòng `if (!input.templateId) throw new ValidationError("Chưa chọn phong cách video");` bằng
```ts
    if (!input.templateId) throw new ValidationError("Chưa chọn phong cách video");
    const credit = checkedCredit(input.sourceCredit);
    const publishDate = checkedDate(input.publishDate);
```
và thay dòng `return new NewsProject(title, input.sourceCredit.trim(), input.publishDate, input.templateId, scenes, nextId);` bằng
```ts
    return new NewsProject(title, credit, publishDate, input.templateId, scenes, nextId);
```
(e) Trong `withMeta`: thay hai dòng
```ts
      meta.sourceCredit !== undefined ? meta.sourceCredit.trim() : this.sourceCredit,
      meta.publishDate ?? this.publishDate,
```
bằng
```ts
      meta.sourceCredit !== undefined ? checkedCredit(meta.sourceCredit) : this.sourceCredit,
      meta.publishDate !== undefined ? checkedDate(meta.publishDate) : this.publishDate,
```
(f) Chèn hai thành viên sau vào lớp, ngay **trước** phương thức `private indexOf(`:
```ts
  snapshot(): NewsProjectSnapshot {
    return {
      title: this.title,
      sourceCredit: this.sourceCredit,
      publishDate: toLocalDateString(this.publishDate),
      templateId: this.templateId,
      scenes: this.scenes.map((s) => ({ id: s.id, text: s.text, role: s.role })),
    };
  }

  static restore(snapshot: NewsProjectSnapshot, nextId: IdGenerator): NewsProject {
    if (!snapshot.templateId) throw new ValidationError("Chưa chọn phong cách video");
    const credit = checkedCredit(snapshot.sourceCredit);
    const publishDate = parseLocalDate(snapshot.publishDate);
    const scenes = snapshot.scenes.map((s) => Scene.create(s.id, s.text, s.role));
    const structureOk =
      scenes.length >= 2 && scenes[0]?.role === "intro" && scenes.slice(1).every((s) => s.role === "body");
    if (!structureOk) throw new ValidationError("Bản nháp hỏng: cấu trúc cảnh không hợp lệ");
    return new NewsProject(snapshot.title, credit, publishDate, snapshot.templateId, scenes, nextId);
  }

```

- [ ] **Step 4: Sửa `src/domain/VoiceSettings.ts`**: thêm trước `export class VoiceSettings`
```ts
export interface VoiceSnapshot {
  voiceName: string;
  speakingRate: number;
}

```
và thêm hai thành viên vào lớp (cuối thân lớp):
```ts
  snapshot(): VoiceSnapshot {
    return { voiceName: this.voiceName, speakingRate: this.speakingRate };
  }

  static restore(s: VoiceSnapshot): VoiceSettings {
    return VoiceSettings.create(s.voiceName, s.speakingRate);
  }
```

- [ ] **Step 5: Sửa `src/domain/MusicTrack.ts`**: thêm trước `export class MusicTrack`
```ts
export interface MusicTrackSnapshot {
  id: string;
  title: string;
  origin: MusicOrigin;
  uri: string;
  gainOffsetDb: number;
}

```
và thêm hai thành viên (cuối thân lớp):
```ts
  snapshot(): MusicTrackSnapshot {
    return { id: this.id, title: this.title, origin: this.origin, uri: this.uri, gainOffsetDb: this.gainOffsetDb };
  }

  static restore(s: MusicTrackSnapshot): MusicTrack {
    if (s.origin !== "library" && s.origin !== "upload") {
      throw new ValidationError("Bản nháp hỏng: nguồn nhạc không hợp lệ");
    }
    return MusicTrack.create({ id: s.id, title: s.title, origin: s.origin, uri: s.uri, gainOffsetDb: s.gainOffsetDb });
  }
```

- [ ] **Step 6: Chạy test, typecheck, lint**

Run: `npx vitest run` → PASS (kể cả toàn bộ test domain cũ). `npm run typecheck`, `npm run lint` → sạch.

- [ ] **Step 7: Commit** (điều phối viên) — `feat(domain): kiểm ngày/nguồn tin, snapshot và restore cho NewsProject, VoiceSettings, MusicTrack`

---

### Task 2: Domain — snapshot/restore cho `Narration`, `Footage`, `FootageBoard`

**Files:**
- Modify: `src/domain/Narration.ts`, `src/domain/Footage.ts`, `src/domain/FootageBoard.ts`
- Test: `tests/domain/Narration.test.ts`, `tests/domain/Footage.test.ts`, `tests/domain/FootageBoard.test.ts` (thêm vào cuối mỗi file)

**Interfaces:**
- Consumes: `VoiceSettings`, `VoiceSnapshot` (Task 1), `FootageSource`, `Footage`, `ImageFootage`, `VideoFootage`, `FallbackFootage`.
- Produces:
  - `interface NarrationSnapshot { sceneId: string; text: string; audio: Uint8Array; mimeType: string; durationSec: number; voice: VoiceSnapshot }`; `Narration#snapshot(): NarrationSnapshot` (sao chép `audio`); `static Narration.restore(s: NarrationSnapshot): Narration`.
  - `type FootageSnapshot = { kind: "image"; id: string; source: FootageSource; width: number; height: number } | { kind: "video"; id: string; source: FootageSource; width: number; height: number; durationSec: number } | { kind: "fallback"; id: string }`; `Footage#snapshot(): FootageSnapshot` (abstract); `footageFromSnapshot(s: FootageSnapshot): Footage` — loại lạ ném `ValidationError("Bản nháp hỏng: loại cảnh trám không hợp lệ")`.
  - `interface FootageBoardSnapshot { assignments: Array<[string, FootageSnapshot]> }`; `FootageBoard#snapshot()`; `static FootageBoard.restore(s)`.

- [ ] **Step 1: Thêm test vào cuối `tests/domain/Narration.test.ts`** (dùng `voice`, `make` đã có ở đầu file; thêm `VoiceSettings`… đã import)

```ts
describe("Narration snapshot / restore", () => {
  it("round trip qua structuredClone, giữ giọng và độ dài", () => {
    const n = make({ audio: new Uint8Array([1, 2, 3]) });
    const s = n.snapshot();
    expect(s.voice).toEqual({ voiceName: "vi-VN-Neural2-A", speakingRate: 1.07 });
    const back = Narration.restore(structuredClone(s));
    expect(back.sceneId).toBe("s1");
    expect(back.durationSec).toBe(2.4);
    expect(Array.from(back.audio)).toEqual([1, 2, 3]);
    expect(back.isStaleFor(scene, voice)).toBe(false);
  });

  it("snapshot sao chép audio: sửa bản chụp không đổi đối tượng gốc", () => {
    const n = make({ audio: new Uint8Array([1, 2, 3]) });
    const s = n.snapshot();
    s.audio[0] = 9;
    expect(n.audio[0]).toBe(1);
  });

  it("snapshot hỏng thì ném ValidationError", () => {
    const s = make().snapshot();
    expect(() => Narration.restore({ ...s, audio: new Uint8Array() })).toThrow(ValidationError);
    expect(() => Narration.restore({ ...s, voice: { voiceName: "x", speakingRate: 1 } })).toThrow(ValidationError);
  });
});
```

Thêm vào cuối `tests/domain/Footage.test.ts` (thêm `footageFromSnapshot` vào dòng import từ `@/domain/Footage`):
```ts
describe("Footage snapshot / restore", () => {
  const source = { origin: "pexels" as const, uri: "https://x/1.jpg", credit: "An", pageUrl: "https://p/1" };

  it("ảnh, video, nền dự phòng đều round trip qua structuredClone", () => {
    for (const f of [
      new ImageFootage("f1", source, 1600, 900),
      new VideoFootage("f2", source, 1920, 1080, 12.5),
      new FallbackFootage("f3"),
    ]) {
      const s = f.snapshot();
      expect(structuredClone(s)).toEqual(s);
      const back = footageFromSnapshot(structuredClone(s));
      expect(back.kind).toBe(f.kind);
      expect(back.snapshot()).toEqual(s);
    }
  });

  it("snapshot ảnh chứa đủ nguồn và kích thước; video có độ dài", () => {
    expect(new ImageFootage("f1", source, 1600, 900).snapshot()).toEqual({
      kind: "image",
      id: "f1",
      source,
      width: 1600,
      height: 900,
    });
    expect(new VideoFootage("f2", source, 1920, 1080, 12.5).snapshot()).toMatchObject({ kind: "video", durationSec: 12.5 });
  });

  it("snapshot không dùng chung đối tượng nguồn với bản gốc", () => {
    const f = new ImageFootage("f1", { ...source }, 10, 10);
    const s = f.snapshot();
    if (s.kind !== "image") throw new Error("kiểu sai");
    s.source.uri = "https://khac";
    expect(f.snapshot()).toMatchObject({ source: { uri: "https://x/1.jpg" } });
  });

  it("loại lạ hoặc dữ liệu hỏng thì ném ValidationError", () => {
    expect(() => footageFromSnapshot({ kind: "gif", id: "x" } as never)).toThrow(
      "Bản nháp hỏng: loại cảnh trám không hợp lệ",
    );
    expect(() => footageFromSnapshot({ kind: "video", id: "x", source, width: 10, height: 10, durationSec: 0 })).toThrow(
      ValidationError,
    );
  });
});
```
(thêm `ValidationError` vào import nếu chưa có.)

Thêm vào cuối `tests/domain/FootageBoard.test.ts` (thêm `FootageBoard` đã import; thêm `ValidationError` nếu cần):
```ts
describe("FootageBoard snapshot / restore", () => {
  it("round trip: giữ cảnh trống, dùng chung một cảnh trám cho nhiều cảnh", () => {
    const a = img("a");
    const board = FootageBoard.empty().assign("s1", a).assign("s3", a).assign("s4", new FallbackFootage("fb"));
    const s = board.snapshot();
    expect(structuredClone(s)).toEqual(s);
    const back = FootageBoard.restore(structuredClone(s));
    expect(back.get("s1")?.id).toBe("a");
    expect(back.get("s3")?.id).toBe("a");
    expect(back.get("s2")).toBeUndefined();
    expect(back.get("s4")?.kind).toBe("fallback");
    expect(back.snapshot()).toEqual(s);
  });

  it("bảng rỗng round trip thành bảng rỗng", () => {
    expect(FootageBoard.restore(FootageBoard.empty().snapshot()).unassignedSceneIds(["s1"])).toEqual(["s1"]);
  });

  it("snapshot hỏng thì ném ValidationError", () => {
    expect(() => FootageBoard.restore({ assignments: [["s1", { kind: "gif", id: "x" } as never]] })).toThrow(ValidationError);
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/domain/Narration.test.ts tests/domain/Footage.test.ts tests/domain/FootageBoard.test.ts` → FAIL (`snapshot` không tồn tại). Ghi lại.

- [ ] **Step 3: Sửa `src/domain/Narration.ts`**: đổi import thành `import { VoiceSettings, type VoiceSnapshot } from "./VoiceSettings";` (hiện là `import type { VoiceSettings }`), thêm trước `export class Narration`:
```ts
export interface NarrationSnapshot {
  sceneId: string;
  text: string;
  audio: Uint8Array;
  mimeType: string;
  durationSec: number;
  voice: VoiceSnapshot;
}

```
và thêm hai thành viên (cuối thân lớp):
```ts
  snapshot(): NarrationSnapshot {
    return {
      sceneId: this.sceneId,
      text: this.text,
      audio: this.audio.slice(),
      mimeType: this.mimeType,
      durationSec: this.durationSec,
      voice: this.voice.snapshot(),
    };
  }

  static restore(s: NarrationSnapshot): Narration {
    return Narration.create({
      sceneId: s.sceneId,
      text: s.text,
      audio: s.audio.slice(),
      mimeType: s.mimeType,
      durationSec: s.durationSec,
      voice: VoiceSettings.restore(s.voice),
    });
  }
```

- [ ] **Step 4: Sửa `src/domain/Footage.ts`**

Thêm sau `FootagePlayback`:
```ts
export type FootageSnapshot =
  | { kind: "image"; id: string; source: FootageSource; width: number; height: number }
  | { kind: "video"; id: string; source: FootageSource; width: number; height: number; durationSec: number }
  | { kind: "fallback"; id: string };
```
Trong lớp trừu tượng `Footage` thêm dưới `abstract playbackFor(...)`:
```ts
  abstract snapshot(): FootageSnapshot;
```
Trong `ImageFootage` thêm:
```ts
  snapshot(): FootageSnapshot {
    return { kind: "image", id: this.id, source: { ...this.source }, width: this.width, height: this.height };
  }
```
Trong `VideoFootage` thêm:
```ts
  snapshot(): FootageSnapshot {
    return {
      kind: "video",
      id: this.id,
      source: { ...this.source },
      width: this.width,
      height: this.height,
      durationSec: this.durationSec,
    };
  }
```
Trong `FallbackFootage` thêm:
```ts
  snapshot(): FootageSnapshot {
    return { kind: "fallback", id: this.id };
  }
```
Cuối file thêm:
```ts
export function footageFromSnapshot(s: FootageSnapshot): Footage {
  switch (s.kind) {
    case "image":
      return new ImageFootage(s.id, { ...s.source }, s.width, s.height);
    case "video":
      return new VideoFootage(s.id, { ...s.source }, s.width, s.height, s.durationSec);
    case "fallback":
      return new FallbackFootage(s.id);
    default:
      throw new ValidationError("Bản nháp hỏng: loại cảnh trám không hợp lệ");
  }
}
```

- [ ] **Step 5: Sửa `src/domain/FootageBoard.ts`**: đổi dòng import đầu thành `import { FallbackFootage, footageFromSnapshot, type Footage, type FootageSnapshot } from "./Footage";`, thêm trước `export class FootageBoard`:
```ts
export interface FootageBoardSnapshot {
  assignments: Array<[string, FootageSnapshot]>;
}

```
và thêm hai thành viên vào lớp (cuối thân lớp):
```ts
  snapshot(): FootageBoardSnapshot {
    return { assignments: [...this.bySceneId.entries()].map(([sceneId, footage]) => [sceneId, footage.snapshot()]) };
  }

  static restore(s: FootageBoardSnapshot): FootageBoard {
    return new FootageBoard(new Map(s.assignments.map(([sceneId, f]) => [sceneId, footageFromSnapshot(f)])));
  }
```

- [ ] **Step 6: Chạy test, typecheck, lint** — `npx vitest run` → PASS; sạch. (Nếu có lớp con `Footage` khác trong `src` hoặc `tests` bị lỗi vì thiếu `snapshot()`, thêm vào và báo.)

- [ ] **Step 7: Commit** (điều phối viên) — `feat(domain): snapshot và restore cho Narration, Footage, FootageBoard`

---

### Task 3: Kho khoá-giá trị — `KeyValueStore`, `MemoryKeyValueStore`, `IdbKeyValueStore`

**Files:**
- Create: `src/client/storage/KeyValueStore.ts`, `src/client/storage/IdbKeyValueStore.ts`
- Modify: `package.json` (devDependency `fake-indexeddb` 6.2.5)
- Test: `tests/client/storage/KeyValueStore.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `interface KeyValueStore { get<T>(key: string): Promise<T | undefined>; set(key: string, value: unknown): Promise<void>; delete(key: string): Promise<void>; keys(prefix?: string): Promise<string[]> }` — `keys` trả danh sách đã sắp xếp tăng dần.
  - `class MemoryKeyValueStore implements KeyValueStore` — **sao chép bằng `structuredClone` khi ghi và khi đọc** để giống ngữ nghĩa IndexedDB.
  - `class IdbKeyValueStore implements KeyValueStore { constructor(factory: IDBFactory, dbName = "tin-video-studio", storeName = "kv") }` — mở kết nối lười; mở lỗi thì lần gọi sau thử lại; lỗi ghi do hết dung lượng báo `"Bộ nhớ trình duyệt đã đầy, hãy xoá bớt file đã tải lên"`.

- [ ] **Step 1: Cài thư viện test**

Run: `npm install -D fake-indexeddb@6.2.5 --save-exact`
Expected: `package.json` có `"fake-indexeddb": "6.2.5"` trong `devDependencies`.

- [ ] **Step 2: Viết test `tests/client/storage/KeyValueStore.test.ts`**

```ts
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { IdbKeyValueStore } from "@/client/storage/IdbKeyValueStore";
import { MemoryKeyValueStore, type KeyValueStore } from "@/client/storage/KeyValueStore";

const factories: Array<[string, () => KeyValueStore]> = [
  ["memory", () => new MemoryKeyValueStore()],
  ["idb", () => new IdbKeyValueStore(new IDBFactory() as unknown as IDBFactory)],
];

describe.each(factories)("KeyValueStore (%s)", (_name, create) => {
  it("ghi rồi đọc lại đối tượng có Uint8Array và Date", async () => {
    const store = create();
    await store.set("o", { a: new Uint8Array([1, 2, 3]), d: new Date(0), n: [1, { x: "y" }] });
    const got = await store.get<{ a: Uint8Array; d: Date; n: unknown[] }>("o");
    expect(got?.a).toBeInstanceOf(Uint8Array);
    expect(Array.from(got?.a ?? [])).toEqual([1, 2, 3]);
    expect(got?.d.getTime()).toBe(0);
    expect(got?.n).toEqual([1, { x: "y" }]);
  });

  it("khoá không có trả undefined; ghi đè được; xoá được", async () => {
    const store = create();
    expect(await store.get("none")).toBeUndefined();
    await store.set("k", 1);
    await store.set("k", 2);
    expect(await store.get("k")).toBe(2);
    await store.delete("k");
    expect(await store.get("k")).toBeUndefined();
    await store.delete("k"); // xoá khoá không có không lỗi
  });

  it("keys lọc theo tiền tố và sắp xếp tăng dần", async () => {
    const store = create();
    for (const k of ["blob:b", "brand:x", "blob:a", "draft"]) await store.set(k, 1);
    expect(await store.keys()).toEqual(["blob:a", "blob:b", "brand:x", "draft"]);
    expect(await store.keys("blob:")).toEqual(["blob:a", "blob:b"]);
    expect(await store.keys("zzz")).toEqual([]);
  });

  it("lưu và đọc Blob", async () => {
    const store = create();
    await store.set("b", new Blob(["xin chào"], { type: "text/plain" }));
    const blob = await store.get<Blob>("b");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.size).toBe(new TextEncoder().encode("xin chào").length);
    expect(await blob?.text()).toBe("xin chào");
  });

  it("là bản sao: sửa đối tượng gốc sau khi ghi, hoặc sửa bản đọc ra, không ảnh hưởng dữ liệu đã lưu", async () => {
    const store = create();
    const value = { list: [1, 2] };
    await store.set("c", value);
    value.list.push(3);
    const first = await store.get<{ list: number[] }>("c");
    expect(first?.list).toEqual([1, 2]);
    first?.list.push(9);
    expect((await store.get<{ list: number[] }>("c"))?.list).toEqual([1, 2]);
  });
});

describe("IdbKeyValueStore lỗi", () => {
  it("mở kết nối lỗi thì báo tiếng Việt và lần sau thử lại được", async () => {
    let attempts = 0;
    const real = new IDBFactory() as unknown as IDBFactory;
    const flaky = {
      open(name: string, version?: number) {
        attempts++;
        if (attempts === 1) {
          const request: { onerror?: () => void } = {};
          queueMicrotask(() => request.onerror?.());
          return request;
        }
        return real.open(name, version);
      },
    } as unknown as IDBFactory;
    const store = new IdbKeyValueStore(flaky);
    await expect(store.get("k")).rejects.toThrow("Không mở được bộ nhớ trình duyệt");
    await store.set("k", 7);
    expect(await store.get("k")).toBe(7);
  });

  it("hai kho khác tên cơ sở dữ liệu không thấy dữ liệu của nhau", async () => {
    const factory = new IDBFactory() as unknown as IDBFactory;
    const a = new IdbKeyValueStore(factory, "db-a");
    const b = new IdbKeyValueStore(factory, "db-b");
    await a.set("k", 1);
    expect(await b.get("k")).toBeUndefined();
  });
});
```

- [ ] **Step 3: Chạy để thấy lỗi** — `npx vitest run tests/client/storage` → FAIL (không tìm thấy module). Ghi lại.

- [ ] **Step 4: Viết code**

`src/client/storage/KeyValueStore.ts`:
```ts
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  /** Danh sách khoá (tuỳ chọn lọc theo tiền tố), sắp xếp tăng dần. */
  keys(prefix?: string): Promise<string[]>;
}

/** Cài đặt trong bộ nhớ cho test; sao chép bằng structuredClone khi ghi/đọc để giống ngữ nghĩa IndexedDB. */
export class MemoryKeyValueStore implements KeyValueStore {
  private readonly map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.has(key) ? (structuredClone(this.map.get(key)) as T) : undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.map.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async keys(prefix = ""): Promise<string[]> {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}
```

`src/client/storage/IdbKeyValueStore.ts`:
```ts
import type { KeyValueStore } from "./KeyValueStore";

const DB_VERSION = 1;

export class IdbKeyValueStore implements KeyValueStore {
  private db: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly factory: IDBFactory,
    private readonly dbName = "tin-video-studio",
    private readonly storeName = "kv",
  ) {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory.open(this.dbName, DB_VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(this.storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.db = null; // lần sau thử mở lại
        reject(new Error("Không mở được bộ nhớ trình duyệt"));
      };
    });
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      let result: T;
      const request = work(tx.objectStore(this.storeName));
      request.onsuccess = () => {
        result = request.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(
          new Error(
            tx.error?.name === "QuotaExceededError"
              ? "Bộ nhớ trình duyệt đã đầy, hãy xoá bớt file đã tải lên"
              : "Lỗi ghi/đọc bộ nhớ trình duyệt",
          ),
        );
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    return (await this.run("readonly", (s) => s.get(key))) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.run("readwrite", (s) => s.put(value, key));
  }

  async delete(key: string): Promise<void> {
    await this.run("readwrite", (s) => s.delete(key));
  }

  async keys(prefix = ""): Promise<string[]> {
    const all = await this.run("readonly", (s) => s.getAllKeys());
    return all.filter((k): k is string => typeof k === "string" && k.startsWith(prefix)).sort();
  }
}
```

- [ ] **Step 5: Chạy test, typecheck, lint** — `npx vitest run tests/client/storage` → PASS (cả hai bản memory và idb). `npm run typecheck`, `npm run lint` → sạch.
> Nếu test `idb` báo `Blob` không lưu/đọc được, báo lỗi thật kèm phiên bản Node; không bỏ test.

- [ ] **Step 6: Commit** (điều phối viên) — `feat(storage): kho khoá-giá trị bằng IndexedDB và bản trong bộ nhớ cho test`

---

### Task 4: Bản nháp, bộ thương hiệu, file tải lên — các repository

**Files:**
- Create: `src/domain/UploadKind.ts`, `src/client/storage/ProjectDraft.ts`, `src/client/storage/DraftRepository.ts`, `src/client/storage/BrandRepository.ts`, `src/client/storage/UploadRepository.ts`
- Test: `tests/client/storage/ProjectDraft.test.ts`, `tests/client/storage/DraftRepository.test.ts`, `tests/client/storage/BrandRepository.test.ts`, `tests/client/storage/UploadRepository.test.ts`

**Interfaces:**
- Consumes: `KeyValueStore`, `MemoryKeyValueStore` (Task 3); `NewsProject`, `NewsProjectSnapshot`, `VoiceSettings`, `VoiceSnapshot`, `Narration`, `NarrationSnapshot`, `FootageBoard`, `FootageBoardSnapshot`, `MusicTrack`, `MusicTrackSnapshot`, `IdGenerator`, `randomIds`, `ValidationError`, `SentenceSplitter` (Task 1–2 và có sẵn).
- Produces:
  - `type UploadKind = "image" | "video" | "audio"`.
  - `DRAFT_VERSION = 1`; `interface DraftParts { project: NewsProject; voice: VoiceSettings | null; narrations: readonly Narration[]; footage: FootageBoard; music: MusicTrack | null }`; `interface DraftBody { project: NewsProjectSnapshot; voice: VoiceSnapshot | null; narrations: NarrationSnapshot[]; footage: FootageBoardSnapshot; music: MusicTrackSnapshot | null }`; `interface ProjectDraft extends DraftBody { version: typeof DRAFT_VERSION; savedAt: string }`; `buildDraftBody(parts: DraftParts): DraftBody`; `restoreDraft(draft: DraftBody, nextId: IdGenerator): DraftParts`.
  - `class DraftRepository { constructor(store: KeyValueStore, now?: () => Date); save(body: DraftBody): Promise<void>; load(): Promise<ProjectDraft | null>; clear(): Promise<void> }` — khoá `"draft"`; bản nháp sai phiên bản hoặc không phải đối tượng → `load()` trả `null` (không ném).
  - `interface StoredBrand { values: Record<string, string>; logo: Blob | null; updatedAt: string }`; `class BrandRepository { constructor(store, now?); save(templateId: string, values: Record<string, string>, logo: Blob | null): Promise<void>; load(templateId: string): Promise<StoredBrand | null> }` — khoá `"brand:<templateId>"`; logo > 5 MB ném `ValidationError("Logo tối đa 5 MB")`; chỉ giữ giá trị chuỗi.
  - `interface UploadMeta { id: string; name: string; kind: UploadKind; size: number; addedAt: string }`; `interface StoredUpload extends UploadMeta { blob: Blob }`; `class UploadRepository { constructor(store, nextId?: IdGenerator, now?); put(blob: Blob, info: { name: string; kind: UploadKind }): Promise<UploadMeta>; get(id: string): Promise<StoredUpload | null>; delete(id: string): Promise<void>; list(): Promise<UploadMeta[]>; totalBytes(): Promise<number> }` — id dạng `"upload-<id>"`, khoá lưu `"blob:<id>"`, `list()` sắp theo `addedAt` rồi `id`.

- [ ] **Step 1: Viết test**

`tests/client/storage/ProjectDraft.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { FallbackFootage, ImageFootage } from "@/domain/Footage";
import { FootageBoard } from "@/domain/FootageBoard";
import { sequentialIds } from "@/domain/ids";
import { MusicTrack } from "@/domain/MusicTrack";
import { Narration } from "@/domain/Narration";
import { NewsProject } from "@/domain/NewsProject";
import { SentenceSplitter } from "@/domain/SentenceSplitter";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { ValidationError } from "@/domain/errors";
import { buildDraftBody, restoreDraft, type DraftParts } from "@/client/storage/ProjectDraft";

function parts(): DraftParts {
  const project = NewsProject.fromText(
    {
      text: "Tiêu đề tin. Câu thứ nhất của tin. Câu thứ hai của tin.",
      sourceCredit: "VnExpress",
      publishDate: new Date(2026, 9, 14),
      templateId: "theanh28",
    },
    new SentenceSplitter(),
    sequentialIds("s"),
  );
  const voice = VoiceSettings.create("vi-VN-HoaiMyNeural", 1.07);
  const first = project.scenes[0]!;
  return {
    project,
    voice,
    narrations: [
      Narration.create({
        sceneId: first.id,
        text: first.text,
        audio: new Uint8Array([1, 2, 3]),
        mimeType: "audio/mpeg",
        durationSec: 2.5,
        voice,
      }),
    ],
    footage: FootageBoard.empty()
      .assign("s2", new ImageFootage("f1", { origin: "upload", uri: "upload-1" }, 800, 600))
      .assign("s3", new FallbackFootage("fb")),
    music: MusicTrack.create({ id: "m1", title: "Bản tin", origin: "library", uri: "/music/ban-tin-mac-dinh.mp3" }),
  };
}

describe("buildDraftBody / restoreDraft", () => {
  it("round trip qua structuredClone giữ nguyên mọi phần", () => {
    const original = parts();
    const body = structuredClone(buildDraftBody(original));
    const back = restoreDraft(body, sequentialIds("n"));
    expect(back.project.snapshot()).toEqual(original.project.snapshot());
    expect(back.voice?.snapshot()).toEqual(original.voice?.snapshot());
    expect(back.narrations.map((n) => n.snapshot())).toEqual(original.narrations.map((n) => n.snapshot()));
    expect(back.footage.snapshot()).toEqual(original.footage.snapshot());
    expect(back.music?.snapshot()).toEqual(original.music?.snapshot());
  });

  it("chấp nhận bản nháp chưa có giọng, chưa có nhạc, chưa có cảnh trám", () => {
    const empty: DraftParts = { ...parts(), voice: null, narrations: [], footage: FootageBoard.empty(), music: null };
    const back = restoreDraft(structuredClone(buildDraftBody(empty)), sequentialIds("n"));
    expect(back.voice).toBeNull();
    expect(back.music).toBeNull();
    expect(back.narrations).toEqual([]);
    expect(back.footage.unassignedSceneIds(["s1"])).toEqual(["s1"]);
  });

  it("bản nháp hỏng ở bất kỳ phần nào thì ném ValidationError", () => {
    const body = buildDraftBody(parts());
    expect(() => restoreDraft({ ...body, project: { ...body.project, scenes: [] } }, sequentialIds("n"))).toThrow(
      ValidationError,
    );
    expect(() => restoreDraft({ ...body, voice: { voiceName: "x", speakingRate: 1 } }, sequentialIds("n"))).toThrow(
      ValidationError,
    );
    expect(() =>
      restoreDraft({ ...body, footage: { assignments: [["s2", { kind: "gif", id: "x" } as never]] } }, sequentialIds("n")),
    ).toThrow(ValidationError);
  });
});
```

`tests/client/storage/DraftRepository.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DraftRepository } from "@/client/storage/DraftRepository";
import { MemoryKeyValueStore } from "@/client/storage/KeyValueStore";
import type { DraftBody } from "@/client/storage/ProjectDraft";

const body: DraftBody = {
  project: {
    title: "T.",
    sourceCredit: "",
    publishDate: "2026-10-14",
    templateId: "theanh28",
    scenes: [
      { id: "s1", text: "T.", role: "intro" },
      { id: "s2", text: "A.", role: "body" },
    ],
  },
  voice: null,
  narrations: [],
  footage: { assignments: [] },
  music: null,
};

describe("DraftRepository", () => {
  it("chưa lưu thì load trả null", async () => {
    expect(await new DraftRepository(new MemoryKeyValueStore()).load()).toBeNull();
  });

  it("save rồi load: thêm version và savedAt", async () => {
    const repo = new DraftRepository(new MemoryKeyValueStore(), () => new Date("2026-10-15T01:02:03.000Z"));
    await repo.save(body);
    expect(await repo.load()).toEqual({ version: 1, savedAt: "2026-10-15T01:02:03.000Z", ...body });
  });

  it("save ghi đè bản cũ; clear xoá hẳn", async () => {
    const repo = new DraftRepository(new MemoryKeyValueStore());
    await repo.save(body);
    await repo.save({ ...body, project: { ...body.project, title: "Mới." } });
    expect((await repo.load())?.project.title).toBe("Mới.");
    await repo.clear();
    expect(await repo.load()).toBeNull();
  });

  it("bản nháp sai phiên bản hoặc không phải đối tượng thì load trả null, không ném", async () => {
    const store = new MemoryKeyValueStore();
    const repo = new DraftRepository(store);
    await store.set("draft", { version: 99, ...body });
    expect(await repo.load()).toBeNull();
    await store.set("draft", "rác");
    expect(await repo.load()).toBeNull();
    await store.set("draft", { version: 1 });
    expect(await repo.load()).toBeNull();
  });
});
```

`tests/client/storage/BrandRepository.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { BrandRepository } from "@/client/storage/BrandRepository";
import { MemoryKeyValueStore } from "@/client/storage/KeyValueStore";
import { ValidationError } from "@/domain/errors";

describe("BrandRepository", () => {
  it("chưa lưu thì load trả null", async () => {
    expect(await new BrandRepository(new MemoryKeyValueStore()).load("theanh28")).toBeNull();
  });

  it("lưu giá trị và logo theo từng phong cách, không lẫn nhau", async () => {
    const repo = new BrandRepository(new MemoryKeyValueStore(), () => new Date("2026-10-15T00:00:00.000Z"));
    const logo = new Blob(["png"], { type: "image/png" });
    await repo.save("theanh28", { channelName: "2NV News", primaryColor: "#1F9D55" }, logo);
    await repo.save("khac", { channelName: "Khác" }, null);
    const a = await repo.load("theanh28");
    expect(a?.values).toEqual({ channelName: "2NV News", primaryColor: "#1F9D55" });
    expect(a?.logo?.size).toBe(3);
    expect(a?.updatedAt).toBe("2026-10-15T00:00:00.000Z");
    expect((await repo.load("khac"))?.logo).toBeNull();
  });

  it("chỉ giữ giá trị chuỗi", async () => {
    const repo = new BrandRepository(new MemoryKeyValueStore());
    await repo.save("t", { a: "x", b: 5 as unknown as string }, null);
    expect((await repo.load("t"))?.values).toEqual({ a: "x" });
  });

  it("logo quá 5 MB hoặc thiếu phong cách thì ném ValidationError", async () => {
    const repo = new BrandRepository(new MemoryKeyValueStore());
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]);
    await expect(repo.save("t", {}, big)).rejects.toThrow("Logo tối đa 5 MB");
    await expect(repo.save("", {}, null)).rejects.toBeInstanceOf(ValidationError);
  });

  it("dữ liệu lưu hỏng thì load trả null", async () => {
    const store = new MemoryKeyValueStore();
    await store.set("brand:t", "rác");
    expect(await new BrandRepository(store).load("t")).toBeNull();
  });
});
```

`tests/client/storage/UploadRepository.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { MemoryKeyValueStore } from "@/client/storage/KeyValueStore";
import { UploadRepository } from "@/client/storage/UploadRepository";
import { sequentialIds } from "@/domain/ids";

const make = () => {
  let tick = 0;
  return new UploadRepository(new MemoryKeyValueStore(), sequentialIds("u"), () => new Date(Date.UTC(2026, 9, 15, 0, 0, tick++)));
};

describe("UploadRepository", () => {
  it("put trả metadata, get trả lại đúng blob", async () => {
    const repo = make();
    const meta = await repo.put(new Blob(["hello"], { type: "image/png" }), { name: "a.png", kind: "image" });
    expect(meta).toEqual({ id: "upload-u1", name: "a.png", kind: "image", size: 5, addedAt: "2026-10-15T00:00:00.000Z" });
    const stored = await repo.get(meta.id);
    expect(stored?.name).toBe("a.png");
    expect(await stored?.blob.text()).toBe("hello");
  });

  it("get id không có trả null; delete xoá được", async () => {
    const repo = make();
    expect(await repo.get("upload-zzz")).toBeNull();
    const meta = await repo.put(new Blob(["x"]), { name: "x.mp3", kind: "audio" });
    await repo.delete(meta.id);
    expect(await repo.get(meta.id)).toBeNull();
    await repo.delete(meta.id); // xoá lần nữa không lỗi
  });

  it("list chỉ trả metadata, theo thứ tự thêm; totalBytes cộng dung lượng", async () => {
    const repo = make();
    await repo.put(new Blob(["12345"]), { name: "a", kind: "image" });
    await repo.put(new Blob(["123"]), { name: "b", kind: "video" });
    const list = await repo.list();
    expect(list.map((m) => m.name)).toEqual(["a", "b"]);
    expect(list.every((m) => !("blob" in m))).toBe(true);
    expect(await repo.totalBytes()).toBe(8);
  });

  it("không lẫn với các khoá khác trong cùng kho", async () => {
    const store = new MemoryKeyValueStore();
    await store.set("draft", { x: 1 });
    await store.set("brand:t", { y: 2 });
    const repo = new UploadRepository(store, sequentialIds("u"));
    await repo.put(new Blob(["z"]), { name: "z", kind: "image" });
    expect((await repo.list()).map((m) => m.name)).toEqual(["z"]);
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/storage` → FAIL ở 4 file mới (không tìm thấy module). Ghi lại.

- [ ] **Step 3: Viết code**

`src/domain/UploadKind.ts`:
```ts
export type UploadKind = "image" | "video" | "audio";
```

`src/client/storage/ProjectDraft.ts`:
```ts
import { FootageBoard, type FootageBoardSnapshot } from "@/domain/FootageBoard";
import type { IdGenerator } from "@/domain/ids";
import { MusicTrack, type MusicTrackSnapshot } from "@/domain/MusicTrack";
import { Narration, type NarrationSnapshot } from "@/domain/Narration";
import { NewsProject, type NewsProjectSnapshot } from "@/domain/NewsProject";
import { VoiceSettings, type VoiceSnapshot } from "@/domain/VoiceSettings";

export const DRAFT_VERSION = 1;

export interface DraftParts {
  project: NewsProject;
  voice: VoiceSettings | null;
  narrations: readonly Narration[];
  footage: FootageBoard;
  music: MusicTrack | null;
}

export interface DraftBody {
  project: NewsProjectSnapshot;
  voice: VoiceSnapshot | null;
  narrations: NarrationSnapshot[];
  footage: FootageBoardSnapshot;
  music: MusicTrackSnapshot | null;
}

export interface ProjectDraft extends DraftBody {
  version: typeof DRAFT_VERSION;
  savedAt: string;
}

export function buildDraftBody(parts: DraftParts): DraftBody {
  return {
    project: parts.project.snapshot(),
    voice: parts.voice?.snapshot() ?? null,
    narrations: parts.narrations.map((n) => n.snapshot()),
    footage: parts.footage.snapshot(),
    music: parts.music?.snapshot() ?? null,
  };
}

/** Dựng lại các đối tượng domain; mọi phần hỏng ném ValidationError. */
export function restoreDraft(draft: DraftBody, nextId: IdGenerator): DraftParts {
  return {
    project: NewsProject.restore(draft.project, nextId),
    voice: draft.voice ? VoiceSettings.restore(draft.voice) : null,
    narrations: draft.narrations.map((n) => Narration.restore(n)),
    footage: FootageBoard.restore(draft.footage),
    music: draft.music ? MusicTrack.restore(draft.music) : null,
  };
}
```

`src/client/storage/DraftRepository.ts`:
```ts
import type { KeyValueStore } from "./KeyValueStore";
import { DRAFT_VERSION, type DraftBody, type ProjectDraft } from "./ProjectDraft";

const KEY = "draft";

export class DraftRepository {
  constructor(
    private readonly store: KeyValueStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async save(body: DraftBody): Promise<void> {
    const draft: ProjectDraft = { version: DRAFT_VERSION, savedAt: this.now().toISOString(), ...body };
    await this.store.set(KEY, draft);
  }

  /** Bản nháp không đọc được hoặc sai phiên bản thì coi như chưa có (không ném). */
  async load(): Promise<ProjectDraft | null> {
    const value = await this.store.get<unknown>(KEY);
    if (typeof value !== "object" || value === null) return null;
    const draft = value as Partial<ProjectDraft>;
    if (draft.version !== DRAFT_VERSION || typeof draft.project !== "object" || draft.project === null) return null;
    return draft as ProjectDraft;
  }

  async clear(): Promise<void> {
    await this.store.delete(KEY);
  }
}
```

`src/client/storage/BrandRepository.ts`:
```ts
import { ValidationError } from "@/domain/errors";
import type { KeyValueStore } from "./KeyValueStore";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export interface StoredBrand {
  values: Record<string, string>;
  logo: Blob | null;
  updatedAt: string;
}

export class BrandRepository {
  constructor(
    private readonly store: KeyValueStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async save(templateId: string, values: Record<string, string>, logo: Blob | null): Promise<void> {
    if (!templateId) throw new ValidationError("Chưa chọn phong cách video");
    if (logo && logo.size > MAX_LOGO_BYTES) throw new ValidationError("Logo tối đa 5 MB");
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) if (typeof value === "string") clean[key] = value;
    const stored: StoredBrand = { values: clean, logo, updatedAt: this.now().toISOString() };
    await this.store.set(`brand:${templateId}`, stored);
  }

  async load(templateId: string): Promise<StoredBrand | null> {
    const value = await this.store.get<unknown>(`brand:${templateId}`);
    if (typeof value !== "object" || value === null) return null;
    const brand = value as Partial<StoredBrand>;
    if (typeof brand.values !== "object" || brand.values === null) return null;
    return { values: brand.values, logo: brand.logo instanceof Blob ? brand.logo : null, updatedAt: String(brand.updatedAt ?? "") };
  }
}
```

`src/client/storage/UploadRepository.ts`:
```ts
import { randomIds, type IdGenerator } from "@/domain/ids";
import type { UploadKind } from "@/domain/UploadKind";
import type { KeyValueStore } from "./KeyValueStore";

const PREFIX = "blob:";

export interface UploadMeta {
  id: string;
  name: string;
  kind: UploadKind;
  size: number;
  addedAt: string;
}

export interface StoredUpload extends UploadMeta {
  blob: Blob;
}

export class UploadRepository {
  constructor(
    private readonly store: KeyValueStore,
    private readonly nextId: IdGenerator = randomIds(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async put(blob: Blob, info: { name: string; kind: UploadKind }): Promise<UploadMeta> {
    const meta: UploadMeta = {
      id: `upload-${this.nextId()}`,
      name: info.name,
      kind: info.kind,
      size: blob.size,
      addedAt: this.now().toISOString(),
    };
    const stored: StoredUpload = { ...meta, blob };
    await this.store.set(`${PREFIX}${meta.id}`, stored);
    return meta;
  }

  async get(id: string): Promise<StoredUpload | null> {
    return (await this.store.get<StoredUpload>(`${PREFIX}${id}`)) ?? null;
  }

  async delete(id: string): Promise<void> {
    await this.store.delete(`${PREFIX}${id}`);
  }

  async list(): Promise<UploadMeta[]> {
    const metas: UploadMeta[] = [];
    for (const key of await this.store.keys(PREFIX)) {
      const stored = await this.store.get<StoredUpload>(key);
      if (stored) metas.push({ id: stored.id, name: stored.name, kind: stored.kind, size: stored.size, addedAt: stored.addedAt });
    }
    return metas.sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id));
  }

  async totalBytes(): Promise<number> {
    return (await this.list()).reduce((sum, m) => sum + m.size, 0);
  }
}
```

- [ ] **Step 4: Chạy test, typecheck, lint** — `npx vitest run` → PASS; sạch.

- [ ] **Step 5: Commit** (điều phối viên) — `feat(storage): bản nháp, bộ thương hiệu và file tải lên theo repository`

---

### Task 5: Đoán từ khoá tiếng Anh từ câu tin (`KeywordSuggester` + từ điển)

**Files:**
- Create: `src/data/news-keywords.json`, `src/client/services/KeywordSuggester.ts`
- Test: `tests/client/services/KeywordSuggester.test.ts`

**Interfaces:**
- Consumes: `resolveJsonModule` đã bật trong `tsconfig.json`.
- Produces:
  - `interface KeywordEntry { vi: string[]; en: string }`
  - `class KeywordSuggester { constructor(entries: readonly KeywordEntry[], fallback = "news"); suggest(sentence: string, maxQueries = 3): string[] }` — trả tối đa `maxQueries` từ khoá tiếng Anh, xếp theo tổng độ dài cụm khớp (giảm dần) rồi theo vị trí xuất hiện đầu tiên; không khớp gì → `[fallback]`.
  - `defaultKeywordSuggester(fallback?: string): KeywordSuggester` (dùng `src/data/news-keywords.json`).
- Quy tắc khớp: khớp cụm dài trước; mỗi vùng ký tự chỉ được một cụm "giành"; chỉ khớp ở ranh giới từ (ký tự liền trước/sau không phải chữ cái hay chữ số); so khớp **giữ nguyên dấu** (chuẩn hoá NFC, chữ thường). **Chỉ khi câu hoàn toàn không có dấu tiếng Việt** (người dùng gõ không dấu) mới so khớp theo bản bỏ dấu, và bỏ qua cụm ngắn hơn 4 ký tự (tránh `cho`/`chó`/`chợ` nhập nhằng).

- [ ] **Step 1: Viết `src/data/news-keywords.json`** (chép nguyên văn)

```json
[
  { "vi": ["công an", "cảnh sát", "cơ quan điều tra", "điều tra viên"], "en": "police" },
  { "vi": ["khởi tố", "bị can", "bị cáo", "truy tố"], "en": "court gavel" },
  { "vi": ["xét xử", "phiên toà", "phiên tòa", "toà án", "tòa án", "hội đồng xét xử"], "en": "courtroom" },
  { "vi": ["bắt giữ", "bắt tạm giam", "tạm giam", "còng tay"], "en": "handcuffs" },
  { "vi": ["tội phạm", "vụ án", "đối tượng"], "en": "crime scene" },
  { "vi": ["ma tuý", "ma túy", "heroin", "thuốc lắc"], "en": "drugs police" },
  { "vi": ["lừa đảo", "chiếm đoạt", "lạm quyền", "tham nhũng", "hối lộ"], "en": "corruption" },
  { "vi": ["luật", "bộ luật", "nghị định", "quy định", "pháp luật", "luật sư"], "en": "law books" },
  { "vi": ["cháy", "hoả hoạn", "hỏa hoạn", "đám cháy"], "en": "fire" },
  { "vi": ["cứu hộ", "cứu nạn", "lực lượng cứu hộ"], "en": "rescue team" },
  { "vi": ["giam giữ", "nhà tù", "trại giam"], "en": "prison" },
  { "vi": ["trộm", "cướp", "đột nhập", "móc túi"], "en": "robbery" },
  { "vi": ["đánh nhau", "hành hung", "bạo lực", "gây rối"], "en": "fight" },
  { "vi": ["biểu tình", "phản đối", "đình công"], "en": "protest" },
  { "vi": ["chiến tranh", "xung đột", "ukraine", "gaza", "quân sự"], "en": "war" },
  { "vi": ["điều tra", "kết luận", "thanh tra", "kiểm tra", "kiểm toán"], "en": "inspection documents" },
  { "vi": ["hồ sơ", "giấy tờ", "văn bản", "chữ ký", "hợp đồng"], "en": "documents signing" },
  { "vi": ["cảnh báo", "khẩn cấp", "nguy hiểm"], "en": "warning sign" },
  { "vi": ["tiền", "tiền mặt", "tỷ đồng", "triệu đồng", "nghìn đồng"], "en": "money cash" },
  { "vi": ["ngân hàng", "lãi suất", "tín dụng", "khoản vay"], "en": "bank" },
  { "vi": ["chứng khoán", "cổ phiếu", "vn-index"], "en": "stock market" },
  { "vi": ["giá vàng", "vàng miếng", "thị trường vàng"], "en": "gold bars" },
  { "vi": ["giá xăng", "xăng dầu", "dầu thô"], "en": "gas station" },
  { "vi": ["bất động sản", "nhà đất", "căn hộ", "chung cư"], "en": "apartment buildings" },
  { "vi": ["đất", "thửa đất", "quyền sử dụng đất", "đất đai"], "en": "land plot" },
  { "vi": ["trụ sở", "ủy ban", "uỷ ban", "công sở", "ubnd", "trụ sở làm việc", "nhà nước"], "en": "government office building" },
  { "vi": ["doanh nghiệp", "công ty", "tập đoàn", "nhà máy"], "en": "business office" },
  { "vi": ["xuất khẩu", "nhập khẩu", "hải quan", "cảng"], "en": "container port" },
  { "vi": ["nông sản", "nông dân", "thu hoạch", "lúa", "gạo"], "en": "rice field" },
  { "vi": ["lạm phát", "giá cả", "tăng giá", "giảm giá"], "en": "price tag" },
  { "vi": ["thuế", "nộp thuế", "ngân sách"], "en": "tax documents" },
  { "vi": ["lao động", "việc làm", "thất nghiệp", "tuyển dụng"], "en": "workers" },
  { "vi": ["thị trường", "mua sắm", "siêu thị", "chợ"], "en": "market shopping" },
  { "vi": ["du lịch", "khách du lịch", "khách sạn", "resort"], "en": "tourism" },
  { "vi": ["hàng không", "máy bay", "sân bay", "chuyến bay"], "en": "airport airplane" },
  { "vi": ["cửa hàng", "bán hàng", "kinh doanh", "thương mại điện tử", "giao hàng"], "en": "online shopping delivery" },
  { "vi": ["giá điện", "hoá đơn", "hóa đơn"], "en": "electricity bill" },
  { "vi": ["điện lực", "mất điện", "lưới điện", "cột điện"], "en": "power lines" },
  { "vi": ["tai nạn giao thông", "va chạm", "tai nạn", "đâm xe"], "en": "car accident" },
  { "vi": ["giao thông", "ùn tắc", "kẹt xe", "đường phố"], "en": "traffic" },
  { "vi": ["đường cao tốc", "cao tốc", "đường bộ", "cây cầu"], "en": "highway" },
  { "vi": ["tàu hoả", "tàu hỏa", "đường sắt", "metro", "tàu điện"], "en": "train" },
  { "vi": ["xe máy", "mô tô", "xe gắn máy"], "en": "motorbike" },
  { "vi": ["ô tô", "xe hơi", "xe tải", "xe khách"], "en": "car road" },
  { "vi": ["xe buýt", "bến xe", "vận tải", "logistics"], "en": "bus station" },
  { "vi": ["bão", "áp thấp nhiệt đới", "siêu bão"], "en": "storm" },
  { "vi": ["mưa lớn", "mưa lũ", "lũ lụt", "ngập lụt", "ngập", "lũ quét"], "en": "flood" },
  { "vi": ["sạt lở", "lở đất", "sạt lở đất", "sụt lún"], "en": "landslide" },
  { "vi": ["nắng nóng", "nhiệt độ", "hạn hán", "khô hạn"], "en": "heat drought" },
  { "vi": ["thời tiết", "dự báo thời tiết", "không khí lạnh", "rét"], "en": "weather clouds" },
  { "vi": ["động đất", "sóng thần"], "en": "earthquake" },
  { "vi": ["bệnh viện", "bác sĩ", "y tế", "điều trị", "khám bệnh"], "en": "hospital doctor" },
  { "vi": ["dịch bệnh", "covid", "virus", "lây nhiễm", "sốt xuất huyết"], "en": "virus" },
  { "vi": ["vaccine", "vắc xin", "tiêm chủng", "tiêm"], "en": "vaccine" },
  { "vi": ["thuốc", "dược", "dược phẩm"], "en": "medicine pills" },
  { "vi": ["ngộ độc", "thực phẩm bẩn", "vệ sinh an toàn thực phẩm"], "en": "food safety" },
  { "vi": ["sức khoẻ", "sức khỏe", "dinh dưỡng", "tập thể dục"], "en": "healthy lifestyle" },
  { "vi": ["học sinh", "trường học", "giáo viên", "lớp học"], "en": "classroom students" },
  { "vi": ["đại học", "sinh viên", "tuyển sinh", "tốt nghiệp"], "en": "university graduation" },
  { "vi": ["thi tốt nghiệp", "kỳ thi", "điểm thi", "thí sinh"], "en": "exam" },
  { "vi": ["trường mầm non", "mầm non", "nhà trẻ"], "en": "kindergarten" },
  { "vi": ["thủ tướng", "chính phủ", "bộ trưởng"], "en": "government meeting" },
  { "vi": ["quốc hội", "đại biểu", "nghị quyết"], "en": "parliament" },
  { "vi": ["chủ tịch", "tổng bí thư", "lãnh đạo", "hội nghị", "cuộc họp"], "en": "conference meeting" },
  { "vi": ["bầu cử", "cử tri", "bỏ phiếu"], "en": "voting" },
  { "vi": ["quân đội", "bộ đội", "biên giới", "hải quân", "quốc phòng"], "en": "military" },
  { "vi": ["ngoại giao", "đại sứ", "hiệp định", "hợp tác quốc tế"], "en": "diplomacy flags" },
  { "vi": ["trẻ em", "em nhỏ", "thiếu nhi"], "en": "children" },
  { "vi": ["người cao tuổi", "cụ bà", "cụ ông", "hưu trí", "lương hưu"], "en": "elderly" },
  { "vi": ["gia đình", "vợ chồng", "phụ nữ", "bà mẹ"], "en": "family" },
  { "vi": ["người dân", "cộng đồng", "dân cư", "khu dân cư"], "en": "crowd people" },
  { "vi": ["hộ nghèo", "từ thiện", "cứu trợ", "nghèo"], "en": "charity donation" },
  { "vi": ["thanh niên", "giới trẻ", "tình nguyện"], "en": "young volunteers" },
  { "vi": ["tôn giáo", "chùa", "nhà thờ", "lễ hội"], "en": "temple festival" },
  { "vi": ["tết", "tết nguyên đán", "ngày lễ"], "en": "lunar new year" },
  { "vi": ["thông báo", "họp báo", "phát ngôn", "phóng viên", "báo chí", "nhà báo"], "en": "press conference" },
  { "vi": ["công nghệ", "trí tuệ nhân tạo", "chatgpt", "dữ liệu"], "en": "artificial intelligence" },
  { "vi": ["điện thoại", "smartphone", "iphone", "ứng dụng"], "en": "smartphone" },
  { "vi": ["mạng xã hội", "facebook", "tiktok", "youtube", "internet"], "en": "social media" },
  { "vi": ["an ninh mạng", "tin tặc", "hacker", "lừa đảo trực tuyến"], "en": "cyber security" },
  { "vi": ["xe điện", "trạm sạc"], "en": "electric car charging" },
  { "vi": ["pin", "năng lượng", "điện mặt trời", "năng lượng mặt trời"], "en": "solar panels" },
  { "vi": ["máy tính", "phần mềm", "lập trình", "chip", "bán dẫn"], "en": "computer technology" },
  { "vi": ["robot", "tự động hoá", "tự động hóa", "drone", "máy bay không người lái"], "en": "robot" },
  { "vi": ["vệ tinh", "vũ trụ", "tên lửa", "nasa"], "en": "space rocket" },
  { "vi": ["bóng đá", "cầu thủ", "huấn luyện viên", "sea games", "world cup", "v-league"], "en": "football stadium" },
  { "vi": ["bóng chuyền", "bóng rổ", "tennis", "cầu lông"], "en": "sports match" },
  { "vi": ["huy chương", "vô địch", "olympic", "giải đấu", "thi đấu"], "en": "sports medal" },
  { "vi": ["chạy bộ", "marathon", "điền kinh", "bơi lội"], "en": "running athlete" },
  { "vi": ["võ thuật", "boxing", "karate", "taekwondo"], "en": "martial arts" },
  { "vi": ["ca sĩ", "nghệ sĩ", "âm nhạc", "concert", "buổi hoà nhạc"], "en": "concert stage" },
  { "vi": ["phim", "điện ảnh", "diễn viên", "liên hoan phim"], "en": "cinema" },
  { "vi": ["hoa hậu", "người đẹp", "thời trang", "người mẫu"], "en": "fashion show" },
  { "vi": ["sách", "văn học", "nhà văn", "thư viện"], "en": "books library" },
  { "vi": ["di sản", "di tích", "bảo tàng", "lịch sử"], "en": "historic temple" },
  { "vi": ["ẩm thực", "món ăn", "nhà hàng", "đầu bếp", "phở"], "en": "vietnamese food" },
  { "vi": ["rác thải", "ô nhiễm", "nhựa", "rác"], "en": "plastic waste pollution" },
  { "vi": ["ô nhiễm không khí", "bụi mịn", "khói bụi", "khí thải"], "en": "air pollution" },
  { "vi": ["rừng", "cháy rừng", "phá rừng", "động vật hoang dã"], "en": "forest" },
  { "vi": ["biển", "bãi biển", "hải sản", "ngư dân", "đánh bắt"], "en": "ocean fishing boat" },
  { "vi": ["sông", "hồ nước", "kênh", "nước sạch", "nguồn nước", "nước"], "en": "river water" },
  { "vi": ["biến đổi khí hậu", "nóng lên toàn cầu", "khí hậu"], "en": "climate change" },
  { "vi": ["núi", "đồi", "cao nguyên", "thung lũng"], "en": "mountains" },
  { "vi": ["thú cưng", "chó", "mèo", "động vật"], "en": "animals" },
  { "vi": ["bông hoa", "vườn hoa", "hoa tươi", "hoa", "vườn", "cây xanh", "trồng cây"], "en": "flowers garden" },
  { "vi": ["hà nội", "thủ đô"], "en": "hanoi city" },
  { "vi": ["thành phố hồ chí minh", "tp.hcm", "sài gòn", "tp hcm"], "en": "ho chi minh city" },
  { "vi": ["đà nẵng", "huế", "hội an", "miền trung"], "en": "da nang bridge" },
  { "vi": ["vịnh hạ long", "quảng ninh", "hạ long"], "en": "ha long bay" },
  { "vi": ["đồng bằng sông cửu long", "miền tây", "cần thơ", "cửu long"], "en": "mekong delta" },
  { "vi": ["việt nam", "đất nước", "quốc gia", "cờ đỏ sao vàng", "quốc kỳ"], "en": "vietnam flag" },
  { "vi": ["nước ngoài", "quốc tế", "thế giới", "toàn cầu"], "en": "world globe" },
  { "vi": ["mỹ", "hoa kỳ", "washington", "tổng thống mỹ"], "en": "united states flag" },
  { "vi": ["trung quốc", "bắc kinh"], "en": "china skyline" },
  { "vi": ["châu âu", "liên minh châu âu", "eu"], "en": "europe flags" },
  { "vi": ["xây dựng", "công trình", "dự án", "thi công", "công trường"], "en": "construction site" },
  { "vi": ["cầu đường", "hạ tầng", "giải phóng mặt bằng"], "en": "infrastructure road construction" },
  { "vi": ["căn nhà", "ngôi nhà", "nhà ở"], "en": "house" }
]
```

- [ ] **Step 2: Viết test `tests/client/services/KeywordSuggester.test.ts`**

```ts
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
```

- [ ] **Step 3: Chạy để thấy lỗi** — `npx vitest run tests/client/services/KeywordSuggester.test.ts` → FAIL (không tìm thấy module `KeywordSuggester`). Ghi lại.

- [ ] **Step 4: Viết `src/client/services/KeywordSuggester.ts`**

```ts
import newsKeywords from "@/data/news-keywords.json";

export interface KeywordEntry {
  vi: string[];
  en: string;
}

interface Phrase {
  text: string;
  en: string;
}

const MIN_FOLDED_LENGTH = 4;

const exactForm = (s: string) => s.normalize("NFC").toLocaleLowerCase("vi");
const foldForm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
const hasVietnameseMarks = (s: string) => /[^\u0000-\u007f]/.test(s);
const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

function buildPhrases(entries: readonly KeywordEntry[], form: (s: string) => string, minLength: number): Phrase[] {
  const seen = new Set<string>();
  const list: Phrase[] = [];
  for (const entry of entries) {
    for (const raw of entry.vi) {
      const text = form(raw).trim();
      if (text.length < minLength || seen.has(text)) continue;
      seen.add(text);
      list.push({ text, en: entry.en });
    }
  }
  return list.sort((a, b) => b.text.length - a.text.length);
}

export class KeywordSuggester {
  private readonly exact: Phrase[];
  private readonly folded: Phrase[];

  constructor(
    entries: readonly KeywordEntry[],
    private readonly fallback = "news",
  ) {
    this.exact = buildPhrases(entries, exactForm, 1);
    this.folded = buildPhrases(entries, foldForm, MIN_FOLDED_LENGTH);
  }

  /** Tối đa `maxQueries` từ khoá tiếng Anh cho một câu tin; không khớp gì thì trả [fallback]. */
  suggest(sentence: string, maxQueries = 3): string[] {
    const typedWithoutMarks = !hasVietnameseMarks(sentence);
    const text = typedWithoutMarks ? foldForm(sentence) : exactForm(sentence);
    const phrases = typedWithoutMarks ? this.folded : this.exact;

    const claimed = new Array<boolean>(text.length).fill(false);
    const scores = new Map<string, { weight: number; first: number }>();
    for (const { text: phrase, en } of phrases) {
      let from = 0;
      for (;;) {
        const at = text.indexOf(phrase, from);
        if (at < 0) break;
        from = at + 1;
        const end = at + phrase.length;
        if (isWordChar(text[at - 1]) || isWordChar(text[end])) continue;
        if (claimed.slice(at, end).some(Boolean)) continue;
        claimed.fill(true, at, end);
        const current = scores.get(en);
        scores.set(en, { weight: (current?.weight ?? 0) + phrase.length, first: Math.min(current?.first ?? at, at) });
      }
    }

    const ranked = [...scores.entries()]
      .sort((a, b) => b[1].weight - a[1].weight || a[1].first - b[1].first)
      .slice(0, maxQueries)
      .map(([en]) => en);
    return ranked.length > 0 ? ranked : [this.fallback];
  }
}

export function defaultKeywordSuggester(fallback = "news"): KeywordSuggester {
  return new KeywordSuggester(newsKeywords as KeywordEntry[], fallback);
}
```

- [ ] **Step 5: Chạy test, typecheck, lint** — `npx vitest run tests/client/services/KeywordSuggester.test.ts` → PASS. `npm run typecheck`, `npm run lint` → sạch.
> Các test "từ điển thật" kiểm đúng dữ liệu đã chép ở Step 1. Nếu một test thất bại vì một cụm bị trùng/khác, **không sửa kỳ vọng**: báo cụm cụ thể và kết quả thực tế để điều phối viên quyết định sửa từ điển hay sửa test.

- [ ] **Step 6: Commit** (điều phối viên) — `feat(services): đoán từ khoá tiếng Anh từ câu tin + từ điển tin tức`

---

### Task 6: Client tìm cảnh trám và đổi kết quả thành `Footage`

**Files:**
- Create: `src/client/services/apiError.ts`, `src/client/services/StockClient.ts`, `src/client/media/footageFactory.ts`
- Modify: `src/client/services/TtsClient.ts`
- Test: `tests/client/services/apiError.test.ts`, `tests/client/services/StockClient.test.ts`, `tests/client/services/TtsClient.test.ts`, `tests/client/media/footageFactory.test.ts`

**Interfaces:**
- Consumes: `ApiError` (`src/client/services/AuthClient.ts`), `ImageFootage`, `VideoFootage`, `Footage`, `FootageSource`, `ValidationError`.
- Produces:
  - `readApiError(response: Response): Promise<ApiError>` — đọc `{ error: { code, message } }`, mặc định `INTERNAL` / `"Lỗi máy chủ"`.
  - `interface StockItemDto { provider: "pexels" | "pixabay" | "fake"; id: string; kind: "image" | "video"; thumbUrl: string; fullUrl: string; width: number; height: number; durationSec?: number; author: string; pageUrl: string }`, `interface StockSearchResponse { items: StockItemDto[]; warnings: string[] }`, `interface StockApi { search(query: string, kind: "image" | "video", options?: { page?: number; perPage?: number }): Promise<StockSearchResponse> }`, `class StockClient implements StockApi { constructor(fetchImpl?: typeof fetch) }` — gọi `GET /api/stock/search?q=&kind=&page=&perPage=`.
  - `stockItemToFootage(item: StockItemDto, id: string): Footage`; `uploadToFootage(id: string, uploadId: string, kind: "image" | "video", probe: { width: number; height: number; durationSec?: number }): Footage` (nguồn `{ origin: "upload", uri: "upload:<uploadId>" }`).
  - `TtsClient` dùng `readApiError` (hành vi không đổi).

- [ ] **Step 1: Viết test**

`tests/client/services/apiError.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { readApiError } from "@/client/services/apiError";
import { ApiError } from "@/client/services/AuthClient";

describe("readApiError", () => {
  it("đọc code và message của server", async () => {
    const res = Response.json({ error: { code: "QUOTA", message: "Hết hạn mức" } }, { status: 429 });
    const err = await readApiError(res);
    expect(err).toBeInstanceOf(ApiError);
    expect([err.status, err.code, err.message]).toEqual([429, "QUOTA", "Hết hạn mức"]);
  });

  it("thân không phải JSON thì dùng mặc định", async () => {
    const err = await readApiError(new Response("<html>lỗi</html>", { status: 502 }));
    expect([err.status, err.code, err.message]).toEqual([502, "INTERNAL", "Lỗi máy chủ"]);
  });
});
```

`tests/client/services/TtsClient.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/client/services/AuthClient";
import { TtsClient } from "@/client/services/TtsClient";

describe("TtsClient", () => {
  it("voices trả danh sách giọng", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ voices: [{ name: "vi-VN-A", gender: "FEMALE", tier: "x" }] }));
    const voices = await new TtsClient(fetchImpl as unknown as typeof fetch).voices();
    expect(voices).toEqual([{ name: "vi-VN-A", gender: "FEMALE", tier: "x" }]);
    expect(fetchImpl).toHaveBeenCalledWith("/api/tts/voices");
  });

  it("synthesize gửi JSON và trả ArrayBuffer", async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    const buf = await new TtsClient(fetchImpl as unknown as typeof fetch).synthesize("Xin chào.", "vi-VN-A", 1.07);
    expect(Array.from(new Uint8Array(buf))).toEqual([1, 2, 3]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/tts");
    expect(JSON.parse(init.body as string)).toEqual({ text: "Xin chào.", voiceName: "vi-VN-A", speakingRate: 1.07 });
  });

  it("lỗi server thành ApiError với thông báo của server", async () => {
    const client = new TtsClient((async () =>
      Response.json({ error: { code: "QUOTA", message: "Hết hạn mức giọng đọc hôm nay, liên hệ Hải" } }, { status: 429 })) as unknown as typeof fetch);
    await expect(client.synthesize("a", "vi-VN-A", 1)).rejects.toBeInstanceOf(ApiError);
    await expect(client.voices()).rejects.toThrow("Hết hạn mức giọng đọc hôm nay, liên hệ Hải");
  });
});
```

`tests/client/services/StockClient.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/client/services/AuthClient";
import { StockClient, type StockItemDto } from "@/client/services/StockClient";
import type { StockItem } from "@/server/stock/StockProvider";

// Kiểm hợp đồng kiểu: StockItem của server gán được cho StockItemDto của client (typecheck sẽ báo nếu lệch).
export const contract = (item: StockItem): StockItemDto => item;

const item: StockItemDto = {
  provider: "pexels",
  id: "pexels-photo-1",
  kind: "image",
  thumbUrl: "https://t",
  fullUrl: "https://f",
  width: 10,
  height: 10,
  author: "An",
  pageUrl: "https://p",
};

describe("StockClient", () => {
  it("gọi đúng URL với tham số đã mã hoá và trả kết quả", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ items: [item], warnings: ["pixabay: lỗi"] }));
    const out = await new StockClient(fetchImpl as unknown as typeof fetch).search("police car", "video", { page: 2, perPage: 6 });
    expect(out).toEqual({ items: [item], warnings: ["pixabay: lỗi"] });
    expect(fetchImpl).toHaveBeenCalledWith("/api/stock/search?q=police+car&kind=video&page=2&perPage=6");
  });

  it("mặc định page=1, perPage=8", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ items: [], warnings: [] }));
    await new StockClient(fetchImpl as unknown as typeof fetch).search("a", "image");
    expect(fetchImpl).toHaveBeenCalledWith("/api/stock/search?q=a&kind=image&page=1&perPage=8");
  });

  it("lỗi server thành ApiError", async () => {
    const client = new StockClient((async () =>
      Response.json({ error: { code: "UPSTREAM", message: "Không tìm được cảnh trám" } }, { status: 502 })) as unknown as typeof fetch);
    await expect(client.search("a", "image")).rejects.toBeInstanceOf(ApiError);
  });
});
```

`tests/client/media/footageFactory.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { stockItemToFootage, uploadToFootage } from "@/client/media/footageFactory";
import type { StockItemDto } from "@/client/services/StockClient";
import { ValidationError } from "@/domain/errors";

const base: StockItemDto = {
  provider: "pixabay",
  id: "pixabay-photo-9",
  kind: "image",
  thumbUrl: "https://t",
  fullUrl: "https://f.jpg",
  width: 1600,
  height: 900,
  author: "Cường",
  pageUrl: "https://p/9",
};

describe("stockItemToFootage", () => {
  it("ảnh thành ImageFootage mang nguồn, tác giả, trang gốc", () => {
    const f = stockItemToFootage(base, "f1");
    expect(f.snapshot()).toEqual({
      kind: "image",
      id: "f1",
      source: { origin: "pixabay", uri: "https://f.jpg", credit: "Cường", pageUrl: "https://p/9" },
      width: 1600,
      height: 900,
    });
  });

  it("video thành VideoFootage có độ dài; thiếu độ dài thì ném ValidationError", () => {
    const v = stockItemToFootage({ ...base, kind: "video", durationSec: 11.8 }, "f2");
    expect(v.snapshot()).toMatchObject({ kind: "video", durationSec: 11.8 });
    expect(() => stockItemToFootage({ ...base, kind: "video" }, "f3")).toThrow(ValidationError);
  });
});

describe("uploadToFootage", () => {
  it("ảnh tải lên dùng uri upload:<id>", () => {
    expect(uploadToFootage("f1", "upload-u1", "image", { width: 800, height: 600 }).snapshot()).toEqual({
      kind: "image",
      id: "f1",
      source: { origin: "upload", uri: "upload:upload-u1" },
      width: 800,
      height: 600,
    });
  });

  it("video tải lên cần độ dài", () => {
    expect(uploadToFootage("f2", "upload-u2", "video", { width: 1080, height: 1920, durationSec: 7 }).kind).toBe("video");
    expect(() => uploadToFootage("f2", "upload-u2", "video", { width: 1, height: 1 })).toThrow("Video thiếu độ dài");
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/services tests/client/media/footageFactory.test.ts` → FAIL (không tìm thấy module). Ghi lại.

- [ ] **Step 3: Viết code**

`src/client/services/apiError.ts`:
```ts
import { ApiError } from "./AuthClient";

export async function readApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  return new ApiError(response.status, body?.error?.code ?? "INTERNAL", body?.error?.message ?? "Lỗi máy chủ");
}
```

`src/client/services/TtsClient.ts`: xoá hàm cục bộ `toApiError` (và dòng `import { ApiError } from "./AuthClient";` nếu không còn dùng), thêm `import { readApiError } from "./apiError";` và đổi hai chỗ `throw await toApiError(response)` thành `throw await readApiError(response)`.

`src/client/services/StockClient.ts`:
```ts
import { readApiError } from "./apiError";

export interface StockItemDto {
  provider: "pexels" | "pixabay" | "fake";
  id: string;
  kind: "image" | "video";
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  durationSec?: number;
  author: string;
  pageUrl: string;
}

export interface StockSearchResponse {
  items: StockItemDto[];
  warnings: string[];
}

export interface StockApi {
  search(query: string, kind: "image" | "video", options?: { page?: number; perPage?: number }): Promise<StockSearchResponse>;
}

export class StockClient implements StockApi {
  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async search(
    query: string,
    kind: "image" | "video",
    options: { page?: number; perPage?: number } = {},
  ): Promise<StockSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      kind,
      page: String(options.page ?? 1),
      perPage: String(options.perPage ?? 8),
    });
    const response = await this.fetchImpl(`/api/stock/search?${params}`);
    if (!response.ok) throw await readApiError(response);
    return (await response.json()) as StockSearchResponse;
  }
}
```

`src/client/media/footageFactory.ts`:
```ts
import { ImageFootage, VideoFootage, type Footage, type FootageSource } from "@/domain/Footage";
import { ValidationError } from "@/domain/errors";
import type { StockItemDto } from "@/client/services/StockClient";

export function stockItemToFootage(item: StockItemDto, id: string): Footage {
  const source: FootageSource = { origin: item.provider, uri: item.fullUrl, credit: item.author, pageUrl: item.pageUrl };
  if (item.kind === "image") return new ImageFootage(id, source, item.width, item.height);
  if (!item.durationSec) throw new ValidationError("Video thiếu độ dài");
  return new VideoFootage(id, source, item.width, item.height, item.durationSec);
}

export function uploadToFootage(
  id: string,
  uploadId: string,
  kind: "image" | "video",
  probe: { width: number; height: number; durationSec?: number },
): Footage {
  const source: FootageSource = { origin: "upload", uri: `upload:${uploadId}` };
  if (kind === "image") return new ImageFootage(id, source, probe.width, probe.height);
  if (!probe.durationSec) throw new ValidationError("Video thiếu độ dài");
  return new VideoFootage(id, source, probe.width, probe.height, probe.durationSec);
}
```

- [ ] **Step 4: Chạy test, typecheck, lint** — `npx vitest run` → PASS (kể cả `tests/client/DevRenderController.test.ts` dùng `TtsApi`). `npm run typecheck`, `npm run lint` → sạch.

- [ ] **Step 5: Commit** (điều phối viên) — `feat(services): client tìm cảnh trám và đổi kết quả/tải lên thành Footage`

---

### Task 7: Kho nhạc, kiểm tra file tải lên, dò thông tin media

**Files:**
- Create: `src/client/services/MusicLibrary.ts`, `src/client/media/UploadValidator.ts`, `src/client/media/MediaProbe.ts`
- Test: `tests/client/services/MusicLibrary.test.ts`, `tests/client/media/UploadValidator.test.ts`

**Interfaces:**
- Consumes: `MusicTrack`, `UploadKind` (Task 4), `ValidationError`, `AudioDecodeService` (chặng 2), `zod` (đã có).
- Produces:
  - `class MusicLibrary { constructor(fetchImpl?: typeof fetch, url = "/music/manifest.json"); list(): Promise<MusicTrack[]> }` — `MusicTrack` mang `origin: "library"`, `uri` = trường `file`; lưu kết quả sau lần tải đầu; lỗi tải → `Error("Không tải được kho nhạc")`; manifest sai → `Error("Kho nhạc sai định dạng")`.
  - `UPLOAD_LIMITS = { image: 20 MB, video: 300 MB, audio: 30 MB }`; `classifyUpload(file: { name: string; type: string; size: number }, allowed?: readonly UploadKind[]): UploadKind` — ném `ValidationError` tiếng Việt khi rỗng / sai định dạng / quá lớn / loại không được phép.
  - `interface MediaProbe { image(blob: Blob): Promise<{ width: number; height: number }>; video(blob: Blob): Promise<{ width: number; height: number; durationSec: number }>; audio(blob: Blob): Promise<{ durationSec: number }> }`; `class BrowserMediaProbe implements MediaProbe { constructor(decoder: AudioDecodeService) }` — chỉ kiểm bằng typecheck/build ở 3B, kiểm trong trình duyệt ở 3C.

- [ ] **Step 1: Viết test**

`tests/client/services/MusicLibrary.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { MusicLibrary } from "@/client/services/MusicLibrary";

const manifest = [
  { id: "ban-tin-mac-dinh", title: "Bản tin (mặc định)", file: "/music/ban-tin-mac-dinh.mp3", note: "tự soạn" },
  { id: "nhe-nhang", title: "Nhẹ nhàng", file: "/music/nhe-nhang.mp3" },
];

describe("MusicLibrary", () => {
  it("đọc manifest thành các MusicTrack của kho", async () => {
    const fetchImpl = vi.fn(async () => Response.json(manifest));
    const tracks = await new MusicLibrary(fetchImpl as unknown as typeof fetch).list();
    expect(tracks.map((t) => t.snapshot())).toEqual([
      { id: "ban-tin-mac-dinh", title: "Bản tin (mặc định)", origin: "library", uri: "/music/ban-tin-mac-dinh.mp3", gainOffsetDb: 0 },
      { id: "nhe-nhang", title: "Nhẹ nhàng", origin: "library", uri: "/music/nhe-nhang.mp3", gainOffsetDb: 0 },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith("/music/manifest.json");
  });

  it("chỉ tải một lần, các lần sau dùng bản đã lưu", async () => {
    const fetchImpl = vi.fn(async () => Response.json(manifest));
    const lib = new MusicLibrary(fetchImpl as unknown as typeof fetch);
    await lib.list();
    await lib.list();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("tải lỗi thì báo tiếng Việt và lần sau thử lại được", async () => {
    let ok = false;
    const fetchImpl = vi.fn(async () => (ok ? Response.json(manifest) : new Response("", { status: 404 })));
    const lib = new MusicLibrary(fetchImpl as unknown as typeof fetch);
    await expect(lib.list()).rejects.toThrow("Không tải được kho nhạc");
    ok = true;
    expect(await lib.list()).toHaveLength(2);
  });

  it("manifest sai định dạng thì báo lỗi", async () => {
    const bad = (body: unknown) => new MusicLibrary((async () => Response.json(body)) as unknown as typeof fetch).list();
    await expect(bad({ không: "phải mảng" })).rejects.toThrow("Kho nhạc sai định dạng");
    await expect(bad([{ id: "x", title: "t", file: "khong-bat-dau-bang-gach" }])).rejects.toThrow("Kho nhạc sai định dạng");
    await expect(bad([{ id: "", title: "t", file: "/a.mp3" }])).rejects.toThrow("Kho nhạc sai định dạng");
  });

  it("kho rỗng là hợp lệ", async () => {
    expect(await new MusicLibrary((async () => Response.json([])) as unknown as typeof fetch).list()).toEqual([]);
  });
});
```

`tests/client/media/UploadValidator.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { classifyUpload, UPLOAD_LIMITS } from "@/client/media/UploadValidator";
import { ValidationError } from "@/domain/errors";

const MB = 1024 * 1024;
const file = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("classifyUpload", () => {
  it("nhận ảnh, video, nhạc theo MIME", () => {
    expect(classifyUpload(file("a.jpg", "image/jpeg"))).toBe("image");
    expect(classifyUpload(file("a.png", "image/png"))).toBe("image");
    expect(classifyUpload(file("a.webp", "image/webp"))).toBe("image");
    expect(classifyUpload(file("a.mp4", "video/mp4"))).toBe("video");
    expect(classifyUpload(file("a.webm", "video/webm"))).toBe("video");
    expect(classifyUpload(file("a.mov", "video/quicktime"))).toBe("video");
    expect(classifyUpload(file("a.mp3", "audio/mpeg"))).toBe("audio");
    expect(classifyUpload(file("a.wav", "audio/wav"))).toBe("audio");
    expect(classifyUpload(file("a.m4a", "audio/x-m4a"))).toBe("audio");
  });

  it("MIME trống hoặc lạ thì dựa vào đuôi file, không phân biệt hoa thường", () => {
    expect(classifyUpload(file("ANH.JPEG", ""))).toBe("image");
    expect(classifyUpload(file("clip.MOV", "application/octet-stream"))).toBe("video");
    expect(classifyUpload(file("nhac.M4A", ""))).toBe("audio");
  });

  it("từ chối định dạng không hỗ trợ", () => {
    expect(() => classifyUpload(file("a.gif", "image/gif"))).toThrow("Định dạng không được hỗ trợ: gif");
    expect(() => classifyUpload(file("a.txt", "text/plain"))).toThrow(ValidationError);
    expect(() => classifyUpload(file("khong-duoi", ""))).toThrow("Định dạng không được hỗ trợ");
  });

  it("từ chối file rỗng", () => {
    expect(() => classifyUpload(file("a.jpg", "image/jpeg", 0))).toThrow("File rỗng");
  });

  it("giới hạn dung lượng theo loại: ảnh 20 MB, video 300 MB, nhạc 30 MB", () => {
    expect(UPLOAD_LIMITS).toEqual({ image: 20 * MB, video: 300 * MB, audio: 30 * MB });
    expect(classifyUpload(file("a.jpg", "image/jpeg", 20 * MB))).toBe("image");
    expect(() => classifyUpload(file("a.jpg", "image/jpeg", 20 * MB + 1))).toThrow("File quá lớn (tối đa 20 MB cho ảnh)");
    expect(() => classifyUpload(file("a.mp4", "video/mp4", 300 * MB + 1))).toThrow("tối đa 300 MB cho video");
    expect(() => classifyUpload(file("a.mp3", "audio/mpeg", 30 * MB + 1))).toThrow("tối đa 30 MB cho nhạc");
  });

  it("chỉ nhận loại được phép", () => {
    expect(() => classifyUpload(file("a.mp3", "audio/mpeg"), ["image", "video"])).toThrow("Không nhận file nhạc ở đây");
    expect(classifyUpload(file("a.mp4", "video/mp4"), ["image", "video"])).toBe("video");
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/services/MusicLibrary.test.ts tests/client/media/UploadValidator.test.ts` → FAIL (không tìm thấy module). Ghi lại.

- [ ] **Step 3: Viết code**

`src/client/services/MusicLibrary.ts`:
```ts
import { z } from "zod";
import { MusicTrack } from "@/domain/MusicTrack";

const ManifestSchema = z.array(
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    file: z.string().startsWith("/"),
    note: z.string().optional(),
  }),
);

export class MusicLibrary {
  private cached: MusicTrack[] | null = null;

  constructor(
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly url = "/music/manifest.json",
  ) {}

  async list(): Promise<MusicTrack[]> {
    if (this.cached) return this.cached;
    const response = await this.fetchImpl(this.url);
    if (!response.ok) throw new Error("Không tải được kho nhạc");
    const parsed = ManifestSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new Error("Kho nhạc sai định dạng");
    this.cached = parsed.data.map((m) => MusicTrack.create({ id: m.id, title: m.title, origin: "library", uri: m.file }));
    return this.cached;
  }
}
```

`src/client/media/UploadValidator.ts`:
```ts
import { ValidationError } from "@/domain/errors";
import type { UploadKind } from "@/domain/UploadKind";

const MB = 1024 * 1024;

export const UPLOAD_LIMITS = { image: 20 * MB, video: 300 * MB, audio: 30 * MB } as const;

const LABEL: Record<UploadKind, string> = { image: "ảnh", video: "video", audio: "nhạc" };

const MIME: Record<string, UploadKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/mp3": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/wave": "audio",
  "audio/mp4": "audio",
  "audio/x-m4a": "audio",
  "audio/m4a": "audio",
};

const EXT: Record<string, UploadKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
};

export function classifyUpload(
  file: { name: string; type: string; size: number },
  allowed: readonly UploadKind[] = ["image", "video", "audio"],
): UploadKind {
  if (file.size <= 0) throw new ValidationError("File rỗng");
  const ext = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase() : "";
  const kind = MIME[file.type.toLowerCase()] ?? EXT[ext];
  if (!kind) throw new ValidationError(`Định dạng không được hỗ trợ: ${ext || file.type || "không rõ"}`);
  if (!allowed.includes(kind)) throw new ValidationError(`Không nhận file ${LABEL[kind]} ở đây`);
  if (file.size > UPLOAD_LIMITS[kind]) {
    throw new ValidationError(`File quá lớn (tối đa ${UPLOAD_LIMITS[kind] / MB} MB cho ${LABEL[kind]})`);
  }
  return kind;
}
```

`src/client/media/MediaProbe.ts`:
```ts
import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import type { AudioDecodeService } from "./AudioDecodeService";

export interface MediaProbe {
  image(blob: Blob): Promise<{ width: number; height: number }>;
  video(blob: Blob): Promise<{ width: number; height: number; durationSec: number }>;
  audio(blob: Blob): Promise<{ durationSec: number }>;
}

/** Đọc kích thước/độ dài của file người dùng tải lên bằng API của trình duyệt (cần WebCodecs/Web Audio, chỉ chạy ở luồng chính). */
export class BrowserMediaProbe implements MediaProbe {
  constructor(private readonly decoder: AudioDecodeService) {}

  async image(blob: Blob): Promise<{ width: number; height: number }> {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  }

  async video(blob: Blob): Promise<{ width: number; height: number; durationSec: number }> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track) throw new Error("File video không có hình");
      return {
        width: await track.getDisplayWidth(),
        height: await track.getDisplayHeight(),
        durationSec: await track.computeDuration(),
      };
    } finally {
      input.dispose();
    }
  }

  async audio(blob: Blob): Promise<{ durationSec: number }> {
    const decoded = await this.decoder.decode(await blob.arrayBuffer());
    return { durationSec: decoded.durationSec };
  }
}
```

- [ ] **Step 4: Chạy test, typecheck, lint, build** — `npx vitest run` → PASS; `npm run typecheck`, `npm run lint`, `npm run build` → sạch.
> `BrowserMediaProbe` không test được trên Node (cần WebCodecs / `createImageBitmap`); nói rõ trong report và để 3C kiểm trong trình duyệt.

- [ ] **Step 5: Commit** (điều phối viên) — `feat(services): kho nhạc, kiểm tra file tải lên, dò thông tin media`

---

### Task 8: Ảnh giả dạng PNG thật cho chế độ dev (`FakeStockProvider`)

**Vấn đề (review chặng 2):** `FakeStockProvider` trả ảnh SVG dạng data URI, mà `createImageBitmap` trong Chrome không đọc được SVG blob nên chế độ giả lập không dựng video được từ kết quả tìm kiếm.

**Files:**
- Create: `src/server/stock/png.ts`
- Modify: `src/server/stock/FakeStockProvider.ts`, `tests/server/http/stockRoutes.test.ts`
- Test: `tests/server/stock/png.test.ts`, `tests/server/stock/FakeStockProvider.test.ts`

**Interfaces:**
- Consumes: `StockItem`, `StockProvider`, `StockQuery` (có sẵn).
- Produces: `makeSolidPng(width: number, height: number, rgb: [number, number, number]): Uint8Array` (PNG 8-bit RGB hợp lệ, một màu); `FakeStockProvider.search` trả ảnh `data:image/png;base64,…` (`fullUrl` 1600×900, `thumbUrl` 320×180); video vẫn trả mảng rỗng.

- [ ] **Step 1: Viết test**

`tests/server/stock/png.test.ts`:
```ts
import { crc32, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { makeSolidPng } from "@/server/stock/png";

function chunks(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const out: Array<{ type: string; data: Uint8Array; crcOk: boolean }> = [];
  let offset = 8;
  while (offset < png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const data = png.subarray(offset + 8, offset + 8 + length);
    const crc = view.getUint32(offset + 8 + length);
    out.push({ type, data, crcOk: crc === crc32(png.subarray(offset + 4, offset + 8 + length)) });
    offset += 12 + length;
  }
  return out;
}

describe("makeSolidPng", () => {
  const png = makeSolidPng(40, 20, [10, 200, 30]);

  it("có chữ ký PNG và các chunk IHDR, IDAT, IEND với CRC đúng", () => {
    expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const cs = chunks(png);
    expect(cs.map((c) => c.type)).toEqual(["IHDR", "IDAT", "IEND"]);
    expect(cs.every((c) => c.crcOk)).toBe(true);
  });

  it("IHDR ghi đúng kích thước, 8-bit RGB", () => {
    const ihdr = chunks(png)[0]?.data as Uint8Array;
    const view = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength);
    expect([view.getUint32(0), view.getUint32(4), ihdr[8], ihdr[9]]).toEqual([40, 20, 8, 2]);
  });

  it("dữ liệu ảnh giải nén ra đúng số byte và đúng màu điểm ảnh", () => {
    const raw = inflateSync(chunks(png)[1]?.data as Uint8Array);
    expect(raw.length).toBe(20 * (1 + 40 * 3));
    expect(Array.from(raw.subarray(0, 4))).toEqual([0, 10, 200, 30]); // bộ lọc 0 rồi điểm ảnh đầu
    expect(Array.from(raw.subarray(raw.length - 3))).toEqual([10, 200, 30]);
  });
});
```

`tests/server/stock/FakeStockProvider.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { FakeStockProvider } from "@/server/stock/FakeStockProvider";

describe("FakeStockProvider", () => {
  const search = (kind: "image" | "video", perPage = 4, page = 1) =>
    new FakeStockProvider().search({ query: "police", kind, page, perPage });

  it("ảnh là PNG thật dạng data URI, kích thước đúng", async () => {
    const items = await search("image");
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item.fullUrl.startsWith("data:image/png;base64,")).toBe(true);
      expect(item.thumbUrl.startsWith("data:image/png;base64,")).toBe(true);
      expect([item.width, item.height, item.kind, item.provider]).toEqual([1600, 900, "image", "fake"]);
      const bytes = Buffer.from(item.fullUrl.split(",")[1] as string, "base64");
      expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(bytes.readUInt32BE(16)).toBe(1600);
      expect(bytes.readUInt32BE(20)).toBe(900);
      const thumb = Buffer.from(item.thumbUrl.split(",")[1] as string, "base64");
      expect([thumb.readUInt32BE(16), thumb.readUInt32BE(20)]).toEqual([320, 180]);
    }
  });

  it("id khác nhau giữa các trang và các màu không trùng nhau liên tiếp", async () => {
    const p1 = await search("image", 3, 1);
    const p2 = await search("image", 3, 2);
    expect(new Set([...p1, ...p2].map((i) => i.id)).size).toBe(6);
    expect(p1[0]?.fullUrl).not.toBe(p1[1]?.fullUrl);
  });

  it("video trả mảng rỗng", async () => {
    expect(await search("video")).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/server/stock` → FAIL (không tìm thấy `@/server/stock/png`; test Fake báo `data:image/png` sai). Ghi lại.

- [ ] **Step 3: Viết `src/server/stock/png.ts`**

```ts
import { crc32, deflateSync } from "node:zlib";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** PNG 8-bit RGB một màu, hợp lệ để `createImageBitmap` giải mã được (dùng cho ảnh giả khi dev). */
export function makeSolidPng(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // độ sâu bit
  ihdr[9] = 2; // RGB

  const row = new Uint8Array(1 + width * 3); // byte đầu = bộ lọc 0
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = rgb[0];
    row[2 + x * 3] = rgb[1];
    row[3 + x * 3] = rgb[2];
  }
  const raw = new Uint8Array(row.length * height);
  for (let y = 0; y < height; y++) raw.set(row, y * row.length);

  const parts = [new Uint8Array(SIGNATURE), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array())];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    png.set(p, offset);
    offset += p.length;
  }
  return png;
}
```

- [ ] **Step 4: Thay toàn bộ `src/server/stock/FakeStockProvider.ts`**

```ts
import { makeSolidPng } from "./png";
import type { StockItem, StockProvider, StockQuery } from "./StockProvider";

const COLORS: Array<[number, number, number]> = [
  [37, 99, 235],
  [22, 163, 74],
  [220, 38, 38],
  [147, 51, 234],
  [234, 88, 12],
  [8, 145, 178],
];

const cache = new Map<string, string>();

function pngDataUri(width: number, height: number, rgb: [number, number, number]): string {
  const key = `${width}x${height}:${rgb.join(",")}`;
  let uri = cache.get(key);
  if (!uri) {
    uri = `data:image/png;base64,${Buffer.from(makeSolidPng(width, height, rgb)).toString("base64")}`;
    cache.set(key, uri);
  }
  return uri;
}

export class FakeStockProvider implements StockProvider {
  readonly name = "fake" as const;

  async search(q: StockQuery): Promise<StockItem[]> {
    if (q.kind === "video") return [];
    return Array.from({ length: q.perPage }, (_, i) => {
      const n = (q.page - 1) * q.perPage + i + 1;
      const rgb = COLORS[n % COLORS.length] as [number, number, number];
      return {
        provider: this.name,
        id: `fake-${q.query}-${n}`,
        kind: "image" as const,
        thumbUrl: pngDataUri(320, 180, rgb),
        fullUrl: pngDataUri(1600, 900, rgb),
        width: 1600,
        height: 900,
        author: "Giả lập",
        pageUrl: "about:blank",
      };
    });
  }
}
```

- [ ] **Step 5: Sửa `tests/server/http/stockRoutes.test.ts`**: đổi dòng `expect(body.items[0].fullUrl.startsWith("data:image/svg+xml")).toBe(true);` thành `expect(body.items[0].fullUrl.startsWith("data:image/png;base64,")).toBe(true);`.

- [ ] **Step 6: Chạy test, typecheck, lint, build** — `npx vitest run` → PASS (kể cả `tests/server/container.test.ts` dùng stock giả). Các lệnh còn lại sạch.

- [ ] **Step 7: Commit** (điều phối viên) — `fix(stock): ảnh giả là PNG thật để createImageBitmap đọc được`

---

### Task 9: Container dịch vụ phía client và hằng số tần số mẫu

**Files:**
- Create: `src/client/container.ts`
- Modify: `src/client/media/AudioDecodeService.ts`, `src/client/controllers/DevRenderController.ts`, `src/views/dev/DevRenderPanel.tsx`
- Test: `tests/client/container.test.ts`

**Interfaces:**
- Consumes: mọi dịch vụ ở Task 3–7 và chặng 2: `IdbKeyValueStore`, `DraftRepository`, `BrandRepository`, `UploadRepository`, `TtsClient`, `StockClient`, `KeywordSuggester`/`defaultKeywordSuggester`, `MusicLibrary`, `AudioDecodeService`, `BrowserMediaProbe`, `RenderClient`, `browserSupport`, `defaultTemplateRegistry`.
- Produces:
  - `AudioDecodeService.ts` export `RENDER_SAMPLE_RATE = 48000` (mặc định của constructor); `DevRenderController` và `DevRenderPanel` dùng hằng này, bỏ số 48000 viết cứng.
  - `interface ClientEnv { fetch: typeof fetch; indexedDB: IDBFactory; origin: string; createUrl(blob: Blob): string; revokeUrl(url: string): void }`
  - `interface ClientServices { env: ClientEnv; templates: TemplateRegistry; tts: TtsApi; stock: StockApi; keywords: KeywordSuggester; music: MusicLibrary; drafts: DraftRepository; brands: BrandRepository; uploads: UploadRepository; decoder: AudioDecodeService; probe: MediaProbe; render: RenderClient; support: () => Promise<SupportReport> }`
  - `createClientServices(env: ClientEnv): ClientServices` (không chạm API trình duyệt cho tới khi dịch vụ được dùng); `browserEnv(): ClientEnv` (chỉ gọi trong trình duyệt).

- [ ] **Step 1: Viết test `tests/client/container.test.ts`**

```ts
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { createClientServices, type ClientEnv } from "@/client/container";
import { RENDER_SAMPLE_RATE } from "@/client/media/AudioDecodeService";

function fakeEnv(routes: Record<string, unknown> = {}): ClientEnv {
  return {
    fetch: vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const key = Object.keys(routes).find((k) => url.startsWith(k));
      return key ? Response.json(routes[key]) : new Response("", { status: 404 });
    }) as unknown as typeof fetch,
    indexedDB: new IDBFactory() as unknown as IDBFactory,
    origin: "http://localhost:3100",
    createUrl: () => "blob:fake",
    revokeUrl: () => {},
  };
}

describe("RENDER_SAMPLE_RATE", () => {
  it("là 48000, khớp tần số mẫu của bộ trộn và bộ giải mã", () => {
    expect(RENDER_SAMPLE_RATE).toBe(48000);
  });
});

describe("createClientServices", () => {
  it("lắp đủ dịch vụ, phong cách theanh28 có trong registry", () => {
    const s = createClientServices(fakeEnv());
    expect(s.templates.list()).toEqual([{ id: "theanh28", name: "Bản tin kiểu Theanh28" }]);
    expect(typeof s.support).toBe("function");
    expect(s.env.origin).toBe("http://localhost:3100");
  });

  it("các dịch vụ gọi API dùng đúng hàm fetch của môi trường", async () => {
    const env = fakeEnv({
      "/api/tts/voices": { voices: [{ name: "vi-VN-HoaiMyNeural", gender: "FEMALE", tier: "Edge" }] },
      "/api/stock/search": { items: [], warnings: [] },
      "/music/manifest.json": [{ id: "m", title: "M", file: "/music/m.mp3" }],
    });
    const s = createClientServices(env);
    expect((await s.tts.voices())[0]?.name).toBe("vi-VN-HoaiMyNeural");
    expect(await s.stock.search("police", "image")).toEqual({ items: [], warnings: [] });
    expect((await s.music.list()).map((t) => t.id)).toEqual(["m"]);
  });

  it("các repository dùng chung một kho IndexedDB nhưng không lẫn khoá", async () => {
    const s = createClientServices(fakeEnv());
    expect(await s.drafts.load()).toBeNull();
    await s.brands.save("theanh28", { channelName: "2NV" }, null);
    const meta = await s.uploads.put(new Blob(["x"]), { name: "x.png", kind: "image" });
    expect((await s.brands.load("theanh28"))?.values).toEqual({ channelName: "2NV" });
    expect((await s.uploads.get(meta.id))?.name).toBe("x.png");
    expect(await s.drafts.load()).toBeNull();
    expect((await s.uploads.list()).map((m) => m.id)).toEqual([meta.id]);
  });

  it("đoán từ khoá bằng từ điển thật", () => {
    const s = createClientServices(fakeEnv());
    expect(s.keywords.suggest("Mưa lớn gây ngập lụt")[0]).toBe("flood");
  });

  it("hai lần tạo container cho hai kho độc lập", async () => {
    const a = createClientServices(fakeEnv());
    const b = createClientServices(fakeEnv());
    await a.brands.save("t", { x: "1" }, null);
    expect(await b.brands.load("t")).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/container.test.ts` → FAIL (không tìm thấy `@/client/container`, `RENDER_SAMPLE_RATE`). Ghi lại.

- [ ] **Step 3: Sửa `src/client/media/AudioDecodeService.ts`**: thêm trên lớp
```ts
/** Tần số mẫu duy nhất của bản trộn: giọng, nhạc và bộ giải mã đều phải dùng giá trị này. */
export const RENDER_SAMPLE_RATE = 48000;
```
và đổi `constructor(private readonly sampleRate = 48000)` thành `constructor(private readonly sampleRate = RENDER_SAMPLE_RATE)`.

`src/client/controllers/DevRenderController.ts`: đổi `import { AudioDecodeService, type DecodedAudio } from "@/client/media/AudioDecodeService";` thành `import { AudioDecodeService, RENDER_SAMPLE_RATE, type DecodedAudio } from "@/client/media/AudioDecodeService";` và đổi dòng `const SAMPLE_RATE = 48000;` thành `const SAMPLE_RATE = RENDER_SAMPLE_RATE;`.

`src/views/dev/DevRenderPanel.tsx`: đổi `new AudioDecodeService(48000)` thành `new AudioDecodeService()`.

- [ ] **Step 4: Viết `src/client/container.ts`**

```ts
import { AudioDecodeService } from "@/client/media/AudioDecodeService";
import { BrowserMediaProbe, type MediaProbe } from "@/client/media/MediaProbe";
import { browserSupport, type SupportReport } from "@/client/render/BrowserSupport";
import { RenderClient } from "@/client/render/RenderClient";
import { defaultKeywordSuggester, type KeywordSuggester } from "@/client/services/KeywordSuggester";
import { MusicLibrary } from "@/client/services/MusicLibrary";
import { StockClient, type StockApi } from "@/client/services/StockClient";
import { TtsClient, type TtsApi } from "@/client/services/TtsClient";
import { BrandRepository } from "@/client/storage/BrandRepository";
import { DraftRepository } from "@/client/storage/DraftRepository";
import { IdbKeyValueStore } from "@/client/storage/IdbKeyValueStore";
import { UploadRepository } from "@/client/storage/UploadRepository";
import { defaultTemplateRegistry } from "@/templates/registry";
import type { TemplateRegistry } from "@/templates/TemplateRegistry";

export interface ClientEnv {
  fetch: typeof fetch;
  indexedDB: IDBFactory;
  origin: string;
  createUrl(blob: Blob): string;
  revokeUrl(url: string): void;
}

export interface ClientServices {
  env: ClientEnv;
  templates: TemplateRegistry;
  tts: TtsApi;
  stock: StockApi;
  keywords: KeywordSuggester;
  music: MusicLibrary;
  drafts: DraftRepository;
  brands: BrandRepository;
  uploads: UploadRepository;
  decoder: AudioDecodeService;
  probe: MediaProbe;
  render: RenderClient;
  support: () => Promise<SupportReport>;
}

/** Lắp mọi dịch vụ phía client ở một chỗ. Không chạm API trình duyệt cho tới khi dịch vụ được dùng. */
export function createClientServices(env: ClientEnv): ClientServices {
  const store = new IdbKeyValueStore(env.indexedDB);
  const decoder = new AudioDecodeService();
  return {
    env,
    templates: defaultTemplateRegistry(),
    tts: new TtsClient(env.fetch),
    stock: new StockClient(env.fetch),
    keywords: defaultKeywordSuggester(),
    music: new MusicLibrary(env.fetch),
    drafts: new DraftRepository(store),
    brands: new BrandRepository(store),
    uploads: new UploadRepository(store),
    decoder,
    probe: new BrowserMediaProbe(decoder),
    render: new RenderClient(),
    support: () => browserSupport().check(),
  };
}

/** Môi trường thật của trình duyệt. Chỉ gọi ở phía client (dùng window). */
export function browserEnv(): ClientEnv {
  return {
    fetch: (...args) => fetch(...args),
    indexedDB: window.indexedDB,
    origin: window.location.origin,
    createUrl: (blob) => URL.createObjectURL(blob),
    revokeUrl: (url) => URL.revokeObjectURL(url),
  };
}
```

- [ ] **Step 5: Chạy test, typecheck, lint, build** — `npx vitest run` → PASS (kể cả `DevRenderController.test.ts`); `npm run typecheck`, `npm run lint`, `npm run build` → sạch.

- [ ] **Step 6: Commit** (điều phối viên) — `feat(client): container dịch vụ phía client và hằng RENDER_SAMPLE_RATE`

---

## Hoàn thành chặng 3B khi

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` sạch.
- Mọi đối tượng domain của một bản nháp (dự án, giọng, giọng từng cảnh, cảnh trám, nhạc) có snapshot qua được `structuredClone`; lưu và đọc lại được bằng `DraftRepository` trên IndexedDB giả.
- Hải duyệt. Sau đó viết kế hoạch chặng 3C (trình 5 bước: `WizardController` + controller từng bước + view) từ code thật của 3A và 3B.

## Rủi ro đã biết

- `BrowserMediaProbe` và `IdbKeyValueStore` trên IndexedDB thật của trình duyệt chưa được kiểm ngoài Node; kiểm trong 3C khi có giao diện (tải một ảnh, một video quay dọc có metadata xoay, một file nhạc; tải lại trang và mở lại bản nháp).
- Từ điển 110 mục là bản khởi đầu; từ khoá tiếng Anh cho ngành mới (bất động sản, y khoa, v.v.) sẽ cần Hải bổ sung dần vào `src/data/news-keywords.json` (không cần sửa code, nhưng cập nhật test "từ điển thật" nếu đổi thứ tự kết quả).
- Trình duyệt có thể xoá IndexedDB khi thiếu dung lượng hoặc ở chế độ riêng tư: `DraftRepository.load()` coi bản nháp mất/hỏng là "chưa có", không ném lỗi; giao diện 3C phải báo rõ khi `UploadRepository.put` lỗi hết dung lượng.
