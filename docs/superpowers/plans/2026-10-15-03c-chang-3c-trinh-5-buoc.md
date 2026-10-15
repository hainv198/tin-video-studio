# Tin Video Studio — Chặng 3C: Trình 5 bước — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ghép bộ dựng (3A) và lớp dữ liệu (3B) thành trình 5 bước chạy được ở `/studio`: nhập tin, chọn giọng, duyệt cảnh trám, chọn nhạc, dựng và tải MP4, có lưu và mở lại bản nháp, bộ thương hiệu, xử lý hết phiên đăng nhập.

**Architecture:** Controller phía client không biết React: mỗi bước một lớp kế thừa `StateController` (`state` + `subscribe`), cùng đọc ghi một `StudioSession` giữ dữ liệu domain bất biến và tự lưu bản nháp. View chỉ đọc `state` bằng một hook và gọi phương thức controller. `createStudio` lắp session + controller từ `ClientServices`. Kiểm thử controller bằng Vitest (Node) với dịch vụ giả; view kiểm bằng typecheck, lint, build và một lượt chạy thật trong trình duyệt ở task cuối.

**Tech Stack:** Như chặng 2–3B; không thêm thư viện. Test chạy trong môi trường Node (`tests/**/*.test.ts`), không có jsdom, nên view không có unit test.

**Đặc tả:** `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md` (mục 3 luồng 5 bước, 6.3, 7 xử lý lỗi, 12 và các mục "Kết quả đo"). **Lộ trình:** `docs/superpowers/plans/2026-10-15-00-lo-trinh.md`. **Việc để dành từ 3A và 3B:** `.superpowers/sdd/progress.md` các mục "Để dành cho 3C".

## Global Constraints

- Thư mục dự án: `D:\Brain Hainv\ca-nhan\tools\tin-video-studio`, nhánh `feat/chang-3c-trinh-5-buoc` (điều phối viên tạo từ `main`). Đường dẫn tính từ thư mục này.
- **Agent thực thi CẤM chạy mọi lệnh git.** Bỏ qua bước "Commit"; điều phối viên commit. Không chạy dev server; không tạo `.env*`; không đọc/sửa `.env.local`.
- **RED phải đỏ thật:** chạy test mới trước khi viết code và ghi lại dòng thất bại. Test nào không đỏ trên code cũ thì KHÔNG sửa kỳ vọng, báo lại trong report.
- Phân lớp: `src/domain` chỉ import `src/domain`. `src/client` không import `src/server` ở mã nguồn. View (`src/views`) chỉ gọi controller/`createStudio`, **không** gọi `fetch`, IndexedDB, WebCodecs và không chứa quy tắc nghiệp vụ.
- Controller không import React. Mọi controller kế thừa `StateController`; lỗi hiện cho người dùng đi qua `userMessage()` (tiếng Việt, không lộ lỗi tiếng Anh thô của trình duyệt).
- Hết phiên (API trả 401, hoặc phản hồi bị chuyển hướng sang trang đăng nhập) phải gọi `onAuthLost` và giữ nguyên bản nháp trong IndexedDB.
- Giới hạn file tải lên (đặc tả mục 7): **ảnh ≤ 20 MB, video ≤ 300 MB, nhạc ≤ 30 MB**; logo thương hiệu ≤ **5 MB**; nguồn tin ≤ **80 ký tự**. Chỉ `classifyUpload` và `BrandRepository` kiểm giới hạn; controller phải gọi `classifyUpload` trước `UploadRepository.put`.
- Giọng đọc lưu trong bản nháp là MP3 gốc kèm `durationSec` của bản **chưa cắt**. Cắt khoảng lặng (`trimSilence`) làm ở **mỗi lần dựng job**, sau khi giải mã; `NarrationInput.durationSec = samples.length / sampleRate` của bản đã cắt. Không bao giờ lưu độ dài đã cắt cạnh MP3 chưa cắt.
- Khoảng nghỉ, đệm đầu/cuối, nhạc thấp hơn giọng 15 dB (chỉnh ±6 dB), tần số mẫu 48 kHz lấy từ code hiện có, không đặt lại số ở nơi khác (`RENDER_SAMPLE_RATE`, `MusicTrack.BELOW_VOICE_DB`, `Timeline` mặc định).
- Ngôn ngữ giao diện và thông báo lỗi: tiếng Việt có dấu. Tên lớp, hàm, biến: tiếng Anh. Giữ kiểu xuống dòng (CRLF/LF) của file đang sửa.
- Mọi commit kết thúc bằng dòng `Co-Authored-By` do phiên chạy quy định (điều phối viên tự thêm).
- Sau mỗi task: `npx vitest run`, `npm run typecheck`, `npm run lint` đều sạch (0 cảnh báo). Task có view chạy thêm `npm run build`.

## Cấu trúc file chặng 3C

```
src/client/services/apiError.ts          # sửa: readJson, assertSameSession, networkSafeFetch
src/client/services/{TtsClient,StockClient,MusicLibrary}.ts  # sửa: lỗi mạng/hết phiên/JSON hỏng, signal
src/client/render/RenderClient.ts        # sửa: probe có timeout
src/client/errors/userMessage.ts         # mới
src/client/container.ts                  # sửa: fetch an toàn mạng; thêm TrackSource (task 7)
src/client/services/TrackSource.ts       # mới: đọc MP3 nhạc (kho hoặc tải lên)
src/domain/FootageBoard.ts               # sửa: sceneIds()
src/client/controllers/StateController.ts
src/client/controllers/StudioSession.ts
src/client/controllers/readiness.ts      # StepId, stepReady, canEnter, staleSceneIds
src/client/controllers/dateText.ts       # ngày <input type=date> <-> Date
src/client/controllers/BrandController.ts
src/client/controllers/ProjectController.ts       # bước 1
src/client/controllers/VoiceController.ts         # bước 2
src/client/controllers/FootageController.ts       # bước 3 (tải lên, gán, hoán đổi)
src/client/controllers/FootageSearchController.ts # bước 3 (tìm stock, tự điền)
src/client/controllers/MusicController.ts         # bước 4
src/client/controllers/RenderJobBuilder.ts + fileName.ts
src/client/controllers/RenderController.ts        # bước 5
src/client/controllers/WizardController.ts + createStudio.ts
src/client/sample/sampleNews.ts          # tin mẫu cho nút "Điền tin mẫu"
src/views/hooks/useController.ts
src/views/studio/{StudioApp,StudioShell,Stepper}.tsx
src/views/studio/steps/{StepNews,StepVoice,StepFootage,StepMusic,StepRender}.tsx
src/views/studio/components/{BrandPanel,FootagePreview}.tsx
src/app/studio/page.tsx                  # sửa: hiện StudioApp
(xoá ở task 12) DevRenderController, DevRenderPanel, /dev/dung-thu và test của chúng
tests/helpers/studioFixtures.ts
tests/client/controllers/*.test.ts
```

## Ghi chú thiết kế cần biết trước

- **Dữ liệu dùng chung:** `StudioData = { project, voice, narrations: Map<sceneId, Narration>, footage: FootageBoard, music, brand }`. Mọi thay đổi qua `session.update(fn)`. Sau mỗi `update`, session tự dọn giọng và cảnh trám của cảnh không còn trong dự án, rồi hẹn tự lưu bản nháp sau 800 ms (huỷ hẹn cũ). Bộ thương hiệu lưu riêng trong `BrandRepository`, không vào bản nháp.
- **Giọng "cũ" (stale):** `Narration.isStaleFor(scene, voice)`. Sửa chữ của cảnh hoặc đổi giọng/tốc độ làm giọng cũ đi; cảnh mới tách/gộp chưa có giọng. Bước 2 hoàn tất khi mọi cảnh có giọng không cũ.
- **Qua bước:** `canEnter(step, data)` đúng khi mọi bước đứng trước đã `stepReady`. Bước 3 và 4 luôn sẵn sàng khi bước 2 xong (cảnh trống dùng nền mặc định, không nhạc cũng được).
- **Task 1 làm xong hạng mục "để dành" quan trọng nhất của 3A/3B:** lỗi mạng, phản hồi 200 không phải JSON, hết phiên bị chuyển hướng, `AbortSignal` cho tìm cảnh trám, `probe()` có timeout.
- **Không làm ở 3C (để chặng 4):** Playwright toàn luồng, so khung với video mẫu, deploy Vercel, hạ bitrate 8→5 Mbps (quyết định của Hải).

---

### Task 1: Làm cứng dịch vụ — lỗi mạng, hết phiên, JSON hỏng, signal, probe có timeout, `userMessage`

**Files:**
- Modify: `src/client/services/apiError.ts`, `src/client/services/TtsClient.ts`, `src/client/services/StockClient.ts`, `src/client/services/MusicLibrary.ts`, `src/client/render/RenderClient.ts`, `src/client/container.ts`
- Create: `src/client/errors/userMessage.ts`
- Test: `tests/client/services/sessionAndNetwork.test.ts` (mới), `tests/client/errors/userMessage.test.ts` (mới), `tests/client/render/RenderClientProbe.test.ts` (mới)

**Interfaces:**
- Produces (`apiError.ts`): `NETWORK_MESSAGE`, `SESSION_EXPIRED_MESSAGE`, `assertSameSession(response: Response): void` (ném `ApiError(401,"AUTH",…)` khi `response.redirected`), `readJson<T>(response: Response): Promise<T>` (ném `ApiError(401…)` nếu bị chuyển hướng, `ApiError(502,"BAD_RESPONSE","Máy chủ trả về dữ liệu không đọc được")` nếu không phải JSON), `networkSafeFetch(base: typeof fetch): typeof fetch` (lỗi mạng → `ApiError(0,"NETWORK",NETWORK_MESSAGE)`, `AbortError` giữ nguyên).
- Produces (`userMessage.ts`): `userMessage(error: unknown, fallback?: string): string`, `isSessionExpired(error: unknown): boolean`.
- Produces: `StockApi.search(query, kind, options?: { page?: number; perPage?: number; signal?: AbortSignal })`; `RenderClient.probe(timeoutMs = 8000)`.

- [ ] **Step 1: Viết test (RED)**

`tests/client/services/sessionAndNetwork.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { ApiError, assertSameSession, networkSafeFetch, NETWORK_MESSAGE, readJson } from "@/client/services/apiError";
import { MusicLibrary } from "@/client/services/MusicLibrary";
import { StockClient } from "@/client/services/StockClient";
import { TtsClient } from "@/client/services/TtsClient";

function redirected(body: BodyInit | null = "<html>đăng nhập</html>"): Response {
  const res = new Response(body, { status: 200 });
  Object.defineProperty(res, "redirected", { value: true });
  return res;
}

describe("readJson", () => {
  it("đọc JSON hợp lệ", async () => {
    await expect(readJson<{ a: number }>(Response.json({ a: 1 }))).resolves.toEqual({ a: 1 });
  });

  it("thân không phải JSON thì ApiError 502 BAD_RESPONSE", async () => {
    const err = await readJson(new Response("<html></html>")).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect([err.status, err.code]).toEqual([502, "BAD_RESPONSE"]);
  });

  it("phản hồi bị chuyển hướng (trang đăng nhập) thì ApiError 401 AUTH", async () => {
    const err = await readJson(redirected()).catch((e) => e);
    expect([err.status, err.code]).toEqual([401, "AUTH"]);
    expect(() => assertSameSession(redirected())).toThrow(ApiError);
    expect(() => assertSameSession(new Response("ok"))).not.toThrow();
  });
});

describe("networkSafeFetch", () => {
  it("lỗi mạng thành ApiError NETWORK có thông báo tiếng Việt", async () => {
    const safe = networkSafeFetch(vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch);
    const err = await safe("/x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect([err.status, err.code, err.message]).toEqual([0, "NETWORK", NETWORK_MESSAGE]);
  });

  it("AbortError giữ nguyên", async () => {
    const abort = new DOMException("aborted", "AbortError");
    const safe = networkSafeFetch(vi.fn().mockRejectedValue(abort) as unknown as typeof fetch);
    await expect(safe("/x")).rejects.toBe(abort);
  });

  it("phản hồi bình thường đi qua", async () => {
    const res = new Response("ok");
    const safe = networkSafeFetch(vi.fn().mockResolvedValue(res) as unknown as typeof fetch);
    await expect(safe("/x")).resolves.toBe(res);
  });
});

describe("StockClient", () => {
  it("truyền signal cho fetch và mã hoá từ khoá tiếng Việt", async () => {
    const fetchMock = vi.fn(async () => Response.json({ items: [], warnings: [] }));
    const controller = new AbortController();
    await new StockClient(fetchMock as unknown as typeof fetch).search("xe cảnh sát", "image", { signal: controller.signal });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url, "http://x").searchParams.get("q")).toBe("xe cảnh sát");
    expect(init.signal).toBe(controller.signal);
  });

  it("không có signal thì gọi fetch đúng một đối số", async () => {
    const fetchMock = vi.fn(async () => Response.json({ items: [], warnings: [] }));
    await new StockClient(fetchMock as unknown as typeof fetch).search("a", "image");
    expect(fetchMock.mock.calls[0]).toHaveLength(1);
  });

  it("200 nhưng thân sai hình dạng thì ApiError BAD_RESPONSE", async () => {
    const client = new StockClient((async () => Response.json({ oops: true })) as unknown as typeof fetch);
    const err = await client.search("a", "image").catch((e) => e);
    expect([err.status, err.code]).toEqual([502, "BAD_RESPONSE"]);
  });

  it("thiếu warnings thì mặc định mảng rỗng", async () => {
    const client = new StockClient((async () => Response.json({ items: [] })) as unknown as typeof fetch);
    await expect(client.search("a", "image")).resolves.toEqual({ items: [], warnings: [] });
  });

  it("bị chuyển hướng thì ApiError 401", async () => {
    const client = new StockClient((async () => redirected()) as unknown as typeof fetch);
    const err = await client.search("a", "image").catch((e) => e);
    expect(err.status).toBe(401);
  });
});

describe("TtsClient và MusicLibrary khi hết phiên", () => {
  it("synthesize bị chuyển hướng thì ApiError 401", async () => {
    const client = new TtsClient((async () => redirected("xx")) as unknown as typeof fetch);
    const err = await client.synthesize("a", "v", 1).catch((e) => e);
    expect(err.status).toBe(401);
  });

  it("voices thân không phải JSON thì ApiError BAD_RESPONSE", async () => {
    const client = new TtsClient((async () => new Response("nope")) as unknown as typeof fetch);
    const err = await client.voices().catch((e) => e);
    expect(err.code).toBe("BAD_RESPONSE");
  });

  it("kho nhạc bị chuyển hướng sang trang đăng nhập thì ApiError 401, không báo sai định dạng", async () => {
    const lib = new MusicLibrary((async () => redirected()) as unknown as typeof fetch);
    const err = await lib.list().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
  });
});
```

`tests/client/errors/userMessage.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { userMessage, isSessionExpired } from "@/client/errors/userMessage";
import { ValidationError } from "@/domain/errors";
import { ApiError } from "@/client/services/apiError";
import { RenderCancelledError } from "@/client/render/errors";

describe("userMessage", () => {
  it("giữ thông báo của lỗi miền, lỗi API và huỷ dựng", () => {
    expect(userMessage(new ValidationError("Nguồn tin tối đa 80 ký tự"))).toBe("Nguồn tin tối đa 80 ký tự");
    expect(userMessage(new ApiError(429, "QUOTA", "Hết hạn mức giọng đọc"))).toBe("Hết hạn mức giọng đọc");
    expect(userMessage(new RenderCancelledError())).toBe("Đã huỷ dựng video");
  });

  it("giữ Error thường nếu thông báo đã là tiếng Việt", () => {
    expect(userMessage(new Error("Lỗi bộ dựng: không rõ"))).toBe("Lỗi bộ dựng: không rõ");
  });

  it("lỗi tiếng Anh thô hoặc giá trị lạ thì dùng thông báo chung", () => {
    expect(userMessage(new DOMException("The source image cannot be decoded", "InvalidStateError"))).toBe(
      "Có lỗi xảy ra, thử lại sau",
    );
    expect(userMessage(new TypeError("Failed to fetch"), "Không tải được")).toBe("Không tải được");
    expect(userMessage("chuỗi")).toBe("Có lỗi xảy ra, thử lại sau");
  });

  it("nhận ra hết phiên", () => {
    expect(isSessionExpired(new ApiError(401, "AUTH", "x"))).toBe(true);
    expect(isSessionExpired(new ApiError(500, "INTERNAL", "x"))).toBe(false);
    expect(isSessionExpired(new Error("x"))).toBe(false);
  });
});
```

`tests/client/render/RenderClientProbe.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { RenderClient, type WorkerLike } from "@/client/render/RenderClient";
import type { WorkerMessage, WorkerRequest } from "@/client/render/RenderJob";

class FakeWorker implements WorkerLike {
  onmessage: ((e: { data: WorkerMessage }) => void) | null = null;
  onerror: ((e: { message?: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = 0;
  postMessage(_m: WorkerRequest): void {}
  terminate(): void {
    this.terminated++;
  }
}

afterEach(() => vi.useRealTimers());

describe("RenderClient.probe", () => {
  it("trả danh sách thiếu và đóng worker một lần", async () => {
    const w = new FakeWorker();
    const p = new RenderClient(() => w).probe();
    w.onmessage?.({ data: { type: "probe-result", missing: ["Canvas 2D trong worker"] } });
    await expect(p).resolves.toEqual(["Canvas 2D trong worker"]);
    expect(w.terminated).toBe(1);
  });

  it("worker im lặng thì quá thời gian chờ và báo lỗi tiếng Việt", async () => {
    vi.useFakeTimers();
    const w = new FakeWorker();
    const p = new RenderClient(() => w).probe(1000);
    const assertion = expect(p).rejects.toThrow("Bộ dựng không phản hồi");
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(w.terminated).toBe(1);
  });

  it("onmessageerror thì reject và đóng worker", async () => {
    const w = new FakeWorker();
    const p = new RenderClient(() => w).probe();
    w.onmessageerror?.();
    await expect(p).rejects.toThrow("Bộ dựng nhận dữ liệu lỗi");
    expect(w.terminated).toBe(1);
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/services/sessionAndNetwork.test.ts tests/client/errors tests/client/render/RenderClientProbe.test.ts` → FAIL (thiếu hàm, thiếu module). Ghi dòng thất bại.

- [ ] **Step 3: Sửa `src/client/services/apiError.ts`** — giữ `ApiError` và `readApiError`, thêm vào cuối file:
```ts
export const NETWORK_MESSAGE = "Không kết nối được máy chủ, kiểm tra mạng rồi thử lại";
export const SESSION_EXPIRED_MESSAGE = "Hết phiên đăng nhập, hãy đăng nhập lại";

/** Phản hồi 200 nhưng bị proxy chuyển hướng sang trang đăng nhập: coi là hết phiên. */
export function assertSameSession(response: Response): void {
  if (response.redirected) throw new ApiError(401, "AUTH", SESSION_EXPIRED_MESSAGE);
}

export async function readJson<T>(response: Response): Promise<T> {
  assertSameSession(response);
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(502, "BAD_RESPONSE", "Máy chủ trả về dữ liệu không đọc được");
  }
}

/** Bọc fetch: lỗi mạng thành ApiError tiếng Việt; huỷ chủ động (AbortError) giữ nguyên. */
export function networkSafeFetch(base: typeof fetch): typeof fetch {
  const safe = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    try {
      return await base(...args);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new ApiError(0, "NETWORK", NETWORK_MESSAGE);
    }
  };
  return safe as typeof fetch;
}
```

- [ ] **Step 4: Sửa ba client**
  - `TtsClient.ts`: import `assertSameSession, readApiError, readJson` từ `./apiError`. `voices()`: sau `if (!response.ok) throw await readApiError(response);` trả `(await readJson<{ voices: VoiceInfo[] }>(response)).voices;`. `synthesize()`: sau kiểm `ok`, gọi `assertSameSession(response);` rồi `return response.arrayBuffer();`.
  - `StockClient.ts`: kiểu `options` thành `{ page?: number; perPage?: number; signal?: AbortSignal }` (cả trong interface `StockApi` lẫn `search`). Thay phần gọi fetch và đọc kết quả bằng:
```ts
    const url = `/api/stock/search?${params}`;
    const response = options.signal ? await this.fetchImpl(url, { signal: options.signal }) : await this.fetchImpl(url);
    if (!response.ok) throw await readApiError(response);
    const body = await readJson<Partial<StockSearchResponse>>(response);
    if (!Array.isArray(body.items)) throw new ApiError(502, "BAD_RESPONSE", "Máy chủ trả về dữ liệu không đọc được");
    return { items: body.items, warnings: Array.isArray(body.warnings) ? body.warnings : [] };
```
    (import `ApiError`, `readApiError`, `readJson` từ `./apiError`.)
  - `MusicLibrary.ts`: import `assertSameSession` từ `./apiError`; ngay sau `const response = await this.fetchImpl(this.url);` thêm `assertSameSession(response);` (giữ nguyên các kiểm tra còn lại).

- [ ] **Step 5: Tạo `src/client/errors/userMessage.ts`**
```ts
import { DomainError } from "@/domain/errors";
import { RenderCancelledError } from "@/client/render/errors";
import { ApiError } from "@/client/services/apiError";

const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/**
 * Thông báo cho người dùng. Lỗi do chính app ném ra đã là tiếng Việt thì giữ nguyên;
 * lỗi thô của trình duyệt (DOMException, TypeError "Failed to fetch"…) đổi thành thông báo chung.
 */
export function userMessage(error: unknown, fallback = "Có lỗi xảy ra, thử lại sau"): string {
  if (error instanceof DomainError || error instanceof ApiError || error instanceof RenderCancelledError) return error.message;
  if (error instanceof Error && !(error instanceof DOMException) && VIETNAMESE.test(error.message)) return error.message;
  return fallback;
}

export function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
```

- [ ] **Step 6: Sửa `RenderClient.probe`** — thay toàn bộ phương thức `probe()` bằng:
```ts
  probe(timeoutMs = 8000): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const worker = this.createWorker();
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error("Bộ dựng không phản hồi"));
      }, timeoutMs);
      const end = () => {
        clearTimeout(timer);
        worker.terminate();
      };
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === "probe-result") {
          end();
          resolve(m.missing);
        } else if (m.type === "error") {
          end();
          reject(new Error(m.message));
        }
      };
      worker.onerror = (e) => {
        end();
        reject(new Error(`Lỗi bộ dựng: ${e.message ?? "không rõ"}`));
      };
      worker.onmessageerror = () => {
        end();
        reject(new Error("Bộ dựng nhận dữ liệu lỗi"));
      };
      try {
        worker.postMessage({ type: "probe" });
      } catch {
        end();
        reject(new Error("Không gửi được dữ liệu cho bộ dựng"));
      }
    });
  }
```

- [ ] **Step 7: Sửa `container.ts`** — import `networkSafeFetch` từ `@/client/services/apiError`; trong `browserEnv()` đổi `fetch: (...args) => fetch(...args),` thành `fetch: networkSafeFetch((...args) => fetch(...args)),`.

- [ ] **Step 8: Chạy test, typecheck, lint** — `npx vitest run` → PASS (các test cũ của TtsClient/StockClient/MusicLibrary/RenderClient giữ nguyên); `npm run typecheck`, `npm run lint` sạch.

- [ ] **Step 9: Commit** (điều phối viên) — `feat(client): làm cứng lỗi mạng, hết phiên, JSON hỏng và probe có timeout`

---

### Task 2: Nền controller — `StateController`, `StudioSession`, `readiness`, fixture test

**Files:**
- Create: `src/client/controllers/StateController.ts`, `src/client/controllers/StudioSession.ts`, `src/client/controllers/readiness.ts`, `tests/helpers/studioFixtures.ts`
- Modify: `src/domain/FootageBoard.ts` (thêm `sceneIds()`), `tests/domain/FootageBoard.test.ts` (thêm test)
- Test: `tests/client/controllers/StudioSession.test.ts`, `tests/client/controllers/readiness.test.ts`

**Interfaces:**
- Consumes: `NewsProject`, `VoiceSettings`, `Narration`, `FootageBoard`, `MusicTrack`, `buildDraftBody`, `restoreDraft`, `DraftRepository`, `IdGenerator`, `userMessage`, `isSessionExpired`.
- Produces:
  - `abstract class StateController<S>`: `protected constructor(initial: S, onAuthLost?: () => void)`; `get state(): S`; `readonly subscribe = (l: () => void) => () => void` (thuộc tính mũi tên, truyền thẳng được cho `useSyncExternalStore`); `protected set(next: S)`, `protected patch(p: Partial<S>)`, `protected report(error: unknown): string` (gọi `onAuthLost` nếu hết phiên, trả `userMessage(error)`).
  - `interface BrandData { values: Record<string,string>; logo: Blob | null }`; `interface StudioData { project: NewsProject|null; voice: VoiceSettings|null; narrations: ReadonlyMap<string, Narration>; footage: FootageBoard; music: MusicTrack|null; brand: BrandData }`; `const EMPTY_STUDIO: StudioData`.
  - `class StudioSession`: `constructor(deps: SessionDeps)` với `SessionDeps = { drafts: Pick<DraftRepository,"save"|"load"|"clear">; ids: IdGenerator; schedule: (fn: () => void, ms: number) => () => void; autosaveMs?: number (mặc định 800); onSaveError?: (e: unknown) => void }`; `get state(): StudioData`; `readonly subscribe`; `update(change: (d: StudioData) => StudioData): void`; `setBrand(brand: BrandData): void` (không tự lưu); `restore(draft: DraftBody): void`; `reset(): void` (giữ `brand`); `flush(): Promise<void>`.
  - `readiness.ts`: `type StepId = "news"|"voice"|"footage"|"music"|"render"`; `STEPS: readonly {id: StepId; label: string}[]`; `staleSceneIds(data: StudioData): string[]`; `stepReady(step: StepId, data: StudioData): boolean`; `canEnter(step: StepId, data: StudioData): boolean`; `firstIncompleteStep(data: StudioData): StepId`.
  - `FootageBoard.sceneIds(): string[]`.
  - Fixture (`tests/helpers/studioFixtures.ts`): `makeProject(bodyCount = 3, ids?)` (cảnh `s1` mở đầu + `s2…`), `VOICE`, `fakeNarration(scene, voice?, durationSec?)`, `manualScheduler()`, `makeSession()`, `makeSessionWithProject(bodyCount?)`, `memoryUploads(prefix?)`, `flush()`.

- [ ] **Step 1: Test `FootageBoard.sceneIds` (thêm cuối `tests/domain/FootageBoard.test.ts`; thêm import `FallbackFootage` nếu file chưa có)**
```ts
describe("FootageBoard.sceneIds", () => {
  it("liệt kê id cảnh đã gán, theo thứ tự gán", () => {
    const board = FootageBoard.empty()
      .assign("s2", new FallbackFootage("f2"))
      .assign("s1", new FallbackFootage("f1"));
    expect(board.sceneIds()).toEqual(["s2", "s1"]);
    expect(FootageBoard.empty().sceneIds()).toEqual([]);
  });
});
```
Thêm vào `FootageBoard.ts` (ngay sau `unassignedSceneIds`):
```ts
  sceneIds(): string[] {
    return [...this.bySceneId.keys()];
  }
```

- [ ] **Step 2: Viết `tests/helpers/studioFixtures.ts`**
```ts
import { MemoryKeyValueStore } from "@/client/storage/KeyValueStore";
import { UploadRepository } from "@/client/storage/UploadRepository";
import { StudioSession } from "@/client/controllers/StudioSession";
import type { DraftBody } from "@/client/storage/ProjectDraft";
import { Narration } from "@/domain/Narration";
import { NewsProject } from "@/domain/NewsProject";
import type { Scene } from "@/domain/Scene";
import { SentenceSplitter } from "@/domain/SentenceSplitter";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { sequentialIds, type IdGenerator } from "@/domain/ids";

/** Dự án giả: 1 cảnh mở đầu (s1) + `bodyCount` cảnh thân bài (s2…). */
export function makeProject(bodyCount = 3, ids: IdGenerator = sequentialIds("s")): NewsProject {
  const text = Array.from({ length: bodyCount }, (_, i) => `Câu thân bài số ${i + 1} của bản tin.`).join(" ");
  return NewsProject.fromText(
    { text, title: "Tiêu đề bản tin", sourceCredit: "Nguồn thử", publishDate: new Date(2026, 9, 14), templateId: "theanh28" },
    new SentenceSplitter(),
    ids,
  );
}

export const VOICE = VoiceSettings.create("vi-VN-Test", 1.07);

export function fakeNarration(scene: Scene, voice: VoiceSettings = VOICE, durationSec = 1.5): Narration {
  return Narration.create({
    sceneId: scene.id,
    text: scene.text,
    audio: new Uint8Array([1, 2, 3]),
    mimeType: "audio/mpeg",
    durationSec,
    voice,
  });
}

export function manualScheduler() {
  const tasks = new Map<number, () => void>();
  let n = 0;
  return {
    schedule: (fn: () => void, _ms: number) => {
      const id = ++n;
      tasks.set(id, fn);
      return () => {
        tasks.delete(id);
      };
    },
    runAll: () => {
      const all = [...tasks.values()];
      tasks.clear();
      for (const fn of all) fn();
    },
    pending: () => tasks.size,
  };
}

export function makeSession() {
  const saves: DraftBody[] = [];
  const sched = manualScheduler();
  const session = new StudioSession({
    drafts: {
      save: async (body) => {
        saves.push(body);
      },
      load: async () => null,
      clear: async () => {},
    },
    ids: sequentialIds("n"),
    schedule: sched.schedule,
  });
  return { session, saves, sched };
}

/** Session đã có dự án `bodyCount` cảnh thân bài và giọng mặc định. */
export function makeSessionWithProject(bodyCount = 3) {
  const made = makeSession();
  const project = makeProject(bodyCount);
  made.session.update((d) => ({ ...d, project, voice: VOICE }));
  return { ...made, project };
}

export function memoryUploads(prefix = "u") {
  const store = new MemoryKeyValueStore();
  return { store, uploads: new UploadRepository(store, sequentialIds(prefix)) };
}

export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
```

- [ ] **Step 3: Viết `tests/client/controllers/StudioSession.test.ts`**
```ts
import { describe, expect, it, vi } from "vitest";
import { StudioSession } from "@/client/controllers/StudioSession";
import { FallbackFootage } from "@/domain/Footage";
import { sequentialIds } from "@/domain/ids";
import { fakeNarration, makeProject, makeSession, makeSessionWithProject, manualScheduler, VOICE } from "../../helpers/studioFixtures";

describe("StudioSession", () => {
  it("update thay state và báo cho người nghe", () => {
    const { session } = makeSession();
    const seen = vi.fn();
    session.subscribe(seen);
    session.update((d) => ({ ...d, voice: VOICE }));
    expect(session.state.voice).toBe(VOICE);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("tự lưu có trễ: nhiều update chỉ một lần lưu, huỷ hẹn cũ", async () => {
    const { session, saves, sched } = makeSessionWithProject(2);
    session.update((d) => ({ ...d, voice: VOICE }));
    expect(sched.pending()).toBe(1);
    expect(saves).toHaveLength(0);
    sched.runAll();
    await Promise.resolve();
    expect(saves).toHaveLength(1);
    expect(saves[0]?.project.scenes).toHaveLength(3);
    expect(saves[0]?.voice).toEqual(VOICE.snapshot());
  });

  it("chưa có dự án thì không hẹn lưu", () => {
    const { session, sched } = makeSession();
    session.update((d) => ({ ...d, voice: VOICE }));
    expect(sched.pending()).toBe(0);
  });

  it("dọn giọng và cảnh trám của cảnh không còn trong dự án", () => {
    const { session, project } = makeSessionWithProject(3); // s1 mở đầu, s2, s3, s4
    const [, s2, s3] = project.scenes;
    session.update((d) => ({
      ...d,
      narrations: new Map([
        [s2!.id, fakeNarration(s2!)],
        [s3!.id, fakeNarration(s3!)],
      ]),
      footage: d.footage.assign(s2!.id, new FallbackFootage("a")).assign(s3!.id, new FallbackFootage("b")),
    }));
    session.update((d) => ({ ...d, project: d.project!.mergeWithNext(s2!.id) })); // s3 biến mất
    expect([...session.state.narrations.keys()]).toEqual([s2!.id]);
    expect(session.state.footage.sceneIds()).toEqual([s2!.id]);
  });

  it("restore dựng lại dự án từ bản nháp", async () => {
    const a = makeSessionWithProject(2);
    a.session.update((d) => ({
      ...d,
      narrations: new Map([[a.project.scenes[1]!.id, fakeNarration(a.project.scenes[1]!)]]),
    }));
    await a.session.flush();
    const draft = { ...a.saves.at(-1)!, version: 1 as const, savedAt: "x" };
    const b = makeSession();
    b.session.restore(draft);
    expect(b.session.state.project?.scenes).toHaveLength(3);
    expect(b.session.state.voice?.voiceName).toBe("vi-VN-Test");
    expect(b.session.state.narrations.size).toBe(1);
  });

  it("reset xoá dự án nhưng giữ bộ thương hiệu và huỷ lưu đang hẹn", () => {
    const { session, sched } = makeSessionWithProject(1);
    session.setBrand({ values: { channelName: "KÊNH" }, logo: null });
    session.reset();
    expect(session.state.project).toBeNull();
    expect(session.state.voice).toBeNull();
    expect(session.state.brand.values).toEqual({ channelName: "KÊNH" });
    expect(sched.pending()).toBe(0);
  });

  it("setBrand không hẹn lưu bản nháp", () => {
    const { session, sched } = makeSessionWithProject(1);
    sched.runAll();
    session.setBrand({ values: {}, logo: null });
    expect(sched.pending()).toBe(0);
  });

  it("flush lưu ngay và huỷ hẹn", async () => {
    const { session, saves, sched } = makeSessionWithProject(1);
    await session.flush();
    expect(saves).toHaveLength(1);
    expect(sched.pending()).toBe(0);
  });

  it("lỗi lưu đi tới onSaveError, không ném ra ngoài", async () => {
    const sched = manualScheduler();
    const onSaveError = vi.fn();
    const session = new StudioSession({
      drafts: {
        save: async () => {
          throw new Error("đầy bộ nhớ");
        },
        load: async () => null,
        clear: async () => {},
      },
      ids: sequentialIds("n"),
      schedule: sched.schedule,
      onSaveError,
    });
    session.update((d) => ({ ...d, project: makeProject(1) }));
    await session.flush();
    expect(onSaveError).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Viết `tests/client/controllers/readiness.test.ts`**
```ts
import { describe, expect, it } from "vitest";
import { EMPTY_STUDIO } from "@/client/controllers/StudioSession";
import { canEnter, firstIncompleteStep, staleSceneIds, stepReady, STEPS } from "@/client/controllers/readiness";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { fakeNarration, makeProject, VOICE } from "../../helpers/studioFixtures";

const withProject = () => ({ ...EMPTY_STUDIO, project: makeProject(2), voice: VOICE });

describe("readiness", () => {
  it("5 bước theo thứ tự", () => {
    expect(STEPS.map((s) => s.id)).toEqual(["news", "voice", "footage", "music", "render"]);
  });

  it("chưa có dự án: chỉ vào được bước nhập tin", () => {
    expect(stepReady("news", EMPTY_STUDIO)).toBe(false);
    expect(canEnter("news", EMPTY_STUDIO)).toBe(true);
    expect(canEnter("voice", EMPTY_STUDIO)).toBe(false);
    expect(firstIncompleteStep(EMPTY_STUDIO)).toBe("news");
  });

  it("có dự án nhưng thiếu giọng: dừng ở bước giọng", () => {
    const d = withProject();
    expect(stepReady("news", d)).toBe(true);
    expect(stepReady("voice", d)).toBe(false);
    expect(staleSceneIds(d)).toEqual(["s1", "s2", "s3"]);
    expect(canEnter("footage", d)).toBe(false);
    expect(firstIncompleteStep(d)).toBe("voice");
  });

  it("đủ giọng thì mở tiếp các bước sau", () => {
    const d0 = withProject();
    const d = { ...d0, narrations: new Map(d0.project.scenes.map((s) => [s.id, fakeNarration(s)])) };
    expect(staleSceneIds(d)).toEqual([]);
    expect(stepReady("voice", d)).toBe(true);
    expect(canEnter("render", d)).toBe(true);
    expect(firstIncompleteStep(d)).toBe("render");
  });

  it("đổi tốc độ đọc hoặc sửa chữ làm giọng cũ đi", () => {
    const d0 = withProject();
    const narrations = new Map(d0.project.scenes.map((s) => [s.id, fakeNarration(s)]));
    const faster = { ...d0, narrations, voice: VoiceSettings.create(VOICE.voiceName, 1.2) };
    expect(staleSceneIds(faster)).toEqual(["s1", "s2", "s3"]);
    const edited = { ...d0, narrations, project: d0.project.updateSceneText("s2", "Câu đã sửa.") };
    expect(staleSceneIds(edited)).toEqual(["s2"]);
  });
});
```

- [ ] **Step 5: Chạy để thấy lỗi** — `npx vitest run tests/client/controllers tests/domain/FootageBoard.test.ts` → FAIL (thiếu module, thiếu `sceneIds`).

- [ ] **Step 6: Viết `src/client/controllers/StateController.ts`**
```ts
import { isSessionExpired, userMessage } from "@/client/errors/userMessage";

/** Controller có trạng thái bất biến và danh sách người nghe; View đọc `state` qua `subscribe`. */
export abstract class StateController<S> {
  private current: S;
  private readonly listeners = new Set<() => void>();

  protected constructor(
    initial: S,
    private readonly onAuthLost?: () => void,
  ) {
    this.current = initial;
  }

  get state(): S {
    return this.current;
  }

  /** Thuộc tính mũi tên để truyền thẳng cho useSyncExternalStore. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  protected set(next: S): void {
    this.current = next;
    for (const listener of [...this.listeners]) listener();
  }

  protected patch(partial: Partial<S>): void {
    this.set({ ...this.current, ...partial });
  }

  /** Đổi lỗi thành thông báo tiếng Việt; hết phiên thì báo lên trên để chuyển về trang đăng nhập. */
  protected report(error: unknown): string {
    if (isSessionExpired(error)) this.onAuthLost?.();
    return userMessage(error);
  }
}
```

- [ ] **Step 7: Viết `src/client/controllers/StudioSession.ts`**
```ts
import type { DraftRepository } from "@/client/storage/DraftRepository";
import { buildDraftBody, restoreDraft, type DraftBody } from "@/client/storage/ProjectDraft";
import { FootageBoard } from "@/domain/FootageBoard";
import type { IdGenerator } from "@/domain/ids";
import type { MusicTrack } from "@/domain/MusicTrack";
import type { Narration } from "@/domain/Narration";
import type { NewsProject } from "@/domain/NewsProject";
import type { VoiceSettings } from "@/domain/VoiceSettings";

export interface BrandData {
  values: Record<string, string>;
  logo: Blob | null;
}

export interface StudioData {
  project: NewsProject | null;
  voice: VoiceSettings | null;
  narrations: ReadonlyMap<string, Narration>;
  footage: FootageBoard;
  music: MusicTrack | null;
  brand: BrandData;
}

export const EMPTY_STUDIO: StudioData = {
  project: null,
  voice: null,
  narrations: new Map(),
  footage: FootageBoard.empty(),
  music: null,
  brand: { values: {}, logo: null },
};

export interface SessionDeps {
  drafts: Pick<DraftRepository, "save" | "load" | "clear">;
  ids: IdGenerator;
  /** Hẹn chạy `fn` sau `ms`; trả hàm huỷ hẹn. */
  schedule: (fn: () => void, ms: number) => () => void;
  autosaveMs?: number;
  onSaveError?: (error: unknown) => void;
}

/** Bỏ giọng và cảnh trám của cảnh không còn trong dự án. */
function prune(data: StudioData): StudioData {
  if (!data.project) return data;
  const ids = new Set(data.project.scenes.map((s) => s.id));
  let narrations = data.narrations;
  if ([...narrations.keys()].some((id) => !ids.has(id))) {
    narrations = new Map([...narrations].filter(([id]) => ids.has(id)));
  }
  let footage = data.footage;
  for (const id of footage.sceneIds()) if (!ids.has(id)) footage = footage.unassign(id);
  return narrations === data.narrations && footage === data.footage ? data : { ...data, narrations, footage };
}

/** Dữ liệu đang làm việc của trình 5 bước; tự lưu bản nháp sau mỗi thay đổi (có trễ). */
export class StudioSession {
  private current: StudioData = EMPTY_STUDIO;
  private readonly listeners = new Set<() => void>();
  private cancelSave: (() => void) | null = null;

  constructor(private readonly deps: SessionDeps) {}

  get state(): StudioData {
    return this.current;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  update(change: (data: StudioData) => StudioData): void {
    this.current = prune(change(this.current));
    this.notify();
    this.scheduleSave();
  }

  /** Bộ thương hiệu lưu ở BrandRepository, không vào bản nháp. */
  setBrand(brand: BrandData): void {
    this.current = { ...this.current, brand };
    this.notify();
  }

  restore(draft: DraftBody): void {
    const parts = restoreDraft(draft, this.deps.ids);
    this.current = prune({
      ...this.current,
      project: parts.project,
      voice: parts.voice,
      narrations: new Map(parts.narrations.map((n) => [n.sceneId, n])),
      footage: parts.footage,
      music: parts.music,
    });
    this.notify();
  }

  reset(): void {
    this.cancelPendingSave();
    this.current = { ...EMPTY_STUDIO, brand: this.current.brand };
    this.notify();
  }

  async flush(): Promise<void> {
    this.cancelPendingSave();
    await this.save();
  }

  private scheduleSave(): void {
    if (!this.current.project) return;
    this.cancelPendingSave();
    this.cancelSave = this.deps.schedule(() => {
      this.cancelSave = null;
      void this.save();
    }, this.deps.autosaveMs ?? 800);
  }

  private cancelPendingSave(): void {
    this.cancelSave?.();
    this.cancelSave = null;
  }

  private async save(): Promise<void> {
    const { project, voice, narrations, footage, music } = this.current;
    if (!project) return;
    try {
      await this.deps.drafts.save(buildDraftBody({ project, voice, narrations: [...narrations.values()], footage, music }));
    } catch (error) {
      this.deps.onSaveError?.(error);
    }
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
```

- [ ] **Step 8: Viết `src/client/controllers/readiness.ts`**
```ts
import type { StudioData } from "./StudioSession";

export type StepId = "news" | "voice" | "footage" | "music" | "render";

export const STEPS: readonly { id: StepId; label: string }[] = [
  { id: "news", label: "Nhập tin" },
  { id: "voice", label: "Chọn giọng" },
  { id: "footage", label: "Cảnh trám" },
  { id: "music", label: "Nhạc nền" },
  { id: "render", label: "Dựng video" },
];

/** Cảnh chưa có giọng, hoặc giọng đã cũ (sửa chữ, đổi giọng/tốc độ). */
export function staleSceneIds(data: StudioData): string[] {
  const { project, voice, narrations } = data;
  if (!project) return [];
  return project.scenes
    .filter((scene) => {
      const narration = narrations.get(scene.id);
      return !narration || !voice || narration.isStaleFor(scene, voice);
    })
    .map((scene) => scene.id);
}

export function stepReady(step: StepId, data: StudioData): boolean {
  switch (step) {
    case "news":
      return data.project !== null;
    case "voice":
      return data.project !== null && data.voice !== null && staleSceneIds(data).length === 0;
    case "footage":
    case "music":
      // Cảnh trống dùng nền mặc định; không nhạc cũng được.
      return stepReady("voice", data);
    case "render":
      return stepReady("music", data);
  }
}

/** Vào được bước `step` khi mọi bước đứng trước đã sẵn sàng. */
export function canEnter(step: StepId, data: StudioData): boolean {
  const index = STEPS.findIndex((s) => s.id === step);
  return STEPS.slice(0, index).every((s) => stepReady(s.id, data));
}

/** Bước đầu tiên chưa xong; khi giọng đã đủ thì là "render" (bước 3-4 không bắt buộc). */
export function firstIncompleteStep(data: StudioData): StepId {
  const pending = STEPS.find((s) => s.id !== "render" && !stepReady(s.id, data));
  return pending ? pending.id : "render";
}
```

- [ ] **Step 9: Chạy test, typecheck, lint** — `npx vitest run` → PASS; sạch.

- [ ] **Step 10: Commit** (điều phối viên) — `feat(controllers): nền StateController, StudioSession và điều kiện qua bước`

---

### Task 3: Bước 1 — `ProjectController`, `BrandController`, ngày nhập, tin mẫu

**Files:**
- Create: `src/client/controllers/ProjectController.ts`, `src/client/controllers/BrandController.ts`, `src/client/controllers/dateText.ts`, `src/client/sample/sampleNews.ts`
- Test: `tests/client/controllers/ProjectController.test.ts`, `tests/client/controllers/BrandController.test.ts`, `tests/client/controllers/dateText.test.ts`

**Interfaces:**
- Consumes: `StudioSession`, `StateController`, `SentenceSplitter`, `NewsProject`, `TemplateRegistry`, `BrandRepository`, `BrandKit`, `classifyUpload`, `IdGenerator`.
- Produces:
  - `dateText.ts`: `toDateInput(d: Date): string` (`yyyy-mm-dd` giờ địa phương), `fromDateInput(text: string): Date` (ném `ValidationError("Ngày đăng không hợp lệ")` nếu sai).
  - `sampleNews.ts`: `SAMPLE_NEWS = { text, sourceCredit, publishDate }` (tin Phú Thọ, lấy từ `DEV_SAMPLE` của `DevRenderController`).
  - `ProjectController extends StateController<{ error: string | null }>`: `constructor(deps: { session: StudioSession; ids: IdGenerator; splitter?: SentenceSplitter; onAuthLost?: () => void })`; `createFrom(input: { text; title?; sourceCredit; publishDate: Date; templateId }): boolean`; `createFromForm(form: { text; title?; sourceCredit; publishDateText: string; templateId }): boolean` (ngày dạng `yyyy-mm-dd` của `<input type="date">`, tiêu đề rỗng coi như không nhập); `updateMeta(meta: { sourceCredit?; publishDate?; templateId? }): boolean`; `updateMetaFromForm(form: { sourceCredit?; publishDateText?; templateId? }): boolean`; `updateSceneText(id, text): boolean`; `mergeWithNext(id): boolean`; `splitScene(id, at): boolean`. Trả `true` nếu thành công; `false` kèm `state.error` nếu lỗi. View chỉ dùng các phương thức `…Form` để không phải phân tích ngày.
  - `BrandController extends StateController<BrandPanelState>`, `BrandPanelState = { templateId: string; specs: readonly BrandFieldSpec[]; values: Record<string,string>; logo: Blob | null; error: string | null; saved: boolean }`; `constructor(deps: { session; templates: TemplateRegistry; brands: Pick<BrandRepository,"load"|"save">; onAuthLost? })`; `load(templateId): Promise<void>`; `setValue(key, value): void`; `setLogo(file: File): void`; `clearLogo(): void`; `save(): Promise<boolean>`.

- [ ] **Step 1: Viết test**

`tests/client/controllers/dateText.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { fromDateInput, toDateInput } from "@/client/controllers/dateText";

describe("dateText", () => {
  it("đi lại yyyy-mm-dd theo giờ địa phương", () => {
    expect(toDateInput(new Date(2026, 9, 14))).toBe("2026-10-14");
    const d = fromDateInput("2026-01-05");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 0, 5]);
  });

  it("từ chối ngày sai", () => {
    for (const bad of ["", "2026-13-01", "2026-02-30", "14/10/2026", "abc"]) {
      expect(() => fromDateInput(bad)).toThrow("Ngày đăng không hợp lệ");
    }
  });
});
```

`tests/client/controllers/ProjectController.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ProjectController } from "@/client/controllers/ProjectController";
import { sequentialIds } from "@/domain/ids";
import { FallbackFootage } from "@/domain/Footage";
import { fakeNarration, makeSession, VOICE } from "../../helpers/studioFixtures";

const input = {
  text: "Phú Thọ khởi tố một vụ án. Công an đã vào cuộc điều tra. Hai bị can bị bắt giữ.",
  sourceCredit: "Đức Phong - VietNamNet",
  publishDate: new Date(2026, 9, 14),
  templateId: "theanh28",
};

function setup() {
  const made = makeSession();
  const ctrl = new ProjectController({ session: made.session, ids: sequentialIds("s") });
  return { ...made, ctrl };
}

describe("ProjectController", () => {
  it("createFrom chia cảnh, câu đầu làm tiêu đề, giữ lựa chọn giọng", () => {
    const { ctrl, session } = setup();
    session.update((d) => ({ ...d, voice: VOICE }));
    expect(ctrl.createFrom(input)).toBe(true);
    const project = session.state.project!;
    expect(project.scenes.map((s) => s.role)).toEqual(["intro", "body", "body"]);
    expect(project.title).toBe("Phú Thọ khởi tố một vụ án.");
    expect(session.state.voice).toBe(VOICE);
    expect(ctrl.state.error).toBeNull();
  });

  it("tạo lại dự án thì bỏ giọng và cảnh trám của dự án trước", () => {
    const { ctrl, session } = setup();
    ctrl.createFrom(input);
    const first = session.state.project!;
    session.update((d) => ({
      ...d,
      narrations: new Map([[first.scenes[1]!.id, fakeNarration(first.scenes[1]!)]]),
      footage: d.footage.assign(first.scenes[1]!.id, new FallbackFootage("x")),
    }));
    ctrl.createFrom({ ...input, text: "Một tin khác hoàn toàn. Câu thứ hai của tin." });
    expect(session.state.narrations.size).toBe(0);
    expect(session.state.footage.sceneIds()).toEqual([]);
  });

  it("dữ liệu sai thì trả false và báo lỗi tiếng Việt, không đổi dự án", () => {
    const { ctrl, session } = setup();
    expect(ctrl.createFrom({ ...input, text: "   " })).toBe(false);
    expect(ctrl.state.error).toBe("Chưa có nội dung tin");
    expect(session.state.project).toBeNull();
    expect(ctrl.createFrom({ ...input, sourceCredit: "x".repeat(81) })).toBe(false);
    expect(ctrl.state.error).toBe("Nguồn tin tối đa 80 ký tự");
  });

  it("sửa chữ, gộp, tách cảnh; chưa có dự án thì báo lỗi", () => {
    const { ctrl, session } = setup();
    expect(ctrl.updateSceneText("s1", "x")).toBe(false);
    expect(ctrl.state.error).toBe("Chưa có dự án");
    ctrl.createFrom(input);
    const [, a, b] = session.state.project!.scenes;
    expect(ctrl.updateSceneText(a!.id, "Câu đã sửa.")).toBe(true);
    expect(session.state.project!.sceneById(a!.id).text).toBe("Câu đã sửa.");
    expect(ctrl.mergeWithNext(a!.id)).toBe(true);
    expect(session.state.project!.scenes).toHaveLength(2);
    expect(session.state.project!.scenes.some((s) => s.id === b!.id)).toBe(false);
    expect(ctrl.splitScene(a!.id, 5)).toBe(true);
    expect(session.state.project!.scenes).toHaveLength(3);
    const intro = session.state.project!.introScene.id;
    expect(ctrl.mergeWithNext(intro)).toBe(false);
    expect(ctrl.state.error).toBe("Không gộp được cảnh mở đầu");
  });

  it("createFromForm nhận ngày dạng yyyy-mm-dd; tiêu đề rỗng thì lấy câu đầu; ngày sai thì báo lỗi", () => {
    const { ctrl, session } = setup();
    expect(ctrl.createFromForm({ text: input.text, title: "  ", sourceCredit: "Báo A", publishDateText: "", templateId: "theanh28" })).toBe(false);
    expect(ctrl.state.error).toBe("Ngày đăng không hợp lệ");
    expect(session.state.project).toBeNull();
    expect(
      ctrl.createFromForm({ text: input.text, title: "  ", sourceCredit: "Báo A", publishDateText: "2026-10-14", templateId: "theanh28" }),
    ).toBe(true);
    expect(session.state.project!.title).toBe("Phú Thọ khởi tố một vụ án.");
    expect(session.state.project!.formattedPublishDate()).toBe("14/10/2026");
  });

  it("updateMetaFromForm đổi ngày từ chuỗi và báo lỗi khi ngày sai", () => {
    const { ctrl, session } = setup();
    ctrl.createFrom(input);
    expect(ctrl.updateMetaFromForm({ publishDateText: "2026-02-03" })).toBe(true);
    expect(session.state.project!.formattedPublishDate()).toBe("03/02/2026");
    expect(ctrl.updateMetaFromForm({ publishDateText: "" })).toBe(false);
    expect(ctrl.state.error).toBe("Ngày đăng không hợp lệ");
    expect(session.state.project!.formattedPublishDate()).toBe("03/02/2026");
  });

  it("updateMeta đổi nguồn tin, ngày, phong cách", () => {
    const { ctrl, session } = setup();
    ctrl.createFrom(input);
    expect(ctrl.updateMeta({ sourceCredit: "Báo mới", publishDate: new Date(2026, 0, 2) })).toBe(true);
    expect(session.state.project!.sourceCredit).toBe("Báo mới");
    expect(session.state.project!.formattedPublishDate()).toBe("02/01/2026");
    expect(ctrl.updateMeta({ sourceCredit: "y".repeat(81) })).toBe(false);
    expect(session.state.project!.sourceCredit).toBe("Báo mới");
  });
});
```

`tests/client/controllers/BrandController.test.ts`:
```ts
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
    expect(ctrl.state.specs.map((s) => s.key)).toEqual(["channelName", "primaryColor", "logo"]);
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
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/controllers/dateText.test.ts tests/client/controllers/ProjectController.test.ts tests/client/controllers/BrandController.test.ts` → FAIL (thiếu module).

- [ ] **Step 3: Viết `src/client/controllers/dateText.ts`**
```ts
import { ValidationError } from "@/domain/errors";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** `yyyy-mm-dd` theo giờ địa phương, đúng định dạng của <input type="date">. */
export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromDateInput(text: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new ValidationError("Ngày đăng không hợp lệ");
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    throw new ValidationError("Ngày đăng không hợp lệ");
  }
  return date;
}
```

- [ ] **Step 4: Viết `src/client/sample/sampleNews.ts`**
```ts
/** Tin mẫu (tin Phú Thọ trong video tham chiếu) cho nút "Điền tin mẫu" ở bước 1. */
export const SAMPLE_NEWS = {
  text: [
    "Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã vì lạm quyền, tự ý bán trụ sở làm việc.",
    "Ngày 14 tháng 10, Công an tỉnh Phú Thọ cho biết đã khởi tố bị can, áp dụng biện pháp cấm đi khỏi nơi cư trú đối với hai cán bộ xã Trường Sơn.",
    "Hai bị can bị khởi tố về tội lạm quyền trong khi thi hành công vụ.",
    "Trong giai đoạn từ năm 2013 đến 2018, hai bị can đã tự ý bán tổng cộng 1.116,2 mét vuông đất thuộc các công trình công cộng cho 4 hộ dân.",
    "Tổng số tiền các bị can thu được từ việc bán đất là hơn 545 triệu đồng.",
    "Do việc bán đất không đúng thẩm quyền, các thửa đất trên phải thu hồi.",
  ].join(" "),
  sourceCredit: "Đức Phong - VietNamNet",
  publishDate: new Date(2026, 9, 14),
} as const;
```

- [ ] **Step 5: Viết `src/client/controllers/ProjectController.ts`**
```ts
import { FootageBoard } from "@/domain/FootageBoard";
import { NewsProject } from "@/domain/NewsProject";
import { SentenceSplitter } from "@/domain/SentenceSplitter";
import { ValidationError } from "@/domain/errors";
import type { IdGenerator } from "@/domain/ids";
import { fromDateInput } from "./dateText";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface ProjectControllerDeps {
  session: StudioSession;
  ids: IdGenerator;
  splitter?: SentenceSplitter;
  onAuthLost?: () => void;
}

export interface ProjectInput {
  text: string;
  title?: string;
  sourceCredit: string;
  publishDate: Date;
  templateId: string;
}

/** Bước 1: tạo dự án từ text, sửa/gộp/tách cảnh. */
export class ProjectController extends StateController<{ error: string | null }> {
  private readonly splitter: SentenceSplitter;

  constructor(private readonly deps: ProjectControllerDeps) {
    super({ error: null }, deps.onAuthLost);
    this.splitter = deps.splitter ?? new SentenceSplitter();
  }

  createFrom(input: ProjectInput): boolean {
    return this.attempt(() => {
      const project = NewsProject.fromText(input, this.splitter, this.deps.ids);
      this.deps.session.update((d) => ({
        ...d,
        project,
        narrations: new Map(),
        footage: FootageBoard.empty(),
      }));
    });
  }

  createFromForm(form: { text: string; title?: string; sourceCredit: string; publishDateText: string; templateId: string }): boolean {
    const publishDate = this.parseDate(form.publishDateText);
    if (!publishDate) return false;
    return this.createFrom({
      text: form.text,
      title: form.title?.trim() || undefined,
      sourceCredit: form.sourceCredit,
      publishDate,
      templateId: form.templateId,
    });
  }

  updateMeta(meta: { sourceCredit?: string; publishDate?: Date; templateId?: string }): boolean {
    return this.change((p) => p.withMeta(meta));
  }

  updateMetaFromForm(form: { sourceCredit?: string; publishDateText?: string; templateId?: string }): boolean {
    let publishDate: Date | undefined;
    if (form.publishDateText !== undefined) {
      const parsed = this.parseDate(form.publishDateText);
      if (!parsed) return false;
      publishDate = parsed;
    }
    return this.updateMeta({ sourceCredit: form.sourceCredit, publishDate, templateId: form.templateId });
  }

  updateSceneText(id: string, text: string): boolean {
    return this.change((p) => p.updateSceneText(id, text));
  }

  mergeWithNext(id: string): boolean {
    return this.change((p) => p.mergeWithNext(id));
  }

  splitScene(id: string, at: number): boolean {
    return this.change((p) => p.splitScene(id, at));
  }

  private parseDate(text: string): Date | null {
    try {
      return fromDateInput(text);
    } catch (error) {
      this.patch({ error: this.report(error) });
      return null;
    }
  }

  private change(fn: (project: NewsProject) => NewsProject): boolean {
    return this.attempt(() => {
      const current = this.deps.session.state.project;
      if (!current) throw new ValidationError("Chưa có dự án");
      const next = fn(current);
      this.deps.session.update((d) => ({ ...d, project: next }));
    });
  }

  private attempt(action: () => void): boolean {
    try {
      action();
      this.patch({ error: null });
      return true;
    } catch (error) {
      this.patch({ error: this.report(error) });
      return false;
    }
  }
}
```

- [ ] **Step 6: Viết `src/client/controllers/BrandController.ts`**
```ts
import { BrandKit, type BrandFieldSpec } from "@/domain/BrandKit";
import { ValidationError } from "@/domain/errors";
import { classifyUpload } from "@/client/media/UploadValidator";
import type { BrandRepository } from "@/client/storage/BrandRepository";
import type { TemplateRegistry } from "@/templates/TemplateRegistry";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export interface BrandPanelState {
  templateId: string;
  specs: readonly BrandFieldSpec[];
  values: Record<string, string>;
  logo: Blob | null;
  error: string | null;
  saved: boolean;
}

export interface BrandControllerDeps {
  session: StudioSession;
  templates: TemplateRegistry;
  brands: Pick<BrandRepository, "load" | "save">;
  onAuthLost?: () => void;
}

/** Bộ thương hiệu của một phong cách: tên kênh, màu, logo. */
export class BrandController extends StateController<BrandPanelState> {
  constructor(private readonly deps: BrandControllerDeps) {
    super({ templateId: "", specs: [], values: {}, logo: null, error: null, saved: false }, deps.onAuthLost);
  }

  async load(templateId: string): Promise<void> {
    try {
      const specs = this.deps.templates.get(templateId).brandFields;
      const stored = await this.deps.brands.load(templateId);
      const defaults = Object.fromEntries(specs.flatMap((s) => (s.defaultValue ? [[s.key, s.defaultValue]] : [])));
      const values = { ...defaults, ...(stored?.values ?? {}) };
      this.set({ templateId, specs, values, logo: stored?.logo ?? null, error: null, saved: stored !== null });
      this.push();
    } catch (error) {
      this.patch({ error: this.report(error) });
    }
  }

  setValue(key: string, value: string): void {
    this.patch({ values: { ...this.state.values, [key]: value }, saved: false });
    this.push();
  }

  setLogo(file: File): void {
    try {
      classifyUpload(file, ["image"]);
      if (file.size > MAX_LOGO_BYTES) throw new ValidationError("Logo tối đa 5 MB");
    } catch (error) {
      this.patch({ error: this.report(error) });
      return;
    }
    this.patch({ logo: file, saved: false });
    this.push();
  }

  clearLogo(): void {
    this.patch({ logo: null, saved: false });
    this.push();
  }

  async save(): Promise<boolean> {
    try {
      const kit = this.validate();
      await this.deps.brands.save(this.state.templateId, kit.toJSON().values, this.state.logo);
      this.patch({ error: null, saved: true });
      return true;
    } catch (error) {
      this.patch({ error: this.report(error) });
      return false;
    }
  }

  private validate(): BrandKit {
    return BrandKit.create(this.state.templateId, this.state.specs, this.state.values);
  }

  /** Đưa giá trị hợp lệ vào session để dựng; giá trị sai chỉ hiện lỗi, session giữ bản hợp lệ gần nhất. */
  private push(): void {
    try {
      const kit = this.validate();
      this.deps.session.setBrand({ values: kit.toJSON().values, logo: this.state.logo });
      this.patch({ error: null });
    } catch (error) {
      this.patch({ error: this.report(error) });
    }
  }
}
```

- [ ] **Step 7: Chạy test, typecheck, lint** — `npx vitest run` → PASS; sạch.

- [ ] **Step 8: Commit** (điều phối viên) — `feat(controllers): bước 1 — dự án từ text và bộ thương hiệu`

---

### Task 4: Bước 2 — `VoiceController`

**Files:**
- Create: `src/client/controllers/VoiceController.ts`
- Test: `tests/client/controllers/VoiceController.test.ts`

**Interfaces:**
- Consumes: `StudioSession`, `StateController`, `staleSceneIds`, `TtsApi`, `VoiceInfo`, `AudioDecodeService.decode` (`Pick<AudioDecodeService, "decode">`), `Narration`, `VoiceSettings`, `isSessionExpired`, `ValidationError`.
- Produces: `VoiceController extends StateController<VoiceState>` với
  `VoiceState = { voices: VoiceInfo[]; voicesLoading: boolean; error: string | null; generating: boolean; progress: { done: number; total: number } | null; failed: Record<string, string>; previewing: boolean }`;
  `constructor(deps: { session: StudioSession; tts: TtsApi; decoder: Pick<AudioDecodeService, "decode">; onAuthLost?: () => void })`;
  `loadVoices(): Promise<void>` (chọn giọng đầu tiên nếu dự án chưa có giọng); `selectVoice(name: string): void` (giữ tốc độ đang dùng); `setRate(rate: number): void`; `generate(): Promise<void>` (chỉ các cảnh chưa có giọng hoặc giọng cũ, lần lượt từng câu); `retry(sceneId: string): Promise<void>`; `cancel(): void`; `previewVoice(): Promise<Blob | null>` (đọc câu tiêu đề, trả `Blob` `audio/mpeg`).
- Quy tắc: giọng lưu là MP3 gốc + `durationSec` giải mã **chưa cắt**; kết quả về sau khi người dùng đã đổi giọng/sửa chữ thì bỏ (không lưu); lỗi một câu ghi vào `failed[sceneId]`, các câu còn lại vẫn chạy; hết phiên (401) thì dừng cả lượt.

- [ ] **Step 1: Viết test `tests/client/controllers/VoiceController.test.ts`**
```ts
import { describe, expect, it, vi } from "vitest";
import { VoiceController } from "@/client/controllers/VoiceController";
import { stepReady } from "@/client/controllers/readiness";
import { ApiError } from "@/client/services/apiError";
import type { TtsApi } from "@/client/services/TtsClient";
import { makeSessionWithProject } from "../../helpers/studioFixtures";

function setup(opts: { hold?: Promise<void> } = {}) {
  const made = makeSessionWithProject(2); // s1 mở đầu, s2, s3
  const calls: string[] = [];
  const failOn = new Set<string>();
  const tts: TtsApi = {
    voices: async () => [
      { name: "vi-VN-A", gender: "FEMALE", tier: "Edge" },
      { name: "vi-VN-B", gender: "MALE", tier: "Edge" },
    ],
    synthesize: async (text) => {
      calls.push(text);
      if (opts.hold) await opts.hold;
      if (failOn.has(text)) throw new ApiError(429, "QUOTA", "Hết hạn mức giọng đọc hôm nay, liên hệ Hải");
      return new Uint8Array([1, 2, 3, 4]).buffer;
    },
  };
  const decoder = { decode: vi.fn(async () => ({ channels: [new Float32Array(48)], sampleRate: 48000, durationSec: 1.5 })) };
  const authLost = vi.fn();
  const ctrl = new VoiceController({ session: made.session, tts, decoder, onAuthLost: authLost });
  return { ...made, ctrl, calls, failOn, authLost, decoder };
}

describe("VoiceController", () => {
  it("loadVoices nạp danh sách và chọn giọng đầu khi chưa có; giữ giọng đã chọn", async () => {
    const { ctrl, session } = setup();
    session.update((d) => ({ ...d, voice: null }));
    await ctrl.loadVoices();
    expect(ctrl.state.voices.map((v) => v.name)).toEqual(["vi-VN-A", "vi-VN-B"]);
    expect(session.state.voice?.voiceName).toBe("vi-VN-A");
    ctrl.selectVoice("vi-VN-B");
    await ctrl.loadVoices();
    expect(session.state.voice?.voiceName).toBe("vi-VN-B");
  });

  it("selectVoice giữ tốc độ; setRate đổi tốc độ và làm giọng cũ đi", async () => {
    const { ctrl, session } = setup();
    ctrl.setRate(1.2);
    ctrl.selectVoice("vi-VN-B");
    expect(session.state.voice?.speakingRate).toBe(1.2);
    ctrl.setRate(5);
    expect(ctrl.state.error).not.toBeNull();
    expect(session.state.voice?.speakingRate).toBe(1.2);
  });

  it("generate tạo giọng cho mọi cảnh, lưu MP3 gốc và độ dài chưa cắt", async () => {
    const { ctrl, session } = setup();
    await ctrl.generate();
    expect(session.state.narrations.size).toBe(3);
    const n = session.state.narrations.get("s2")!;
    expect(Array.from(n.audio)).toEqual([1, 2, 3, 4]);
    expect(n.durationSec).toBe(1.5);
    expect(ctrl.state.generating).toBe(false);
    expect(ctrl.state.progress).toBeNull();
    expect(stepReady("voice", session.state)).toBe(true);
  });

  it("chỉ tạo lại cảnh cũ: sửa chữ một cảnh thì chỉ cảnh đó đọc lại", async () => {
    const { ctrl, session, calls } = setup();
    await ctrl.generate();
    expect(calls).toHaveLength(3);
    await ctrl.generate();
    expect(calls).toHaveLength(3);
    session.update((d) => ({ ...d, project: d.project!.updateSceneText("s2", "Câu đã sửa lại.") }));
    await ctrl.generate();
    expect(calls).toHaveLength(4);
    expect(calls[3]).toBe("Câu đã sửa lại.");
  });

  it("lỗi một câu được ghi lại, các câu khác vẫn xong; retry sửa được", async () => {
    const { ctrl, session, failOn } = setup();
    const target = session.state.project!.sceneById("s2").text;
    failOn.add(target);
    await ctrl.generate();
    expect(session.state.narrations.size).toBe(2);
    expect(ctrl.state.failed).toEqual({ s2: "Hết hạn mức giọng đọc hôm nay, liên hệ Hải" });
    expect(stepReady("voice", session.state)).toBe(false);
    failOn.clear();
    await ctrl.retry("s2");
    expect(session.state.narrations.has("s2")).toBe(true);
    expect(ctrl.state.failed).toEqual({});
    expect(stepReady("voice", session.state)).toBe(true);
  });

  it("hết phiên (401) thì dừng cả lượt và báo onAuthLost một lần", async () => {
    const made = setup();
    const unauthorized: TtsApi = {
      voices: async () => [],
      synthesize: async () => {
        throw new ApiError(401, "AUTH", "Chưa đăng nhập");
      },
    };
    const ctrl = new VoiceController({ session: made.session, tts: unauthorized, decoder: made.decoder, onAuthLost: made.authLost });
    await ctrl.generate();
    expect(made.authLost).toHaveBeenCalledTimes(1);
    expect(made.session.state.narrations.size).toBe(0);
  });

  it("cancel dừng lượt đang chạy và không lưu kết quả về sau", async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    const { ctrl, session } = setup({ hold });
    const run = ctrl.generate();
    ctrl.cancel();
    release();
    await run;
    expect(session.state.narrations.size).toBe(0);
    expect(ctrl.state.generating).toBe(false);
  });

  it("kết quả về sau khi đã đổi giọng thì bỏ; các cảnh sau đọc theo giọng mới", async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    const { ctrl, session } = setup({ hold });
    const run = ctrl.generate();
    ctrl.setRate(1.25);
    release();
    await run;
    expect(session.state.narrations.has("s1")).toBe(false); // cảnh đang đọc dở theo giọng cũ bị bỏ
    expect(session.state.narrations.get("s2")?.voice.speakingRate).toBe(1.25);
    expect(session.state.narrations.get("s3")?.voice.speakingRate).toBe(1.25);
  });

  it("previewVoice đọc câu tiêu đề và trả Blob audio/mpeg", async () => {
    const { ctrl, calls } = setup();
    const blob = await ctrl.previewVoice();
    expect(blob?.type).toBe("audio/mpeg");
    expect(calls).toEqual(["Tiêu đề bản tin"]);
    expect(ctrl.state.previewing).toBe(false);
  });

  it("chưa có dự án hoặc giọng thì báo lỗi, không gọi TTS", async () => {
    const { ctrl, session, calls } = setup();
    session.update((d) => ({ ...d, voice: null }));
    await ctrl.generate();
    expect(ctrl.state.error).toBe("Chưa chọn giọng");
    expect(await ctrl.previewVoice()).toBeNull();
    expect(calls).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/controllers/VoiceController.test.ts` → FAIL (thiếu module).

- [ ] **Step 3: Viết `src/client/controllers/VoiceController.ts`**
```ts
import { isSessionExpired } from "@/client/errors/userMessage";
import type { AudioDecodeService } from "@/client/media/AudioDecodeService";
import type { TtsApi, VoiceInfo } from "@/client/services/TtsClient";
import { ValidationError } from "@/domain/errors";
import { Narration } from "@/domain/Narration";
import { VoiceSettings } from "@/domain/VoiceSettings";
import { staleSceneIds } from "./readiness";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface VoiceState {
  voices: VoiceInfo[];
  voicesLoading: boolean;
  error: string | null;
  generating: boolean;
  progress: { done: number; total: number } | null;
  failed: Record<string, string>;
  previewing: boolean;
}

export interface VoiceControllerDeps {
  session: StudioSession;
  tts: TtsApi;
  decoder: Pick<AudioDecodeService, "decode">;
  onAuthLost?: () => void;
}

const INITIAL: VoiceState = {
  voices: [],
  voicesLoading: false,
  error: null,
  generating: false,
  progress: null,
  failed: {},
  previewing: false,
};

/** Bước 2: chọn giọng, tốc độ, tạo giọng riêng cho từng câu. */
export class VoiceController extends StateController<VoiceState> {
  private cancelRequested = false;

  constructor(private readonly deps: VoiceControllerDeps) {
    super(INITIAL, deps.onAuthLost);
  }

  async loadVoices(): Promise<void> {
    this.patch({ voicesLoading: true, error: null });
    try {
      const voices = await this.deps.tts.voices();
      this.patch({ voices, voicesLoading: false });
      const first = voices[0];
      if (first && !this.deps.session.state.voice) {
        this.deps.session.update((d) => ({ ...d, voice: VoiceSettings.create(first.name) }));
      }
    } catch (error) {
      this.patch({ voicesLoading: false, error: this.report(error) });
    }
  }

  selectVoice(name: string): void {
    this.attempt(() => {
      const rate = this.deps.session.state.voice?.speakingRate ?? VoiceSettings.DEFAULT_RATE;
      const voice = VoiceSettings.create(name, rate);
      this.deps.session.update((d) => ({ ...d, voice }));
    });
  }

  setRate(rate: number): void {
    this.attempt(() => {
      const current = this.deps.session.state.voice;
      if (!current) throw new ValidationError("Chưa chọn giọng");
      const voice = current.withRate(rate);
      this.deps.session.update((d) => ({ ...d, voice }));
    });
  }

  async generate(): Promise<void> {
    if (this.state.generating) return;
    const { project, voice } = this.deps.session.state;
    if (!project) {
      this.patch({ error: "Chưa có dự án" });
      return;
    }
    if (!voice) {
      this.patch({ error: "Chưa chọn giọng" });
      return;
    }
    const todo = staleSceneIds(this.deps.session.state);
    this.cancelRequested = false;
    this.patch({ generating: true, error: null, failed: {}, progress: { done: 0, total: todo.length } });
    try {
      let done = 0;
      for (const sceneId of todo) {
        if (this.cancelRequested) break;
        const stop = await this.runScene(sceneId);
        done += 1;
        this.patch({ progress: { done, total: todo.length } });
        if (stop) break;
      }
    } finally {
      this.patch({ generating: false, progress: null });
    }
  }

  async retry(sceneId: string): Promise<void> {
    if (this.state.generating) return;
    this.cancelRequested = false;
    this.patch({ generating: true, error: null });
    try {
      await this.runScene(sceneId);
    } finally {
      this.patch({ generating: false });
    }
  }

  cancel(): void {
    this.cancelRequested = true;
  }

  async previewVoice(): Promise<Blob | null> {
    const { project, voice } = this.deps.session.state;
    if (!project || !voice) {
      this.patch({ error: voice ? "Chưa có dự án" : "Chưa chọn giọng" });
      return null;
    }
    this.patch({ previewing: true, error: null });
    try {
      const bytes = await this.deps.tts.synthesize(project.introScene.text, voice.voiceName, voice.speakingRate);
      return new Blob([bytes], { type: "audio/mpeg" });
    } catch (error) {
      this.patch({ error: this.report(error) });
      return null;
    } finally {
      this.patch({ previewing: false });
    }
  }

  /** Tạo giọng một cảnh. Trả true nếu phải dừng cả lượt (hết phiên). */
  private async runScene(sceneId: string): Promise<boolean> {
    const start = this.deps.session.state;
    const scene = start.project?.scenes.find((s) => s.id === sceneId);
    const voice = start.voice;
    if (!scene || !voice) return false;
    try {
      const bytes = await this.deps.tts.synthesize(scene.text, voice.voiceName, voice.speakingRate);
      // decode làm hỏng (detach) bộ đệm đầu vào nên đưa bản sao; bản gốc đem lưu.
      const decoded = await this.deps.decoder.decode(bytes.slice(0));
      if (this.cancelRequested) return false;
      const narration = Narration.create({
        sceneId,
        text: scene.text,
        audio: new Uint8Array(bytes),
        mimeType: "audio/mpeg",
        durationSec: decoded.durationSec,
        voice,
      });
      const now = this.deps.session.state;
      const currentScene = now.project?.scenes.find((s) => s.id === sceneId);
      if (!currentScene || !now.voice || narration.isStaleFor(currentScene, now.voice)) return false;
      this.deps.session.update((d) => ({ ...d, narrations: new Map(d.narrations).set(sceneId, narration) }));
      const { [sceneId]: _removed, ...rest } = this.state.failed;
      this.patch({ failed: rest });
      return false;
    } catch (error) {
      this.patch({ failed: { ...this.state.failed, [sceneId]: this.report(error) } });
      return isSessionExpired(error);
    }
  }

  private attempt(action: () => void): void {
    try {
      action();
      this.patch({ error: null });
    } catch (error) {
      this.patch({ error: this.report(error) });
    }
  }
}
```

- [ ] **Step 4: Chạy test, typecheck, lint** — `npx vitest run` → PASS; sạch. Nếu `VoiceSettings.create`/`withRate` ném thông báo khác kỳ vọng của test "setRate(5)", test chỉ kiểm `error` khác `null` nên không cần chỉnh.

- [ ] **Step 5: Commit** (điều phối viên) — `feat(controllers): bước 2 — chọn giọng và tạo giọng từng câu`

---

### Task 5: Bước 3 (phần 1) — `FootageController`: tải file lên, gán, hoán đổi

**Files:**
- Create: `src/client/controllers/FootageController.ts`
- Test: `tests/client/controllers/FootageController.test.ts`

**Interfaces:**
- Consumes: `StudioSession`, `StateController`, `classifyUpload`, `UploadRepository` (`Pick<UploadRepository, "put">`), `MediaProbe`, `uploadToFootage`, `Footage`, `IdGenerator`.
- Produces: `FootageController extends StateController<{ busy: boolean; error: string | null; added: Footage[] }>`; `constructor(deps: { session; uploads: Pick<UploadRepository,"put"|"get">; probe: MediaProbe; ids: IdGenerator; onAuthLost?: () => void })`;
  `previewSource(footage: Footage | undefined): Promise<string | Blob | null>` — nguồn để View xem trước: URL (cảnh trám stock), `Blob` (file tải lên), `null` (chưa gán / nền mặc định / không tìm thấy file);
  `addFiles(files: readonly File[]): Promise<void>` — kiểm bằng `classifyUpload(file, ["image","video"])`, dò kích thước/độ dài, lưu `UploadRepository`, rồi gán **lần lượt** vào các cảnh chưa có cảnh trám (`FootageBoard.fillInOrder`); file lỗi không chặn file tốt, thông báo gộp theo tên file;
  `replaceWithFile(sceneId: string, file: File): Promise<void>` — gán file đó cho đúng cảnh (ghi đè);
  `pool(): Footage[]` — các file tải lên đã dùng/đã thêm (không trùng id); `assignFromPool(sceneId: string, footageId: string): void` (một file dùng cho nhiều cảnh); `unassign(sceneId: string): void` (về nền mặc định); `swap(a: string, b: string): void`.

- [ ] **Step 1: Viết test `tests/client/controllers/FootageController.test.ts`**
```ts
import { describe, expect, it } from "vitest";
import { FootageController } from "@/client/controllers/FootageController";
import type { MediaProbe } from "@/client/media/MediaProbe";
import { sequentialIds } from "@/domain/ids";
import { FallbackFootage, ImageFootage } from "@/domain/Footage";
import { uploadToFootage } from "@/client/media/footageFactory";
import { makeSession, makeSessionWithProject, memoryUploads } from "../../helpers/studioFixtures";

const probe: MediaProbe = {
  image: async () => ({ width: 1600, height: 900 }),
  video: async () => ({ width: 1920, height: 1080, durationSec: 12 }),
  audio: async () => ({ durationSec: 30 }),
};

const img = (name = "a.jpg") => new File([new Uint8Array(10)], name, { type: "image/jpeg" });
const vid = (name = "v.mp4") => new File([new Uint8Array(10)], name, { type: "video/mp4" });

function setup(bodyCount = 3) {
  const made = makeSessionWithProject(bodyCount); // s1 mở đầu, s2…
  const { uploads, store } = memoryUploads("u");
  const ctrl = new FootageController({ session: made.session, uploads, probe, ids: sequentialIds("f") });
  return { ...made, ctrl, uploads, store };
}

describe("FootageController", () => {
  it("addFiles lưu file và gán lần lượt vào các cảnh trống theo thứ tự", async () => {
    const { ctrl, session, store } = setup(3); // s1..s4
    await ctrl.addFiles([img("a.jpg"), img("b.jpg"), vid("c.mp4")]);
    const board = session.state.footage;
    expect(board.sceneIds()).toEqual(["s1", "s2", "s3"]);
    expect(board.get("s1")?.kind).toBe("image");
    expect(board.get("s3")?.kind).toBe("video");
    expect(board.get("s1")?.snapshot()).toMatchObject({ source: { origin: "upload", uri: "upload:upload-u1" } });
    expect(board.get("s3")?.snapshot()).toMatchObject({ kind: "video", durationSec: 12 });
    expect((await store.keys("blob:")).length).toBe(3);
    expect(ctrl.state.error).toBeNull();
    expect(ctrl.state.busy).toBe(false);
  });

  it("không ghi đè cảnh đã có cảnh trám; file thừa chỉ vào kho", async () => {
    const { ctrl, session } = setup(2); // s1..s3
    session.update((d) => ({ ...d, footage: d.footage.assign("s2", new FallbackFootage("keep")) }));
    await ctrl.addFiles([img("a.jpg"), img("b.jpg"), img("c.jpg")]);
    expect(session.state.footage.get("s2")?.id).toBe("keep");
    expect(session.state.footage.get("s1")?.snapshot()).toMatchObject({ source: { uri: "upload:upload-u1" } });
    expect(session.state.footage.get("s3")?.snapshot()).toMatchObject({ source: { uri: "upload:upload-u2" } });
    expect(ctrl.pool()).toHaveLength(3);
  });

  it("file lỗi không chặn file tốt, thông báo nêu tên file", async () => {
    const { ctrl, session } = setup(2);
    await ctrl.addFiles([new File(["x"], "bad.gif", { type: "image/gif" }), img("ok.jpg")]);
    expect(session.state.footage.sceneIds()).toEqual(["s1"]);
    expect(ctrl.state.error).toBe("bad.gif: Định dạng không được hỗ trợ: gif");
  });

  it("chặn file quá lớn trước khi lưu", async () => {
    const { ctrl, session, store } = setup(1);
    await ctrl.addFiles([new File([new Uint8Array(20 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" })]);
    expect(ctrl.state.error).toBe("big.jpg: File quá lớn (tối đa 20 MB cho ảnh)");
    expect(session.state.footage.sceneIds()).toEqual([]);
    expect(await store.keys("blob:")).toEqual([]);
  });

  it("replaceWithFile ghi đè đúng cảnh được chọn", async () => {
    const { ctrl, session } = setup(2);
    session.update((d) => ({ ...d, footage: d.footage.assign("s2", new FallbackFootage("old")) }));
    await ctrl.replaceWithFile("s2", vid("new.mp4"));
    expect(session.state.footage.get("s2")?.kind).toBe("video");
    expect(session.state.footage.get("s1")).toBeUndefined();
  });

  it("một file dùng cho nhiều cảnh qua assignFromPool", async () => {
    const { ctrl, session } = setup(2);
    await ctrl.addFiles([img("a.jpg")]);
    const footage = ctrl.pool()[0]!;
    ctrl.assignFromPool("s3", footage.id);
    expect(session.state.footage.get("s3")).toBe(footage);
    expect(session.state.footage.get("s1")).toBe(footage);
    ctrl.assignFromPool("s2", "khong-co");
    expect(ctrl.state.error).toBe("Không tìm thấy file trong danh sách đã tải lên");
  });

  it("pool gồm cả file tải lên đang nằm trong bảng cảnh trám (sau khi mở lại bản nháp)", async () => {
    const { ctrl, session } = setup(1);
    await ctrl.addFiles([img("a.jpg")]);
    const restored = new FootageController({
      session,
      uploads: memoryUploads("z").uploads,
      probe,
      ids: sequentialIds("g"),
    });
    expect(restored.pool().map((f) => f.id)).toEqual([session.state.footage.get("s1")!.id]);
  });

  it("unassign và swap", async () => {
    const { ctrl, session } = setup(2);
    await ctrl.addFiles([img("a.jpg"), vid("b.mp4")]);
    const [a, b] = [session.state.footage.get("s1"), session.state.footage.get("s2")];
    ctrl.swap("s1", "s2");
    expect(session.state.footage.get("s1")).toBe(b);
    expect(session.state.footage.get("s2")).toBe(a);
    ctrl.unassign("s1");
    expect(session.state.footage.get("s1")).toBeUndefined();
  });

  it("chưa có dự án thì báo lỗi", async () => {
    const made = makeSession();
    const ctrl = new FootageController({ session: made.session, uploads: memoryUploads().uploads, probe, ids: sequentialIds("f") });
    await ctrl.addFiles([img()]);
    expect(ctrl.state.error).toBe("Chưa có dự án");
  });

  it("previewSource: URL cho stock, Blob cho file tải lên, null cho nền mặc định hoặc file đã mất", async () => {
    const { ctrl, session } = setup(1);
    await ctrl.addFiles([img("a.jpg")]);
    const own = session.state.footage.get("s1");
    const blob = await ctrl.previewSource(own);
    expect(blob).toBeInstanceOf(Blob);
    expect((blob as Blob).size).toBe(10);
    const stock = new ImageFootage("st", { origin: "pexels", uri: "https://cdn/x.jpg" }, 10, 10);
    expect(await ctrl.previewSource(stock)).toBe("https://cdn/x.jpg");
    expect(await ctrl.previewSource(new FallbackFootage("fb"))).toBeNull();
    expect(await ctrl.previewSource(undefined)).toBeNull();
    const lost = uploadToFootage("g", "upload-khong-co", "image", { width: 10, height: 10 });
    expect(await ctrl.previewSource(lost)).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/controllers/FootageController.test.ts` → FAIL (thiếu module).

- [ ] **Step 3: Viết `src/client/controllers/FootageController.ts`**
```ts
import { classifyUpload } from "@/client/media/UploadValidator";
import { parseUploadUri, uploadToFootage } from "@/client/media/footageFactory";
import type { MediaProbe } from "@/client/media/MediaProbe";
import type { UploadRepository } from "@/client/storage/UploadRepository";
import { ValidationError } from "@/domain/errors";
import type { Footage } from "@/domain/Footage";
import type { IdGenerator } from "@/domain/ids";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface FootageState {
  busy: boolean;
  error: string | null;
  /** Footage tạo từ file tải lên trong phiên này (nằm trong "kho" để dùng lại cho nhiều cảnh). */
  added: Footage[];
}

export interface FootageControllerDeps {
  session: StudioSession;
  uploads: Pick<UploadRepository, "put" | "get">;
  probe: MediaProbe;
  ids: IdGenerator;
  onAuthLost?: () => void;
}

/** Bước 3 (phần tải lên): file của người dùng, gán lần lượt, thay thế, hoán đổi. */
export class FootageController extends StateController<FootageState> {
  constructor(private readonly deps: FootageControllerDeps) {
    super({ busy: false, error: null, added: [] }, deps.onAuthLost);
  }

  async addFiles(files: readonly File[]): Promise<void> {
    const project = this.deps.session.state.project;
    if (!project) {
      this.patch({ error: "Chưa có dự án" });
      return;
    }
    const { footages, errors } = await this.ingest(files);
    if (footages.length > 0) {
      const sceneIds = project.scenes.map((s) => s.id);
      this.deps.session.update((d) => ({ ...d, footage: d.footage.fillInOrder(sceneIds, footages) }));
    }
    this.patch({ error: errors.length ? errors.join("; ") : null });
  }

  async replaceWithFile(sceneId: string, file: File): Promise<void> {
    if (!this.deps.session.state.project) {
      this.patch({ error: "Chưa có dự án" });
      return;
    }
    const { footages, errors } = await this.ingest([file]);
    const footage = footages[0];
    if (footage) this.deps.session.update((d) => ({ ...d, footage: d.footage.assign(sceneId, footage) }));
    this.patch({ error: errors.length ? errors.join("; ") : null });
  }

  /** File tải lên đã thêm trong phiên + file tải lên đang nằm trong bảng cảnh trám, không trùng id. */
  pool(): Footage[] {
    const byId = new Map<string, Footage>();
    for (const f of this.state.added) byId.set(f.id, f);
    const board = this.deps.session.state.footage;
    for (const sceneId of board.sceneIds()) {
      const f = board.get(sceneId);
      const snap = f?.snapshot();
      if (f && snap && snap.kind !== "fallback" && snap.source.origin === "upload") byId.set(f.id, f);
    }
    return [...byId.values()];
  }

  assignFromPool(sceneId: string, footageId: string): void {
    const footage = this.pool().find((f) => f.id === footageId);
    if (!footage) {
      this.patch({ error: "Không tìm thấy file trong danh sách đã tải lên" });
      return;
    }
    this.deps.session.update((d) => ({ ...d, footage: d.footage.assign(sceneId, footage) }));
    this.patch({ error: null });
  }

  /** Nguồn xem trước: URL (stock), Blob (file tải lên), null (chưa gán, nền mặc định hoặc file đã mất). */
  async previewSource(footage: Footage | undefined): Promise<string | Blob | null> {
    const snap = footage?.snapshot();
    if (!snap || snap.kind === "fallback") return null;
    if (snap.source.origin !== "upload") return snap.source.uri;
    const id = parseUploadUri(snap.source.uri);
    const stored = id ? await this.deps.uploads.get(id) : null;
    return stored?.blob ?? null;
  }

  unassign(sceneId: string): void {
    this.deps.session.update((d) => ({ ...d, footage: d.footage.unassign(sceneId) }));
  }

  swap(a: string, b: string): void {
    this.deps.session.update((d) => ({ ...d, footage: d.footage.swap(a, b) }));
  }

  private async ingest(files: readonly File[]): Promise<{ footages: Footage[]; errors: string[] }> {
    this.patch({ busy: true });
    const footages: Footage[] = [];
    const errors: string[] = [];
    try {
      for (const file of files) {
        try {
          const kind = classifyUpload(file, ["image", "video"]);
          if (kind === "audio") throw new ValidationError("Không nhận file nhạc ở đây");
          const info = kind === "image" ? await this.deps.probe.image(file) : await this.deps.probe.video(file);
          const meta = await this.deps.uploads.put(file, { name: file.name, kind });
          footages.push(uploadToFootage(this.deps.ids(), meta.id, kind, info));
        } catch (error) {
          errors.push(`${file.name}: ${this.report(error)}`);
        }
      }
      if (footages.length > 0) this.patch({ added: [...this.state.added, ...footages] });
    } finally {
      this.patch({ busy: false });
    }
    return { footages, errors };
  }
}
```

- [ ] **Step 4: Chạy test, typecheck, lint** — `npx vitest run` → PASS; sạch.

- [ ] **Step 5: Commit** (điều phối viên) — `feat(controllers): bước 3 — tải file lên, gán lần lượt, thay thế, hoán đổi`

---

### Task 6: Bước 3 (phần 2) — `FootageSearchController`: tự tìm cảnh trám trên Pexels/Pixabay

**Files:**
- Create: `src/client/controllers/FootageSearchController.ts`
- Test: `tests/client/controllers/FootageSearchController.test.ts`

**Interfaces:**
- Consumes: `StudioSession`, `StateController`, `StockApi`, `StockItemDto`, `stockItemToFootage`, `TemplateRegistry` (`Pick<TemplateRegistry,"get">`), `IdGenerator`.
- Produces: `interface KeywordSource { suggest(sentence: string, maxQueries?: number): string[] }`; `interface SceneSearch { query: string; loading: boolean; items: StockItemDto[]; error: string | null; empty: boolean }`; `FootageSearchController extends StateController<{ byScene: Record<string, SceneSearch>; autoRunning: boolean; warnings: string[] }>`; `constructor(deps: { session; stock: StockApi; keywords: (fallback: string) => KeywordSource; templates: Pick<TemplateRegistry,"get">; ids: IdGenerator; concurrency?: number (mặc định 3); onAuthLost? })`;
  `autoFill(): Promise<void>` — mỗi cảnh chưa có cảnh trám: thử lần lượt tối đa 3 cụm từ khoá đoán từ câu, mỗi cụm tìm cả ảnh và video, gộp xen kẽ (ảnh trước) tối đa 8, tự chọn kết quả đầu **chưa dùng ở cảnh khác**; không có kết quả thì giữ trống (`empty: true`, nền mặc định);
  `search(sceneId: string, query: string): Promise<void>` (từ khoá người dùng sửa); `choose(sceneId: string, item: StockItemDto): void`; `cancel(): void` (huỷ mọi yêu cầu đang bay bằng `AbortSignal`).
- Quy tắc: một nguồn lỗi (ví dụ chỉ video lỗi) không làm mất kết quả của nguồn kia; lỗi một cảnh không dừng cảnh khác; cảnh báo của server (hết lượt Pexels/Pixabay) gom vào `warnings`, không trùng; hết phiên (401) báo `onAuthLost`; từ khoá trống báo "Hãy nhập từ khoá".

- [ ] **Step 1: Viết test `tests/client/controllers/FootageSearchController.test.ts`**
```ts
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
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/controllers/FootageSearchController.test.ts` → FAIL (thiếu module).

- [ ] **Step 3: Viết `src/client/controllers/FootageSearchController.ts`**
```ts
import { stockItemToFootage } from "@/client/media/footageFactory";
import type { StockApi, StockItemDto } from "@/client/services/StockClient";
import { isSessionExpired } from "@/client/errors/userMessage";
import type { Footage } from "@/domain/Footage";
import type { IdGenerator } from "@/domain/ids";
import type { TemplateRegistry } from "@/templates/TemplateRegistry";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface KeywordSource {
  suggest(sentence: string, maxQueries?: number): string[];
}

export interface SceneSearch {
  query: string;
  loading: boolean;
  items: StockItemDto[];
  error: string | null;
  empty: boolean;
}

export interface FootageSearchState {
  byScene: Record<string, SceneSearch>;
  autoRunning: boolean;
  warnings: string[];
}

export interface FootageSearchDeps {
  session: StudioSession;
  stock: StockApi;
  keywords: (fallback: string) => KeywordSource;
  templates: Pick<TemplateRegistry, "get">;
  ids: IdGenerator;
  concurrency?: number;
  onAuthLost?: () => void;
}

const MAX_CANDIDATES = 8;
const MAX_PHRASES = 3;

/** Gộp xen kẽ ảnh và video (ảnh trước), bỏ trùng, tối đa `limit`. */
export function interleave(images: StockItemDto[], videos: StockItemDto[], limit = MAX_CANDIDATES): StockItemDto[] {
  const out: StockItemDto[] = [];
  const seen = new Set<string>();
  const push = (it: StockItemDto | undefined) => {
    if (!it || out.length >= limit) return;
    const key = `${it.provider}:${it.kind}:${it.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(it);
  };
  for (let i = 0; out.length < limit && (i < images.length || i < videos.length); i++) {
    push(images[i]);
    push(videos[i]);
  }
  return out;
}

async function runPool<T>(items: readonly T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await fn(items[index] as T);
    }
  });
  await Promise.all(workers);
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

function uriOf(footage: Footage | undefined): string | null {
  if (!footage) return null;
  const snap = footage.snapshot();
  return snap.kind === "fallback" ? null : snap.source.uri;
}

/** Bước 3 (phần tìm kiếm): đoán từ khoá, tìm Pexels/Pixabay, tự chọn và cho chọn lại. */
export class FootageSearchController extends StateController<FootageSearchState> {
  private readonly inflight = new Map<string, AbortController>();
  private readonly suggesters = new Map<string, KeywordSource>();
  private cancelled = false;

  constructor(private readonly deps: FootageSearchDeps) {
    super({ byScene: {}, autoRunning: false, warnings: [] }, deps.onAuthLost);
  }

  async autoFill(): Promise<void> {
    if (this.state.autoRunning) return;
    this.cancelled = false;
    const { project, footage } = this.deps.session.state;
    if (!project) return;
    const todo = footage.unassignedSceneIds(project.scenes.map((s) => s.id));
    this.patch({ autoRunning: true, warnings: [] });
    try {
      await runPool(todo, this.deps.concurrency ?? 3, (sceneId) => this.fillScene(sceneId));
    } finally {
      this.patch({ autoRunning: false });
    }
  }

  async search(sceneId: string, query: string): Promise<void> {
    this.cancelled = false;
    const text = query.trim();
    if (!text) {
      this.setScene(sceneId, { query: "", loading: false, items: [], error: "Hãy nhập từ khoá", empty: false });
      return;
    }
    const signal = this.begin(sceneId);
    this.setScene(sceneId, { query: text, loading: true, items: [], error: null, empty: false });
    try {
      const items = await this.query(text, signal);
      this.setScene(sceneId, { query: text, loading: false, items, error: null, empty: items.length === 0 });
    } catch (error) {
      this.failScene(sceneId, text, error);
    }
  }

  choose(sceneId: string, item: StockItemDto): void {
    try {
      const footage = stockItemToFootage(item, this.deps.ids());
      this.deps.session.update((d) => ({ ...d, footage: d.footage.assign(sceneId, footage) }));
      this.patchScene(sceneId, { error: null });
    } catch (error) {
      this.patchScene(sceneId, { error: this.report(error) });
    }
  }

  /** Dừng cả lượt: huỷ yêu cầu đang bay và không nhận thêm cảnh mới. */
  cancel(): void {
    this.cancelled = true;
    for (const controller of this.inflight.values()) controller.abort();
    this.inflight.clear();
  }

  private async fillScene(sceneId: string): Promise<void> {
    if (this.cancelled) return;
    const { project } = this.deps.session.state;
    const scene = project?.scenes.find((s) => s.id === sceneId);
    if (!project || !scene) return;
    const fallback = this.deps.templates.get(project.templateId).defaults.fallbackKeyword;
    const phrases = this.suggester(fallback).suggest(scene.text, MAX_PHRASES);
    const first = phrases[0] ?? fallback;
    const signal = this.begin(sceneId);
    this.setScene(sceneId, { query: first, loading: true, items: [], error: null, empty: false });
    try {
      for (const phrase of phrases) {
        const items = await this.query(phrase, signal);
        if (items.length > 0) {
          this.setScene(sceneId, { query: phrase, loading: false, items, error: null, empty: false });
          this.pickFirstUnused(sceneId, items);
          return;
        }
      }
      this.setScene(sceneId, { query: first, loading: false, items: [], error: null, empty: true });
    } catch (error) {
      this.failScene(sceneId, first, error);
    }
  }

  /** Tìm ảnh và video song song; một nguồn lỗi thì dùng nguồn còn lại, cả hai lỗi thì ném lỗi đầu. */
  private async query(query: string, signal: AbortSignal): Promise<StockItemDto[]> {
    const [images, videos] = await Promise.allSettled([
      this.deps.stock.search(query, "image", { signal, perPage: MAX_CANDIDATES }),
      this.deps.stock.search(query, "video", { signal, perPage: MAX_CANDIDATES }),
    ]);
    if (images.status === "rejected" && videos.status === "rejected") throw images.reason;
    const warnings = [images, videos].flatMap((r) => (r.status === "fulfilled" ? r.value.warnings : []));
    if (warnings.length > 0) this.addWarnings(warnings);
    const imageItems = images.status === "fulfilled" ? images.value.items : [];
    const videoItems = videos.status === "fulfilled" ? videos.value.items : [];
    return interleave(imageItems, videoItems);
  }

  private pickFirstUnused(sceneId: string, items: StockItemDto[]): void {
    const board = this.deps.session.state.footage;
    if (board.get(sceneId)) return; // người dùng đã gán cảnh này trong lúc chờ
    const used = new Set(board.sceneIds().map((id) => uriOf(board.get(id))));
    const pick = items.find((it) => !used.has(it.fullUrl)) ?? items[0];
    if (pick) this.choose(sceneId, pick);
  }

  private suggester(fallback: string): KeywordSource {
    let source = this.suggesters.get(fallback);
    if (!source) {
      source = this.deps.keywords(fallback);
      this.suggesters.set(fallback, source);
    }
    return source;
  }

  private begin(sceneId: string): AbortSignal {
    this.inflight.get(sceneId)?.abort();
    const controller = new AbortController();
    this.inflight.set(sceneId, controller);
    return controller.signal;
  }

  private failScene(sceneId: string, query: string, error: unknown): void {
    if (isAbort(error)) {
      this.patchScene(sceneId, { loading: false });
      return;
    }
    if (isSessionExpired(error)) this.cancel();
    this.setScene(sceneId, { query, loading: false, items: [], error: this.report(error), empty: false });
  }

  private addWarnings(more: string[]): void {
    const merged = [...new Set([...this.state.warnings, ...more])];
    if (merged.length !== this.state.warnings.length) this.patch({ warnings: merged });
  }

  private setScene(sceneId: string, value: SceneSearch): void {
    this.patch({ byScene: { ...this.state.byScene, [sceneId]: value } });
  }

  private patchScene(sceneId: string, partial: Partial<SceneSearch>): void {
    const current = this.state.byScene[sceneId] ?? { query: "", loading: false, items: [], error: null, empty: false };
    this.setScene(sceneId, { ...current, ...partial });
  }
}
```

- [ ] **Step 4: Chạy test, typecheck, lint** — `npx vitest run` → PASS; sạch. (Test "cancel": `autoFill` chạy tuần tự vì `concurrency: 1`; yêu cầu của cảnh đầu bị huỷ, các cảnh sau bị bỏ qua nhờ cờ `cancelled`.)

- [ ] **Step 5: Commit** (điều phối viên) — `feat(controllers): bước 3 — tự tìm cảnh trám trên Pexels và Pixabay`

---

### Task 7: Bước 4 — `TrackSource` và `MusicController`

**Files:**
- Create: `src/client/services/TrackSource.ts`, `src/client/controllers/MusicController.ts`
- Modify: `src/client/container.ts` (thêm `tracks: TrackSource` vào `ClientServices`), `tests/client/container.test.ts` (thêm một test)
- Test: `tests/client/services/TrackSource.test.ts`, `tests/client/controllers/MusicController.test.ts`

**Interfaces:**
- Consumes: `MusicTrack`, `MusicLibrary` (`Pick<MusicLibrary,"list">`), `UploadRepository`, `MediaProbe`, `classifyUpload`, `uploadUri`, `parseUploadUri`, `assertSameSession`, `ApiError`, `StudioSession`, `StateController`.
- Produces:
  - `TrackSource`: `constructor(fetchImpl: typeof fetch, uploads: Pick<UploadRepository,"get">)`; `blob(track: MusicTrack): Promise<Blob>` (nhạc kho: tải từ `track.uri`, hết phiên → `ApiError 401`, lỗi HTTP → `ApiError(status,"TRACK","Không tải được nhạc nền")`; nhạc tải lên: đọc `UploadRepository`, thiếu → `ValidationError("Không tìm thấy file nhạc đã tải lên, hãy chọn lại")`); `bytes(track: MusicTrack): Promise<ArrayBuffer>`.
  - `MusicController extends StateController<{ library: MusicTrack[]; uploaded: MusicTrack[]; loading: boolean; busy: boolean; error: string | null }>`; `constructor(deps: { session; library: Pick<MusicLibrary,"list">; uploads: Pick<UploadRepository,"put">; tracks: Pick<TrackSource,"blob">; probe: MediaProbe; onAuthLost?: () => void })`; `previewBlob(track: MusicTrack): Promise<Blob | null>` (để View nghe thử; lỗi thì `null` kèm `state.error`); `loadLibrary(): Promise<void>`; `choose(track: MusicTrack): void` (giữ mức chỉnh ±dB đang dùng); `none(): void`; `setGainOffset(db: number): void`; `uploadTrack(file: File): Promise<void>` (chỉ nhận nhạc ≤ 30 MB, kiểm giải mã được, lưu, tự chọn).
  - `ClientServices.tracks: TrackSource` (tạo từ `env.fetch` và `UploadRepository` đã có trong container).

- [ ] **Step 1: Viết test**

`tests/client/services/TrackSource.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ApiError } from "@/client/services/apiError";
import { TrackSource } from "@/client/services/TrackSource";
import { uploadUri } from "@/client/media/footageFactory";
import { MusicTrack } from "@/domain/MusicTrack";
import { memoryUploads } from "../../helpers/studioFixtures";

const lib = MusicTrack.create({ id: "m1", title: "M1", origin: "library", uri: "/music/m1.mp3" });

describe("TrackSource", () => {
  it("nhạc kho: tải từ uri và trả bytes", async () => {
    const { uploads } = memoryUploads();
    const fetchMock = async (url: RequestInfo | URL) => {
      expect(String(url)).toBe("/music/m1.mp3");
      return new Response(new Uint8Array([9, 8, 7]));
    };
    const source = new TrackSource(fetchMock as unknown as typeof fetch, uploads);
    expect(new Uint8Array(await source.bytes(lib))).toEqual(new Uint8Array([9, 8, 7]));
  });

  it("nhạc kho: lỗi HTTP và hết phiên thành ApiError", async () => {
    const { uploads } = memoryUploads();
    const notFound = new TrackSource((async () => new Response("", { status: 404 })) as unknown as typeof fetch, uploads);
    const err = await notFound.blob(lib).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect([err.status, err.message]).toEqual([404, "Không tải được nhạc nền"]);

    const redirected = new Response("<html>", { status: 200 });
    Object.defineProperty(redirected, "redirected", { value: true });
    const expired = new TrackSource((async () => redirected) as unknown as typeof fetch, uploads);
    expect((await expired.blob(lib).catch((e) => e)).status).toBe(401);
  });

  it("nhạc tải lên: đọc từ kho tải lên; thiếu thì báo bằng tiếng Việt", async () => {
    const { uploads } = memoryUploads();
    const meta = await uploads.put(new Blob([new Uint8Array([1, 2])]), { name: "x.mp3", kind: "audio" });
    const source = new TrackSource((async () => new Response("")) as unknown as typeof fetch, uploads);
    const track = MusicTrack.create({ id: meta.id, title: "x", origin: "upload", uri: uploadUri(meta.id) });
    expect((await source.blob(track)).size).toBe(2);
    const missing = MusicTrack.create({ id: "u9", title: "y", origin: "upload", uri: uploadUri("upload-khong-co") });
    await expect(source.blob(missing)).rejects.toThrow("Không tìm thấy file nhạc đã tải lên, hãy chọn lại");
  });
});
```

`tests/client/controllers/MusicController.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { MusicController } from "@/client/controllers/MusicController";
import type { MediaProbe } from "@/client/media/MediaProbe";
import { ApiError } from "@/client/services/apiError";
import { MusicTrack } from "@/domain/MusicTrack";
import { makeSessionWithProject, memoryUploads } from "../../helpers/studioFixtures";

const tracks = [
  MusicTrack.create({ id: "a", title: "Bản A", origin: "library", uri: "/music/a.mp3" }),
  MusicTrack.create({ id: "b", title: "Bản B", origin: "library", uri: "/music/b.mp3" }),
];

function setup(probe: Partial<MediaProbe> = {}) {
  const made = makeSessionWithProject(1);
  const { uploads, store } = memoryUploads("m");
  const fullProbe: MediaProbe = {
    image: async () => ({ width: 1, height: 1 }),
    video: async () => ({ width: 1, height: 1, durationSec: 1 }),
    audio: async () => ({ durationSec: 30 }),
    ...probe,
  };
  const trackSource = {
    blob: async (t: MusicTrack) => {
      if (t.id === "b") throw new ApiError(404, "TRACK", "Không tải được nhạc nền");
      return new Blob(["mp3"]);
    },
  };
  const ctrl = new MusicController({
    session: made.session,
    library: { list: async () => tracks },
    uploads,
    tracks: trackSource,
    probe: fullProbe,
  });
  return { ...made, ctrl, store };
}

const mp3 = (name = "nhac.mp3", size = 10) => new File([new Uint8Array(size)], name, { type: "audio/mpeg" });

describe("MusicController", () => {
  it("loadLibrary nạp kho nhạc", async () => {
    const { ctrl } = setup();
    await ctrl.loadLibrary();
    expect(ctrl.state.library.map((t) => t.id)).toEqual(["a", "b"]);
    expect(ctrl.state.loading).toBe(false);
  });

  it("previewBlob trả Blob để nghe thử; lỗi thì null kèm thông báo", async () => {
    const { ctrl } = setup();
    expect(await ctrl.previewBlob(tracks[0]!)).toBeInstanceOf(Blob);
    expect(ctrl.state.error).toBeNull();
    expect(await ctrl.previewBlob(tracks[1]!)).toBeNull();
    expect(ctrl.state.error).toBe("Không tải được nhạc nền");
  });

  it("choose đặt nhạc nền và giữ mức chỉnh đã đặt; none bỏ nhạc", async () => {
    const { ctrl, session } = setup();
    ctrl.choose(tracks[0]!);
    ctrl.setGainOffset(3);
    ctrl.choose(tracks[1]!);
    expect(session.state.music?.id).toBe("b");
    expect(session.state.music?.gainOffsetDb).toBe(3);
    ctrl.none();
    expect(session.state.music).toBeNull();
  });

  it("setGainOffset ngoài ±6 dB báo lỗi và giữ giá trị cũ; chưa chọn nhạc cũng báo lỗi", () => {
    const { ctrl, session } = setup();
    ctrl.setGainOffset(2);
    expect(ctrl.state.error).toBe("Chưa chọn nhạc");
    ctrl.choose(tracks[0]!);
    ctrl.setGainOffset(7);
    expect(ctrl.state.error).toBe("Chỉnh âm lượng nhạc chỉ trong khoảng ±6 dB");
    expect(session.state.music?.gainOffsetDb).toBe(0);
    ctrl.setGainOffset(-6);
    expect(ctrl.state.error).toBeNull();
    expect(session.state.music?.levelBelowVoiceDb).toBe(21);
  });

  it("uploadTrack lưu file nhạc, tạo bản nhạc origin upload và tự chọn", async () => {
    const { ctrl, session, store } = setup();
    await ctrl.uploadTrack(mp3("Nhạc nền hay.mp3"));
    expect(session.state.music?.origin).toBe("upload");
    expect(session.state.music?.title).toBe("Nhạc nền hay");
    expect(session.state.music?.uri).toBe("upload:upload-m1");
    expect(ctrl.state.uploaded).toHaveLength(1);
    expect((await store.keys("blob:")).length).toBe(1);
  });

  it("từ chối file không phải nhạc hoặc quá 30 MB, không lưu", async () => {
    const { ctrl, store } = setup();
    await ctrl.uploadTrack(new File([new Uint8Array(5)], "a.jpg", { type: "image/jpeg" }));
    expect(ctrl.state.error).toBe("Không nhận file ảnh ở đây");
    await ctrl.uploadTrack(mp3("big.mp3", 30 * 1024 * 1024 + 1));
    expect(ctrl.state.error).toBe("File quá lớn (tối đa 30 MB cho nhạc)");
    expect(await store.keys("blob:")).toEqual([]);
  });

  it("file nhạc không giải mã được thì báo lỗi chung và không lưu", async () => {
    const { ctrl, session, store } = setup({
      audio: async () => {
        throw new DOMException("Unable to decode audio data", "EncodingError");
      },
    });
    await ctrl.uploadTrack(mp3());
    expect(ctrl.state.error).toBe("Có lỗi xảy ra, thử lại sau");
    expect(session.state.music).toBeNull();
    expect(await store.keys("blob:")).toEqual([]);
  });
});
```

Thêm vào cuối `tests/client/container.test.ts`:
```ts
describe("createClientServices — tracks", () => {
  it("có TrackSource", () => {
    expect(typeof createClientServices(fakeEnv()).tracks.bytes).toBe("function");
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/services/TrackSource.test.ts tests/client/controllers/MusicController.test.ts tests/client/container.test.ts` → FAIL (thiếu module, thiếu `tracks`).

- [ ] **Step 3: Viết `src/client/services/TrackSource.ts`**
```ts
import { parseUploadUri } from "@/client/media/footageFactory";
import type { UploadRepository } from "@/client/storage/UploadRepository";
import { ValidationError } from "@/domain/errors";
import type { MusicTrack } from "@/domain/MusicTrack";
import { ApiError, assertSameSession } from "./apiError";

/** Lấy dữ liệu một bản nhạc: nhạc trong kho (tải từ máy chủ của app) hoặc nhạc người dùng tải lên. */
export class TrackSource {
  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly uploads: Pick<UploadRepository, "get">,
  ) {}

  async blob(track: MusicTrack): Promise<Blob> {
    if (track.origin === "upload") {
      const id = parseUploadUri(track.uri);
      const stored = id ? await this.uploads.get(id) : null;
      if (!stored) throw new ValidationError("Không tìm thấy file nhạc đã tải lên, hãy chọn lại");
      return stored.blob;
    }
    const response = await this.fetchImpl(track.uri);
    assertSameSession(response);
    if (!response.ok) throw new ApiError(response.status, "TRACK", "Không tải được nhạc nền");
    return response.blob();
  }

  async bytes(track: MusicTrack): Promise<ArrayBuffer> {
    return (await this.blob(track)).arrayBuffer();
  }
}
```

- [ ] **Step 4: Viết `src/client/controllers/MusicController.ts`**
```ts
import { uploadUri } from "@/client/media/footageFactory";
import type { MediaProbe } from "@/client/media/MediaProbe";
import { classifyUpload } from "@/client/media/UploadValidator";
import type { MusicLibrary } from "@/client/services/MusicLibrary";
import type { TrackSource } from "@/client/services/TrackSource";
import type { UploadRepository } from "@/client/storage/UploadRepository";
import { ValidationError } from "@/domain/errors";
import { MusicTrack } from "@/domain/MusicTrack";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface MusicState {
  library: MusicTrack[];
  uploaded: MusicTrack[];
  loading: boolean;
  busy: boolean;
  error: string | null;
}

export interface MusicControllerDeps {
  session: StudioSession;
  library: Pick<MusicLibrary, "list">;
  uploads: Pick<UploadRepository, "put">;
  tracks: Pick<TrackSource, "blob">;
  probe: MediaProbe;
  onAuthLost?: () => void;
}

/** Bước 4: chọn nhạc trong kho, tải nhạc lên, hoặc không nhạc; chỉnh âm lượng ±6 dB. */
export class MusicController extends StateController<MusicState> {
  constructor(private readonly deps: MusicControllerDeps) {
    super({ library: [], uploaded: [], loading: false, busy: false, error: null }, deps.onAuthLost);
  }

  async loadLibrary(): Promise<void> {
    this.patch({ loading: true, error: null });
    try {
      this.patch({ library: await this.deps.library.list(), loading: false });
    } catch (error) {
      this.patch({ loading: false, error: this.report(error) });
    }
  }

  /** Dữ liệu để View nghe thử (nhạc kho hoặc nhạc tải lên). */
  async previewBlob(track: MusicTrack): Promise<Blob | null> {
    try {
      const blob = await this.deps.tracks.blob(track);
      this.patch({ error: null });
      return blob;
    } catch (error) {
      this.patch({ error: this.report(error) });
      return null;
    }
  }

  choose(track: MusicTrack): void {
    const offset = this.deps.session.state.music?.gainOffsetDb ?? 0;
    try {
      const next = track.withGainOffset(offset);
      this.deps.session.update((d) => ({ ...d, music: next }));
      this.patch({ error: null });
    } catch (error) {
      this.patch({ error: this.report(error) });
    }
  }

  none(): void {
    this.deps.session.update((d) => ({ ...d, music: null }));
    this.patch({ error: null });
  }

  setGainOffset(db: number): void {
    try {
      const current = this.deps.session.state.music;
      if (!current) throw new ValidationError("Chưa chọn nhạc");
      const next = current.withGainOffset(db);
      this.deps.session.update((d) => ({ ...d, music: next }));
      this.patch({ error: null });
    } catch (error) {
      this.patch({ error: this.report(error) });
    }
  }

  async uploadTrack(file: File): Promise<void> {
    this.patch({ busy: true, error: null });
    try {
      classifyUpload(file, ["audio"]);
      await this.deps.probe.audio(file); // kiểm giải mã được trước khi lưu
      const meta = await this.deps.uploads.put(file, { name: file.name, kind: "audio" });
      const track = MusicTrack.create({
        id: meta.id,
        title: file.name.replace(/\.[^.]+$/, ""),
        origin: "upload",
        uri: uploadUri(meta.id),
      });
      this.patch({ uploaded: [...this.state.uploaded, track] });
      this.choose(track);
    } catch (error) {
      this.patch({ error: this.report(error) });
    } finally {
      this.patch({ busy: false });
    }
  }
}
```
Ghi chú: sau `choose(track)` thành công, `error` đã được xoá; nếu `choose` lỗi (mức chỉnh hợp lệ nên không xảy ra) lỗi được giữ nguyên vì `finally` chỉ đổi `busy`.

- [ ] **Step 5: Sửa `container.ts`** — thêm `import { TrackSource } from "@/client/services/TrackSource";`; thêm `tracks: TrackSource;` vào `ClientServices`; trong `createClientServices` tạo `const uploads = new UploadRepository(store);` rồi dùng cho cả `uploads` và `tracks: new TrackSource(env.fetch, uploads)` (thay dòng `uploads: new UploadRepository(store)` hiện có bằng `uploads`).

- [ ] **Step 6: Chạy test, typecheck, lint** — `npx vitest run` → PASS; sạch.

- [ ] **Step 7: Commit** (điều phối viên) — `feat(controllers): bước 4 — kho nhạc, nhạc tải lên và âm lượng`

---

### Task 8: Bước 5 — `RenderJobBuilder`, tên file, `RenderController`

**Files:**
- Create: `src/client/controllers/RenderJobBuilder.ts`, `src/client/controllers/fileName.ts`, `src/client/controllers/RenderController.ts`
- Test: `tests/client/controllers/RenderJobBuilder.test.ts`, `tests/client/controllers/fileName.test.ts`, `tests/client/controllers/RenderController.test.ts`

**Interfaces:**
- Consumes: `StudioData`, `staleSceneIds`, `trimSilence`, `AudioDecodeService` (`Pick<AudioDecodeService,"decode">`, `AudioDecodeService.toMono`), `RENDER_SAMPLE_RATE`, `TrackSource` (`Pick<TrackSource,"bytes">`), `UploadRepository` (`Pick<UploadRepository,"get">`), `parseUploadUri`, `TemplateRegistry`, `RenderJob`, `FootageInput`, `RenderCancelledError`, `SupportReport`.
- Produces:
  - `RenderJobBuilder`: `constructor(deps: { templates: Pick<TemplateRegistry,"get">; uploads: Pick<UploadRepository,"get">; tracks: Pick<TrackSource,"bytes">; decoder: Pick<AudioDecodeService,"decode">; origin: string; sampleRate?: number })`; `build(data: StudioData, onProgress?: (label: string, ratio: number) => void, isCancelled?: () => boolean): Promise<{ job: RenderJob; warnings: string[] }>` — mỗi lần dựng: giải mã giọng, **cắt khoảng lặng**, `durationSec = samples.length / sampleRate`; cảnh trám tải lên thiếu trong kho → dùng nền mặc định kèm cảnh báo; nhạc không nạp được → dựng không nhạc kèm cảnh báo.
  - `fileNameFor(title: string, publishDate: Date): string` → `slug-tieu-de_yyyymmdd.mp4` (không dấu, chữ thường, tối đa 60 ký tự phần slug, rỗng thì `tin`).
  - `RenderController extends StateController<RenderState>`, `RenderState = { status: "idle" } | { status: "unsupported"; missing: string[] } | { status: "working"; label: string; percent: number } | { status: "done"; url: string; durationSec: number; sizeBytes: number; fileName: string; warnings: string[] } | { status: "error"; message: string }`; `constructor(deps: { session: StudioSession; builder: Pick<RenderJobBuilder,"build">; render: (job: RenderJob, onProgress?: (p: Extract<WorkerMessage,{type:"progress"}>) => void) => Promise<{ blob: Blob; durationSec: number }>; cancelRender: () => void; support: () => Promise<SupportReport>; probeWorker: () => Promise<string[]>; createUrl: (b: Blob) => string; revokeUrl: (u: string) => void; onAuthLost?: () => void })`; `checkSupport(): Promise<void>`; `start(): Promise<void>`; `cancel(): void`; `dispose(): void`. Tiến độ: 0–25 % là chuẩn bị (builder), 25–95 % là dựng hình, như `DevRenderController`.

- [ ] **Step 1: Viết test**

`tests/client/controllers/fileName.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { fileNameFor } from "@/client/controllers/fileName";

describe("fileNameFor", () => {
  it("bỏ dấu, chữ thường, nối bằng gạch, kèm ngày yyyymmdd", () => {
    expect(fileNameFor("Phú Thọ: Khởi tố nguyên Chủ tịch UBND xã", new Date(2026, 9, 14))).toBe(
      "phu-tho-khoi-to-nguyen-chu-tich-ubnd-xa_20261014.mp4",
    );
  });

  it("xử lý chữ đ/Đ", () => {
    expect(fileNameFor("Đà Nẵng đón đoàn", new Date(2026, 0, 5))).toBe("da-nang-don-doan_20260105.mp4");
  });

  it("cắt slug tối đa 60 ký tự, không để gạch ở cuối", () => {
    const name = fileNameFor("một hai ba bốn năm sáu bảy tám chín mười mười một mười hai mười ba mười bốn", new Date(2026, 0, 1));
    const slug = name.replace(/_\d{8}\.mp4$/, "");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("tiêu đề toàn ký hiệu thì dùng 'tin'", () => {
    expect(fileNameFor("!!! ???", new Date(2026, 11, 31))).toBe("tin_20261231.mp4");
  });
});
```

`tests/client/controllers/RenderJobBuilder.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { RenderJobBuilder } from "@/client/controllers/RenderJobBuilder";
import { EMPTY_STUDIO, type StudioData } from "@/client/controllers/StudioSession";
import { uploadToFootage, uploadUri } from "@/client/media/footageFactory";
import { RenderCancelledError } from "@/client/render/errors";
import { FallbackFootage, ImageFootage } from "@/domain/Footage";
import { MusicTrack } from "@/domain/MusicTrack";
import { defaultTemplateRegistry } from "@/templates/registry";
import { fakeNarration, makeProject, memoryUploads, VOICE } from "../../helpers/studioFixtures";

const SR = 48000;

/** 0,5 s lặng + 1 s âm + 0,5 s lặng. */
function voiceChannel(): Float32Array {
  const out = new Float32Array(SR * 2);
  for (let i = SR / 2; i < SR * 1.5; i++) out[i] = 0.5 * Math.sin(i / 20);
  return out;
}

function setup(overrides: Partial<{ sampleRate: number }> = {}) {
  const { uploads } = memoryUploads("u");
  const decode = vi.fn(async (_bytes: ArrayBuffer) => ({
    channels: [voiceChannel()],
    sampleRate: overrides.sampleRate ?? SR,
    durationSec: 2,
  }));
  const tracks = { bytes: vi.fn(async () => new Uint8Array([5, 5, 5]).buffer) };
  const builder = new RenderJobBuilder({
    templates: defaultTemplateRegistry(),
    uploads,
    tracks,
    decoder: { decode },
    origin: "http://localhost:3100",
  });
  const project = makeProject(2); // s1 mở đầu, s2, s3
  const data: StudioData = {
    ...EMPTY_STUDIO,
    project,
    voice: VOICE,
    narrations: new Map(project.scenes.map((s) => [s.id, fakeNarration(s)])),
    brand: { values: { channelName: "KÊNH" }, logo: new Blob(["png"]) },
  };
  return { builder, data, uploads, tracks, decode, project };
}

describe("RenderJobBuilder", () => {
  it("dựng job: cảnh theo thứ tự, giọng đã cắt lặng, thương hiệu và thông tin dự án", async () => {
    const { builder, data } = setup();
    const { job, warnings } = await builder.build(data);
    expect(warnings).toEqual([]);
    expect(job.scenes.map((s) => [s.sceneId, s.role])).toEqual([
      ["s1", "intro"],
      ["s2", "body"],
      ["s3", "body"],
    ]);
    expect(job.sampleRate).toBe(48000);
    expect(job.origin).toBe("http://localhost:3100");
    expect(job.templateId).toBe("theanh28");
    expect(job.brandValues).toEqual({ channelName: "KÊNH" });
    expect(job.logo).toBe(data.brand.logo);
    expect(job.project).toEqual({ displayTitle: "Tiêu đề bản tin", sourceCredit: "Nguồn thử", publishDateText: "14/10/2026" });
    const n = job.narrations[0]!;
    expect(n.durationSec).toBeCloseTo(n.samples.length / SR, 10);
    expect(n.durationSec).toBeGreaterThan(1.0);
    expect(n.durationSec).toBeLessThan(1.2); // 1 s âm + 2 × 0,04 s đệm, không còn 2 s gốc
    expect(job.music).toBeNull();
  });

  it("cảnh trám: stock dùng url, tải lên dùng blob, thiếu dùng nền mặc định", async () => {
    const { builder, data, uploads, project } = setup();
    const meta = await uploads.put(new Blob(["jpg"]), { name: "a.jpg", kind: "image" });
    const stock = new ImageFootage("g1", { origin: "pexels", uri: "https://cdn/x.jpg" }, 100, 100);
    const own = uploadToFootage("g2", meta.id, "image", { width: 100, height: 100 });
    const lost = uploadToFootage("g3", "upload-khong-co", "image", { width: 100, height: 100 });
    const withFootage = {
      ...data,
      footage: data.footage.assign("s1", stock).assign("s2", own).assign("s3", lost),
    };
    const { job, warnings } = await builder.build(withFootage);
    expect(job.scenes[0]!.footage).toEqual({ kind: "image", url: "https://cdn/x.jpg" });
    expect(job.scenes[1]!.footage.kind).toBe("image");
    expect(job.scenes[1]!.footage.blob).toBeInstanceOf(Blob);
    expect(job.scenes[2]!.footage).toEqual({ kind: "fallback" });
    expect(warnings).toEqual(["Không tìm thấy file tải lên của cảnh 3, dùng nền mặc định"]);
    expect(project.scenes).toHaveLength(3);
  });

  it("cảnh chưa gán cảnh trám dùng nền mặc định, không cảnh báo", async () => {
    const { builder, data } = setup();
    const { job, warnings } = await builder.build({ ...data, footage: data.footage.assign("s2", new FallbackFootage("x")) });
    expect(job.scenes.every((s) => s.footage.kind === "fallback")).toBe(true);
    expect(warnings).toEqual([]);
  });

  it("nhạc: nạp qua TrackSource, mức theo MusicTrack; lỗi nạp thì dựng không nhạc và cảnh báo", async () => {
    const { builder, data, tracks } = setup();
    const music = MusicTrack.create({ id: "m", title: "M", origin: "library", uri: "/music/m.mp3", gainOffsetDb: 2 });
    const ok = await builder.build({ ...data, music });
    expect(ok.job.music?.levelBelowVoiceDb).toBe(13);
    expect(ok.job.music?.channels).toHaveLength(1);

    tracks.bytes.mockRejectedValueOnce(new Error("hỏng mạng"));
    const failed = await builder.build({ ...data, music });
    expect(failed.job.music).toBeNull();
    expect(failed.warnings).toEqual(["Không nạp được nhạc nền, video sẽ dựng không có nhạc"]);
  });

  it("thiếu dự án, giọng cũ hoặc thiếu giọng thì báo bằng tiếng Việt", async () => {
    const { builder, data } = setup();
    await expect(builder.build(EMPTY_STUDIO)).rejects.toThrow("Chưa có dự án");
    const partial = { ...data, narrations: new Map([...data.narrations].slice(1)) };
    await expect(builder.build(partial)).rejects.toThrow("Chưa đủ giọng đọc cho mọi cảnh");
  });

  it("giải mã sai tần số mẫu thì báo lỗi rõ ràng", async () => {
    const { builder, data } = setup({ sampleRate: 44100 });
    await expect(builder.build(data)).rejects.toThrow("Âm thanh giải mã sai tần số mẫu (44100 Hz thay vì 48000 Hz)");
  });

  it("huỷ giữa chừng thì ném RenderCancelledError", async () => {
    const { builder, data } = setup();
    await expect(builder.build(data, undefined, () => true)).rejects.toBeInstanceOf(RenderCancelledError);
  });

  it("báo tiến độ theo từng cảnh", async () => {
    const { builder, data } = setup();
    const labels: string[] = [];
    await builder.build(data, (label) => labels.push(label));
    expect(labels).toEqual(["Chuẩn bị giọng đọc 1/3", "Chuẩn bị giọng đọc 2/3", "Chuẩn bị giọng đọc 3/3"]);
  });
});
```

`tests/client/controllers/RenderController.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { RenderController } from "@/client/controllers/RenderController";
import { ApiError } from "@/client/services/apiError";
import { RenderCancelledError } from "@/client/render/errors";
import type { RenderJob } from "@/client/render/RenderJob";
import { makeSessionWithProject } from "../../helpers/studioFixtures";

const job = { templateId: "theanh28" } as unknown as RenderJob;

function setup(opts: {
  build?: () => Promise<{ job: RenderJob; warnings: string[] }>;
  render?: RenderControllerRender;
  support?: () => Promise<{ ok: boolean; missing: string[] }>;
  probeWorker?: () => Promise<string[]>;
} = {}) {
  const made = makeSessionWithProject(2);
  const urls: string[] = [];
  const revoked: string[] = [];
  const authLost = vi.fn();
  const cancelRender = vi.fn();
  const ctrl = new RenderController({
    session: made.session,
    builder: { build: opts.build ?? (async () => ({ job, warnings: ["Cảnh báo thử"] })) },
    render: opts.render ?? (async () => ({ blob: new Blob(["mp4"]), durationSec: 12.5 })),
    cancelRender,
    support: opts.support ?? (async () => ({ ok: true, missing: [] })),
    probeWorker: opts.probeWorker ?? (async () => []),
    createUrl: () => {
      const u = `blob:${urls.length}`;
      urls.push(u);
      return u;
    },
    revokeUrl: (u) => revoked.push(u),
    onAuthLost: authLost,
  });
  return { ...made, ctrl, urls, revoked, authLost, cancelRender };
}

type RenderControllerRender = ConstructorParameters<typeof RenderController>[0]["render"];

describe("RenderController", () => {
  it("start dựng xong: có url, thời lượng, dung lượng, tên file và cảnh báo", async () => {
    const { ctrl } = setup();
    await ctrl.start();
    expect(ctrl.state).toEqual({
      status: "done",
      url: "blob:0",
      durationSec: 12.5,
      sizeBytes: 3,
      fileName: "tieu-de-ban-tin_20261014.mp4",
      warnings: ["Cảnh báo thử"],
    });
  });

  it("tiến độ: 0–25 % chuẩn bị, 25–95 % dựng hình", async () => {
    const seen: number[] = [];
    const labels: string[] = [];
    let ctrlRef: RenderController | null = null;
    const made = setup({
      build: async () => {
        return { job, warnings: [] };
      },
      render: async (_job, onProgress) => {
        onProgress?.({ type: "progress", stage: "video", frame: 15, totalFrames: 30 });
        const s = ctrlRef!.state;
        if (s.status === "working") {
          seen.push(s.percent);
          labels.push(s.label);
        }
        return { blob: new Blob(["x"]), durationSec: 1 };
      },
    });
    ctrlRef = made.ctrl;
    await made.ctrl.start();
    expect(labels).toEqual(["Dựng hình 50%"]);
    expect(seen[0]).toBeCloseTo(60, 5);
  });

  it("lỗi thì báo thông điệp tiếng Việt; hết phiên thì onAuthLost", async () => {
    const failing = setup({ build: async () => { throw new Error("Lỗi bộ dựng: không rõ"); } });
    await failing.ctrl.start();
    expect(failing.ctrl.state).toEqual({ status: "error", message: "Lỗi bộ dựng: không rõ" });

    const expired = setup({ build: async () => { throw new ApiError(401, "AUTH", "Hết phiên đăng nhập, hãy đăng nhập lại"); } });
    await expired.ctrl.start();
    expect(expired.authLost).toHaveBeenCalledTimes(1);
    expect(expired.ctrl.state.status).toBe("error");
  });

  it("huỷ thì về trạng thái rỗi", async () => {
    const { ctrl, cancelRender } = setup({
      render: async () => {
        throw new RenderCancelledError();
      },
    });
    await ctrl.start();
    expect(ctrl.state).toEqual({ status: "idle" });
    ctrl.cancel();
    expect(cancelRender).toHaveBeenCalled();
  });

  it("dựng lại thì thu hồi url cũ; dispose thu hồi url hiện tại", async () => {
    const { ctrl, revoked } = setup();
    await ctrl.start();
    await ctrl.start();
    expect(revoked).toEqual(["blob:0"]);
    ctrl.dispose();
    expect(revoked).toEqual(["blob:0", "blob:1"]);
  });

  it("trình duyệt thiếu khả năng thì khoá bước dựng", async () => {
    const { ctrl } = setup({ support: async () => ({ ok: false, missing: ["VideoEncoder"] }) });
    await ctrl.checkSupport();
    expect(ctrl.state).toEqual({ status: "unsupported", missing: ["VideoEncoder"] });
    await ctrl.start();
    expect(ctrl.state.status).toBe("unsupported");
  });

  it("worker thiếu khả năng hoặc không phản hồi cũng khoá bước dựng", async () => {
    const missing = setup({ probeWorker: async () => ["Canvas 2D trong worker"] });
    await missing.ctrl.checkSupport();
    expect(missing.ctrl.state).toEqual({ status: "unsupported", missing: ["Canvas 2D trong worker"] });

    const silent = setup({ probeWorker: async () => { throw new Error("Bộ dựng không phản hồi"); } });
    await silent.ctrl.checkSupport();
    expect(silent.ctrl.state).toEqual({ status: "unsupported", missing: ["Bộ dựng không phản hồi"] });
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/controllers/fileName.test.ts tests/client/controllers/RenderJobBuilder.test.ts tests/client/controllers/RenderController.test.ts` → FAIL (thiếu module).

- [ ] **Step 3: Viết `src/client/controllers/fileName.ts`**
```ts
const pad2 = (n: number) => String(n).padStart(2, "0");

/** `slug-tieu-de_yyyymmdd.mp4`: không dấu, chữ thường, tối đa 60 ký tự cho phần slug. */
export function fileNameFor(title: string, publishDate: Date): string {
  const slug =
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "tin";
  const date = `${publishDate.getFullYear()}${pad2(publishDate.getMonth() + 1)}${pad2(publishDate.getDate())}`;
  return `${slug}_${date}.mp4`;
}
```

- [ ] **Step 4: Viết `src/client/controllers/RenderJobBuilder.ts`**
```ts
import { AudioDecodeService, RENDER_SAMPLE_RATE, type DecodedAudio } from "@/client/media/AudioDecodeService";
import type { MusicBed } from "@/client/media/AudioMix";
import { trimSilence } from "@/client/media/audioTrim";
import { parseUploadUri } from "@/client/media/footageFactory";
import { RenderCancelledError } from "@/client/render/errors";
import type { FootageInput, NarrationInput, RenderJob, RenderSceneInput } from "@/client/render/RenderJob";
import { isSessionExpired } from "@/client/errors/userMessage";
import type { TrackSource } from "@/client/services/TrackSource";
import type { UploadRepository } from "@/client/storage/UploadRepository";
import { ValidationError } from "@/domain/errors";
import type { Footage } from "@/domain/Footage";
import type { TemplateRegistry } from "@/templates/TemplateRegistry";
import { staleSceneIds } from "./readiness";
import type { StudioData } from "./StudioSession";

export interface RenderJobBuilderDeps {
  templates: Pick<TemplateRegistry, "get">;
  uploads: Pick<UploadRepository, "get">;
  tracks: Pick<TrackSource, "bytes">;
  decoder: Pick<AudioDecodeService, "decode">;
  origin: string;
  sampleRate?: number;
}

export interface BuiltJob {
  job: RenderJob;
  warnings: string[];
}

/** Dựng `RenderJob` từ dữ liệu bước 1–4: giải mã giọng, cắt lặng, nạp nhạc và file tải lên. */
export class RenderJobBuilder {
  private readonly sampleRate: number;

  constructor(private readonly deps: RenderJobBuilderDeps) {
    this.sampleRate = deps.sampleRate ?? RENDER_SAMPLE_RATE;
  }

  async build(
    data: StudioData,
    onProgress?: (label: string, ratio: number) => void,
    isCancelled: () => boolean = () => false,
  ): Promise<BuiltJob> {
    const { project, voice, narrations, footage, music, brand } = data;
    if (!project) throw new ValidationError("Chưa có dự án");
    if (!voice || staleSceneIds(data).length > 0) throw new ValidationError("Chưa đủ giọng đọc cho mọi cảnh");
    this.deps.templates.get(project.templateId); // phong cách không tồn tại thì ném NotFoundError

    const warnings: string[] = [];
    const sceneCount = project.scenes.length;
    const total = sceneCount + (music ? 1 : 0);
    const narrationInputs: NarrationInput[] = [];
    const sceneInputs: RenderSceneInput[] = [];

    for (const [index, scene] of project.scenes.entries()) {
      if (isCancelled()) throw new RenderCancelledError();
      onProgress?.(`Chuẩn bị giọng đọc ${index + 1}/${sceneCount}`, index / total);
      const narration = narrations.get(scene.id);
      if (!narration) throw new ValidationError("Chưa đủ giọng đọc cho mọi cảnh");
      const decoded = this.checkRate(await this.deps.decoder.decode(narration.audio.slice().buffer as ArrayBuffer));
      // Cắt lặng ở mỗi lần dựng; độ dài gửi cho bộ dựng là độ dài đã cắt.
      const trimmed = trimSilence(AudioDecodeService.toMono(decoded.channels), decoded.sampleRate);
      narrationInputs.push({
        sceneId: scene.id,
        durationSec: trimmed.samples.length / decoded.sampleRate,
        samples: trimmed.samples,
      });
      sceneInputs.push({
        sceneId: scene.id,
        role: scene.role,
        text: scene.text,
        footage: await this.footageInput(footage.resolve(scene.id), index + 1, warnings),
      });
    }

    let musicBed: MusicBed | null = null;
    if (music) {
      if (isCancelled()) throw new RenderCancelledError();
      onProgress?.("Nạp nhạc nền", sceneCount / total);
      try {
        const decoded = this.checkRate(await this.deps.decoder.decode(await this.deps.tracks.bytes(music)));
        musicBed = { channels: decoded.channels, levelBelowVoiceDb: music.levelBelowVoiceDb };
      } catch (error) {
        if (isSessionExpired(error)) throw error;
        warnings.push("Không nạp được nhạc nền, video sẽ dựng không có nhạc");
      }
    }

    const job: RenderJob = {
      templateId: project.templateId,
      brandValues: brand.values,
      logo: brand.logo,
      project: {
        displayTitle: project.displayTitle,
        sourceCredit: project.sourceCredit,
        publishDateText: project.formattedPublishDate(),
      },
      scenes: sceneInputs,
      narrations: narrationInputs,
      music: musicBed,
      sampleRate: this.sampleRate,
      origin: this.deps.origin,
    };
    return { job, warnings };
  }

  /** Giọng và nhạc phải cùng tần số mẫu với bản trộn; lệch sẽ sai cao độ và nhịp mà không báo lỗi. */
  private checkRate(decoded: DecodedAudio): DecodedAudio {
    if (decoded.sampleRate !== this.sampleRate) {
      throw new Error(`Âm thanh giải mã sai tần số mẫu (${decoded.sampleRate} Hz thay vì ${this.sampleRate} Hz)`);
    }
    return decoded;
  }

  private async footageInput(footage: Footage, sceneNumber: number, warnings: string[]): Promise<FootageInput> {
    const snap = footage.snapshot();
    if (snap.kind === "fallback") return { kind: "fallback" };
    if (snap.source.origin === "upload") {
      const id = parseUploadUri(snap.source.uri);
      const stored = id ? await this.deps.uploads.get(id) : null;
      if (!stored) {
        warnings.push(`Không tìm thấy file tải lên của cảnh ${sceneNumber}, dùng nền mặc định`);
        return { kind: "fallback" };
      }
      return { kind: snap.kind, blob: stored.blob };
    }
    return { kind: snap.kind, url: snap.source.uri };
  }
}
```

- [ ] **Step 5: Viết `src/client/controllers/RenderController.ts`**
```ts
import type { SupportReport } from "@/client/render/BrowserSupport";
import { RenderCancelledError } from "@/client/render/errors";
import type { RenderJob, WorkerMessage } from "@/client/render/RenderJob";
import { fileNameFor } from "./fileName";
import type { RenderJobBuilder } from "./RenderJobBuilder";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

type Progress = Extract<WorkerMessage, { type: "progress" }>;

export type RenderState =
  | { status: "idle" }
  | { status: "unsupported"; missing: string[] }
  | { status: "working"; label: string; percent: number }
  | { status: "done"; url: string; durationSec: number; sizeBytes: number; fileName: string; warnings: string[] }
  | { status: "error"; message: string };

export interface RenderControllerDeps {
  session: StudioSession;
  builder: Pick<RenderJobBuilder, "build">;
  render: (job: RenderJob, onProgress?: (p: Progress) => void) => Promise<{ blob: Blob; durationSec: number }>;
  cancelRender: () => void;
  support: () => Promise<SupportReport>;
  probeWorker: () => Promise<string[]>;
  createUrl: (blob: Blob) => string;
  revokeUrl: (url: string) => void;
  onAuthLost?: () => void;
}

const STAGE_LABEL: Record<Progress["stage"], string> = {
  loading: "Nạp font và cảnh trám",
  audio: "Trộn âm thanh",
  video: "Dựng hình",
  finalizing: "Đóng gói MP4",
};

/** Bước 5: dựng video và trả về MP4 để xem lại, tải về. */
export class RenderController extends StateController<RenderState> {
  private cancelRequested = false;

  constructor(private readonly deps: RenderControllerDeps) {
    super({ status: "idle" }, deps.onAuthLost);
  }

  async checkSupport(): Promise<void> {
    if (this.state.status !== "idle") return;
    try {
      const report = await this.deps.support();
      if (!report.ok) {
        this.set({ status: "unsupported", missing: report.missing });
        return;
      }
      const missing = await this.deps.probeWorker();
      if (missing.length > 0 && this.state.status === "idle") this.set({ status: "unsupported", missing });
    } catch (error) {
      if (this.state.status === "idle") this.set({ status: "unsupported", missing: [this.report(error)] });
    }
  }

  async start(): Promise<void> {
    if (this.state.status === "working" || this.state.status === "unsupported") return;
    if (this.state.status === "done") this.deps.revokeUrl(this.state.url);
    this.cancelRequested = false;
    this.set({ status: "working", label: "Chuẩn bị", percent: 0 });
    try {
      const data = this.deps.session.state;
      const { job, warnings } = await this.deps.builder.build(
        data,
        (label, ratio) => this.set({ status: "working", label, percent: ratio * 25 }),
        () => this.cancelRequested,
      );
      if (this.cancelRequested) throw new RenderCancelledError();
      let lastRatio = 0;
      const result = await this.deps.render(job, (p) => {
        if (p.frame && p.totalFrames) lastRatio = p.frame / p.totalFrames;
        const label = p.stage === "video" ? `${STAGE_LABEL.video} ${Math.round(lastRatio * 100)}%` : STAGE_LABEL[p.stage];
        this.set({ status: "working", label, percent: 25 + lastRatio * 70 });
      });
      const project = data.project!;
      this.set({
        status: "done",
        url: this.deps.createUrl(result.blob),
        durationSec: result.durationSec,
        sizeBytes: result.blob.size,
        fileName: fileNameFor(project.displayTitle, project.publishDate),
        warnings,
      });
    } catch (error) {
      if (error instanceof RenderCancelledError) {
        this.set({ status: "idle" });
        return;
      }
      this.set({ status: "error", message: this.report(error) });
    }
  }

  cancel(): void {
    this.cancelRequested = true;
    this.deps.cancelRender();
  }

  dispose(): void {
    this.cancel();
    if (this.state.status === "done") this.deps.revokeUrl(this.state.url);
  }
}
```

- [ ] **Step 6: Chạy test, typecheck, lint** — `npx vitest run` → PASS; sạch. Lưu ý test "tiến độ": `build` giả không gọi `onProgress`, nên chỉ phần dựng hình được kiểm; nếu `percent` không đúng 60 thì chỉnh **code** theo công thức `25 + ratio * 70`.

- [ ] **Step 7: Commit** (điều phối viên) — `feat(controllers): bước 5 — dựng job (cắt lặng mỗi lần dựng) và điều khiển dựng video`

---

### Task 9: `WizardController` và `createStudio`

**Files:**
- Create: `src/client/controllers/WizardController.ts`, `src/client/controllers/createStudio.ts`
- Test: `tests/client/controllers/WizardController.test.ts`, `tests/client/controllers/createStudio.test.ts`

**Interfaces:**
- Consumes: `StudioSession`, `readiness` (`STEPS`, `canEnter`, `firstIncompleteStep`, `StepId`), `DraftRepository` (`Pick<DraftRepository,"load"|"clear">`), `UploadRepository` (`Pick<UploadRepository,"list"|"delete">`), `parseUploadUri`, mọi controller của task 2–8, `ClientServices`, `randomIds`.
- Produces:
  - `WizardController extends StateController<{ step: StepId; booting: boolean; resume: { savedAt: string; title: string } | null; error: string | null }>`; `constructor(deps: { session; drafts; uploads; onAuthLost? })`; `boot(): Promise<void>` (đọc bản nháp gần nhất, chưa áp dụng, chỉ đề nghị mở lại); `resume(): Promise<void>` (áp dụng bản nháp, nhảy tới bước đầu tiên chưa xong; bản nháp hỏng thì xoá và báo); `discard(): Promise<void>` (bỏ bản nháp + dọn file tải lên không còn dùng); `newProject(): Promise<void>` (xoá dự án hiện tại và bản nháp, dọn file tải lên, về bước 1); `goTo(step: StepId): boolean`; `next(): boolean`; `back(): void`; `cleanupUploads(): Promise<void>` (xoá file tải lên không được cảnh trám hay nhạc đang dùng tham chiếu; lỗi bỏ qua).
  - `createStudio(services: ClientServices, options?: { onAuthLost?: () => void; schedule?: SessionDeps["schedule"]; ids?: IdGenerator }): Studio` với `Studio = { session; wizard; brand: BrandController; project: ProjectController; voice: VoiceController; footage: FootageController; search: FootageSearchController; music: MusicController; render: RenderController; services: ClientServices; dispose(): void }`. `dispose()` huỷ dựng, huỷ tìm kiếm, `flush` bản nháp.

- [ ] **Step 1: Viết test**

`tests/client/controllers/WizardController.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { WizardController } from "@/client/controllers/WizardController";
import { StudioSession } from "@/client/controllers/StudioSession";
import { uploadToFootage, uploadUri } from "@/client/media/footageFactory";
import { DraftRepository } from "@/client/storage/DraftRepository";
import { MemoryKeyValueStore } from "@/client/storage/KeyValueStore";
import { UploadRepository } from "@/client/storage/UploadRepository";
import { MusicTrack } from "@/domain/MusicTrack";
import { sequentialIds } from "@/domain/ids";
import { fakeNarration, makeProject, manualScheduler, VOICE } from "../../helpers/studioFixtures";

function setup() {
  const store = new MemoryKeyValueStore();
  const drafts = new DraftRepository(store, () => new Date("2026-10-14T08:00:00Z"));
  const uploads = new UploadRepository(store, sequentialIds("u"));
  const sched = manualScheduler();
  const session = new StudioSession({ drafts, ids: sequentialIds("n"), schedule: sched.schedule });
  const wizard = new WizardController({ session, drafts, uploads });
  return { store, drafts, uploads, session, wizard };
}

async function fillAll(session: StudioSession) {
  const project = makeProject(2);
  session.update((d) => ({
    ...d,
    project,
    voice: VOICE,
    narrations: new Map(project.scenes.map((s) => [s.id, fakeNarration(s)])),
  }));
  await session.flush();
  return project;
}

describe("WizardController", () => {
  it("bắt đầu ở bước 1; chỉ vào được bước khi các bước trước đã xong", () => {
    const { wizard, session } = setup();
    expect(wizard.state.step).toBe("news");
    expect(wizard.goTo("voice")).toBe(false);
    expect(wizard.next()).toBe(false);
    session.update((d) => ({ ...d, project: makeProject(2) }));
    expect(wizard.next()).toBe(true);
    expect(wizard.state.step).toBe("voice");
    expect(wizard.goTo("render")).toBe(false);
    wizard.back();
    expect(wizard.state.step).toBe("news");
    wizard.back();
    expect(wizard.state.step).toBe("news");
  });

  it("boot đề nghị mở lại bản nháp nhưng chưa áp dụng", async () => {
    const a = setup();
    await fillAll(a.session);
    const b = new WizardController({
      session: new StudioSession({ drafts: a.drafts, ids: sequentialIds("n"), schedule: manualScheduler().schedule }),
      drafts: a.drafts,
      uploads: a.uploads,
    });
    await b.boot();
    expect(b.state.booting).toBe(false);
    expect(b.state.resume).toEqual({ savedAt: "2026-10-14T08:00:00.000Z", title: "Tiêu đề bản tin" });
  });

  it("không có bản nháp thì không đề nghị gì", async () => {
    const { wizard } = setup();
    await wizard.boot();
    expect(wizard.state.resume).toBeNull();
    expect(wizard.state.booting).toBe(false);
  });

  it("resume áp dụng bản nháp và nhảy tới bước đầu tiên chưa xong", async () => {
    const a = setup();
    await fillAll(a.session);
    const session = new StudioSession({ drafts: a.drafts, ids: sequentialIds("n"), schedule: manualScheduler().schedule });
    const wizard = new WizardController({ session, drafts: a.drafts, uploads: a.uploads });
    await wizard.boot();
    await wizard.resume();
    expect(session.state.project?.scenes).toHaveLength(3);
    expect(wizard.state.step).toBe("render");
    expect(wizard.state.resume).toBeNull();
  });

  it("bản nháp hỏng thì xoá đi và báo lỗi tiếng Việt", async () => {
    const { store, wizard, drafts } = setup();
    await store.set("draft", { version: 1, savedAt: "x", project: { title: "T", scenes: "hỏng" }, narrations: [], footage: { assignments: [] }, voice: null, music: null });
    await wizard.boot();
    expect(wizard.state.resume).not.toBeNull();
    await wizard.resume();
    expect(wizard.state.error).toMatch(/^Bản nháp hỏng/);
    expect(await drafts.load()).toBeNull();
    expect(wizard.state.resume).toBeNull();
  });

  it("discard xoá bản nháp và dọn file tải lên", async () => {
    const { wizard, drafts, uploads, session } = setup();
    await fillAll(session);
    await uploads.put(new Blob(["x"]), { name: "a.jpg", kind: "image" });
    await wizard.boot();
    await wizard.discard();
    expect(await drafts.load()).toBeNull();
    expect(await uploads.list()).toEqual([]);
    expect(wizard.state.resume).toBeNull();
  });

  it("newProject xoá dự án và bản nháp, giữ thương hiệu, về bước 1, dọn file không dùng", async () => {
    const { wizard, drafts, uploads, session } = setup();
    await fillAll(session);
    session.setBrand({ values: { channelName: "K" }, logo: null });
    await uploads.put(new Blob(["x"]), { name: "a.jpg", kind: "image" });
    await wizard.newProject();
    expect(session.state.project).toBeNull();
    expect(session.state.brand.values).toEqual({ channelName: "K" });
    expect(wizard.state.step).toBe("news");
    expect(await drafts.load()).toBeNull();
    expect(await uploads.list()).toEqual([]);
  });

  it("cleanupUploads giữ file đang được cảnh trám hoặc nhạc tham chiếu", async () => {
    const { wizard, uploads, session } = setup();
    const project = await fillAll(session);
    const usedImage = await uploads.put(new Blob(["i"]), { name: "i.jpg", kind: "image" });
    const usedMusic = await uploads.put(new Blob(["m"]), { name: "m.mp3", kind: "audio" });
    const orphan = await uploads.put(new Blob(["o"]), { name: "o.jpg", kind: "image" });
    session.update((d) => ({
      ...d,
      footage: d.footage.assign(project.scenes[1]!.id, uploadToFootage("g1", usedImage.id, "image", { width: 10, height: 10 })),
      music: MusicTrack.create({ id: usedMusic.id, title: "m", origin: "upload", uri: uploadUri(usedMusic.id) }),
    }));
    await wizard.cleanupUploads();
    expect((await uploads.list()).map((m) => m.id).sort()).toEqual([usedImage.id, usedMusic.id].sort());
    expect((await uploads.list()).some((m) => m.id === orphan.id)).toBe(false);
  });
});
```

`tests/client/controllers/createStudio.test.ts`:
```ts
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createStudio } from "@/client/controllers/createStudio";
import { createClientServices, type ClientEnv } from "@/client/container";
import { SAMPLE_NEWS } from "@/client/sample/sampleNews";
import { ApiError } from "@/client/services/apiError";

function env(): ClientEnv {
  return {
    fetch: (async () => new Response("", { status: 404 })) as unknown as typeof fetch,
    indexedDB: new IDBFactory() as unknown as IDBFactory,
    origin: "http://localhost:3100",
    createUrl: () => "blob:x",
    revokeUrl: () => {},
  };
}

describe("createStudio", () => {
  it("lắp đủ controller dùng chung một session", async () => {
    const studio = createStudio(createClientServices(env()), { schedule: () => () => {} });
    expect(studio.project.createFrom({ ...SAMPLE_NEWS, templateId: "theanh28" })).toBe(true);
    expect(studio.session.state.project?.scenes.length).toBeGreaterThan(2);
    expect(studio.wizard.next()).toBe(true);
    expect(studio.wizard.state.step).toBe("voice");
    await studio.brand.load("theanh28");
    expect(studio.session.state.brand.values.channelName).toBe("TIN NHANH");
    studio.dispose();
  });

  it("onAuthLost của studio được gọi khi một controller gặp lỗi hết phiên", async () => {
    let lost = 0;
    const services = createClientServices(env());
    (services.tts as { voices: () => Promise<never> }).voices = async () => {
      throw new ApiError(401, "AUTH", "Chưa đăng nhập");
    };
    const studio = createStudio(services, { onAuthLost: () => lost++, schedule: () => () => {} });
    await studio.voice.loadVoices();
    expect(lost).toBe(1);
    studio.dispose();
  });
});
```

- [ ] **Step 2: Chạy để thấy lỗi** — `npx vitest run tests/client/controllers/WizardController.test.ts tests/client/controllers/createStudio.test.ts` → FAIL (thiếu module).

- [ ] **Step 3: Viết `src/client/controllers/WizardController.ts`**
```ts
import { parseUploadUri } from "@/client/media/footageFactory";
import type { DraftRepository } from "@/client/storage/DraftRepository";
import type { DraftBody } from "@/client/storage/ProjectDraft";
import type { UploadRepository } from "@/client/storage/UploadRepository";
import { canEnter, firstIncompleteStep, STEPS, type StepId } from "./readiness";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface WizardState {
  step: StepId;
  booting: boolean;
  resume: { savedAt: string; title: string } | null;
  error: string | null;
}

export interface WizardDeps {
  session: StudioSession;
  drafts: Pick<DraftRepository, "load" | "clear">;
  uploads: Pick<UploadRepository, "list" | "delete">;
  onAuthLost?: () => void;
}

/** Điều hướng 5 bước, mở lại/bỏ bản nháp, dự án mới, dọn file tải lên không còn dùng. */
export class WizardController extends StateController<WizardState> {
  private pending: (DraftBody & { savedAt: string }) | null = null;

  constructor(private readonly deps: WizardDeps) {
    super({ step: "news", booting: false, resume: null, error: null }, deps.onAuthLost);
  }

  async boot(): Promise<void> {
    this.patch({ booting: true, error: null });
    try {
      const draft = await this.deps.drafts.load();
      if (draft && !this.deps.session.state.project) {
        this.pending = draft;
        this.patch({ resume: { savedAt: draft.savedAt, title: draft.project.title } });
      }
    } catch (error) {
      this.patch({ error: this.report(error) });
    } finally {
      this.patch({ booting: false });
    }
  }

  async resume(): Promise<void> {
    const draft = this.pending;
    if (!draft) return;
    this.pending = null;
    try {
      this.deps.session.restore(draft);
      this.patch({ resume: null, error: null, step: firstIncompleteStep(this.deps.session.state) });
    } catch (error) {
      await this.deps.drafts.clear().catch(() => undefined);
      this.patch({ resume: null, error: this.report(error) });
    }
  }

  async discard(): Promise<void> {
    this.pending = null;
    await this.deps.drafts.clear().catch(() => undefined);
    this.patch({ resume: null, error: null });
    await this.cleanupUploads();
  }

  async newProject(): Promise<void> {
    this.pending = null;
    this.deps.session.reset();
    await this.deps.drafts.clear().catch(() => undefined);
    this.patch({ step: "news", resume: null, error: null });
    await this.cleanupUploads();
  }

  goTo(step: StepId): boolean {
    if (!canEnter(step, this.deps.session.state)) return false;
    this.patch({ step });
    return true;
  }

  next(): boolean {
    const index = STEPS.findIndex((s) => s.id === this.state.step);
    const target = STEPS[index + 1];
    return target ? this.goTo(target.id) : false;
  }

  back(): void {
    const index = STEPS.findIndex((s) => s.id === this.state.step);
    const target = STEPS[index - 1];
    if (target) this.patch({ step: target.id });
  }

  /** Xoá file tải lên không còn được cảnh trám hay nhạc đang dùng tham chiếu. Lỗi bỏ qua (dọn dẹp tuỳ chọn). */
  async cleanupUploads(): Promise<void> {
    try {
      const { footage, music } = this.deps.session.state;
      const used = new Set<string>();
      for (const sceneId of footage.sceneIds()) {
        const snap = footage.get(sceneId)?.snapshot();
        if (snap && snap.kind !== "fallback") {
          const id = parseUploadUri(snap.source.uri);
          if (id) used.add(id);
        }
      }
      const musicId = music ? parseUploadUri(music.uri) : null;
      if (musicId) used.add(musicId);
      for (const meta of await this.deps.uploads.list()) {
        if (!used.has(meta.id)) await this.deps.uploads.delete(meta.id);
      }
    } catch {
      // dọn dẹp không bắt buộc
    }
  }
}
```

- [ ] **Step 4: Viết `src/client/controllers/createStudio.ts`**
```ts
import type { ClientServices } from "@/client/container";
import { defaultKeywordSuggester } from "@/client/services/KeywordSuggester";
import { randomIds, type IdGenerator } from "@/domain/ids";
import { BrandController } from "./BrandController";
import { FootageController } from "./FootageController";
import { FootageSearchController } from "./FootageSearchController";
import { MusicController } from "./MusicController";
import { ProjectController } from "./ProjectController";
import { RenderController } from "./RenderController";
import { RenderJobBuilder } from "./RenderJobBuilder";
import { StudioSession, type SessionDeps } from "./StudioSession";
import { VoiceController } from "./VoiceController";
import { WizardController } from "./WizardController";

export interface StudioOptions {
  onAuthLost?: () => void;
  schedule?: SessionDeps["schedule"];
  ids?: IdGenerator;
}

export interface Studio {
  services: ClientServices;
  session: StudioSession;
  wizard: WizardController;
  brand: BrandController;
  project: ProjectController;
  voice: VoiceController;
  footage: FootageController;
  search: FootageSearchController;
  music: MusicController;
  render: RenderController;
  dispose(): void;
}

const browserSchedule: SessionDeps["schedule"] = (fn, ms) => {
  const handle = setTimeout(fn, ms);
  return () => clearTimeout(handle);
};

/** Lắp session và mọi controller của trình 5 bước từ các dịch vụ client. */
export function createStudio(services: ClientServices, options: StudioOptions = {}): Studio {
  const ids = options.ids ?? randomIds();
  const onAuthLost = options.onAuthLost;
  const session = new StudioSession({
    drafts: services.drafts,
    ids,
    schedule: options.schedule ?? browserSchedule,
  });
  const builder = new RenderJobBuilder({
    templates: services.templates,
    uploads: services.uploads,
    tracks: services.tracks,
    decoder: services.decoder,
    origin: services.env.origin,
  });
  const keywordSources = new Map<string, ReturnType<typeof defaultKeywordSuggester>>();
  const keywords = (fallback: string) => {
    let source = keywordSources.get(fallback);
    if (!source) {
      source = defaultKeywordSuggester(fallback);
      keywordSources.set(fallback, source);
    }
    return source;
  };

  const search = new FootageSearchController({ session, stock: services.stock, keywords, templates: services.templates, ids, onAuthLost });
  const render = new RenderController({
    session,
    builder,
    render: (job, onProgress) => services.render.render(job, onProgress),
    cancelRender: () => services.render.cancel(),
    support: services.support,
    probeWorker: () => services.render.probe(),
    createUrl: (blob) => services.env.createUrl(blob),
    revokeUrl: (url) => services.env.revokeUrl(url),
    onAuthLost,
  });

  return {
    services,
    session,
    wizard: new WizardController({ session, drafts: services.drafts, uploads: services.uploads, onAuthLost }),
    brand: new BrandController({ session, templates: services.templates, brands: services.brands, onAuthLost }),
    project: new ProjectController({ session, ids, onAuthLost }),
    voice: new VoiceController({ session, tts: services.tts, decoder: services.decoder, onAuthLost }),
    footage: new FootageController({ session, uploads: services.uploads, probe: services.probe, ids, onAuthLost }),
    search,
    music: new MusicController({
      session,
      library: services.music,
      uploads: services.uploads,
      tracks: services.tracks,
      probe: services.probe,
      onAuthLost,
    }),
    render,
    dispose() {
      render.dispose();
      search.cancel();
      void session.flush();
    },
  };
}
```
- [ ] **Step 5: Chạy test, typecheck, lint** — `npx vitest run` → PASS; sạch.

- [ ] **Step 6: Commit** (điều phối viên) — `feat(controllers): điều hướng 5 bước, bản nháp, dự án mới và createStudio`

---

### Task 10: View nền — `useController`, `StudioApp`, `StudioShell`, `Stepper`, `StepNews`, `BrandPanel`

**Files:**
- Create: `src/views/hooks/useController.ts`, `src/views/studio/StudioApp.tsx`, `src/views/studio/StudioShell.tsx`, `src/views/studio/Stepper.tsx`, `src/views/studio/steps/StepNews.tsx`, `src/views/studio/components/BrandPanel.tsx`
- Modify: `src/app/studio/page.tsx`
- Test: không có unit test (môi trường Node, không jsdom). Kiểm bằng `npm run typecheck`, `npm run lint`, `npm run build`; chạy thật ở Task 13.

**Interfaces:**
- Consumes: `Studio`, `createStudio`, `createClientServices`, `browserEnv`, `StateController.state/subscribe`, `StudioSession.state/subscribe`, `readiness` (`STEPS`, `canEnter`, `stepReady`), `SAMPLE_NEWS`, `toDateInput`.
- Produces: `useController<S>(source: { readonly state: S; readonly subscribe: (l: () => void) => () => void }): S`; `StudioApp()` (component client, không prop); `StudioShell({ studio })`; `Stepper({ current, data, onSelect })`; `StepNews({ studio })`; `BrandPanel({ studio, templateId })`.
- Quy tắc View: chỉ đọc state bằng `useController` và gọi phương thức controller; không `fetch`, không IndexedDB, không phân tích ngày/quy tắc nghiệp vụ (đã có `createFromForm`, `updateMetaFromForm`). Văn bản giao diện tiếng Việt có dấu. Dùng lớp Tailwind kiểu tối như `DevRenderPanel` hiện có (`bg-neutral-800`, `text-neutral-400`, `bg-emerald-600`, `text-red-400`).

- [ ] **Step 1: Viết `src/views/hooks/useController.ts`**
```ts
"use client";

import { useSyncExternalStore } from "react";

export interface Observable<S> {
  readonly state: S;
  readonly subscribe: (listener: () => void) => () => void;
}

/** Đọc trạng thái của một controller (hoặc StudioSession) và vẽ lại khi nó đổi. */
export function useController<S>(source: Observable<S>): S {
  return useSyncExternalStore(
    source.subscribe,
    () => source.state,
    () => source.state,
  );
}
```

- [ ] **Step 2: Viết `src/views/studio/StudioApp.tsx`**
```tsx
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { browserEnv, createClientServices } from "@/client/container";
import { createStudio, type Studio } from "@/client/controllers/createStudio";
import { StudioShell } from "./StudioShell";

let instance: Studio | null = null;

/** Tạo studio một lần ở trình duyệt (cần window); trên server và lúc hydrate trả null. */
function getStudio(): Studio {
  if (!instance) {
    instance = createStudio(createClientServices(browserEnv()), {
      onAuthLost: () => window.location.assign(`/dang-nhap?next=${encodeURIComponent("/studio")}`),
    });
  }
  return instance;
}

const noopSubscribe = () => () => {};

export function StudioApp() {
  const studio = useSyncExternalStore(noopSubscribe, getStudio, () => null);

  useEffect(() => {
    if (!studio) return;
    void studio.wizard.boot();
    return () => studio.dispose();
  }, [studio]);

  if (!studio) return <p className="mt-8 text-neutral-400">Đang tải…</p>;
  return <StudioShell studio={studio} />;
}
```

- [ ] **Step 3: Viết `src/views/studio/Stepper.tsx`**
```tsx
"use client";

import { STEPS, canEnter, stepReady, type StepId } from "@/client/controllers/readiness";
import type { StudioData } from "@/client/controllers/StudioSession";

interface Props {
  current: StepId;
  data: StudioData;
  onSelect: (id: StepId) => void;
}

export function Stepper({ current, data, onSelect }: Props) {
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {STEPS.map((step, index) => {
        const enabled = canEnter(step.id, data);
        const active = step.id === current;
        const done = (step.id === "news" || step.id === "voice") && stepReady(step.id, data);
        return (
          <li key={step.id}>
            <button
              type="button"
              disabled={!enabled}
              aria-current={active ? "step" : undefined}
              onClick={() => onSelect(step.id)}
              className={`rounded-full px-3 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? "bg-emerald-600 font-medium text-white" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
              }`}
            >
              {index + 1}. {step.label}
              {done ? " ✓" : ""}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 4: Viết `src/views/studio/StudioShell.tsx`** (các Step 2–5 được thêm vào `renderStep` ở Task 11 và 12; ở task này `voice`, `footage`, `music`, `render` hiện khung chờ)
```tsx
"use client";

import type { Studio } from "@/client/controllers/createStudio";
import { STEPS, canEnter, type StepId } from "@/client/controllers/readiness";
import { useController } from "@/views/hooks/useController";
import { Stepper } from "./Stepper";
import { StepNews } from "./steps/StepNews";

const BLOCKED_HINT: Partial<Record<StepId, string>> = {
  news: "Hãy chia cảnh từ tin của bạn trước.",
  voice: "Hãy tạo giọng cho mọi câu trước khi tiếp tục.",
};

function renderStep(step: StepId, studio: Studio) {
  switch (step) {
    case "news":
      return <StepNews studio={studio} />;
    default:
      return <p className="text-neutral-400">Bước này sẽ có ở task sau.</p>;
  }
}

export function StudioShell({ studio }: { studio: Studio }) {
  const wizard = useController(studio.wizard);
  const data = useController(studio.session);
  const index = STEPS.findIndex((s) => s.id === wizard.step);
  const nextStep = STEPS[index + 1];
  const nextEnabled = nextStep ? canEnter(nextStep.id, data) : false;

  return (
    <div className="mt-6 flex flex-col gap-6">
      {wizard.resume && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-800 p-4 text-sm">
          <span>
            Có bản nháp “{wizard.resume.title}” lưu lúc {new Date(wizard.resume.savedAt).toLocaleString("vi-VN")}.
          </span>
          <button type="button" className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium" onClick={() => void studio.wizard.resume()}>
            Mở lại
          </button>
          <button type="button" className="rounded-md bg-neutral-700 px-3 py-1.5" onClick={() => void studio.wizard.discard()}>
            Bỏ bản nháp
          </button>
        </div>
      )}
      <Stepper current={wizard.step} data={data} onSelect={(id) => studio.wizard.goTo(id)} />
      {wizard.error && (
        <p role="alert" className="text-red-400">
          {wizard.error}
        </p>
      )}
      <section>{renderStep(wizard.step, studio)}</section>
      <nav className="flex flex-wrap items-center gap-3 border-t border-neutral-800 pt-4">
        <button
          type="button"
          disabled={index === 0}
          className="rounded-md bg-neutral-800 px-4 py-2 disabled:opacity-40"
          onClick={() => studio.wizard.back()}
        >
          Quay lại
        </button>
        {nextStep && (
          <button
            type="button"
            disabled={!nextEnabled}
            className="rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-40"
            onClick={() => studio.wizard.next()}
          >
            Tiếp tục: {nextStep.label}
          </button>
        )}
        {nextStep && !nextEnabled && BLOCKED_HINT[wizard.step] && (
          <span className="text-sm text-neutral-400">{BLOCKED_HINT[wizard.step]}</span>
        )}
        <button
          type="button"
          className="ml-auto rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300"
          onClick={() => {
            if (window.confirm("Bắt đầu dự án mới? Dự án hiện tại, giọng đã tạo và file tải lên sẽ bị xoá.")) {
              void studio.wizard.newProject();
            }
          }}
        >
          Dự án mới
        </button>
      </nav>
    </div>
  );
}
```

- [ ] **Step 5: Viết `src/views/studio/components/BrandPanel.tsx`**
```tsx
"use client";

import { useEffect } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { useController } from "@/views/hooks/useController";

export function BrandPanel({ studio, templateId }: { studio: Studio; templateId: string }) {
  const brand = useController(studio.brand);

  useEffect(() => {
    void studio.brand.load(templateId);
  }, [studio, templateId]);

  if (brand.templateId !== templateId) return null;
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-neutral-800 p-4">
      <legend className="px-2 text-sm text-neutral-400">Thương hiệu của phong cách này</legend>
      {brand.specs.map((spec) =>
        spec.type === "image" ? (
          <div key={spec.key} className="flex flex-col gap-1 text-sm">
            {spec.label}
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) studio.brand.setLogo(file);
                  e.target.value = "";
                }}
              />
              {brand.logo && (
                <button type="button" className="rounded-md bg-neutral-800 px-3 py-1" onClick={() => studio.brand.clearLogo()}>
                  Bỏ logo ({Math.round(brand.logo.size / 1024)} KB)
                </button>
              )}
            </div>
          </div>
        ) : (
          <label key={spec.key} className="flex flex-col gap-1 text-sm">
            {spec.label}
            <input
              type={spec.type === "color" ? "color" : "text"}
              maxLength={spec.maxLength}
              className="rounded-md bg-neutral-800 px-3 py-2"
              value={brand.values[spec.key] ?? ""}
              onChange={(e) => studio.brand.setValue(spec.key, e.target.value)}
            />
          </label>
        ),
      )}
      {brand.error && (
        <p role="alert" className="text-sm text-red-400">
          {brand.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm"
          onClick={() => void studio.brand.save()}
        >
          Lưu thương hiệu
        </button>
        {brand.saved && <span className="text-sm text-emerald-400">Đã lưu trên máy này</span>}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 6: Viết `src/views/studio/steps/StepNews.tsx`**
```tsx
"use client";

import { useRef, useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { toDateInput } from "@/client/controllers/dateText";
import { SAMPLE_NEWS } from "@/client/sample/sampleNews";
import { useController } from "@/views/hooks/useController";
import { BrandPanel } from "../components/BrandPanel";

export function StepNews({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const projectState = useController(studio.project);
  const templates = studio.services.templates.list();
  const project = data.project;

  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [credit, setCredit] = useState("");
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const textareas = useRef<Record<string, HTMLTextAreaElement | null>>({});

  if (!project) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Nhập tin</h2>
        <label className="flex flex-col gap-1 text-sm">
          Nội dung tin (dán vào đây)
          <textarea
            className="min-h-48 rounded-md bg-neutral-800 px-3 py-2"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mỗi câu sẽ thành một cảnh."
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tiêu đề (để trống thì lấy câu đầu tiên)
          <input className="rounded-md bg-neutral-800 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Theo: nguồn tin (tối đa 80 ký tự)
            <input
              className="rounded-md bg-neutral-800 px-3 py-2"
              value={credit}
              maxLength={80}
              onChange={(e) => setCredit(e.target.value)}
              placeholder="Đức Phong - VietNamNet"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ngày đăng
            <input type="date" className="rounded-md bg-neutral-800 px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Phong cách video
          <select className="rounded-md bg-neutral-800 px-3 py-2" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {templateId && <BrandPanel studio={studio} templateId={templateId} />}
        {projectState.error && (
          <p role="alert" className="text-red-400">
            {projectState.error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-4 py-2 font-medium"
            onClick={() => studio.project.createFromForm({ text, title, sourceCredit: credit, publishDateText: date, templateId })}
          >
            Chia cảnh
          </button>
          <button
            type="button"
            className="rounded-md bg-neutral-800 px-4 py-2"
            onClick={() => {
              setText(SAMPLE_NEWS.text);
              setCredit(SAMPLE_NEWS.sourceCredit);
              setDate(toDateInput(SAMPLE_NEWS.publishDate));
            }}
          >
            Điền tin mẫu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Các cảnh ({project.scenes.length})</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Theo: nguồn tin
          <input
            className="rounded-md bg-neutral-800 px-3 py-2"
            defaultValue={project.sourceCredit}
            maxLength={80}
            onBlur={(e) => studio.project.updateMetaFromForm({ sourceCredit: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ngày đăng
          <input
            type="date"
            className="rounded-md bg-neutral-800 px-3 py-2"
            defaultValue={toDateInput(project.publishDate)}
            onChange={(e) => studio.project.updateMetaFromForm({ publishDateText: e.target.value })}
          />
        </label>
      </div>
      <BrandPanel studio={studio} templateId={project.templateId} />
      {projectState.error && (
        <p role="alert" className="text-red-400">
          {projectState.error}
        </p>
      )}
      <ol className="flex flex-col gap-3">
        {project.scenes.map((scene, index) => (
          <li key={`${scene.id}:${scene.text}`} className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-3">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>{scene.role === "intro" ? "Cảnh mở đầu (tiêu đề)" : `Cảnh ${index}`}</span>
              <span>{scene.text.length} ký tự</span>
            </div>
            <textarea
              ref={(el) => {
                textareas.current[scene.id] = el;
              }}
              className="min-h-16 rounded-md bg-neutral-800 px-3 py-2 text-sm"
              defaultValue={scene.text}
              onBlur={(e) => {
                if (e.target.value !== scene.text) studio.project.updateSceneText(scene.id, e.target.value);
              }}
            />
            {scene.role === "body" && (
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  className="rounded-md bg-neutral-800 px-3 py-1"
                  disabled={index === project.scenes.length - 1}
                  onClick={() => studio.project.mergeWithNext(scene.id)}
                >
                  Gộp với câu sau
                </button>
                <button
                  type="button"
                  className="rounded-md bg-neutral-800 px-3 py-1"
                  onClick={() => studio.project.splitScene(scene.id, textareas.current[scene.id]?.selectionStart ?? 0)}
                >
                  Tách tại con trỏ
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
```
Ghi chú: `defaultValue` của `<textarea>` không tự cập nhật khi chữ của cảnh đổi từ bên ngoài (gộp, tách), nên `key` của `<li>` gồm cả `scene.id` lẫn `scene.text` để ô nhập dựng lại.

- [ ] **Step 7: Sửa `src/app/studio/page.tsx`** — import `StudioApp` từ `@/views/studio/StudioApp`; đổi `<main className="mx-auto max-w-3xl p-6">` thành `max-w-4xl`; thay dòng `<p className="mt-8 text-neutral-400">Trình dựng 5 bước sẽ có ở chặng 3.</p>` bằng `<StudioApp />`.

- [ ] **Step 8: Chạy `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`** — đều sạch. Lint `react-hooks` có thể cảnh báo về `ref` trong render của `textareas.current[...] = el`: dùng callback ref như trên là đúng cách, không đọc `.current` khi render.

- [ ] **Step 9: Commit** (điều phối viên) — `feat(views): khung trình 5 bước, bước nhập tin và bộ thương hiệu`

---

### Task 11: View bước 2 và bước 3 — `StepVoice`, `StepFootage`, `FootagePreview`

**Files:**
- Create: `src/views/studio/steps/StepVoice.tsx`, `src/views/studio/steps/StepFootage.tsx`, `src/views/studio/components/FootagePreview.tsx`
- Modify: `src/views/studio/StudioShell.tsx` (nối hai bước vào `renderStep`)
- Test: không có unit test; `npm run typecheck`, `npm run lint`, `npm run build`.

**Interfaces:**
- Consumes: `Studio`, `useController`, `staleSceneIds`, `studio.voice` (`loadVoices`, `selectVoice`, `setRate`, `generate`, `retry`, `cancel`, `previewVoice`), `studio.footage` (`addFiles`, `replaceWithFile`, `pool`, `assignFromPool`, `unassign`, `swap`, `previewSource`), `studio.search` (`autoFill`, `search`, `choose`, `cancel`), `studio.services.env` (`createUrl`, `revokeUrl`).
- Produces: `StepVoice({ studio })`, `StepFootage({ studio })`, `FootagePreview({ studio, footage })`.

- [ ] **Step 1: Viết `src/views/studio/steps/StepVoice.tsx`**
```tsx
"use client";

import { useEffect, useRef } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { staleSceneIds } from "@/client/controllers/readiness";
import { useController } from "@/views/hooks/useController";

export function StepVoice({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const voice = useController(studio.voice);
  const playing = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);

  useEffect(() => {
    void studio.voice.loadVoices();
  }, [studio]);

  useEffect(
    () => () => {
      playing.current?.audio.pause();
      if (playing.current) studio.services.env.revokeUrl(playing.current.url);
    },
    [studio],
  );

  const project = data.project;
  if (!project) return null;
  const stale = new Set(staleSceneIds(data));
  const settings = data.voice;

  async function preview() {
    const blob = await studio.voice.previewVoice();
    if (!blob) return;
    if (playing.current) {
      playing.current.audio.pause();
      studio.services.env.revokeUrl(playing.current.url);
    }
    const url = studio.services.env.createUrl(blob);
    const audio = new Audio(url);
    playing.current = { audio, url };
    void audio.play();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Chọn giọng đọc</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Giọng
          <select
            className="rounded-md bg-neutral-800 px-3 py-2"
            value={settings?.voiceName ?? ""}
            onChange={(e) => studio.voice.selectVoice(e.target.value)}
          >
            {voice.voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.gender}, {v.tier})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tốc độ đọc: {(settings?.speakingRate ?? 1.07).toFixed(2)}
          <input
            type="range"
            min={0.8}
            max={1.3}
            step={0.01}
            value={settings?.speakingRate ?? 1.07}
            onChange={(e) => studio.voice.setRate(Number(e.target.value))}
          />
        </label>
      </div>
      {voice.voicesLoading && <p className="text-sm text-neutral-400">Đang tải danh sách giọng…</p>}
      {voice.error && (
        <p role="alert" className="text-red-400">
          {voice.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={voice.previewing || !settings}
          className="rounded-md bg-neutral-800 px-4 py-2 disabled:opacity-50"
          onClick={() => void preview()}
        >
          {voice.previewing ? "Đang đọc thử…" : "Nghe thử câu tiêu đề"}
        </button>
        <button
          type="button"
          disabled={voice.generating || stale.size === 0 || !settings}
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-50"
          onClick={() => void studio.voice.generate()}
        >
          {stale.size === project.scenes.length ? "Tạo giọng" : stale.size === 0 ? "Giọng đã đủ" : `Tạo lại ${stale.size} câu`}
        </button>
        {voice.generating && (
          <button type="button" className="rounded-md bg-neutral-800 px-4 py-2" onClick={() => studio.voice.cancel()}>
            Dừng
          </button>
        )}
      </div>
      {voice.progress && (
        <div className="flex flex-col gap-1 text-sm">
          <span>
            Đang tạo giọng {voice.progress.done}/{voice.progress.total}
          </span>
          <progress className="w-full" max={voice.progress.total} value={voice.progress.done} />
        </div>
      )}
      <ol className="flex flex-col gap-2">
        {project.scenes.map((scene, index) => {
          const narration = data.narrations.get(scene.id);
          const failed = voice.failed[scene.id];
          return (
            <li key={scene.id} className="flex items-start gap-3 rounded-lg border border-neutral-800 p-3 text-sm">
              <span className="w-6 shrink-0 text-neutral-500">{index + 1}</span>
              <span className="flex-1">{scene.text}</span>
              {failed ? (
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-red-400">{failed}</span>
                  <button
                    type="button"
                    disabled={voice.generating}
                    className="rounded-md bg-neutral-800 px-3 py-1 disabled:opacity-50"
                    onClick={() => void studio.voice.retry(scene.id)}
                  >
                    Thử lại
                  </button>
                </span>
              ) : stale.has(scene.id) ? (
                <span className="shrink-0 text-amber-400">{narration ? "Giọng cũ, cần tạo lại" : "Chưa có giọng"}</span>
              ) : (
                <span className="shrink-0 text-emerald-400">✓ {narration?.durationSec.toFixed(1)} giây</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Viết `src/views/studio/components/FootagePreview.tsx`**
```tsx
"use client";

import { useEffect, useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import type { Footage } from "@/domain/Footage";

export function FootagePreview({ studio, footage }: { studio: Studio; footage: Footage | undefined }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void studio.footage.previewSource(footage).then((source) => {
      if (cancelled) return;
      if (source instanceof Blob) {
        objectUrl = studio.services.env.createUrl(source);
        setSrc(objectUrl);
      } else {
        setSrc(source);
      }
    });
    return () => {
      cancelled = true;
      if (objectUrl) studio.services.env.revokeUrl(objectUrl);
    };
  }, [studio, footage]);

  const box = "aspect-video w-full max-w-60 overflow-hidden rounded-md bg-neutral-800 object-cover";
  if (!footage || footage.kind === "fallback" || !src) {
    return <div className={`${box} flex items-center justify-center text-xs text-neutral-500`}>Nền mặc định</div>;
  }
  return footage.kind === "video" ? (
    <video className={box} src={src} muted loop autoPlay playsInline />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={box} src={src} alt="Cảnh trám đang chọn" />
  );
}
```

- [ ] **Step 3: Viết `src/views/studio/steps/StepFootage.tsx`**
```tsx
"use client";

import { useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { useController } from "@/views/hooks/useController";
import { FootagePreview } from "../components/FootagePreview";

const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.mov";

function SceneCard({ studio, sceneId, index }: { studio: Studio; sceneId: string; index: number }) {
  const data = useController(studio.session);
  useController(studio.footage); // vẽ lại khi kho file tải lên đổi (nguồn của danh sách "Dùng file đã tải lên")
  const search = useController(studio.search);
  const project = data.project;
  const scene = project?.scenes.find((s) => s.id === sceneId);
  const state = search.byScene[sceneId];
  const [query, setQuery] = useState<string | null>(null);
  if (!project || !scene) return null;
  const current = data.footage.get(sceneId);
  const others = project.scenes.filter((s) => s.id !== sceneId);
  const pool = studio.footage.pool();

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-neutral-800 p-3">
      <div className="text-sm">
        <span className="text-neutral-500">{index === 0 ? "Mở đầu" : `Cảnh ${index}`}: </span>
        {scene.text}
      </div>
      <FootagePreview studio={studio} footage={current} />
      <form
        className="flex flex-wrap items-center gap-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void studio.search.search(sceneId, query ?? state?.query ?? "");
        }}
      >
        <input
          className="min-w-40 flex-1 rounded-md bg-neutral-800 px-3 py-1.5"
          placeholder="Từ khoá tiếng Anh (ví dụ: police car)"
          value={query ?? state?.query ?? ""}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={state?.loading} className="rounded-md bg-neutral-700 px-3 py-1.5 disabled:opacity-50">
          Tìm lại
        </button>
      </form>
      {state?.loading && <p className="text-sm text-neutral-400">Đang tìm…</p>}
      {state?.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state?.empty && (
        <p className="text-sm text-amber-400">Không tìm ra kết quả. Hãy sửa từ khoá; nếu bỏ qua, cảnh dùng nền mặc định.</p>
      )}
      {state && state.items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {state.items.map((item) => (
            <button
              key={`${item.provider}-${item.kind}-${item.id}`}
              type="button"
              title={`${item.kind === "video" ? "Video" : "Ảnh"} · ${item.author}`}
              className="relative overflow-hidden rounded-md ring-emerald-500 hover:ring-2"
              onClick={() => studio.search.choose(sceneId, item)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="h-16 w-28 object-cover" src={item.thumbUrl} alt={item.kind === "video" ? "Video gợi ý" : "Ảnh gợi ý"} />
              {item.kind === "video" && <span className="absolute bottom-0 right-0 bg-black/70 px-1 text-xs">▶</span>}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="cursor-pointer rounded-md bg-neutral-800 px-3 py-1.5 hover:bg-neutral-700">
          Tải file thay thế
          <input
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void studio.footage.replaceWithFile(sceneId, file);
              e.target.value = "";
            }}
          />
        </label>
        <button type="button" className="rounded-md bg-neutral-800 px-3 py-1.5" onClick={() => studio.footage.unassign(sceneId)}>
          Dùng nền mặc định
        </button>
        <select
          className="rounded-md bg-neutral-800 px-2 py-1.5"
          value=""
          onChange={(e) => {
            if (e.target.value) studio.footage.swap(sceneId, e.target.value);
          }}
        >
          <option value="">Hoán đổi với…</option>
          {others.map((s) => (
            <option key={s.id} value={s.id}>
              {s.role === "intro" ? "Mở đầu" : `Cảnh ${project.scenes.indexOf(s)}`}
            </option>
          ))}
        </select>
        {pool.length > 0 && (
          <select
            className="rounded-md bg-neutral-800 px-2 py-1.5"
            value=""
            onChange={(e) => {
              if (e.target.value) studio.footage.assignFromPool(sceneId, e.target.value);
            }}
          >
            <option value="">Dùng file đã tải lên…</option>
            {pool.map((f, i) => (
              <option key={f.id} value={f.id}>
                File {i + 1} ({f.kind === "video" ? "video" : "ảnh"})
              </option>
            ))}
          </select>
        )}
      </div>
    </li>
  );
}

export function StepFootage({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const footage = useController(studio.footage);
  const search = useController(studio.search);
  const project = data.project;
  if (!project) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Duyệt cảnh trám</h2>
      <p className="text-sm text-neutral-400">
        Tải ảnh/video của bạn lên (gán lần lượt vào các cảnh còn trống), rồi để app tự tìm cảnh trám cho cảnh còn lại. Bấm vào ảnh
        gợi ý để đổi.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-md bg-neutral-800 px-4 py-2 hover:bg-neutral-700">
          Tải ảnh/video lên
          <input
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) void studio.footage.addFiles(files);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          disabled={search.autoRunning}
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-50"
          onClick={() => void studio.search.autoFill()}
        >
          {search.autoRunning ? "Đang tìm…" : "Tự tìm cảnh còn trống"}
        </button>
        {search.autoRunning && (
          <button type="button" className="rounded-md bg-neutral-800 px-4 py-2" onClick={() => studio.search.cancel()}>
            Dừng
          </button>
        )}
        {footage.busy && <span className="text-sm text-neutral-400">Đang xử lý file…</span>}
      </div>
      {footage.error && (
        <p role="alert" className="text-sm text-red-400">
          {footage.error}
        </p>
      )}
      {search.warnings.map((w) => (
        <p key={w} className="text-sm text-amber-400">
          {w}
        </p>
      ))}
      <ol className="flex flex-col gap-3">
        {project.scenes.map((scene, index) => (
          <SceneCard key={scene.id} studio={studio} sceneId={scene.id} index={index} />
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Sửa `StudioShell.tsx`** — import `StepVoice` và `StepFootage`; trong `renderStep` thêm `case "voice": return <StepVoice studio={studio} />;` và `case "footage": return <StepFootage studio={studio} />;`.

- [ ] **Step 5: Chạy `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`** — sạch.

- [ ] **Step 6: Commit** (điều phối viên) — `feat(views): bước chọn giọng và duyệt cảnh trám`

---

### Task 12: View bước 4 và bước 5, gỡ trang dựng thử

**Files:**
- Create: `src/views/studio/steps/StepMusic.tsx`, `src/views/studio/steps/StepRender.tsx`
- Modify: `src/views/studio/StudioShell.tsx` (nối hai bước)
- Delete: `src/client/controllers/DevRenderController.ts`, `src/views/dev/DevRenderPanel.tsx`, `src/app/dev/dung-thu/page.tsx`, `tests/client/DevRenderController.test.ts` (trình thật thay thế trang dựng thử; tin mẫu đã chuyển thành nút "Điền tin mẫu")
- Test: không có unit test mới; toàn bộ test hiện có còn lại phải đạt.

**Interfaces:**
- Consumes: `studio.music` (`loadLibrary`, `choose`, `none`, `setGainOffset`, `uploadTrack`, `previewBlob`), `studio.render` (`checkSupport`, `start`, `cancel`), `RenderState`, `studio.services.env`.
- Produces: `StepMusic({ studio })`, `StepRender({ studio })`.

- [ ] **Step 1: Viết `src/views/studio/steps/StepMusic.tsx`**
```tsx
"use client";

import { useEffect, useRef } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { useController } from "@/views/hooks/useController";

export function StepMusic({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const music = useController(studio.music);
  const playing = useRef<{ audio: HTMLAudioElement; url: string; trackId: string } | null>(null);

  useEffect(() => {
    void studio.music.loadLibrary();
  }, [studio]);

  function stop() {
    if (!playing.current) return;
    playing.current.audio.pause();
    studio.services.env.revokeUrl(playing.current.url);
    playing.current = null;
  }

  useEffect(
    () => () => {
      if (playing.current) {
        playing.current.audio.pause();
        studio.services.env.revokeUrl(playing.current.url);
        playing.current = null;
      }
    },
    [studio],
  );

  const tracks = [...music.library, ...music.uploaded];
  const selected = data.music;

  async function toggle(trackId: string) {
    const wasPlaying = playing.current?.trackId === trackId;
    stop();
    if (wasPlaying) return;
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const blob = await studio.music.previewBlob(track);
    if (!blob) return;
    const url = studio.services.env.createUrl(blob);
    const audio = new Audio(url);
    audio.onended = () => stop();
    playing.current = { audio, url, trackId };
    void audio.play();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Nhạc nền</h2>
      {music.loading && <p className="text-sm text-neutral-400">Đang tải kho nhạc…</p>}
      {music.error && (
        <p role="alert" className="text-red-400">
          {music.error}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        <li className="flex items-center gap-3 rounded-lg border border-neutral-800 p-3 text-sm">
          <label className="flex flex-1 items-center gap-2">
            <input type="radio" name="music" checked={selected === null} onChange={() => studio.music.none()} />
            Không dùng nhạc
          </label>
        </li>
        {tracks.map((track) => (
          <li key={track.id} className="flex items-center gap-3 rounded-lg border border-neutral-800 p-3 text-sm">
            <label className="flex flex-1 items-center gap-2">
              <input type="radio" name="music" checked={selected?.id === track.id} onChange={() => studio.music.choose(track)} />
              {track.title}
              {track.origin === "upload" && <span className="text-xs text-neutral-500">(của bạn)</span>}
            </label>
            <button type="button" className="rounded-md bg-neutral-800 px-3 py-1" onClick={() => void toggle(track.id)}>
              Nghe thử
            </button>
          </li>
        ))}
      </ul>
      <label className="w-fit cursor-pointer rounded-md bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
        {music.busy ? "Đang xử lý…" : "Tải nhạc của bạn lên (MP3, WAV, M4A)"}
        <input
          type="file"
          accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void studio.music.uploadTrack(file);
            e.target.value = "";
          }}
        />
      </label>
      {selected && (
        <label className="flex flex-col gap-1 text-sm">
          Âm lượng nhạc: thấp hơn giọng {selected.levelBelowVoiceDb} dB (mặc định 15 dB)
          <input
            type="range"
            min={-6}
            max={6}
            step={1}
            value={selected.gainOffsetDb}
            onChange={(e) => studio.music.setGainOffset(Number(e.target.value))}
          />
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Viết `src/views/studio/steps/StepRender.tsx`**
```tsx
"use client";

import { useEffect } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { useController } from "@/views/hooks/useController";

export function StepRender({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const render = useController(studio.render);
  const project = data.project;

  useEffect(() => {
    void studio.render.checkSupport();
  }, [studio]);

  if (!project) return null;
  const voiceSeconds = [...data.narrations.values()].reduce((sum, n) => sum + n.durationSec, 0);
  const working = render.status === "working";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Dựng và tải về</h2>
      <p className="text-sm text-neutral-400">
        {project.scenes.length} cảnh, giọng đọc khoảng {voiceSeconds.toFixed(0)} giây, nhạc: {data.music ? data.music.title : "không dùng"}.
      </p>
      {render.status === "unsupported" && (
        <p role="alert" className="text-red-400">
          Hãy dùng Chrome hoặc Edge bản mới. Thiếu: {render.missing.join(", ")}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={working || render.status === "unsupported"}
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium disabled:opacity-50"
          onClick={() => void studio.render.start()}
        >
          {render.status === "done" || render.status === "error" ? "Dựng lại" : "Dựng video"}
        </button>
        {working && (
          <button type="button" className="rounded-md bg-neutral-800 px-4 py-2" onClick={() => studio.render.cancel()}>
            Huỷ
          </button>
        )}
      </div>
      {render.status === "working" && (
        <div className="flex flex-col gap-1 text-sm">
          <span>{render.label}</span>
          <progress className="w-full" max={100} value={render.percent} />
        </div>
      )}
      {render.status === "error" && (
        <p role="alert" className="text-red-400">
          {render.message}
        </p>
      )}
      {render.status === "done" && (
        <div className="flex flex-col gap-2">
          <video data-testid="ket-qua" className="w-full max-w-[360px] rounded-lg" src={render.url} controls playsInline />
          <p className="text-sm text-neutral-400">
            {render.durationSec.toFixed(1)} giây, {(render.sizeBytes / 1024 / 1024).toFixed(1)} MB
          </p>
          {render.warnings.map((w) => (
            <p key={w} className="text-sm text-amber-400">
              {w}
            </p>
          ))}
          <a className="text-emerald-400 underline" href={render.url} download={render.fileName}>
            Tải MP4 ({render.fileName})
          </a>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Sửa `StudioShell.tsx`** — import `StepMusic`, `StepRender`; trong `renderStep` thêm `case "music"` và `case "render"`, và **xoá** nhánh `default` (hoặc để `default` trả `null` nếu TypeScript đòi đủ nhánh).

- [ ] **Step 4: Gỡ trang dựng thử** — xoá 4 file ghi ở phần Files. Chạy `grep -rn "DevRender\|dung-thu\|DEV_SAMPLE" src tests` (Grep tool) để chắc không còn tham chiếu; nếu còn trong tài liệu `docs/` thì để nguyên (lịch sử).

- [ ] **Step 5: Chạy `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build`** — sạch (số test giảm đúng bằng số test của `DevRenderController.test.ts`).

- [ ] **Step 6: Commit** (điều phối viên) — `feat(views): bước nhạc nền và dựng video; gỡ trang dựng thử`

---

### Task 13: Chạy thật trong trình duyệt và ghi số đo (điều phối viên tự làm, không giao agent)

**Files:** không sửa code (trừ khi chạy thật phát hiện lỗi). Ghi kết quả vào `.superpowers/sdd/task-13-report.md` và đặc tả mục 12 (đoạn "Kết quả chạy thật chặng 3C"); commit.

- [ ] **Step 1: Chuẩn bị** — `rm -rf .next`, dừng server cũ (nếu có), `preview_start` tên `tin-video-studio`. Mở **tab riêng** (`tabs_create`) tới `http://localhost:3100/studio` (đã đăng nhập tài khoản `hai`; nếu bị đưa về `/dang-nhap` thì đăng nhập, mật khẩu ở dòng `DEV_LOGIN` trong `.env.local`). `.env.local` có `FAKE_PROVIDERS=1`, `EDGE_TTS_DEV=1`, `EDGE_TTS_BIN`. Nếu danh sách giọng vẫn là giọng giả: `fetch('/api/tts/voices',{cache:'reload'})` rồi tải lại trang.
- [ ] **Step 2: Đi hết 5 bước** — "Điền tin mẫu" → "Chia cảnh" (kiểm 7 cảnh) → Tiếp tục → chọn giọng Hoài My → "Tạo giọng" (kiểm tiến độ và đủ 7 dấu ✓; nút Tiếp tục mở) → bước 3: "Tự tìm cảnh còn trống" (ảnh giả PNG hiện ra, mỗi cảnh một ảnh khác nhau) → bước 4: chọn nhạc kho, nghe thử, kéo âm lượng → bước 5: nhấn "Dựng video". Ghi: **thời gian dựng hình trên thời lượng video** (mục tiêu ≤ 1,5×; chặng 3A đo 0,45×), kích thước tệp, tên file tải về `…_20261014.mp4`.
- [ ] **Step 3: Kiểm chéo các hạng mục để dành từ 3A/3B (ghi từng dòng kết quả)**
  - `RenderClient.probe()` chạy thật: mở bước 5, không có thông báo "Hãy dùng Chrome hoặc Edge…" (probe trả mảng rỗng) và nút "Dựng video" bật; ghi thời gian probe trả lời (phải ≪ 8 giây).
  - `BrowserMediaProbe` với file thật: dùng `javascript_tool` tạo `File` ảnh (canvas → blob PNG) và video (tải `https://videos.pexels.com/video-files/10476430/10476430-sd_640_338_25fps.mp4` bằng `fetch` rồi bọc `File`) và nhạc (lấy `/music/ban-tin-mac-dinh.mp3`), gán vào `<input type="file">` bằng `DataTransfer` rồi phát sự kiện `change`; kiểm cảnh nhận file, video xoay không bị méo, nhạc tải lên chọn được.
  - Ảnh PNG giả của `FakeStockProvider` qua `createImageBitmap`: nền mờ và dải ảnh hiển thị đúng trong video.
  - IndexedDB thật: sau khi tạo giọng + gán file tải lên, **tải lại trang** → hộp "Có bản nháp" → "Mở lại" → nhảy tới bước đúng, âm thanh giọng còn (dựng lại không cần tạo giọng lại), file tải lên còn.
  - `trimSilence`: so thời lượng video dựng với tổng `durationSec` giọng gốc (video ngắn hơn tổng giọng + khoảng nghỉ cũ một chút nhờ cắt lặng); mức âm đoạn có tiếng ≈ −16,5…−17,5 dB, đỉnh < 0,89 (đoạn đo RMS như ở 3A).
  - Huỷ giữa lúc dựng (≈ 15 %) rồi dựng lại: nút bật lại, kết quả đúng.
  - Hết phiên: xoá cookie `tvs_session` (qua `document.cookie` nếu không phải httpOnly, hoặc đăng xuất ở tab khác) rồi bấm "Tạo giọng" hoặc "Tự tìm cảnh": trình duyệt phải chuyển về `/dang-nhap`, và bản nháp còn khi đăng nhập lại.
  - Console: không có lỗi đỏ (`read_console_messages`); `preview_logs` không có lỗi máy chủ.
- [ ] **Step 4: Nếu có lỗi** — ghi lỗi + cách tái hiện, sửa bằng một đợt sửa riêng (subagent), chạy lại bước liên quan.
- [ ] **Step 5: Ghi số đo vào đặc tả mục 12** (đoạn "Kết quả chạy thật chặng 3C"), cập nhật `00-lo-trinh.md` (dòng 3C đã xong, dòng chặng 4 chuẩn bị viết) và commit (điều phối viên).

---

## Hoàn thành chặng 3C khi

- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` sạch.
- Một người dùng đi trọn 5 bước trên `/studio` và tải về MP4 (Task 13 có số đo thật và danh sách kiểm chéo đều đạt, hoặc lỗi còn lại ghi rõ).
- Hải duyệt. Sau đó viết kế hoạch chặng 4 (Playwright toàn luồng, so khung với video mẫu, đo mức âm, deploy Vercel, hướng dẫn thêm biến môi trường) từ code thật.

## Rủi ro đã biết

- **Hiệu năng View:** `StepFootage` vẽ lại cả danh sách cảnh khi bất kỳ cảnh nào đổi (hook `useController` không chọn lọc). Với 7–15 cảnh là ổn; nếu chậm, tách `SceneCard` bằng `React.memo` hoặc đọc state theo cảnh.
- **`File` đưa vào `<input>` bằng `DataTransfer` ở Task 13** chỉ mô phỏng thao tác chọn file; không thay cho thử bằng chuột thật trên máy của Hải.
- **Dự án mới xoá mọi file tải lên không còn được dùng** (và "Bỏ bản nháp" cũng vậy). Nếu Hải muốn giữ "thư viện file" qua nhiều dự án, đổi `cleanupUploads` thành chỉ dọn file quá N ngày; việc này không ảnh hưởng tới các controller khác.
- **Giọng Google/MiniMax thật và bộ giới hạn đỉnh** chưa kiểm vì chưa có key; chạy thật dùng giọng Edge dev.
- **Bước 3 chưa có thanh tìm kiếm phân trang** (mỗi cảnh chỉ 8 gợi ý, bấm "Tìm lại" để đổi từ khoá). Thêm phân trang là việc cải tiến sau, không chặn nghiệm thu.
