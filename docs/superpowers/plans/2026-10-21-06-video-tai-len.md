# Tin Video Studio — Kiểu "Video tải lên" (thẻ tiêu đề + video của người dùng) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm kiểu video thứ hai "Video tải lên": người dùng chọn kiểu ở bước 1, chỉ nhập tiêu đề (+ nguồn tin, ngày đăng, thương hiệu), tải lên đúng một video (≤ 5 phút, ≤ 500 MB), giọng đọc chỉ đọc tiêu đề trên thẻ thumbnail kiểu Theanh28, rồi video tải lên chạy trọn độ dài trong bố cục thân bài (nền mờ lấy từ chính video), tiếng gốc chỉnh được 0–150 %, nhạc nền tuỳ chọn; kiểu cũ "Bản tin nhiều cảnh" giữ nguyên từng khung hình, từng mẫu âm.

**Architecture:** `ProjectKind = "news" | "upload"` nằm trong `NewsProject` (cấu trúc cảnh phụ thuộc kiểu: tin = mở đầu + ≥1 thân bài; tải lên = đúng 1 cảnh mở đầu) và trong `StudioData.kind` (lựa chọn khi chưa có dự án). Model mới `SourceClip` (domain) mô tả video tải lên, lưu trong `StudioData.sourceClip` và bản nháp v3 (đọc được v1/v2; thiếu = "news"). `readiness.ts` sinh danh sách bước theo kiểu (`stepsOf`), Wizard/Stepper/Shell chỉ đọc từ đó. Bộ dựng nhận khối tuỳ chọn `RenderJob.sourceClip`; `Timeline` có thêm đoạn "lặng" (không giọng, không nghỉ) cho video tải lên; worker mở video một lần, dùng một khung làm ảnh thẻ đầu và phát toàn bộ video ở cảnh thân bài (vừa khung, không Ken Burns); tiếng gốc được giải mã ngay trong worker (mediabunny `AudioSampleSink`), lấy mẫu lại về 48 kHz bằng sinc cửa sổ Blackman đa pha, đặt vào bản trộn sau thẻ đầu. Không job nào có `sourceClip` thì mọi đường code cũ chạy y như trước.

**Tech Stack:** Như hiện tại: Next.js 16.4.1, React 19.3.1, TypeScript 5.9.3 strict (`noUncheckedIndexedAccess`), Tailwind 4, Vitest 5.0.4 (node, chỉ gom `tests/**/*.test.ts`), Playwright 1.64.1 (kênh `chrome`, cổng 3101, `FAKE_PROVIDERS=1`), mediabunny 1.61.4, ffmpeg (chỉ cho script/e2e). Không thêm dependency npm.

**Đặc tả:** `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md` (§3 luồng 5 bước, §4.3 hàm vẽ thuần theo thời gian, §4.4 bố cục Theanh28, §5 dựng phía người dùng, §12–14 số đo và tuỳ chọn video). Task 7 thêm §15 "Kiểu Video tải lên". Quyết định người dùng đã chốt nằm ở mục "Ghi chú thiết kế" ngay dưới; điểm còn cần Hải duyệt nằm ở cuối kế hoạch.

## Global Constraints

- Thư mục dự án: `D:\Brain Hainv\ca-nhan\tools\tin-video-studio`, nhánh `feat/video-tai-len` (điều phối viên tạo từ `main`). Đường dẫn trong kế hoạch tính từ thư mục này.
- **Agent thực thi CẤM chạy mọi lệnh git.** Bỏ qua bước "Commit" (điều phối viên commit). Không đọc/sửa `.env.local`; không tạo `.env*`. Không chạy dev server (`npm run dev`); e2e tự chạy app ở cổng **3101** với `FAKE_PROVIDERS=1`.
- **RED phải đỏ thật** cho test Vitest: chạy test mới trước khi viết code và ghi dòng thất bại vào report. Test không đỏ thì KHÔNG sửa giá trị mong đợi; ghi "test không đỏ" + lý do. Test Playwright không có RED; chạy và ghi kết quả; không nới timeout quá giá trị kế hoạch ghi.
- Lớp: View chỉ hiển thị + gọi controller (không quy tắc nghiệp vụ, không fetch); Controller giữ trạng thái và điều phối; Model (`src/domain`) thuần TS, không React/DOM/fetch/mediabunny; mọi lắp ráp ở `createStudio.ts` / `container.ts`.
- **Hàm vẽ của template phải thuần theo thời gian:** cùng `ProjectFrame` + `SceneFrame` ra cùng hình.
- Dựng hình chạy trong `render.worker.ts` (OffscreenCanvas); mọi dữ liệu vào worker qua `RenderJob` (structuredClone được; Blob được phép).
- **Tương thích ngược tuyệt đối với kiểu "Bản tin nhiều cảnh":** job không có `sourceClip` cho ra cùng timeline, cùng lệnh vẽ, cùng mẫu âm như trước (sai số làm tròn số thực ≤ 1e-6 ở bộ giới hạn đỉnh). Mọi test Vitest và e2e cũ phải xanh. Chỉ được sửa đúng 2 giá trị mong đợi `version: 2` → `version: 3` trong `tests/client/storage/DraftRepository.test.ts` (Task 1 ghi rõ); ngoài ra không sửa test cũ.
- Bản nháp v3 đọc được v1, v2 (thiếu `project.kind` = "news", thiếu `sourceClip` = null). `NewsProject.snapshot()` của kiểu tin KHÔNG thêm khoá `kind` (giữ nguyên hình dạng snapshot cũ).
- Giới hạn video tải lên: **≤ 300 giây (5:00, dung sai 0,5 s cho sai số đo độ dài) và ≤ 500 MB**, định dạng MP4/MOV/WebM (theo `UploadValidator` hiện có). Lý do và số đo ở mục "Ghi chú thiết kế" (§G2).
- Âm: tần số mẫu bản trộn duy nhất `RENDER_SAMPLE_RATE = 48000`; trần đỉnh 0,89; giọng chuẩn hoá −16,5 dB (như cũ, áp cho giọng tiêu đề). Tiếng gốc KHÔNG chuẩn hoá: nhân hệ số người dùng (0–1,5). Nhạc nền = min(quy tắc cũ, mức tiếng gốc − 12 dB). Số đo âm giữ phương pháp cũ: cửa sổ 100 ms, cổng −45 dB.
- Ngôn ngữ giao diện, thông báo lỗi, tài liệu: tiếng Việt có dấu. Tên lớp, hàm, biến: tiếng Anh. Giữ kiểu xuống dòng của file đang sửa.
- Sau mỗi task: `npx vitest run`, `npm run typecheck`, `npm run lint` sạch (0 cảnh báo). Task có ghi e2e thì chạy thêm `npm run test:e2e` (hoặc spec được chỉ định); Task 7 chạy thêm `npm run build`.
- Mọi commit kết thúc bằng dòng `Co-Authored-By` do phiên chạy quy định (điều phối viên tự thêm).

## Ghi chú thiết kế (đã chốt với người dùng + đề xuất kỹ thuật)

- **G1. Chọn kiểu ở bước 1.** Ô chọn "Kiểu video" (radio "Bản tin nhiều cảnh" | "Video tải lên") nằm đầu bước 1 khi chưa có dự án. Đổi kiểu lúc chưa có dự án không mất gì (chữ đã gõ nằm trong state của form, vẫn còn khi đổi lại). Khi đã có dự án thì kiểu **bị khoá**; muốn đổi phải bấm "Dự án mới" (nút này đã có cảnh báo "Dự án hiện tại, giọng đã tạo và file tải lên sẽ bị xoá"). Không thêm bước "Chọn kiểu" riêng để giữ nguyên nhãn "1. Nhập tin" mà e2e cũ dựa vào.
- **Bước theo kiểu:**
  - Bản tin nhiều cảnh (giữ nguyên): `1. Nhập tin` → `2. Chọn giọng` → `3. Cảnh trám` → `4. Nhạc nền` → `5. Dựng video`.
  - Video tải lên: `1. Nhập tiêu đề` → `2. Video của bạn` → `3. Giọng tiêu đề` → `4. Nhạc nền` → `5. Dựng video`. Không có chia cảnh, không có cảnh trám.
- **G2. Giới hạn 5 phút / 500 MB — lý do và số đo:**
  - Bộ nhớ âm thanh (Float32, 48 kHz): 305 s × 48 000 × 4 B = 58,6 MB mỗi kênh. Đỉnh bộ nhớ khi trộn 5 phút ≈ tiếng gốc stereo 117 MB + bản trộn (voice + L + R + 2 mảng giới hạn) 5 × 58,6 = 293 MB ≈ **410 MB** (Task 5 bỏ mảng tiền tố Float64 117 MB của `applyLimiter`; nếu không bỏ là ≈ 527 MB). Đo trên máy này (Node 22, cùng code `mixProgram` hiện tại, 308 s giọng + nhạc stereo, chưa có tiếng gốc): **0,73 s, +132 MB ArrayBuffer**.
  - MP4 đầu ra nằm trong RAM (`BufferTarget`, rồi `new Blob([buffer])` chép thêm một bản): 8 Mbps × 305 s ≈ 305 MB → đỉnh ≈ **610 MB** lúc đóng gói (5 Mbps: ≈ 380 MB). Đây là giới hạn lớn nhất; vượt 5 phút dễ làm tab Chrome hết bộ nhớ trên máy 8 GB.
  - Lấy mẫu lại tiếng gốc (sinc Blackman 32 nhịp, bảng đa pha), đo trên máy này bằng Node 22: 300 s mono 44,1 → 48 kHz **1,1 s**; 96 → 48 kHz **1,8 s**; sai số với sin 440 Hz lý tưởng **4·10⁻⁶**; chặn chồng phổ (30 kHz ở 96 kHz → 48 kHz) **−75 dB**; dải thông 1 kHz lệch **0,001 dB**.
  - 500 MB: video điện thoại 1080p 5 phút ở 12–16 Mbps ≈ 450–600 MB; 4K 5 phút (> 1 GB) bị chặn — 4K cũng giải mã chậm và vô ích vì khung ra chỉ 1080×1920. Blob nằm trong IndexedDB (đĩa), không nằm trong RAM.
  - Tốc độ dựng hiện tại: tin 37 s dựng hết 15,5 s (≈ 0,42× thời lượng, chặng 4). Video tải lên thêm việc giải mã video nguồn 1080p; tiêu chí chấp nhận ở Task 7: clip 60 s 1080p dựng ≤ 1,0× tổng thời lượng + 15 s; clip 300 s dựng xong không lỗi, ≤ 1,2× tổng thời lượng + 30 s.
- **G3. Mức tiếng gốc:** thanh trượt 0–150 % bước 5, mặc định 100 % (giữ nguyên). Domain lưu `volumePercent` (số nguyên), job mang `gain` tuyến tính (0 = tắt) — tránh `−Infinity dB` khi lưu JSON bản nháp. Video không có track âm (hoặc trình duyệt không giải mã được track âm) → `hasAudio = false`, thanh trượt khoá, cảnh báo ở bước Dựng.
- **G4. Bố cục:** thẻ đầu = cảnh mở đầu Theanh28 hiện có, ảnh trên thẻ là khung của video tại `min(1 s, độ dài/2)` (vẫn Ken Burns như cảnh trám). Sau đó cảnh thân bài với video **vừa khung (contain), không zoom Ken Burns** trong dải `LAYOUT.body.band` (1080×920 tại y=380), nền mờ lấy từ chính khung video, tên kênh + logo góc phải, tem ngày, dòng nguồn tin; dòng thứ hai của khối nguồn đổi "ẢNH: TỔNG HỢP" → "VIDEO: TỔNG HỢP". Không phụ đề (ép tắt trong job và xem trước; ô phụ đề ở thanh Tuỳ chọn bị khoá).
- **G5. Thời gian:** thẻ đầu = nghỉ đầu (`leadInSec`) + giọng tiêu đề (đã cắt lặng, đã tinh chỉnh) + nghỉ sau tiêu đề (`gapSec`, nhãn "Nghỉ sau tiêu đề" ở kiểu này). Video bắt đầu đúng lúc thẻ đầu kết thúc và chạy hết `durationSec` của nó, **không có đuôi** (`tailSec` không áp). Tổng = thẻ đầu + video.
- **G6. Âm:** giọng tiêu đề chuẩn hoá như cũ; thẻ đầu không có tiếng gốc; tiếng gốc giữ stereo (mono thì một kênh, bản trộn tự nhân đôi), nhân hệ số, vuốt 20 ms hai đầu chống tiếng tách; ngắn hơn video thì phần thiếu là lặng, dài hơn thì cắt; mốc thời gian lấy theo khung hình đầu của video. Nhạc nền mức cố định suốt video = min(−16,5 − 15 + chỉnh ±6, mức tiếng gốc × hệ số − 12 dB).

## Cấu trúc file

```
src/domain/ProjectKind.ts                     # mới (T1): kiểu dự án, nhãn, dòng credit theo kiểu
src/domain/SourceClip.ts                      # mới (T1): model video tải lên (+ âm lượng %)
src/domain/NewsProject.ts                     # sửa (T1): kind, titleOnly(), snapshot/restore theo kiểu
src/domain/Timeline.ts                        # sửa (T4): đoạn "silent" (video tải lên)
src/domain/Footage.ts                         # sửa (T4): FootagePlayback.startSec / stillAtSec (tuỳ chọn)
src/client/storage/ProjectDraft.ts            # sửa (T1): DRAFT_VERSION 3, sourceClip
src/client/storage/DraftRepository.ts         # sửa (T1): chú thích v1–v3 (logic dùng hằng)
src/client/controllers/StudioSession.ts       # sửa (T1): StudioData.kind/sourceClip, prune/restore/save
src/client/controllers/readiness.ts           # sửa (T1): StepId "clip", UPLOAD_STEPS, stepsOf, projectKind
src/client/controllers/WizardController.ts    # sửa (T1): next/back theo stepsOf; giữ blob video khi dọn
src/client/controllers/ProjectController.ts   # sửa (T2): setKind, createTitleOnlyFromForm
src/client/controllers/SourceClipController.ts# mới (T3): tải/thay/xoá video, âm lượng
src/client/controllers/createStudio.ts        # sửa (T3): lắp SourceClipController
src/client/controllers/RenderJobBuilder.ts    # sửa (T4): nhánh "upload"
src/client/controllers/RenderController.ts    # sửa (T6): nhãn giai đoạn theo kiểu
src/client/controllers/renderSummary.ts       # mới (T6): câu tóm tắt ở bước Dựng
src/client/media/UploadValidator.ts           # sửa (T3): giới hạn riêng, classifySourceClip, formatClock
src/client/media/MediaProbe.ts                # sửa (T3): SourceClipProbe.clip()
src/client/media/MediaFrameProvider.ts        # sửa (T3): VideoFrameProvider.startSec
src/client/media/ClipThumbnail.ts             # mới (T3, chỉ trình duyệt): lấy 1 khung làm ảnh tĩnh
src/client/media/sourceTime.ts                # sửa (T4): startSec/stillAtSec
src/client/media/resample.ts                  # mới (T5): lấy mẫu lại sinc đa pha
src/client/media/SourceAudioAssembler.ts      # mới (T5): ghép mẩu âm theo mốc + lấy mẫu lại
src/client/media/decodeSourceAudio.ts         # mới (T5, chỉ trình duyệt/worker): mediabunny → assembler
src/client/media/AudioMix.ts                  # sửa (T5): SourceBed, quy tắc nhạc, limiter không mảng tiền tố
src/client/container.ts                       # sửa (T3): kiểu probe
src/client/preview/PreviewFrameBuilder.ts     # sửa (T2): khung xem trước kiểu upload
src/client/preview/PreviewController.ts       # sửa (T2): setImage()
src/client/render/RenderJob.ts                # sửa (T4): SourceClipInput, project.mediaCredit
src/client/render/RenderPlan.ts               # sửa (T4): SOURCE_CLIP_SCENE_ID, clipSlot
src/client/render/VideoRenderer.ts            # sửa (T4): RenderScene.media → SceneFrame.media
src/client/render/render.worker.ts            # sửa (T4 hình, T5 âm)
src/templates/VideoTemplate.ts                # sửa (T2): SceneMedia, SOURCE_CLIP_MEDIA, ProjectFrame.mediaCredit
src/templates/theanh28/layout.ts              # sửa (T2): containRect
src/templates/theanh28/TheAnh28Template.ts    # sửa (T2): fit/motion, mediaCredit
src/views/studio/StudioShell.tsx              # sửa (T1 bước động; T3 StepClip)
src/views/studio/Stepper.tsx                  # sửa (T1)
src/views/studio/steps/StepNews.tsx           # sửa (T2): chọn kiểu + biểu mẫu tối giản
src/views/studio/steps/StepClip.tsx           # mới (T3)
src/views/studio/steps/StepVoice.tsx          # sửa (T6)
src/views/studio/steps/StepMusic.tsx          # sửa (T6)
src/views/studio/steps/StepRender.tsx         # sửa (T6)
src/views/studio/components/PreviewPanel.tsx  # sửa (T2): kind, image
src/views/studio/components/OptionsSidebar.tsx# sửa (T2)
scripts/make-sample-clip.ts                   # mới (T7): video mẫu bằng ffmpeg lavfi
scripts/measure-mp4.ts                        # sửa (T7): decodeFileAudio
scripts/lib/audioMetrics.ts                   # sửa (T7): rmsDbBetween, toneRmsDb
e2e/helpers.ts                                # sửa (T7): bước kiểu upload
e2e/07-video-tai-len.spec.ts                  # mới (T7)
e2e/08-hieu-nang-video-dai.spec.ts            # mới (T7, chỉ chạy khi PERF_CLIP=1)
tests/helpers/studioFixtures.ts               # sửa (T1): makeUploadProject, makeClip
README.md, docs/superpowers/specs/...design.md# sửa (T7): §15
```

Thứ tự phụ thuộc: T1 → T2 → T3 → T4 → T5 → T6 → T7. Mỗi task tự chứa (giao subagent riêng được); task sau chỉ dựa vào khối **Interfaces → Produces** của task trước.

---

### Task 1: Mô hình kiểu dự án + `SourceClip` + bản nháp v3 + bước động

**Có Vitest:** domain, bản nháp, session, readiness, wizard. **Không Vitest:** sửa nhỏ `Stepper.tsx`, `StudioShell.tsx` (kiểm bằng typecheck + e2e cũ).

**Files:**
- Create: `src/domain/ProjectKind.ts`, `src/domain/SourceClip.ts`, `tests/domain/SourceClip.test.ts`
- Modify: `src/domain/NewsProject.ts`, `src/client/storage/ProjectDraft.ts`, `src/client/storage/DraftRepository.ts` (chú thích), `src/client/controllers/StudioSession.ts`, `src/client/controllers/readiness.ts`, `src/client/controllers/WizardController.ts`, `src/views/studio/Stepper.tsx`, `src/views/studio/StudioShell.tsx`, `tests/helpers/studioFixtures.ts`
- Test (thêm khối mới, không sửa test cũ trừ 2 dòng version): `tests/domain/NewsProject.test.ts`, `tests/client/storage/ProjectDraft.test.ts`, `tests/client/storage/DraftRepository.test.ts`, `tests/client/controllers/StudioSession.test.ts`, `tests/client/controllers/readiness.test.ts`, `tests/client/controllers/WizardController.test.ts`

**Interfaces:**
- Consumes: không.
- Produces:
  - `src/domain/ProjectKind.ts`: `type ProjectKind = "news" | "upload"`; `PROJECT_KINDS: readonly ProjectKind[]`; `PROJECT_KIND_LABELS: Record<ProjectKind, string>` (`news`: "Bản tin nhiều cảnh", `upload`: "Video tải lên"); `MEDIA_CREDIT: Record<ProjectKind, string>` (`"ẢNH: TỔNG HỢP"`, `"VIDEO: TỔNG HỢP"`); `isProjectKind(v: unknown): v is ProjectKind`.
  - `src/domain/SourceClip.ts`: `SOURCE_CLIP_VOLUME = { min: 0, max: 150, step: 5, default: 100 }`; `interface SourceClipProps { uploadId; name; width; height; durationSec; hasAudio; volumePercent?: number }`; `interface SourceClipSnapshot` (đủ trường, `volumePercent: number`); `class SourceClip` với `static MAX_DURATION_SEC = 300`, `static DURATION_TOLERANCE_SEC = 0.5`, `static create(p)`, `static restore(raw)`, `snapshot()`, `withVolume(percent): SourceClip`, getter `gain: number` (0 khi `!hasAudio`), `thumbnailSec: number` (= `min(1, durationSec/2)`), readonly `uploadId, name, width, height, durationSec, hasAudio, volumePercent`.
  - `NewsProject`: `readonly kind: ProjectKind`; `static titleOnly(input: TitleOnlyInput, nextId): NewsProject` với `TitleOnlyInput = { title: string; sourceCredit: string; publishDate: Date; templateId: string }`; `NewsProjectSnapshot.kind?: ProjectKind` (chỉ có khi "upload").
  - `StudioData.kind: ProjectKind`, `StudioData.sourceClip: SourceClip | null`; `EMPTY_STUDIO.kind = "news"`, `EMPTY_STUDIO.sourceClip = null`.
  - `ProjectDraft`: `DRAFT_VERSION = 3`; `DraftVersion = 1 | 2 | 3`; `DraftParts.sourceClip?: SourceClip | null`; `RestoredDraft.sourceClip: SourceClip | null`; `DraftBody.sourceClip?: SourceClipSnapshot | null`.
  - `readiness.ts`: `StepId = "news" | "clip" | "voice" | "footage" | "music" | "render"`; `interface StepInfo { id: StepId; label: string }`; `STEPS` (kiểu tin, không đổi); `UPLOAD_STEPS`; `stepsFor(kind)`; `stepsOf(data)`; `projectKind(data)`; `stepReady`, `canEnter`, `firstIncompleteStep` theo kiểu.
  - `tests/helpers/studioFixtures.ts`: `makeUploadProject(ids?)`, `makeClip(over?)`.

- [ ] **Step 1: Viết test domain (đỏ)**

`tests/domain/SourceClip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SourceClip, SOURCE_CLIP_VOLUME } from "@/domain/SourceClip";
import { ValidationError } from "@/domain/errors";

const props = { uploadId: "upload-1", name: "clip.mp4", width: 1280, height: 720, durationSec: 8, hasAudio: true };

describe("SourceClip", () => {
  it("tạo với âm lượng mặc định 100 %, hệ số 1, ảnh thẻ đầu ở giây 1", () => {
    const c = SourceClip.create(props);
    expect(c.volumePercent).toBe(SOURCE_CLIP_VOLUME.default);
    expect(c.gain).toBe(1);
    expect(c.thumbnailSec).toBe(1);
    expect(SourceClip.create({ ...props, durationSec: 1.2 }).thumbnailSec).toBeCloseTo(0.6, 9);
  });

  it("không có tiếng gốc thì hệ số 0 dù âm lượng 100 %", () => {
    expect(SourceClip.create({ ...props, hasAudio: false }).gain).toBe(0);
  });

  it("chặn dữ liệu sai và video quá 5 phút (dung sai 0,5 s)", () => {
    expect(() => SourceClip.create({ ...props, uploadId: "" })).toThrow("Video tải lên thiếu mã file");
    expect(() => SourceClip.create({ ...props, width: 0 })).toThrow("Kích thước video không hợp lệ");
    expect(() => SourceClip.create({ ...props, durationSec: Number.NaN })).toThrow("Độ dài video không hợp lệ");
    expect(SourceClip.create({ ...props, durationSec: 300.4 }).durationSec).toBe(300.4);
    expect(() => SourceClip.create({ ...props, durationSec: 300.6 })).toThrow("Video dài quá 5 phút");
    expect(() => SourceClip.create({ ...props, volumePercent: 151 })).toThrow(ValidationError);
    expect(() => SourceClip.create({ ...props, volumePercent: 12.5 })).toThrow("Âm lượng tiếng gốc chỉ từ 0 đến 150 %");
  });

  it("withVolume làm tròn về bước 5 và giữ các trường khác", () => {
    const c = SourceClip.create(props).withVolume(52);
    expect(c.volumePercent).toBe(50);
    expect(c.gain).toBeCloseTo(0.5, 9);
    expect(c.uploadId).toBe("upload-1");
    expect(SourceClip.create(props).withVolume(0).gain).toBe(0);
    expect(() => SourceClip.create(props).withVolume(160)).toThrow(ValidationError);
  });

  it("tên rỗng thành 'video'", () => {
    expect(SourceClip.create({ ...props, name: "  " }).name).toBe("video");
  });

  it("snapshot/restore khứ hồi; thiếu âm lượng dùng mặc định; hỏng thì ném", () => {
    const c = SourceClip.create({ ...props, volumePercent: 75 });
    expect(SourceClip.restore(c.snapshot()).snapshot()).toEqual({ ...props, volumePercent: 75 });
    const { volumePercent: _v, ...old } = c.snapshot();
    expect(SourceClip.restore(old as never).volumePercent).toBe(100);
    expect(() => SourceClip.restore(null as never)).toThrow("Bản nháp hỏng: dữ liệu video tải lên không hợp lệ");
    expect(() => SourceClip.restore({ ...props, hasAudio: "có" } as never)).toThrow("Bản nháp hỏng: thông tin video tải lên không hợp lệ");
  });
});
```

Thêm vào cuối `tests/domain/NewsProject.test.ts` (giữ import sẵn có của file; thêm `import { sequentialIds } from "@/domain/ids";` nếu file chưa có):

```ts
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
```

(Nếu `tests/domain/NewsProject.test.ts` chưa import `SentenceSplitter` thì thêm `import { SentenceSplitter } from "@/domain/SentenceSplitter";`.)

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `npx vitest run tests/domain/SourceClip.test.ts tests/domain/NewsProject.test.ts`
Expected: FAIL — `Cannot find package '@/domain/SourceClip'` và `NewsProject.titleOnly is not a function`.

- [ ] **Step 3: Viết domain**

`src/domain/ProjectKind.ts`:

```ts
/** Kiểu video của một dự án. "news": tin chia nhiều cảnh (kiểu gốc). "upload": thẻ tiêu đề + video người dùng tải lên. */
export type ProjectKind = "news" | "upload";

export const PROJECT_KINDS: readonly ProjectKind[] = ["news", "upload"];

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  news: "Bản tin nhiều cảnh",
  upload: "Video tải lên",
};

/** Dòng thứ hai của khối nguồn tin trên video (dưới "THEO: …"). */
export const MEDIA_CREDIT: Record<ProjectKind, string> = {
  news: "ẢNH: TỔNG HỢP",
  upload: "VIDEO: TỔNG HỢP",
};

export function isProjectKind(v: unknown): v is ProjectKind {
  return v === "news" || v === "upload";
}
```

`src/domain/SourceClip.ts`:

```ts
import { ValidationError } from "./errors";

export const SOURCE_CLIP_VOLUME = { min: 0, max: 150, step: 5, default: 100 } as const;

export interface SourceClipProps {
  uploadId: string;
  name: string;
  width: number;
  height: number;
  /** Giây, tính từ khung hình đầu. */
  durationSec: number;
  /** Có track âm mà trình duyệt giải mã được. */
  hasAudio: boolean;
  /** 0–150, bước 5; bỏ trống = 100 (giữ nguyên tiếng gốc). */
  volumePercent?: number;
}

export interface SourceClipSnapshot {
  uploadId: string;
  name: string;
  width: number;
  height: number;
  durationSec: number;
  hasAudio: boolean;
  volumePercent: number;
}

/** Video người dùng tải lên cho kiểu "Video tải lên". Bất biến; blob nằm ở UploadRepository theo `uploadId`. */
export class SourceClip {
  /** 5 phút: bộ nhớ âm thanh và MP4 đầu ra đều nằm trong RAM của tab (xem kế hoạch 06, §G2). */
  static readonly MAX_DURATION_SEC = 300;
  /** Sai số đo độ dài (khung cuối, mốc âm) cho phép vượt nhẹ 5:00. */
  static readonly DURATION_TOLERANCE_SEC = 0.5;

  private constructor(
    readonly uploadId: string,
    readonly name: string,
    readonly width: number,
    readonly height: number,
    readonly durationSec: number,
    readonly hasAudio: boolean,
    readonly volumePercent: number,
  ) {}

  static create(p: SourceClipProps): SourceClip {
    if (!p.uploadId) throw new ValidationError("Video tải lên thiếu mã file");
    if (!Number.isFinite(p.width) || !Number.isFinite(p.height) || p.width <= 0 || p.height <= 0) {
      throw new ValidationError("Kích thước video không hợp lệ");
    }
    if (!Number.isFinite(p.durationSec) || p.durationSec <= 0) throw new ValidationError("Độ dài video không hợp lệ");
    if (p.durationSec > SourceClip.MAX_DURATION_SEC + SourceClip.DURATION_TOLERANCE_SEC) {
      throw new ValidationError("Video dài quá 5 phút");
    }
    const volume = p.volumePercent ?? SOURCE_CLIP_VOLUME.default;
    if (!Number.isInteger(volume) || volume < SOURCE_CLIP_VOLUME.min || volume > SOURCE_CLIP_VOLUME.max) {
      throw new ValidationError("Âm lượng tiếng gốc chỉ từ 0 đến 150 %");
    }
    return new SourceClip(p.uploadId, p.name.trim() || "video", p.width, p.height, p.durationSec, p.hasAudio, volume);
  }

  /** Hệ số tuyến tính cho tiếng gốc khi trộn (0 = tắt). */
  get gain(): number {
    return this.hasAudio ? this.volumePercent / 100 : 0;
  }

  /** Giây (tính từ khung đầu) lấy ảnh cho thẻ tiêu đề: tránh khung đen đầu video nhưng không quá giữa clip ngắn. */
  get thumbnailSec(): number {
    return Math.min(1, this.durationSec / 2);
  }

  withVolume(percent: number): SourceClip {
    const step = SOURCE_CLIP_VOLUME.step;
    const rounded = Number.isFinite(percent) ? Math.round(percent / step) * step : Number.NaN;
    return SourceClip.create({ ...this.snapshot(), volumePercent: rounded });
  }

  snapshot(): SourceClipSnapshot {
    return {
      uploadId: this.uploadId,
      name: this.name,
      width: this.width,
      height: this.height,
      durationSec: this.durationSec,
      hasAudio: this.hasAudio,
      volumePercent: this.volumePercent,
    };
  }

  static restore(s: SourceClipSnapshot): SourceClip {
    const raw = s as unknown as Record<string, unknown> | null;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new ValidationError("Bản nháp hỏng: dữ liệu video tải lên không hợp lệ");
    }
    if (
      typeof raw.uploadId !== "string" ||
      typeof raw.name !== "string" ||
      typeof raw.width !== "number" ||
      typeof raw.height !== "number" ||
      typeof raw.durationSec !== "number" ||
      typeof raw.hasAudio !== "boolean"
    ) {
      throw new ValidationError("Bản nháp hỏng: thông tin video tải lên không hợp lệ");
    }
    return SourceClip.create({
      uploadId: raw.uploadId,
      name: raw.name,
      width: raw.width,
      height: raw.height,
      durationSec: raw.durationSec,
      hasAudio: raw.hasAudio,
      ...(typeof raw.volumePercent === "number" ? { volumePercent: raw.volumePercent } : {}),
    });
  }
}
```

Sửa `src/domain/NewsProject.ts`:

1. Import: thêm `import { isProjectKind, type ProjectKind } from "./ProjectKind";`
2. Sau `NewsProjectInput` thêm:

```ts
/** Đầu vào kiểu "Video tải lên": chỉ có tiêu đề (cũng là câu giọng đọc). */
export interface TitleOnlyInput {
  title: string;
  sourceCredit: string;
  publishDate: Date;
  templateId: string;
}
```

3. `NewsProjectSnapshot` thêm trường cuối:

```ts
  /** Chỉ có khi "upload"; bản nháp cũ không có khoá này = "news". */
  kind?: ProjectKind;
```

4. Constructor thêm tham số cuối `readonly kind: ProjectKind,` (sau `private readonly nextId: IdGenerator,`). Trong `fromText` đổi dòng return thành:

```ts
    return new NewsProject(title, credit, publishDate, input.templateId, scenes, nextId, "news");
```

5. Thêm ngay sau `fromText`:

```ts
  static titleOnly(input: TitleOnlyInput, nextId: IdGenerator): NewsProject {
    if (!input.templateId) throw new ValidationError("Chưa chọn phong cách video");
    const credit = checkedCredit(input.sourceCredit);
    const publishDate = checkedDate(input.publishDate);
    const title = input.title.replace(/\s+/g, " ").trim();
    if (!title) throw new ValidationError("Chưa có tiêu đề video");
    return new NewsProject(title, credit, publishDate, input.templateId, [Scene.create(nextId(), title, "intro")], nextId, "upload");
  }
```

6. `withMeta`: thêm `this.kind,` làm đối số cuối của `new NewsProject(...)`. `copy`: thêm `this.kind,` làm đối số cuối.
7. `snapshot()`:

```ts
  snapshot(): NewsProjectSnapshot {
    return {
      title: this.title,
      sourceCredit: this.sourceCredit,
      publishDate: toLocalDateString(this.publishDate),
      templateId: this.templateId,
      scenes: this.scenes.map((s) => ({ id: s.id, text: s.text, role: s.role })),
      // Kiểu tin giữ đúng hình dạng snapshot cũ (không có khoá kind).
      ...(this.kind === "upload" ? { kind: "upload" as const } : {}),
    };
  }
```

8. `restore`: ngay sau dòng kiểm `isRecord(raw)` thêm:

```ts
    const kind: unknown = raw.kind ?? "news";
    if (!isProjectKind(kind)) throw new ValidationError("Bản nháp hỏng: kiểu video không hợp lệ");
```

và thay khối `structureOk` + return cuối bằng:

```ts
    const structureOk =
      kind === "upload"
        ? scenes.length === 1 && scenes[0]?.role === "intro"
        : scenes.length >= 2 && scenes[0]?.role === "intro" && scenes.slice(1).every((s) => s.role === "body");
    if (!structureOk) throw new ValidationError("Bản nháp hỏng: cấu trúc cảnh không hợp lệ");
    const taken = new Set(scenes.map((s) => s.id));
    const freshId: IdGenerator = () => {
      let id = nextId();
      while (taken.has(id)) id = nextId();
      taken.add(id);
      return id;
    };
    return new NewsProject(raw.title, credit, publishDate, raw.templateId, scenes, freshId, kind);
```

- [ ] **Step 4: Chạy test domain, xác nhận xanh**

Run: `npx vitest run tests/domain`
Expected: PASS toàn bộ (kể cả test NewsProject cũ).

- [ ] **Step 5: Viết test bản nháp, session, readiness, wizard (đỏ)**

Thêm vào cuối `tests/helpers/studioFixtures.ts` (và thêm import `SourceClip, type SourceClipProps` từ `@/domain/SourceClip`):

```ts
/** Dự án kiểu Video tải lên: một cảnh mở đầu s1. */
export function makeUploadProject(ids: IdGenerator = sequentialIds("s")): NewsProject {
  return NewsProject.titleOnly(
    { title: "Tiêu đề video tải lên", sourceCredit: "Nguồn thử", publishDate: new Date(2026, 9, 14), templateId: "theanh28" },
    ids,
  );
}

export function makeClip(over: Partial<SourceClipProps> = {}): SourceClip {
  return SourceClip.create({ uploadId: "upload-c1", name: "clip.mp4", width: 1280, height: 720, durationSec: 8, hasAudio: true, ...over });
}
```

Thêm vào cuối `tests/client/storage/ProjectDraft.test.ts` (thêm import `makeClip, makeUploadProject` từ `"../../helpers/studioFixtures"`):

```ts
describe("bản nháp v3 — video tải lên", () => {
  it("khứ hồi dự án upload kèm video và âm lượng", () => {
    const project = makeUploadProject();
    const clip = makeClip({ volumePercent: 60 });
    const body = buildDraftBody({ project, voice: null, narrations: [], footage: FootageBoard.empty(), music: null, sourceClip: clip });
    expect(body.sourceClip).toEqual(clip.snapshot());
    const back = restoreDraft(JSON.parse(JSON.stringify(body)), sequentialIds("x"));
    expect(back.project.kind).toBe("upload");
    expect(back.sourceClip?.snapshot()).toEqual(clip.snapshot());
  });

  it("dự án tin không ghi khoá sourceClip; bản nháp cũ thiếu khoá = null", () => {
    const body = buildDraftBody(parts());
    expect("sourceClip" in body).toBe(false);
    expect(restoreDraft(body, sequentialIds("x")).sourceClip).toBeNull();
  });

  it("dự án tin mà bản nháp lỡ có sourceClip thì bỏ qua; sourceClip hỏng của dự án upload thì ném", () => {
    const body = { ...buildDraftBody(parts()), sourceClip: makeClip().snapshot() };
    expect(restoreDraft(body, sequentialIds("x")).sourceClip).toBeNull();
    const up = buildDraftBody({ project: makeUploadProject(), voice: null, narrations: [], footage: FootageBoard.empty(), music: null });
    expect(() => restoreDraft({ ...up, sourceClip: 5 as never }, sequentialIds("x"))).toThrow(
      "Bản nháp hỏng: dữ liệu video tải lên không hợp lệ",
    );
  });
});
```

Sửa đúng 2 dòng trong `tests/client/storage/DraftRepository.test.ts`: dòng 34 `version: 2` → `version: 3`; dòng 62 `toBe(2)` → `toBe(3)`. Thêm test cuối file:

```ts
  it("đọc được bản nháp v2 (trước khi có video tải lên)", async () => {
    const store = new MemoryKeyValueStore();
    const repo = new DraftRepository(store);
    await store.set("draft", { version: 2, savedAt: "2026-10-16T00:00:00.000Z", ...body });
    const loaded = await repo.load();
    expect(loaded?.version).toBe(2);
    expect(loaded?.project).toEqual(body.project);
  });
```

(`body` và `MemoryKeyValueStore` đã có sẵn trong file; nếu `body` nằm trong `describe` thì đặt test này trong cùng `describe`.)

Thêm vào cuối `tests/client/controllers/StudioSession.test.ts` (thêm import `makeClip, makeUploadProject`):

```ts
describe("StudioSession — kiểu dự án và video tải lên", () => {
  it("mặc định kiểu tin, chưa có video; reset về mặc định", () => {
    const { session } = makeSession();
    expect(session.state.kind).toBe("news");
    expect(session.state.sourceClip).toBeNull();
    session.update((d) => ({ ...d, kind: "upload" }));
    expect(session.state.kind).toBe("upload");
    session.reset();
    expect(session.state.kind).toBe("news");
  });

  it("kind luôn theo dự án; dự án tin thì bỏ sourceClip", () => {
    const { session } = makeSession();
    session.update((d) => ({ ...d, project: makeUploadProject(), sourceClip: makeClip() }));
    expect(session.state.kind).toBe("upload");
    expect(session.state.sourceClip?.uploadId).toBe("upload-c1");
    session.update((d) => ({ ...d, project: makeProject(2) }));
    expect(session.state.kind).toBe("news");
    expect(session.state.sourceClip).toBeNull();
  });

  it("tự lưu kèm sourceClip và restore dựng lại kind + sourceClip", async () => {
    const { session, saves, sched } = makeSession();
    session.update((d) => ({ ...d, project: makeUploadProject(), sourceClip: makeClip({ volumePercent: 40 }) }));
    sched.runAll();
    await flush();
    expect(saves.at(-1)?.sourceClip?.volumePercent).toBe(40);
    const other = makeSession();
    other.session.restore(saves.at(-1)!);
    expect(other.session.state.kind).toBe("upload");
    expect(other.session.state.sourceClip?.volumePercent).toBe(40);
  });
});
```

Thêm vào cuối `tests/client/controllers/readiness.test.ts` (thêm import `makeClip, makeUploadProject`, và `projectKind, stepsOf, UPLOAD_STEPS` từ readiness):

```ts
describe("readiness — kiểu Video tải lên", () => {
  const upload = () => ({ ...EMPTY_STUDIO, kind: "upload" as const });

  it("chưa có dự án: bước theo kiểu đang chọn; nhãn bước 1 đổi theo kiểu", () => {
    expect(stepsOf(EMPTY_STUDIO)).toBe(STEPS);
    expect(stepsOf(upload())).toBe(UPLOAD_STEPS);
    expect(UPLOAD_STEPS.map((s) => [s.id, s.label])).toEqual([
      ["news", "Nhập tiêu đề"],
      ["clip", "Video của bạn"],
      ["voice", "Giọng tiêu đề"],
      ["music", "Nhạc nền"],
      ["render", "Dựng video"],
    ]);
    expect(canEnter("clip", upload())).toBe(false);
    expect(canEnter("clip", EMPTY_STUDIO)).toBe(false);
    expect(canEnter("footage", { ...upload(), project: makeUploadProject() })).toBe(false);
  });

  it("có dự án mà chưa có video: dừng ở bước Video của bạn", () => {
    const d = { ...upload(), project: makeUploadProject(), voice: VOICE };
    expect(projectKind(d)).toBe("upload");
    expect(canEnter("clip", d)).toBe(true);
    expect(stepReady("clip", d)).toBe(false);
    expect(canEnter("voice", d)).toBe(false);
    expect(firstIncompleteStep(d)).toBe("clip");
  });

  it("có video mà chưa giọng tiêu đề: dừng ở bước giọng; đủ giọng thì vào được Dựng", () => {
    const project = makeUploadProject();
    const d = { ...upload(), project, voice: VOICE, sourceClip: makeClip() };
    expect(canEnter("voice", d)).toBe(true);
    expect(staleSceneIds(d)).toEqual(["s1"]);
    expect(firstIncompleteStep(d)).toBe("voice");
    const ready = { ...d, narrations: new Map([["s1", fakeNarration(project.introScene)]]) };
    expect(canEnter("music", ready)).toBe(true);
    expect(canEnter("render", ready)).toBe(true);
    expect(firstIncompleteStep(ready)).toBe("render");
  });

  it("kiểu tin không có bước clip", () => {
    const d = { ...EMPTY_STUDIO, project: makeProject(2), voice: VOICE };
    expect(canEnter("clip", d)).toBe(false);
  });
});
```

Thêm vào cuối `describe("WizardController", …)` trong `tests/client/controllers/WizardController.test.ts` (thêm import `makeClip, makeUploadProject`):

```ts
  it("kiểu Video tải lên: next/back đi theo 5 bước của kiểu này", () => {
    const { wizard, session } = setup();
    const project = makeUploadProject();
    session.update((d) => ({ ...d, project, voice: VOICE }));
    expect(wizard.next()).toBe(true);
    expect(wizard.state.step).toBe("clip");
    expect(wizard.next()).toBe(false); // chưa có video
    session.update((d) => ({ ...d, sourceClip: makeClip() }));
    expect(wizard.next()).toBe(true);
    expect(wizard.state.step).toBe("voice");
    expect(wizard.goTo("footage")).toBe(false);
    wizard.back();
    expect(wizard.state.step).toBe("clip");
  });

  it("dọn file tải lên giữ blob video của dự án", async () => {
    const { wizard, session, uploads } = setup();
    const kept = await uploads.put(new Blob(["mp4"]), { name: "c.mp4", kind: "video" });
    const orphan = await uploads.put(new Blob(["x"]), { name: "x.mp4", kind: "video" });
    session.update((d) => ({ ...d, project: makeUploadProject(), sourceClip: makeClip({ uploadId: kept.id }) }));
    await wizard.cleanupUploads();
    expect((await uploads.list()).map((m) => m.id)).toEqual([kept.id]);
    expect(orphan.id).not.toBe(kept.id);
  });
```

- [ ] **Step 6: Chạy, xác nhận đỏ**

Run: `npx vitest run tests/client/storage tests/client/controllers/StudioSession.test.ts tests/client/controllers/readiness.test.ts tests/client/controllers/WizardController.test.ts`
Expected: FAIL — ví dụ `expected 2 to be 3` (version), `Cannot read properties of undefined (reading 'volumePercent')`, `stepsOf is not a function`, `expected 'voice' to be 'clip'`.

- [ ] **Step 7: Viết bản nháp, session, readiness, wizard, view bước động**

`src/client/storage/ProjectDraft.ts` — thay phần đầu và hai hàm:

```ts
import { FootageBoard, type FootageBoardSnapshot } from "@/domain/FootageBoard";
import { ValidationError } from "@/domain/errors";
import type { IdGenerator } from "@/domain/ids";
import { MusicTrack, type MusicTrackSnapshot } from "@/domain/MusicTrack";
import { Narration, type NarrationSnapshot } from "@/domain/Narration";
import { NewsProject, type NewsProjectSnapshot } from "@/domain/NewsProject";
import { SourceClip, type SourceClipSnapshot } from "@/domain/SourceClip";
import { VideoOptions, type VideoOptionsSnapshot } from "@/domain/VideoOptions";
import { VoiceSettings, type VoiceSnapshot } from "@/domain/VoiceSettings";

/**
 * v2 thêm `options` (tuỳ chọn video). v3 thêm `project.kind` và `sourceClip` (kiểu Video tải lên).
 * v1/v2 vẫn đọc được: thiếu `options` dùng mặc định, thiếu `kind` = "news", thiếu `sourceClip` = null.
 */
export const DRAFT_VERSION = 3;
export type DraftVersion = 1 | 2 | 3;
export const READABLE_DRAFT_VERSIONS: readonly DraftVersion[] = [1, 2, 3];

export interface DraftParts {
  project: NewsProject;
  voice: VoiceSettings | null;
  narrations: readonly Narration[];
  footage: FootageBoard;
  music: MusicTrack | null;
  /** Bỏ trống khi ghi = tuỳ chọn mặc định. */
  options?: VideoOptions;
  /** Chỉ dự án kiểu "upload" mới có. */
  sourceClip?: SourceClip | null;
}

export interface RestoredDraft extends DraftParts {
  options: VideoOptions;
  sourceClip: SourceClip | null;
}

export interface DraftBody {
  project: NewsProjectSnapshot;
  voice: VoiceSnapshot | null;
  narrations: NarrationSnapshot[];
  footage: FootageBoardSnapshot;
  music: MusicTrackSnapshot | null;
  /** Không có ở bản nháp v1. */
  options?: VideoOptionsSnapshot;
  /** Không có ở bản nháp v1/v2 và ở dự án kiểu tin. */
  sourceClip?: SourceClipSnapshot | null;
}

export interface ProjectDraft extends DraftBody {
  version: DraftVersion;
  savedAt: string;
}

export function buildDraftBody(parts: DraftParts): DraftBody {
  return {
    project: parts.project.snapshot(),
    voice: parts.voice?.snapshot() ?? null,
    narrations: parts.narrations.map((n) => n.snapshot()),
    footage: parts.footage.snapshot(),
    music: parts.music?.snapshot() ?? null,
    options: (parts.options ?? VideoOptions.defaults()).snapshot(),
    // Dự án tin giữ đúng hình dạng bản nháp cũ (không có khoá sourceClip).
    ...(parts.sourceClip ? { sourceClip: parts.sourceClip.snapshot() } : {}),
  };
}

/** Dựng lại các đối tượng domain; mọi phần hỏng ném ValidationError (riêng tuỳ chọn video thì khoan dung). */
export function restoreDraft(draft: DraftBody, nextId: IdGenerator): RestoredDraft {
  const isObject = (v: unknown) => typeof v === "object" && v !== null;
  if (!Array.isArray(draft.narrations)) throw new ValidationError("Bản nháp hỏng: thiếu danh sách giọng đọc");
  if (!isObject(draft.footage)) throw new ValidationError("Bản nháp hỏng: dữ liệu bảng cảnh trám không hợp lệ");
  if (draft.voice != null && !isObject(draft.voice)) throw new ValidationError("Bản nháp hỏng: dữ liệu giọng đọc không hợp lệ");
  if (draft.music != null && !isObject(draft.music)) throw new ValidationError("Bản nháp hỏng: dữ liệu nhạc nền không hợp lệ");
  const project = NewsProject.restore(draft.project, nextId);
  const rawClip: unknown = draft.sourceClip;
  if (project.kind === "upload" && rawClip != null && !isObject(rawClip)) {
    throw new ValidationError("Bản nháp hỏng: dữ liệu video tải lên không hợp lệ");
  }
  return {
    project,
    voice: draft.voice ? VoiceSettings.restore(draft.voice) : null,
    narrations: draft.narrations.map((n) => Narration.restore(n)),
    footage: FootageBoard.restore(draft.footage),
    music: draft.music ? MusicTrack.restore(draft.music) : null,
    options: VideoOptions.restore(draft.options),
    sourceClip: project.kind === "upload" && rawClip != null ? SourceClip.restore(rawClip as SourceClipSnapshot) : null,
  };
}
```

`src/client/storage/DraftRepository.ts`: chỉ đổi chú thích trên `load()` thành `/** Bản nháp không đọc được hoặc sai phiên bản thì coi như chưa có (không ném). v1, v2, v3 đều đọc được. */`.

`src/client/controllers/StudioSession.ts`:

- Import thêm `import type { ProjectKind } from "@/domain/ProjectKind";` và `import type { SourceClip } from "@/domain/SourceClip";`.
- `StudioData` thêm hai trường cuối:

```ts
  /** Kiểu video: khi có dự án luôn bằng `project.kind`; khi chưa có là lựa chọn ở bước 1. */
  kind: ProjectKind;
  /** Video tải lên (chỉ kiểu "upload"). */
  sourceClip: SourceClip | null;
```

- `EMPTY_STUDIO` thêm `kind: "news", sourceClip: null,`.
- Thay hàm `prune`:

```ts
/** Đồng bộ kiểu theo dự án; bỏ giọng, cảnh trám, lựa chọn Ảnh/Video của cảnh không còn; dự án tin không giữ video tải lên. */
function prune(input: StudioData): StudioData {
  const project = input.project;
  if (!project) return input;
  let data = input;
  if (data.kind !== project.kind || (project.kind !== "upload" && data.sourceClip !== null)) {
    data = { ...data, kind: project.kind, sourceClip: project.kind === "upload" ? data.sourceClip : null };
  }
  const ids = new Set(project.scenes.map((s) => s.id));
  let narrations = data.narrations;
  if ([...narrations.keys()].some((id) => !ids.has(id))) {
    narrations = new Map([...narrations].filter(([id]) => ids.has(id)));
  }
  let footage = data.footage;
  for (const id of footage.sceneIds()) if (!ids.has(id)) footage = footage.unassign(id);
  const options = data.options.keepScenes(ids);
  return narrations === data.narrations && footage === data.footage && options === data.options
    ? data
    : { ...data, narrations, footage, options };
}
```

- `restore()`: trong object truyền cho `prune` thêm `kind: parts.project.kind, sourceClip: parts.sourceClip,`.
- `doSave()`: đổi thành

```ts
    const { project, voice, narrations, footage, music, options, sourceClip } = this.current;
    if (!project) return;
    try {
      await this.deps.drafts.save(
        buildDraftBody({ project, voice, narrations: [...narrations.values()], footage, music, options, sourceClip }),
      );
```

`src/client/controllers/readiness.ts` — thay phần đầu (StepId, STEPS) và ba hàm `stepReady`, `canEnter`, `firstIncompleteStep`; giữ nguyên `staleSceneIds`, `footageOwners`, `ownFootageSceneIds`, `missingFootageSceneIds`:

```ts
import { resolveFootageSource } from "@/domain/footageGroups";
import type { ProjectKind } from "@/domain/ProjectKind";
import type { StudioData } from "./StudioSession";

export type StepId = "news" | "clip" | "voice" | "footage" | "music" | "render";

export interface StepInfo {
  id: StepId;
  label: string;
}

/** Các bước của kiểu "Bản tin nhiều cảnh" (giữ nguyên như trước khi có kiểu thứ hai). */
export const STEPS: readonly StepInfo[] = [
  { id: "news", label: "Nhập tin" },
  { id: "voice", label: "Chọn giọng" },
  { id: "footage", label: "Cảnh trám" },
  { id: "music", label: "Nhạc nền" },
  { id: "render", label: "Dựng video" },
];

/** Các bước của kiểu "Video tải lên": không chia cảnh, không cảnh trám. */
export const UPLOAD_STEPS: readonly StepInfo[] = [
  { id: "news", label: "Nhập tiêu đề" },
  { id: "clip", label: "Video của bạn" },
  { id: "voice", label: "Giọng tiêu đề" },
  { id: "music", label: "Nhạc nền" },
  { id: "render", label: "Dựng video" },
];

/** Kiểu đang làm: theo dự án nếu có, không thì theo lựa chọn ở bước 1. */
export function projectKind(data: StudioData): ProjectKind {
  return data.project?.kind ?? data.kind;
}

export function stepsFor(kind: ProjectKind): readonly StepInfo[] {
  return kind === "upload" ? UPLOAD_STEPS : STEPS;
}

export function stepsOf(data: StudioData): readonly StepInfo[] {
  return stepsFor(projectKind(data));
}
```

```ts
export function stepReady(step: StepId, data: StudioData): boolean {
  switch (step) {
    case "news":
      return data.project !== null;
    case "clip":
      return data.project !== null && data.project.kind === "upload" && data.sourceClip !== null;
    case "voice": {
      const before = projectKind(data) === "upload" ? stepReady("clip", data) : data.project !== null;
      return before && data.voice !== null && staleSceneIds(data).length === 0;
    }
    case "footage":
    case "music":
      // Cảnh trống dùng nền mặc định; không nhạc cũng được.
      return stepReady("voice", data);
    case "render":
      return stepReady("music", data);
  }
}

/** Vào được bước `step` khi bước đó thuộc kiểu đang làm và mọi bước đứng trước đã sẵn sàng. */
export function canEnter(step: StepId, data: StudioData): boolean {
  const steps = stepsOf(data);
  const index = steps.findIndex((s) => s.id === step);
  if (index < 0) return false;
  return steps.slice(0, index).every((s) => stepReady(s.id, data));
}

/** Bước đầu tiên chưa xong; khi giọng đã đủ thì là "render" (cảnh trám, nhạc không bắt buộc). */
export function firstIncompleteStep(data: StudioData): StepId {
  const pending = stepsOf(data).find((s) => s.id !== "render" && !stepReady(s.id, data));
  return pending ? pending.id : "render";
}
```

`src/client/controllers/WizardController.ts`:

- Import: `import { canEnter, firstIncompleteStep, stepsOf, type StepId } from "./readiness";` (bỏ `STEPS`).
- Thay `next()` và `back()`:

```ts
  next(): boolean {
    const steps = stepsOf(this.deps.session.state);
    const index = steps.findIndex((s) => s.id === this.state.step);
    const target = steps[index + 1];
    return target ? this.goTo(target.id) : false;
  }

  back(): void {
    const steps = stepsOf(this.deps.session.state);
    const index = steps.findIndex((s) => s.id === this.state.step);
    const target = steps[index - 1];
    if (target) this.patch({ step: target.id });
  }
```

- Trong `cleanupUploads()` thay dòng `const { footage, music } = this.deps.session.state;` bằng `const { footage, music, sourceClip } = this.deps.session.state;` và thêm ngay sau dòng `if (musicId) used.add(musicId);`:

```ts
      if (sourceClip) used.add(sourceClip.uploadId);
```

- Chú thích lớp: `/** Điều hướng các bước (theo kiểu video), mở lại/bỏ bản nháp, dự án mới, dọn file tải lên không còn dùng. */`

`src/views/studio/Stepper.tsx`:

- Import: `import { canEnter, stepReady, stepsOf, type StepId } from "@/client/controllers/readiness";`
- Trong JSX: `{stepsOf(data).map((step, index) => {`
- Dòng `done`: `const done = (step.id === "news" || step.id === "clip" || step.id === "voice") && stepReady(step.id, data);`

`src/views/studio/StudioShell.tsx`:

- Import: `import { canEnter, projectKind, stepsOf, type StepId } from "@/client/controllers/readiness";` và `import type { ProjectKind } from "@/domain/ProjectKind";`
- Thay `BLOCKED_HINT` bằng:

```ts
function blockedHint(step: StepId, kind: ProjectKind): string | undefined {
  if (step === "news") return kind === "upload" ? "Hãy tạo dự án từ tiêu đề trước." : "Hãy chia cảnh từ tin của bạn trước.";
  if (step === "clip") return "Hãy tải video lên trước khi tiếp tục.";
  if (step === "voice") {
    return kind === "upload" ? "Hãy tạo giọng cho câu tiêu đề trước khi tiếp tục." : "Hãy tạo giọng cho mọi câu trước khi tiếp tục.";
  }
  return undefined;
}
```

- Trong `renderStep` thêm nhánh (Task 3 thay bằng `<StepClip studio={studio} />`):

```tsx
    case "clip":
      return null;
```

- Trong `StudioShell`:

```tsx
  const steps = stepsOf(data);
  const index = steps.findIndex((s) => s.id === wizard.step);
  const nextStep = steps[index + 1];
  const nextEnabled = nextStep ? canEnter(nextStep.id, data) : false;
  const hint = blockedHint(wizard.step, projectKind(data));
```

và thay `{nextStep && !nextEnabled && BLOCKED_HINT[wizard.step] && (` … `{BLOCKED_HINT[wizard.step]}` bằng `{nextStep && !nextEnabled && hint && (` … `{hint}`.

- [ ] **Step 8: Chạy toàn bộ kiểm tra**

Run: `npx vitest run; npm run typecheck; npm run lint`
Expected: Vitest PASS toàn bộ (test cũ + mới); typecheck, lint sạch.

- [ ] **Step 9: Chạy e2e kiểu cũ (hồi quy bước động)**

Run: `npm run test:e2e -- e2e/01-nhap-tin.spec.ts e2e/03-ban-nhap-va-phien.spec.ts`
Expected: PASS (nhãn và thứ tự bước kiểu tin không đổi).

- [ ] **Step 10: Commit** (điều phối viên) — `feat: kiểu dự án, SourceClip, bản nháp v3, bước theo kiểu`

---

### Task 2: Bước 1 chọn kiểu + biểu mẫu tiêu đề + xem trước kiểu tải lên

**Có Vitest:** `ProjectController`, `PreviewFrameBuilder`, `PreviewController.setImage`, template (`containRect`, `media`, `mediaCredit`). **Không Vitest:** `StepNews.tsx`, `PreviewPanel.tsx`, `OptionsSidebar.tsx` (kiểm bằng e2e 01/04/05 cũ ở Step 8 và e2e 07 ở Task 7).

**Files:**
- Modify: `src/client/controllers/ProjectController.ts`, `src/client/preview/PreviewFrameBuilder.ts`, `src/client/preview/PreviewController.ts`, `src/templates/VideoTemplate.ts`, `src/templates/theanh28/layout.ts`, `src/templates/theanh28/TheAnh28Template.ts`, `src/views/studio/steps/StepNews.tsx`, `src/views/studio/components/PreviewPanel.tsx`, `src/views/studio/components/OptionsSidebar.tsx`
- Test: `tests/client/controllers/ProjectController.test.ts`, `tests/client/preview/PreviewFrameBuilder.test.ts`, `tests/client/preview/PreviewController.test.ts`, `tests/templates/theanh28/TheAnh28Template.test.ts`, `tests/templates/theanh28/layout.test.ts`

**Interfaces:**
- Consumes (Task 1): `ProjectKind`, `PROJECT_KINDS`, `PROJECT_KIND_LABELS`, `MEDIA_CREDIT`, `isProjectKind`; `NewsProject.titleOnly`, `NewsProject.kind`; `StudioData.kind/sourceClip`; `projectKind(data)`; fixtures `makeUploadProject`.
- Produces:
  - `ProjectController.setKind(kind: ProjectKind): boolean`; `ProjectController.createTitleOnlyFromForm(form: { title: string; sourceCredit: string; publishDateText: string; templateId: string }): boolean`; hằng `KIND_LOCKED_MESSAGE`.
  - `src/templates/VideoTemplate.ts`: `interface SceneMedia { fit: "cover" | "contain"; motion: boolean }`; `SOURCE_CLIP_MEDIA: SceneMedia = { fit: "contain", motion: false }`; `SceneFrame.media?: SceneMedia` (bỏ trống = cover + Ken Burns như cũ); `ProjectFrame.mediaCredit?: string` (bỏ trống = "ẢNH: TỔNG HỢP").
  - `layout.ts`: `containRect(srcW, srcH, box): Rect`.
  - `PreviewForm.kind?: ProjectKind`; `PreviewController.setImage(image: DrawableImage | null): void`.
  - `PreviewPanel` props: `{ studio; form: PreviewForm; image?: DrawableImage | null }`.

- [ ] **Step 1: Viết test (đỏ)**

Thêm vào cuối `tests/client/controllers/ProjectController.test.ts`:

```ts
describe("ProjectController — kiểu video", () => {
  const form = { title: "Clip hiện trường", sourceCredit: "Báo A", publishDateText: "2026-10-21", templateId: "theanh28" };

  it("setKind khi chưa có dự án thì đổi kiểu; có dự án rồi thì khoá", () => {
    const { ctrl, session } = setup();
    expect(ctrl.setKind("upload")).toBe(true);
    expect(session.state.kind).toBe("upload");
    expect(ctrl.createTitleOnlyFromForm(form)).toBe(true);
    expect(ctrl.setKind("news")).toBe(false);
    expect(ctrl.state.error).toBe(KIND_LOCKED_MESSAGE);
    expect(session.state.kind).toBe("upload");
  });

  it("setKind từ chối giá trị lạ", () => {
    const { ctrl } = setup();
    expect(ctrl.setKind("khac" as never)).toBe(false);
    expect(ctrl.state.error).toBe("Kiểu video không hợp lệ");
  });

  it("createTitleOnlyFromForm: dự án upload một cảnh, xoá giọng/cảnh trám/video cũ", () => {
    const { ctrl, session } = setup();
    session.update((d) => ({ ...d, voice: VOICE }));
    expect(ctrl.createTitleOnlyFromForm(form)).toBe(true);
    const p = session.state.project!;
    expect(p.kind).toBe("upload");
    expect(p.scenes).toHaveLength(1);
    expect(p.title).toBe("Clip hiện trường");
    expect(p.formattedPublishDate()).toBe("21/10/2026");
    expect(session.state.sourceClip).toBeNull();
    expect(session.state.voice).toBe(VOICE);
  });

  it("createTitleOnlyFromForm: thiếu tiêu đề hoặc ngày sai thì báo lỗi, không tạo", () => {
    const { ctrl, session } = setup();
    expect(ctrl.createTitleOnlyFromForm({ ...form, title: "" })).toBe(false);
    expect(ctrl.state.error).toBe("Chưa có tiêu đề video");
    expect(ctrl.createTitleOnlyFromForm({ ...form, publishDateText: "2026-13-40" })).toBe(false);
    expect(session.state.project).toBeNull();
  });
});
```

(thêm import `KIND_LOCKED_MESSAGE` từ `@/client/controllers/ProjectController`.)

Thêm vào `tests/templates/theanh28/layout.test.ts` (import `containRect` cùng chỗ với `coverRect`):

```ts
describe("containRect", () => {
  it("vừa khung, giữ tỉ lệ, căn giữa", () => {
    expect(containRect(1600, 900, { x: 0, y: 380, w: 1080, h: 920 })).toEqual({ x: 0, y: 536.25, w: 1080, h: 607.5 });
    expect(containRect(1080, 1920, { x: 0, y: 380, w: 1080, h: 920 })).toEqual({ x: 281.25, y: 380, w: 517.5, h: 920 });
  });
});
```

Thêm vào cuối `tests/templates/theanh28/TheAnh28Template.test.ts` (import `SOURCE_CLIP_MEDIA` từ `@/templates/VideoTemplate`):

```ts
describe("TheAnh28Template — video tải lên", () => {
  const bandImageCalls = (c: RecordingCanvas) =>
    c.ops("drawImage").filter((x) => x.args[0] === image.source && x.args.length === 5 && x.state.filter === "none");

  it("media contain + không chuyển động: video vừa dải thân bài, không zoom theo thời gian", () => {
    const early = bandImageCalls(draw(project(), scene({ media: SOURCE_CLIP_MEDIA, sceneTime: 0 })));
    const late = bandImageCalls(draw(project(), scene({ media: SOURCE_CLIP_MEDIA, sceneTime: 3.9 })));
    expect(early.at(-1)?.args.slice(1)).toEqual([0, 536.25, 1080, 607.5]);
    expect(late.at(-1)?.args.slice(1)).toEqual([0, 536.25, 1080, 607.5]);
  });

  it("không có media: vẫn cover + Ken Burns như cũ", () => {
    const calls = bandImageCalls(draw(project(), scene({ sceneTime: 0 })));
    const w = calls.at(-1)?.args[3] as number;
    expect(w).toBeGreaterThan(1080);
  });

  it("mediaCredit thay dòng 'ẢNH: TỔNG HỢP'; bỏ trống giữ như cũ", () => {
    expect(draw(project({ mediaCredit: "VIDEO: TỔNG HỢP" }), scene()).texts()).toContain("VIDEO: TỔNG HỢP");
    expect(draw(project({ mediaCredit: "VIDEO: TỔNG HỢP" }), scene()).texts()).not.toContain("ẢNH: TỔNG HỢP");
    expect(draw(project(), scene()).texts()).toContain("ẢNH: TỔNG HỢP");
  });
});
```

Thêm vào cuối `tests/client/preview/PreviewFrameBuilder.test.ts` (dùng các helper sẵn có trong file để dựng `template`, `options`; nếu file đặt tên khác thì dựng tại chỗ như dưới):

```ts
describe("buildPreviewFrames — kiểu Video tải lên", () => {
  const template = defaultTemplateRegistry().get("theanh28");
  const base = {
    template,
    brandValues: {},
    options: VideoOptions.defaults().snapshot(),
    logo: null,
    image: { source: {} as CanvasImageSource, width: 1280, height: 720 },
    now: new Date(2026, 9, 21),
  };
  const form = { text: "", title: "Clip hiện trường vụ cháy.", sourceCredit: "Báo A", publishDateText: "2026-10-21", templateId: "theanh28", kind: "upload" as const };

  it("tiêu đề lấy từ ô tiêu đề; thân bài là khung video vừa khung, không chữ, không phụ đề, credit VIDEO", () => {
    const f = buildPreviewFrames({ ...base, form });
    expect(f.usingSample).toBe(false);
    expect(f.project.displayTitle).toBe("Clip hiện trường vụ cháy");
    expect(f.project.mediaCredit).toBe("VIDEO: TỔNG HỢP");
    expect(f.project.style?.subtitles.enabled).toBe(false);
    expect(f.intro.text).toBe("Clip hiện trường vụ cháy.");
    expect(f.body.text).toBe("");
    expect(f.body.media).toEqual({ fit: "contain", motion: false });
    expect(f.body.image).toBe(base.image);
  });

  it("chưa gõ tiêu đề thì dùng tiêu đề mẫu và báo usingSample", () => {
    const f = buildPreviewFrames({ ...base, form: { ...form, title: " " } });
    expect(f.usingSample).toBe(true);
    expect(f.project.displayTitle.length).toBeGreaterThan(10);
  });

  it("kiểu tin (kind bỏ trống) giữ nguyên: không media, không mediaCredit", () => {
    const f = buildPreviewFrames({ ...base, form: { ...form, kind: undefined, text: "Câu một. Câu hai." } });
    expect(f.body.media).toBeUndefined();
    expect(f.project.mediaCredit).toBeUndefined();
  });
});
```

(thêm import `defaultTemplateRegistry` từ `@/templates/registry` và `VideoOptions` từ `@/domain/VideoOptions` nếu file chưa có.)

Thêm vào cuối `describe("PreviewController", …)` trong `tests/client/preview/PreviewController.test.ts`:

```ts
  it("setImage thay ảnh minh hoạ và vẽ lại; null thì về ảnh minh hoạ", async () => {
    const { ctrl, sched, canvas } = setup();
    ctrl.attach({ ctx: canvas.asCanvas(), placeholder });
    ctrl.setForm(form({ kind: "upload", text: "", title: "Clip A" }));
    await settle(sched);
    const frame: DrawableImage = { source: { tag: "frame" } as unknown as CanvasImageSource, width: 1280, height: 720 };
    const before = ctrl.state.drawCount;
    ctrl.setImage(frame);
    await settle(sched);
    expect(ctrl.state.drawCount).toBe(before + 1);
    expect(canvas.ops("drawImage").some((c) => c.args[0] === frame.source)).toBe(true);
    ctrl.setImage(frame); // cùng ảnh: không vẽ lại
    await settle(sched);
    expect(ctrl.state.drawCount).toBe(before + 1);
    ctrl.setImage(null);
    await settle(sched);
    expect(ctrl.state.drawCount).toBe(before + 2);
  });
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `npx vitest run tests/client/controllers/ProjectController.test.ts tests/templates tests/client/preview`
Expected: FAIL — `ctrl.setKind is not a function`, `containRect is not a function`, `expected [ …cover… ] to deeply equal [ 0, 536.25, 1080, 607.5 ]`, `ctrl.setImage is not a function`.

- [ ] **Step 3: Viết template + layout**

`src/templates/theanh28/layout.ts` thêm sau `coverRect`:

```ts
/** Vừa trọn trong khung (không cắt), giữ tỉ lệ, căn giữa. */
export function containRect(srcW: number, srcH: number, box: Rect): Rect {
  const scale = Math.min(box.w / srcW, box.h / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}
```

`src/templates/VideoTemplate.ts`:

- Thêm trước `ProjectFrame`:

```ts
/** Cách đặt ảnh/video vào khung: cắt cho đầy (cover) hay vừa trọn (contain); có zoom Ken Burns hay đứng yên. */
export interface SceneMedia {
  fit: "cover" | "contain";
  motion: boolean;
}

/** Video người dùng tải lên: không cắt mất nội dung, không zoom. */
export const SOURCE_CLIP_MEDIA: SceneMedia = { fit: "contain", motion: false };
```

- `ProjectFrame` thêm trường cuối: `/** Dòng thứ hai khối nguồn tin; bỏ trống = "ẢNH: TỔNG HỢP". */ mediaCredit?: string;`
- `SceneFrame` thêm trường cuối: `/** Bỏ trống = cover + Ken Burns (như cảnh trám). */ media?: SceneMedia;`

`src/templates/theanh28/TheAnh28Template.ts`:

- Import thêm `containRect` từ `./layout` và `type SceneMedia` từ `../VideoTemplate`.
- Trong `drawBody` đổi `this.drawClipped(ctx, scene.image, B.band, this.progress(scene));` thành `this.drawClipped(ctx, scene.image, B.band, this.progress(scene), scene.media);`
- Trong `drawOverlay` đổi dòng `const lines = …` thành:

```ts
    const mediaCredit = project.mediaCredit ?? "ẢNH: TỔNG HỢP";
    const lines = project.sourceCredit ? [`THEO: ${upper(project.sourceCredit)}`, mediaCredit] : [mediaCredit];
```

- Thay `drawClipped`:

```ts
  private drawClipped(ctx: Canvas2D, image: DrawableImage, box: Rect, progress: number, media?: SceneMedia): void {
    const base = media?.fit === "contain" ? containRect(image.width, image.height, box) : coverRect(image.width, image.height, box);
    const target = media?.motion === false ? base : kenBurnsRect(base, progress);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.drawImage(image.source, target.x, target.y, target.w, target.h);
    ctx.restore();
  }
```

- [ ] **Step 4: Viết ProjectController**

`src/client/controllers/ProjectController.ts` — thêm import `import { isProjectKind, type ProjectKind } from "@/domain/ProjectKind";`, thêm hằng và hai phương thức; `createFrom` thêm `sourceClip: null`:

```ts
export const KIND_LOCKED_MESSAGE = "Đã có dự án. Muốn đổi kiểu video, bấm “Dự án mới” (dự án, giọng và video đã tải sẽ bị xoá).";
```

```ts
  /** Chọn kiểu video ở bước 1. Chỉ đổi được khi chưa có dự án. */
  setKind(kind: ProjectKind): boolean {
    return this.attempt(() => {
      if (!isProjectKind(kind)) throw new ValidationError("Kiểu video không hợp lệ");
      if (this.deps.session.state.project) throw new ValidationError(KIND_LOCKED_MESSAGE);
      if (this.deps.session.state.kind !== kind) this.deps.session.update((d) => ({ ...d, kind }));
    });
  }

  /** Kiểu "Video tải lên": dự án chỉ có câu tiêu đề. */
  createTitleOnlyFromForm(form: { title: string; sourceCredit: string; publishDateText: string; templateId: string }): boolean {
    const publishDate = this.parseDate(form.publishDateText);
    if (!publishDate) return false;
    return this.attempt(() => {
      const project = NewsProject.titleOnly(
        { title: form.title, sourceCredit: form.sourceCredit, publishDate, templateId: form.templateId },
        this.deps.ids,
      );
      this.deps.session.update((d) => ({
        ...d,
        kind: "upload",
        project,
        narrations: new Map(),
        footage: FootageBoard.empty(),
        sourceClip: null,
      }));
    });
  }
```

Trong `createFrom` đổi object update thành `({ ...d, project, narrations: new Map(), footage: FootageBoard.empty(), sourceClip: null })`. Chú thích lớp: `/** Bước 1: chọn kiểu video, tạo dự án (chia cảnh hoặc chỉ tiêu đề), sửa/gộp/tách cảnh. */`

- [ ] **Step 5: Viết xem trước**

`src/client/preview/PreviewFrameBuilder.ts`:

- Import thêm `import { MEDIA_CREDIT, type ProjectKind } from "@/domain/ProjectKind";` và `import { SOURCE_CLIP_MEDIA } from "@/templates/VideoTemplate";` (gộp vào dòng import từ `@/templates/VideoTemplate` sẵn có).
- `PreviewForm` thêm `/** Bỏ trống = "news". */ kind?: ProjectKind;`
- Tách phần tính ngày, nguồn thành hàm dùng chung và thêm nhánh upload:

```ts
function previewDate(form: PreviewForm, usingSample: boolean, now: Date | undefined): Date {
  try {
    return fromDateInput(form.publishDateText);
  } catch {
    return usingSample ? SAMPLE_NEWS.publishDate : (now ?? new Date());
  }
}

/** Kiểu "Video tải lên": thẻ đầu với tiêu đề; thân bài là khung video vừa khung, không chữ, không phụ đề. */
function buildUploadFrames(input: PreviewInput, splitter: SentenceSplitter): PreviewFrames {
  const { form, template, options } = input;
  const typed = form.title.replace(/\s+/g, " ").trim();
  const usingSample = typed === "";
  const introText = typed || (splitter.split(SAMPLE_NEWS.text)[0] ?? "Tiêu đề video");
  const publishDate = previewDate(form, usingSample, input.now);
  const credit = form.sourceCredit.trim() || (usingSample ? SAMPLE_NEWS.sourceCredit : "");
  const style = frameStyleFor(options);
  const project: ProjectFrame = {
    displayTitle: introText.replace(/[.!?…]+$/u, "").trim(),
    sourceCredit: credit,
    publishDateText: dateText(publishDate),
    brand: brandKit(template, input.brandValues),
    logo: input.logo,
    style: { ...style, subtitles: { ...style.subtitles, enabled: false } },
    mediaCredit: MEDIA_CREDIT.upload,
  };
  const { leadInSec, gapSec } = options.pacing;
  const introVoice = voiceSecFor(introText);
  const introDuration = leadInSec + introVoice + gapSec;
  const intro: SceneFrame = {
    role: "intro",
    text: introText,
    image: input.image,
    sceneTime: 0,
    sceneDuration: introDuration,
    footageTime: 0,
    footageDuration: introDuration,
    voiceStart: leadInSec,
    voiceDuration: introVoice,
  };
  const body: SceneFrame = {
    role: "body",
    text: "",
    image: input.image,
    sceneTime: 0,
    sceneDuration: 1,
    footageTime: 0,
    footageDuration: 1,
    voiceStart: 0,
    voiceDuration: 0,
    media: SOURCE_CLIP_MEDIA,
  };
  return { project, intro, body, usingSample };
}
```

- Trong `buildPreviewFrames`, dòng đầu thân hàm: `if (input.form.kind === "upload") return buildUploadFrames(input, splitter);` và thay khối `let publishDate … catch {…}` bằng `const publishDate = previewDate(form, usingSample, input.now);` (kết quả giống hệt).

`src/client/preview/PreviewController.ts`:

- Thêm trường `private image: DrawableImage | null = null;` và `private imageVersion = 0;`
- Thêm phương thức:

```ts
  /** Ảnh thật thay ảnh minh hoạ (ví dụ khung của video tải lên); null = về ảnh minh hoạ. */
  setImage(image: DrawableImage | null): void {
    if (image === this.image) return;
    this.image = image;
    this.imageVersion += 1;
    this.request(0);
  }
```

- Trong `draw()`: khoá thành `JSON.stringify({ tab: this.state.tab, form, brand: brand.values, options: snapshot, image: this.imageVersion })` và `buildPreviewFrames({ …, image: this.image ?? surface.placeholder })`.

- [ ] **Step 6: Chạy test, xác nhận xanh**

Run: `npx vitest run tests/client/controllers/ProjectController.test.ts tests/templates tests/client/preview`
Expected: PASS.

- [ ] **Step 7: Viết view**

`src/views/studio/components/PreviewPanel.tsx`:

- Props: `export function PreviewPanel({ studio, form, image }: { studio: Studio; form: PreviewForm; image?: DrawableImage | null })` (import `type DrawableImage` từ `@/templates/VideoTemplate`).
- Thêm tab của kiểu upload và chọn theo kiểu:

```ts
const UPLOAD_TABS: { id: PreviewTab; label: string }[] = [
  { id: "intro", label: "Thumbnail đầu" },
  { id: "body", label: "Khung video" },
];
```

- Effect form: `const { text, title, sourceCredit, publishDateText, templateId, kind } = form;` → `controller.setForm({ text, title, sourceCredit, publishDateText, templateId, kind })`, phụ thuộc thêm `kind`.
- Effect ảnh: `useEffect(() => { controller.setImage(image ?? null); }, [controller, image]);`
- `const tabs = kind === "upload" ? UPLOAD_TABS : TABS;` và map `tabs`.
- `aria-label` canvas: `state.tab === "intro" ? "Xem trước thumbnail đầu" : kind === "upload" ? "Xem trước khung video" : "Xem trước cảnh thân bài"`.
- Dòng chú thích dưới canvas:

```tsx
        <p className="text-xs text-neutral-500">
          {kind === "upload"
            ? image
              ? "Khung lấy từ video của bạn."
              : "Ảnh nền là ảnh minh hoạ; khung thật lấy từ video bạn tải lên ở bước 2."
            : "Ảnh nền là ảnh minh hoạ; cảnh trám thật chọn ở bước 3."}
        </p>
```

`src/views/studio/steps/StepNews.tsx` — thay toàn bộ file:

```tsx
"use client";

import { useRef, useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { toDateInput } from "@/client/controllers/dateText";
import { projectKind } from "@/client/controllers/readiness";
import { SAMPLE_NEWS } from "@/client/sample/sampleNews";
import type { NewsProject } from "@/domain/NewsProject";
import { PROJECT_KIND_LABELS, PROJECT_KINDS } from "@/domain/ProjectKind";
import { useController } from "@/views/hooks/useController";
import { BrandPanel } from "../components/BrandPanel";
import { PreviewPanel } from "../components/PreviewPanel";

const KIND_HINT = {
  news: "Dán cả bản tin; mỗi câu thành một cảnh có giọng đọc và cảnh trám riêng.",
  upload: "Chỉ nhập tiêu đề; giọng đọc tiêu đề trên thẻ đầu, sau đó chạy nguyên video của bạn.",
} as const;

const LOCKED_HINT = "Muốn đổi kiểu video, bấm “Dự án mới”.";

function MetaFields({ studio, project }: { studio: Studio; project: NewsProject }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Theo: nguồn tin
        <input
          className="rounded-md bg-neutral-800 px-3 py-2"
          defaultValue={project.sourceCredit}
          maxLength={80}
          onBlur={(e) => {
            if (e.target.value !== project.sourceCredit) studio.project.updateMetaFromForm({ sourceCredit: e.target.value });
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Ngày đăng
        <input
          type="date"
          className="rounded-md bg-neutral-800 px-3 py-2"
          defaultValue={toDateInput(project.publishDate)}
          onBlur={(e) => {
            if (e.target.value && e.target.value !== toDateInput(project.publishDate)) {
              studio.project.updateMetaFromForm({ publishDateText: e.target.value });
            }
          }}
        />
      </label>
    </div>
  );
}

export function StepNews({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const projectState = useController(studio.project);
  const templates = studio.services.templates.list();
  const project = data.project;
  const kind = projectKind(data);

  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [credit, setCredit] = useState("");
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const textareas = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const error = projectState.error && (
    <p role="alert" className="text-red-400">
      {projectState.error}
    </p>
  );

  if (!project) {
    const upload = kind === "upload";
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]">
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
          <fieldset className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-3 text-sm">
            <legend className="px-1 font-medium">Kiểu video</legend>
            <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
              {PROJECT_KINDS.map((k) => (
                <label key={k} className="flex min-h-11 items-center gap-2 sm:min-h-0">
                  <input type="radio" name="kieu-video" value={k} checked={kind === k} onChange={() => studio.project.setKind(k)} />
                  {PROJECT_KIND_LABELS[k]}
                </label>
              ))}
            </div>
            <p className="text-xs text-neutral-500">{KIND_HINT[kind]}</p>
          </fieldset>
          <h2 className="text-lg font-semibold">{upload ? "Nhập tiêu đề" : "Nhập tin"}</h2>
          {!upload && (
            <label className="flex flex-col gap-1 text-sm">
              Nội dung tin (dán vào đây)
              <textarea
                className="min-h-48 rounded-md bg-neutral-800 px-3 py-2"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Mỗi câu sẽ thành một cảnh."
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            {upload ? "Tiêu đề video" : "Tiêu đề (để trống thì lấy câu đầu tiên)"}
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
          {error}
          <div className="flex gap-3">
            {upload ? (
              <button
                type="button"
                className="min-h-11 sm:min-h-0 rounded-md bg-emerald-600 px-4 py-2 font-medium"
                onClick={() => studio.project.createTitleOnlyFromForm({ title, sourceCredit: credit, publishDateText: date, templateId })}
              >
                Tạo dự án
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="min-h-11 sm:min-h-0 rounded-md bg-emerald-600 px-4 py-2 font-medium"
                  onClick={() => studio.project.createFromForm({ text, title, sourceCredit: credit, publishDateText: date, templateId })}
                >
                  Chia cảnh
                </button>
                <button
                  type="button"
                  className="min-h-11 sm:min-h-0 rounded-md bg-neutral-800 px-4 py-2"
                  onClick={() => {
                    setText(SAMPLE_NEWS.text);
                    setCredit(SAMPLE_NEWS.sourceCredit);
                    setDate(toDateInput(SAMPLE_NEWS.publishDate));
                  }}
                >
                  Điền tin mẫu
                </button>
              </>
            )}
          </div>
        </div>
        <PreviewPanel studio={studio} form={{ text: upload ? "" : text, title, sourceCredit: credit, publishDateText: date, templateId, kind }} />
      </div>
    );
  }

  if (project.kind === "upload") {
    const intro = project.introScene;
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Tiêu đề và thông tin</h2>
        <p className="text-sm text-neutral-400">
          Kiểu video: {PROJECT_KIND_LABELS.upload}. {LOCKED_HINT}
        </p>
        <label className="flex flex-col gap-1 text-sm">
          Tiêu đề video
          <textarea
            key={intro.text}
            className="min-h-16 rounded-md bg-neutral-800 px-3 py-2"
            defaultValue={intro.text}
            onBlur={(e) => {
              if (e.target.value !== intro.text) studio.project.updateSceneText(intro.id, e.target.value);
            }}
          />
        </label>
        <MetaFields studio={studio} project={project} />
        <BrandPanel studio={studio} templateId={project.templateId} />
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Các cảnh ({project.scenes.length})</h2>
      <p className="text-sm text-neutral-400">
        Kiểu video: {PROJECT_KIND_LABELS.news}. {LOCKED_HINT}
      </p>
      <MetaFields studio={studio} project={project} />
      <BrandPanel studio={studio} templateId={project.templateId} />
      {error}
      <ol className="flex flex-col gap-3">
        {project.scenes.map((scene, index) => (
          <li key={scene.id} className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-3">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>{scene.role === "intro" ? "Cảnh mở đầu (tiêu đề)" : `Cảnh ${index}`}</span>
              <span>{scene.text.length} ký tự</span>
            </div>
            <textarea
              key={scene.text}
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
                  className="min-h-11 sm:min-h-0 rounded-md bg-neutral-800 px-3 py-1"
                  disabled={index === project.scenes.length - 1}
                  onClick={() => studio.project.mergeWithNext(scene.id)}
                >
                  Gộp với câu sau
                </button>
                <button
                  type="button"
                  className="min-h-11 sm:min-h-0 rounded-md bg-neutral-800 px-3 py-1"
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

`src/views/studio/components/OptionsSidebar.tsx`:

- Import `projectKind` từ `@/client/controllers/readiness`; trong thân: `const upload = projectKind(data) === "upload";`
- Fieldset phụ đề: `<fieldset className="flex flex-col gap-2" disabled={upload}>`; checkbox `checked={!upload && options.subtitlesEnabled}`; select font phụ đề `disabled={upload || !options.subtitlesEnabled}`; thêm cuối fieldset `{upload && <p className="text-xs text-neutral-500">Kiểu Video tải lên không có phụ đề.</p>}`.
- Nhãn nghỉ: `<label htmlFor="tvs-nghi-giua-cau">{upload ? "Nghỉ sau tiêu đề" : "Nghỉ giữa các câu"}: {secText(options.gapSec)} giây</label>`
- Bọc fieldset "Ảnh/Video khi tự tìm" bằng `{!upload && ( … )}`.

- [ ] **Step 8: Chạy toàn bộ kiểm tra + e2e cũ của bước 1**

Run: `npx vitest run; npm run typecheck; npm run lint; npm run test:e2e -- e2e/01-nhap-tin.spec.ts e2e/04-tuy-chon-video.spec.ts e2e/05-xem-truoc-nhap-tin.spec.ts`
Expected: tất cả PASS (kiểu mặc định "Bản tin nhiều cảnh" nên nhãn, nút "Chia cảnh", "Điền tin mẫu", tab "Cảnh thân bài" giữ nguyên).

- [ ] **Step 9: Commit** (điều phối viên) — `feat: chọn kiểu video ở bước 1, biểu mẫu tiêu đề và xem trước kiểu tải lên`

---

### Task 3: Tải lên và kiểm video ("Video của bạn") + mức tiếng gốc

**Có Vitest:** `UploadValidator` (giới hạn riêng, thời lượng, `formatClock`), `SourceClipController`, `createStudio` (lắp + dọn). **Không Vitest (chỉ chạy trên trình duyệt):** `BrowserMediaProbe.clip`, `VideoFrameProvider.startSec`, `ClipThumbnail.ts`, `StepClip.tsx` — kiểm bằng typecheck ở task này và e2e 07 ở Task 7.

**Files:**
- Create: `src/client/controllers/SourceClipController.ts`, `src/client/media/ClipThumbnail.ts`, `src/views/studio/steps/StepClip.tsx`, `tests/client/controllers/SourceClipController.test.ts`
- Modify: `src/client/media/UploadValidator.ts`, `src/client/media/MediaProbe.ts`, `src/client/media/MediaFrameProvider.ts`, `src/client/container.ts`, `src/client/controllers/createStudio.ts`, `src/views/studio/StudioShell.tsx`
- Test: `tests/client/media/UploadValidator.test.ts`, `tests/client/controllers/createStudio.test.ts`

**Interfaces:**
- Consumes (Task 1–2): `SourceClip`, `SourceClip.MAX_DURATION_SEC`, `SourceClip.DURATION_TOLERANCE_SEC`, `SOURCE_CLIP_VOLUME`; `StudioData.sourceClip`; `PreviewPanel` prop `image`; fixtures `makeUploadProject`, `makeClip`, `memoryUploads`, `makeSession`.
- Produces:
  - `UploadValidator`: `classifyUpload(file, allowed?, limits?: Partial<Record<UploadKind, number>>)`; `SOURCE_CLIP_LIMITS = { maxBytes: 500 * MB, maxDurationSec: 300 }`; `classifySourceClip(file): "video"`; `checkSourceClipDuration(durationSec: number): void`; `formatClock(sec: number): string` ("m:ss").
  - `MediaProbe.ts`: `interface ClipInfo { width; height; durationSec; hasAudio }`; `interface SourceClipProbe { clip(blob: Blob): Promise<ClipInfo> }`; `BrowserMediaProbe implements MediaProbe, SourceClipProbe`.
  - `ClientServices.probe: MediaProbe & SourceClipProbe`.
  - `VideoFrameProvider.startSec: number` (mốc khung hình đầu, giây).
  - `SourceClipController` (`state: { busy; error }`, `ingesting`, `upload(file)`, `setVolume(percent)`, `remove()`, `blobFor(uploadId)`, `reset()`); hằng `UNREADABLE_CLIP`, `NOT_UPLOAD_PROJECT`.
  - `Studio.clip: SourceClipController`.
  - `loadClipThumbnail(blob, atSec): Promise<{ image: DrawableImage; dispose(): void }>`.

- [ ] **Step 1: Viết test (đỏ)**

Thêm vào cuối `tests/client/media/UploadValidator.test.ts` (import thêm `checkSourceClipDuration, classifySourceClip, formatClock, SOURCE_CLIP_LIMITS`):

```ts
describe("video tải lên (kiểu Video tải lên)", () => {
  it("nhận MP4/MOV/WebM tới 500 MB; giới hạn cảnh trám 300 MB giữ nguyên", () => {
    expect(classifySourceClip(file("a.mp4", "video/mp4", 500 * MB))).toBe("video");
    expect(classifySourceClip(file("a.MOV", "", 10 * MB))).toBe("video");
    expect(() => classifySourceClip(file("a.mp4", "video/mp4", 500 * MB + 1))).toThrow("File quá lớn (tối đa 500 MB cho video)");
    expect(() => classifyUpload(file("a.mp4", "video/mp4", 300 * MB + 1))).toThrow("File quá lớn (tối đa 300 MB cho video)");
    expect(SOURCE_CLIP_LIMITS).toEqual({ maxBytes: 500 * MB, maxDurationSec: 300 });
  });

  it("chỉ nhận video", () => {
    expect(() => classifySourceClip(file("a.jpg", "image/jpeg"))).toThrow("Không nhận file ảnh ở đây");
    expect(() => classifySourceClip(file("a.mp3", "audio/mpeg"))).toThrow("Không nhận file nhạc ở đây");
  });

  it("thời lượng tối đa 5:00 (dung sai 0,5 s), báo theo phút:giây", () => {
    expect(() => checkSourceClipDuration(300.4)).not.toThrow();
    expect(() => checkSourceClipDuration(301)).toThrow("Video dài 5:01, tối đa 5 phút. Hãy cắt ngắn rồi tải lại.");
    expect(() => checkSourceClipDuration(0)).toThrow("Không đọc được độ dài video");
    expect(() => checkSourceClipDuration(Number.NaN)).toThrow("Không đọc được độ dài video");
  });

  it("formatClock", () => {
    expect(formatClock(8)).toBe("0:08");
    expect(formatClock(65.4)).toBe("1:05");
    expect(formatClock(300)).toBe("5:00");
  });
});
```

`tests/client/controllers/SourceClipController.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { NOT_UPLOAD_PROJECT, SourceClipController, UNREADABLE_CLIP } from "@/client/controllers/SourceClipController";
import type { ClipInfo, SourceClipProbe } from "@/client/media/MediaProbe";
import { makeProject, makeSession, makeUploadProject, memoryUploads } from "../../helpers/studioFixtures";

const MB = 1024 * 1024;
const INFO: ClipInfo = { width: 1280, height: 720, durationSec: 8, hasAudio: true };
const mp4 = (name = "clip.mp4") => new File([new Uint8Array([1, 2, 3])], name, { type: "video/mp4" });

function setup(probe: SourceClipProbe = { clip: vi.fn(async () => INFO) }) {
  const made = makeSession();
  made.session.update((d) => ({ ...d, project: makeUploadProject() }));
  const { uploads } = memoryUploads("u");
  const ctrl = new SourceClipController({ session: made.session, uploads, probe });
  return { ...made, uploads, ctrl, probe };
}

describe("SourceClipController", () => {
  it("tải lên: lưu blob, ghi SourceClip vào session", async () => {
    const { ctrl, session, uploads } = setup();
    await ctrl.upload(mp4());
    const clip = session.state.sourceClip!;
    expect(clip.name).toBe("clip.mp4");
    expect(clip.durationSec).toBe(8);
    expect(clip.hasAudio).toBe(true);
    expect(clip.volumePercent).toBe(100);
    expect((await uploads.get(clip.uploadId))?.kind).toBe("video");
    expect(ctrl.state).toEqual({ busy: false, error: null });
  });

  it("quá 5 phút: báo lỗi, không lưu blob", async () => {
    const { ctrl, session, uploads } = setup({ clip: async () => ({ ...INFO, durationSec: 301 }) });
    await ctrl.upload(mp4());
    expect(ctrl.state.error).toBe("Video dài 5:01, tối đa 5 phút. Hãy cắt ngắn rồi tải lại.");
    expect(session.state.sourceClip).toBeNull();
    expect(await uploads.list()).toEqual([]);
  });

  it("quá 500 MB: báo lỗi trước khi đọc file", async () => {
    const probe = { clip: vi.fn(async () => INFO) };
    const { ctrl } = setup(probe);
    await ctrl.upload({ name: "to.mp4", type: "video/mp4", size: 501 * MB } as unknown as File);
    expect(ctrl.state.error).toBe("File quá lớn (tối đa 500 MB cho video)");
    expect(probe.clip).not.toHaveBeenCalled();
  });

  it("file không đọc được (lỗi thô của bộ đọc) thì báo tiếng Việt", async () => {
    const { ctrl } = setup({ clip: async () => { throw new Error("Unsupported codec hvc1"); } });
    await ctrl.upload(mp4());
    expect(ctrl.state.error).toBe(UNREADABLE_CLIP);
  });

  it("thay video: xoá blob cũ, giữ mức âm lượng đã chỉnh", async () => {
    const { ctrl, session, uploads } = setup();
    await ctrl.upload(mp4("a.mp4"));
    ctrl.setVolume(40);
    const first = session.state.sourceClip!.uploadId;
    await ctrl.upload(mp4("b.mp4"));
    const second = session.state.sourceClip!;
    expect(second.name).toBe("b.mp4");
    expect(second.volumePercent).toBe(40);
    expect(await uploads.get(first)).toBeNull();
    expect((await uploads.list()).map((m) => m.id)).toEqual([second.uploadId]);
  });

  it("chỉnh âm lượng: làm tròn bước 5; ngoài 0–150 thì báo lỗi", async () => {
    const { ctrl, session } = setup();
    ctrl.setVolume(50);
    expect(ctrl.state.error).toBe("Chưa tải video lên");
    await ctrl.upload(mp4());
    ctrl.setVolume(73);
    expect(session.state.sourceClip?.volumePercent).toBe(75);
    ctrl.setVolume(155);
    expect(ctrl.state.error).toBe("Âm lượng tiếng gốc chỉ từ 0 đến 150 %");
    expect(session.state.sourceClip?.volumePercent).toBe(75);
  });

  it("xoá video: bỏ khỏi session và xoá blob", async () => {
    const { ctrl, session, uploads } = setup();
    await ctrl.upload(mp4());
    await ctrl.remove();
    expect(session.state.sourceClip).toBeNull();
    expect(await uploads.list()).toEqual([]);
  });

  it("dự án kiểu tin hoặc chưa có dự án thì không nhận", async () => {
    const { ctrl, session } = setup();
    session.update((d) => ({ ...d, project: makeProject(2) }));
    await ctrl.upload(mp4());
    expect(ctrl.state.error).toBe(NOT_UPLOAD_PROJECT);
  });

  it("dự án mới giữa lúc đang tải: bỏ kết quả và xoá blob vừa lưu", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { ctrl, session, uploads } = setup({ clip: async () => { await gate; return INFO; } });
    const running = ctrl.upload(mp4());
    expect(ctrl.ingesting).toBe(true);
    ctrl.reset();
    release();
    await running;
    expect(session.state.sourceClip).toBeNull();
    expect(await uploads.list()).toEqual([]);
    expect(ctrl.ingesting).toBe(false);
  });

  it("blobFor trả blob đã lưu, không có thì null", async () => {
    const { ctrl, session } = setup();
    await ctrl.upload(mp4());
    expect(await ctrl.blobFor(session.state.sourceClip!.uploadId)).toBeInstanceOf(Blob);
    expect(await ctrl.blobFor("upload-khong-co")).toBeNull();
  });
});
```

Thêm vào cuối `describe("createStudio", …)` trong `tests/client/controllers/createStudio.test.ts`:

```ts
  it("lắp SourceClipController; dự án mới dọn blob video tải lên", async () => {
    const services = createClientServices(env());
    (services.probe as unknown as { clip: () => Promise<unknown> }).clip = async () => ({ width: 640, height: 360, durationSec: 5, hasAudio: false });
    const studio = createStudio(services, { schedule: () => () => {} });
    expect(studio.project.setKind("upload")).toBe(true);
    expect(studio.project.createTitleOnlyFromForm({ title: "Clip", sourceCredit: "", publishDateText: "2026-10-21", templateId: "theanh28" })).toBe(true);
    await studio.clip.upload(new File([new Uint8Array([1])], "c.mp4", { type: "video/mp4" }));
    expect(studio.session.state.sourceClip?.hasAudio).toBe(false);
    expect(await services.uploads.list()).toHaveLength(1);
    await studio.wizard.newProject();
    expect(studio.session.state.sourceClip).toBeNull();
    expect(await services.uploads.list()).toEqual([]);
    studio.dispose();
  });
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `npx vitest run tests/client/media/UploadValidator.test.ts tests/client/controllers/SourceClipController.test.ts tests/client/controllers/createStudio.test.ts`
Expected: FAIL — `classifySourceClip is not a function`, `Cannot find package '@/client/controllers/SourceClipController'`, `studio.clip is undefined`.

- [ ] **Step 3: Viết validator, probe, frame provider**

`src/client/media/UploadValidator.ts` — thay `classifyUpload` và thêm cuối file (import `SourceClip` từ `@/domain/SourceClip`):

```ts
export function classifyUpload(
  file: { name: string; type: string; size: number },
  allowed: readonly UploadKind[] = ["image", "video", "audio"],
  limits: Partial<Record<UploadKind, number>> = {},
): UploadKind {
  if (file.size <= 0) throw new ValidationError("File rỗng");
  const ext = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase() : "";
  const kind = MIME[file.type.toLowerCase()] ?? EXT[ext];
  if (!kind) throw new ValidationError(`Định dạng không được hỗ trợ: ${ext || file.type || "không rõ"}`);
  if (!allowed.includes(kind)) throw new ValidationError(`Không nhận file ${LABEL[kind]} ở đây`);
  const max = limits[kind] ?? UPLOAD_LIMITS[kind];
  if (file.size > max) throw new ValidationError(`File quá lớn (tối đa ${max / MB} MB cho ${LABEL[kind]})`);
  return kind;
}

/** Video của kiểu "Video tải lên": 500 MB (video điện thoại 1080p 5 phút ≈ 450–600 MB), tối đa 5 phút. */
export const SOURCE_CLIP_LIMITS = { maxBytes: 500 * MB, maxDurationSec: SourceClip.MAX_DURATION_SEC } as const;

export function classifySourceClip(file: { name: string; type: string; size: number }): "video" {
  classifyUpload(file, ["video"], { video: SOURCE_CLIP_LIMITS.maxBytes });
  return "video";
}

/** "m:ss" (làm tròn xuống giây). */
export function formatClock(sec: number): string {
  const total = Math.floor(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function checkSourceClipDuration(durationSec: number): void {
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new ValidationError("Không đọc được độ dài video");
  if (durationSec > SOURCE_CLIP_LIMITS.maxDurationSec + SourceClip.DURATION_TOLERANCE_SEC) {
    throw new ValidationError(`Video dài ${formatClock(durationSec)}, tối đa 5 phút. Hãy cắt ngắn rồi tải lại.`);
  }
}
```

`src/client/media/MediaProbe.ts` — thêm sau `interface MediaProbe`:

```ts
export interface ClipInfo {
  width: number;
  height: number;
  /** Giây, tính từ khung hình đầu. */
  durationSec: number;
  /** Có track âm và trình duyệt giải mã được. */
  hasAudio: boolean;
}

/** Đọc thông tin video của kiểu "Video tải lên". */
export interface SourceClipProbe {
  clip(blob: Blob): Promise<ClipInfo>;
}
```

đổi khai báo lớp thành `export class BrowserMediaProbe implements MediaProbe, SourceClipProbe {` và thêm phương thức:

```ts
  async clip(blob: Blob): Promise<ClipInfo> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    try {
      const video = await input.getPrimaryVideoTrack();
      if (!video) throw new Error("File video không có hình");
      if (!(await video.canDecode())) throw new Error("Trình duyệt không giải mã được hình của video này");
      const first = await video.getFirstTimestamp();
      const audio = await input.getPrimaryAudioTrack();
      return {
        width: await video.getDisplayWidth(),
        height: await video.getDisplayHeight(),
        durationSec: (await video.computeDuration()) - first,
        hasAudio: audio !== null && (await audio.canDecode()),
      };
    } finally {
      input.dispose();
    }
  }
```

`src/client/media/MediaFrameProvider.ts` — `VideoFrameProvider`: constructor thêm tham số cuối `readonly startSec: number,`; trong `open` sau dòng `const durationSec = …` thêm `const startSec = await track.getFirstTimestamp();` và `return new VideoFrameProvider(input, sink, durationSec, width, height, startSec);`. (Không đổi `frameAt`; đường cảnh trám cũ không dùng `startSec`.)

`src/client/container.ts`: import `type SourceClipProbe`; `ClientServices.probe: MediaProbe & SourceClipProbe;` (giá trị vẫn là `new BrowserMediaProbe(decoder)`).

- [ ] **Step 4: Viết SourceClipController + lắp**

`src/client/controllers/SourceClipController.ts`:

```ts
import type { SourceClipProbe, ClipInfo } from "@/client/media/MediaProbe";
import { checkSourceClipDuration, classifySourceClip } from "@/client/media/UploadValidator";
import type { UploadRepository } from "@/client/storage/UploadRepository";
import { DomainError, ValidationError } from "@/domain/errors";
import { SourceClip } from "@/domain/SourceClip";
import { StateController } from "./StateController";
import type { StudioSession } from "./StudioSession";

export interface SourceClipState {
  busy: boolean;
  error: string | null;
}

export interface SourceClipControllerDeps {
  session: StudioSession;
  uploads: Pick<UploadRepository, "put" | "get" | "delete">;
  probe: SourceClipProbe;
  onAuthLost?: () => void;
}

export const UNREADABLE_CLIP = "Không đọc được video này. Hãy thử file MP4 (H.264) khác.";
export const NOT_UPLOAD_PROJECT = "Chưa có dự án kiểu Video tải lên";

/** Bước "Video của bạn": tải/thay/xoá đúng một video, chỉnh mức tiếng gốc. */
export class SourceClipController extends StateController<SourceClipState> {
  /** Tăng mỗi lần reset: lần tải bắt đầu ở dự án cũ phải bỏ kết quả. */
  private epoch = 0;

  constructor(private readonly deps: SourceClipControllerDeps) {
    super({ busy: false, error: null }, deps.onAuthLost);
  }

  /** Đang đọc/lưu file (blob có thể đã lưu nhưng chưa vào session): Wizard hoãn dọn file. */
  get ingesting(): boolean {
    return this.state.busy;
  }

  async upload(file: File): Promise<void> {
    if (this.state.busy) return;
    if (this.deps.session.state.project?.kind !== "upload") {
      this.patch({ error: NOT_UPLOAD_PROJECT });
      return;
    }
    const epoch = this.epoch;
    this.patch({ busy: true, error: null });
    try {
      classifySourceClip(file);
      const info = await this.read(file);
      checkSourceClipDuration(info.durationSec);
      const meta = await this.deps.uploads.put(file, { name: file.name, kind: "video" });
      if (epoch !== this.epoch || this.deps.session.state.project?.kind !== "upload") {
        await this.deps.uploads.delete(meta.id).catch(() => {});
        return;
      }
      const previous = this.deps.session.state.sourceClip;
      const clip = SourceClip.create({
        uploadId: meta.id,
        name: file.name,
        ...info,
        ...(previous ? { volumePercent: previous.volumePercent } : {}),
      });
      this.deps.session.update((d) => ({ ...d, sourceClip: clip }));
      if (previous && previous.uploadId !== meta.id) await this.deps.uploads.delete(previous.uploadId).catch(() => {});
    } catch (error) {
      if (epoch === this.epoch) this.patch({ error: this.report(error) });
    } finally {
      this.patch({ busy: false });
    }
  }

  setVolume(percent: number): void {
    try {
      const current = this.deps.session.state.sourceClip;
      if (!current) throw new ValidationError("Chưa tải video lên");
      const next = current.withVolume(percent);
      this.deps.session.update((d) => ({ ...d, sourceClip: next }));
      this.patch({ error: null });
    } catch (error) {
      this.patch({ error: this.report(error) });
    }
  }

  async remove(): Promise<void> {
    const current = this.deps.session.state.sourceClip;
    if (!current) return;
    this.deps.session.update((d) => ({ ...d, sourceClip: null }));
    this.patch({ error: null });
    await this.deps.uploads.delete(current.uploadId).catch(() => {});
  }

  /** Blob đã lưu (để xem lại); thiếu (bị trình duyệt dọn) thì null. */
  async blobFor(uploadId: string): Promise<Blob | null> {
    try {
      return (await this.deps.uploads.get(uploadId))?.blob ?? null;
    } catch {
      return null;
    }
  }

  /** Dự án mới: bỏ lỗi của dự án cũ; lần tải đang chạy sẽ tự xoá blob của nó. */
  reset(): void {
    this.epoch += 1;
    this.patch({ error: null });
  }

  /** Lỗi thô của bộ đọc (tiếng Anh, DOMException) đổi thành câu tiếng Việt. */
  private async read(file: File): Promise<ClipInfo> {
    try {
      return await this.deps.probe.clip(file);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new ValidationError(UNREADABLE_CLIP);
    }
  }
}
```

`src/client/controllers/createStudio.ts`:

- Import `SourceClipController`.
- `Studio` thêm `clip: SourceClipController;`.
- Sau khi tạo `music`: `const clip = new SourceClipController({ session, uploads: services.uploads, probe: services.probe, onAuthLost });`
- Wizard: `deferCleanup: () => footage.ingesting || music.state.busy || clip.ingesting,`; trong `onReset` thêm `clip.reset();`.
- Object trả về thêm `clip,`.

`src/client/media/ClipThumbnail.ts`:

```ts
import type { DrawableImage } from "@/templates/VideoTemplate";
import { VideoFrameProvider } from "./MediaFrameProvider";

/**
 * Lấy khung ở giây `atSec` (tính từ khung đầu) của video làm ảnh tĩnh cho xem trước. Vẽ sang canvas riêng vì canvas
 * của bộ đọc nằm trong vùng dùng lại. Chỉ chạy trên trình duyệt (cần WebCodecs, document).
 */
export async function loadClipThumbnail(blob: Blob, atSec: number): Promise<{ image: DrawableImage; dispose(): void }> {
  const frames = await VideoFrameProvider.open(blob, 1080);
  try {
    const frame = await frames.frameAt(frames.startSec + atSec);
    if (!frame) throw new Error("Video không có khung hình");
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Trình duyệt không cấp được canvas 2D");
    ctx.drawImage(frame.source, 0, 0);
    return {
      image: { source: canvas, width: canvas.width, height: canvas.height },
      dispose: () => {
        canvas.width = 0;
        canvas.height = 0;
      },
    };
  } finally {
    frames.dispose();
  }
}
```

`src/views/studio/steps/StepClip.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { Studio } from "@/client/controllers/createStudio";
import { toDateInput } from "@/client/controllers/dateText";
import { loadClipThumbnail } from "@/client/media/ClipThumbnail";
import { formatClock, SOURCE_CLIP_LIMITS } from "@/client/media/UploadValidator";
import { SOURCE_CLIP_VOLUME } from "@/domain/SourceClip";
import type { DrawableImage } from "@/templates/VideoTemplate";
import { ConfirmButton } from "@/views/components/ConfirmButton";
import { useController } from "@/views/hooks/useController";
import { PreviewPanel } from "../components/PreviewPanel";

const ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";
const MB = 1024 * 1024;

export function StepClip({ studio }: { studio: Studio }) {
  const data = useController(studio.session);
  const clipState = useController(studio.clip);
  const project = data.project;
  const clip = data.sourceClip;
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [thumb, setThumb] = useState<DrawableImage | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const uploadId = clip?.uploadId ?? null;
  const thumbnailSec = clip?.thumbnailSec ?? 0;
  const gain = clip?.gain ?? 1;

  useEffect(() => {
    setUrl(null);
    setThumb(null);
    setMissing(false);
    if (!uploadId) return;
    let alive = true;
    let objectUrl: string | null = null;
    let disposeThumb: (() => void) | null = null;
    void (async () => {
      const blob = await studio.clip.blobFor(uploadId);
      if (!alive) return;
      if (!blob) {
        setMissing(true);
        return;
      }
      objectUrl = studio.services.env.createUrl(blob);
      setUrl(objectUrl);
      try {
        const loaded = await loadClipThumbnail(blob, thumbnailSec);
        if (!alive) {
          loaded.dispose();
          return;
        }
        disposeThumb = loaded.dispose;
        setThumb(loaded.image);
      } catch {
        // xem trước không bắt buộc: giữ ảnh minh hoạ
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) studio.services.env.revokeUrl(objectUrl);
      disposeThumb?.();
    };
  }, [studio, uploadId, thumbnailSec]);

  useEffect(() => {
    // Trình duyệt chỉ phát tới 100 %; mức trên 100 % chỉ áp khi dựng.
    if (videoRef.current) videoRef.current.volume = Math.min(1, gain);
  }, [gain, url]);

  if (!project) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]">
      <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
        <h2 className="text-lg font-semibold">Video của bạn</h2>
        <label className="flex flex-col gap-1 text-sm">
          {clip ? "Thay video khác" : "Chọn video"} (MP4, MOV, WebM; tối đa {SOURCE_CLIP_LIMITS.maxDurationSec / 60} phút,{" "}
          {SOURCE_CLIP_LIMITS.maxBytes / MB} MB)
          <input
            type="file"
            accept={ACCEPT}
            disabled={clipState.busy}
            className="min-h-11 max-w-full text-sm sm:min-h-0"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void studio.clip.upload(file);
            }}
          />
        </label>
        {clipState.busy && (
          <p role="status" className="text-sm text-neutral-400">
            Đang đọc và lưu video…
          </p>
        )}
        {clipState.error && (
          <p role="alert" className="text-red-400">
            {clipState.error}
          </p>
        )}
        {clip && (
          <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-neutral-800 p-3 text-sm">
            <p data-testid="video-tai-len" className="break-all">
              {clip.name} · {formatClock(clip.durationSec)} · {clip.width}×{clip.height} ·{" "}
              {clip.hasAudio ? "có tiếng gốc" : "không có tiếng gốc"}
            </p>
            {missing && (
              <p role="alert" className="text-amber-400">
                Không tìm thấy file video trong trình duyệt (có thể đã bị dọn). Hãy chọn lại video.
              </p>
            )}
            {url && <video ref={videoRef} src={url} controls playsInline className="w-full max-w-[360px] rounded-md bg-black" />}
            <label className="flex flex-col gap-1">
              Âm thanh gốc: {clip.volumePercent === 0 ? "Tắt" : `${clip.volumePercent}%`}
              <input
                type="range"
                min={SOURCE_CLIP_VOLUME.min}
                max={SOURCE_CLIP_VOLUME.max}
                step={SOURCE_CLIP_VOLUME.step}
                value={clip.volumePercent}
                disabled={!clip.hasAudio}
                onChange={(e) => studio.clip.setVolume(Number(e.target.value))}
              />
            </label>
            <p className="text-xs text-neutral-500">
              {clip.hasAudio
                ? "100% = giữ nguyên tiếng gốc; kéo về 0 để tắt. Nghe thử trong khung trên chỉ tới 100%."
                : "Video này không có tiếng gốc; phần video chỉ có nhạc nền (nếu chọn)."}
            </p>
            <ConfirmButton
              label="Xoá video"
              prompt="Xoá video đã tải lên?"
              confirmAriaLabel="Xác nhận xoá video"
              className="min-h-11 self-start rounded-md bg-neutral-800 px-3 py-1.5 sm:min-h-0"
              onConfirm={() => studio.clip.remove()}
            />
          </div>
        )}
      </div>
      <PreviewPanel
        studio={studio}
        image={thumb}
        form={{
          text: "",
          title: project.title,
          sourceCredit: project.sourceCredit,
          publishDateText: toDateInput(project.publishDate),
          templateId: project.templateId,
          kind: "upload",
        }}
      />
    </div>
  );
}
```

`src/views/studio/StudioShell.tsx`: import `StepClip`; nhánh `case "clip": return <StepClip studio={studio} />;`.

- [ ] **Step 5: Chạy toàn bộ kiểm tra**

Run: `npx vitest run; npm run typecheck; npm run lint`
Expected: PASS, sạch.

- [ ] **Step 6: Commit** (điều phối viên) — `feat: bước Video của bạn — tải, kiểm, xem lại video, chỉnh tiếng gốc`

---

### Task 4: Bộ dựng hình — Timeline đoạn lặng, RenderPlan/Job, worker thẻ đầu → video

**Có Vitest:** `Timeline` (đoạn lặng), `sourceTimeFor` (startSec/stillAtSec), `planRender` (clipSlot), `RenderJobBuilder` (nhánh upload), `VideoRenderer` (truyền `media`). **Không Vitest:** `render.worker.ts` (chạy trong worker trình duyệt) — kiểm bằng typecheck + e2e 02 cũ ở task này, e2e 07 ở Task 7.

**Files:**
- Modify: `src/domain/Timeline.ts`, `src/domain/Footage.ts` (chỉ kiểu `FootagePlayback`), `src/client/media/sourceTime.ts`, `src/client/render/RenderJob.ts`, `src/client/render/RenderPlan.ts`, `src/client/render/VideoRenderer.ts`, `src/client/render/render.worker.ts`, `src/client/controllers/RenderJobBuilder.ts`
- Test: `tests/domain/Timeline.test.ts`, `tests/client/media/sourceTime.test.ts`, `tests/client/render/RenderPlan.test.ts`, `tests/client/render/VideoRenderer.test.ts`, `tests/client/controllers/RenderJobBuilder.test.ts`

**Interfaces:**
- Consumes: `SourceClip` (`uploadId, durationSec, hasAudio, gain, thumbnailSec`), `MEDIA_CREDIT`, `SOURCE_CLIP_MEDIA`, `SceneMedia`, `VideoFrameProvider.startSec`, fixtures `makeUploadProject`, `makeClip`.
- Produces:
  - `Timeline.build(entries: ReadonlyArray<{ sceneId: string; durationSec: number; silent?: boolean }>, config?)` — đoạn `silent`: không nghỉ đầu, không giọng (`voiceStart = voiceEnd = start`), không nghỉ/đuôi sau.
  - `FootagePlayback.startSec?: number`, `FootagePlayback.stillAtSec?: number`.
  - `RenderJob.sourceClip?: SourceClipInput` với `SourceClipInput = { blob: Blob; durationSec: number; hasAudio: boolean; gain: number; thumbnailSec: number }`; `RenderJob.project.mediaCredit?: string`.
  - `RenderPlan.ts`: `SOURCE_CLIP_SCENE_ID = "source-clip"`; `planRender(job, config): { timeline: Timeline; voices: MonoClip[]; clipSlot: SceneSlot | null }`.
  - `RenderScene.media?: SceneMedia`.

- [ ] **Step 1: Viết test (đỏ)**

Thêm vào `tests/domain/Timeline.test.ts`:

```ts
describe("Timeline — đoạn lặng (video tải lên)", () => {
  const cfg = { leadInSec: 0.3, gapSec: 0.35, tailSec: 0.6 };

  it("thẻ đầu = nghỉ đầu + giọng + nghỉ; video nối ngay sau, không đuôi", () => {
    const t = Timeline.build([{ sceneId: "s1", durationSec: 2 }, { sceneId: "clip", durationSec: 8, silent: true }], cfg);
    expect(t.slots).toEqual([
      { sceneId: "s1", index: 0, start: 0, voiceStart: 0.3, voiceEnd: 2.3, end: 2.65 },
      { sceneId: "clip", index: 1, start: 2.65, voiceStart: 2.65, voiceEnd: 2.65, end: 10.65 },
    ]);
    expect(t.totalDuration).toBe(10.65);
    expect(t.frameCount(30)).toBe(320);
    expect(t.slotAt(5).sceneId).toBe("clip");
  });

  it("đoạn lặng độ dài sai thì ném", () => {
    expect(() => Timeline.build([{ sceneId: "clip", durationSec: 0, silent: true }], cfg)).toThrow("Đoạn clip có độ dài không hợp lệ");
  });
});
```

Thêm vào `tests/client/media/sourceTime.test.ts`:

```ts
describe("sourceTimeFor — mốc đầu và ảnh tĩnh tại giây", () => {
  it("startSec cộng vào mọi chế độ; stillAtSec chọn giây của ảnh tĩnh", () => {
    expect(sourceTimeFor({ mode: "clip", sourceDurationSec: 8, startSec: 0.5 }, 2)).toBe(2.5);
    expect(sourceTimeFor({ mode: "clip", sourceDurationSec: 8, startSec: 0.5 }, 9)).toBeCloseTo(8.499, 9);
    expect(sourceTimeFor({ mode: "still", startSec: 0.5, stillAtSec: 1 }, 3)).toBe(1.5);
    expect(sourceTimeFor({ mode: "still" }, 3)).toBe(0);
  });
});
```

Thêm vào `tests/client/render/RenderPlan.test.ts` (dùng `job(...)` sẵn có; import `SOURCE_CLIP_SCENE_ID`):

```ts
describe("planRender — video tải lên", () => {
  it("thêm đoạn lặng cho video sau thẻ đầu; giọng chỉ ở thẻ đầu", () => {
    const a = new Float32Array(3);
    const base = job([{ sceneId: "s1", durationSec: 2, samples: a }]);
    const withClip = {
      ...base,
      scenes: base.scenes.slice(0, 1),
      sourceClip: { blob: new Blob(["v"]), durationSec: 8, hasAudio: true, gain: 1, thumbnailSec: 1 },
    };
    const plan = planRender(withClip, DEFAULT_TIMELINE_CONFIG);
    expect(plan.timeline.slots.map((s) => s.sceneId)).toEqual(["s1", SOURCE_CLIP_SCENE_ID]);
    expect(plan.voices).toEqual([{ startSec: 0.3, samples: a }]);
    expect(plan.clipSlot).toEqual({ sceneId: SOURCE_CLIP_SCENE_ID, index: 1, start: 2.65, voiceStart: 2.65, voiceEnd: 2.65, end: 10.65 });
    expect(plan.timeline.totalDuration).toBe(10.65);
  });

  it("job không có video: clipSlot null", () => {
    const plan = planRender(
      job([
        { sceneId: "s1", durationSec: 2, samples: new Float32Array(1) },
        { sceneId: "s2", durationSec: 1, samples: new Float32Array(1) },
      ]),
      DEFAULT_TIMELINE_CONFIG,
    );
    expect(plan.clipSlot).toBeNull();
  });
});
```

Thêm vào `tests/client/render/VideoRenderer.test.ts` (dùng `LogTemplate`, `CountingFrames`, `Sink`, `project` sẵn có; import `SOURCE_CLIP_MEDIA`):

```ts
describe("VideoRenderer — media của cảnh", () => {
  it("truyền media của cảnh vào khung vẽ; cảnh không có media thì undefined", async () => {
    const template = new LogTemplate();
    const frames = new CountingFrames();
    const timeline = Timeline.build([{ sceneId: "a", durationSec: 0.2 }, { sceneId: "clip", durationSec: 0.3, silent: true }], {
      leadInSec: 0,
      gapSec: 0,
      tailSec: 0,
    });
    const scenes = new Map<string, RenderScene>([
      ["a", { sceneId: "a", role: "intro", text: "T", playback: { mode: "still", stillAtSec: 0.1 }, frames }],
      ["clip", { sceneId: "clip", role: "body", text: "", playback: { mode: "clip", sourceDurationSec: 0.3 }, frames, media: SOURCE_CLIP_MEDIA }],
    ]);
    await new VideoRenderer({ template, ctx: new RecordingCanvas().asCanvas(), project, timeline, scenes, fps: 10, sink: new Sink() }).render();
    expect(template.frames[0]?.media).toBeUndefined();
    expect(template.frames.at(-1)?.media).toEqual(SOURCE_CLIP_MEDIA);
    expect(frames.asked[0]).toBeCloseTo(0.1, 9); // ảnh tĩnh thẻ đầu tại stillAtSec
    expect(frames.asked.at(-1)).toBeCloseTo(0.2, 9); // khung cuối của video: 0,2 s sau khi bắt đầu
  });
});
```

Thêm vào `tests/client/controllers/RenderJobBuilder.test.ts` (import thêm `makeClip, makeUploadProject`, `EMPTY_STUDIO` đã có):

```ts
describe("RenderJobBuilder — kiểu Video tải lên", () => {
  async function uploadSetup(clipOver: Parameters<typeof makeClip>[0] = {}) {
    const base = setup();
    const project = makeUploadProject();
    const meta = await base.uploads.put(new Blob(["mp4"]), { name: "c.mp4", kind: "video" });
    const data: StudioData = {
      ...EMPTY_STUDIO,
      kind: "upload",
      project,
      voice: VOICE,
      narrations: new Map([[project.introScene.id, fakeNarration(project.introScene)]]),
      brand: base.data.brand,
      sourceClip: makeClip({ uploadId: meta.id, volumePercent: 80, ...clipOver }),
    };
    return { ...base, data, project, meta };
  }

  it("job: một cảnh mở đầu + khối sourceClip; không phụ đề; credit VIDEO", async () => {
    const { builder, data } = await uploadSetup();
    const { job, warnings } = await builder.build(data);
    expect(warnings).toEqual([]);
    expect(job.scenes).toEqual([{ sceneId: "s1", role: "intro", text: "Tiêu đề video tải lên", footage: { kind: "fallback" } }]);
    expect(job.narrations).toHaveLength(1);
    expect(job.project).toEqual({
      displayTitle: "Tiêu đề video tải lên",
      sourceCredit: "Nguồn thử",
      publishDateText: "14/10/2026",
      mediaCredit: "VIDEO: TỔNG HỢP",
    });
    expect(job.options.subtitles.enabled).toBe(false);
    expect(job.sourceClip).toMatchObject({ durationSec: 8, hasAudio: true, gain: 0.8, thumbnailSec: 1 });
    expect(job.sourceClip?.blob).toBeInstanceOf(Blob);
  });

  it("video không có tiếng gốc: hệ số 0 và cảnh báo", async () => {
    const { builder, data } = await uploadSetup({ hasAudio: false });
    const { job, warnings } = await builder.build(data);
    expect(job.sourceClip?.gain).toBe(0);
    expect(warnings).toEqual(["Video tải lên không có tiếng gốc"]);
  });

  it("chưa tải video hoặc mất blob thì báo lỗi rõ", async () => {
    const { builder, data } = await uploadSetup();
    await expect(builder.build({ ...data, sourceClip: null })).rejects.toThrow("Chưa tải video lên");
    await expect(builder.build({ ...data, sourceClip: makeClip({ uploadId: "upload-mat" }) })).rejects.toThrow(
      "Không tìm thấy video đã tải lên, hãy tải lại ở bước Video của bạn",
    );
  });

  it("kiểu tin: job không có sourceClip, project không có mediaCredit", async () => {
    const { builder, data } = setup();
    const { job } = await builder.build(data);
    expect("sourceClip" in job).toBe(false);
    expect("mediaCredit" in job.project).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `npx vitest run tests/domain/Timeline.test.ts tests/client/media/sourceTime.test.ts tests/client/render tests/client/controllers/RenderJobBuilder.test.ts`
Expected: FAIL — `Cảnh clip chưa có độ dài giọng` / sai slot, `expected 2 to be 2.5`, `SOURCE_CLIP_SCENE_ID` undefined, `expected undefined to deeply equal {fit…}`, `expected 2 to have length 1` (job.scenes).

- [ ] **Step 3: Viết Timeline, playback, sourceTime**

`src/domain/Timeline.ts` — thay `build`:

```ts
  /**
   * `silent`: đoạn không giọng (video tải lên) — bắt đầu ngay sau đoạn trước, dài đúng `durationSec`, không nghỉ đầu,
   * không nghỉ/đuôi sau. Đoạn có giọng giữ quy tắc cũ (nghỉ đầu ở đoạn đầu, nghỉ giữa câu, đuôi ở đoạn cuối).
   */
  static build(
    entries: ReadonlyArray<{ sceneId: string; durationSec: number; silent?: boolean }>,
    config: TimelineConfig = DEFAULT_TIMELINE_CONFIG,
  ): Timeline {
    if (entries.length === 0) throw new ValidationError("Chưa có cảnh nào để dựng");
    const slots: SceneSlot[] = [];
    let start = 0;
    let voiceStart = config.leadInSec;
    entries.forEach((entry, index) => {
      if (!Number.isFinite(entry.durationSec) || entry.durationSec <= 0) {
        throw new ValidationError(
          entry.silent ? `Đoạn ${entry.sceneId} có độ dài không hợp lệ` : `Cảnh ${entry.sceneId} chưa có độ dài giọng`,
        );
      }
      if (entry.silent) {
        const end = start + entry.durationSec;
        slots.push({ sceneId: entry.sceneId, index, start: ms(start), voiceStart: ms(start), voiceEnd: ms(start), end: ms(end) });
        start = end;
        voiceStart = end;
        return;
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
```

`src/domain/Footage.ts` — `FootagePlayback`:

```ts
export interface FootagePlayback {
  mode: "still" | "clip" | "loop" | "none";
  sourceDurationSec?: number;
  /** Mốc (giây) của khung hình đầu trong file; bỏ trống = 0. */
  startSec?: number;
  /** Chế độ "still": giây (tính từ khung đầu) lấy ảnh; bỏ trống = 0. */
  stillAtSec?: number;
}
```

`src/client/media/sourceTime.ts`:

```ts
import type { FootagePlayback } from "@/domain/Footage";

/** Thời điểm (giây, theo mốc của file) cần lấy khung từ cảnh trám/video; null khi cảnh không có hình. */
export function sourceTimeFor(playback: FootagePlayback, sceneTime: number): number | null {
  const src = playback.sourceDurationSec ?? 0;
  const base = playback.startSec ?? 0;
  switch (playback.mode) {
    case "none":
      return null;
    case "still":
      return base + (playback.stillAtSec ?? 0);
    case "clip":
      return base + Math.min(sceneTime, Math.max(0, src - 0.001));
    case "loop":
      return base + (src > 0 ? sceneTime % src : 0);
  }
}
```

- [ ] **Step 4: Viết RenderJob, RenderPlan, VideoRenderer**

`src/client/render/RenderJob.ts` — thêm trước `RenderJob`:

```ts
/** Video người dùng tải lên (kiểu "Video tải lên"): phát trọn sau thẻ tiêu đề. */
export interface SourceClipInput {
  blob: Blob;
  /** Giây, tính từ khung hình đầu (từ MediaProbe). */
  durationSec: number;
  hasAudio: boolean;
  /** Hệ số tuyến tính 0–1,5 cho tiếng gốc (0 = tắt). */
  gain: number;
  /** Giây (tính từ khung đầu) lấy ảnh cho thẻ tiêu đề. */
  thumbnailSec: number;
}
```

`RenderJob.project` thành `{ displayTitle: string; sourceCredit: string; publishDateText: string; mediaCredit?: string }`; thêm trường cuối `/** Có khi kiểu "Video tải lên"; bỏ trống = dựng như bản tin nhiều cảnh. */ sourceClip?: SourceClipInput;`

`src/client/render/RenderPlan.ts` — import `type SceneSlot` từ `@/domain/Timeline`; thay `planRender`:

```ts
/** Id đoạn của video tải lên trong timeline (không trùng id cảnh vì id cảnh là UUID/“s<n>”). */
export const SOURCE_CLIP_SCENE_ID = "source-clip";

export interface RenderPlanResult {
  timeline: Timeline;
  voices: MonoClip[];
  /** Khe của video tải lên (đoạn lặng cuối); null khi job không có video. */
  clipSlot: SceneSlot | null;
}

export function planRender(job: RenderJob, timelineConfig: TimelineConfig): RenderPlanResult {
  const bySceneId = new Map(job.narrations.map((n) => [n.sceneId, n]));
  const entries = job.scenes.map((s) => {
    const narration = bySceneId.get(s.sceneId);
    if (!narration) throw new Error(`Cảnh ${s.sceneId} chưa có giọng đọc`);
    return { sceneId: s.sceneId, durationSec: narration.durationSec, samples: narration.samples };
  });
  const timelineEntries: Array<{ sceneId: string; durationSec: number; silent?: boolean }> = entries.map((e) => ({
    sceneId: e.sceneId,
    durationSec: e.durationSec,
  }));
  if (job.sourceClip) timelineEntries.push({ sceneId: SOURCE_CLIP_SCENE_ID, durationSec: job.sourceClip.durationSec, silent: true });
  const timeline = Timeline.build(timelineEntries, timelineConfig);
  const voices = entries.map((entry, i) => ({ startSec: (timeline.slots[i] as SceneSlot).voiceStart, samples: entry.samples }));
  const clipSlot = job.sourceClip ? (timeline.slots[timeline.slots.length - 1] as SceneSlot) : null;
  return { timeline, voices, clipSlot };
}
```

`src/client/render/VideoRenderer.ts`:

- Import `type SceneMedia` cùng dòng import từ `@/templates/VideoTemplate`.
- `RenderScene` thêm `/** Cách đặt hình vào khung; bỏ trống = cover + Ken Burns. */ media?: SceneMedia;`
- Trong `template.drawFrame(ctx, project, { … })` thêm dòng cuối `media: scene.media,`.

- [ ] **Step 5: Viết RenderJobBuilder nhánh upload**

`src/client/controllers/RenderJobBuilder.ts` — import thêm `MEDIA_CREDIT` từ `@/domain/ProjectKind`, `type MusicTrack` từ `@/domain/MusicTrack`, `type Narration` từ `@/domain/Narration`, `type VideoOptions` từ `@/domain/VideoOptions`, `type SourceClipInput` từ `@/client/render/RenderJob`. Tách hai hàm riêng dùng chung (giữ nguyên phép tính) và thêm nhánh:

```ts
  async build(
    data: StudioData,
    onProgress?: (label: string, ratio: number) => void,
    isCancelled: () => boolean = () => false,
    options?: { videoBitrate?: number },
  ): Promise<BuiltJob> {
    const { project, voice, narrations, footage, music, brand, options: videoOptions } = data;
    if (!project) throw new ValidationError("Chưa có dự án");
    if (!voice || staleSceneIds(data).length > 0) throw new ValidationError("Chưa đủ giọng đọc cho mọi cảnh");
    this.deps.templates.get(project.templateId); // phong cách không tồn tại thì ném NotFoundError
    const videoBitrate = options?.videoBitrate ?? this.deps.videoBitrate;
    if (project.kind === "upload") return this.buildUpload(data, onProgress, isCancelled, videoBitrate);

    const warnings: string[] = [];
    const sceneCount = project.scenes.length;
    const total = sceneCount + (music ? 1 : 0);
    const narrationInputs: NarrationInput[] = [];
    const sceneInputs: RenderSceneInput[] = [];
    const owners = footageOwners(data);

    for (const [index, scene] of project.scenes.entries()) {
      if (isCancelled()) throw new RenderCancelledError();
      onProgress?.(`Chuẩn bị giọng đọc ${index + 1}/${sceneCount}`, index / total);
      const narration = narrations.get(scene.id);
      if (!narration) throw new ValidationError("Chưa đủ giọng đọc cho mọi cảnh");
      narrationInputs.push(await this.narrationInput(scene.id, narration, videoOptions));
      const owner = owners.get(scene.id) ?? scene.id;
      if (owner !== scene.id) {
        // Dùng tiếp cảnh của đoạn trước: không nạp cảnh riêng (nếu đang giữ) để khỏi tải thừa.
        sceneInputs.push({ sceneId: scene.id, role: scene.role, text: scene.text, footage: { kind: "fallback" }, footageFrom: owner });
        continue;
      }
      sceneInputs.push({
        sceneId: scene.id,
        role: scene.role,
        text: scene.text,
        footage: await this.footageInput(footage.resolve(scene.id), index + 1, warnings),
      });
    }

    const musicBed = music ? await this.musicBed(music, sceneCount / total, onProgress, isCancelled, warnings) : null;

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
      options: videoOptions.snapshot(),
      ...(videoBitrate ? { videoBitrate } : {}),
    };
    return { job, warnings };
  }

  /** Kiểu "Video tải lên": giọng chỉ đọc tiêu đề; video tải lên phát trọn sau thẻ đầu; không phụ đề. */
  private async buildUpload(
    data: StudioData,
    onProgress: ((label: string, ratio: number) => void) | undefined,
    isCancelled: () => boolean,
    videoBitrate: number | undefined,
  ): Promise<BuiltJob> {
    const { project, narrations, music, brand, options: videoOptions, sourceClip } = data;
    if (!project) throw new ValidationError("Chưa có dự án");
    if (!sourceClip) throw new ValidationError("Chưa tải video lên");
    const warnings: string[] = [];
    const total = 2 + (music ? 1 : 0);

    if (isCancelled()) throw new RenderCancelledError();
    onProgress?.("Chuẩn bị giọng đọc tiêu đề", 0);
    const intro = project.introScene;
    const narration = narrations.get(intro.id);
    if (!narration) throw new ValidationError("Chưa đủ giọng đọc cho mọi cảnh");
    const introNarration = await this.narrationInput(intro.id, narration, videoOptions);

    if (isCancelled()) throw new RenderCancelledError();
    onProgress?.("Nạp video tải lên", 1 / total);
    const stored = await this.deps.uploads.get(sourceClip.uploadId);
    if (!stored) throw new ValidationError("Không tìm thấy video đã tải lên, hãy tải lại ở bước Video của bạn");
    if (!sourceClip.hasAudio) warnings.push("Video tải lên không có tiếng gốc");
    const clipInput: SourceClipInput = {
      blob: stored.blob,
      durationSec: sourceClip.durationSec,
      hasAudio: sourceClip.hasAudio,
      gain: sourceClip.gain,
      thumbnailSec: sourceClip.thumbnailSec,
    };

    const musicBed = music ? await this.musicBed(music, 2 / total, onProgress, isCancelled, warnings) : null;
    const snapshot = videoOptions.snapshot();
    const job: RenderJob = {
      templateId: project.templateId,
      brandValues: brand.values,
      logo: brand.logo,
      project: {
        displayTitle: project.displayTitle,
        sourceCredit: project.sourceCredit,
        publishDateText: project.formattedPublishDate(),
        mediaCredit: MEDIA_CREDIT.upload,
      },
      scenes: [{ sceneId: intro.id, role: "intro", text: intro.text, footage: { kind: "fallback" } }],
      narrations: [introNarration],
      music: musicBed,
      sampleRate: this.sampleRate,
      origin: this.deps.origin,
      // Kiểu này không có phụ đề (chỉ tiêu đề): ép tắt dù tuỳ chọn của video đang bật.
      options: { ...snapshot, subtitles: { ...snapshot.subtitles, enabled: false } },
      sourceClip: clipInput,
      ...(videoBitrate ? { videoBitrate } : {}),
    };
    return { job, warnings };
  }

  /** Giải mã, cắt lặng (mỗi lần dựng), tinh chỉnh tốc độ/tông; độ dài gửi bộ dựng là độ dài đã xử lý. */
  private async narrationInput(sceneId: string, narration: Narration, videoOptions: VideoOptions): Promise<NarrationInput> {
    const decoded = this.checkRate(await this.deps.decoder.decode(narration.audio.slice().buffer as ArrayBuffer));
    const trimmed = trimSilence(AudioDecodeService.toMono(decoded.channels), decoded.sampleRate);
    const samples = applyVoiceTweak(trimmed.samples, decoded.sampleRate, videoOptions.voiceTweak);
    return { sceneId, durationSec: samples.length / decoded.sampleRate, samples };
  }

  private async musicBed(
    music: MusicTrack,
    ratio: number,
    onProgress: ((label: string, ratio: number) => void) | undefined,
    isCancelled: () => boolean,
    warnings: string[],
  ): Promise<MusicBed | null> {
    if (isCancelled()) throw new RenderCancelledError();
    onProgress?.("Nạp nhạc nền", ratio);
    try {
      const decoded = this.checkRate(await this.deps.decoder.decode(await this.deps.tracks.bytes(music)));
      return { channels: decoded.channels, levelBelowVoiceDb: music.levelBelowVoiceDb };
    } catch (error) {
      if (isSessionExpired(error)) throw error;
      warnings.push("Không nạp được nhạc nền, video sẽ dựng không có nhạc");
      return null;
    }
  }
```

(Giữ nguyên `checkRate`, `footageInput`. Chú thích lớp: `/** Dựng RenderJob từ dữ liệu các bước: giải mã giọng, cắt lặng, nạp nhạc, file tải lên (cảnh trám hoặc video tải lên). */`)

- [ ] **Step 6: Viết worker (phần hình)**

`src/client/render/render.worker.ts`:

- Import: `import { footageSpans, planRender, SOURCE_CLIP_SCENE_ID, timelineConfigFor } from "./RenderPlan";` và `import { SOURCE_CLIP_MEDIA } from "@/templates/VideoTemplate";`.
- Dòng plan giữ dạng `const { timeline, voices } = planRender(…)` ở task này (lint cấm biến không dùng); Task 5 mới lấy thêm `clipSlot`.
- Ngay sau vòng `for (const [index, s] of job.scenes.entries()) { … }` thêm:

```ts
    if (job.sourceClip) {
      // Mở video tải lên MỘT lần: một khung làm ảnh thẻ tiêu đề, rồi phát trọn ở cảnh thân bài (vừa khung, không zoom).
      const clip = job.sourceClip;
      const frames = await VideoFrameProvider.open(clip.blob);
      providers.push(frames);
      const intro = job.scenes[0];
      if (intro && intro.role === "intro") {
        scenes.set(intro.sceneId, {
          sceneId: intro.sceneId,
          role: "intro",
          text: intro.text,
          playback: { mode: "still", startSec: frames.startSec, stillAtSec: clip.thumbnailSec },
          frames,
        });
      }
      scenes.set(SOURCE_CLIP_SCENE_ID, {
        sceneId: SOURCE_CLIP_SCENE_ID,
        role: "body",
        text: "",
        playback: { mode: "clip", sourceDurationSec: clip.durationSec, startSec: frames.startSec },
        frames,
        media: SOURCE_CLIP_MEDIA,
      });
    }
```

(Phụ đề đã bị job ép tắt; `job.project.mediaCredit` tự đi vào `ProjectFrame` qua `...job.project` sẵn có.)

- [ ] **Step 7: Chạy toàn bộ kiểm tra + e2e kiểu cũ**

Run: `npx vitest run; npm run typecheck; npm run lint; npm run test:e2e -- e2e/02-toan-luong.spec.ts`
Expected: Vitest/typecheck/lint sạch; e2e 02 PASS với số đo âm như cũ (giọng −16,51 dB, đỉnh 0,358, nghỉ ≈ −31,5 dB; ghi số vào report).

- [ ] **Step 8: Commit** (điều phối viên) — `feat: bộ dựng thẻ tiêu đề rồi video tải lên (hình)`

---

### Task 5: Trộn âm — tiếng gốc + nhạc + giọng tiêu đề

**Có Vitest:** `resample`, `SourceAudioAssembler`, `mixProgram` (tiếng gốc, quy tắc nhạc), `applyLimiter` (tương đương bản cũ). **Không Vitest:** `decodeSourceAudio.ts` (mediabunny + WebCodecs `AudioDecoder`), phần âm của `render.worker.ts` — kiểm ở e2e 07 (Task 7).

**Files:**
- Create: `src/client/media/resample.ts`, `src/client/media/SourceAudioAssembler.ts`, `src/client/media/decodeSourceAudio.ts`, `tests/client/media/resample.test.ts`, `tests/client/media/SourceAudioAssembler.test.ts`
- Modify: `src/client/media/AudioMix.ts`, `src/client/render/render.worker.ts`
- Test: `tests/client/media/AudioMix.test.ts` (thêm khối)

**Interfaces:**
- Consumes (Task 4): `RenderJob.sourceClip` (`blob, durationSec, hasAudio, gain`), `planRender(...).clipSlot`, `VideoFrameProvider.startSec`.
- Produces:
  - `resample(input: Float32Array, fromRate: number, toRate: number): Float32Array`; `RESAMPLE_HALF_TAPS = 16`.
  - `SourceAudioAssembler` (`constructor({ targetRate, originSec, durationSec, channelCount })`, `channelCount`, `add(chunk)`, `finish(): Float32Array[]`).
  - `decodeSourceAudio(blob, targetRate, durationSec): Promise<Float32Array[] | null>`.
  - `AudioMix`: `interface SourceBed { channels: Float32Array[]; startSec: number; gain: number }`; `mixProgram(voices, music, options, source?: SourceBed | null)`; `MIX_DEFAULTS.sourceOverMusicDb = 12`, `MIX_DEFAULTS.sourceEdgeFadeSec = 0.02`.

- [ ] **Step 1: Viết test (đỏ)**

`tests/client/media/resample.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resample } from "@/client/media/resample";

const sine = (rate: number, freq: number, seconds: number, amp = 0.5) =>
  Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / rate));
const rmsDb = (a: Float32Array, from: number, to: number) => {
  let s = 0;
  for (let i = from; i < to; i++) s += (a[i] ?? 0) ** 2;
  return 10 * Math.log10(s / (to - from));
};

describe("resample", () => {
  it("cùng tần số: trả nguyên mảng", () => {
    const a = new Float32Array([1, 2, 3]);
    expect(resample(a, 48000, 48000)).toBe(a);
  });

  it("44,1 → 48 kHz: đúng độ dài, giữ cao độ (sai số < 1e-4 với sin lý tưởng)", () => {
    const out = resample(sine(44100, 440, 1), 44100, 48000);
    expect(out.length).toBe(48000);
    let err = 0;
    for (let i = 1000; i < out.length - 1000; i++) err = Math.max(err, Math.abs((out[i] ?? 0) - 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48000)));
    expect(err).toBeLessThan(1e-4);
  });

  it("96 → 48 kHz: chặn chồng phổ (30 kHz) ≥ 60 dB, dải thông 1 kHz lệch < 0,05 dB", () => {
    const hi = sine(96000, 30000, 1);
    const hiOut = resample(hi, 96000, 48000);
    expect(rmsDb(hiOut, 2000, hiOut.length - 2000) - rmsDb(hi, 2000, hi.length - 2000)).toBeLessThan(-60);
    const lo = sine(96000, 1000, 1);
    const loOut = resample(lo, 96000, 48000);
    expect(Math.abs(rmsDb(loOut, 2000, loOut.length - 2000) - rmsDb(lo, 2000, lo.length - 2000))).toBeLessThan(0.05);
  });

  it("giữ mức một chiều (DC)", () => {
    const out = resample(new Float32Array(44100).fill(0.5), 44100, 48000);
    expect(out[24000]).toBeCloseTo(0.5, 5);
  });

  it("tỉ lệ lạ (quá 4096 pha) dùng nội suy tuyến tính, vẫn đúng độ dài và gần đúng", () => {
    const out = resample(sine(44101, 440, 1), 44101, 48000);
    expect(out.length).toBe(Math.floor((44101 * 48000) / 44101));
    expect(Math.abs((out[24000] ?? 0) - 0.5 * Math.sin((2 * Math.PI * 440 * 24000) / 48000))).toBeLessThan(1e-2);
  });

  it("tần số không hợp lệ thì ném", () => {
    expect(() => resample(new Float32Array(4), 0, 48000)).toThrow("Tần số mẫu không hợp lệ");
    expect(() => resample(new Float32Array(4), 44100.5, 48000)).toThrow("Tần số mẫu không hợp lệ");
  });
});
```

`tests/client/media/SourceAudioAssembler.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SourceAudioAssembler } from "@/client/media/SourceAudioAssembler";

const ramp = (n: number, start = 1) => Float32Array.from({ length: n }, (_, i) => start + i);

describe("SourceAudioAssembler", () => {
  it("đặt mẩu theo mốc so với khung đầu; thiếu thì lặng; độ dài đúng durationSec", () => {
    const asm = new SourceAudioAssembler({ targetRate: 10, originSec: 0.5, durationSec: 1, channelCount: 1 });
    asm.add({ timestampSec: 0.7, sampleRate: 10, channels: [ramp(3)] });
    const [mono] = asm.finish();
    expect(Array.from(mono ?? [])).toEqual([0, 0, 1, 2, 3, 0, 0, 0, 0, 0]);
  });

  it("mẩu trước khung đầu (mốc âm) bị cắt; mẩu vượt độ dài bị cắt", () => {
    const asm = new SourceAudioAssembler({ targetRate: 10, originSec: 0, durationSec: 0.5, channelCount: 1 });
    asm.add({ timestampSec: -0.2, sampleRate: 10, channels: [ramp(4)] });
    asm.add({ timestampSec: 0.3, sampleRate: 10, channels: [ramp(5, 10)] });
    expect(Array.from(asm.finish()[0] ?? [])).toEqual([3, 4, 0, 10, 11]);
  });

  it("stereo giữ hai kênh; mẩu mono vào bộ 2 kênh thì nhân đôi", () => {
    const asm = new SourceAudioAssembler({ targetRate: 10, originSec: 0, durationSec: 0.3, channelCount: 2 });
    asm.add({ timestampSec: 0, sampleRate: 10, channels: [ramp(1), ramp(1, 5)] });
    asm.add({ timestampSec: 0.1, sampleRate: 10, channels: [ramp(2, 7)] });
    const [l, r] = asm.finish();
    expect(Array.from(l ?? [])).toEqual([1, 7, 8]);
    expect(Array.from(r ?? [])).toEqual([5, 7, 8]);
  });

  it("không có mẩu nào: trả lặng đúng độ dài", () => {
    const asm = new SourceAudioAssembler({ targetRate: 48000, originSec: 0, durationSec: 2, channelCount: 2 });
    const out = asm.finish();
    expect(out.map((c) => c.length)).toEqual([96000, 96000]);
  });

  it("tần số gốc khác đích: lấy mẫu lại, độ dài round(durationSec × targetRate)", () => {
    const asm = new SourceAudioAssembler({ targetRate: 48000, originSec: 0, durationSec: 1.5, channelCount: 1 });
    asm.add({ timestampSec: 0, sampleRate: 44100, channels: [new Float32Array(44100 * 2).fill(0.25)] });
    const [mono] = asm.finish();
    expect(mono?.length).toBe(72000);
    expect(mono?.[36000]).toBeCloseTo(0.25, 5);
  });

  it("đổi tần số giữa chừng hoặc số kênh lạ thì ném", () => {
    const asm = new SourceAudioAssembler({ targetRate: 48000, originSec: 0, durationSec: 1, channelCount: 1 });
    asm.add({ timestampSec: 0, sampleRate: 44100, channels: [new Float32Array(10)] });
    expect(() => asm.add({ timestampSec: 0.1, sampleRate: 48000, channels: [new Float32Array(10)] })).toThrow(
      "Âm thanh gốc đổi tần số mẫu giữa chừng",
    );
    expect(() => new SourceAudioAssembler({ targetRate: 48000, originSec: 0, durationSec: 1, channelCount: 3 })).toThrow(
      "Chỉ ghép 1 hoặc 2 kênh",
    );
  });
});
```

Thêm vào cuối `tests/client/media/AudioMix.test.ts`:

```ts
describe("mixProgram — tiếng gốc của video tải lên", () => {
  const fade = Math.round(MIX_DEFAULTS.sourceEdgeFadeSec * SR); // 20 mẫu ở SR 1000

  it("đặt từ startSec, nhân đúng hệ số, không chuẩn hoá; vuốt 20 ms hai đầu", () => {
    const src = sine(2, 0.2);
    const out = mixProgram([], null, { sampleRate: SR, durationSec: 3 }, { channels: [src], startSec: 1, gain: 0.5 });
    expect(out.left[999]).toBe(0);
    expect(out.left[1000]).toBe(0); // mẫu đầu của vuốt vào nhân 1/20 × 0
    expect(out.left[1000 + 100]).toBeCloseTo(0.5 * (src[100] ?? 0), 6);
    expect(Math.abs(out.left[1000 + 5] ?? 0)).toBeLessThan(Math.abs(0.5 * (src[5] ?? 0)) + 1e-9);
    expect(out.right[1000 + 100]).toBeCloseTo(out.left[1000 + 100] ?? 0, 9);
    expect(rmsDb(slice(out.left, 1 + fade / SR, 3 - fade / SR), -120)).toBeCloseTo(20 * Math.log10((0.5 * 0.2) / Math.SQRT2), 1);
    expect(out.limiterGainDb).toBe(0);
  });

  it("stereo giữ hai kênh riêng", () => {
    const l = sine(1, 0.2, 50);
    const r = sine(1, 0.1, 50);
    const out = mixProgram([], null, { sampleRate: SR, durationSec: 1 }, { channels: [l, r], startSec: 0, gain: 1 });
    expect(out.left[500]).toBeCloseTo(l[500] ?? 0, 6);
    expect(out.right[500]).toBeCloseTo(r[500] ?? 0, 6);
  });

  it("dài hơn bản trộn thì cắt; gain 0 thì không có tiếng gốc", () => {
    const out = mixProgram([], null, { sampleRate: SR, durationSec: 1 }, { channels: [sine(3, 0.2)], startSec: 0.5, gain: 1 });
    expect(out.left.length).toBe(1000);
    const muted = mixProgram([], null, { sampleRate: SR, durationSec: 1 }, { channels: [sine(1, 0.2)], startSec: 0, gain: 0 });
    expect(Array.from(muted.left).every((v) => v === 0)).toBe(true);
  });

  it("nhạc nền thấp hơn tiếng gốc ít nhất 12 dB (mức cố định cả bài)", () => {
    const src = sine(4, 0.05, 50); // ≈ −29 dB
    const music = { channels: [sine(4, 0.5, 30)], levelBelowVoiceDb: 15 };
    const opts = { sampleRate: SR, durationSec: 4, fadeInSec: 0, fadeOutSec: 0 };
    const bed = { channels: [src], startSec: 0, gain: 1 };
    const withMusic = mixProgram([], music, opts, bed);
    const without = mixProgram([], null, opts, bed);
    const musicOnly = withMusic.left.map((v, i) => v - (without.left[i] ?? 0));
    const expected = Math.min(MIX_DEFAULTS.voiceTargetDb - 15, rmsDb(src) - MIX_DEFAULTS.sourceOverMusicDb);
    expect(rmsDb(musicOnly, -120)).toBeCloseTo(expected, 0);
  });

  it("không có tiếng gốc (null hoặc gain 0): nhạc theo quy tắc cũ", () => {
    const music = { channels: [sine(2, 0.5, 30)], levelBelowVoiceDb: 15 };
    const opts = { sampleRate: SR, durationSec: 2, fadeInSec: 0, fadeOutSec: 0 };
    const old = mixProgram([], music, opts);
    const muted = mixProgram([], music, opts, { channels: [sine(2, 0.2)], startSec: 0, gain: 0 });
    expect(Array.from(muted.left)).toEqual(Array.from(old.left));
  });
});
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `npx vitest run tests/client/media/resample.test.ts tests/client/media/SourceAudioAssembler.test.ts tests/client/media/AudioMix.test.ts`
Expected: FAIL — `Cannot find package '@/client/media/resample'`, `…SourceAudioAssembler`, `MIX_DEFAULTS.sourceEdgeFadeSec` undefined / `expected 0 to be close to …`.

- [ ] **Step 3: Viết resample + assembler**

`src/client/media/resample.ts`:

```ts
/** Nửa số nhịp của bộ lọc ở tần số gốc khi tăng tần số mẫu (khi giảm thì giãn theo tỉ lệ). */
export const RESAMPLE_HALF_TAPS = 16;
/** Tỉ lệ cần quá nhiều pha (tần số lạ) thì dùng nội suy tuyến tính. */
const MAX_PHASES = 4096;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const sinc = (x: number) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
/** Cửa sổ Blackman trên [−1, 1]. */
const blackman = (t: number) => 0.42 + 0.5 * Math.cos(Math.PI * t) + 0.08 * Math.cos(2 * Math.PI * t);

/**
 * Lấy mẫu lại một kênh bằng sinc cửa sổ Blackman, bảng hệ số đa pha (tỉ lệ hữu tỉ up/down).
 * Đo trên máy dev (Node 22): 300 s mono 44,1 → 48 kHz ≈ 1,1 s; chặn chồng phổ ≈ −75 dB. Cùng tần số thì trả nguyên mảng.
 */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (!Number.isInteger(fromRate) || !Number.isInteger(toRate) || fromRate <= 0 || toRate <= 0) {
    throw new RangeError("Tần số mẫu không hợp lệ");
  }
  if (fromRate === toRate) return input;
  const g = gcd(fromRate, toRate);
  const up = toRate / g;
  const down = fromRate / g;
  const outLength = Math.floor((input.length * up) / down);
  if (up > MAX_PHASES) return resampleLinear(input, fromRate / toRate, outLength);

  // Khi giảm tần số mẫu, hạ tần số cắt về Nyquist mới để chống chồng phổ.
  const cutoff = Math.min(1, toRate / fromRate);
  const half = Math.ceil(RESAMPLE_HALF_TAPS / cutoff);
  const taps = 2 * half;
  const table = new Float32Array(up * taps);
  for (let p = 0; p < up; p++) {
    const frac = p / up;
    let sum = 0;
    for (let k = 0; k < taps; k++) {
      const x = k - half + 1 - frac; // khoảng cách (mẫu gốc) từ nhịp k tới điểm cần tính
      const v = Math.abs(x) >= half ? 0 : sinc(x * cutoff) * blackman(x / half);
      table[p * taps + k] = v;
      sum += v;
    }
    // Chuẩn hoá tổng hệ số = 1: giữ nguyên mức một chiều và biên độ dải thông.
    for (let k = 0; k < taps; k++) table[p * taps + k] = (table[p * taps + k] as number) / sum;
  }

  const out = new Float32Array(outLength);
  const n = input.length;
  for (let i = 0; i < outLength; i++) {
    const pos = i * down; // vị trí × up (số nguyên)
    const base = Math.floor(pos / up);
    const row = (pos - base * up) * taps;
    const start = base - half + 1;
    const k0 = Math.max(0, -start);
    const k1 = Math.min(taps, n - start);
    let acc = 0;
    for (let k = k0; k < k1; k++) acc += (input[start + k] as number) * (table[row + k] as number);
    out[i] = acc;
  }
  return out;
}

function resampleLinear(input: Float32Array, step: number, outLength: number): Float32Array {
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * step;
    const j = Math.floor(pos);
    const a = input[j] ?? 0;
    const b = input[j + 1] ?? a;
    out[i] = a + (b - a) * (pos - j);
  }
  return out;
}
```

`src/client/media/SourceAudioAssembler.ts`:

```ts
import { resample } from "./resample";

export interface AssemblerOptions {
  /** Tần số mẫu của bản trộn (RENDER_SAMPLE_RATE). */
  targetRate: number;
  /** Mốc (giây, trong file) của khung hình đầu: âm đặt theo mốc này để khớp hình. */
  originSec: number;
  /** Độ dài video (giây, từ khung đầu): âm ngắn hơn thì phần thiếu lặng, dài hơn thì cắt. */
  durationSec: number;
  /** 1 (mono) hoặc 2 (stereo). */
  channelCount: number;
}

export interface DecodedChunk {
  timestampSec: number;
  sampleRate: number;
  /** Mỗi kênh một mảng Float32 (planar). Ít kênh hơn `channelCount` thì kênh cuối được dùng lại. */
  channels: Float32Array[];
}

/**
 * Ghép các mẩu âm đã giải mã (ở tần số gốc — lấy từ mẩu đầu, vì HE-AAC có thể báo tần số track bằng nửa thực tế)
 * vào bộ đệm dài đúng `durationSec`, rồi lấy mẫu lại MỘT lần cả kênh (tránh tiếng tách ở biên mẩu).
 */
export class SourceAudioAssembler {
  private nativeRate = 0;
  private buffers: Float32Array[] = [];

  constructor(private readonly o: AssemblerOptions) {
    if (o.channelCount !== 1 && o.channelCount !== 2) throw new RangeError("Chỉ ghép 1 hoặc 2 kênh");
  }

  get channelCount(): number {
    return this.o.channelCount;
  }

  add(chunk: DecodedChunk): void {
    if (this.nativeRate === 0) {
      this.nativeRate = chunk.sampleRate;
      const length = Math.ceil(this.o.durationSec * chunk.sampleRate);
      this.buffers = Array.from({ length: this.o.channelCount }, () => new Float32Array(length));
    } else if (chunk.sampleRate !== this.nativeRate) {
      throw new Error("Âm thanh gốc đổi tần số mẫu giữa chừng");
    }
    const offset = Math.round((chunk.timestampSec - this.o.originSec) * this.nativeRate);
    for (let c = 0; c < this.o.channelCount; c++) {
      const src = chunk.channels[Math.min(c, chunk.channels.length - 1)];
      const dst = this.buffers[c];
      if (!src || !dst) continue;
      const from = Math.max(0, -offset);
      const to = Math.min(src.length, dst.length - offset);
      if (to > from) dst.set(src.subarray(from, to), offset + from);
    }
  }

  /** Mỗi kênh dài đúng round(durationSec × targetRate). */
  finish(): Float32Array[] {
    const length = Math.round(this.o.durationSec * this.o.targetRate);
    if (this.nativeRate === 0) return Array.from({ length: this.o.channelCount }, () => new Float32Array(length));
    return this.buffers.map((buffer) => fitLength(resample(buffer, this.nativeRate, this.o.targetRate), length));
  }
}

function fitLength(a: Float32Array, length: number): Float32Array {
  if (a.length === length) return a;
  const out = new Float32Array(length);
  out.set(a.subarray(0, Math.min(length, a.length)));
  return out;
}
```

- [ ] **Step 4: Viết AudioMix**

`src/client/media/AudioMix.ts`:

- `MIX_DEFAULTS` thành:

```ts
export const MIX_DEFAULTS = {
  voiceTargetDb: -16.5,
  gateDb: -45,
  fadeInSec: 1.5,
  fadeOutSec: 2,
  ceiling: 0.89,
  /** Nhạc nền thấp hơn tiếng gốc của video tải lên ít nhất ngần này (dB). */
  sourceOverMusicDb: 12,
  /** Vuốt vào/ra tiếng gốc chống tiếng tách ở biên thẻ đầu/cuối video. */
  sourceEdgeFadeSec: 0.02,
} as const;
```

- Thêm sau `MusicBed`:

```ts
/** Tiếng gốc của video tải lên: đặt từ `startSec`, nhân `gain`, KHÔNG chuẩn hoá. */
export interface SourceBed {
  /** 1 kênh (mono) hoặc 2 kênh (trái, phải), cùng sampleRate với bản trộn. */
  channels: Float32Array[];
  startSec: number;
  /** 0 = tắt; 1 = giữ nguyên; tối đa 1,5. */
  gain: number;
}
```

- Thay vòng cuối của `applyLimiter` (bỏ mảng `prefix` Float64 — tiết kiệm 8 byte/mẫu, ≈ 117 MB cho 5 phút; kết quả như cũ tới sai số làm tròn):

```ts
  const w = Math.max(1, Math.round(LIMITER_LOOKAHEAD_SEC * sampleRate));
  const ahead = slidingMinAhead(need, w);
  const first = ahead[0] as number;

  // Trung bình trượt 5 ms bằng tổng chạy (số thực 64 bit) thay cho mảng tiền tố.
  let running = 0;
  let minGain = 1;
  for (let i = 0; i < n; i++) {
    running += ahead[i] as number;
    if (i >= w) running -= ahead[i - w] as number;
    const padded = i < w - 1 ? (w - 1 - i) * first : 0;
    const gain = (running + padded) / w;
    left[i] = (left[i] ?? 0) * gain;
    right[i] = (right[i] ?? 0) * gain;
    if (gain < minGain) minGain = gain;
  }
  return 20 * Math.log10(minGain);
```

- Thay `mixProgram`:

```ts
export function mixProgram(
  voices: readonly MonoClip[],
  music: MusicBed | null,
  options: MixOptions,
  source: SourceBed | null = null,
): StereoMix {
  const sr = options.sampleRate;
  const n = Math.ceil(options.durationSec * sr);
  const target = options.voiceTargetDb ?? MIX_DEFAULTS.voiceTargetDb;
  const fadeIn = options.fadeInSec ?? MIX_DEFAULTS.fadeInSec;
  const fadeOut = options.fadeOutSec ?? MIX_DEFAULTS.fadeOutSec;
  const ceiling = options.ceiling ?? MIX_DEFAULTS.ceiling;

  const voice = new Float32Array(n);
  for (const clip of voices) {
    const start = Math.round(clip.startSec * sr);
    for (let j = 0; j < clip.samples.length && start + j < n; j++) {
      voice[start + j] = (voice[start + j] ?? 0) + (clip.samples[j] ?? 0);
    }
  }
  const voiceLevel = rmsDb(voice);
  const voiceGain = Number.isFinite(voiceLevel) ? dbToGain(target - voiceLevel) : 1;

  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = (voice[i] ?? 0) * voiceGain;
    left[i] = v;
    right[i] = v;
  }

  // Tiếng gốc: mức của nó (sau hệ số) quyết định trần của nhạc nền.
  let sourceLevelDb = -Infinity;
  if (source && source.gain > 0 && source.channels.length > 0) {
    const srcL = source.channels[0] as Float32Array;
    const srcR = source.channels[1] ?? srcL;
    const start = Math.round(source.startSec * sr);
    const len = Math.min(srcL.length, n - start);
    const edge = Math.max(1, Math.round(MIX_DEFAULTS.sourceEdgeFadeSec * sr));
    for (let j = 0; j < len; j++) {
      const g = source.gain * Math.min(1, j / edge, (len - 1 - j) / edge);
      left[start + j] = (left[start + j] ?? 0) + (srcL[j] ?? 0) * g;
      right[start + j] = (right[start + j] ?? 0) + (srcR[j] ?? 0) * g;
    }
    const level = rmsDb(srcL);
    if (Number.isFinite(level)) sourceLevelDb = level + 20 * Math.log10(source.gain);
  }

  if (music && music.channels.length > 0) {
    const srcL = music.channels[0] as Float32Array;
    const srcR = music.channels[1] ?? srcL;
    const musicLevel = rmsDb(srcL, -60);
    if (Number.isFinite(musicLevel) && srcL.length > 0) {
      const musicTargetDb = Number.isFinite(sourceLevelDb)
        ? Math.min(target - music.levelBelowVoiceDb, sourceLevelDb - MIX_DEFAULTS.sourceOverMusicDb)
        : target - music.levelBelowVoiceDb;
      const gain = dbToGain(musicTargetDb - musicLevel);
      for (let i = 0; i < n; i++) {
        const f = gain * fadeGain(i, n, sr, fadeIn, fadeOut);
        left[i] = (left[i] ?? 0) + (srcL[i % srcL.length] ?? 0) * f;
        right[i] = (right[i] ?? 0) + (srcR[i % srcR.length] ?? 0) * f;
      }
    }
  }

  const limiterGainDb = applyLimiter(left, right, sr, ceiling);
  return { left, right, sampleRate: sr, limiterGainDb };
}
```

Lưu ý test "vuốt": với `j = 0` hệ số là `min(1, 0/edge, …) = 0` nên `out.left[1000] = 0` — đúng như test; mẫu giữa (`j = 100`) hệ số đúng `gain`.

- [ ] **Step 5: Chạy test âm, xác nhận xanh (kể cả test limiter cũ)**

Run: `npx vitest run tests/client/media`
Expected: PASS (test `applyLimiter` cũ vẫn xanh với tổng chạy; nếu một kỳ vọng `toBeCloseTo(…, 7)` lệch do làm tròn, KHÔNG sửa test — báo lại kèm số lệch).

- [ ] **Step 6: Viết decodeSourceAudio + worker (phần âm)**

`src/client/media/decodeSourceAudio.ts`:

```ts
import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from "mediabunny";
import { SourceAudioAssembler } from "./SourceAudioAssembler";

/**
 * Giải mã track âm của video tải lên (WebCodecs, chạy được trong worker), đặt theo mốc khung hình đầu, lấy mẫu lại về
 * `targetRate`. Trả null khi không có track âm hoặc trình duyệt không giải mã được. Không chạy trong Vitest (cần trình duyệt).
 */
export async function decodeSourceAudio(blob: Blob, targetRate: number, durationSec: number): Promise<Float32Array[] | null> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return null;
    const video = await input.getPrimaryVideoTrack();
    const originSec = video ? await video.getFirstTimestamp() : 0;
    const assembler = new SourceAudioAssembler({
      targetRate,
      originSec,
      durationSec,
      channelCount: Math.min(2, Math.max(1, track.numberOfChannels)),
    });
    const sink = new AudioSampleSink(track);
    for await (const sample of sink.samples(originSec, originSec + durationSec)) {
      try {
        const channels = Array.from({ length: Math.min(assembler.channelCount, sample.numberOfChannels) }, (_, c) => {
          const plane = new Float32Array(sample.numberOfFrames);
          sample.copyTo(plane, { planeIndex: c, format: "f32-planar" });
          return plane;
        });
        assembler.add({ timestampSec: sample.timestamp, sampleRate: sample.sampleRate, channels });
      } finally {
        sample.close();
      }
    }
    return assembler.finish();
  } finally {
    input.dispose();
  }
}
```

`src/client/render/render.worker.ts`:

- Import: `import { mixProgram, type SourceBed, type StereoMix } from "@/client/media/AudioMix";` và `import { decodeSourceAudio } from "@/client/media/decodeSourceAudio";`.
- Dòng plan: `const { timeline, voices, clipSlot } = planRender(job, timelineConfigFor(template.defaults.timeline, options));`
- Thay dòng `const mix = mixProgram(...)` và dòng `await enc.addAudio(mix);` (giữ nguyên khối tạo canvas/encoder ở giữa) theo thứ tự:

```ts
    scope.postMessage({ type: "progress", stage: "audio" });
    let source: SourceBed | null = null;
    const clip = job.sourceClip;
    if (clip && clip.hasAudio && clip.gain > 0 && clipSlot) {
      const channels = await decodeSourceAudio(clip.blob, job.sampleRate, clip.durationSec);
      if (channels) source = { channels, startSec: clipSlot.start, gain: clip.gain };
    }
    let mix: StereoMix | null = mixProgram(voices, job.music, { sampleRate: job.sampleRate, durationSec: timeline.totalDuration }, source);
    source = null; // nhả tiếng gốc đã giải mã (≈ 115 MB với video 5 phút stereo)
```

  … (khối tạo `canvas`, `ctx`, `backdrop`, `enc`, `await enc.start();` giữ nguyên) …

```ts
    await enc.addAudio(mix);
    mix = null; // âm đã mã hoá AAC; nhả hai kênh Float32 trước khi dựng hình
```

- [ ] **Step 7: Chạy toàn bộ kiểm tra + e2e kiểu cũ**

Run: `npx vitest run; npm run typecheck; npm run lint; npm run test:e2e -- e2e/02-toan-luong.spec.ts`
Expected: sạch; e2e 02 PASS với số đo âm như Task 4 (giọng −16,51 dB, đỉnh 0,358, nghỉ ≈ −31,5 dB). Ghi số vào report.

- [ ] **Step 8: Commit** (điều phối viên) — `feat: trộn tiếng gốc video tải lên (lấy mẫu lại, nhạc dưới tiếng gốc)`

---

### Task 6: Nối bước Giọng tiêu đề, Nhạc nền, Dựng + thông báo

**Có Vitest:** `renderSummary`, nhãn giai đoạn của `RenderController`. **Không Vitest:** `StepVoice.tsx`, `StepMusic.tsx`, `StepRender.tsx` (kiểm bằng e2e 02 cũ ở task này và e2e 07 ở Task 7).

**Files:**
- Create: `src/client/controllers/renderSummary.ts`, `tests/client/controllers/renderSummary.test.ts`
- Modify: `src/client/controllers/RenderController.ts`, `src/views/studio/steps/StepVoice.tsx`, `src/views/studio/steps/StepMusic.tsx`, `src/views/studio/steps/StepRender.tsx`
- Test: `tests/client/controllers/RenderController.test.ts` (thêm khối)

**Interfaces:**
- Consumes: `StudioData` (`project.kind`, `sourceClip`, `narrations`, `music`), `formatClock`, fixtures `makeUploadProject`, `makeClip`, `fakeNarration`, `makeProject`, `makeSession`.
- Produces: `renderSummary(data: StudioData): string`; `LONG_CLIP_SEC = 60`; `RenderController` dùng nhãn "Nạp font và video tải lên" ở giai đoạn `loading` khi dự án kiểu upload.

- [ ] **Step 1: Viết test (đỏ)**

`tests/client/controllers/renderSummary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderSummary } from "@/client/controllers/renderSummary";
import { EMPTY_STUDIO } from "@/client/controllers/StudioSession";
import { MusicTrack } from "@/domain/MusicTrack";
import { fakeNarration, makeClip, makeProject, makeUploadProject, VOICE } from "../../helpers/studioFixtures";

describe("renderSummary", () => {
  it("kiểu tin: giữ đúng câu cũ", () => {
    const project = makeProject(2);
    const d = { ...EMPTY_STUDIO, project, voice: VOICE, narrations: new Map(project.scenes.map((s) => [s.id, fakeNarration(s)])) };
    expect(renderSummary(d)).toBe("3 cảnh, giọng gốc khoảng 5 giây, nhạc: không dùng.");
  });

  it("kiểu tải lên: thẻ tiêu đề + video, tiếng gốc, không phụ đề, nhạc", () => {
    const project = makeUploadProject();
    const music = MusicTrack.create({ id: "m1", title: "Bản tin", origin: "library", uri: "/music/a.mp3" });
    const d = {
      ...EMPTY_STUDIO,
      kind: "upload" as const,
      project,
      voice: VOICE,
      narrations: new Map([["s1", fakeNarration(project.introScene, VOICE, 2.4)]]),
      sourceClip: makeClip({ durationSec: 65, volumePercent: 80 }),
      music,
    };
    expect(renderSummary(d)).toBe("Thẻ tiêu đề (giọng khoảng 2.4 giây) + video 1:05 (tiếng gốc 80%), không phụ đề, nhạc: Bản tin.");
    expect(renderSummary({ ...d, sourceClip: makeClip({ volumePercent: 0 }) })).toContain("(tắt tiếng gốc)");
    expect(renderSummary({ ...d, sourceClip: makeClip({ hasAudio: false }) })).toContain("(không có tiếng gốc)");
    expect(renderSummary({ ...d, sourceClip: null })).toBe("Chưa có video tải lên, nhạc: Bản tin.");
  });

  it("chưa có dự án: chuỗi rỗng", () => {
    expect(renderSummary(EMPTY_STUDIO)).toBe("");
  });
});
```

Thêm vào cuối `tests/client/controllers/RenderController.test.ts` (import `RenderController`, `makeSession`, `makeUploadProject`, `makeProject` nếu chưa có; `RenderJob` type):

```ts
describe("RenderController — nhãn theo kiểu video", () => {
  async function labelDuringLoading(project: ReturnType<typeof makeProject>) {
    const { session } = makeSession();
    session.update((d) => ({ ...d, project }));
    let seen = "";
    const ctrl: RenderController = new RenderController({
      session,
      builder: { build: async () => ({ job: {} as RenderJob, warnings: [] }) },
      render: async (_job, onProgress) => {
        onProgress?.({ type: "progress", stage: "loading" });
        if (ctrl.state.status === "working") seen = ctrl.state.label;
        return { blob: new Blob(["x"]), durationSec: 9 };
      },
      cancelRender: () => {},
      support: async () => ({ ok: true, missing: [] }),
      probeWorker: async () => [],
      createUrl: () => "blob:x",
      revokeUrl: () => {},
    });
    await ctrl.start();
    return seen;
  }

  it("kiểu tải lên: 'Nạp font và video tải lên'; kiểu tin giữ 'Nạp font và cảnh trám'", async () => {
    expect(await labelDuringLoading(makeUploadProject())).toBe("Nạp font và video tải lên");
    expect(await labelDuringLoading(makeProject(2))).toBe("Nạp font và cảnh trám");
  });
});
```

(Nếu `SupportReport` của `support` có hình dạng khác `{ ok, missing }`, dùng đúng kiểu trong `src/client/render/BrowserSupport.ts`.)

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `npx vitest run tests/client/controllers/renderSummary.test.ts tests/client/controllers/RenderController.test.ts`
Expected: FAIL — `Cannot find package '@/client/controllers/renderSummary'`, `expected 'Nạp font và cảnh trám' to be 'Nạp font và video tải lên'`.

- [ ] **Step 3: Viết controller**

`src/client/controllers/renderSummary.ts`:

```ts
import { formatClock } from "@/client/media/UploadValidator";
import type { StudioData } from "./StudioSession";

/** Video tải lên dài hơn ngần này (giây) thì bước Dựng nhắc giữ tab mở. */
export const LONG_CLIP_SEC = 60;

/** Câu tóm tắt ở bước Dựng. Kiểu tin giữ nguyên câu cũ. */
export function renderSummary(data: StudioData): string {
  const { project } = data;
  if (!project) return "";
  const music = data.music ? data.music.title : "không dùng";
  if (project.kind === "upload") {
    const clip = data.sourceClip;
    if (!clip) return `Chưa có video tải lên, nhạc: ${music}.`;
    const voiceSec = data.narrations.get(project.introScene.id)?.durationSec ?? 0;
    const audio = !clip.hasAudio ? "không có tiếng gốc" : clip.volumePercent === 0 ? "tắt tiếng gốc" : `tiếng gốc ${clip.volumePercent}%`;
    return `Thẻ tiêu đề (giọng khoảng ${voiceSec.toFixed(1)} giây) + video ${formatClock(clip.durationSec)} (${audio}), không phụ đề, nhạc: ${music}.`;
  }
  const voiceSeconds = [...data.narrations.values()].reduce((sum, n) => sum + n.durationSec, 0);
  return `${project.scenes.length} cảnh, giọng gốc khoảng ${voiceSeconds.toFixed(0)} giây, nhạc: ${music}.`;
}
```

`src/client/controllers/RenderController.ts`:

- Thêm sau `STAGE_LABEL`:

```ts
function stageLabel(stage: Progress["stage"], upload: boolean): string {
  return stage === "loading" && upload ? "Nạp font và video tải lên" : STAGE_LABEL[stage];
}
```

- Trong `start()`, sau `const data = this.deps.session.state;` thêm `const upload = data.project?.kind === "upload";`; trong callback render đổi `STAGE_LABEL[p.stage]` thành `stageLabel(p.stage, upload)`.

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `npx vitest run tests/client/controllers`
Expected: PASS.

- [ ] **Step 5: Viết view**

`src/views/studio/steps/StepVoice.tsx`:

- Sau `const project = data.project; if (!project) return null;` thêm `const upload = project.kind === "upload";`
- Tiêu đề: `<h2 className="text-lg font-semibold">{upload ? "Giọng đọc tiêu đề" : "Chọn giọng đọc"}</h2>` và ngay dưới:

```tsx
      {upload && (
        <p className="text-sm text-neutral-400">Kiểu Video tải lên chỉ đọc câu tiêu đề trên thẻ đầu; phần video giữ tiếng gốc.</p>
      )}
```

(Nút "Tạo giọng" / danh sách một câu giữ nguyên logic: `stale.size === project.scenes.length` vẫn ra "Tạo giọng".)

`src/views/studio/steps/StepMusic.tsx` — ngay sau `<h2 className="text-lg font-semibold">Nhạc nền</h2>` thêm:

```tsx
      {data.project?.kind === "upload" && (
        <p className="text-sm text-neutral-400">
          Nhạc nền chạy suốt video và tự đặt thấp hơn tiếng gốc ít nhất 12 dB (chỉnh thêm ±6 dB bên dưới). Không dùng nhạc cũng được.
        </p>
      )}
```

`src/views/studio/steps/StepRender.tsx`:

- Import `LONG_CLIP_SEC, renderSummary` từ `@/client/controllers/renderSummary`.
- Bỏ dòng `const voiceSeconds = …`; thay đoạn `<p className="text-sm text-neutral-400">{project.scenes.length} cảnh, … </p>` bằng:

```tsx
      <p className="text-sm text-neutral-400">{renderSummary(data)}</p>
      {project.kind === "upload" && (data.sourceClip?.durationSec ?? 0) > LONG_CLIP_SEC && (
        <p className="text-sm text-amber-400">
          Video dài: dựng có thể mất vài phút. Giữ tab này mở, không cho máy ngủ; chất lượng “Nhẹ” cho file nhỏ hơn và đỡ tốn bộ nhớ.
        </p>
      )}
```

- [ ] **Step 6: Chạy toàn bộ kiểm tra + e2e kiểu cũ**

Run: `npx vitest run; npm run typecheck; npm run lint; npm run test:e2e -- e2e/02-toan-luong.spec.ts e2e/04-tuy-chon-video.spec.ts`
Expected: tất cả PASS.

- [ ] **Step 7: Commit** (điều phối viên) — `feat: bước giọng/nhạc/dựng cho kiểu Video tải lên`

---

### Task 7: E2E, đo hiệu năng, README, đặc tả §15

**Có Vitest:** `rmsDbBetween`, `toneRmsDb`, `sampleClipArgs`. **Không Vitest:** `e2e/07-video-tai-len.spec.ts`, `e2e/08-hieu-nang-video-dai.spec.ts` (Playwright), README, đặc tả.

**Files:**
- Create: `scripts/make-sample-clip.ts`, `tests/scripts/makeSampleClip.test.ts`, `e2e/07-video-tai-len.spec.ts`, `e2e/08-hieu-nang-video-dai.spec.ts`
- Modify: `scripts/lib/audioMetrics.ts`, `scripts/measure-mp4.ts`, `e2e/helpers.ts`, `package.json` (script `sample:clip`), `README.md`, `docs/superpowers/specs/2026-10-15-tin-video-studio-design.md`
- Test: `tests/scripts/audioMetrics.test.ts` (thêm khối)

**Interfaces:**
- Consumes: toàn bộ luồng UI Task 1–6 (nhãn: radio "Video tải lên", ô "Tiêu đề video", nút "Tạo dự án", bước "Video của bạn"/"Giọng tiêu đề", `input[type=file]`, `data-testid="video-tai-len"`, thanh trượt "Âm thanh gốc", ô "Hiện phụ đề" bị khoá, `data-testid="ket-qua"`, link "Tải MP4"); `FfmpegMissingError`.
- Produces: `rmsDbBetween(channels, sampleRate, fromSec, toSec): number`; `toneRmsDb(channels, sampleRate, fromSec, toSec, frequency): number`; `decodeFileAudio(file): { channels: Float32Array[]; sampleRate: number }`; `sampleClipArgs(o)`, `makeSampleClip(o)`; helpers e2e `startUploadProject(page, title)`, `uploadClip(page, file)`.

- [ ] **Step 1: Viết test (đỏ)**

Thêm vào `tests/scripts/audioMetrics.test.ts` (import thêm `rmsDbBetween, toneRmsDb`):

```ts
describe("đo theo khoảng thời gian", () => {
  const SR = 8000;
  const tone = (freq: number, sec: number, amp: number) =>
    Float32Array.from({ length: Math.round(SR * sec) }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / SR));

  it("rmsDbBetween: RMS năng lượng của đoạn [from, to)", () => {
    const a = new Float32Array(SR * 2);
    a.set(tone(440, 1, 0.5), SR);
    expect(rmsDbBetween([a], SR, 1, 2)).toBeCloseTo(20 * Math.log10(0.5 / Math.SQRT2), 2);
    expect(rmsDbBetween([a], SR, 0, 1)).toBeLessThan(-100);
    expect(Number.isNaN(rmsDbBetween([a], SR, 3, 4))).toBe(true);
  });

  it("toneRmsDb: tách đúng thành phần 440 Hz, bỏ qua 230 Hz", () => {
    const mixed = tone(440, 1, 0.25).map((v, i) => v + 0.5 * Math.sin((2 * Math.PI * 230 * i) / SR));
    expect(toneRmsDb([mixed], SR, 0, 1, 440)).toBeCloseTo(20 * Math.log10(0.25 / Math.SQRT2), 1);
    expect(toneRmsDb([tone(230, 1, 0.5)], SR, 0, 1, 440)).toBeLessThan(-45);
  });
});
```

`tests/scripts/makeSampleClip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sampleClipArgs } from "../../scripts/make-sample-clip";

describe("sampleClipArgs", () => {
  it("có tiếng: testsrc2 + sin 440 Hz ở 44,1 kHz, H.264 yuv420p + AAC", () => {
    const args = sampleClipArgs({ out: "a.mp4", seconds: 8, width: 1280, height: 720, audio: true });
    expect(args).toEqual([
      "-v", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=8",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=8",
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-g", "60",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart", "a.mp4",
    ]);
  });

  it("không tiếng: -an", () => {
    const args = sampleClipArgs({ out: "b.mp4", seconds: 5, width: 640, height: 360, audio: false });
    expect(args).toContain("-an");
    expect(args.join(" ")).not.toContain("sine=");
  });
});
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `npx vitest run tests/scripts`
Expected: FAIL — `rmsDbBetween is not a function`, `Cannot find module '../../scripts/make-sample-clip'`.

- [ ] **Step 3: Viết script đo + tạo video mẫu**

Thêm vào cuối `scripts/lib/audioMetrics.ts`:

```ts
/** Trộn mono mẫu thứ i (trung bình các kênh). */
const monoAt = (channels: Float32Array[], i: number): number => {
  let x = 0;
  for (const ch of channels) x += ch[i] ?? 0;
  return x / Math.max(1, channels.length);
};

/** RMS (dB, trung bình năng lượng, không cổng) của đoạn [fromSec, toSec); NaN nếu đoạn rỗng. */
export function rmsDbBetween(channels: Float32Array[], sampleRate: number, fromSec: number, toSec: number): number {
  const n = channels[0]?.length ?? 0;
  const from = Math.max(0, Math.round(fromSec * sampleRate));
  const to = Math.min(n, Math.round(toSec * sampleRate));
  if (to <= from) return Number.NaN;
  let energy = 0;
  for (let i = from; i < to; i++) energy += monoAt(channels, i) ** 2;
  return 10 * Math.log10(energy / (to - from) + 1e-12);
}

/** RMS (dB) của riêng thành phần tần số `frequency` trong đoạn (Goertzel): tách tiếng gốc 440 Hz khỏi giọng giả, nhạc. */
export function toneRmsDb(channels: Float32Array[], sampleRate: number, fromSec: number, toSec: number, frequency: number): number {
  const n = channels[0]?.length ?? 0;
  const from = Math.max(0, Math.round(fromSec * sampleRate));
  const to = Math.min(n, Math.round(toSec * sampleRate));
  const count = to - from;
  if (count <= 0) return Number.NaN;
  const coeff = 2 * Math.cos((2 * Math.PI * frequency) / sampleRate);
  let s1 = 0;
  let s2 = 0;
  for (let i = from; i < to; i++) {
    const s0 = monoAt(channels, i) + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2);
  const amplitude = (2 * Math.sqrt(power)) / count;
  return 20 * Math.log10(amplitude / Math.SQRT2 + 1e-12);
}
```

`scripts/measure-mp4.ts` — thay `measureFile` bằng:

```ts
export interface DecodedFileAudio {
  channels: Float32Array[];
  sampleRate: number;
}

/** Giải mã âm của MP4 bằng ffmpeg (stereo 48 kHz). Ném FfmpegMissingError nếu máy không có ffmpeg. */
export function decodeFileAudio(file: string): DecodedFileAudio {
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
  return { channels: parsed.channels, sampleRate: parsed.sampleRate };
}

/** Giải mã âm của MP4 bằng ffmpeg rồi đo. Ném FfmpegMissingError nếu máy không có ffmpeg (để e2e bỏ qua phần đo). */
export function measureFile(file: string): AudioMetrics {
  const audio = decodeFileAudio(file);
  return audioMetrics(audio.channels, audio.sampleRate);
}
```

`scripts/make-sample-clip.ts`:

```ts
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { FfmpegMissingError } from "./measure-mp4";

export interface SampleClipOptions {
  out: string;
  seconds: number;
  width: number;
  height: number;
  /** Có track âm sin (mặc định 440 Hz, 44,1 kHz — khác 48 kHz để thử lấy mẫu lại). */
  audio: boolean;
  frequency?: number;
  sampleRate?: number;
}

/** Tham số ffmpeg tạo video mẫu bằng nguồn lavfi (testsrc2 + sine): không cần file nguồn, kết quả lặp lại được. */
export function sampleClipArgs(o: SampleClipOptions): string[] {
  const args = ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=${o.width}x${o.height}:rate=30:duration=${o.seconds}`];
  if (o.audio) {
    args.push("-f", "lavfi", "-i", `sine=frequency=${o.frequency ?? 440}:sample_rate=${o.sampleRate ?? 44100}:duration=${o.seconds}`);
  }
  args.push("-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-g", "60");
  if (o.audio) args.push("-c:a", "aac", "-b:a", "128k");
  else args.push("-an");
  args.push("-movflags", "+faststart", o.out);
  return args;
}

/** Tạo video mẫu; ném FfmpegMissingError nếu máy không có ffmpeg. */
export function makeSampleClip(o: SampleClipOptions): string {
  mkdirSync(dirname(o.out), { recursive: true });
  try {
    execFileSync("ffmpeg", sampleClipArgs(o), { stdio: ["ignore", "ignore", "pipe"] });
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") throw new FfmpegMissingError();
    throw error;
  }
  return o.out;
}

function main(): void {
  const [out, secondsText, ...flags] = process.argv.slice(2);
  if (!out) {
    console.error("Cách dùng: npm run sample:clip -- <ra.mp4> [giây=8] [--no-audio] [--size 1280x720]");
    process.exit(1);
  }
  const sizeIndex = flags.indexOf("--size");
  const [w, h] = (sizeIndex >= 0 ? (flags[sizeIndex + 1] ?? "1280x720") : "1280x720").split("x").map(Number);
  makeSampleClip({ out, seconds: Number(secondsText ?? 8), width: w ?? 1280, height: h ?? 720, audio: !flags.includes("--no-audio") });
  console.log(`Đã tạo ${out}`);
}

if (process.argv[1] && /make-sample-clip\.ts$/.test(process.argv[1].replace(/\\/g, "/"))) main();
```

`package.json` → `scripts` thêm `"sample:clip": "tsx scripts/make-sample-clip.ts",`.

- [ ] **Step 4: Chạy test script, xác nhận xanh**

Run: `npx vitest run tests/scripts`
Expected: PASS.

- [ ] **Step 5: Viết e2e kiểu Video tải lên**

Thêm vào cuối `e2e/helpers.ts`:

```ts
/** Bước 1 kiểu Video tải lên: chọn kiểu, nhập tiêu đề, tạo dự án, sang bước Video của bạn. */
export async function startUploadProject(page: Page, title: string): Promise<void> {
  await page.getByRole("radio", { name: "Video tải lên" }).check();
  await expect(page.getByRole("button", { name: "1. Nhập tiêu đề" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Cảnh trám/ })).toHaveCount(0);
  await page.getByLabel("Tiêu đề video").fill(title);
  await page.getByRole("button", { name: "Tạo dự án" }).click();
  await goNext(page, "Video của bạn");
}

/** Chọn file video ở bước Video của bạn và chờ đọc xong. */
export async function uploadClip(page: Page, file: string, clockText: string): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByTestId("video-tai-len")).toContainText(clockText, { timeout: 30_000 });
}
```

`e2e/07-video-tai-len.spec.ts`:

```ts
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FfmpegMissingError, decodeFileAudio } from "../scripts/measure-mp4";
import { makeSampleClip } from "../scripts/make-sample-clip";
import { toneRmsDb } from "../scripts/lib/audioMetrics";
import { discardDraftIfOffered, goNext, login, renderAndDownload, startUploadProject, stepButton, uploadClip } from "./helpers";

const CLIP_SEC = 8;
/** Sin lavfi mặc định biên độ 1/8 → RMS −21,07 dB. */
const SINE_DB = 20 * Math.log10(0.125 / Math.SQRT2);
const DIR = join("test-results", "mau-video-tai-len");
let withAudio = "";
let silent = "";
let ffmpeg = true;

test.beforeAll(() => {
  try {
    withAudio = makeSampleClip({ out: join(DIR, "clip-440.mp4"), seconds: CLIP_SEC, width: 1280, height: 720, audio: true });
    silent = makeSampleClip({ out: join(DIR, "clip-im.mp4"), seconds: CLIP_SEC, width: 720, height: 1280, audio: false });
  } catch (error) {
    if (!(error instanceof FfmpegMissingError)) throw error;
    ffmpeg = false;
  }
});

async function toRender(page: Page, music: "none" | "library"): Promise<void> {
  await goNext(page, "Giọng tiêu đề");
  await page.getByRole("button", { name: "Tạo giọng" }).click();
  await expect(page.getByText(/✓ [\d.]+ giây/)).toHaveCount(1, { timeout: 60_000 });
  await goNext(page, "Nhạc nền");
  if (music === "none") await page.getByRole("radio", { name: "Không dùng nhạc" }).check();
  else await page.getByRole("radio", { name: /Bản tin/ }).check();
  await goNext(page, "Dựng video");
  await expect(page.getByLabel("Hiện phụ đề")).toBeDisabled();
  await expect(page.getByText(/không phụ đề/)).toBeVisible();
}

async function shownDuration(page: Page): Promise<number> {
  const shown = await page.getByText(/[\d.]+ giây, [\d.]+ MB/).textContent();
  return Number(shown?.match(/([\d.]+) giây/)?.[1]);
}

test("Video tải lên: thẻ tiêu đề rồi video 8 s, tiếng gốc 100 %, không phụ đề", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  await startUploadProject(page, "Clip thử video tải lên");
  await expect(stepButton(page, 3)).toBeDisabled();
  await uploadClip(page, withAudio, "0:08");
  await expect(page.getByTestId("video-tai-len")).toContainText("có tiếng gốc");
  await expect(page.getByLabel(/Âm thanh gốc: 100%/)).toBeEnabled();
  await toRender(page, "none");

  const started = Date.now();
  const file = await renderAndDownload(page, "test-results", "tai-len-");
  const elapsed = (Date.now() - started) / 1000;
  const total = await shownDuration(page);
  const intro = total - CLIP_SEC;
  expect(intro).toBeGreaterThan(1);
  expect(intro).toBeLessThan(10);
  expect(elapsed).toBeLessThan(total * 1.5 + 10);

  const audio = decodeFileAudio(file);
  const audioSec = (audio.channels[0]?.length ?? 0) / audio.sampleRate;
  expect(Math.abs(audioSec - total)).toBeLessThan(0.15);
  const clipDb = toneRmsDb(audio.channels, audio.sampleRate, intro + 0.5, total - 0.5, 440);
  const introDb = toneRmsDb(audio.channels, audio.sampleRate, 0, intro - 0.05, 440);
  expect(clipDb).toBeGreaterThan(SINE_DB - 1.5);
  expect(clipDb).toBeLessThan(SINE_DB + 1.5);
  expect(introDb).toBeLessThan(-45); // thẻ đầu không có tiếng gốc
  console.log(`[e2e upload] tổng ${total} s (thẻ ${intro.toFixed(2)} s + video ${CLIP_SEC} s), dựng ${elapsed.toFixed(1)} s; tiếng gốc ${clipDb.toFixed(2)} dB (mong ${SINE_DB.toFixed(2)}), thẻ đầu ${introDb.toFixed(1)} dB`);
});

test("Video tải lên: tiếng gốc 50 % + nhạc nền", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  await startUploadProject(page, "Clip tiếng gốc một nửa");
  await uploadClip(page, withAudio, "0:08");
  await page.getByLabel(/Âm thanh gốc/).fill("50");
  await expect(page.getByLabel(/Âm thanh gốc: 50%/)).toBeVisible();
  await toRender(page, "library");
  await expect(page.getByText(/tiếng gốc 50%/)).toBeVisible();
  const file = await renderAndDownload(page, "test-results", "tai-len-50-");
  const total = await shownDuration(page);
  const audio = decodeFileAudio(file);
  const clipDb = toneRmsDb(audio.channels, audio.sampleRate, total - CLIP_SEC + 0.5, total - 0.5, 440);
  const expected = SINE_DB + 20 * Math.log10(0.5);
  expect(clipDb).toBeGreaterThan(expected - 1.5);
  expect(clipDb).toBeLessThan(expected + 1.5);
  console.log(`[e2e upload 50%] tiếng gốc ${clipDb.toFixed(2)} dB (mong ${expected.toFixed(2)})`);
});

test("Video tải lên: video không tiếng (dọc 720×1280) vẫn dựng, có cảnh báo; mở lại bản nháp", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await login(page);
  await discardDraftIfOffered(page);
  await startUploadProject(page, "Clip không tiếng");
  await uploadClip(page, silent, "0:08");
  await expect(page.getByTestId("video-tai-len")).toContainText("không có tiếng gốc");
  await expect(page.getByLabel(/Âm thanh gốc/)).toBeDisabled();

  // Bản nháp giữ dự án upload và video: tải lại trang rồi mở lại.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole("button", { name: "Mở lại" }).click();
  await expect(page.getByRole("button", { name: /^3\. Giọng tiêu đề/ })).toHaveAttribute("aria-current", "step");
  await stepButton(page, 2).click();
  await expect(page.getByTestId("video-tai-len")).toContainText("0:08");

  await toRender(page, "none");
  const file = await renderAndDownload(page, "test-results", "tai-len-im-");
  await expect(page.getByText("Video tải lên không có tiếng gốc")).toBeVisible();
  const total = await shownDuration(page);
  const audio = decodeFileAudio(file);
  expect(toneRmsDb(audio.channels, audio.sampleRate, total - CLIP_SEC + 0.5, total - 0.5, 440)).toBeLessThan(-45);
});

test("Video tải lên trên điện thoại 390 px: không cuộn ngang", async ({ page }) => {
  test.skip(!ffmpeg, "cần ffmpeg để tạo video mẫu");
  await page.setViewportSize({ width: 390, height: 844 });
  const noHorizontalScroll = async (screen: string) => {
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth, `${screen}: cuộn ngang toàn trang`).toBeLessThanOrEqual(innerWidth);
  };
  await login(page);
  await discardDraftIfOffered(page);
  await page.getByRole("radio", { name: "Video tải lên" }).check();
  await noHorizontalScroll("nhập tiêu đề");
  await page.getByLabel("Tiêu đề video").fill("Clip trên điện thoại");
  await page.getByRole("button", { name: "Tạo dự án" }).click();
  await noHorizontalScroll("sau tạo dự án");
  await goNext(page, "Video của bạn");
  await uploadClip(page, withAudio, "0:08");
  await noHorizontalScroll("video của bạn");
  await goNext(page, "Giọng tiêu đề");
  await noHorizontalScroll("giọng tiêu đề");
});
```

`e2e/08-hieu-nang-video-dai.spec.ts`:

```ts
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { decodeFileAudio } from "../scripts/measure-mp4";
import { makeSampleClip } from "../scripts/make-sample-clip";
import { toneRmsDb } from "../scripts/lib/audioMetrics";
import { discardDraftIfOffered, goNext, login, startUploadProject, uploadClip } from "./helpers";

/** Chỉ chạy khi PERF_CLIP=1 (lâu: tạo video 1080p 60 s và 300 s rồi dựng). Số đo ghi vào đặc tả §15. */
const CASES = [
  { seconds: 60, clock: "1:00", factor: 1.0, slackSec: 15 },
  { seconds: 300, clock: "5:00", factor: 1.2, slackSec: 30 },
] as const;

for (const c of CASES) {
  test(`hiệu năng: video tải lên 1080p ${c.seconds} s`, async ({ page }) => {
    test.skip(process.env.PERF_CLIP !== "1", "đặt PERF_CLIP=1 để đo");
    test.setTimeout(20 * 60_000);
    const clip = makeSampleClip({ out: join("test-results", "hieu-nang", `clip-${c.seconds}.mp4`), seconds: c.seconds, width: 1920, height: 1080, audio: true });
    await login(page);
    await discardDraftIfOffered(page);
    await startUploadProject(page, `Đo hiệu năng ${c.seconds} giây`);
    await uploadClip(page, clip, c.clock);
    await goNext(page, "Giọng tiêu đề");
    await page.getByRole("button", { name: "Tạo giọng" }).click();
    await expect(page.getByText(/✓ [\d.]+ giây/)).toHaveCount(1, { timeout: 60_000 });
    await goNext(page, "Nhạc nền");
    await page.getByRole("radio", { name: /Bản tin/ }).check();
    await goNext(page, "Dựng video");
    await page.getByRole("radio", { name: /Nhẹ/ }).check();

    const started = Date.now();
    await page.getByRole("button", { name: "Dựng video", exact: true }).click();
    await expect(page.getByTestId("ket-qua")).toBeVisible({ timeout: 15 * 60_000 });
    const elapsed = (Date.now() - started) / 1000;
    const shown = await page.getByText(/[\d.]+ giây, [\d.]+ MB/).textContent();
    const total = Number(shown?.match(/([\d.]+) giây/)?.[1]);
    const sizeMb = Number(shown?.match(/([\d.]+) MB/)?.[1]);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /^Tải MP4/ }).click()]);
    const file = test.info().outputPath(download.suggestedFilename());
    await download.saveAs(file);
    const audio = decodeFileAudio(file);
    const mid = toneRmsDb(audio.channels, audio.sampleRate, total - c.seconds / 2 - 1, total - c.seconds / 2 + 1, 440);
    console.log(`[perf] video ${c.seconds} s: tổng ${total} s, dựng ${elapsed.toFixed(1)} s (${(elapsed / total).toFixed(2)}×), ${sizeMb} MB, tiếng gốc giữa bài ${mid.toFixed(2)} dB`);
    expect(Math.abs(total - c.seconds) < 15).toBe(true);
    expect(elapsed).toBeLessThan(total * c.factor + c.slackSec);
    expect(mid).toBeGreaterThan(20 * Math.log10(0.125 / Math.SQRT2) - 1.5);
  });
}
```

- [ ] **Step 6: Chạy e2e đầy đủ**

Run: `npm run test:e2e`
Expected: toàn bộ PASS — 01–06 cũ (kể cả 06-mobile ba khổ 360/390/430) và 4 test mới của 07; 08 bị skip (không đặt PERF_CLIP). Ghi các dòng `[e2e upload…]` vào report. Không nới timeout.

- [ ] **Step 7: Đo hiệu năng video dài**

Run (PowerShell): `$env:PERF_CLIP = "1"; npm run test:e2e -- e2e/08-hieu-nang-video-dai.spec.ts`
Expected: 2 test PASS; dòng `[perf]` cho 60 s và 300 s. Tiêu chí chấp nhận: 60 s dựng < 1,0 × tổng + 15 s; 300 s dựng xong, < 1,2 × tổng + 30 s; tiếng gốc giữa bài trong ±1,5 dB của −21,07 dB. Nếu 300 s hỏng vì hết bộ nhớ hoặc vượt ngưỡng: KHÔNG nới ngưỡng, ghi số đo + thông báo lỗi vào report để Hải quyết (hạ giới hạn xuống 3 phút hoặc làm StreamTarget).

- [ ] **Step 8: README + đặc tả §15**

`README.md` — thêm mục (đặt sau mục mô tả luồng 5 bước):

```markdown
## Kiểu "Video tải lên"

Ở bước 1 chọn **Kiểu video → Video tải lên**: chỉ nhập tiêu đề (+ nguồn tin, ngày đăng, thương hiệu), bấm **Tạo dự án**.

1. **Nhập tiêu đề** — tiêu đề cũng là câu giọng đọc trên thẻ đầu.
2. **Video của bạn** — chọn đúng một video MP4/MOV/WebM, tối đa **5 phút** và **500 MB**. Chỉnh **Âm thanh gốc** 0–150 % (100 % = giữ nguyên, 0 = tắt).
3. **Giọng tiêu đề** — chỉ đọc câu tiêu đề.
4. **Nhạc nền** — tuỳ chọn; tự đặt thấp hơn tiếng gốc ít nhất 12 dB.
5. **Dựng video** — thẻ tiêu đề kiểu Theanh28 (ảnh lấy từ giây 1 của video) rồi video chạy trọn trong khung thân bài, nền mờ từ chính video. Không phụ đề.

Đã có dự án thì không đổi kiểu được; bấm **Dự án mới** để làm kiểu khác. Video quay iPhone dạng HEVC (.mov) có thể không đọc được trên Chrome Windows: xuất lại MP4 (H.264) trước khi tải lên.

Tạo video mẫu để thử: `npm run sample:clip -- test-results/mau.mp4 8` (cần ffmpeg). Đo hiệu năng video dài: `$env:PERF_CLIP="1"; npm run test:e2e -- e2e/08-hieu-nang-video-dai.spec.ts`.
```

`docs/superpowers/specs/2026-10-15-tin-video-studio-design.md` — thêm cuối file:

```markdown
## 15. Kiểu "Video tải lên" (2026-10-21)

- Hai kiểu video: "Bản tin nhiều cảnh" (như §3) và "Video tải lên". Kiểu chọn ở bước 1, nằm trong `NewsProject.kind` và `StudioData.kind`; khoá khi đã có dự án. Bước theo kiểu: Nhập tiêu đề → Video của bạn → Giọng tiêu đề → Nhạc nền → Dựng video.
- Dữ liệu: `SourceClip` (uploadId, tên, kích thước, độ dài, có tiếng gốc, âm lượng 0–150 %). Bản nháp v3 (`project.kind`, `sourceClip`), đọc được v1/v2. Blob video ở `UploadRepository`, được giữ khi dọn file, xoá khi thay/xoá video hoặc Dự án mới.
- Giới hạn: ≤ 5 phút (dung sai 0,5 s), ≤ 500 MB, MP4/MOV/WebM. Lý do: bản trộn âm 5 phút ≈ 410 MB đỉnh; MP4 đầu ra nằm trong RAM ≈ 2 × kích thước file (8 Mbps 5 phút ≈ 610 MB đỉnh lúc đóng gói).
- Bố cục: thẻ đầu Theanh28 (ảnh = khung tại min(1 s, độ dài/2)), thời lượng = nghỉ đầu + giọng tiêu đề + nghỉ sau tiêu đề; sau đó video vừa khung (không cắt, không Ken Burns) trong dải thân bài 1080×920, nền mờ từ chính video, góc logo/tên kênh, tem ngày, "THEO: …" + "VIDEO: TỔNG HỢP". Không phụ đề. Tổng = thẻ đầu + video (không đuôi).
- Âm: giọng tiêu đề −16,5 dB như cũ; tiếng gốc giải mã trong worker (mediabunny `AudioSampleSink`), đặt theo mốc khung hình đầu, lấy mẫu lại về 48 kHz (sinc Blackman 32 nhịp đa pha), nhân hệ số người dùng, vuốt 20 ms hai đầu, không chuẩn hoá; nhạc nền = min(−31,5 dB ± chỉnh, tiếng gốc − 12 dB), cố định cả bài; giới hạn đỉnh 0,89. Bộ giới hạn bỏ mảng tiền tố Float64 (tiết kiệm 117 MB với 5 phút).
- Số đo (máy dev, Node 22): lấy mẫu lại 300 s mono 44,1 → 48 kHz 1,1 s; 96 → 48 kHz 1,8 s; sai số sin 440 Hz 4·10⁻⁶; chống chồng phổ −75 dB. `mixProgram` 308 s (giọng + nhạc stereo) 0,73 s.
- Số đo e2e (Chrome headless, nhà cung cấp giả): video 8 s 1280×720 + sin 440 Hz — tổng …, dựng …, tiếng gốc 100 % … dB (mong −21,07), 50 % … dB (mong −27,09), thẻ đầu ≤ −45 dB ở 440 Hz.
- Hiệu năng (PERF_CLIP=1, 1080p, chất lượng Nhẹ): 60 s — tổng …, dựng … (…×), … MB; 300 s — tổng …, dựng … (…×), … MB.
```

Thay từng dấu `…` ở hai dòng số đo cuối bằng số thật lấy từ dòng `[e2e upload…]` (Step 6) và `[perf]` (Step 7); không để lại dấu `…` nào.

- [ ] **Step 9: Kiểm tra cuối**

Run: `npx vitest run; npm run typecheck; npm run lint; npm run build`
Expected: tất cả sạch; build thành công.

- [ ] **Step 10: Commit** (điều phối viên) — `test: e2e và đo hiệu năng kiểu Video tải lên; README, đặc tả §15`

---

## Rủi ro

1. **Bộ nhớ khi dựng video dài (cao nhất).** MP4 đầu ra giữ trọn trong RAM (`BufferTarget`) rồi chép sang `Blob`: đỉnh ≈ 2 × kích thước file (8 Mbps × 5 phút ≈ 610 MB) cộng bản trộn âm ≈ 410 MB (đã giảm ở Task 5, và nhả ngay sau khi mã hoá âm). Máy 8 GB có thể làm tab Chrome sập ở video 5 phút. Task 7 Step 7 đo thật; nếu không đạt, chọn: hạ giới hạn 3 phút, ép chất lượng "Nhẹ" khi > 2 phút, hoặc chặng sau chuyển sang `StreamTarget` ghi ra OPFS.
2. **Codec không đọc được trên Chrome Windows:** HEVC (.mov iPhone), AC-3/E-AC-3 trong .mov, ProRes. Probe báo lỗi tiếng Việt (`UNREADABLE_CLIP`) cho hình; âm không giải mã được → coi như không có tiếng gốc (cảnh báo). Cần thử với file iPhone/Android thật (chưa có trong kế hoạch vì cần file của Hải).
3. **Xoay video (metadata rotation) và VFR:** `getDisplayWidth/Height` + `CanvasSink` của mediabunny xử lý xoay; video tốc độ khung thay đổi (điện thoại) lấy theo mốc thời gian nên không lệch tiếng, nhưng chưa có e2e với file xoay thật.
4. **Lệch tiếng–hình theo mốc khung đầu:** âm đặt theo `getFirstTimestamp()` của track hình; file có edit list lạ (một số .mov) có thể lệch vài chục ms. Lavfi mẫu bắt đầu ở 0 nên e2e không bắt được.
5. **HE-AAC báo sai tần số ở container:** đã xử lý bằng cách lấy `sampleRate` từ mẩu giải mã đầu (không từ track).
6. **Thời gian dựng:** ước ~0,5–1× thời lượng; tab ở nền hoặc máy ngủ làm chậm/dừng. Bước Dựng nhắc khi video > 60 s.
7. **Hạn mức IndexedDB:** blob 500 MB + bản nháp; Chrome cho tới ~60 % dung lượng đĩa trống — máy gần đầy đĩa sẽ báo "Không lưu được bản nháp"/lỗi lưu blob.
8. **Bản nháp v3 không đọc được bởi bản build cũ** (nếu quay lui bản deploy) → bản cũ coi như không có bản nháp (không hỏng dữ liệu).
9. **Sai số làm tròn của bộ giới hạn đỉnh** sau khi đổi sang tổng chạy: chênh ≤ 1e-6 với bản cũ; nếu test cũ `toBeCloseTo(…, 7)` đỏ, không sửa test — báo lại.
10. **Test cũ phải sửa:** đúng 2 dòng `version: 2` → `3` trong `DraftRepository.test.ts`.

## Quyết định cần Hải duyệt (trước khi giao Task 1)

1. **Chọn kiểu ở bước 1 bằng ô radio** (không thêm bước "Chọn kiểu" riêng), **khoá kiểu sau khi tạo dự án** (đổi = Dự án mới). Đồng ý?
2. **Giới hạn 5 phút / 500 MB** (lý do §G2). Có muốn chặt hơn (3 phút) cho máy yếu không?
3. **Âm lượng tiếng gốc 0–150 %, bước 5, mặc định 100 %.** Có cần nút "Tắt tiếng" riêng ngoài kéo về 0?
4. **Video vừa khung (contain) trong dải thân bài 1080×920, không zoom.** Video dọc 9:16 sẽ chỉ rộng ≈ 518 px giữa nền mờ. Phương án khác: (a) cắt cho đầy (cover) như cảnh trám; (b) video dọc dùng khung lớn hơn (ví dụ cao 1240 px từ y = 300). Chọn phương án nào?
5. **Ảnh thẻ đầu = khung tại giây 1 (hoặc giữa clip nếu clip < 2 s).** Có cần cho người dùng chọn giây làm thumbnail không (thêm thanh trượt ở bước 2)?
6. **Nhạc nền = min(quy tắc cũ, tiếng gốc − 12 dB), mức cố định cả bài**, không "ducking" riêng ở thẻ đầu. Đồng ý?
7. **Dòng credit "VIDEO: TỔNG HỢP"** thay "ẢNH: TỔNG HỢP" ở kiểu này — hay muốn ô nhập tự do (ví dụ "VIDEO: NGƯỜI DÂN CUNG CẤP")?
8. **Nghỉ giữa thẻ đầu và video = thanh "Nghỉ sau tiêu đề"** (dùng lại `gapSec`, mặc định 0,35 s), **không có đuôi sau video**. Đồng ý?
9. **Âm gốc lỗi giải mã lúc dựng** (hiếm, vì đã kiểm lúc tải lên) → dừng dựng và báo lỗi, không âm thầm bỏ tiếng. Đồng ý?
10. **Chất lượng mặc định giữ "Chuẩn 8 Mbps"** cho cả video dài (chỉ nhắc chọn "Nhẹ" khi > 60 s), hay tự chuyển "Nhẹ" khi video > 2 phút?
