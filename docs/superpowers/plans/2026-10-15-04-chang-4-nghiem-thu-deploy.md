# Tin Video Studio — Chặng 4: Nghiệm thu và deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chứng minh app chạy đúng từ đầu tới cuối bằng máy (Playwright trên Chrome thật), đo được mức âm và bố cục so với video mẫu bằng script, chốt bitrate, kiểm với key thật, rồi đưa lên Vercel với hướng dẫn và kiểm tra cấu hình tự động.

**Architecture:** Test toàn luồng nằm ở thư mục `e2e/` riêng (Playwright, kênh `chrome`), chạy app ở chế độ giả lập với tài khoản thử sinh lúc chạy test (không dùng `.env.local`). Đo âm và khung hình bằng script Node + ffmpeg trong `scripts/`, phần tính toán thuần tách ra `scripts/lib/` để test bằng Vitest. Kiểm cấu hình môi trường bằng `scripts/check-env.ts` chạy trước `next build` (chặn deploy sai ngay trên Vercel). Deploy do Hải bấm (push GitHub, Vercel); kế hoạch chuẩn bị mọi thứ và kiểm sau khi lên.

**Tech Stack:** Như 3C; thêm devDependency `@playwright/test` 1.64.1 (dùng Chrome đã cài trên máy, không tải trình duyệt). Script đo dùng `ffmpeg`/`ffprobe` có sẵn trên máy (Gyan FFmpeg 8.1.2 qua winget); thiếu thì script báo rõ và test e2e bỏ qua phần đo.

**Đặc tả:** `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md` (mục 2 người dùng, 6.2 biến môi trường, 8 kiểm thử, 9 việc của Hải, 12 số đo). **Lộ trình:** `docs/superpowers/plans/2026-10-15-00-lo-trinh.md`. **Việc để dành:** `.superpowers/sdd/progress.md` các mục "Để chặng 4".

## Global Constraints

- Thư mục dự án: `D:\Brain Hainv\ca-nhan\tools\tin-video-studio`, nhánh `feat/chang-4-nghiem-thu` (điều phối viên tạo từ `main`). Đường dẫn tính từ thư mục này.
- **Agent thực thi CẤM chạy mọi lệnh git.** Bỏ qua bước "Commit"; điều phối viên commit. Không đọc/sửa `.env.local`; không tạo `.env*` ngoài `.env.example`. Không đưa key thật hay mật khẩu vào mã, test hay tài liệu.
- **RED phải đỏ thật** cho test Vitest. Test Playwright (`e2e/*.spec.ts`) không có RED (app đã có); implementer chạy `npm run test:e2e` và ghi kết quả vào report; test treo hay đỏ thì KHÔNG nới timeout quá giá trị kế hoạch ghi, báo lại.
- Test toàn luồng chỉ nằm trong `e2e/` (Playwright), không trong `tests/` (Vitest chỉ gom `tests/**/*.test.ts`). Tài khoản thử của e2e sinh trong `e2e/e2eEnv.ts` (gọi đồng bộ từ `playwright.config.ts`) lúc chạy; app e2e chạy ở cổng **3101** với `FAKE_PROVIDERS=1`.
- Trên Vercel: `FAKE_PROVIDERS` và `EDGE_TTS_DEV` phải **trống** (container đã ném lỗi nếu bật trên production). `AUTH_SECRET` ≥ 32 ký tự. `APP_USERS` là base64 của JSON ≤ 5 người dùng. Node `>=22.2` (đã khai `engines`).
- Chỉ Hải chạy `git push`, tạo repo GitHub và dự án Vercel (push trong phiên tự động bị treo ở hộp thoại đăng nhập; xem bộ nhớ dự án). Kế hoạch chuẩn bị lệnh và danh sách kiểm, không tự push.
- Số đo âm giữ cùng phương pháp các chặng trước: cửa sổ 100 ms, cổng −45 dB, "đoạn có tiếng" = cửa sổ trên p90 − 12 dB, RMS trung bình năng lượng; đỉnh < 0,89; giọng −16,5 ± 1 dB.
- Ngôn ngữ giao diện, thông báo lỗi, tài liệu cho Hải: tiếng Việt có dấu. Tên lớp, hàm, biến: tiếng Anh. Giữ kiểu xuống dòng của file đang sửa.
- Mọi commit kết thúc bằng dòng `Co-Authored-By` do phiên chạy quy định (điều phối viên tự thêm).
- Sau mỗi task: `npx vitest run`, `npm run typecheck`, `npm run lint` sạch (0 cảnh báo); task có e2e chạy thêm `npm run test:e2e`; task 7 chạy `npm run build`.

## Cấu trúc file chặng 4

```
package.json                      # sửa: devDep @playwright/test, scripts test:e2e, measure:mp4, check-env, prebuild
playwright.config.ts              # mới
e2e/e2eEnv.ts                     # mới: sinh APP_USERS + AUTH_SECRET ĐỒNG BỘ khi nạp config (webServer chạy trước globalSetup)
e2e/helpers.ts                    # mới: đăng nhập, điền tin mẫu, chờ bước
e2e/01-nhap-tin.spec.ts           # mới
e2e/02-toan-luong.spec.ts         # mới: 5 bước → tải MP4 → đo (nếu có ffmpeg)
e2e/03-ban-nhap-va-phien.spec.ts  # mới: tải lại → mở lại; hết phiên → /dang-nhap
scripts/lib/wav.ts                # mới: đọc WAV PCM16/float
scripts/lib/audioMetrics.ts       # mới: RMS/đỉnh/đoạn có tiếng (thuần)
scripts/measure-mp4.ts            # mới: ffmpeg → WAV → số đo JSON
scripts/contact-sheet.ts          # mới: ffmpeg → ảnh ghép khung mẫu/khung dựng
scripts/check-env.ts              # mới: kiểm biến môi trường trước build
src/server/env/validateEnv.ts     # mới: logic kiểm (thuần, test được)
src/client/render/encodingDefaults.ts  # mới: RENDER_VIDEO_BITRATE, RENDER_AUDIO_BITRATE (một chỗ)
next.config.ts                    # sửa: header bảo mật
.env.example                      # sửa: bỏ ENABLE_DEV_PAGES, thêm ghi chú Vercel
README.md                         # sửa: mục Deploy Vercel, chạy e2e, đo âm
tests/scripts/audioMetrics.test.ts, tests/scripts/wav.test.ts, tests/server/env/validateEnv.test.ts
tsconfig.json                     # sửa: include e2e/**/*.ts
docs/superpowers/specs/...        # mục 13 "Nghiệm thu chặng 4" (điều phối viên)
```

## Ghi chú thiết kế cần biết trước

- **Vì sao kênh `chrome`:** bộ dựng cần WebCodecs H.264 + AAC. Bản Chromium của Playwright (mã nguồn mở) không chắc có bộ mã hoá H.264; Chrome và Edge thật trên máy Hải thì có (3A/3C đã dựng được trong Chromium nhúng của app desktop). `playwright.config.ts` dùng `channel: "chrome"`, có thể đổi `PW_CHANNEL=msedge`. Không chạy `npx playwright install`.
- **Headless:** Chrome headless mới (`headless: true` trên Playwright ≥ 1.49 dùng chế độ headless của Chrome thật) có WebCodecs. Nếu dựng không ra MP4 ở headless, config cho phép `PW_HEADED=1`; implementer ghi vào report chế độ nào chạy được.
- **Tải file từ blob URL:** nút "Tải MP4" là `<a download>` trỏ `blob:`; Playwright bắt bằng `page.waitForEvent("download")` rồi `saveAs`. Không cần `acceptDownloads` riêng (mặc định bật).
- **Không dùng `.env.local` cho e2e:** `e2e/e2eEnv.ts` tạo mật khẩu ngẫu nhiên, băm bằng `bcryptjs.hashSync`, đóng gói `APP_USERS`, sinh `AUTH_SECRET`, rồi ghi vào `process.env` **ngay khi `playwright.config.ts` được nạp** (Playwright khởi động `webServer` TRƯỚC `globalSetup`, nên `globalSetup` là quá muộn; chạy thử khô đã vấp lỗi này). Hàm idempotent để worker thừa hưởng env. Cổng 3101 để không đụng dev server 3100.
- **Bitrate:** quyết định của Hải còn treo. Task 5 đo 5 Mbps và 8 Mbps trên cùng một dự án, ghi kích thước và ảnh phóng vùng chữ; mặc định code vẫn 8 Mbps cho tới khi Hải chốt. Hằng gom về `encodingDefaults.ts` để đổi một chỗ.
- **Key thật:** Task 6 chỉ chạy khi `.env.local` có key (Hải cung cấp). Không có thì ghi "hoãn, cần key" và chặng vẫn hoàn thành phần còn lại.
- **Kế hoạch đã chạy thử khô** (worktree riêng, `npm ci`): Task 1–3, 4.1, 5, 7 dựng được; 584 test Vitest, 8/8 e2e headless, build sạch; 5 lỗi tìm thấy đã sửa vào văn bản này.
- **Không làm ở chặng 4:** phong cách thứ hai, phân trang tìm cảnh trám, thư viện file qua nhiều dự án, gói Vercel Pro (Hobby chỉ cho dùng phi thương mại, đặc tả mục 2).

---

### Task 1: Playwright + đăng nhập + bước 1

**Files:**
- Modify: `package.json`, `tsconfig.json`
- Create: `playwright.config.ts`, `e2e/e2eEnv.ts`, `e2e/helpers.ts`, `e2e/01-nhap-tin.spec.ts`
- Modify: `.gitignore` (thêm `.superpowers/`: thư mục sổ tiến độ và mẫu hiện chưa được bỏ qua)
- Test: chính `e2e/01-nhap-tin.spec.ts` (chạy `npm run test:e2e -- e2e/01-nhap-tin.spec.ts`)

**Interfaces:**
- Consumes: `BcryptPasswordHasher`, `UserDirectory` (`src/server/auth`), `SAMPLE_NEWS` (chỉ để biết số câu), các nhãn nút tiếng Việt của view 3C ("Điền tin mẫu", "Chia cảnh", "Tiếp tục: …", "Tạo giọng", "Tự tìm cảnh còn trống", "Dựng video", "Tải MP4", "Mở lại", "Dự án mới").
- Produces: `e2e/helpers.ts` xuất `E2E_USER = "e2e"`, `e2ePassword()` (đọc `process.env.E2E_PASSWORD`), `login(page)`, `fillSampleAndSplit(page)`, `goNext(page, label)`, `stepButton(page, n)`; `playwright.config.ts` đọc `E2E_BASE_URL` (có thì không bật `webServer`, dùng để chạy trên bản deploy ở Task 8).

- [ ] **Step 1: Cài Playwright** — `npm install -D @playwright/test@1.64.1 --save-exact` (không chạy `playwright install`). Thêm vào `package.json` `scripts`: `"test:e2e": "playwright test"`, `"test:e2e:headed": "playwright test --headed"`. Thêm `"e2e/**/*.ts", "playwright.config.ts"` vào `include` của `tsconfig.json`. Thêm dòng `.superpowers/` vào `.gitignore`.

- [ ] **Step 2: Viết `playwright.config.ts`**
```ts
import { defineConfig } from "@playwright/test";
import { ensureE2eEnv } from "./e2e/e2eEnv";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3101";
const external = Boolean(process.env.E2E_BASE_URL);
if (!external) ensureE2eEnv(); // phải chạy trước khi Playwright khởi động webServer

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    channel: process.env.PW_CHANNEL ?? "chrome",
    headless: process.env.PW_HEADED !== "1",
    viewport: { width: 1100, height: 1000 },
    locale: "vi-VN",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: external
    ? undefined
    : {
        command: "npx next dev -p 3101",
        url: "http://localhost:3101/dang-nhap",
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
```

- [ ] **Step 3: Viết `e2e/e2eEnv.ts`** (sinh tài khoản thử và khoá phiên đồng bộ; `webServer` thừa hưởng `process.env`)
```ts
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { UserDirectory } from "../src/server/auth/UserDirectory";

/**
 * Sinh tài khoản thử + khoá phiên vào process.env. Phải chạy ĐỒNG BỘ ngay khi nạp playwright.config.ts
 * (Playwright khởi động webServer TRƯỚC globalSetup nên globalSetup quá muộn). Idempotent: worker thừa hưởng env từ tiến trình chính.
 */
export function ensureE2eEnv(): void {
  if (process.env.APP_USERS && process.env.E2E_PASSWORD) return;
  const password = process.env.E2E_PASSWORD ?? `e2e-${randomBytes(9).toString("base64url")}`;
  const passwordHash = bcrypt.hashSync(password, 4);
  const json = JSON.stringify([{ username: "e2e", passwordHash, displayName: "Người thử" }]);
  UserDirectory.fromEnv(json); // kiểm định dạng như lúc chạy thật
  process.env.E2E_PASSWORD = password;
  process.env.APP_USERS = Buffer.from(json, "utf8").toString("base64");
  process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? randomBytes(32).toString("hex");
  process.env.FAKE_PROVIDERS = "1";
  // Next nạp .env.local nhưng biến đã có trong process.env được ưu tiên; đặt chuỗi rỗng (≠ "1") để tắt giọng Edge dev dù .env.local có bật.
  process.env.EDGE_TTS_DEV = "";
  process.env.EDGE_TTS_BIN = "";
}
```

- [ ] **Step 4: Viết `e2e/helpers.ts`**
```ts
import { expect, type Page } from "@playwright/test";

export const E2E_USER = "e2e";

export function e2ePassword(): string {
  const p = process.env.E2E_PASSWORD;
  if (!p) throw new Error("Thiếu E2E_PASSWORD (global-setup chưa chạy hoặc chạy trên bản deploy mà chưa đặt biến)");
  return p;
}

export async function login(page: Page): Promise<void> {
  await page.goto("/dang-nhap?next=%2Fstudio");
  await page.getByRole("textbox").first().fill(process.env.E2E_USER ?? E2E_USER);
  await page.locator('input[type="password"]').fill(e2ePassword());
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole("button", { name: "1. Nhập tin" })).toBeVisible();
}

/** Nếu còn bản nháp cũ thì bỏ, để mỗi test bắt đầu sạch. */
export async function discardDraftIfOffered(page: Page): Promise<void> {
  const discard = page.getByRole("button", { name: "Bỏ bản nháp" });
  if (await discard.isVisible({ timeout: 1500 }).catch(() => false)) await discard.click();
}

export async function fillSampleAndSplit(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Điền tin mẫu" }).click();
  await page.getByRole("button", { name: "Chia cảnh" }).click();
  await expect(page.getByRole("heading", { name: /^Các cảnh \(6\)$/ })).toBeVisible();
}

export async function goNext(page: Page, label: string): Promise<void> {
  const next = page.getByRole("button", { name: `Tiếp tục: ${label}` });
  await expect(next).toBeEnabled();
  await next.click();
}

export function stepButton(page: Page, n: 1 | 2 | 3 | 4 | 5) {
  return page.getByRole("button", { name: new RegExp(`^${n}\\. `) });
}
```

- [ ] **Step 5: Viết `e2e/01-nhap-tin.spec.ts`**
```ts
import { expect, test } from "@playwright/test";
import { discardDraftIfOffered, fillSampleAndSplit, login, stepButton } from "./helpers";

test.describe("Bước 1 — nhập tin", () => {
  test("đăng nhập, điền tin mẫu, chia 6 cảnh, các bước sau còn khoá", async ({ page }) => {
    await login(page);
    await discardDraftIfOffered(page);
    await expect(stepButton(page, 2)).toBeDisabled();
    await fillSampleAndSplit(page);
    await expect(stepButton(page, 2)).toBeEnabled();
    await expect(stepButton(page, 3)).toBeDisabled();
    await expect(page.getByText("Cảnh mở đầu (tiêu đề)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gộp với câu sau" })).toHaveCount(5);
  });

  test("gộp và tách cảnh đổi số cảnh", async ({ page }) => {
    await login(page);
    await discardDraftIfOffered(page);
    await fillSampleAndSplit(page);
    await page.getByRole("button", { name: "Gộp với câu sau" }).first().click();
    await expect(page.getByRole("heading", { name: /^Các cảnh \(5\)$/ })).toBeVisible();
    const textarea = page.locator("textarea").nth(1);
    await textarea.click();
    await textarea.evaluate((el) => {
      const t = el as HTMLTextAreaElement;
      const at = t.value.indexOf(" ", 40);
      t.setSelectionRange(at, at);
    });
    await page.getByRole("button", { name: "Tách tại con trỏ" }).first().click();
    await expect(page.getByRole("heading", { name: /^Các cảnh \(6\)$/ })).toBeVisible();
  });

  test("chưa đăng nhập thì /studio chuyển về trang đăng nhập", async ({ page }) => {
    await page.goto("/studio");
    await expect(page).toHaveURL(/\/dang-nhap\?next=%2Fstudio$/);
  });
});
```

- [ ] **Step 6: Chạy** — `npm run test:e2e -- e2e/01-nhap-tin.spec.ts` → 3 passed. Nếu kênh `chrome` không mở được, thử `PW_CHANNEL=msedge` và ghi vào report. `npm run typecheck`, `npm run lint`, `npx vitest run` sạch (Vitest không gom `e2e/`).

- [ ] **Step 7: Commit** (điều phối viên) — `test(e2e): Playwright trên Chrome thật, đăng nhập và bước nhập tin`

---

### Task 2: Thư viện đo âm thuần + script `measure-mp4`

**Files:**
- Create: `scripts/lib/wav.ts`, `scripts/lib/audioMetrics.ts`, `scripts/measure-mp4.ts`
- Modify: `package.json` (script `"measure:mp4": "tsx scripts/measure-mp4.ts"`)
- Test: `tests/scripts/wav.test.ts`, `tests/scripts/audioMetrics.test.ts`

**Interfaces:**
- Produces (`scripts/lib/wav.ts`): `parseWav(bytes: Uint8Array): { sampleRate: number; channels: Float32Array[] }` — hỗ trợ PCM 16-bit và IEEE float 32-bit, 1–2 kênh; sai định dạng ném `Error("WAV không hợp lệ: …")`.
- Produces (`scripts/lib/audioMetrics.ts`): `audioMetrics(channels: Float32Array[], sampleRate: number, options?: { windowSec?: number; gateDb?: number; voicedBelowP90Db?: number }): AudioMetrics` với `AudioMetrics = { durationSec; peak; windows; voicedWindows; voicedRmsDb; quietRmsDb; p90Db }` (`quietRmsDb` = RMS trung bình năng lượng của các cửa sổ không có tiếng nhưng trên cổng, tức mức nhạc nền lúc nghỉ; `NaN` nếu không có). Mặc định `windowSec = 0.1`, `gateDb = -45`, `voicedBelowP90Db = 12` (giống phương pháp 3A/3C).
- Produces (`scripts/measure-mp4.ts`): `npm run measure:mp4 -- <file.mp4> [--json]` → in bảng hoặc JSON; dùng `ffmpeg -v error -i <mp4> -vn -ac 2 -ar 48000 -f wav pipe:1`; không có ffmpeg → thoát mã 2 với "Cần ffmpeg trong PATH". Dùng chung bởi Task 3 (e2e) và Task 4/6.

- [ ] **Step 1: Viết test**

`tests/scripts/wav.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseWav } from "../../scripts/lib/wav";
import { makeToneWav } from "@/server/tts/FakeTtsProvider";

describe("parseWav", () => {
  it("đọc WAV PCM16 mono do FakeTtsProvider sinh", () => {
    const wav = makeToneWav(0.5, 440, 24000);
    const parsed = parseWav(wav);
    expect(parsed.sampleRate).toBe(24000);
    expect(parsed.channels).toHaveLength(1);
    expect(parsed.channels[0]!.length).toBe(12000);
    const peak = Math.max(...Array.from(parsed.channels[0]!).map(Math.abs));
    expect(peak).toBeGreaterThan(0.15);
    expect(peak).toBeLessThan(0.2); // 6000/32768 ≈ 0.183
  });

  it("đọc WAV float32 stereo tự dựng", () => {
    const n = 100;
    const buf = new ArrayBuffer(44 + n * 2 * 4);
    const v = new DataView(buf);
    const txt = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    txt(0, "RIFF"); v.setUint32(4, 36 + n * 8, true); txt(8, "WAVE"); txt(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 3, true); v.setUint16(22, 2, true);
    v.setUint32(24, 48000, true); v.setUint32(28, 48000 * 8, true); v.setUint16(32, 8, true); v.setUint16(34, 32, true);
    txt(36, "data"); v.setUint32(40, n * 8, true);
    for (let i = 0; i < n; i++) { v.setFloat32(44 + i * 8, 0.25, true); v.setFloat32(48 + i * 8, -0.5, true); }
    const parsed = parseWav(new Uint8Array(buf));
    expect(parsed.sampleRate).toBe(48000);
    expect(parsed.channels[0]![10]).toBeCloseTo(0.25, 6);
    expect(parsed.channels[1]![10]).toBeCloseTo(-0.5, 6);
  });

  it("không phải WAV thì ném lỗi tiếng Việt", () => {
    expect(() => parseWav(new Uint8Array([1, 2, 3]))).toThrow(/WAV không hợp lệ/);
  });
});
```

`tests/scripts/audioMetrics.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { audioMetrics } from "../../scripts/lib/audioMetrics";

const SR = 48000;
function tone(sec: number, amp: number, freq = 220): Float32Array {
  const out = new Float32Array(Math.round(sec * SR));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return out;
}
function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

describe("audioMetrics", () => {
  it("giọng to xen nhạc nhỏ: tách được mức có tiếng và mức lúc nghỉ", () => {
    // 2 s nhạc nhỏ (−30 dB RMS ≈ biên độ 0,0447), 2 s giọng (−16,5 dB ≈ 0,211), 2 s nhạc nhỏ
    const music = tone(2, 0.0447);
    const voice = tone(2, 0.211, 180);
    const mono = concat([music, voice, music]);
    const m = audioMetrics([mono, mono], SR);
    expect(m.durationSec).toBeCloseTo(6, 3);
    expect(m.voicedRmsDb).toBeCloseTo(-16.5, 0);
    expect(m.quietRmsDb).toBeCloseTo(-30, 0);
    expect(m.peak).toBeCloseTo(0.211, 2);
    expect(m.voicedWindows).toBeGreaterThan(15);
    expect(m.voicedWindows).toBeLessThan(25);
  });

  it("toàn lặng: không có cửa sổ có tiếng, quietRmsDb là NaN", () => {
    const m = audioMetrics([new Float32Array(SR)], SR);
    expect(m.voicedWindows).toBe(0);
    expect(Number.isNaN(m.voicedRmsDb)).toBe(true);
    expect(Number.isNaN(m.quietRmsDb)).toBe(true);
    expect(m.peak).toBe(0);
  });

  it("đỉnh lấy trên mọi kênh", () => {
    const l = new Float32Array(SR); l[100] = 0.3;
    const r = new Float32Array(SR); r[200] = -0.9;
    expect(audioMetrics([l, r], SR).peak).toBeCloseTo(0.9, 6);
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/scripts` → FAIL (thiếu module).

- [ ] **Step 3: Viết `scripts/lib/wav.ts`**
```ts
export interface ParsedWav {
  sampleRate: number;
  channels: Float32Array[];
}

const ascii = (view: DataView, offset: number, length: number) =>
  Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join("");

/** Đọc WAV (RIFF) PCM 16-bit hoặc IEEE float 32-bit, 1–2 kênh. */
export function parseWav(bytes: Uint8Array): ParsedWav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || ascii(view, 0, 4) !== "RIFF" || ascii(view, 8, 4) !== "WAVE") {
    throw new Error("WAV không hợp lệ: thiếu đầu RIFF/WAVE");
  }
  let offset = 12;
  let format: { code: number; channels: number; sampleRate: number; bits: number } | null = null;
  while (offset + 8 <= bytes.byteLength) {
    const id = ascii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      format = {
        code: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      if (!format) throw new Error("WAV không hợp lệ: data đứng trước fmt");
      const { code, channels, sampleRate, bits } = format;
      const isFloat = code === 3 && bits === 32;
      const isPcm16 = code === 1 && bits === 16;
      if (!isFloat && !isPcm16) throw new Error(`WAV không hợp lệ: chỉ hỗ trợ PCM16 hoặc float32 (code ${code}, ${bits} bit)`);
      if (channels < 1 || channels > 2) throw new Error(`WAV không hợp lệ: ${channels} kênh`);
      const bytesPerSample = bits / 8;
      const available = Math.min(size, bytes.byteLength - body);
      const frames = Math.floor(available / (bytesPerSample * channels));
      const out = Array.from({ length: channels }, () => new Float32Array(frames));
      for (let f = 0; f < frames; f++) {
        for (let c = 0; c < channels; c++) {
          const p = body + (f * channels + c) * bytesPerSample;
          out[c]![f] = isFloat ? view.getFloat32(p, true) : view.getInt16(p, true) / 32768;
        }
      }
      return { sampleRate, channels: out };
    }
    offset = body + size + (size % 2);
  }
  throw new Error("WAV không hợp lệ: thiếu khối data");
}
```

- [ ] **Step 4: Viết `scripts/lib/audioMetrics.ts`**
```ts
export interface AudioMetricsOptions {
  windowSec?: number;
  gateDb?: number;
  voicedBelowP90Db?: number;
}

export interface AudioMetrics {
  durationSec: number;
  peak: number;
  windows: number;
  voicedWindows: number;
  /** RMS (trung bình năng lượng) của các cửa sổ có tiếng, dB. NaN nếu không có. */
  voicedRmsDb: number;
  /** RMS của các cửa sổ trên cổng nhưng không có tiếng (nhạc nền lúc nghỉ), dB. NaN nếu không có. */
  quietRmsDb: number;
  p90Db: number;
}

const meanDb = (dbs: number[]): number =>
  dbs.length === 0 ? Number.NaN : 10 * Math.log10(dbs.reduce((e, d) => e + 10 ** (d / 10), 0) / dbs.length);

/** Cùng phương pháp đo của chặng 3A/3C: cửa sổ 100 ms trộn mono, cổng −45 dB, có tiếng = trên p90 − 12 dB. */
export function audioMetrics(channels: Float32Array[], sampleRate: number, options: AudioMetricsOptions = {}): AudioMetrics {
  const windowSec = options.windowSec ?? 0.1;
  const gateDb = options.gateDb ?? -45;
  const below = options.voicedBelowP90Db ?? 12;
  const first = channels[0] ?? new Float32Array();
  const n = first.length;
  const w = Math.max(1, Math.round(windowSec * sampleRate));
  let peak = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i] ?? 0));
  const windowDb: number[] = [];
  for (let start = 0; start + w <= n; start += w) {
    let energy = 0;
    for (let i = start; i < start + w; i++) {
      let x = 0;
      for (const ch of channels) x += ch[i] ?? 0;
      x /= channels.length;
      energy += x * x;
    }
    windowDb.push(10 * Math.log10(energy / w + 1e-12));
  }
  const sorted = [...windowDb].sort((a, b) => a - b);
  const p90Db = sorted.length ? (sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] as number) : Number.NaN;
  const voiced = windowDb.filter((d) => d > gateDb && d > p90Db - below);
  const quiet = windowDb.filter((d) => d > gateDb && d <= p90Db - below);
  return {
    durationSec: n / sampleRate,
    peak,
    windows: windowDb.length,
    voicedWindows: voiced.length,
    voicedRmsDb: meanDb(voiced),
    quietRmsDb: meanDb(quiet),
    p90Db,
  };
}
```

- [ ] **Step 5: Viết `scripts/measure-mp4.ts`**
```ts
import { execFileSync } from "node:child_process";
import { audioMetrics } from "./lib/audioMetrics";
import { parseWav } from "./lib/wav";

function usage(): never {
  console.error("Cách dùng: npm run measure:mp4 -- <file.mp4> [--json]");
  process.exit(1);
}

export class FfmpegMissingError extends Error {
  constructor() {
    super("Cần ffmpeg trong PATH để đo âm");
    this.name = "FfmpegMissingError";
  }
}

/** Giải mã âm của MP4 bằng ffmpeg rồi đo. Ném FfmpegMissingError nếu máy không có ffmpeg (để e2e bỏ qua phần đo). */
export function measureFile(file: string): AudioMetrics {
  let wav: Buffer;
  try {
    wav = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vn", "-ac", "2", "-ar", "48000", "-f", "wav", "pipe:1"], {
      maxBuffer: 1024 * 1024 * 512,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") throw new FfmpegMissingError();
    throw error;
  }
  const parsed = parseWav(new Uint8Array(wav.buffer, wav.byteOffset, wav.byteLength));
  return audioMetrics(parsed.channels, parsed.sampleRate);
}

function main(): void {
  const [file, flag] = process.argv.slice(2);
  if (!file) usage();
  let m: AudioMetrics;
  try {
    m = measureFile(file);
  } catch (error) {
    if (error instanceof FfmpegMissingError) {
      console.error(error.message);
      process.exit(2);
    }
    throw error;
  }
  if (flag === "--json") {
    console.log(JSON.stringify(m));
    return;
  }
  const fmt = (x: number) => (Number.isNaN(x) ? "—" : x.toFixed(2));
  console.log(`Thời lượng: ${fmt(m.durationSec)} s`);
  console.log(`Đỉnh: ${m.peak.toFixed(3)} (trần 0,89)`);
  console.log(`Đoạn có tiếng: ${fmt(m.voicedRmsDb)} dB RMS (${m.voicedWindows}/${m.windows} cửa sổ; mục tiêu −16,5 ± 1)`);
  console.log(`Lúc nghỉ (nhạc nền): ${fmt(m.quietRmsDb)} dB RMS (mẫu Theanh28 ≈ −30)`);
}

// Chỉ chạy CLI khi gọi trực tiếp; khi e2e import `measureFile` thì không chạy.
if (process.argv[1] && /measure-mp4\.ts$/.test(process.argv[1].replace(/\\/g, "/"))) main();
```
(Thêm `import type { AudioMetrics } from "./lib/audioMetrics";` ở đầu file, gộp với import `audioMetrics`.)

- [ ] **Step 6: Chạy** — `npx vitest run` → PASS; `npm run typecheck`, `npm run lint` sạch. Thử tay: `npm run measure:mp4 -- "<một file mp4 bất kỳ có tiếng>"` (ví dụ file tải về ở 3C nếu còn) và ghi đầu ra vào report; không có file thì ghi "chưa thử tay".

- [ ] **Step 7: Commit** (điều phối viên) — `feat(scripts): đo mức âm MP4 (RMS có tiếng, lúc nghỉ, đỉnh)`

---

### Task 3: E2E toàn luồng — 5 bước, tải MP4, đo; bản nháp; hết phiên

**Files:**
- Create: `e2e/02-toan-luong.spec.ts`, `e2e/03-ban-nhap-va-phien.spec.ts`
- Modify: `e2e/helpers.ts` (thêm `generateVoices`, `autoFillFootage`, `renderAndDownload`)
- Test: chính hai spec (`npm run test:e2e`)

**Interfaces:**
- Consumes: `measureFile` của `scripts/measure-mp4.ts` (import trực tiếp trong spec; spec chạy trong Node của Playwright nên gọi ffmpeg được), các nhãn view 3C, `data-testid="ket-qua"` trên `<video>` kết quả.
- Produces: `renderAndDownload(page, dir): Promise<string>` trả đường dẫn MP4 đã lưu vào `test-results/`.

- [ ] **Step 1: Thêm vào `e2e/helpers.ts`**
```ts
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export async function generateVoices(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Tạo giọng" }).click();
  await expect(page.getByText(/✓ [\d.]+ giây/)).toHaveCount(6, { timeout: 60_000 });
}

export async function autoFillFootage(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Tự tìm cảnh còn trống" }).click();
  await expect(page.getByRole("button", { name: "Tự tìm cảnh còn trống" })).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole("img", { name: "Cảnh trám đang chọn" })).toHaveCount(6);
}

export async function renderAndDownload(page: Page, dir = "test-results", prefix = ""): Promise<string> {
  // exact: true vì nút bước "5. Dựng video" cũng chứa chữ này
  await page.getByRole("button", { name: "Dựng video", exact: true }).click();
  await expect(page.getByTestId("ket-qua")).toBeVisible({ timeout: 150_000 });
  mkdirSync(dir, { recursive: true });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /^Tải MP4/ }).click(),
  ]);
  const path = join(dir, prefix + download.suggestedFilename());
  await download.saveAs(path);
  return path;
}
```

- [ ] **Step 2: Viết `e2e/02-toan-luong.spec.ts`**
```ts
import { statSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { autoFillFootage, discardDraftIfOffered, fillSampleAndSplit, generateVoices, goNext, login, renderAndDownload } from "./helpers";

test("đi trọn 5 bước với nhà cung cấp giả và tải về MP4", async ({ page }) => {
  await login(page);
  await discardDraftIfOffered(page);
  await fillSampleAndSplit(page);
  await goNext(page, "Chọn giọng");
  await expect(page.getByRole("combobox").first()).toContainText("Fake");
  await generateVoices(page);
  await goNext(page, "Cảnh trám");
  await autoFillFootage(page);
  await goNext(page, "Nhạc nền");
  await page.getByRole("radio", { name: /Bản tin/ }).check();
  await goNext(page, "Dựng video");
  await expect(page.getByText("Hãy dùng Chrome hoặc Edge")).toHaveCount(0);

  const started = Date.now();
  const file = await renderAndDownload(page);
  const elapsedSec = (Date.now() - started) / 1000;
  const sizeMb = statSync(file).size / 1024 / 1024;
  expect(file).toMatch(/phu-tho-.*_20261014\.mp4$/);
  expect(sizeMb).toBeGreaterThan(0.5);
  const shown = await page.getByText(/[\d.]+ giây, [\d.]+ MB/).textContent();
  const durationSec = Number(shown?.match(/([\d.]+) giây/)?.[1]);
  expect(durationSec).toBeGreaterThan(20);
  expect(elapsedSec).toBeLessThan(durationSec * 1.5 + 10);
  console.log(`[e2e] dựng ${durationSec} s mất ${elapsedSec.toFixed(1)} s, ${sizeMb.toFixed(1)} MB → ${file}`);

  // Đo âm nếu có ffmpeg (giọng giả là sóng sin nên chỉ kiểm giới hạn rộng)
  const { measureFile } = await import("../scripts/measure-mp4");
  let metrics: ReturnType<typeof measureFile> | null = null;
  try {
    metrics = measureFile(file);
  } catch {
    console.log("[e2e] bỏ qua đo âm (không có ffmpeg)");
  }
  if (metrics) {
    expect(metrics.peak).toBeLessThan(0.89);
    expect(metrics.voicedRmsDb).toBeGreaterThan(-19);
    expect(metrics.voicedRmsDb).toBeLessThan(-14);
    expect(Math.abs(metrics.durationSec - durationSec)).toBeLessThan(0.5);
    console.log(`[e2e] âm: có tiếng ${metrics.voicedRmsDb.toFixed(2)} dB, đỉnh ${metrics.peak.toFixed(3)}, nghỉ ${metrics.quietRmsDb.toFixed(2)} dB`);
  }
});

test("huỷ giữa chừng rồi dựng lại", async ({ page }) => {
  await login(page);
  await discardDraftIfOffered(page);
  await fillSampleAndSplit(page);
  await goNext(page, "Chọn giọng");
  await generateVoices(page);
  await goNext(page, "Cảnh trám");
  await goNext(page, "Nhạc nền");
  await goNext(page, "Dựng video");
  await page.getByRole("button", { name: "Dựng video", exact: true }).click();
  await expect(page.getByText(/Dựng hình \d+%/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Huỷ" }).click();
  await expect(page.getByRole("button", { name: "Dựng video", exact: true })).toBeEnabled();
  await expect(page.getByTestId("ket-qua")).toHaveCount(0);
  await renderAndDownload(page, "test-results", "huy-roi-dung-lai-"); // tên khác để không đè file của bài trên
});
```
Lưu ý: `measureFile` ném `FfmpegMissingError` (không `process.exit`) nên spec bắt được và bỏ qua phần đo; phần CLI của script chỉ chạy khi gọi trực tiếp.

- [ ] **Step 3: Viết `e2e/03-ban-nhap-va-phien.spec.ts`**
```ts
import { expect, test } from "@playwright/test";
import { discardDraftIfOffered, fillSampleAndSplit, generateVoices, goNext, login, stepButton } from "./helpers";

test("tải lại trang thì được mời mở lại bản nháp, mở lại giữ giọng", async ({ page }) => {
  await login(page);
  await discardDraftIfOffered(page);
  await fillSampleAndSplit(page);
  await goNext(page, "Chọn giọng");
  await generateVoices(page);
  await page.waitForTimeout(1200); // chờ tự lưu (800 ms)
  await page.reload();
  await expect(page.getByText(/^Có bản nháp/)).toBeVisible();
  await page.getByRole("button", { name: "Mở lại" }).click();
  await expect(stepButton(page, 5)).toHaveAttribute("aria-current", "step");
  await stepButton(page, 2).click();
  await expect(page.getByText(/✓ [\d.]+ giây/)).toHaveCount(6);
});

test("hết phiên: API trả 401 thì về trang đăng nhập và bản nháp còn", async ({ page, context }) => {
  await login(page);
  await discardDraftIfOffered(page);
  await fillSampleAndSplit(page);
  await page.waitForTimeout(1200);
  await context.clearCookies();
  await goNext(page, "Chọn giọng"); // bước 2 gọi /api/tts/voices → 401 → về trang đăng nhập ngay
  await expect(page).toHaveURL(/\/dang-nhap\?next=%2Fstudio$/, { timeout: 15_000 });
  await login(page);
  await expect(page.getByText(/^Có bản nháp/)).toBeVisible();
});

test("dự án mới xoá bản nháp", async ({ page }) => {
  await login(page);
  await discardDraftIfOffered(page);
  await fillSampleAndSplit(page);
  await page.waitForTimeout(1200);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Dự án mới" }).click();
  await expect(page.getByRole("button", { name: "Chia cảnh" })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/^Có bản nháp/)).toHaveCount(0);
});
```

- [ ] **Step 4: Chạy** — `npm run test:e2e` → 01 (3), 02 (2), 03 (3) đều passed. Ghi vào report: chế độ headless hay headed, thời gian dựng, dòng `[e2e]`. Chạy thử khô đã xác nhận Chrome headless mã hoá được H.264 + AAC (8/8 bài, ~54 s một lượt, dựng 37 s mất 16,7 s). Nếu trên máy khác headless không dựng được, chạy `PW_HEADED=1 npm run test:e2e` và ghi rõ trong report.
- [ ] **Step 5: `npx vitest run`, `npm run typecheck`, `npm run lint`** sạch.
- [ ] **Step 6: Commit** (điều phối viên) — `test(e2e): toàn luồng 5 bước, tải MP4 và đo âm; bản nháp; hết phiên`

---

### Task 4: So khung với video mẫu — ảnh ghép và danh sách kiểm (điều phối viên, có script)

**Files:**
- Create: `scripts/contact-sheet.ts` (agent viết), `package.json` script `"contact:sheet": "tsx scripts/contact-sheet.ts"`
- Điều phối viên tự làm phần so sánh; kết quả ghi `.superpowers/sdd/task-4-report.md` và đặc tả mục 13.

**Interfaces:**
- Produces: `npm run contact:sheet -- <mau.mp4> <dung.mp4> <out.png> [t1,t2,...]` — với mỗi mốc `t` (giây, mặc định `1,8,20`) lấy một khung của mỗi video bằng ffmpeg, thu về 540×960, ghép ngang (mẫu trái, dựng phải) rồi ghép dọc các mốc; in kích thước ảnh. Dùng một lệnh ffmpeg với `filter_complex` (`select`/`scale`/`hstack`/`vstack`), không cần thư viện ảnh.

- [ ] **Step 1 (agent): Viết `scripts/contact-sheet.ts`**
```ts
import { execFileSync } from "node:child_process";

function usage(): never {
  console.error("Cách dùng: npm run contact:sheet -- <mau.mp4> <dung.mp4> <out.png> [t1,t2,...]");
  process.exit(1);
}

const [sample, rendered, out, timesArg] = process.argv.slice(2);
if (!sample || !rendered || !out) usage();
const times = (timesArg ?? "1,8,20").split(",").map(Number).filter((t) => Number.isFinite(t) && t >= 0);
if (times.length === 0) usage();

// Mỗi mốc: lấy 1 khung từ mỗi video (-ss trước -i để tua nhanh), thu về 540x960, ghép ngang; rồi ghép dọc các mốc.
const inputs: string[] = [];
const labels: string[] = [];
times.forEach((t, i) => {
  inputs.push("-ss", String(t), "-i", sample, "-ss", String(t), "-i", rendered);
  labels.push(`[${2 * i}:v]scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2,trim=end_frame=1[a${i}];`);
  labels.push(`[${2 * i + 1}:v]scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2,trim=end_frame=1[b${i}];`);
  labels.push(`[a${i}][b${i}]hstack=inputs=2[row${i}];`);
});
const rows = times.map((_, i) => `[row${i}]`).join("");
const filter = labels.join("") + (times.length > 1 ? `${rows}vstack=inputs=${times.length}[out]` : `[row0]copy[out]`);
try {
  execFileSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", filter, "-map", "[out]", "-frames:v", "1", out], {
    stdio: "inherit",
  });
} catch (error) {
  if ((error as { code?: string }).code === "ENOENT") {
    console.error("Cần ffmpeg trong PATH");
    process.exit(2);
  }
  throw error;
}
console.log(`Đã ghi ${out}: ${times.length} hàng × 2 cột (mẫu | dựng), mỗi ô 540×960`);
```
Chạy thử với hai file mp4 bất kỳ có trên máy (hoặc cùng một file hai lần) và ghi đầu ra vào report; `npm run typecheck`, `npm run lint` sạch.

- [ ] **Step 2 (điều phối viên): Lấy video mẫu** — tải về `.superpowers/sample/theanh28-phu-tho.mp4` (`.superpowers/` được bỏ qua từ Task 1) bằng `yt-dlp --impersonate chrome -o ".superpowers/sample/theanh28-phu-tho.%(ext)s" "https://www.tiktok.com/@theanh28entertainment/video/7696506064186969364"` (yt-dlp cần `curl_cffi`, xem bộ nhớ dự án). Không được thì ghi "thiếu video mẫu" và chỉ làm bước 4.
- [ ] **Step 3 (điều phối viên): Dựng bản so sánh** — chạy e2e Task 3 lấy MP4 trong `test-results/` (giọng giả, ảnh giả) **và** một bản dựng bằng tay với giọng Edge + ảnh/video thật như Task 13 của 3C (bản này mới so được nhịp và bố cục). Chạy `npm run contact:sheet -- <mau> <dung> .superpowers/sample/so-khung.png 1,8,20,30`. Đo mức âm video mẫu: `npm run measure:mp4 -- <mau>` (ghi giọng, nhạc lúc nghỉ, đỉnh) để đối chiếu với đặc tả (giọng ≈ −16,5 dB, nhạc nghỉ ≈ −30 dB).
- [ ] **Step 4 (điều phối viên): Danh sách kiểm, ghi từng dòng đạt/lệch (ước lượng px ở khung 540×960):**
  - Cảnh mở đầu: ảnh phủ y 0→500; dải gradient bắt đầu ≈ y 430; chip thương hiệu ≈ y 505; tem ngày ≈ y 575; tiêu đề in hoa bắt đầu ≈ y 607, tối đa 3 dòng, cỡ chữ ≈ 32 px; hoạ tiết nền dưới y 725.
  - Cảnh thân bài: dải ảnh y 190→650 full ngang; nền mờ phủ toàn khung; tem ngày góc dưới trái dải (≈ y 618); logo + tên kênh trên phải (≈ y 125); dòng "THEO:"/"ẢNH:" trên trái (≈ y 120).
  - Nhịp: thời lượng cảnh mở đầu của ta so với mẫu ≈ 5,7 s; khoảng nghỉ giữa câu.
  - Âm: giọng/nhạc/đỉnh của ta so với mẫu.
  - Khác biệt chấp nhận được (ghi rõ): hoạ tiết chấm thay bản đồ thế giới; cắt thẳng thay mờ chồng 0,2 s.
- [ ] **Step 5 (điều phối viên): Ghi vào đặc tả mục 13** bảng so khung + số đo mẫu; nếu có lệch > 15 px ở một mốc, mở việc chỉnh `layout.ts` (một đợt sửa riêng có test template cập nhật) — chỉ khi Hải muốn sát mẫu hơn; mặc định ghi nhận.
- [ ] **Step 6: Commit** (điều phối viên) — `feat(scripts): ảnh ghép so khung với video mẫu` rồi `docs: so khung và mức âm video mẫu`

---

### Task 5: Gom hằng mã hoá về một chỗ và đo bitrate 5 so với 8 Mbps (để Hải chốt)

**Files:**
- Create: `src/client/render/encodingDefaults.ts`
- Modify: `src/client/render/render.worker.ts` (dùng hằng mới), `src/client/render/RenderJob.ts` (thêm `videoBitrate?: number`), `src/client/controllers/RenderJobBuilder.ts` (truyền `videoBitrate` nếu `RenderJobBuilderDeps.videoBitrate` có)
- Test: `tests/client/render/encodingDefaults.test.ts`, bổ sung `tests/client/controllers/RenderJobBuilder.test.ts`

**Interfaces:**
- Produces: `RENDER_VIDEO_BITRATE = 8_000_000`, `RENDER_AUDIO_BITRATE = 192_000`, `VIDEO_BITRATE_CHOICES = { standard: 8_000_000, light: 5_000_000 } as const`; `RenderJob.videoBitrate?: number` (worker dùng `job.videoBitrate ?? RENDER_VIDEO_BITRATE`); `RenderJobBuilderDeps.videoBitrate?: number`.
- Đo (điều phối viên, sau khi agent xong): dựng cùng một dự án ở 8 và 5 Mbps bằng cách đặt tạm `videoBitrate` trong `createStudio` (không commit), ghi kích thước tệp, thời gian dựng và chụp phóng vùng tiêu đề + dải ảnh ở cả hai; đưa cho Hải chọn. Mặc định code giữ 8 Mbps.

- [ ] **Step 1: Viết test**

`tests/client/render/encodingDefaults.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { RENDER_AUDIO_BITRATE, RENDER_VIDEO_BITRATE, VIDEO_BITRATE_CHOICES } from "@/client/render/encodingDefaults";

describe("encodingDefaults", () => {
  it("mặc định 8 Mbps hình, 192 kbps tiếng; có lựa chọn 5 Mbps", () => {
    expect(RENDER_VIDEO_BITRATE).toBe(8_000_000);
    expect(RENDER_AUDIO_BITRATE).toBe(192_000);
    expect(VIDEO_BITRATE_CHOICES).toEqual({ standard: 8_000_000, light: 5_000_000 });
    expect(VIDEO_BITRATE_CHOICES.standard).toBe(RENDER_VIDEO_BITRATE);
  });
});
```
Thêm vào cuối `tests/client/controllers/RenderJobBuilder.test.ts` (dùng `setup()` sẵn có trong file; thêm tham số tuỳ chọn nếu cần):
```ts
describe("RenderJobBuilder — bitrate", () => {
  it("không đặt thì job không có videoBitrate; đặt thì truyền vào job", async () => {
    const { builder, data } = setup();
    expect((await builder.build(data)).job.videoBitrate).toBeUndefined();
    const light = new RenderJobBuilder({
      templates: defaultTemplateRegistry(),
      uploads: memoryUploads("u").uploads,
      tracks: { bytes: async () => new ArrayBuffer(0) },
      decoder: { decode: async () => ({ channels: [new Float32Array(48000)], sampleRate: 48000, durationSec: 1 }) },
      origin: "http://localhost:3100",
      videoBitrate: 5_000_000,
    });
    expect((await light.build(data)).job.videoBitrate).toBe(5_000_000);
  });
});
```
(Nếu `data` của `setup()` có giọng 2 s mà decoder giả ở trên trả 1 s thì không sao: builder chỉ cần giải mã được.)

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/render/encodingDefaults.test.ts tests/client/controllers/RenderJobBuilder.test.ts` → FAIL.

- [ ] **Step 3: Viết `src/client/render/encodingDefaults.ts`**
```ts
/** Hằng mã hoá của bộ dựng, gom một chỗ để đổi được từ cấu hình thay vì sửa worker. */
export const RENDER_VIDEO_BITRATE = 8_000_000;
export const RENDER_AUDIO_BITRATE = 192_000;
/** Lựa chọn cho người dùng ở bước dựng (chặng sau); "light" cho mạng yếu/file nhỏ. */
export const VIDEO_BITRATE_CHOICES = { standard: 8_000_000, light: 5_000_000 } as const;
```

- [ ] **Step 4: Sửa `render.worker.ts`** — xoá hai hằng `VIDEO_BITRATE`/`AUDIO_BITRATE` cục bộ, import `RENDER_AUDIO_BITRATE, RENDER_VIDEO_BITRATE` từ `./encodingDefaults`, và dòng tạo encoder thành `new Mp4Encoder({ canvas, fps, videoBitrate: job.videoBitrate ?? RENDER_VIDEO_BITRATE, audioBitrate: RENDER_AUDIO_BITRATE })`. Sửa `RenderJob.ts`: thêm `/** Bitrate hình (bps); bỏ trống dùng RENDER_VIDEO_BITRATE. */ videoBitrate?: number;` vào `RenderJob`. Sửa `RenderJobBuilder.ts`: `RenderJobBuilderDeps.videoBitrate?: number`; khi dựng `job`, thêm `...(this.deps.videoBitrate ? { videoBitrate: this.deps.videoBitrate } : {})`.

- [ ] **Step 5: Chạy test, typecheck, lint** — `npx vitest run` → PASS; sạch. (Test worker hiện có không kiểm hằng, nên không cần sửa.)

- [ ] **Step 6 (điều phối viên): Đo** — `preview_start`, tab riêng `/studio`, dựng tin mẫu giọng Edge với ảnh/video thật (như Task 13 của 3C) ở 8 Mbps; đặt tạm `videoBitrate: 5_000_000` trong `createStudio` (hoặc `localStorage`? không — sửa tạm code), dựng lại cùng dự án, ghi: kích thước tệp, thời gian dựng, ảnh zoom (`computer zoom`) vùng tiêu đề cảnh mở đầu và vùng dải ảnh cảnh video ở cả hai. Hoàn lại code. Ghi kết quả vào `.superpowers/sdd/task-5-report.md` và đặc tả mục 13, kèm câu hỏi cho Hải: giữ 8 hay chuyển 5 (hoặc cho người dùng chọn ở bước 5 ở chặng sau).

- [ ] **Step 7: Commit** (điều phối viên) — `refactor(render): gom hằng mã hoá, job nhận videoBitrate tuỳ chọn`

---

### Task 6: Kiểm với key thật — Google TTS, Pexels, Pixabay (điều phối viên; chỉ khi Hải đã đưa key)

**Điều kiện:** `.env.local` có `GOOGLE_TTS_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY` và **không** có `FAKE_PROVIDERS=1` (Hải tự sửa file; điều phối viên không mở `.env.local`, chỉ hỏi Hải đã đặt chưa). Không có key → ghi "hoãn, cần key" vào report và lộ trình, chuyển Task 7.

- [ ] **Step 1: Giọng Google** — tab riêng `/studio`: danh sách giọng có hạng `Chirp3-HD`/`Neural2`/`Wavenet` (MiniMax đứng đầu nếu có); nghe thử câu tiêu đề; tạo giọng 6 câu, ghi thời gian; nếu lỗi 429/403 thì ghi thông báo tiếng Việt hiện ra (phải là "Hết hạn mức giọng đọc hôm nay, liên hệ Hải" hoặc "Lỗi máy chủ" — không lộ key).
- [ ] **Step 2: Cảnh trám thật** — "Tự tìm cảnh còn trống": kết quả có `provider` pexels/pixabay (xem `read_network_requests` `/api/stock/search`), ảnh thumb hiện, chọn một video Pexels và một ảnh Pixabay; dựng → kiểm CORS tải thẳng từ CDN (không lỗi console), khung hình đúng.
- [ ] **Step 3: Bộ giới hạn đỉnh với giọng thật** — tải MP4, `npm run measure:mp4 -- <file>`: giọng −16,5 ± 1 dB, đỉnh < 0,89, nhạc nghỉ ghi số. Nếu giọng Chirp3-HD có đỉnh dồn làm RMS lệch > 1 dB, ghi lại để chỉnh `MIX_DEFAULTS` ở đợt sau (không tự đổi).
- [ ] **Step 4: Giới hạn và lỗi** — tắt mạng giả lập (`context.setOffline` không có ở tab app; dùng DevTools? bỏ qua) → thay bằng: nhập từ khoá không có kết quả (chuỗi vô nghĩa) → cảnh báo "Không tìm ra kết quả", nền mặc định; cảnh báo hết lượt của một nguồn hiện ở `warnings` nếu xảy ra.
- [ ] **Step 5: Ghi** — `.superpowers/sdd/task-6-report.md` + đặc tả mục 13 (bảng số đo với giọng thật). Commit docs.

---

### Task 7: Chuẩn bị deploy — kiểm biến môi trường trước build, header bảo mật, README, `.env.example`

**Files:**
- Create: `src/server/env/validateEnv.ts`, `scripts/check-env.ts`
- Modify: `package.json` (scripts `"check-env": "tsx scripts/check-env.ts"`, `"prebuild": "tsx scripts/check-env.ts"`), `next.config.ts` (headers), `.env.example`, `README.md`
- Test: `tests/server/env/validateEnv.test.ts`

**Interfaces:**
- Produces: `validateEnv(env: Record<string, string | undefined>): { ok: true; summary: string[] } | { ok: false; problems: string[] }` — quy tắc:
  - `AUTH_SECRET` ≥ 32 ký tự (thiếu/ngắn → lỗi).
  - `APP_USERS` phải decode base64 → JSON → qua `UserDirectory.fromEnv` (1–5 người); lỗi nêu rõ nhưng **không in nội dung**.
  - Nếu `FAKE_PROVIDERS === "1"`: cảnh báo trong summary "đang dùng nhà cung cấp giả"; nếu đồng thời `VERCEL_ENV === "production"` hoặc (`VERCEL` và `NODE_ENV === "production"`) → lỗi.
  - Nếu không fake: `GOOGLE_TTS_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY` đều phải có (không rỗng).
  - `EDGE_TTS_DEV === "1"` khi `VERCEL` hoặc `NODE_ENV === "production"` → lỗi.
  - `MINIMAX_API_KEY` và `MINIMAX_VOICES`: có cả hai → `parseMiniMaxVoices` phải qua (lỗi thì báo), có một → cảnh báo; không có → bỏ qua.
  - `summary` liệt kê trạng thái từng nhóm bằng tiếng Việt, không in giá trị key (chỉ "đã đặt"/"trống").
- `scripts/check-env.ts`: nạp `.env.local` và `.env` nếu có (tự đọc file dạng `KEY=VALUE`, bỏ dòng `#`, không dùng thư viện; biến đã có trong `process.env` được ưu tiên — giống Next), gọi `validateEnv(process.env)`; lỗi → in từng dòng "✗ …" và `process.exit(1)`; không lỗi → in "✓ …". Chạy tự động trước `next build` (Vercel chạy `npm run build` nên `prebuild` chạy theo) — deploy sai cấu hình sẽ hỏng ngay ở bước build với lý do rõ.

- [ ] **Step 1: Viết `tests/server/env/validateEnv.test.ts`**
```ts
import { describe, expect, it } from "vitest";
import { validateEnv } from "@/server/env/validateEnv";

const HASH = "$2b$04$abcdefghijklmnopqrstuuJ0123456789abcdefghijklmnopqrstu"; // cùng dạng với tests/server/auth/UserDirectory.test.ts
const users = Buffer.from(JSON.stringify([{ username: "hai", passwordHash: HASH, displayName: "Hải" }])).toString("base64");
const base = { AUTH_SECRET: "s".repeat(32), APP_USERS: users };

describe("validateEnv", () => {
  it("cấu hình production đủ key thì ok, summary không lộ key", () => {
    const r = validateEnv({ ...base, GOOGLE_TTS_API_KEY: "AIza-secret", PEXELS_API_KEY: "p", PIXABAY_API_KEY: "x", VERCEL_ENV: "production" });
    expect(r.ok).toBe(true);
    const text = r.ok ? r.summary.join("\n") : "";
    expect(text).not.toContain("AIza-secret");
    expect(text).toMatch(/Google TTS: đã đặt/);
  });

  it("thiếu AUTH_SECRET hoặc ngắn thì lỗi", () => {
    const r = validateEnv({ ...base, AUTH_SECRET: "ngan", FAKE_PROVIDERS: "1" });
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.problems.join()).toMatch(/AUTH_SECRET/);
  });

  it("APP_USERS hỏng thì lỗi mà không in nội dung", () => {
    const r = validateEnv({ ...base, APP_USERS: Buffer.from("[]").toString("base64"), FAKE_PROVIDERS: "1" });
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.problems.join()).toMatch(/APP_USERS/);
    expect(r.ok ? "" : r.problems.join()).not.toContain("[]");
  });

  it("FAKE_PROVIDERS trên production là lỗi; trên máy dev chỉ cảnh báo", () => {
    expect(validateEnv({ ...base, FAKE_PROVIDERS: "1", VERCEL_ENV: "production" }).ok).toBe(false);
    const dev = validateEnv({ ...base, FAKE_PROVIDERS: "1" });
    expect(dev.ok).toBe(true);
    expect(dev.ok ? dev.summary.join() : "").toMatch(/GIẢ LẬP/);
  });

  it("không fake mà thiếu key nào thì lỗi nêu đúng tên biến", () => {
    const r = validateEnv({ ...base, GOOGLE_TTS_API_KEY: "g", PEXELS_API_KEY: "" });
    expect(r.ok).toBe(false);
    const p = r.ok ? "" : r.problems.join("\n");
    expect(p).toMatch(/PEXELS_API_KEY/);
    expect(p).toMatch(/PIXABAY_API_KEY/);
    expect(p).not.toMatch(/GOOGLE_TTS_API_KEY/);
  });

  it("EDGE_TTS_DEV khi deploy là lỗi", () => {
    expect(validateEnv({ ...base, FAKE_PROVIDERS: "1", EDGE_TTS_DEV: "1", VERCEL: "1" }).ok).toBe(false);
  });

  it("MiniMax: thiếu một trong hai thì cảnh báo, sai JSON thì lỗi", () => {
    const warn = validateEnv({ ...base, FAKE_PROVIDERS: "1", MINIMAX_API_KEY: "k" });
    expect(warn.ok).toBe(true);
    expect(warn.ok ? warn.summary.join() : "").toMatch(/MiniMax/);
    const bad = validateEnv({ ...base, FAKE_PROVIDERS: "1", MINIMAX_API_KEY: "k", MINIMAX_VOICES: "không phải json" });
    expect(bad.ok).toBe(false);
  });
});
```
(`UserDirectory.fromEnv` nhận base64 của JSON hoặc JSON bắt đầu bằng `[`; có getter `size`.)

- [ ] **Step 2: Chạy để thấy lỗi** — FAIL (thiếu module).

- [ ] **Step 3: Viết `src/server/env/validateEnv.ts`**
```ts
import { UserDirectory } from "@/server/auth/UserDirectory";
import { parseMiniMaxVoices } from "@/server/tts/MiniMaxTtsService";

export type EnvCheck = { ok: true; summary: string[] } | { ok: false; problems: string[] };

const set = (v: string | undefined) => (v && v.trim() ? "đã đặt" : "trống");

/** Kiểm biến môi trường trước khi build/deploy. Không bao giờ đưa giá trị key vào thông báo. */
export function validateEnv(env: Record<string, string | undefined>): EnvCheck {
  const problems: string[] = [];
  const summary: string[] = [];
  const deployed = env.VERCEL_ENV === "production" || (Boolean(env.VERCEL) && env.NODE_ENV === "production");
  const fake = env.FAKE_PROVIDERS === "1";

  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) problems.push("AUTH_SECRET phải có và dài ít nhất 32 ký tự");
  else summary.push("AUTH_SECRET: đã đặt");

  if (!env.APP_USERS) problems.push("APP_USERS trống (tạo bằng npm run user:encode)");
  else {
    try {
      const users = UserDirectory.fromEnv(env.APP_USERS);
      summary.push(`APP_USERS: ${users.size} tài khoản`);
    } catch (error) {
      problems.push(`APP_USERS không hợp lệ: ${error instanceof Error ? error.message : "không đọc được"}`);
    }
  }

  if (fake) {
    if (deployed) problems.push("FAKE_PROVIDERS=1 không được bật trên production (Vercel)");
    else summary.push("Nhà cung cấp: GIẢ LẬP (chỉ để phát triển)");
  } else {
    for (const key of ["GOOGLE_TTS_API_KEY", "PEXELS_API_KEY", "PIXABAY_API_KEY"] as const) {
      if (!env[key] || !env[key]!.trim()) problems.push(`${key} trống (bỏ FAKE_PROVIDERS thì phải có key thật)`);
    }
    summary.push(`Google TTS: ${set(env.GOOGLE_TTS_API_KEY)}; Pexels: ${set(env.PEXELS_API_KEY)}; Pixabay: ${set(env.PIXABAY_API_KEY)}`);
  }

  if (env.EDGE_TTS_DEV === "1" && (Boolean(env.VERCEL) || env.NODE_ENV === "production")) {
    problems.push("EDGE_TTS_DEV=1 chỉ dùng trên máy dev, không dùng khi deploy");
  }

  const mmKey = env.MINIMAX_API_KEY?.trim();
  const mmVoices = env.MINIMAX_VOICES?.trim();
  if (mmKey && mmVoices) {
    try {
      summary.push(`MiniMax: ${parseMiniMaxVoices(mmVoices).length} giọng clone`);
    } catch (error) {
      problems.push(`MINIMAX_VOICES không hợp lệ: ${error instanceof Error ? error.message : "sai định dạng"}`);
    }
  } else if (mmKey || mmVoices) {
    summary.push("MiniMax: cảnh báo — cần cả MINIMAX_API_KEY và MINIMAX_VOICES, đang bỏ qua");
  }

  return problems.length ? { ok: false, problems } : { ok: true, summary };
}
```

- [ ] **Step 4: Viết `scripts/check-env.ts`**
```ts
import { existsSync, readFileSync } from "node:fs";
import { validateEnv } from "../src/server/env/validateEnv";

/** Nạp KEY=VALUE từ file (bỏ dòng trống và #); biến đã có trong process.env được ưu tiên, giống Next. */
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");
const result = validateEnv(process.env);
if (result.ok) {
  for (const line of result.summary) console.log(`✓ ${line}`);
} else {
  for (const line of result.problems) console.error(`✗ ${line}`);
  console.error("Cấu hình môi trường chưa đúng, dừng build. Xem README mục Deploy.");
  process.exit(1);
}
```
Thêm scripts vào `package.json`: `"check-env": "tsx scripts/check-env.ts"`, `"prebuild": "tsx scripts/check-env.ts"`. Lưu ý: `tsx` đang là devDependency; Vercel cài devDependencies khi build (mặc định `npm install` có dev) nên `prebuild` chạy được. Nếu Hải đặt `NPM_CONFIG_PRODUCTION=true` thì không — ghi vào README là không đặt.

- [ ] **Step 5: `next.config.ts`** — thêm header bảo mật:
```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
```
(Không đặt CSP ở chặng này: worker `blob:`/`data:` và CDN Pexels/Pixabay cần liệt kê kỹ; ghi vào "để sau".)

- [ ] **Step 6: `.env.example`** — bỏ khối `ENABLE_DEV_PAGES` (trang dev đã gỡ); thêm đầu file:
```
# Trên Vercel: KHÔNG đặt FAKE_PROVIDERS và EDGE_TTS_DEV; đặt đủ 3 key + APP_USERS + AUTH_SECRET.
# Kiểm trước khi deploy: npm run check-env (cũng tự chạy trước npm run build)
```

- [ ] **Step 7: `README.md`** — thêm các mục (tiếng Việt, ngắn, có lệnh):
  - "Kiểm tra toàn luồng (Playwright)": `npm run test:e2e` cần Chrome (hoặc `PW_CHANNEL=msedge`), tự chạy app cổng 3101 với tài khoản thử sinh lúc chạy; `PW_HEADED=1` để xem; báo cáo ở `playwright-report/`.
  - "Đo âm một file MP4": `npm run measure:mp4 -- video.mp4` (cần ffmpeg); "So khung với video mẫu": `npm run contact:sheet -- mau.mp4 dung.mp4 so-khung.png 1,8,20`.
  - "Deploy lên Vercel" (từng bước cho Hải): (1) tạo repo GitHub riêng tư, `git remote add origin …`, `git push -u origin main` (chạy tay trong terminal tương tác); (2) Vercel → Add New Project → import repo, Framework Next.js, Node 22.x (Settings → General → Node.js Version); (3) Environment Variables (Production): `APP_USERS`, `AUTH_SECRET`, `GOOGLE_TTS_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`, tuỳ chọn `MINIMAX_API_KEY`, `MINIMAX_VOICES`; **không** đặt `FAKE_PROVIDERS`, `EDGE_TTS_DEV`; (4) Deploy; build sẽ chạy `check-env` và dừng nếu thiếu; (5) mở `https://<app>.vercel.app/dang-nhap`, đăng nhập, dựng thử; (6) thêm người dùng = sửa `APP_USERS` + Redeploy. Ghi chú gói Hobby chỉ dùng phi thương mại; giới hạn hàm 10 s (Hobby) đủ cho TTS từng câu; body 4,5 MB không ảnh hưởng vì file không lên server.
  - Bảng biến môi trường (tên, bắt buộc?, cách tạo).

- [ ] **Step 8: Chạy** — `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run check-env` (với `.env.local` hiện có → phải in ✓ và dòng "GIẢ LẬP"), `npm run build` (prebuild chạy check-env rồi build; sạch).

- [ ] **Step 9: Commit** (điều phối viên) — `feat(deploy): kiểm biến môi trường trước build, header bảo mật, hướng dẫn deploy`

---

### Task 8: Deploy và kiểm trên bản chạy thật (Hải bấm, điều phối viên kiểm)

- [ ] **Step 1 (Hải):** tạo repo GitHub + push `main`; tạo dự án Vercel, đặt biến môi trường theo README; Deploy. Báo URL + tài khoản thử (tạo bằng `npm run user:entry`, có thể là tài khoản riêng cho kiểm thử, xoá sau).
- [ ] **Step 2 (điều phối viên): Smoke bằng Playwright trên bản deploy** — `E2E_BASE_URL=https://<app>.vercel.app E2E_USER=<user> E2E_PASSWORD=<mật khẩu> npm run test:e2e -- e2e/01-nhap-tin.spec.ts` (bài này không phụ thuộc nhà cung cấp). Không chạy bài 02 trên production bằng máy (tốn hạn mức Google); thay vào đó:
- [ ] **Step 3 (điều phối viên): Dựng tay một tin trên bản deploy** trong tab riêng của trình duyệt nhúng: 5 bước với giọng Google + cảnh trám thật, tải MP4, `npm run measure:mp4`; ghi thời gian tạo giọng (hàm Vercel), thời gian dựng, kích thước; kiểm header bảo mật (`read_network_requests` → response headers), cookie `Secure; HttpOnly`, `/api/*` không có cookie → 401 JSON, `/studio` không cookie → 307 về `/dang-nhap`.
- [ ] **Step 4 (điều phối viên): Ghi đặc tả mục 13 "Nghiệm thu chặng 4"** (bảng: e2e local, số đo bản deploy, so khung, bitrate, key thật) và cập nhật `00-lo-trinh.md` (chặng 4 xong; việc còn lại: quyết định bitrate, phong cách thứ hai, CSP, Vercel Pro nếu thu tiền). Commit docs.

---

## Hoàn thành chặng 4 khi

- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` sạch; `npm run test:e2e` 8 bài passed trên Chrome (ghi rõ headless/headed).
- Có `npm run measure:mp4`, `npm run contact:sheet`, `npm run check-env` chạy được và có tài liệu.
- Đặc tả mục 13 có: số đo e2e, bảng so khung với video mẫu (hoặc lý do thiếu mẫu), số đo bitrate 5/8 để Hải chốt, kết quả key thật (hoặc "hoãn, cần key"), kết quả bản deploy (hoặc "chờ Hải deploy").
- Hải duyệt.

## Rủi ro đã biết

- **WebCodecs trong Chrome headless:** nếu không mã hoá được H.264 ở headless, e2e phải chạy headed (có cửa sổ) — vẫn tự động nhưng không chạy được trên CI không màn hình. Ghi rõ trong README.
- **Hạn mức Google khi chạy e2e thật:** vì thế e2e luôn dùng nhà cung cấp giả; kiểm key thật làm tay (Task 6, 8).
- **Video mẫu TikTok:** yt-dlp có thể bị chặn; khi đó so khung dựa trên số đo đã ghi ở đặc tả mục 4.4 (đo tay từ trước).
- **Vercel Hobby:** hàm 10 s; một câu TTS Google thường < 3 s. Tin rất dài (> 5 000 ký tự đã bị chặn 413) không ảnh hưởng.
- **`prebuild` cần `tsx`:** Vercel cài devDependencies mặc định; nếu Hải bật "chỉ cài production" thì build hỏng với lỗi rõ ràng (`tsx: not found`) — README nhắc.
