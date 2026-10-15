# Tin Video Studio — Chặng 1: Nền móng, model, server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng app Next.js chạy được với đăng nhập ≤ 5 tài khoản, các lớp model nghiệp vụ thuần TypeScript, và 3 API có bảo vệ: danh sách giọng, tạo giọng (Google TTS), tìm cảnh trám (Pexels + Pixabay), kèm bản giả lập để dev không cần key.

**Architecture:** Bốn lớp View → Controller → Model / Service. Chặng này làm Model (`src/domain`), Service + Controller phía server (`src/server`), route handler mỏng (`src/app/api`), proxy chặn truy cập chưa đăng nhập, và view tối thiểu (trang đăng nhập + trang studio tạm). Phụ thuộc phía server được lắp ở một chỗ duy nhất: `src/server/container.ts`.

**Tech Stack:** Next.js 16.4.1 (App Router, `src/` dir), React 19.3.1, TypeScript 5.9.3, Tailwind 4.3.3, zod 4.6.7, jose 6.2.12 (JWT phiên đăng nhập), bcryptjs 3.0.3, Vitest 5.0.4, tsx 4.23.15.

**Đặc tả:** `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md`. **Lộ trình:** `docs/superpowers/plans/2026-10-15-00-lo-trinh.md`.

## Global Constraints

- Thư mục dự án: `D:\Brain Hainv\ca-nhan\tools\tin-video-studio` (đã `git init`, nhánh `main`). Mọi đường dẫn trong kế hoạch tính từ thư mục này.
- Ngôn ngữ giao diện và thông báo lỗi cho người dùng: **tiếng Việt có dấu**. Tên lớp, hàm, biến: tiếng Anh.
- Lớp `src/domain` **không import** React, `next/*`, DOM, `fetch`, `Buffer`, hay bất cứ thứ gì ngoài `src/domain`.
- Route handler trong `src/app/api` chỉ được gọi factory trong `src/server/http` + `serverContainer()`. Không viết logic trong route.
- Tối đa **5 tài khoản**. Tạo giọng tối đa **5.000 ký tự** mỗi lần. Tốc độ đọc **0.8–1.3**, mặc định **1.07**.
- Khoảng thời gian dựng mặc định: đệm đầu **0.3 s**, nghỉ giữa câu **0.35 s**, đệm cuối **0.6 s**.
- Ngôn ngữ giọng: **`vi-VN`**. Định dạng giọng trả về từ Google: **MP3 48 kHz**.
- Cookie phiên: **`tvs_session`**, HttpOnly, SameSite=Lax, Secure ở production, sống **7 ngày**.
- `AUTH_SECRET` ≥ **32 ký tự**. `APP_USERS` là **base64 của JSON** (hoặc JSON thô bắt đầu bằng `[`).
- Không gửi file người dùng lên server. Không log API key.
- Mọi commit kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Agent thực thi **không chạy `git push`**, không đăng nhập Vercel / GitHub. Chỉ commit local.

**Thay đổi nhỏ so với đặc tả:** đặc tả ghi `npm run hash-password`. Kế hoạch thay bằng 2 lệnh `npm run user:entry` (tạo 1 dòng tài khoản có mật khẩu băm) và `npm run user:encode` (đóng gói danh sách thành base64). Lý do: Next.js tự mở rộng ký tự `$` trong file `.env`, làm hỏng chuỗi bcrypt `$2b$10$…`. Base64 không chứa `$`.

## Cấu trúc file chặng 1

```
package.json, tsconfig.json, next.config.ts, postcss.config.mjs, eslint.config.mjs,
vitest.config.ts, .gitignore, .env.example, .claude/launch.json, README.md
scripts/users.ts                         # tạo / đóng gói tài khoản
src/
  proxy.ts                               # chặn truy cập chưa đăng nhập
  app/layout.tsx, app/globals.css, app/page.tsx
  app/dang-nhap/page.tsx
  app/studio/page.tsx                    # trang tạm, chặng 3 thay
  app/api/auth/login/route.ts
  app/api/auth/logout/route.ts
  app/api/tts/route.ts
  app/api/tts/voices/route.ts
  app/api/stock/search/route.ts
  domain/errors.ts                       # lỗi nghiệp vụ dùng chung
  domain/ids.ts                          # sinh id
  domain/SentenceSplitter.ts
  domain/Scene.ts
  domain/NewsProject.ts
  domain/VoiceSettings.ts
  domain/Narration.ts
  domain/Timeline.ts
  domain/Footage.ts                      # ImageFootage | VideoFootage | FallbackFootage
  domain/FootageBoard.ts                 # gán cảnh trám cho cảnh
  domain/BrandKit.ts
  domain/MusicTrack.ts
  server/container.ts
  server/auth/UserDirectory.ts
  server/auth/PasswordHasher.ts
  server/auth/SessionService.ts
  server/auth/AuthController.ts
  server/http/cookies.ts
  server/http/errorResponse.ts
  server/http/upstream.ts                # fetch JSON + ánh xạ lỗi nhà cung cấp
  server/http/withAuth.ts
  server/http/authRoutes.ts
  server/http/ttsRoutes.ts
  server/http/stockRoutes.ts
  server/tts/TtsProvider.ts
  server/tts/GoogleTtsService.ts
  server/tts/FakeTtsProvider.ts
  server/tts/TtsController.ts
  server/stock/StockProvider.ts
  server/stock/PexelsService.ts
  server/stock/PixabayService.ts
  server/stock/FakeStockProvider.ts
  server/stock/StockController.ts
  client/services/AuthClient.ts
  client/controllers/SessionController.ts
  views/auth/LoginForm.tsx
  views/auth/LogoutButton.tsx
tests/                                   # gương theo src/
```

---

### Task 1: Khung dự án Next.js + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `tests/setup.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces: alias import `@/…` trỏ vào `src/…` (dùng được cả trong Next và Vitest). Lệnh `npm test`, `npm run typecheck`, `npm run build`, `npm run lint`.

- [ ] **Step 1: Cấu hình git local cho repo**

```bash
git config user.name "Hai"
git config user.email "bacsi.quanghoa@gmail.com"
git config core.autocrlf true
```

- [ ] **Step 2: Tạo `package.json`**

```json
{
  "name": "tin-video-studio",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3100",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "user:entry": "tsx scripts/users.ts entry",
    "user:encode": "tsx scripts/users.ts encode"
  },
  "dependencies": {
    "bcryptjs": "3.0.3",
    "jose": "6.2.12",
    "next": "16.4.1",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "zod": "4.6.7"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.3.3",
    "@types/node": "22.20.5",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "eslint": "^9",
    "eslint-config-next": "16.4.1",
    "tailwindcss": "4.3.3",
    "tsx": "4.23.15",
    "typescript": "5.9.3",
    "vitest": "5.0.4"
  }
}
```

- [ ] **Step 3: Tạo `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "noUncheckedIndexedAccess": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "scripts/**/*.ts", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Tạo các file cấu hình còn lại**

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
```

`postcss.config.mjs`:
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

`eslint.config.mjs`:
```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "docs/**"]),
]);
```

`vitest.config.ts`:
```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

`.gitignore`:
```
node_modules
.next
out
coverage
test-results
playwright-report
*.tsbuildinfo
next-env.d.ts
.env
.env.local
.env.*.local
users.local.json
```

`.env.example`:
```
# 1 = dùng giọng + cảnh trám giả lập, không cần key thật (chỉ cho dev)
FAKE_PROVIDERS=1

GOOGLE_TTS_API_KEY=
PEXELS_API_KEY=
PIXABAY_API_KEY=

# Base64 danh sách tài khoản, tạo bằng: npm run user:entry ... rồi npm run user:encode -- users.local.json
APP_USERS=

# Chuỗi ngẫu nhiên >= 32 ký tự: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET=
```

- [ ] **Step 5: Tạo layout và trang gốc**

`src/app/globals.css`:
```css
@import "tailwindcss";
```

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tin Video Studio",
  description: "Dựng video tin tức dọc 9:16 từ văn bản",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/studio");
}
```

- [ ] **Step 6: Viết test kiểm alias**

`tests/setup.test.ts`:
```ts
import { describe, expect, it } from "vitest";

describe("cấu hình test", () => {
  it("chạy được TypeScript", () => {
    const sum: number = [1, 2, 3].reduce((a, b) => a + b, 0);
    expect(sum).toBe(6);
  });
});
```

- [ ] **Step 7: Cài thư viện và chạy kiểm tra**

Run: `npm install`
Expected: cài xong, không có lỗi `ERESOLVE`.

Run: `npm test`
Expected: `1 passed`.

Run: `npm run typecheck`
Expected: không lỗi.

Run: `npm run build`
Expected: build thành công, có route `/` và `/_not-found`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts .gitignore .env.example src/app tests/setup.test.ts
git commit -m "chore: khung Next.js 16 + Vitest cho Tin Video Studio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Lỗi nghiệp vụ, sinh id, chia câu

**Files:**
- Create: `src/domain/errors.ts`, `src/domain/ids.ts`, `src/domain/SentenceSplitter.ts`
- Test: `tests/domain/SentenceSplitter.test.ts`, `tests/domain/errors.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `type ErrorCode = "VALIDATION" | "AUTH" | "NOT_FOUND" | "PAYLOAD_TOO_LARGE" | "QUOTA" | "UPSTREAM"`
  - `class DomainError extends Error { readonly code: ErrorCode }`, các lớp con `ValidationError(message)`, `AuthError(message?)`, `NotFoundError(message)`, `PayloadTooLargeError(message)`, `QuotaError(message)`, `UpstreamError(message)`
  - `type IdGenerator = () => string`, `randomIds(): IdGenerator`, `sequentialIds(prefix: string): IdGenerator`
  - `class SentenceSplitter { split(text: string): string[] }`

- [ ] **Step 1: Viết test lỗi**

`tests/domain/errors.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { AuthError, DomainError, QuotaError, ValidationError } from "@/domain/errors";

describe("DomainError", () => {
  it("giữ mã lỗi và tên lớp", () => {
    const e = new ValidationError("Sai dữ liệu");
    expect(e).toBeInstanceOf(DomainError);
    expect(e.code).toBe("VALIDATION");
    expect(e.name).toBe("ValidationError");
    expect(e.message).toBe("Sai dữ liệu");
  });

  it("AuthError có thông báo mặc định tiếng Việt", () => {
    expect(new AuthError().message).toBe("Sai tên đăng nhập hoặc mật khẩu");
  });

  it("QuotaError mang mã QUOTA", () => {
    expect(new QuotaError("Hết hạn mức").code).toBe("QUOTA");
  });
});
```

- [ ] **Step 2: Viết test chia câu**

`tests/domain/SentenceSplitter.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { SentenceSplitter } from "@/domain/SentenceSplitter";

const split = (t: string) => new SentenceSplitter().split(t);

describe("SentenceSplitter", () => {
  it("tách tại dấu chấm khi câu sau viết hoa", () => {
    expect(split("Câu một. Câu hai! Câu ba?")).toEqual(["Câu một.", "Câu hai!", "Câu ba?"]);
  });

  it("không tách số có dấu chấm ngăn cách", () => {
    expect(split("Bán 1.116,2 m2 đất. Thu hơn 545 triệu đồng.")).toEqual([
      "Bán 1.116,2 m2 đất.",
      "Thu hơn 545 triệu đồng.",
    ]);
    expect(split("Quy định tại khoản 3.357 Bộ luật Hình sự.")).toEqual([
      "Quy định tại khoản 3.357 Bộ luật Hình sự.",
    ]);
  });

  it("không tách sau chữ viết tắt", () => {
    expect(split("Vụ việc xảy ra ở TP. Hồ Chí Minh. Công an vào cuộc.")).toEqual([
      "Vụ việc xảy ra ở TP. Hồ Chí Minh.",
      "Công an vào cuộc.",
    ]);
  });

  it("không tách khi sau dấu chấm là chữ thường", () => {
    expect(split("Giá 5 tr. đồng mỗi tháng.")).toEqual(["Giá 5 tr. đồng mỗi tháng."]);
  });

  it("xuống dòng luôn là ranh giới câu", () => {
    expect(split("Phú Thọ: Khởi tố nguyên Chủ tịch xã\nCâu một. Câu hai.")).toEqual([
      "Phú Thọ: Khởi tố nguyên Chủ tịch xã",
      "Câu một.",
      "Câu hai.",
    ]);
  });

  it("giữ dấu ngoặc kép đóng trong câu", () => {
    expect(split('Ông hỏi: "Vì sao?" Rồi bỏ đi.')).toEqual(['Ông hỏi: "Vì sao?"', "Rồi bỏ đi."]);
  });

  it("gộp khoảng trắng thừa và bỏ câu rỗng", () => {
    expect(split("  Câu   một.\n\n\n  Câu hai.  ")).toEqual(["Câu một.", "Câu hai."]);
  });

  it("text rỗng trả về mảng rỗng", () => {
    expect(split("   \n ")).toEqual([]);
  });
});
```

- [ ] **Step 3: Chạy test để thấy lỗi**

Run: `npx vitest run tests/domain`
Expected: FAIL, `Cannot find module '@/domain/errors'` và `'@/domain/SentenceSplitter'`.

- [ ] **Step 4: Viết `src/domain/errors.ts`**

```ts
export type ErrorCode = "VALIDATION" | "AUTH" | "NOT_FOUND" | "PAYLOAD_TOO_LARGE" | "QUOTA" | "UPSTREAM";

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "VALIDATION");
  }
}

export class AuthError extends DomainError {
  constructor(message = "Sai tên đăng nhập hoặc mật khẩu") {
    super(message, "AUTH");
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
  }
}

export class PayloadTooLargeError extends DomainError {
  constructor(message: string) {
    super(message, "PAYLOAD_TOO_LARGE");
  }
}

export class QuotaError extends DomainError {
  constructor(message: string) {
    super(message, "QUOTA");
  }
}

export class UpstreamError extends DomainError {
  constructor(message: string) {
    super(message, "UPSTREAM");
  }
}
```

- [ ] **Step 5: Viết `src/domain/ids.ts`**

```ts
export type IdGenerator = () => string;

export function randomIds(): IdGenerator {
  return () => globalThis.crypto.randomUUID();
}

export function sequentialIds(prefix: string): IdGenerator {
  let n = 0;
  return () => `${prefix}${++n}`;
}
```

- [ ] **Step 6: Viết `src/domain/SentenceSplitter.ts`**

```ts
const SENTENCE_END = /[.!?…]/;
const TRAILING_MARK = /[.!?…"”'’)\]]/;
const NEXT_SENTENCE_START = /^\s+["“'‘(\[]?[\p{Lu}\p{N}]/u;
const ABBREVIATIONS = new Set(["TP", "Tp", "TS", "ThS", "PGS", "GS", "BS", "Q", "P", "St", "Mr", "Mrs", "Dr"]);

export class SentenceSplitter {
  split(text: string): string[] {
    const sentences: string[] = [];
    const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n+/);
    for (const paragraph of paragraphs) this.splitParagraph(paragraph, sentences);
    return sentences;
  }

  private splitParagraph(paragraph: string, out: string[]): void {
    let start = 0;
    for (let i = 0; i < paragraph.length; i++) {
      const ch = paragraph.charAt(i);
      if (!SENTENCE_END.test(ch)) continue;

      let end = i + 1;
      while (end < paragraph.length && TRAILING_MARK.test(paragraph.charAt(end))) end++;

      const rest = paragraph.slice(end);
      const isParagraphEnd = rest.trim() === "";
      const nextLooksLikeSentence = NEXT_SENTENCE_START.test(rest);
      const isAbbreviation = ch === "." && this.endsWithAbbreviation(paragraph.slice(start, i));

      if (isParagraphEnd || (nextLooksLikeSentence && !isAbbreviation)) {
        this.push(out, paragraph.slice(start, end));
        start = end;
      }
      i = end - 1;
    }
    this.push(out, paragraph.slice(start));
  }

  private endsWithAbbreviation(chunk: string): boolean {
    const lastWord = chunk.trim().split(/\s+/).pop() ?? "";
    return ABBREVIATIONS.has(lastWord);
  }

  private push(out: string[], raw: string): void {
    const sentence = raw.replace(/\s+/g, " ").trim();
    if (sentence) out.push(sentence);
  }
}
```

- [ ] **Step 7: Chạy test**

Run: `npx vitest run tests/domain`
Expected: PASS toàn bộ (11 test).

- [ ] **Step 8: Commit**

```bash
git add src/domain/errors.ts src/domain/ids.ts src/domain/SentenceSplitter.ts tests/domain/errors.test.ts tests/domain/SentenceSplitter.test.ts
git commit -m "feat(domain): lỗi nghiệp vụ, sinh id, chia câu tin tiếng Việt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Cảnh và dự án tin

**Files:**
- Create: `src/domain/Scene.ts`, `src/domain/NewsProject.ts`
- Test: `tests/domain/Scene.test.ts`, `tests/domain/NewsProject.test.ts`

**Interfaces:**
- Consumes: `ValidationError`, `NotFoundError` (Task 2), `IdGenerator`, `sequentialIds` (Task 2), `SentenceSplitter` (Task 2).
- Produces:
  - `type SceneRole = "intro" | "body"`
  - `class Scene { readonly id: string; readonly text: string; readonly role: SceneRole; static create(id, text, role): Scene; withText(text): Scene }`
  - `interface NewsProjectInput { text: string; title?: string; sourceCredit: string; publishDate: Date; templateId: string }`
  - `class NewsProject { readonly title; readonly sourceCredit; readonly publishDate: Date; readonly templateId; readonly scenes: readonly Scene[]; static fromText(input, splitter, nextId): NewsProject; get introScene(): Scene; get bodyScenes(): Scene[]; get displayTitle(): string; get totalChars(): number; sceneById(id): Scene; updateSceneText(id, text): NewsProject; mergeWithNext(id): NewsProject; splitScene(id, at: number): NewsProject; withMeta(meta: { sourceCredit?: string; publishDate?: Date; templateId?: string }): NewsProject; formattedPublishDate(): string }`

- [ ] **Step 1: Viết test `Scene`**

`tests/domain/Scene.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { Scene } from "@/domain/Scene";
import { ValidationError } from "@/domain/errors";

describe("Scene", () => {
  it("chuẩn hoá khoảng trắng", () => {
    const s = Scene.create("s1", "  Câu   tin.  ", "body");
    expect(s.text).toBe("Câu tin.");
    expect(s.role).toBe("body");
  });

  it("không cho nội dung rỗng", () => {
    expect(() => Scene.create("s1", "   ", "body")).toThrow(ValidationError);
  });

  it("không cho id rỗng", () => {
    expect(() => Scene.create("", "Câu", "body")).toThrow(ValidationError);
  });

  it("withText tạo cảnh mới, giữ id và vai trò", () => {
    const a = Scene.create("s1", "Cũ.", "intro");
    const b = a.withText("Mới.");
    expect(b).not.toBe(a);
    expect(b.id).toBe("s1");
    expect(b.role).toBe("intro");
    expect(b.text).toBe("Mới.");
  });
});
```

- [ ] **Step 2: Viết test `NewsProject`**

`tests/domain/NewsProject.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { NewsProject, type NewsProjectInput } from "@/domain/NewsProject";
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
```

- [ ] **Step 3: Chạy test để thấy lỗi**

Run: `npx vitest run tests/domain/Scene.test.ts tests/domain/NewsProject.test.ts`
Expected: FAIL, không tìm thấy module `@/domain/Scene`, `@/domain/NewsProject`.

- [ ] **Step 4: Viết `src/domain/Scene.ts`**

```ts
import { ValidationError } from "./errors";

export type SceneRole = "intro" | "body";

export class Scene {
  private constructor(
    readonly id: string,
    readonly text: string,
    readonly role: SceneRole,
  ) {}

  static create(id: string, text: string, role: SceneRole): Scene {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!id) throw new ValidationError("Cảnh thiếu id");
    if (!clean) throw new ValidationError("Nội dung cảnh không được trống");
    return new Scene(id, clean, role);
  }

  withText(text: string): Scene {
    return Scene.create(this.id, text, this.role);
  }
}
```

- [ ] **Step 5: Viết `src/domain/NewsProject.ts`**

```ts
import { NotFoundError, ValidationError } from "./errors";
import type { IdGenerator } from "./ids";
import { Scene } from "./Scene";
import type { SentenceSplitter } from "./SentenceSplitter";

export interface NewsProjectInput {
  text: string;
  title?: string;
  sourceCredit: string;
  publishDate: Date;
  templateId: string;
}

interface NewsProjectMeta {
  sourceCredit?: string;
  publishDate?: Date;
  templateId?: string;
}

const comparable = (s: string) =>
  s
    .replace(/[.!?…\s]+$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("vi");

export class NewsProject {
  private constructor(
    readonly title: string,
    readonly sourceCredit: string,
    readonly publishDate: Date,
    readonly templateId: string,
    readonly scenes: readonly Scene[],
    private readonly nextId: IdGenerator,
  ) {}

  static fromText(input: NewsProjectInput, splitter: SentenceSplitter, nextId: IdGenerator): NewsProject {
    if (!input.templateId) throw new ValidationError("Chưa chọn phong cách video");
    const sentences = splitter.split(input.text);
    const typedTitle = input.title?.replace(/\s+/g, " ").trim();
    const firstSentence = sentences[0];
    if (!typedTitle && firstSentence === undefined) throw new ValidationError("Chưa có nội dung tin");

    const title = typedTitle || (firstSentence as string);
    const body =
      firstSentence !== undefined && comparable(firstSentence) === comparable(title) ? sentences.slice(1) : sentences;
    if (body.length === 0) throw new ValidationError("Tin cần ít nhất một câu ngoài tiêu đề");

    const scenes = [Scene.create(nextId(), title, "intro"), ...body.map((s) => Scene.create(nextId(), s, "body"))];
    return new NewsProject(title, input.sourceCredit.trim(), input.publishDate, input.templateId, scenes, nextId);
  }

  get introScene(): Scene {
    return this.scenes[0] as Scene;
  }

  get bodyScenes(): Scene[] {
    return this.scenes.slice(1);
  }

  get displayTitle(): string {
    return this.title.replace(/[.!?…]+$/u, "").trim();
  }

  get totalChars(): number {
    return this.scenes.reduce((n, s) => n + s.text.length, 0);
  }

  formattedPublishDate(): string {
    const d = this.publishDate;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  sceneById(id: string): Scene {
    const scene = this.scenes.find((s) => s.id === id);
    if (!scene) throw new NotFoundError(`Không tìm thấy cảnh ${id}`);
    return scene;
  }

  updateSceneText(id: string, text: string): NewsProject {
    const updated = this.sceneById(id).withText(text);
    const scenes = this.scenes.map((s) => (s.id === id ? updated : s));
    const title = updated.role === "intro" ? updated.text : this.title;
    return this.copy({ scenes, title });
  }

  mergeWithNext(id: string): NewsProject {
    const index = this.indexOf(id);
    const current = this.scenes[index] as Scene;
    const next = this.scenes[index + 1];
    if (current.role === "intro") throw new ValidationError("Không gộp được cảnh mở đầu");
    if (!next) throw new ValidationError("Cảnh cuối không có cảnh sau để gộp");
    const merged = current.withText(`${current.text} ${next.text}`);
    const scenes = [...this.scenes.slice(0, index), merged, ...this.scenes.slice(index + 2)];
    return this.copy({ scenes });
  }

  splitScene(id: string, at: number): NewsProject {
    const index = this.indexOf(id);
    const current = this.scenes[index] as Scene;
    if (current.role === "intro") throw new ValidationError("Không tách được cảnh mở đầu");
    const left = current.text.slice(0, at).trim();
    const right = current.text.slice(at).trim();
    if (!left || !right) throw new ValidationError("Vị trí tách phải nằm giữa câu");
    const scenes = [
      ...this.scenes.slice(0, index),
      current.withText(left),
      Scene.create(this.nextId(), right, "body"),
      ...this.scenes.slice(index + 1),
    ];
    return this.copy({ scenes });
  }

  withMeta(meta: NewsProjectMeta): NewsProject {
    if (meta.templateId !== undefined && !meta.templateId) throw new ValidationError("Chưa chọn phong cách video");
    return new NewsProject(
      this.title,
      meta.sourceCredit !== undefined ? meta.sourceCredit.trim() : this.sourceCredit,
      meta.publishDate ?? this.publishDate,
      meta.templateId ?? this.templateId,
      this.scenes,
      this.nextId,
    );
  }

  private indexOf(id: string): number {
    const index = this.scenes.findIndex((s) => s.id === id);
    if (index < 0) throw new NotFoundError(`Không tìm thấy cảnh ${id}`);
    return index;
  }

  private copy(change: { scenes: readonly Scene[]; title?: string }): NewsProject {
    return new NewsProject(
      change.title ?? this.title,
      this.sourceCredit,
      this.publishDate,
      this.templateId,
      change.scenes,
      this.nextId,
    );
  }
}
```

- [ ] **Step 6: Chạy test**

Run: `npx vitest run tests/domain`
Expected: PASS toàn bộ.

- [ ] **Step 7: Commit**

```bash
git add src/domain/Scene.ts src/domain/NewsProject.ts tests/domain/Scene.test.ts tests/domain/NewsProject.test.ts
git commit -m "feat(domain): cảnh và dự án tin (tạo từ text, sửa, gộp, tách)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Cài đặt giọng, giọng đọc từng cảnh, mốc thời gian

**Files:**
- Create: `src/domain/VoiceSettings.ts`, `src/domain/Narration.ts`, `src/domain/Timeline.ts`
- Test: `tests/domain/VoiceSettings.test.ts`, `tests/domain/Narration.test.ts`, `tests/domain/Timeline.test.ts`

**Interfaces:**
- Consumes: `ValidationError` (Task 2), `Scene` (Task 3).
- Produces:
  - `class VoiceSettings { static MIN_RATE = 0.8; static MAX_RATE = 1.3; static DEFAULT_RATE = 1.07; readonly voiceName: string; readonly speakingRate: number; static create(voiceName: string, speakingRate?: number): VoiceSettings; withRate(rate: number): VoiceSettings; equals(other: VoiceSettings): boolean }`
  - `class Narration { readonly sceneId; readonly text; readonly audio: Uint8Array; readonly mimeType; readonly durationSec; readonly voice: VoiceSettings; static create(p: NarrationProps): Narration; isStaleFor(scene: Scene, voice: VoiceSettings): boolean }`
  - `interface TimelineConfig { leadInSec: number; gapSec: number; tailSec: number }`, `const DEFAULT_TIMELINE_CONFIG: TimelineConfig`
  - `interface SceneSlot { sceneId: string; index: number; start: number; end: number; voiceStart: number; voiceEnd: number }`
  - `class Timeline { readonly slots: readonly SceneSlot[]; readonly totalDuration: number; static build(entries: ReadonlyArray<{ sceneId: string; durationSec: number }>, config?: TimelineConfig): Timeline; slotAt(t: number): SceneSlot; frameCount(fps: number): number }`

- [ ] **Step 1: Viết test**

`tests/domain/VoiceSettings.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { ValidationError } from "@/domain/errors";

describe("VoiceSettings", () => {
  it("mặc định tốc độ 1.07", () => {
    expect(VoiceSettings.create("vi-VN-Neural2-A").speakingRate).toBe(1.07);
  });

  it("làm tròn tốc độ 2 chữ số", () => {
    expect(VoiceSettings.create("vi-VN-Neural2-A", 1.0749).speakingRate).toBe(1.07);
  });

  it("chặn tốc độ ngoài 0.8–1.3", () => {
    expect(() => VoiceSettings.create("vi-VN-Neural2-A", 0.79)).toThrow(ValidationError);
    expect(() => VoiceSettings.create("vi-VN-Neural2-A", 1.31)).toThrow(ValidationError);
    expect(() => VoiceSettings.create("vi-VN-Neural2-A", Number.NaN)).toThrow(ValidationError);
  });

  it("chặn tên giọng sai dạng", () => {
    expect(() => VoiceSettings.create("hoaimy")).toThrow(ValidationError);
  });

  it("withRate và equals", () => {
    const a = VoiceSettings.create("vi-VN-Neural2-A", 1);
    const b = a.withRate(1.1);
    expect(a.equals(b)).toBe(false);
    expect(b.equals(VoiceSettings.create("vi-VN-Neural2-A", 1.1))).toBe(true);
  });
});
```

`tests/domain/Narration.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { Narration } from "@/domain/Narration";
import { Scene } from "@/domain/Scene";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { ValidationError } from "@/domain/errors";

const voice = VoiceSettings.create("vi-VN-Neural2-A", 1.07);
const scene = Scene.create("s1", "Câu tin.", "body");
const make = (over: Partial<Parameters<typeof Narration.create>[0]> = {}) =>
  Narration.create({
    sceneId: "s1",
    text: "Câu tin.",
    audio: new Uint8Array([1, 2, 3]),
    mimeType: "audio/mpeg",
    durationSec: 2.4,
    voice,
    ...over,
  });

describe("Narration", () => {
  it("tạo được khi dữ liệu hợp lệ", () => {
    expect(make().durationSec).toBe(2.4);
  });

  it("chặn độ dài không dương, audio rỗng, mime sai", () => {
    expect(() => make({ durationSec: 0 })).toThrow(ValidationError);
    expect(() => make({ audio: new Uint8Array() })).toThrow(ValidationError);
    expect(() => make({ mimeType: "text/plain" })).toThrow(ValidationError);
  });

  it("cũ khi đổi chữ, đổi giọng hoặc khác cảnh", () => {
    const n = make();
    expect(n.isStaleFor(scene, voice)).toBe(false);
    expect(n.isStaleFor(scene.withText("Câu khác."), voice)).toBe(true);
    expect(n.isStaleFor(scene, voice.withRate(1.2))).toBe(true);
    expect(n.isStaleFor(Scene.create("s2", "Câu tin.", "body"), voice)).toBe(true);
  });
});
```

`tests/domain/Timeline.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_TIMELINE_CONFIG, Timeline } from "@/domain/Timeline";
import { ValidationError } from "@/domain/errors";

const entries = [
  { sceneId: "a", durationSec: 5.4 },
  { sceneId: "b", durationSec: 6.6 },
  { sceneId: "c", durationSec: 3.9 },
];

describe("Timeline.build", () => {
  it("dùng cấu hình mặc định 0.3 / 0.35 / 0.6", () => {
    expect(DEFAULT_TIMELINE_CONFIG).toEqual({ leadInSec: 0.3, gapSec: 0.35, tailSec: 0.6 });
  });

  it("tính mốc từng cảnh liền nhau", () => {
    const t = Timeline.build(entries);
    expect(t.slots).toEqual([
      { sceneId: "a", index: 0, start: 0, voiceStart: 0.3, voiceEnd: 5.7, end: 6.05 },
      { sceneId: "b", index: 1, start: 6.05, voiceStart: 6.05, voiceEnd: 12.65, end: 13 },
      { sceneId: "c", index: 2, start: 13, voiceStart: 13, voiceEnd: 16.9, end: 17.5 },
    ]);
    expect(t.totalDuration).toBe(17.5);
  });

  it("báo lỗi khi không có cảnh hoặc cảnh chưa có giọng", () => {
    expect(() => Timeline.build([])).toThrow(ValidationError);
    expect(() => Timeline.build([{ sceneId: "a", durationSec: 0 }])).toThrow("Cảnh a chưa có độ dài giọng");
  });
});

describe("Timeline tra cứu", () => {
  const t = Timeline.build(entries);

  it("slotAt trả cảnh đang chiếu", () => {
    expect(t.slotAt(0).sceneId).toBe("a");
    expect(t.slotAt(6.049).sceneId).toBe("a");
    expect(t.slotAt(6.05).sceneId).toBe("b");
    expect(t.slotAt(16.95).sceneId).toBe("c");
  });

  it("slotAt kẹp ngoài biên", () => {
    expect(t.slotAt(-1).sceneId).toBe("a");
    expect(t.slotAt(99).sceneId).toBe("c");
  });

  it("frameCount làm tròn lên", () => {
    expect(t.frameCount(30)).toBe(525);
    expect(Timeline.build([{ sceneId: "x", durationSec: 0.1 }]).frameCount(30)).toBe(30);
  });
});
```

- [ ] **Step 2: Chạy test để thấy lỗi**

Run: `npx vitest run tests/domain/VoiceSettings.test.ts tests/domain/Narration.test.ts tests/domain/Timeline.test.ts`
Expected: FAIL, không tìm thấy module.

- [ ] **Step 3: Viết `src/domain/VoiceSettings.ts`**

```ts
import { ValidationError } from "./errors";

const VOICE_NAME = /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9-]+$/;

export class VoiceSettings {
  static readonly MIN_RATE = 0.8;
  static readonly MAX_RATE = 1.3;
  static readonly DEFAULT_RATE = 1.07;

  private constructor(
    readonly voiceName: string,
    readonly speakingRate: number,
  ) {}

  static create(voiceName: string, speakingRate: number = VoiceSettings.DEFAULT_RATE): VoiceSettings {
    if (!VOICE_NAME.test(voiceName)) throw new ValidationError(`Tên giọng không hợp lệ: ${voiceName}`);
    if (!Number.isFinite(speakingRate)) throw new ValidationError("Tốc độ đọc không hợp lệ");
    const rate = Math.round(speakingRate * 100) / 100;
    if (rate < VoiceSettings.MIN_RATE || rate > VoiceSettings.MAX_RATE) {
      throw new ValidationError(`Tốc độ đọc phải từ ${VoiceSettings.MIN_RATE} đến ${VoiceSettings.MAX_RATE}`);
    }
    return new VoiceSettings(voiceName, rate);
  }

  withRate(rate: number): VoiceSettings {
    return VoiceSettings.create(this.voiceName, rate);
  }

  equals(other: VoiceSettings): boolean {
    return this.voiceName === other.voiceName && this.speakingRate === other.speakingRate;
  }
}
```

- [ ] **Step 4: Viết `src/domain/Narration.ts`**

```ts
import { ValidationError } from "./errors";
import type { Scene } from "./Scene";
import type { VoiceSettings } from "./VoiceSettings";

export interface NarrationProps {
  sceneId: string;
  text: string;
  audio: Uint8Array;
  mimeType: string;
  durationSec: number;
  voice: VoiceSettings;
}

export class Narration {
  private constructor(
    readonly sceneId: string,
    readonly text: string,
    readonly audio: Uint8Array,
    readonly mimeType: string,
    readonly durationSec: number,
    readonly voice: VoiceSettings,
  ) {}

  static create(p: NarrationProps): Narration {
    if (!p.sceneId) throw new ValidationError("Giọng đọc thiếu id cảnh");
    if (p.audio.byteLength === 0) throw new ValidationError("Giọng đọc rỗng");
    if (!p.mimeType.startsWith("audio/")) throw new ValidationError("Định dạng giọng đọc không hợp lệ");
    if (!Number.isFinite(p.durationSec) || p.durationSec <= 0) {
      throw new ValidationError("Độ dài giọng đọc phải lớn hơn 0");
    }
    return new Narration(p.sceneId, p.text, p.audio, p.mimeType, p.durationSec, p.voice);
  }

  isStaleFor(scene: Scene, voice: VoiceSettings): boolean {
    return scene.id !== this.sceneId || scene.text !== this.text || !voice.equals(this.voice);
  }
}
```

- [ ] **Step 5: Viết `src/domain/Timeline.ts`**

```ts
import { ValidationError } from "./errors";

export interface TimelineConfig {
  leadInSec: number;
  gapSec: number;
  tailSec: number;
}

export const DEFAULT_TIMELINE_CONFIG: TimelineConfig = { leadInSec: 0.3, gapSec: 0.35, tailSec: 0.6 };

export interface SceneSlot {
  readonly sceneId: string;
  readonly index: number;
  readonly start: number;
  readonly voiceStart: number;
  readonly voiceEnd: number;
  readonly end: number;
}

const ms = (n: number) => Math.round(n * 1000) / 1000;

export class Timeline {
  private constructor(
    readonly slots: readonly SceneSlot[],
    readonly totalDuration: number,
  ) {}

  static build(
    entries: ReadonlyArray<{ sceneId: string; durationSec: number }>,
    config: TimelineConfig = DEFAULT_TIMELINE_CONFIG,
  ): Timeline {
    if (entries.length === 0) throw new ValidationError("Chưa có cảnh nào để dựng");
    const slots: SceneSlot[] = [];
    let start = 0;
    let voiceStart = config.leadInSec;
    entries.forEach((entry, index) => {
      if (!Number.isFinite(entry.durationSec) || entry.durationSec <= 0) {
        throw new ValidationError(`Cảnh ${entry.sceneId} chưa có độ dài giọng`);
      }
      const voiceEnd = voiceStart + entry.durationSec;
      const isLast = index === entries.length - 1;
      const end = voiceEnd + (isLast ? config.tailSec : config.gapSec);
      slots.push({
        sceneId: entry.sceneId,
        index,
        start: ms(start),
        voiceStart: ms(voiceStart),
        voiceEnd: ms(voiceEnd),
        end: ms(end),
      });
      start = end;
      voiceStart = end;
    });
    return new Timeline(slots, (slots[slots.length - 1] as SceneSlot).end);
  }

  slotAt(t: number): SceneSlot {
    const first = this.slots[0] as SceneSlot;
    const last = this.slots[this.slots.length - 1] as SceneSlot;
    if (t < first.end) return first;
    if (t >= last.start) return last;
    return this.slots.find((s) => t >= s.start && t < s.end) ?? last;
  }

  frameCount(fps: number): number {
    return Math.ceil(this.totalDuration * fps);
  }
}
```

- [ ] **Step 6: Chạy test**

Run: `npx vitest run tests/domain`
Expected: PASS toàn bộ.

- [ ] **Step 7: Commit**

```bash
git add src/domain/VoiceSettings.ts src/domain/Narration.ts src/domain/Timeline.ts tests/domain/VoiceSettings.test.ts tests/domain/Narration.test.ts tests/domain/Timeline.test.ts
git commit -m "feat(domain): cài đặt giọng, giọng đọc từng cảnh, mốc thời gian dựng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Cảnh trám, bảng gán cảnh trám, bộ thương hiệu, nhạc nền

**Files:**
- Create: `src/domain/Footage.ts`, `src/domain/FootageBoard.ts`, `src/domain/BrandKit.ts`, `src/domain/MusicTrack.ts`
- Test: `tests/domain/Footage.test.ts`, `tests/domain/FootageBoard.test.ts`, `tests/domain/BrandKit.test.ts`, `tests/domain/MusicTrack.test.ts`

**Interfaces:**
- Consumes: `ValidationError` (Task 2).
- Produces:
  - `type FootageOrigin = "upload" | "pexels" | "pixabay" | "fake"`
  - `interface FootageSource { origin: FootageOrigin; uri: string; credit?: string; pageUrl?: string }` — `uri` là URL ảnh/video stock hoặc khoá file trong IndexedDB.
  - `interface FootagePlayback { mode: "still" | "clip" | "loop" | "none"; sourceDurationSec?: number }`
  - `abstract class Footage { readonly id: string; abstract readonly kind: "image" | "video" | "fallback"; abstract playbackFor(sceneDurationSec: number): FootagePlayback }`
  - `class ImageFootage extends Footage { readonly source: FootageSource; readonly width: number; readonly height: number; get aspectRatio(): number }`
  - `class VideoFootage extends Footage { readonly source; readonly width; readonly height; readonly durationSec: number }`
  - `class FallbackFootage extends Footage {}`
  - `class FootageBoard { static empty(): FootageBoard; get(sceneId): Footage | undefined; assign(sceneId, footage): FootageBoard; unassign(sceneId): FootageBoard; swap(a, b): FootageBoard; fillInOrder(sceneIds: readonly string[], footages: readonly Footage[]): FootageBoard; unassignedSceneIds(sceneIds: readonly string[]): string[]; resolve(sceneId): Footage }` — `resolve` trả `FallbackFootage` khi chưa gán.
  - `type BrandFieldType = "text" | "color" | "image"`, `interface BrandFieldSpec { key: string; label: string; type: BrandFieldType; required: boolean; defaultValue?: string; maxLength?: number }`
  - `class BrandKit { readonly templateId: string; static create(templateId, specs: readonly BrandFieldSpec[], values: Record<string, string | undefined>): BrandKit; get(key): string | undefined; toJSON(): { templateId: string; values: Record<string, string> } }`
  - `type MusicOrigin = "library" | "upload"`, `class MusicTrack { static MIN_OFFSET_DB = -6; static MAX_OFFSET_DB = 6; static BELOW_VOICE_DB = 15; readonly id; readonly title; readonly origin: MusicOrigin; readonly uri; readonly gainOffsetDb: number; static create(p): MusicTrack; withGainOffset(db): MusicTrack; get levelBelowVoiceDb(): number }`

- [ ] **Step 1: Viết test**

`tests/domain/Footage.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { FallbackFootage, ImageFootage, VideoFootage } from "@/domain/Footage";
import { ValidationError } from "@/domain/errors";

const src = { origin: "pexels" as const, uri: "https://images.pexels.com/1.jpg", credit: "A" };

describe("Footage", () => {
  it("ảnh luôn đứng yên (zoom do phong cách lo)", () => {
    const f = new ImageFootage("f1", src, 1600, 900);
    expect(f.kind).toBe("image");
    expect(f.playbackFor(5)).toEqual({ mode: "still" });
    expect(f.aspectRatio).toBeCloseTo(1.7778, 3);
  });

  it("video dài hơn cảnh thì cắt, ngắn hơn thì lặp", () => {
    const v = new VideoFootage("f2", src, 1920, 1080, 4);
    expect(v.playbackFor(3)).toEqual({ mode: "clip", sourceDurationSec: 4 });
    expect(v.playbackFor(4)).toEqual({ mode: "clip", sourceDurationSec: 4 });
    expect(v.playbackFor(6)).toEqual({ mode: "loop", sourceDurationSec: 4 });
  });

  it("chặn kích thước và độ dài không hợp lệ", () => {
    expect(() => new ImageFootage("f", src, 0, 10)).toThrow(ValidationError);
    expect(() => new VideoFootage("f", src, 10, 10, 0)).toThrow(ValidationError);
    expect(() => new ImageFootage("f", { ...src, uri: "" }, 10, 10)).toThrow(ValidationError);
  });

  it("nền dự phòng không phát gì", () => {
    expect(new FallbackFootage("fb").playbackFor(3)).toEqual({ mode: "none" });
  });
});
```

`tests/domain/FootageBoard.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { FootageBoard } from "@/domain/FootageBoard";
import { FallbackFootage, ImageFootage } from "@/domain/Footage";

const img = (id: string) => new ImageFootage(id, { origin: "upload", uri: `idb:${id}` }, 100, 100);
const order = ["s1", "s2", "s3", "s4"];

describe("FootageBoard", () => {
  it("fillInOrder gán lần lượt vào cảnh còn trống, giữ cảnh đã gán", () => {
    const board = FootageBoard.empty().assign("s2", img("x")).fillInOrder(order, [img("a"), img("b")]);
    expect(board.get("s1")?.id).toBe("a");
    expect(board.get("s2")?.id).toBe("x");
    expect(board.get("s3")?.id).toBe("b");
    expect(board.get("s4")).toBeUndefined();
    expect(board.unassignedSceneIds(order)).toEqual(["s4"]);
  });

  it("một cảnh trám dùng được cho nhiều cảnh", () => {
    const a = img("a");
    const board = FootageBoard.empty().assign("s1", a).assign("s3", a);
    expect(board.get("s1")).toBe(board.get("s3"));
  });

  it("swap hoán đổi hai cảnh, kể cả khi một bên trống", () => {
    const board = FootageBoard.empty().assign("s1", img("a")).swap("s1", "s2");
    expect(board.get("s1")).toBeUndefined();
    expect(board.get("s2")?.id).toBe("a");
  });

  it("bất biến: thao tác trả bảng mới", () => {
    const a = FootageBoard.empty();
    const b = a.assign("s1", img("a"));
    expect(a.get("s1")).toBeUndefined();
    expect(b.unassign("s1").get("s1")).toBeUndefined();
  });

  it("resolve trả nền dự phòng khi chưa gán", () => {
    expect(FootageBoard.empty().resolve("s1")).toBeInstanceOf(FallbackFootage);
  });
});
```

`tests/domain/BrandKit.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { BrandKit, type BrandFieldSpec } from "@/domain/BrandKit";
import { ValidationError } from "@/domain/errors";

const specs: BrandFieldSpec[] = [
  { key: "channelName", label: "Tên kênh", type: "text", required: true, maxLength: 24 },
  { key: "primaryColor", label: "Màu chủ đạo", type: "color", required: true, defaultValue: "#1F9D55" },
  { key: "logo", label: "Logo", type: "image", required: false },
];

describe("BrandKit", () => {
  it("lấy giá trị mặc định khi bỏ trống", () => {
    const kit = BrandKit.create("theanh28", specs, { channelName: " 2NV News " });
    expect(kit.get("channelName")).toBe("2NV News");
    expect(kit.get("primaryColor")).toBe("#1F9D55");
    expect(kit.get("logo")).toBeUndefined();
  });

  it("báo lỗi khi thiếu trường bắt buộc", () => {
    expect(() => BrandKit.create("theanh28", specs, {})).toThrow("Thiếu Tên kênh");
  });

  it("kiểm màu dạng #RRGGBB và độ dài chữ", () => {
    expect(() => BrandKit.create("theanh28", specs, { channelName: "A", primaryColor: "green" })).toThrow(
      ValidationError,
    );
    expect(() => BrandKit.create("theanh28", specs, { channelName: "x".repeat(25) })).toThrow(ValidationError);
  });

  it("bỏ qua khoá không khai báo, toJSON chỉ chứa giá trị có", () => {
    const kit = BrandKit.create("theanh28", specs, { channelName: "A", hacker: "x" });
    expect(kit.toJSON()).toEqual({ templateId: "theanh28", values: { channelName: "A", primaryColor: "#1F9D55" } });
  });
});
```

`tests/domain/MusicTrack.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { MusicTrack } from "@/domain/MusicTrack";
import { ValidationError } from "@/domain/errors";

const make = (gainOffsetDb?: number) =>
  MusicTrack.create({ id: "m1", title: "Bản tin 1", origin: "library", uri: "/music/ban-tin-1.mp3", gainOffsetDb });

describe("MusicTrack", () => {
  it("mặc định thấp hơn giọng 15 dB", () => {
    expect(make().levelBelowVoiceDb).toBe(15);
  });

  it("chỉnh ±6 dB: tăng nhạc thì khoảng cách nhỏ lại", () => {
    expect(make(4).levelBelowVoiceDb).toBe(11);
    expect(make().withGainOffset(-6).levelBelowVoiceDb).toBe(21);
  });

  it("chặn chỉnh ngoài ±6 dB và thiếu nguồn", () => {
    expect(() => make(7)).toThrow(ValidationError);
    expect(() => MusicTrack.create({ id: "m", title: "x", origin: "upload", uri: "" })).toThrow(ValidationError);
  });
});
```

- [ ] **Step 2: Chạy test để thấy lỗi**

Run: `npx vitest run tests/domain`
Expected: FAIL ở 4 file mới, không tìm thấy module.

- [ ] **Step 3: Viết `src/domain/Footage.ts`**

```ts
import { ValidationError } from "./errors";

export type FootageOrigin = "upload" | "pexels" | "pixabay" | "fake";

export interface FootageSource {
  origin: FootageOrigin;
  uri: string;
  credit?: string;
  pageUrl?: string;
}

export interface FootagePlayback {
  mode: "still" | "clip" | "loop" | "none";
  sourceDurationSec?: number;
}

export abstract class Footage {
  abstract readonly kind: "image" | "video" | "fallback";

  constructor(readonly id: string) {
    if (!id) throw new ValidationError("Cảnh trám thiếu id");
  }

  abstract playbackFor(sceneDurationSec: number): FootagePlayback;
}

function assertSource(source: FootageSource, width: number, height: number): void {
  if (!source.uri) throw new ValidationError("Cảnh trám thiếu nguồn");
  if (!(width > 0) || !(height > 0)) throw new ValidationError("Kích thước cảnh trám không hợp lệ");
}

export class ImageFootage extends Footage {
  readonly kind = "image" as const;

  constructor(
    id: string,
    readonly source: FootageSource,
    readonly width: number,
    readonly height: number,
  ) {
    super(id);
    assertSource(source, width, height);
  }

  get aspectRatio(): number {
    return this.width / this.height;
  }

  playbackFor(): FootagePlayback {
    return { mode: "still" };
  }
}

export class VideoFootage extends Footage {
  readonly kind = "video" as const;

  constructor(
    id: string,
    readonly source: FootageSource,
    readonly width: number,
    readonly height: number,
    readonly durationSec: number,
  ) {
    super(id);
    assertSource(source, width, height);
    if (!(durationSec > 0)) throw new ValidationError("Độ dài video cảnh trám không hợp lệ");
  }

  playbackFor(sceneDurationSec: number): FootagePlayback {
    const mode = sceneDurationSec <= this.durationSec ? "clip" : "loop";
    return { mode, sourceDurationSec: this.durationSec };
  }
}

export class FallbackFootage extends Footage {
  readonly kind = "fallback" as const;

  playbackFor(): FootagePlayback {
    return { mode: "none" };
  }
}
```

- [ ] **Step 4: Viết `src/domain/FootageBoard.ts`**

```ts
import { FallbackFootage, type Footage } from "./Footage";

export class FootageBoard {
  private constructor(private readonly bySceneId: ReadonlyMap<string, Footage>) {}

  static empty(): FootageBoard {
    return new FootageBoard(new Map());
  }

  get(sceneId: string): Footage | undefined {
    return this.bySceneId.get(sceneId);
  }

  resolve(sceneId: string): Footage {
    return this.get(sceneId) ?? new FallbackFootage(`fallback-${sceneId}`);
  }

  assign(sceneId: string, footage: Footage): FootageBoard {
    const next = new Map(this.bySceneId);
    next.set(sceneId, footage);
    return new FootageBoard(next);
  }

  unassign(sceneId: string): FootageBoard {
    const next = new Map(this.bySceneId);
    next.delete(sceneId);
    return new FootageBoard(next);
  }

  swap(a: string, b: string): FootageBoard {
    const next = new Map(this.bySceneId);
    const fa = this.get(a);
    const fb = this.get(b);
    if (fb) next.set(a, fb);
    else next.delete(a);
    if (fa) next.set(b, fa);
    else next.delete(b);
    return new FootageBoard(next);
  }

  fillInOrder(sceneIds: readonly string[], footages: readonly Footage[]): FootageBoard {
    const next = new Map(this.bySceneId);
    const queue = [...footages];
    for (const sceneId of sceneIds) {
      if (next.has(sceneId)) continue;
      const footage = queue.shift();
      if (!footage) break;
      next.set(sceneId, footage);
    }
    return new FootageBoard(next);
  }

  unassignedSceneIds(sceneIds: readonly string[]): string[] {
    return sceneIds.filter((id) => !this.bySceneId.has(id));
  }
}
```

- [ ] **Step 5: Viết `src/domain/BrandKit.ts`**

```ts
import { ValidationError } from "./errors";

export type BrandFieldType = "text" | "color" | "image";

export interface BrandFieldSpec {
  key: string;
  label: string;
  type: BrandFieldType;
  required: boolean;
  defaultValue?: string;
  maxLength?: number;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class BrandKit {
  private constructor(
    readonly templateId: string,
    private readonly values: Readonly<Record<string, string>>,
  ) {}

  static create(
    templateId: string,
    specs: readonly BrandFieldSpec[],
    values: Record<string, string | undefined>,
  ): BrandKit {
    if (!templateId) throw new ValidationError("Bộ thương hiệu thiếu phong cách");
    const clean: Record<string, string> = {};
    for (const spec of specs) {
      const value = values[spec.key]?.trim() || spec.defaultValue;
      if (!value) {
        if (spec.required) throw new ValidationError(`Thiếu ${spec.label}`);
        continue;
      }
      if (spec.type === "color" && !HEX_COLOR.test(value)) {
        throw new ValidationError(`${spec.label} phải có dạng #RRGGBB`);
      }
      if (spec.maxLength !== undefined && value.length > spec.maxLength) {
        throw new ValidationError(`${spec.label} tối đa ${spec.maxLength} ký tự`);
      }
      clean[spec.key] = value;
    }
    return new BrandKit(templateId, clean);
  }

  get(key: string): string | undefined {
    return this.values[key];
  }

  toJSON(): { templateId: string; values: Record<string, string> } {
    return { templateId: this.templateId, values: { ...this.values } };
  }
}
```

- [ ] **Step 6: Viết `src/domain/MusicTrack.ts`**

```ts
import { ValidationError } from "./errors";

export type MusicOrigin = "library" | "upload";

export interface MusicTrackProps {
  id: string;
  title: string;
  origin: MusicOrigin;
  uri: string;
  gainOffsetDb?: number;
}

export class MusicTrack {
  static readonly MIN_OFFSET_DB = -6;
  static readonly MAX_OFFSET_DB = 6;
  static readonly BELOW_VOICE_DB = 15;

  private constructor(
    readonly id: string,
    readonly title: string,
    readonly origin: MusicOrigin,
    readonly uri: string,
    readonly gainOffsetDb: number,
  ) {}

  static create(p: MusicTrackProps): MusicTrack {
    if (!p.id || !p.uri) throw new ValidationError("Bản nhạc thiếu nguồn");
    const offset = p.gainOffsetDb ?? 0;
    if (!Number.isFinite(offset) || offset < MusicTrack.MIN_OFFSET_DB || offset > MusicTrack.MAX_OFFSET_DB) {
      throw new ValidationError("Chỉnh âm lượng nhạc chỉ trong khoảng ±6 dB");
    }
    return new MusicTrack(p.id, p.title.trim() || p.id, p.origin, p.uri, offset);
  }

  withGainOffset(db: number): MusicTrack {
    return MusicTrack.create({ id: this.id, title: this.title, origin: this.origin, uri: this.uri, gainOffsetDb: db });
  }

  get levelBelowVoiceDb(): number {
    return MusicTrack.BELOW_VOICE_DB - this.gainOffsetDb;
  }
}
```

- [ ] **Step 7: Chạy test + kiểm domain không import ngoài**

Run: `npx vitest run tests/domain`
Expected: PASS toàn bộ.

Run: `grep -rnE "from \"(react|next|@/server|@/client|@/views)" src/domain || echo SACH`
Expected: `SACH`.

- [ ] **Step 8: Commit**

```bash
git add src/domain/Footage.ts src/domain/FootageBoard.ts src/domain/BrandKit.ts src/domain/MusicTrack.ts tests/domain/Footage.test.ts tests/domain/FootageBoard.test.ts tests/domain/BrandKit.test.ts tests/domain/MusicTrack.test.ts
git commit -m "feat(domain): cảnh trám, bảng gán cảnh trám, bộ thương hiệu, nhạc nền

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Danh bạ tài khoản, băm mật khẩu, script tạo tài khoản

**Files:**
- Create: `src/server/auth/UserDirectory.ts`, `src/server/auth/PasswordHasher.ts`, `scripts/users.ts`
- Test: `tests/server/auth/UserDirectory.test.ts`, `tests/server/auth/PasswordHasher.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `interface AppUser { username: string; passwordHash: string; displayName: string }`
  - `class UserDirectory { static MAX_USERS = 5; static fromEnv(raw: string | undefined): UserDirectory; find(username: string): AppUser | undefined; get size(): number }` — lỗi cấu hình ném `Error` thường (lỗi máy chủ, không phải lỗi người dùng).
  - `interface PasswordHasher { hash(password: string): Promise<string>; verify(password: string, hash: string): Promise<boolean> }`, `class BcryptPasswordHasher implements PasswordHasher { constructor(rounds?: number) }`
  - Lệnh `npm run user:entry -- <username> "<Tên hiển thị>" <mật khẩu>` in 1 dòng JSON; `npm run user:encode -- users.local.json` in chuỗi base64 cho `APP_USERS`.

- [ ] **Step 1: Viết test**

`tests/server/auth/PasswordHasher.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { BcryptPasswordHasher } from "@/server/auth/PasswordHasher";

describe("BcryptPasswordHasher", () => {
  it("băm rồi kiểm đúng mật khẩu", async () => {
    const hasher = new BcryptPasswordHasher(4);
    const hash = await hasher.hash("matkhau-dai-123");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await hasher.verify("matkhau-dai-123", hash)).toBe(true);
    expect(await hasher.verify("sai", hash)).toBe(false);
  });
});
```

`tests/server/auth/UserDirectory.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { UserDirectory } from "@/server/auth/UserDirectory";

const HASH = "$2b$04$abcdefghijklmnopqrstuuJ0123456789abcdefghijklmnopqrstu";
const user = (username: string) => ({ username, passwordHash: HASH, displayName: `Tên ${username}` });
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8").toString("base64");

describe("UserDirectory.fromEnv", () => {
  it("đọc base64 của JSON", () => {
    const dir = UserDirectory.fromEnv(b64([user("hai"), user("lan")]));
    expect(dir.size).toBe(2);
    expect(dir.find("hai")?.displayName).toBe("Tên hai");
  });

  it("đọc JSON thô bắt đầu bằng [", () => {
    expect(UserDirectory.fromEnv(JSON.stringify([user("hai")])).size).toBe(1);
  });

  it("tìm không phân biệt hoa thường và khoảng trắng", () => {
    expect(UserDirectory.fromEnv(b64([user("hai")])).find("  HAI ")?.username).toBe("hai");
  });

  it("chặn quá 5 tài khoản", () => {
    const six = ["a1a", "b2b", "c3c", "d4d", "e5e", "f6f"].map(user);
    expect(() => UserDirectory.fromEnv(b64(six))).toThrow("APP_USERS tối đa 5 tài khoản");
  });

  it("chặn trùng tên đăng nhập", () => {
    expect(() => UserDirectory.fromEnv(b64([user("hai"), user("hai")]))).toThrow("APP_USERS bị trùng tài khoản hai");
  });

  it("báo lỗi rõ khi thiếu hoặc sai định dạng", () => {
    expect(() => UserDirectory.fromEnv(undefined)).toThrow("APP_USERS chưa được cấu hình");
    expect(() => UserDirectory.fromEnv("không-phải-base64-json")).toThrow("APP_USERS không đọc được");
    expect(() => UserDirectory.fromEnv(b64([{ username: "hai" }]))).toThrow("APP_USERS sai định dạng");
  });
});
```

- [ ] **Step 2: Chạy test để thấy lỗi**

Run: `npx vitest run tests/server/auth`
Expected: FAIL, không tìm thấy module.

- [ ] **Step 3: Viết `src/server/auth/PasswordHasher.ts`**

```ts
import bcrypt from "bcryptjs";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds = 10) {}

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
```

- [ ] **Step 4: Viết `src/server/auth/UserDirectory.ts`**

```ts
import { z } from "zod";

export interface AppUser {
  username: string;
  passwordHash: string;
  displayName: string;
}

const UserSchema = z.object({
  username: z.string().regex(/^[a-z0-9._-]{3,32}$/),
  passwordHash: z.string().startsWith("$2"),
  displayName: z.string().trim().min(1).max(60),
});

const normalize = (username: string) => username.trim().toLowerCase();

export class UserDirectory {
  static readonly MAX_USERS = 5;

  private readonly byName: ReadonlyMap<string, AppUser>;

  private constructor(users: readonly AppUser[]) {
    this.byName = new Map(users.map((u) => [u.username, u]));
  }

  static fromEnv(raw: string | undefined): UserDirectory {
    const value = raw?.trim();
    if (!value) throw new Error("APP_USERS chưa được cấu hình");

    let parsed: unknown;
    try {
      const json = value.startsWith("[") ? value : Buffer.from(value, "base64").toString("utf8");
      parsed = JSON.parse(json);
    } catch {
      throw new Error("APP_USERS không đọc được (cần base64 của JSON hoặc JSON bắt đầu bằng [)");
    }

    const result = z.array(UserSchema).min(1).safeParse(parsed);
    if (!result.success) throw new Error("APP_USERS sai định dạng (cần username, passwordHash, displayName)");
    if (result.data.length > UserDirectory.MAX_USERS) {
      throw new Error(`APP_USERS tối đa ${UserDirectory.MAX_USERS} tài khoản`);
    }

    const seen = new Set<string>();
    for (const u of result.data) {
      if (seen.has(u.username)) throw new Error(`APP_USERS bị trùng tài khoản ${u.username}`);
      seen.add(u.username);
    }
    return new UserDirectory(result.data);
  }

  find(username: string): AppUser | undefined {
    return this.byName.get(normalize(username));
  }

  get size(): number {
    return this.byName.size;
  }
}
```

- [ ] **Step 5: Viết `scripts/users.ts`**

```ts
import { readFileSync } from "node:fs";
import { BcryptPasswordHasher } from "../src/server/auth/PasswordHasher";
import { UserDirectory } from "../src/server/auth/UserDirectory";

const USAGE = [
  "Cách dùng:",
  '  npm run user:entry -- <tên-đăng-nhập> "<Tên hiển thị>" <mật khẩu ≥ 8 ký tự>',
  "  npm run user:encode -- users.local.json",
].join("\n");

async function entry(args: string[]): Promise<void> {
  const [username, displayName, password] = args;
  if (!username || !displayName || !password || password.length < 8) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  const passwordHash = await new BcryptPasswordHasher().hash(password);
  console.log(JSON.stringify({ username: username.trim().toLowerCase(), passwordHash, displayName: displayName.trim() }));
}

function encode(args: string[]): void {
  const [file] = args;
  if (!file) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  const json = JSON.stringify(JSON.parse(readFileSync(file, "utf8")));
  UserDirectory.fromEnv(json);
  console.log(Buffer.from(json, "utf8").toString("base64"));
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === "entry") return entry(args);
  if (command === "encode") return encode(args);
  console.error(USAGE);
  process.exitCode = 1;
}

void main();
```

- [ ] **Step 6: Chạy test và thử script**

Run: `npx vitest run tests/server/auth`
Expected: PASS (7 test).

Run: `npm run user:entry -- hai "Hải" matkhau-thu-123`
Expected: in 1 dòng `{"username":"hai","passwordHash":"$2b$10$...","displayName":"Hải"}`.

- [ ] **Step 7: Commit**

```bash
git add src/server/auth/UserDirectory.ts src/server/auth/PasswordHasher.ts scripts/users.ts tests/server/auth/UserDirectory.test.ts tests/server/auth/PasswordHasher.test.ts
git commit -m "feat(auth): danh bạ tối đa 5 tài khoản, băm bcrypt, script tạo tài khoản

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Phiên đăng nhập, API đăng nhập / đăng xuất, proxy chặn truy cập

**Files:**
- Create: `src/server/auth/SessionService.ts`, `src/server/auth/AuthController.ts`, `src/server/http/cookies.ts`, `src/server/http/errorResponse.ts`, `src/server/http/withAuth.ts`, `src/server/http/authRoutes.ts`, `src/server/container.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/proxy.ts`
- Test: `tests/server/auth/SessionService.test.ts`, `tests/server/auth/AuthController.test.ts`, `tests/server/http/authRoutes.test.ts`, `tests/server/http/withAuth.test.ts`, `tests/server/helpers.ts`

**Interfaces:**
- Consumes: `UserDirectory`, `AppUser`, `PasswordHasher`, `BcryptPasswordHasher` (Task 6), `ValidationError`, `AuthError`, `DomainError`, `ErrorCode` (Task 2).
- Produces:
  - `interface SessionUser { username: string; displayName: string }`
  - `class SessionService { static COOKIE = "tvs_session"; readonly ttlSeconds: number; constructor(secret: string, ttlSeconds?: number, now?: () => number); issue(user: SessionUser): Promise<string>; verify(token: string | undefined): Promise<SessionUser | null> }`
  - `class AuthController { constructor(users: UserDirectory, hasher: PasswordHasher, sessions: SessionService); login(input: unknown): Promise<{ token: string; user: SessionUser }>; authenticate(token: string | undefined): Promise<SessionUser> }`
  - `readCookie(request: Request, name: string): string | undefined`, `sessionCookie(name: string, token: string, maxAgeSec: number, secure: boolean): string`, `clearedSessionCookie(name: string, secure: boolean): string`
  - `toErrorResponse(error: unknown): Response` — body `{ error: { code, message } }`
  - `withAuth(getAuth: () => AuthController, handler: (request: Request, user: SessionUser) => Promise<Response>): (request: Request) => Promise<Response>`
  - `makeLoginPost(getDeps: () => AuthRouteDeps)`, `makeLogoutPost(getDeps: () => AuthRouteDeps)` với `interface AuthRouteDeps { auth: AuthController; sessions: SessionService; secureCookies: boolean }`
  - `interface ServerContainer { users: UserDirectory; sessions: SessionService; auth: AuthController; secureCookies: boolean }`, `buildServerContainer(env: Record<string, string | undefined>): ServerContainer`, `serverContainer(): ServerContainer`
  - `tests/server/helpers.ts`: `TEST_SECRET`, `makeTestAuth(): Promise<{ auth: AuthController; sessions: SessionService; users: UserDirectory; cookieFor(username: string): Promise<string> }>` — tài khoản `hai` / mật khẩu `matkhau-thu-123`.

- [ ] **Step 1: Viết helper test**

`tests/server/helpers.ts`:
```ts
import { AuthController } from "@/server/auth/AuthController";
import { BcryptPasswordHasher } from "@/server/auth/PasswordHasher";
import { SessionService } from "@/server/auth/SessionService";
import { UserDirectory } from "@/server/auth/UserDirectory";

export const TEST_SECRET = "s".repeat(32);
export const TEST_PASSWORD = "matkhau-thu-123";

export async function makeTestAuth() {
  const hasher = new BcryptPasswordHasher(4);
  const passwordHash = await hasher.hash(TEST_PASSWORD);
  const users = UserDirectory.fromEnv(JSON.stringify([{ username: "hai", passwordHash, displayName: "Hải" }]));
  const sessions = new SessionService(TEST_SECRET);
  const auth = new AuthController(users, hasher, sessions);
  const cookieFor = async (username: string) =>
    `${SessionService.COOKIE}=${await sessions.issue({ username, displayName: "Hải" })}`;
  return { auth, sessions, users, cookieFor };
}
```

- [ ] **Step 2: Viết test `SessionService` và `AuthController`**

`tests/server/auth/SessionService.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { SessionService } from "@/server/auth/SessionService";
import { TEST_SECRET } from "../helpers";

describe("SessionService", () => {
  it("cấp rồi đọc lại phiên", async () => {
    const s = new SessionService(TEST_SECRET);
    const token = await s.issue({ username: "hai", displayName: "Hải" });
    expect(await s.verify(token)).toEqual({ username: "hai", displayName: "Hải" });
  });

  it("phiên hết hạn sau ttl", async () => {
    let now = Date.UTC(2026, 9, 15);
    const s = new SessionService(TEST_SECRET, 60, () => now);
    const token = await s.issue({ username: "hai", displayName: "Hải" });
    now += 61_000;
    expect(await s.verify(token)).toBeNull();
  });

  it("token sai chữ ký hoặc rỗng trả null", async () => {
    const other = new SessionService("x".repeat(32));
    const token = await other.issue({ username: "hai", displayName: "Hải" });
    expect(await new SessionService(TEST_SECRET).verify(token)).toBeNull();
    expect(await new SessionService(TEST_SECRET).verify(undefined)).toBeNull();
    expect(await new SessionService(TEST_SECRET).verify("rac")).toBeNull();
  });

  it("chặn secret ngắn", () => {
    expect(() => new SessionService("ngan")).toThrow("AUTH_SECRET phải dài ít nhất 32 ký tự");
  });
});
```

`tests/server/auth/AuthController.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { AuthError, ValidationError } from "@/domain/errors";
import { makeTestAuth, TEST_PASSWORD } from "../helpers";

describe("AuthController", () => {
  it("đăng nhập đúng trả token và người dùng", async () => {
    const { auth } = await makeTestAuth();
    const result = await auth.login({ username: "HAI", password: TEST_PASSWORD });
    expect(result.user).toEqual({ username: "hai", displayName: "Hải" });
    expect(result.token.split(".")).toHaveLength(3);
  });

  it("sai mật khẩu hoặc sai tài khoản ném AuthError", async () => {
    const { auth } = await makeTestAuth();
    await expect(auth.login({ username: "hai", password: "sai" })).rejects.toBeInstanceOf(AuthError);
    await expect(auth.login({ username: "ai-do", password: TEST_PASSWORD })).rejects.toBeInstanceOf(AuthError);
  });

  it("dữ liệu thiếu ném ValidationError", async () => {
    const { auth } = await makeTestAuth();
    await expect(auth.login({ username: "hai" })).rejects.toBeInstanceOf(ValidationError);
    await expect(auth.login(null)).rejects.toBeInstanceOf(ValidationError);
  });

  it("authenticate chấp nhận phiên hợp lệ, từ chối tài khoản đã bị xoá", async () => {
    const { auth, sessions } = await makeTestAuth();
    const token = await sessions.issue({ username: "hai", displayName: "Hải" });
    expect((await auth.authenticate(token)).username).toBe("hai");
    const ghost = await sessions.issue({ username: "da-xoa", displayName: "X" });
    await expect(auth.authenticate(ghost)).rejects.toThrow("Phiên đăng nhập đã hết hạn");
  });
});
```

- [ ] **Step 3: Viết test route và withAuth**

`tests/server/http/authRoutes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { makeLoginPost, makeLogoutPost } from "@/server/http/authRoutes";
import { makeTestAuth, TEST_PASSWORD } from "../helpers";

const post = (body: unknown) =>
  new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/auth/login", () => {
  it("đúng mật khẩu: 200 + cookie HttpOnly", async () => {
    const t = await makeTestAuth();
    const res = await makeLoginPost(() => ({ ...t, secureCookies: true }))(post({ username: "hai", password: TEST_PASSWORD }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { username: "hai", displayName: "Hải" } });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^tvs_session=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure$/);
  });

  it("sai mật khẩu: 401, không có cookie", async () => {
    const t = await makeTestAuth();
    const res = await makeLoginPost(() => ({ ...t, secureCookies: false }))(post({ username: "hai", password: "x" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.json()).toEqual({ error: { code: "AUTH", message: "Sai tên đăng nhập hoặc mật khẩu" } });
  });

  it("body không phải JSON: 400", async () => {
    const t = await makeTestAuth();
    const req = new Request("http://localhost/api/auth/login", { method: "POST", body: "rác" });
    expect((await makeLoginPost(() => ({ ...t, secureCookies: false }))(req)).status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  it("xoá cookie", async () => {
    const t = await makeTestAuth();
    const res = await makeLogoutPost(() => ({ ...t, secureCookies: false }))(
      new Request("http://localhost/api/auth/logout", { method: "POST" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBe("tvs_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  });
});
```

`tests/server/http/withAuth.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { withAuth } from "@/server/http/withAuth";
import { QuotaError } from "@/domain/errors";
import { makeTestAuth } from "../helpers";

describe("withAuth", () => {
  it("không có cookie: 401", async () => {
    const { auth } = await makeTestAuth();
    const handler = withAuth(() => auth, async () => new Response("ok"));
    const res = await handler(new Request("http://localhost/api/x"));
    expect(res.status).toBe(401);
  });

  it("có cookie hợp lệ: gọi handler kèm người dùng", async () => {
    const { auth, cookieFor } = await makeTestAuth();
    const handler = withAuth(() => auth, async (_req, user) => Response.json({ who: user.username }));
    const res = await handler(new Request("http://localhost/api/x", { headers: { cookie: `a=1; ${await cookieFor("hai")}` } }));
    expect(await res.json()).toEqual({ who: "hai" });
  });

  it("lỗi nghiệp vụ trong handler được ánh xạ mã HTTP", async () => {
    const { auth, cookieFor } = await makeTestAuth();
    const handler = withAuth(() => auth, async () => {
      throw new QuotaError("Hết hạn mức");
    });
    const res = await handler(new Request("http://localhost/api/x", { headers: { cookie: await cookieFor("hai") } }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: { code: "QUOTA", message: "Hết hạn mức" } });
  });

  it("lỗi lạ: 500 với thông báo chung", async () => {
    const { auth, cookieFor } = await makeTestAuth();
    const handler = withAuth(() => auth, async () => {
      throw new Error("bí mật nội bộ");
    });
    const res = await handler(new Request("http://localhost/api/x", { headers: { cookie: await cookieFor("hai") } }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: { code: "INTERNAL", message: "Lỗi máy chủ" } });
  });
});
```

- [ ] **Step 4: Chạy test để thấy lỗi**

Run: `npx vitest run tests/server`
Expected: FAIL, không tìm thấy các module mới.

- [ ] **Step 5: Viết `src/server/auth/SessionService.ts`**

```ts
import { jwtVerify, SignJWT } from "jose";

export interface SessionUser {
  username: string;
  displayName: string;
}

export class SessionService {
  static readonly COOKIE = "tvs_session";

  private readonly key: Uint8Array;

  constructor(
    secret: string,
    readonly ttlSeconds = 60 * 60 * 24 * 7,
    private readonly now: () => number = () => Date.now(),
  ) {
    if (!secret || secret.length < 32) throw new Error("AUTH_SECRET phải dài ít nhất 32 ký tự");
    this.key = new TextEncoder().encode(secret);
  }

  async issue(user: SessionUser): Promise<string> {
    const iat = Math.floor(this.now() / 1000);
    return new SignJWT({ name: user.displayName })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.username)
      .setIssuedAt(iat)
      .setExpirationTime(iat + this.ttlSeconds)
      .sign(this.key);
  }

  async verify(token: string | undefined): Promise<SessionUser | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ["HS256"],
        currentDate: new Date(this.now()),
      });
      if (typeof payload.sub !== "string" || typeof payload.name !== "string") return null;
      return { username: payload.sub, displayName: payload.name };
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 6: Viết `src/server/auth/AuthController.ts`**

```ts
import { z } from "zod";
import { AuthError, ValidationError } from "@/domain/errors";
import type { PasswordHasher } from "./PasswordHasher";
import type { SessionService, SessionUser } from "./SessionService";
import type { UserDirectory } from "./UserDirectory";

const LoginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

export class AuthController {
  constructor(
    private readonly users: UserDirectory,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
  ) {}

  async login(input: unknown): Promise<{ token: string; user: SessionUser }> {
    const parsed = LoginSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Thiếu tên đăng nhập hoặc mật khẩu");
    const account = this.users.find(parsed.data.username);
    if (!account || !(await this.hasher.verify(parsed.data.password, account.passwordHash))) {
      throw new AuthError();
    }
    const user: SessionUser = { username: account.username, displayName: account.displayName };
    return { token: await this.sessions.issue(user), user };
  }

  async authenticate(token: string | undefined): Promise<SessionUser> {
    const session = await this.sessions.verify(token);
    if (!session || !this.users.find(session.username)) throw new AuthError("Phiên đăng nhập đã hết hạn");
    return session;
  }
}
```

- [ ] **Step 7: Viết các helper HTTP**

`src/server/http/cookies.ts`:
```ts
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function sessionCookie(name: string, token: string, maxAgeSec: number, secure: boolean): string {
  return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? "; Secure" : ""}`;
}

export function clearedSessionCookie(name: string, secure: boolean): string {
  return sessionCookie(name, "", 0, secure);
}
```

`src/server/http/errorResponse.ts`:
```ts
import { DomainError, type ErrorCode } from "@/domain/errors";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  AUTH: 401,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  QUOTA: 429,
  UPSTREAM: 502,
};

export function toErrorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: STATUS[error.code] });
  }
  console.error(error);
  return Response.json({ error: { code: "INTERNAL", message: "Lỗi máy chủ" } }, { status: 500 });
}
```

`src/server/http/withAuth.ts`:
```ts
import type { AuthController } from "@/server/auth/AuthController";
import { SessionService, type SessionUser } from "@/server/auth/SessionService";
import { readCookie } from "./cookies";
import { toErrorResponse } from "./errorResponse";

export function withAuth(
  getAuth: () => AuthController,
  handler: (request: Request, user: SessionUser) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const user = await getAuth().authenticate(readCookie(request, SessionService.COOKIE));
      return await handler(request, user);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
```

`src/server/http/authRoutes.ts`:
```ts
import { ValidationError } from "@/domain/errors";
import type { AuthController } from "@/server/auth/AuthController";
import { SessionService } from "@/server/auth/SessionService";
import { clearedSessionCookie, sessionCookie } from "./cookies";
import { toErrorResponse } from "./errorResponse";

export interface AuthRouteDeps {
  auth: AuthController;
  sessions: SessionService;
  secureCookies: boolean;
}

export function makeLoginPost(getDeps: () => AuthRouteDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const deps = getDeps();
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Dữ liệu đăng nhập không hợp lệ");
      });
      const { token, user } = await deps.auth.login(body);
      const response = Response.json({ user });
      response.headers.append(
        "Set-Cookie",
        sessionCookie(SessionService.COOKIE, token, deps.sessions.ttlSeconds, deps.secureCookies),
      );
      return response;
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function makeLogoutPost(getDeps: () => AuthRouteDeps): (request: Request) => Promise<Response> {
  return async () => {
    const response = Response.json({ ok: true });
    response.headers.append("Set-Cookie", clearedSessionCookie(SessionService.COOKIE, getDeps().secureCookies));
    return response;
  };
}
```

- [ ] **Step 8: Viết container, route, proxy**

`src/server/container.ts`:
```ts
import { AuthController } from "./auth/AuthController";
import { BcryptPasswordHasher } from "./auth/PasswordHasher";
import { SessionService } from "./auth/SessionService";
import { UserDirectory } from "./auth/UserDirectory";

export interface ServerContainer {
  users: UserDirectory;
  sessions: SessionService;
  auth: AuthController;
  secureCookies: boolean;
}

export function buildServerContainer(env: Record<string, string | undefined>): ServerContainer {
  const users = UserDirectory.fromEnv(env.APP_USERS);
  const sessions = new SessionService(env.AUTH_SECRET ?? "");
  const auth = new AuthController(users, new BcryptPasswordHasher(), sessions);
  return { users, sessions, auth, secureCookies: env.NODE_ENV === "production" };
}

let cached: ServerContainer | undefined;

export function serverContainer(): ServerContainer {
  cached ??= buildServerContainer(process.env);
  return cached;
}
```

`src/app/api/auth/login/route.ts`:
```ts
import { serverContainer } from "@/server/container";
import { makeLoginPost } from "@/server/http/authRoutes";

export const POST = makeLoginPost(() => serverContainer());
```

`src/app/api/auth/logout/route.ts`:
```ts
import { serverContainer } from "@/server/container";
import { makeLogoutPost } from "@/server/http/authRoutes";

export const POST = makeLogoutPost(() => serverContainer());
```

`src/proxy.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { SessionService } from "@/server/auth/SessionService";

const PUBLIC_PATHS = new Set(["/dang-nhap", "/api/auth/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const sessions = new SessionService(process.env.AUTH_SECRET ?? "");
  const user = await sessions.verify(request.cookies.get(SessionService.COOKIE)?.value);
  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { code: "AUTH", message: "Chưa đăng nhập" } }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/dang-nhap";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

> Next.js 16 đổi tên `middleware.ts` thành `proxy.ts` (hàm export tên `proxy`). Khi build, bảng route phải có dòng `ƒ Proxy (Middleware)`. Nếu không có, đọc `node_modules/next/dist/docs` hoặc thông báo của `next build` để sửa tên file/hàm cho đúng bản đang cài, không tự chuyển về `middleware.ts` khi chưa kiểm.

- [ ] **Step 9: Chạy test, typecheck, build**

Run: `npx vitest run`
Expected: PASS toàn bộ.

Run: `npm run typecheck`
Expected: không lỗi.

Run: `npm run build`
Expected: build thành công, bảng route có `/api/auth/login`, `/api/auth/logout` và dòng Proxy.

- [ ] **Step 10: Commit**

```bash
git add src/server/auth/SessionService.ts src/server/auth/AuthController.ts src/server/http src/server/container.ts src/app/api/auth src/proxy.ts tests/server
git commit -m "feat(auth): phiên JWT cookie, API đăng nhập/đăng xuất, proxy chặn truy cập

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Giọng đọc — Google TTS, bản giả lập, API

**Files:**
- Create: `src/server/http/upstream.ts`, `src/server/tts/TtsProvider.ts`, `src/server/tts/GoogleTtsService.ts`, `src/server/tts/FakeTtsProvider.ts`, `src/server/tts/TtsController.ts`, `src/server/http/ttsRoutes.ts`, `src/app/api/tts/route.ts`, `src/app/api/tts/voices/route.ts`
- Modify: `src/server/container.ts` (thay toàn bộ nội dung)
- Test: `tests/server/http/upstream.test.ts`, `tests/server/tts/GoogleTtsService.test.ts`, `tests/server/tts/FakeTtsProvider.test.ts`, `tests/server/tts/TtsController.test.ts`, `tests/server/http/ttsRoutes.test.ts`, `tests/server/container.test.ts`

**Interfaces:**
- Consumes: `VoiceSettings.MIN_RATE` / `MAX_RATE` (Task 4), `ValidationError`, `PayloadTooLargeError`, `QuotaError`, `UpstreamError` (Task 2), `withAuth`, `AuthController` (Task 7), `makeTestAuth` (Task 7 helper), `ServerContainer` (Task 7).
- Produces:
  - `fetchJson<T>(fetchImpl: typeof fetch, url: string, init: RequestInit, labels: { service: string; quotaMessage: string }): Promise<T>`
  - `type VoiceGender = "MALE" | "FEMALE" | "NEUTRAL"`, `interface TtsVoice { name: string; gender: VoiceGender; tier: string }`, `interface SynthesisRequest { text: string; voiceName: string; speakingRate: number }`, `interface SynthesisResult { audio: Uint8Array<ArrayBuffer>; mimeType: string }`, `interface TtsProvider { listVoices(languageCode: string): Promise<TtsVoice[]>; synthesize(req: SynthesisRequest): Promise<SynthesisResult> }`
  - `class GoogleTtsService implements TtsProvider { constructor(apiKey: string, fetchImpl?: typeof fetch) }`, `tierOf(voiceName: string): string`
  - `class FakeTtsProvider implements TtsProvider`, `makeToneWav(seconds: number, frequency: number, sampleRate?: number): Uint8Array<ArrayBuffer>`
  - `class TtsController { static MAX_CHARS = 5000; static LANGUAGE = "vi-VN"; constructor(provider: TtsProvider, now?: () => number); voices(): Promise<TtsVoice[]>; synthesize(input: unknown): Promise<SynthesisResult> }`
  - `makeVoicesGet(getDeps: () => TtsRouteDeps)`, `makeTtsPost(getDeps: () => TtsRouteDeps)` với `interface TtsRouteDeps { auth: AuthController; tts: TtsController }`
  - `ServerContainer` thêm `tts: TtsController` và `usingFakes: boolean`. Biến `FAKE_PROVIDERS=1` bật bản giả lập; cấm bật khi `VERCEL_ENV=production`.

- [ ] **Step 1: Viết test `fetchJson`**

`tests/server/http/upstream.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { fetchJson } from "@/server/http/upstream";
import { QuotaError, UpstreamError } from "@/domain/errors";

const labels = { service: "Dịch vụ X", quotaMessage: "Hết lượt" };

describe("fetchJson", () => {
  it("trả JSON khi 200", async () => {
    const f = vi.fn(async () => Response.json({ a: 1 }));
    expect(await fetchJson(f as unknown as typeof fetch, "https://x", {}, labels)).toEqual({ a: 1 });
  });

  it("429 hoặc RESOURCE_EXHAUSTED thành QuotaError", async () => {
    const f429 = async () => new Response("", { status: 429 });
    await expect(fetchJson(f429 as typeof fetch, "https://x", {}, labels)).rejects.toThrow(QuotaError);
    const fExhausted = async () => new Response('{"status":"RESOURCE_EXHAUSTED"}', { status: 403 });
    await expect(fetchJson(fExhausted as typeof fetch, "https://x", {}, labels)).rejects.toThrow("Hết lượt");
  });

  it("lỗi khác và lỗi mạng thành UpstreamError", async () => {
    const f500 = async () => new Response("x", { status: 500 });
    await expect(fetchJson(f500 as typeof fetch, "https://x", {}, labels)).rejects.toThrow("Dịch vụ X lỗi 500");
    const fNet = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(fetchJson(fNet as typeof fetch, "https://x", {}, labels)).rejects.toBeInstanceOf(UpstreamError);
  });
});
```

- [ ] **Step 2: Viết test Google TTS và bản giả lập**

`tests/server/tts/GoogleTtsService.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { GoogleTtsService, tierOf } from "@/server/tts/GoogleTtsService";
import { UpstreamError } from "@/domain/errors";

describe("tierOf", () => {
  it("lấy hạng giọng từ tên", () => {
    expect(tierOf("vi-VN-Standard-A")).toBe("Standard");
    expect(tierOf("vi-VN-Wavenet-D")).toBe("Wavenet");
    expect(tierOf("vi-VN-Neural2-A")).toBe("Neural2");
    expect(tierOf("vi-VN-Chirp3-HD-Achernar")).toBe("Chirp3-HD");
    expect(tierOf("vi-VN-A")).toBe("Standard");
  });
});

describe("GoogleTtsService", () => {
  it("listVoices lọc đúng ngôn ngữ, sắp hạng tốt lên trước", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        voices: [
          { name: "vi-VN-Standard-A", ssmlGender: "FEMALE", languageCodes: ["vi-VN"] },
          { name: "en-US-Neural2-A", ssmlGender: "MALE", languageCodes: ["en-US"] },
          { name: "vi-VN-Chirp3-HD-Achernar", ssmlGender: "FEMALE", languageCodes: ["vi-VN"] },
          { name: "vi-VN-Neural2-D", ssmlGender: "MALE", languageCodes: ["vi-VN"] },
        ],
      }),
    );
    const svc = new GoogleTtsService("KEY", fetchImpl as unknown as typeof fetch);
    expect(await svc.listVoices("vi-VN")).toEqual([
      { name: "vi-VN-Chirp3-HD-Achernar", gender: "FEMALE", tier: "Chirp3-HD" },
      { name: "vi-VN-Neural2-D", gender: "MALE", tier: "Neural2" },
      { name: "vi-VN-Standard-A", gender: "FEMALE", tier: "Standard" },
    ]);
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://texttospeech.googleapis.com/v1/voices?languageCode=vi-VN&key=KEY");
  });

  it("synthesize gửi đúng body và giải base64", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ audioContent: Buffer.from([7, 8, 9]).toString("base64") }));
    const svc = new GoogleTtsService("KEY", fetchImpl as unknown as typeof fetch);
    const result = await svc.synthesize({ text: "Xin chào.", voiceName: "vi-VN-Neural2-A", speakingRate: 1.07 });
    expect(Array.from(result.audio)).toEqual([7, 8, 9]);
    expect(result.mimeType).toBe("audio/mpeg");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://texttospeech.googleapis.com/v1/text:synthesize?key=KEY");
    expect(JSON.parse(init.body as string)).toEqual({
      input: { text: "Xin chào." },
      voice: { languageCode: "vi-VN", name: "vi-VN-Neural2-A" },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.07, sampleRateHertz: 48000 },
    });
  });

  it("thiếu audioContent thì UpstreamError", async () => {
    const svc = new GoogleTtsService("KEY", (async () => Response.json({})) as unknown as typeof fetch);
    await expect(svc.synthesize({ text: "a", voiceName: "vi-VN-Neural2-A", speakingRate: 1 })).rejects.toBeInstanceOf(
      UpstreamError,
    );
  });

  it("thiếu key thì báo lỗi cấu hình", () => {
    expect(() => new GoogleTtsService("")).toThrow("GOOGLE_TTS_API_KEY chưa được cấu hình");
  });
});
```

`tests/server/tts/FakeTtsProvider.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { FakeTtsProvider, makeToneWav } from "@/server/tts/FakeTtsProvider";

describe("makeToneWav", () => {
  it("tạo WAV PCM 16-bit mono đúng độ dài", () => {
    const wav = makeToneWav(1, 220, 8000);
    const view = new DataView(wav.buffer);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe("WAVE");
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint32(40, true)).toBe(16000);
    expect(wav.byteLength).toBe(44 + 16000);
  });
});

describe("FakeTtsProvider", () => {
  it("độ dài giọng tỉ lệ với số ký tự và tốc độ", async () => {
    const p = new FakeTtsProvider();
    const slow = await p.synthesize({ text: "x".repeat(100), voiceName: "vi-VN-Fake-A", speakingRate: 1 });
    const fast = await p.synthesize({ text: "x".repeat(100), voiceName: "vi-VN-Fake-A", speakingRate: 1.3 });
    expect(slow.mimeType).toBe("audio/wav");
    expect(slow.audio.byteLength).toBeGreaterThan(fast.audio.byteLength);
  });

  it("có 2 giọng giả nam / nữ", async () => {
    expect((await new FakeTtsProvider().listVoices()).map((v) => v.gender)).toEqual(["FEMALE", "MALE"]);
  });
});
```

- [ ] **Step 3: Viết test controller, route, container**

`tests/server/tts/TtsController.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { TtsController } from "@/server/tts/TtsController";
import type { TtsProvider } from "@/server/tts/TtsProvider";
import { PayloadTooLargeError, ValidationError } from "@/domain/errors";

function provider(): TtsProvider & { listVoices: ReturnType<typeof vi.fn>; synthesize: ReturnType<typeof vi.fn> } {
  return {
    listVoices: vi.fn(async () => [{ name: "vi-VN-Neural2-A", gender: "FEMALE" as const, tier: "Neural2" }]),
    synthesize: vi.fn(async () => ({ audio: new Uint8Array([1]), mimeType: "audio/mpeg" })),
  };
}

describe("TtsController", () => {
  it("cache danh sách giọng 24 giờ", async () => {
    let now = 0;
    const p = provider();
    const c = new TtsController(p, () => now);
    await c.voices();
    await c.voices();
    expect(p.listVoices).toHaveBeenCalledTimes(1);
    expect(p.listVoices).toHaveBeenCalledWith("vi-VN");
    now = 86_400_001;
    await c.voices();
    expect(p.listVoices).toHaveBeenCalledTimes(2);
  });

  it("cắt khoảng trắng rồi gọi nhà cung cấp", async () => {
    const p = provider();
    await new TtsController(p).synthesize({ text: "  Câu tin.  ", voiceName: "vi-VN-Neural2-A", speakingRate: 1.07 });
    expect(p.synthesize).toHaveBeenCalledWith({ text: "Câu tin.", voiceName: "vi-VN-Neural2-A", speakingRate: 1.07 });
  });

  it("chặn dữ liệu sai, câu rỗng, tốc độ ngoài khoảng", async () => {
    const c = new TtsController(provider());
    await expect(c.synthesize({ text: "a" })).rejects.toBeInstanceOf(ValidationError);
    await expect(c.synthesize({ text: "  ", voiceName: "vi-VN-Neural2-A", speakingRate: 1 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(c.synthesize({ text: "a", voiceName: "vi-VN-Neural2-A", speakingRate: 2 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("chặn quá 5.000 ký tự", async () => {
    const c = new TtsController(provider());
    await expect(
      c.synthesize({ text: "a".repeat(5001), voiceName: "vi-VN-Neural2-A", speakingRate: 1 }),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);
  });
});
```

`tests/server/http/ttsRoutes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { makeTtsPost, makeVoicesGet } from "@/server/http/ttsRoutes";
import { TtsController } from "@/server/tts/TtsController";
import { FakeTtsProvider } from "@/server/tts/FakeTtsProvider";
import { makeTestAuth } from "../helpers";

async function setup() {
  const t = await makeTestAuth();
  const deps = () => ({ auth: t.auth, tts: new TtsController(new FakeTtsProvider()) });
  return { ...t, deps };
}

describe("GET /api/tts/voices", () => {
  it("cần đăng nhập", async () => {
    const { deps } = await setup();
    expect((await makeVoicesGet(deps)(new Request("http://localhost/api/tts/voices"))).status).toBe(401);
  });

  it("trả danh sách giọng", async () => {
    const { deps, cookieFor } = await setup();
    const res = await makeVoicesGet(deps)(
      new Request("http://localhost/api/tts/voices", { headers: { cookie: await cookieFor("hai") } }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).voices).toHaveLength(2);
  });
});

describe("POST /api/tts", () => {
  it("trả âm thanh nhị phân đúng content-type", async () => {
    const { deps, cookieFor } = await setup();
    const res = await makeTtsPost(deps)(
      new Request("http://localhost/api/tts", {
        method: "POST",
        headers: { cookie: await cookieFor("hai"), "content-type": "application/json" },
        body: JSON.stringify({ text: "Xin chào.", voiceName: "vi-VN-Fake-A", speakingRate: 1 }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(44);
  });

  it("text quá dài: 413", async () => {
    const { deps, cookieFor } = await setup();
    const res = await makeTtsPost(deps)(
      new Request("http://localhost/api/tts", {
        method: "POST",
        headers: { cookie: await cookieFor("hai") },
        body: JSON.stringify({ text: "a".repeat(5001), voiceName: "vi-VN-Fake-A", speakingRate: 1 }),
      }),
    );
    expect(res.status).toBe(413);
  });
});
```

`tests/server/container.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildServerContainer } from "@/server/container";

const HASH = "$2b$04$abcdefghijklmnopqrstuuJ0123456789abcdefghijklmnopqrstu";
const base = {
  APP_USERS: JSON.stringify([{ username: "hai", passwordHash: HASH, displayName: "Hải" }]),
  AUTH_SECRET: "s".repeat(32),
};

describe("buildServerContainer", () => {
  it("FAKE_PROVIDERS=1 dùng bản giả lập, không cần key", async () => {
    const c = buildServerContainer({ ...base, FAKE_PROVIDERS: "1" });
    expect(c.usingFakes).toBe(true);
    expect((await c.tts.voices())[0]?.name).toBe("vi-VN-Fake-A");
  });

  it("không bật giả lập thì bắt buộc có key thật", () => {
    expect(() => buildServerContainer(base)).toThrow("GOOGLE_TTS_API_KEY chưa được cấu hình");
  });

  it("cấm giả lập trên production của Vercel", () => {
    expect(() => buildServerContainer({ ...base, FAKE_PROVIDERS: "1", VERCEL_ENV: "production" })).toThrow(
      "FAKE_PROVIDERS không được bật trên production",
    );
  });

  it("cookie Secure khi NODE_ENV=production", () => {
    expect(buildServerContainer({ ...base, FAKE_PROVIDERS: "1", NODE_ENV: "production" }).secureCookies).toBe(true);
  });
});
```

- [ ] **Step 4: Chạy test để thấy lỗi**

Run: `npx vitest run tests/server`
Expected: FAIL ở các file mới (không tìm thấy module), test cũ vẫn PASS.

- [ ] **Step 5: Viết `src/server/http/upstream.ts`**

```ts
import { QuotaError, UpstreamError } from "@/domain/errors";

export interface UpstreamLabels {
  service: string;
  quotaMessage: string;
}

export async function fetchJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  labels: UpstreamLabels,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    throw new UpstreamError(`Không kết nối được ${labels.service}`);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429 || detail.includes("RESOURCE_EXHAUSTED")) throw new QuotaError(labels.quotaMessage);
    console.warn(`[${labels.service}] HTTP ${response.status}: ${detail.slice(0, 300)}`);
    throw new UpstreamError(`${labels.service} lỗi ${response.status}`);
  }
  return (await response.json()) as T;
}
```

- [ ] **Step 6: Viết `src/server/tts/TtsProvider.ts`**

```ts
export type VoiceGender = "MALE" | "FEMALE" | "NEUTRAL";

export interface TtsVoice {
  name: string;
  gender: VoiceGender;
  tier: string;
}

export interface SynthesisRequest {
  text: string;
  voiceName: string;
  speakingRate: number;
}

export interface SynthesisResult {
  audio: Uint8Array<ArrayBuffer>;
  mimeType: string;
}

export interface TtsProvider {
  listVoices(languageCode: string): Promise<TtsVoice[]>;
  synthesize(request: SynthesisRequest): Promise<SynthesisResult>;
}
```

- [ ] **Step 7: Viết `src/server/tts/GoogleTtsService.ts`**

```ts
import { UpstreamError } from "@/domain/errors";
import { fetchJson } from "@/server/http/upstream";
import type { SynthesisRequest, SynthesisResult, TtsProvider, TtsVoice, VoiceGender } from "./TtsProvider";

const BASE = "https://texttospeech.googleapis.com/v1";
const LABELS = { service: "Google TTS", quotaMessage: "Hết hạn mức giọng đọc hôm nay, liên hệ Hải" };
const TIER_ORDER = ["Chirp3-HD", "Neural2", "Wavenet", "Standard"];

interface GoogleVoice {
  name: string;
  ssmlGender?: string;
  languageCodes?: string[];
}

export function tierOf(voiceName: string): string {
  const parts = voiceName.split("-").slice(2, -1);
  return parts.length > 0 ? parts.join("-") : "Standard";
}

function genderOf(raw: string | undefined): VoiceGender {
  return raw === "MALE" || raw === "FEMALE" ? raw : "NEUTRAL";
}

function tierRank(tier: string): number {
  const i = TIER_ORDER.indexOf(tier);
  return i < 0 ? TIER_ORDER.length : i;
}

export class GoogleTtsService implements TtsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("GOOGLE_TTS_API_KEY chưa được cấu hình");
  }

  async listVoices(languageCode: string): Promise<TtsVoice[]> {
    const url = `${BASE}/voices?languageCode=${encodeURIComponent(languageCode)}&key=${encodeURIComponent(this.apiKey)}`;
    const data = await fetchJson<{ voices?: GoogleVoice[] }>(this.fetchImpl, url, { method: "GET" }, LABELS);
    return (data.voices ?? [])
      .filter((v) => v.languageCodes?.includes(languageCode))
      .map((v) => ({ name: v.name, gender: genderOf(v.ssmlGender), tier: tierOf(v.name) }))
      .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name));
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const languageCode = request.voiceName.split("-").slice(0, 2).join("-");
    const body = {
      input: { text: request.text },
      voice: { languageCode, name: request.voiceName },
      audioConfig: { audioEncoding: "MP3", speakingRate: request.speakingRate, sampleRateHertz: 48000 },
    };
    const data = await fetchJson<{ audioContent?: string }>(
      this.fetchImpl,
      `${BASE}/text:synthesize?key=${encodeURIComponent(this.apiKey)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      LABELS,
    );
    if (!data.audioContent) throw new UpstreamError("Google TTS không trả về âm thanh");
    return { audio: Uint8Array.from(Buffer.from(data.audioContent, "base64")), mimeType: "audio/mpeg" };
  }
}
```

- [ ] **Step 8: Viết `src/server/tts/FakeTtsProvider.ts`**

```ts
import type { SynthesisRequest, SynthesisResult, TtsProvider, TtsVoice } from "./TtsProvider";

export function makeToneWav(seconds: number, frequency: number, sampleRate = 24000): Uint8Array<ArrayBuffer> {
  const samples = Math.round(seconds * sampleRate);
  const dataBytes = samples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 20, (seconds - t) * 20);
    view.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * frequency * t) * 6000 * envelope), true);
  }
  return new Uint8Array(buffer);
}

export class FakeTtsProvider implements TtsProvider {
  async listVoices(): Promise<TtsVoice[]> {
    return [
      { name: "vi-VN-Fake-A", gender: "FEMALE", tier: "Fake" },
      { name: "vi-VN-Fake-B", gender: "MALE", tier: "Fake" },
    ];
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const seconds = Math.min(30, Math.max(0.5, request.text.length * 0.065)) / request.speakingRate;
    const frequency = request.voiceName.endsWith("-B") ? 140 : 230;
    return { audio: makeToneWav(seconds, frequency), mimeType: "audio/wav" };
  }
}
```

- [ ] **Step 9: Viết `src/server/tts/TtsController.ts`**

```ts
import { z } from "zod";
import { PayloadTooLargeError, ValidationError } from "@/domain/errors";
import { VoiceSettings } from "@/domain/VoiceSettings";
import type { SynthesisResult, TtsProvider, TtsVoice } from "./TtsProvider";

const SynthesisSchema = z.object({
  text: z.string(),
  voiceName: z.string().regex(/^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9-]+$/),
  speakingRate: z.number().min(VoiceSettings.MIN_RATE).max(VoiceSettings.MAX_RATE),
});

export class TtsController {
  static readonly MAX_CHARS = 5000;
  static readonly LANGUAGE = "vi-VN";
  private static readonly VOICE_CACHE_MS = 86_400_000;

  private voiceCache?: { at: number; voices: TtsVoice[] };

  constructor(
    private readonly provider: TtsProvider,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async voices(): Promise<TtsVoice[]> {
    const cache = this.voiceCache;
    if (cache && this.now() - cache.at < TtsController.VOICE_CACHE_MS) return cache.voices;
    const voices = await this.provider.listVoices(TtsController.LANGUAGE);
    this.voiceCache = { at: this.now(), voices };
    return voices;
  }

  async synthesize(input: unknown): Promise<SynthesisResult> {
    const parsed = SynthesisSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Yêu cầu tạo giọng không hợp lệ");
    const text = parsed.data.text.trim();
    if (!text) throw new ValidationError("Câu cần đọc đang trống");
    if (text.length > TtsController.MAX_CHARS) {
      throw new PayloadTooLargeError(`Mỗi lần tạo giọng tối đa ${TtsController.MAX_CHARS} ký tự`);
    }
    return this.provider.synthesize({ ...parsed.data, text });
  }
}
```

- [ ] **Step 10: Viết route TTS**

`src/server/http/ttsRoutes.ts`:
```ts
import { ValidationError } from "@/domain/errors";
import type { AuthController } from "@/server/auth/AuthController";
import type { TtsController } from "@/server/tts/TtsController";
import { withAuth } from "./withAuth";

export interface TtsRouteDeps {
  auth: AuthController;
  tts: TtsController;
}

export function makeVoicesGet(getDeps: () => TtsRouteDeps): (request: Request) => Promise<Response> {
  return withAuth(
    () => getDeps().auth,
    async () =>
      Response.json({ voices: await getDeps().tts.voices() }, { headers: { "Cache-Control": "private, max-age=3600" } }),
  );
}

export function makeTtsPost(getDeps: () => TtsRouteDeps): (request: Request) => Promise<Response> {
  return withAuth(
    () => getDeps().auth,
    async (request) => {
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Yêu cầu tạo giọng không hợp lệ");
      });
      const result = await getDeps().tts.synthesize(body);
      return new Response(result.audio, {
        headers: { "Content-Type": result.mimeType, "Cache-Control": "no-store" },
      });
    },
  );
}
```

`src/app/api/tts/route.ts`:
```ts
import { serverContainer } from "@/server/container";
import { makeTtsPost } from "@/server/http/ttsRoutes";

export const POST = makeTtsPost(() => serverContainer());
```

`src/app/api/tts/voices/route.ts`:
```ts
import { serverContainer } from "@/server/container";
import { makeVoicesGet } from "@/server/http/ttsRoutes";

export const GET = makeVoicesGet(() => serverContainer());
```

- [ ] **Step 11: Thay toàn bộ `src/server/container.ts`**

```ts
import { AuthController } from "./auth/AuthController";
import { BcryptPasswordHasher } from "./auth/PasswordHasher";
import { SessionService } from "./auth/SessionService";
import { UserDirectory } from "./auth/UserDirectory";
import { FakeTtsProvider } from "./tts/FakeTtsProvider";
import { GoogleTtsService } from "./tts/GoogleTtsService";
import { TtsController } from "./tts/TtsController";

export interface ServerContainer {
  users: UserDirectory;
  sessions: SessionService;
  auth: AuthController;
  secureCookies: boolean;
  usingFakes: boolean;
  tts: TtsController;
}

export function buildServerContainer(env: Record<string, string | undefined>): ServerContainer {
  const usingFakes = env.FAKE_PROVIDERS === "1";
  if (usingFakes && env.VERCEL_ENV === "production") {
    throw new Error("FAKE_PROVIDERS không được bật trên production");
  }
  const users = UserDirectory.fromEnv(env.APP_USERS);
  const sessions = new SessionService(env.AUTH_SECRET ?? "");
  const auth = new AuthController(users, new BcryptPasswordHasher(), sessions);
  const ttsProvider = usingFakes ? new FakeTtsProvider() : new GoogleTtsService(env.GOOGLE_TTS_API_KEY ?? "");
  return {
    users,
    sessions,
    auth,
    secureCookies: env.NODE_ENV === "production",
    usingFakes,
    tts: new TtsController(ttsProvider),
  };
}

let cached: ServerContainer | undefined;

export function serverContainer(): ServerContainer {
  cached ??= buildServerContainer(process.env);
  return cached;
}
```

- [ ] **Step 12: Chạy test, typecheck, build**

Run: `npx vitest run`
Expected: PASS toàn bộ.

Run: `npm run typecheck && npm run build`
Expected: không lỗi, bảng route có `/api/tts` và `/api/tts/voices`.

- [ ] **Step 13: Commit**

```bash
git add src/server/http/upstream.ts src/server/tts src/server/http/ttsRoutes.ts src/server/container.ts src/app/api/tts tests/server
git commit -m "feat(tts): Google TTS + bản giả lập, API danh sách giọng và tạo giọng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Cảnh trám — Pexels, Pixabay, bản giả lập, API tìm

**Files:**
- Create: `src/server/stock/StockProvider.ts`, `src/server/stock/PexelsService.ts`, `src/server/stock/PixabayService.ts`, `src/server/stock/FakeStockProvider.ts`, `src/server/stock/StockController.ts`, `src/server/http/stockRoutes.ts`, `src/app/api/stock/search/route.ts`
- Modify: `src/server/container.ts` (thay toàn bộ nội dung), `tests/server/container.test.ts` (thay toàn bộ nội dung)
- Test: `tests/server/stock/PexelsService.test.ts`, `tests/server/stock/PixabayService.test.ts`, `tests/server/stock/StockController.test.ts`, `tests/server/http/stockRoutes.test.ts`

**Interfaces:**
- Consumes: `fetchJson` (Task 8), `withAuth`, `AuthController`, `makeTestAuth` (Task 7), `ValidationError`, `UpstreamError`, `DomainError` (Task 2), `FakeTtsProvider`, `GoogleTtsService`, `TtsController` (Task 8).
- Produces:
  - `type StockKind = "image" | "video"`, `type StockProviderName = "pexels" | "pixabay" | "fake"`
  - `interface StockItem { provider: StockProviderName; id: string; kind: StockKind; thumbUrl: string; fullUrl: string; width: number; height: number; durationSec?: number; author: string; pageUrl: string }`
  - `interface StockQuery { query: string; kind: StockKind; page: number; perPage: number }`
  - `interface StockProvider { readonly name: StockProviderName; search(q: StockQuery): Promise<StockItem[]> }`
  - `class PexelsService`, `pickPexelsFile(files)`, `class PixabayService`, `class FakeStockProvider` (đều `implements StockProvider`)
  - `interface StockSearchResult { items: StockItem[]; warnings: string[] }`, `class StockController { constructor(providers: StockProvider[]); search(input: Record<string, string | undefined>): Promise<StockSearchResult> }`, `interleave<T>(lists: T[][]): T[]`
  - `makeStockSearchGet(getDeps: () => { auth: AuthController; stock: StockController })`
  - `ServerContainer` thêm `stock: StockController`.
  - API: `GET /api/stock/search?q=<từ khoá>&kind=image|video&page=1&perPage=8`.

- [ ] **Step 1: Viết test nhà cung cấp**

`tests/server/stock/PexelsService.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { PexelsService, pickPexelsFile } from "@/server/stock/PexelsService";

describe("PexelsService", () => {
  it("tìm ảnh: gửi key ở header, ánh xạ kết quả", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        photos: [
          {
            id: 11,
            width: 4000,
            height: 3000,
            url: "https://www.pexels.com/photo/11/",
            photographer: "An",
            src: { medium: "https://img/m.jpg", large2x: "https://img/l2.jpg", original: "https://img/o.jpg" },
          },
        ],
      }),
    );
    const items = await new PexelsService("PK", fetchImpl as unknown as typeof fetch).search({
      query: "police",
      kind: "image",
      page: 1,
      perPage: 8,
    });
    expect(items).toEqual([
      {
        provider: "pexels",
        id: "pexels-photo-11",
        kind: "image",
        thumbUrl: "https://img/m.jpg",
        fullUrl: "https://img/l2.jpg",
        width: 4000,
        height: 3000,
        author: "An",
        pageUrl: "https://www.pexels.com/photo/11/",
      },
    ]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.pexels.com/v1/search?query=police&page=1&per_page=8");
    expect(init.headers).toEqual({ Authorization: "PK" });
  });

  it("tìm video: chọn file mp4 lớn nhất không quá 1920, bỏ video không có file dùng được", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        videos: [
          {
            id: 5,
            width: 3840,
            height: 2160,
            url: "https://www.pexels.com/video/5/",
            image: "https://img/v5.jpg",
            duration: 12,
            user: { name: "Bình" },
            video_files: [
              { link: "https://v/4k.mp4", file_type: "video/mp4", width: 3840, height: 2160, quality: "uhd" },
              { link: "https://v/hd.mp4", file_type: "video/mp4", width: 1920, height: 1080, quality: "hd" },
              { link: "https://v/sd.mp4", file_type: "video/mp4", width: 960, height: 540, quality: "sd" },
            ],
          },
          { id: 6, width: 1, height: 1, url: "u", image: "i", duration: 3, user: { name: "C" }, video_files: [] },
        ],
      }),
    );
    const items = await new PexelsService("PK", fetchImpl as unknown as typeof fetch).search({
      query: "city",
      kind: "video",
      page: 2,
      perPage: 5,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "pexels-video-5", fullUrl: "https://v/hd.mp4", width: 1920, durationSec: 12 });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://api.pexels.com/videos/search?query=city&page=2&per_page=5",
    );
  });

  it("pickPexelsFile trả undefined khi không có mp4", () => {
    expect(pickPexelsFile([{ link: "x", file_type: "video/webm", width: 10, height: 10, quality: null }])).toBeUndefined();
  });
});
```

`tests/server/stock/PixabayService.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { PixabayService } from "@/server/stock/PixabayService";

describe("PixabayService", () => {
  it("tìm ảnh: key ở query, per_page tối thiểu 3 rồi cắt lại", async () => {
    const hit = (id: number) => ({
      id,
      pageURL: `https://pixabay.com/p/${id}`,
      webformatURL: `https://px/w${id}.jpg`,
      largeImageURL: `https://px/l${id}.jpg`,
      imageWidth: 1920,
      imageHeight: 1280,
      user: "Cường",
    });
    const fetchImpl = vi.fn(async () => Response.json({ hits: [hit(1), hit(2), hit(3)] }));
    const items = await new PixabayService("XK", fetchImpl as unknown as typeof fetch).search({
      query: "court gavel",
      kind: "image",
      page: 1,
      perPage: 2,
    });
    expect(items.map((i) => i.id)).toEqual(["pixabay-photo-1", "pixabay-photo-2"]);
    expect(items[0]).toMatchObject({ thumbUrl: "https://px/w1.jpg", fullUrl: "https://px/l1.jpg", author: "Cường" });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://pixabay.com/api/?key=XK&q=court+gavel&page=1&per_page=3&safesearch=true&image_type=photo",
    );
  });

  it("tìm video: chọn bản lớn nhất không quá 1920", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        hits: [
          {
            id: 9,
            pageURL: "https://pixabay.com/v/9",
            duration: 15,
            user: "Dung",
            videos: {
              large: { url: "https://pv/l.mp4", width: 3840, height: 2160, thumbnail: "https://pv/l.jpg" },
              medium: { url: "https://pv/m.mp4", width: 1920, height: 1080, thumbnail: "https://pv/m.jpg" },
              small: { url: "https://pv/s.mp4", width: 1280, height: 720, thumbnail: "https://pv/s.jpg" },
            },
          },
        ],
      }),
    );
    const items = await new PixabayService("XK", fetchImpl as unknown as typeof fetch).search({
      query: "money",
      kind: "video",
      page: 1,
      perPage: 8,
    });
    expect(items[0]).toMatchObject({
      id: "pixabay-video-9",
      kind: "video",
      fullUrl: "https://pv/m.mp4",
      thumbUrl: "https://pv/m.jpg",
      width: 1920,
      durationSec: 15,
    });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://pixabay.com/api/videos/?key=XK&q=money&page=1&per_page=8&safesearch=true",
    );
  });
});
```

- [ ] **Step 2: Viết test controller, route, container**

`tests/server/stock/StockController.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { interleave, StockController } from "@/server/stock/StockController";
import type { StockItem, StockProvider } from "@/server/stock/StockProvider";
import { QuotaError, ValidationError } from "@/domain/errors";

const item = (provider: "pexels" | "pixabay", n: number): StockItem => ({
  provider,
  id: `${provider}-${n}`,
  kind: "image",
  thumbUrl: "t",
  fullUrl: "f",
  width: 1,
  height: 1,
  author: "a",
  pageUrl: "p",
});
const ok = (name: "pexels" | "pixabay", n: number): StockProvider => ({
  name,
  search: async () => Array.from({ length: n }, (_, i) => item(name, i + 1)),
});
const failing = (name: "pexels" | "pixabay"): StockProvider => ({
  name,
  search: async () => {
    throw new QuotaError(`${name} hết lượt`);
  },
});

describe("interleave", () => {
  it("xen kẽ các danh sách", () => {
    expect(interleave([[1, 2, 3], [9]])).toEqual([1, 9, 2, 3]);
  });
});

describe("StockController", () => {
  it("gộp xen kẽ kết quả hai nguồn", async () => {
    const r = await new StockController([ok("pexels", 2), ok("pixabay", 2)]).search({ q: "police", kind: "image" });
    expect(r.items.map((i) => i.id)).toEqual(["pexels-1", "pixabay-1", "pexels-2", "pixabay-2"]);
    expect(r.warnings).toEqual([]);
  });

  it("một nguồn lỗi: vẫn trả nguồn còn lại kèm cảnh báo", async () => {
    const r = await new StockController([failing("pexels"), ok("pixabay", 1)]).search({ q: "x", kind: "video" });
    expect(r.items).toHaveLength(1);
    expect(r.warnings).toEqual(["pexels: pexels hết lượt"]);
  });

  it("mọi nguồn lỗi: ném lỗi của nguồn cuối", async () => {
    await expect(new StockController([failing("pexels"), failing("pixabay")]).search({ q: "x", kind: "image" })).rejects.toThrow(
      "pixabay hết lượt",
    );
  });

  it("kiểm tham số", async () => {
    const c = new StockController([ok("pexels", 1)]);
    await expect(c.search({ q: "  ", kind: "image" })).rejects.toBeInstanceOf(ValidationError);
    await expect(c.search({ q: "x", kind: "gif" })).rejects.toBeInstanceOf(ValidationError);
    await expect(c.search({ q: "x", kind: "image", perPage: "99" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("truyền page, perPage mặc định 1 và 8", async () => {
    let seen: unknown;
    const spy: StockProvider = {
      name: "pexels",
      search: async (q) => {
        seen = q;
        return [];
      },
    };
    await new StockController([spy]).search({ q: " police ", kind: "image" });
    expect(seen).toEqual({ query: "police", kind: "image", page: 1, perPage: 8 });
  });
});
```

`tests/server/http/stockRoutes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { makeStockSearchGet } from "@/server/http/stockRoutes";
import { StockController } from "@/server/stock/StockController";
import { FakeStockProvider } from "@/server/stock/FakeStockProvider";
import { makeTestAuth } from "../helpers";

describe("GET /api/stock/search", () => {
  it("cần đăng nhập", async () => {
    const t = await makeTestAuth();
    const get = makeStockSearchGet(() => ({ auth: t.auth, stock: new StockController([new FakeStockProvider()]) }));
    expect((await get(new Request("http://localhost/api/stock/search?q=x&kind=image"))).status).toBe(401);
  });

  it("trả kết quả từ bản giả lập", async () => {
    const t = await makeTestAuth();
    const get = makeStockSearchGet(() => ({ auth: t.auth, stock: new StockController([new FakeStockProvider()]) }));
    const res = await get(
      new Request("http://localhost/api/stock/search?q=police&kind=image&perPage=4", {
        headers: { cookie: await t.cookieFor("hai") },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(4);
    expect(body.items[0].fullUrl.startsWith("data:image/svg+xml")).toBe(true);
    expect(body.warnings).toEqual([]);
  });
});
```

`tests/server/container.test.ts` (thay toàn bộ):
```ts
import { describe, expect, it } from "vitest";
import { buildServerContainer } from "@/server/container";

const HASH = "$2b$04$abcdefghijklmnopqrstuuJ0123456789abcdefghijklmnopqrstu";
const base = {
  APP_USERS: JSON.stringify([{ username: "hai", passwordHash: HASH, displayName: "Hải" }]),
  AUTH_SECRET: "s".repeat(32),
};
const realKeys = { GOOGLE_TTS_API_KEY: "g", PEXELS_API_KEY: "p", PIXABAY_API_KEY: "x" };

describe("buildServerContainer", () => {
  it("FAKE_PROVIDERS=1 dùng bản giả lập, không cần key", async () => {
    const c = buildServerContainer({ ...base, FAKE_PROVIDERS: "1" });
    expect(c.usingFakes).toBe(true);
    expect((await c.tts.voices())[0]?.name).toBe("vi-VN-Fake-A");
    expect((await c.stock.search({ q: "x", kind: "image" })).items.length).toBeGreaterThan(0);
  });

  it("không bật giả lập thì bắt buộc có đủ key thật", () => {
    expect(() => buildServerContainer(base)).toThrow("GOOGLE_TTS_API_KEY chưa được cấu hình");
    expect(() => buildServerContainer({ ...base, GOOGLE_TTS_API_KEY: "g" })).toThrow("PEXELS_API_KEY chưa được cấu hình");
    expect(buildServerContainer({ ...base, ...realKeys }).usingFakes).toBe(false);
  });

  it("cấm giả lập trên production của Vercel", () => {
    expect(() => buildServerContainer({ ...base, FAKE_PROVIDERS: "1", VERCEL_ENV: "production" })).toThrow(
      "FAKE_PROVIDERS không được bật trên production",
    );
  });

  it("cookie Secure khi NODE_ENV=production", () => {
    expect(buildServerContainer({ ...base, FAKE_PROVIDERS: "1", NODE_ENV: "production" }).secureCookies).toBe(true);
  });
});
```

- [ ] **Step 3: Chạy test để thấy lỗi**

Run: `npx vitest run tests/server`
Expected: FAIL ở các file stock và container (thiếu `stock`).

- [ ] **Step 4: Viết `src/server/stock/StockProvider.ts`**

```ts
export type StockKind = "image" | "video";
export type StockProviderName = "pexels" | "pixabay" | "fake";

export interface StockItem {
  provider: StockProviderName;
  id: string;
  kind: StockKind;
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  durationSec?: number;
  author: string;
  pageUrl: string;
}

export interface StockQuery {
  query: string;
  kind: StockKind;
  page: number;
  perPage: number;
}

export interface StockProvider {
  readonly name: StockProviderName;
  search(query: StockQuery): Promise<StockItem[]>;
}
```

- [ ] **Step 5: Viết `src/server/stock/PexelsService.ts`**

```ts
import { fetchJson } from "@/server/http/upstream";
import type { StockItem, StockProvider, StockQuery } from "./StockProvider";

const BASE = "https://api.pexels.com";
const LABELS = { service: "Pexels", quotaMessage: "Pexels đã hết lượt tìm trong giờ này, thử lại sau" };
const MAX_SIDE = 1920;

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  src: { medium: string; large2x: string; original: string };
}

export interface PexelsVideoFile {
  link: string;
  file_type: string;
  width: number | null;
  height: number | null;
  quality: string | null;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image: string;
  duration: number;
  user: { name: string };
  video_files: PexelsVideoFile[];
}

export function pickPexelsFile(files: readonly PexelsVideoFile[]): PexelsVideoFile | undefined {
  const mp4 = files.filter((f) => f.file_type === "video/mp4" && f.width && f.height);
  const fitting = mp4.filter((f) => Math.max(f.width ?? 0, f.height ?? 0) <= MAX_SIDE);
  const pool = fitting.length > 0 ? fitting : mp4;
  return [...pool].sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0];
}

export class PexelsService implements StockProvider {
  readonly name = "pexels" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("PEXELS_API_KEY chưa được cấu hình");
  }

  async search(q: StockQuery): Promise<StockItem[]> {
    const params = new URLSearchParams({ query: q.query, page: String(q.page), per_page: String(q.perPage) });
    const init: RequestInit = { headers: { Authorization: this.apiKey } };
    if (q.kind === "image") {
      const data = await fetchJson<{ photos?: PexelsPhoto[] }>(this.fetchImpl, `${BASE}/v1/search?${params}`, init, LABELS);
      return (data.photos ?? []).map((p) => ({
        provider: this.name,
        id: `pexels-photo-${p.id}`,
        kind: "image",
        thumbUrl: p.src.medium,
        fullUrl: p.src.large2x,
        width: p.width,
        height: p.height,
        author: p.photographer,
        pageUrl: p.url,
      }));
    }
    const data = await fetchJson<{ videos?: PexelsVideo[] }>(
      this.fetchImpl,
      `${BASE}/videos/search?${params}`,
      init,
      LABELS,
    );
    return (data.videos ?? []).flatMap((v): StockItem[] => {
      const file = pickPexelsFile(v.video_files);
      if (!file) return [];
      return [
        {
          provider: this.name,
          id: `pexels-video-${v.id}`,
          kind: "video",
          thumbUrl: v.image,
          fullUrl: file.link,
          width: file.width ?? v.width,
          height: file.height ?? v.height,
          durationSec: v.duration,
          author: v.user.name,
          pageUrl: v.url,
        },
      ];
    });
  }
}
```

- [ ] **Step 6: Viết `src/server/stock/PixabayService.ts`**

```ts
import { fetchJson } from "@/server/http/upstream";
import type { StockItem, StockProvider, StockQuery } from "./StockProvider";

const BASE = "https://pixabay.com/api";
const LABELS = { service: "Pixabay", quotaMessage: "Pixabay đã hết lượt tìm, thử lại sau 1 phút" };
const MIN_PER_PAGE = 3;
const MAX_SIDE = 1920;

interface PixabayImage {
  id: number;
  pageURL: string;
  webformatURL: string;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  user: string;
}

interface PixabayVariant {
  url: string;
  width: number;
  height: number;
  thumbnail?: string;
}

interface PixabayVideo {
  id: number;
  pageURL: string;
  duration: number;
  user: string;
  videos: { large?: PixabayVariant; medium?: PixabayVariant; small?: PixabayVariant; tiny?: PixabayVariant };
}

function pickVariant(v: PixabayVideo["videos"]): PixabayVariant | undefined {
  const all = [v.large, v.medium, v.small, v.tiny].filter((x): x is PixabayVariant => Boolean(x?.url));
  return all.find((x) => Math.max(x.width, x.height) <= MAX_SIDE) ?? all[all.length - 1];
}

export class PixabayService implements StockProvider {
  readonly name = "pixabay" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("PIXABAY_API_KEY chưa được cấu hình");
  }

  async search(q: StockQuery): Promise<StockItem[]> {
    const params = new URLSearchParams({
      key: this.apiKey,
      q: q.query.slice(0, 100),
      page: String(q.page),
      per_page: String(Math.max(MIN_PER_PAGE, q.perPage)),
      safesearch: "true",
    });
    if (q.kind === "image") {
      params.set("image_type", "photo");
      const data = await fetchJson<{ hits?: PixabayImage[] }>(this.fetchImpl, `${BASE}/?${params}`, {}, LABELS);
      return (data.hits ?? []).slice(0, q.perPage).map((h) => ({
        provider: this.name,
        id: `pixabay-photo-${h.id}`,
        kind: "image",
        thumbUrl: h.webformatURL,
        fullUrl: h.largeImageURL,
        width: h.imageWidth,
        height: h.imageHeight,
        author: h.user,
        pageUrl: h.pageURL,
      }));
    }
    const data = await fetchJson<{ hits?: PixabayVideo[] }>(this.fetchImpl, `${BASE}/videos/?${params}`, {}, LABELS);
    return (data.hits ?? []).slice(0, q.perPage).flatMap((h): StockItem[] => {
      const variant = pickVariant(h.videos);
      if (!variant) return [];
      return [
        {
          provider: this.name,
          id: `pixabay-video-${h.id}`,
          kind: "video",
          thumbUrl: variant.thumbnail ?? "",
          fullUrl: variant.url,
          width: variant.width,
          height: variant.height,
          durationSec: h.duration,
          author: h.user,
          pageUrl: h.pageURL,
        },
      ];
    });
  }
}
```

- [ ] **Step 7: Viết `src/server/stock/FakeStockProvider.ts`**

```ts
import type { StockItem, StockProvider, StockQuery } from "./StockProvider";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2"];

function placeholderSvg(label: string, color: string): string {
  const safe = label.replace(/[<>&"]/g, "");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">` +
    `<rect width="1600" height="900" fill="${color}"/>` +
    `<text x="800" y="470" font-family="sans-serif" font-size="96" fill="#fff" text-anchor="middle">${safe}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export class FakeStockProvider implements StockProvider {
  readonly name = "fake" as const;

  async search(q: StockQuery): Promise<StockItem[]> {
    if (q.kind === "video") return [];
    return Array.from({ length: q.perPage }, (_, i) => {
      const n = (q.page - 1) * q.perPage + i + 1;
      const url = placeholderSvg(`${q.query} #${n}`, COLORS[n % COLORS.length] as string);
      return {
        provider: this.name,
        id: `fake-${q.query}-${n}`,
        kind: "image" as const,
        thumbUrl: url,
        fullUrl: url,
        width: 1600,
        height: 900,
        author: "Giả lập",
        pageUrl: "about:blank",
      };
    });
  }
}
```

- [ ] **Step 8: Viết `src/server/stock/StockController.ts`**

```ts
import { z } from "zod";
import { DomainError, UpstreamError, ValidationError } from "@/domain/errors";
import type { StockItem, StockProvider } from "./StockProvider";

const QuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  kind: z.enum(["image", "video"]),
  page: z.coerce.number().int().min(1).max(50).default(1),
  perPage: z.coerce.number().int().min(1).max(30).default(8),
});

export interface StockSearchResult {
  items: StockItem[];
  warnings: string[];
}

export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const value = list[i];
      if (value !== undefined) out.push(value);
    }
  }
  return out;
}

export class StockController {
  constructor(private readonly providers: StockProvider[]) {
    if (providers.length === 0) throw new Error("Chưa cấu hình nguồn cảnh trám nào");
  }

  async search(input: Record<string, string | undefined>): Promise<StockSearchResult> {
    const parsed = QuerySchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Từ khoá tìm cảnh trám không hợp lệ");
    const query = { query: parsed.data.q, kind: parsed.data.kind, page: parsed.data.page, perPage: parsed.data.perPage };

    const settled = await Promise.allSettled(this.providers.map((p) => p.search(query)));
    const lists: StockItem[][] = [];
    const warnings: string[] = [];
    let lastError: unknown;
    settled.forEach((result, i) => {
      if (result.status === "fulfilled") {
        lists.push(result.value);
        return;
      }
      lastError = result.reason;
      const message = result.reason instanceof Error ? result.reason.message : "lỗi không rõ";
      warnings.push(`${this.providers[i]?.name}: ${message}`);
    });

    if (lists.length === 0) {
      throw lastError instanceof DomainError ? lastError : new UpstreamError("Không tìm được cảnh trám");
    }
    return { items: interleave(lists), warnings };
  }
}
```

- [ ] **Step 9: Viết route và thay container**

`src/server/http/stockRoutes.ts`:
```ts
import type { AuthController } from "@/server/auth/AuthController";
import type { StockController } from "@/server/stock/StockController";
import { withAuth } from "./withAuth";

export interface StockRouteDeps {
  auth: AuthController;
  stock: StockController;
}

export function makeStockSearchGet(getDeps: () => StockRouteDeps): (request: Request) => Promise<Response> {
  return withAuth(
    () => getDeps().auth,
    async (request) => {
      const params = Object.fromEntries(new URL(request.url).searchParams);
      const result = await getDeps().stock.search(params);
      return Response.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
    },
  );
}
```

`src/app/api/stock/search/route.ts`:
```ts
import { serverContainer } from "@/server/container";
import { makeStockSearchGet } from "@/server/http/stockRoutes";

export const GET = makeStockSearchGet(() => serverContainer());
```

`src/server/container.ts` (thay toàn bộ):
```ts
import { AuthController } from "./auth/AuthController";
import { BcryptPasswordHasher } from "./auth/PasswordHasher";
import { SessionService } from "./auth/SessionService";
import { UserDirectory } from "./auth/UserDirectory";
import { FakeStockProvider } from "./stock/FakeStockProvider";
import { PexelsService } from "./stock/PexelsService";
import { PixabayService } from "./stock/PixabayService";
import { StockController } from "./stock/StockController";
import type { StockProvider } from "./stock/StockProvider";
import { FakeTtsProvider } from "./tts/FakeTtsProvider";
import { GoogleTtsService } from "./tts/GoogleTtsService";
import { TtsController } from "./tts/TtsController";
import type { TtsProvider } from "./tts/TtsProvider";

export interface ServerContainer {
  users: UserDirectory;
  sessions: SessionService;
  auth: AuthController;
  secureCookies: boolean;
  usingFakes: boolean;
  tts: TtsController;
  stock: StockController;
}

export function buildServerContainer(env: Record<string, string | undefined>): ServerContainer {
  const usingFakes = env.FAKE_PROVIDERS === "1";
  if (usingFakes && env.VERCEL_ENV === "production") {
    throw new Error("FAKE_PROVIDERS không được bật trên production");
  }
  const users = UserDirectory.fromEnv(env.APP_USERS);
  const sessions = new SessionService(env.AUTH_SECRET ?? "");
  const auth = new AuthController(users, new BcryptPasswordHasher(), sessions);

  const ttsProvider: TtsProvider = usingFakes
    ? new FakeTtsProvider()
    : new GoogleTtsService(env.GOOGLE_TTS_API_KEY ?? "");
  const stockProviders: StockProvider[] = usingFakes
    ? [new FakeStockProvider()]
    : [new PexelsService(env.PEXELS_API_KEY ?? ""), new PixabayService(env.PIXABAY_API_KEY ?? "")];

  return {
    users,
    sessions,
    auth,
    secureCookies: env.NODE_ENV === "production",
    usingFakes,
    tts: new TtsController(ttsProvider),
    stock: new StockController(stockProviders),
  };
}

let cached: ServerContainer | undefined;

export function serverContainer(): ServerContainer {
  cached ??= buildServerContainer(process.env);
  return cached;
}
```

- [ ] **Step 10: Chạy test, typecheck, build**

Run: `npx vitest run`
Expected: PASS toàn bộ.

Run: `npm run typecheck && npm run build`
Expected: không lỗi, bảng route có `/api/stock/search`.

- [ ] **Step 11: Commit**

```bash
git add src/server/stock src/server/http/stockRoutes.ts src/server/container.ts src/app/api/stock tests/server
git commit -m "feat(stock): tìm cảnh trám Pexels + Pixabay + bản giả lập, API gộp kết quả

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Trang đăng nhập, trang studio tạm, README, kiểm tra thật

**Files:**
- Create: `src/client/services/AuthClient.ts`, `src/client/controllers/SessionController.ts`, `src/views/auth/LoginForm.tsx`, `src/views/auth/LogoutButton.tsx`, `src/app/dang-nhap/page.tsx`, `src/app/studio/page.tsx`, `.claude/launch.json`, `README.md`
- Test: `tests/client/SessionController.test.ts`

**Interfaces:**
- Consumes: `serverContainer()` (Task 9), `SessionService.COOKIE` (Task 7), API `/api/auth/login`, `/api/auth/logout` (Task 7).
- Produces:
  - `class ApiError extends Error { readonly status: number; readonly code: string }`
  - `interface AuthApi { login(username: string, password: string): Promise<{ username: string; displayName: string }>; logout(): Promise<void> }`, `class AuthClient implements AuthApi { constructor(fetchImpl?: typeof fetch) }`
  - `type LoginState = { status: "idle" } | { status: "submitting" } | { status: "error"; message: string } | { status: "done"; displayName: string }`
  - `class SessionController { constructor(api: AuthApi); get state(): LoginState; subscribe(listener: () => void): () => void; login(username: string, password: string): Promise<boolean>; logout(): Promise<void> }`

- [ ] **Step 1: Viết test `SessionController`**

`tests/client/SessionController.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { ApiError, type AuthApi } from "@/client/services/AuthClient";
import { SessionController } from "@/client/controllers/SessionController";

const api = (impl: Partial<AuthApi>): AuthApi => ({
  login: impl.login ?? (async () => ({ username: "hai", displayName: "Hải" })),
  logout: impl.logout ?? (async () => {}),
});

describe("SessionController", () => {
  it("đăng nhập thành công: submitting rồi done, báo cho người nghe", async () => {
    const c = new SessionController(api({}));
    const seen: string[] = [];
    c.subscribe(() => seen.push(c.state.status));
    expect(await c.login("hai", "x")).toBe(true);
    expect(seen).toEqual(["submitting", "done"]);
    expect(c.state).toEqual({ status: "done", displayName: "Hải" });
  });

  it("sai mật khẩu: hiện thông báo của server", async () => {
    const c = new SessionController(
      api({
        login: async () => {
          throw new ApiError(401, "AUTH", "Sai tên đăng nhập hoặc mật khẩu");
        },
      }),
    );
    expect(await c.login("hai", "x")).toBe(false);
    expect(c.state).toEqual({ status: "error", message: "Sai tên đăng nhập hoặc mật khẩu" });
  });

  it("lỗi mạng: thông báo chung", async () => {
    const c = new SessionController(
      api({
        login: async () => {
          throw new TypeError("Failed to fetch");
        },
      }),
    );
    await c.login("hai", "x");
    expect(c.state).toEqual({ status: "error", message: "Không kết nối được máy chủ, thử lại sau" });
  });

  it("bỏ trống thì báo lỗi, không gọi API", async () => {
    const login = vi.fn();
    const c = new SessionController(api({ login }));
    expect(await c.login("  ", "")).toBe(false);
    expect(login).not.toHaveBeenCalled();
    expect(c.state).toEqual({ status: "error", message: "Nhập tên đăng nhập và mật khẩu" });
  });

  it("huỷ đăng ký người nghe", async () => {
    const c = new SessionController(api({}));
    const listener = vi.fn();
    const off = c.subscribe(listener);
    off();
    await c.login("hai", "x");
    expect(listener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy test để thấy lỗi**

Run: `npx vitest run tests/client`
Expected: FAIL, không tìm thấy module.

- [ ] **Step 3: Viết `src/client/services/AuthClient.ts`**

```ts
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface AuthApi {
  login(username: string, password: string): Promise<{ username: string; displayName: string }>;
  logout(): Promise<void>;
}

async function readError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  return new ApiError(response.status, body?.error?.code ?? "INTERNAL", body?.error?.message ?? "Lỗi máy chủ");
}

export class AuthClient implements AuthApi {
  constructor(private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async login(username: string, password: string): Promise<{ username: string; displayName: string }> {
    const response = await this.fetchImpl("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw await readError(response);
    const body = (await response.json()) as { user: { username: string; displayName: string } };
    return body.user;
  }

  async logout(): Promise<void> {
    const response = await this.fetchImpl("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw await readError(response);
  }
}
```

- [ ] **Step 4: Viết `src/client/controllers/SessionController.ts`**

```ts
import { ApiError, type AuthApi } from "@/client/services/AuthClient";

export type LoginState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "done"; displayName: string };

export class SessionController {
  private current: LoginState = { status: "idle" };
  private readonly listeners = new Set<() => void>();

  constructor(private readonly api: AuthApi) {}

  get state(): LoginState {
    return this.current;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async login(username: string, password: string): Promise<boolean> {
    if (!username.trim() || !password) {
      this.set({ status: "error", message: "Nhập tên đăng nhập và mật khẩu" });
      return false;
    }
    this.set({ status: "submitting" });
    try {
      const user = await this.api.login(username.trim(), password);
      this.set({ status: "done", displayName: user.displayName });
      return true;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Không kết nối được máy chủ, thử lại sau";
      this.set({ status: "error", message });
      return false;
    }
  }

  async logout(): Promise<void> {
    await this.api.logout();
    this.set({ status: "idle" });
  }

  private set(state: LoginState): void {
    this.current = state;
    for (const listener of this.listeners) listener();
  }
}
```

- [ ] **Step 5: Chạy test**

Run: `npx vitest run tests/client`
Expected: PASS (5 test).

- [ ] **Step 6: Viết view và trang**

`src/views/auth/LoginForm.tsx`:
```tsx
"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SessionController } from "@/client/controllers/SessionController";
import { AuthClient } from "@/client/services/AuthClient";

export function LoginForm() {
  const controller = useMemo(() => new SessionController(new AuthClient()), []);
  const state = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.state,
    () => controller.state,
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const next = useSearchParams().get("next");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (await controller.login(username, password)) {
      router.replace(next?.startsWith("/") ? next : "/studio");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-24 flex w-full max-w-sm flex-col gap-4 rounded-xl bg-neutral-900 p-6">
      <h1 className="text-xl font-semibold">Tin Video Studio</h1>
      <label className="flex flex-col gap-1 text-sm">
        Tên đăng nhập
        <input
          className="rounded-md bg-neutral-800 px-3 py-2"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Mật khẩu
        <input
          className="rounded-md bg-neutral-800 px-3 py-2"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {state.status === "error" && <p className="text-sm text-red-400">{state.message}</p>}
      <button
        type="submit"
        disabled={state.status === "submitting"}
        className="rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-50"
      >
        {state.status === "submitting" ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
```

`src/views/auth/LogoutButton.tsx`:
```tsx
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { SessionController } from "@/client/controllers/SessionController";
import { AuthClient } from "@/client/services/AuthClient";

export function LogoutButton() {
  const controller = useMemo(() => new SessionController(new AuthClient()), []);
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-md bg-neutral-800 px-3 py-1 text-sm"
      onClick={async () => {
        await controller.logout();
        router.replace("/dang-nhap");
        router.refresh();
      }}
    >
      Đăng xuất
    </button>
  );
}
```

`src/app/dang-nhap/page.tsx`:
```tsx
import { Suspense } from "react";
import { LoginForm } from "@/views/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
```

`src/app/studio/page.tsx`:
```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionService } from "@/server/auth/SessionService";
import { serverContainer } from "@/server/container";
import { LogoutButton } from "@/views/auth/LogoutButton";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const token = (await cookies()).get(SessionService.COOKIE)?.value;
  const user = await serverContainer().auth.authenticate(token).catch(() => null);
  if (!user) redirect("/dang-nhap");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tin Video Studio</h1>
        <div className="flex items-center gap-3 text-sm">
          <span>Xin chào, {user.displayName}</span>
          <LogoutButton />
        </div>
      </header>
      <p className="mt-8 text-neutral-400">Trình dựng 5 bước sẽ có ở chặng 3.</p>
    </main>
  );
}
```

- [ ] **Step 7: Viết `.claude/launch.json` và `README.md`**

`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "tin-video-studio",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3100
    }
  ]
}
```

`README.md`:
````markdown
# Tin Video Studio

Web app dựng video tin tức dọc 9:16 từ văn bản. Video dựng trên trình duyệt người dùng, server chỉ giữ key và làm proxy.

- Đặc tả: `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md`
- Lộ trình: `docs/superpowers/plans/2026-10-15-00-lo-trinh.md`

## Chạy local (không cần key thật)

1. `npm install`
2. Tạo tài khoản:
   ```bash
   npm run user:entry -- hai "Hải" <mật-khẩu-ít-nhất-8-ký-tự>
   ```
   Chép dòng JSON in ra vào file `users.local.json` dạng mảng `[ {...}, {...} ]` (tối đa 5 dòng). File này không commit.
3. Đóng gói:
   ```bash
   npm run user:encode -- users.local.json
   ```
4. Tạo `.env.local` theo `.env.example`: `FAKE_PROVIDERS=1`, `APP_USERS=<chuỗi base64 vừa in>`, `AUTH_SECRET=<chuỗi ngẫu nhiên ≥ 32 ký tự>`.
5. `npm run dev` rồi mở http://localhost:3100

## Chạy với key thật

Bỏ `FAKE_PROVIDERS`, điền `GOOGLE_TTS_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`.

## API (đều cần đăng nhập, trừ đăng nhập)

| Route | Việc |
|---|---|
| `POST /api/auth/login` | `{ username, password }` → cookie phiên |
| `POST /api/auth/logout` | xoá cookie |
| `GET /api/tts/voices` | danh sách giọng `vi-VN` |
| `POST /api/tts` | `{ text, voiceName, speakingRate }` → âm thanh |
| `GET /api/stock/search?q=&kind=image\|video&page=&perPage=` | cảnh trám gộp Pexels + Pixabay |

## Kiểm tra

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
````

- [ ] **Step 8: Kiểm tra toàn bộ**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: tất cả PASS. Bảng route có `/dang-nhap`, `/studio`, 5 route API, và dòng Proxy.

- [ ] **Step 9: Kiểm tra thật trên dev server**

Tạo `.env.local` (không commit) theo README với `FAKE_PROVIDERS=1`, tài khoản `hai`. Mở dev server bằng `preview_start` tên `tin-video-studio` (không chạy dev server bằng Bash). Sau đó chạy lần lượt:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/api/tts/voices
```
Expected: `401`

```bash
curl -s -c /tmp/tvs.txt -H "Content-Type: application/json" -d '{"username":"hai","password":"<mật-khẩu>"}' http://localhost:3100/api/auth/login
```
Expected: `{"user":{"username":"hai","displayName":"Hải"}}`

```bash
curl -s -b /tmp/tvs.txt http://localhost:3100/api/tts/voices
```
Expected: JSON có `vi-VN-Fake-A` và `vi-VN-Fake-B`.

```bash
curl -s -b /tmp/tvs.txt -H "Content-Type: application/json" -d '{"text":"Xin chào các bạn.","voiceName":"vi-VN-Fake-A","speakingRate":1.07}' -o /tmp/tvs.wav -w "%{http_code} %{content_type}\n" http://localhost:3100/api/tts
```
Expected: `200 audio/wav`, file `/tmp/tvs.wav` mở được.

```bash
curl -s -b /tmp/tvs.txt "http://localhost:3100/api/stock/search?q=police&kind=image&perPage=3"
```
Expected: JSON có 3 `items`, `warnings: []`.

Trên trình duyệt: mở `/studio` khi chưa đăng nhập → bị chuyển về `/dang-nhap?next=%2Fstudio`. Đăng nhập sai → hiện "Sai tên đăng nhập hoặc mật khẩu". Đăng nhập đúng → về `/studio`, thấy "Xin chào, Hải". Bấm Đăng xuất → về `/dang-nhap`.

- [ ] **Step 10: Commit**

```bash
git add src/client src/views src/app/dang-nhap src/app/studio .claude/launch.json README.md tests/client
git commit -m "feat(ui): trang đăng nhập, trang studio tạm, README chạy local

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Hoàn thành chặng 1 khi

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` đều sạch.
- Kiểm tra thật ở Task 10 Step 9 ra đúng kết quả mong đợi.
- Hải duyệt chặng 1. Sau đó viết kế hoạch chặng 2 (bộ dựng video) dựa trên code thật của chặng này.

## Rủi ro đã biết, kiểm ở chặng sau

- Giọng Chirp 3 HD của Google có thể không nhận `speakingRate`. Khi Hải có key thật, thử từng hạng giọng. Nếu lỗi 400, TtsController bỏ `speakingRate` cho hạng đó.
- CDN ảnh/video của Pexels và Pixabay có thể chặn CORS khi vẽ lên canvas. Chặng 2 kiểm; nếu bị chặn thì thêm route proxy tải file.
